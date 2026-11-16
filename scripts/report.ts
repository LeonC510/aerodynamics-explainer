/** Prints the numbers recorded in docs/validation.md. Run with: npx tsx scripts/report.ts */
import { DEFAULT_SETTINGS, derivatives, rk4Step, type Controls, type Settings } from '../src/physics/dynamics';
import { trim } from '../src/physics/trim';
import { degToRad, fpsToFpm, fpsToKt, ktToFps } from '../src/units';
import { bestClimb, bestGlide, glideRatioAt, maxLevelSpeedKt, stallSpeedKt } from './performance';

const PROP: Settings = { ...DEFAULT_SETTINGS, thrustFallsWithSpeed: true };
const f1 = (n: number) => n.toFixed(1);
console.log('stall', stallSpeedKt(DEFAULT_SETTINGS));
for (const [name, set] of [['constant thrust', DEFAULT_SETTINGS], ['fixed-pitch', PROP]] as const) {
  const c = bestClimb(set), g = bestGlide(set);
  console.log(name, '| climb', f1(c.fpm), '@', c.kt, '| climb@76:', f1(fpsToFpm(trim({ speedFps: ktToFps(76), altitudeFt: 0, throttle: 1 }, set)!.state.vz)),
    '| max level', maxLevelSpeedKt(set), '| glide', g.ratio.toFixed(2), '@', g.kt, '| glide@65', glideRatioAt(65, set).toFixed(2));
}
const t = trim({ speedFps: ktToFps(100), altitudeFt: 3000, gammaRad: 0 }, DEFAULT_SETTINGS)!;
console.log('100 kt level trim: throttle', t.controls.throttle.toFixed(3), 'elevator deg', (t.controls.elevatorRad * 57.2958).toFixed(2), 'pitch deg', (t.state.theta * 57.2958).toFixed(2));
function settle(c: Controls, set = DEFAULT_SETTINGS) {
  let s = t.state; const cross: number[] = []; let prev = 0;
  const hist: number[] = [];
  for (let i = 0; i < 600 * 120; i++) { s = rk4Step(s, c, set, 1 / 120); if (i % 12 === 0) hist.push(s.vz); }
  const end = s.vz;
  for (let i = 1; i < hist.length; i++) { if (hist[i - 1] < end && hist[i] >= end) cross.push(i / 10); prev = i; }
  void prev;
  const f = derivatives(s, c, set).f;
  return { ias: fpsToKt(f.iasFps), fpm: fpsToFpm(s.vz), lift: f.lift, period: cross.length > 2 ? (cross[2] - cross[0]) / 2 : NaN };
}
const show = (label: string, r: ReturnType<typeof settle>) => console.log(label, '→ IAS', f1(r.ias), 'kt, climb', f1(r.fpm), 'ft/min, lift', f1(r.lift), 'lbf, period', f1(r.period), 's');
show('elevator −1°', settle({ ...t.controls, elevatorRad: t.controls.elevatorRad - degToRad(1) }));
show('throttle +0.2', settle({ ...t.controls, throttle: t.controls.throttle + 0.2 }));
show('throttle −0.2', settle({ ...t.controls, throttle: t.controls.throttle - 0.2 }));
const all: Settings = { altitudeEffects: false, thrustFallsWithSpeed: false, powerPitchCoupling: true };
show('throttle +0.2, power-pitch on', settle({ ...t.controls, throttle: t.controls.throttle + 0.2 }, all));
