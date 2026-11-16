/**
 * Fits the CALIBRATION values in src/config/aircraft.ts to the 172P handbook.
 * Run with: npx tsx scripts/calibrate.ts   — then copy the printed values into the config.
 *
 * Order (each step only affects the targets after it):
 *   1. clMaxScale       → stall speed
 *   2. cd0, kInduced    → best climb rate and the speed it occurs at   (grid search)
 *      propThrustScale  → maximum level speed (solved exactly for each cd0, kInduced)
 *   3. idlePropDragCd   → power-off glide ratio in constant-thrust mode
 *   4. maxThrustLbf     → best climb rate in constant-thrust mode
 */
import { CALIBRATION, HANDBOOK, WING_AREA } from '../src/config/aircraft';
import { RHO0 } from '../src/config/atmosphere';
import { DEFAULT_SETTINGS, derivatives, type Settings } from '../src/physics/dynamics';
import { thrust } from '../src/physics/propulsion';
import { trim } from '../src/physics/trim';
import { ktToFps } from '../src/units';
import { bestClimb, bestGlide, maxLevelSpeedKt, stallSpeedKt } from './performance';

const PROP: Settings = { ...DEFAULT_SETTINGS, thrustFallsWithSpeed: true };
// Physically plausible bounds: span efficiency e = 1/(π·AR·k) between 0.55 and 0.85.
const AR = 35.8 ** 2 / WING_AREA;
const K_MIN = 1 / (Math.PI * AR * 0.85);
const K_MAX = 1 / (Math.PI * AR * 0.55);

function bisect(f: (x: number) => number, lo: number, hi: number, n = 40): number {
  let flo = f(lo);
  for (let i = 0; i < n; i++) {
    const mid = 0.5 * (lo + hi);
    const fm = f(mid);
    if (Math.sign(fm) === Math.sign(flo)) { lo = mid; flo = fm; } else hi = mid;
  }
  return 0.5 * (lo + hi);
}

// 1. Stall speed.
CALIBRATION.clMaxScale = bisect((s) => { CALIBRATION.clMaxScale = s; return stallSpeedKt(DEFAULT_SETTINGS) - HANDBOOK.stallKcas; }, 1, 1.4, 20);

/** Thrust scale that makes HANDBOOK.maxLevelKt the exact full-throttle level speed. */
function solvePropScale(): number {
  CALIBRATION.propThrustScale = 1;
  const v = ktToFps(HANDBOOK.maxLevelKt);
  const t = trim({ speedFps: v, altitudeFt: 0, gammaRad: 0 }, { ...DEFAULT_SETTINGS });
  if (!t) return NaN;
  const f = derivatives(t.state, t.controls, DEFAULT_SETTINGS).f;
  const unscaled = thrust(1, f.speed * Math.cos(f.alpha), RHO0, true).thrustLbf;
  return f.thrust / unscaled;
}

// 2. Drag polar and propeller scale.
CALIBRATION.maxThrustLbf = 2000; // so the constant-thrust trim inside solvePropScale never saturates
let best = { cost: Infinity, cd0: NaN, k: NaN, scale: NaN, fpm: NaN, kt: NaN };
for (let cd0 = 0.024; cd0 <= 0.0421; cd0 += 0.001)
  for (let k = K_MIN; k <= K_MAX; k += 0.002) {
    CALIBRATION.cd0 = cd0;
    CALIBRATION.kInduced = k;
    const scale = solvePropScale();
    if (!(scale > 0.8 && scale < 1.25)) continue;
    CALIBRATION.propThrustScale = scale;
    const c = bestClimb(PROP);
    const cost = ((c.fpm - HANDBOOK.bestClimbFpm) / HANDBOOK.bestClimbFpm) ** 2 * 4 + ((c.kt - HANDBOOK.bestClimbKias) / HANDBOOK.bestClimbKias) ** 2;
    if (cost < best.cost) best = { cost, cd0, k, scale, fpm: c.fpm, kt: c.kt };
  }
CALIBRATION.cd0 = best.cd0;
CALIBRATION.kInduced = best.k;
CALIBRATION.propThrustScale = best.scale;

// 3. Constant-thrust mode has no propeller model, so windmilling drag is a coefficient:
//    bring its best glide ratio down to the handbook's, if it is above it.
CALIBRATION.idlePropDragCd = 0;
if (bestGlide(DEFAULT_SETTINGS).ratio > HANDBOOK.glideRatio)
  CALIBRATION.idlePropDragCd = bisect((cd) => { CALIBRATION.idlePropDragCd = cd; return bestGlide(DEFAULT_SETTINGS).ratio - HANDBOOK.glideRatio; }, 0, 0.05, 25);

// 4. Constant-thrust mode: the best full-throttle climb rate equals the handbook's.
CALIBRATION.maxThrustLbf = bisect((t) => { CALIBRATION.maxThrustLbf = t; return bestClimb(DEFAULT_SETTINGS).fpm - HANDBOOK.bestClimbFpm; }, 250, 600, 25);

const r = (n: number, d = 4) => Number(n.toFixed(d));
console.log('CALIBRATION =', {
  cd0: r(CALIBRATION.cd0), kInduced: r(CALIBRATION.kInduced), clMaxScale: r(CALIBRATION.clMaxScale),
  propThrustScale: r(CALIBRATION.propThrustScale), idlePropDragCd: r(CALIBRATION.idlePropDragCd),
  maxThrustLbf: r(CALIBRATION.maxThrustLbf, 1),
});
console.log('span efficiency e =', r(1 / (Math.PI * AR * CALIBRATION.kInduced), 2));
const c = bestClimb(PROP), cc = bestClimb(DEFAULT_SETTINGS), g = bestGlide(PROP), gc = bestGlide(DEFAULT_SETTINGS);
console.log('stall', stallSpeedKt(DEFAULT_SETTINGS), '| prop climb', r(c.fpm, 0), '@', c.kt, '| const climb', r(cc.fpm, 0), '@', cc.kt,
  '| max level prop', maxLevelSpeedKt(PROP), 'const', maxLevelSpeedKt(DEFAULT_SETTINGS),
  '| glide prop', r(g.ratio, 2), '@', g.kt, 'const', r(gc.ratio, 2), '@', gc.kt);
