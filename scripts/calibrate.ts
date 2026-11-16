/**
 * Fits the CALIBRATION values in src/config/aircraft.ts to the 172P handbook (HANDBOOK there).
 * Run with: npx tsx scripts/calibrate.ts   — then copy the printed values into the config.
 *
 * Each step uses only values fixed by the steps before it:
 *   1. clMaxScale                 → stall speed
 *   2. kInduced                   ← assumed span efficiency (not fitted)
 *      cd0                        → maximum level speed, with the source propeller table as-is at that speed
 *      idlePropDragCd             → power-off glide ratio
 *   3. propThrustAtVy, propThrustSlopePerKt → best climb rate, and the speed it occurs at
 *   4. maxThrustLbf               → best climb rate in constant-thrust mode
 */
import { CALIBRATION, HANDBOOK, SPAN_EFFICIENCY, WING_AREA, WING_SPAN } from '../src/config/aircraft';
import { RHO0 } from '../src/config/atmosphere';
import { DEFAULT_SETTINGS, derivatives, type Settings } from '../src/physics/dynamics';
import { thrust } from '../src/physics/propulsion';
import { trim } from '../src/physics/trim';
import { ktToFps } from '../src/units';
import { bestClimb, bestGlide, maxLevelSpeedKt, stallSpeedKt } from './performance';

const PROP: Settings = { ...DEFAULT_SETTINGS, thrustFallsWithSpeed: true };

/** Finds x in lo..hi where f changes sign. */
function bisect(f: (x: number) => number, lo: number, hi: number, n = 30): number {
  let flo = f(lo);
  for (let i = 0; i < n; i++) {
    const mid = 0.5 * (lo + hi);
    const fm = f(mid);
    if (Math.sign(fm) === Math.sign(flo)) { lo = mid; flo = fm; } else hi = mid;
  }
  return 0.5 * (lo + hi);
}

// Start from a neutral propeller correction and ample constant thrust (so trims never saturate).
CALIBRATION.propThrustAtVy = 1;
CALIBRATION.propThrustSlopePerKt = 0;
CALIBRATION.maxThrustLbf = 2000;

// 1. Stall speed.
CALIBRATION.clMaxScale = bisect((s) => { CALIBRATION.clMaxScale = s; return stallSpeedKt(DEFAULT_SETTINGS) - HANDBOOK.stallKcas; }, 1, 1.4, 20);

/** Thrust needed for level flight at the handbook top speed, minus what the propeller gives there. */
function topSpeedThrustDeficit(): number {
  const t = trim({ speedFps: ktToFps(HANDBOOK.maxLevelKt), altitudeFt: 0, gammaRad: 0 }, DEFAULT_SETTINGS)!;
  const f = derivatives(t.state, t.controls, DEFAULT_SETTINGS).f;
  return f.thrust - thrust(1, f.speed * Math.cos(f.alpha), RHO0, true).thrustLbf;
}
function solveIdleDrag(): number {
  CALIBRATION.idlePropDragCd = 0;
  if (bestGlide(DEFAULT_SETTINGS).ratio <= HANDBOOK.glideRatio) return 0;
  return bisect((cd) => { CALIBRATION.idlePropDragCd = cd; return bestGlide(DEFAULT_SETTINGS).ratio - HANDBOOK.glideRatio; }, 0, 0.08, 22);
}

// 2. Drag. The induced-drag factor comes from the assumed span efficiency; cd0 is then fixed
//    by top speed and the idle-propeller drag by the glide ratio.
const AR = WING_SPAN ** 2 / WING_AREA;
CALIBRATION.kInduced = 1 / (Math.PI * AR * SPAN_EFFICIENCY);
CALIBRATION.idlePropDragCd = 0;
CALIBRATION.cd0 = bisect((c) => { CALIBRATION.cd0 = c; return topSpeedThrustDeficit(); }, 0.015, 0.06, 25);
CALIBRATION.idlePropDragCd = solveIdleDrag();

// 3. Propeller: scan the slope; for each, set the level so the best climb rate is the handbook's.
let bestP = { err: Infinity, m: NaN, b: NaN };
for (let b = 0; b >= -0.0121; b -= 0.0005) {
  CALIBRATION.propThrustSlopePerKt = b;
  const m = bisect((x) => { CALIBRATION.propThrustAtVy = x; return bestClimb(PROP).fpm - HANDBOOK.bestClimbFpm; }, 0.8, 1.5, 22);
  CALIBRATION.propThrustAtVy = m;
  const err = Math.abs(bestClimb(PROP).kt - HANDBOOK.bestClimbKias);
  if (err < bestP.err) bestP = { err, m, b };
}
CALIBRATION.propThrustAtVy = bestP.m;
CALIBRATION.propThrustSlopePerKt = bestP.b;

// 4. Constant-thrust mode: the best full-throttle climb rate equals the handbook's.
CALIBRATION.maxThrustLbf = bisect((t) => { CALIBRATION.maxThrustLbf = t; return bestClimb(DEFAULT_SETTINGS).fpm - HANDBOOK.bestClimbFpm; }, 250, 600, 25);

const r = (n: number, d = 4) => Number(n.toFixed(d));
console.log('CALIBRATION =', {
  cd0: r(CALIBRATION.cd0), kInduced: r(CALIBRATION.kInduced), clMaxScale: r(CALIBRATION.clMaxScale),
  propThrustAtVy: r(CALIBRATION.propThrustAtVy), propThrustSlopePerKt: r(CALIBRATION.propThrustSlopePerKt),
  idlePropDragCd: r(CALIBRATION.idlePropDragCd), maxThrustLbf: r(CALIBRATION.maxThrustLbf, 1),
});
const c = bestClimb(PROP), cc = bestClimb(DEFAULT_SETTINGS), g = bestGlide(PROP), gc = bestGlide(DEFAULT_SETTINGS);
console.log('stall', stallSpeedKt(DEFAULT_SETTINGS), '| prop climb', r(c.fpm, 0), '@', c.kt, '| const climb', r(cc.fpm, 0), '@', cc.kt,
  '| max level prop', maxLevelSpeedKt(PROP), 'const', maxLevelSpeedKt(DEFAULT_SETTINGS),
  '| glide prop', r(g.ratio, 2), '@', g.kt, 'const', r(gc.ratio, 2), '@', gc.kt);
