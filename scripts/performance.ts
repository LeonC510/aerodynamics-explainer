/**
 * Prints the model's performance figures next to the 172P handbook's.
 * Run with: npx tsx scripts/performance.ts
 */
import { derivatives, DEFAULT_SETTINGS, type Settings } from '../src/physics/dynamics';
import { trim } from '../src/physics/trim';
import { fpsToFpm, ktToFps } from '../src/units';

const PROP: Settings = { ...DEFAULT_SETTINGS, thrustFallsWithSpeed: true };

export function stallSpeedKt(set: Settings): number {
  for (let kt = 35; kt < 80; kt += 0.25)
    if (trim({ speedFps: ktToFps(kt), altitudeFt: 0, gammaRad: 0 }, set)) return kt;
  return NaN;
}
export function bestClimb(set: Settings): { kt: number; fpm: number } {
  let best = { kt: NaN, fpm: -Infinity };
  for (let kt = 50; kt <= 120; kt += 0.5) {
    const t = trim({ speedFps: ktToFps(kt), altitudeFt: 0, throttle: 1 }, set);
    if (t && fpsToFpm(t.state.vz) > best.fpm) best = { kt, fpm: fpsToFpm(t.state.vz) };
  }
  return best;
}
export function maxLevelSpeedKt(set: Settings): number {
  let top = NaN;
  for (let kt = 80; kt <= 170; kt += 0.25)
    if (trim({ speedFps: ktToFps(kt), altitudeFt: 0, gammaRad: 0 }, set)) top = kt;
  return top;
}
export function bestGlide(set: Settings): { kt: number; ratio: number } {
  let best = { kt: NaN, ratio: 0 };
  for (let kt = 50; kt <= 110; kt += 0.5) {
    const t = trim({ speedFps: ktToFps(kt), altitudeFt: 0, throttle: 0 }, set);
    if (!t) continue;
    const ratio = -1 / Math.tan(t.gammaRad);
    if (ratio > best.ratio) best = { kt, ratio };
  }
  return best;
}
export function glideRatioAt(kt: number, set: Settings): number {
  const t = trim({ speedFps: ktToFps(kt), altitudeFt: 0, throttle: 0 }, set);
  return t ? -1 / Math.tan(t.gammaRad) : NaN;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const f = (n: number) => n.toFixed(1);
  console.log('stall kt            ', f(stallSpeedKt(DEFAULT_SETTINGS)));
  const c1 = bestClimb(DEFAULT_SETTINGS), c2 = bestClimb(PROP);
  console.log('best climb const    ', f(c1.fpm), 'fpm at', f(c1.kt), 'kt');
  console.log('best climb prop     ', f(c2.fpm), 'fpm at', f(c2.kt), 'kt');
  console.log('max level const/prop', f(maxLevelSpeedKt(DEFAULT_SETTINGS)), f(maxLevelSpeedKt(PROP)));
  const g1 = bestGlide(DEFAULT_SETTINGS), g2 = bestGlide(PROP);
  console.log('best glide const    ', f(g1.ratio), 'at', f(g1.kt), 'kt; at 65 kt:', f(glideRatioAt(65, DEFAULT_SETTINGS)));
  console.log('best glide prop     ', f(g2.ratio), 'at', f(g2.kt), 'kt; at 65 kt:', f(glideRatioAt(65, PROP)));
  const t = trim({ speedFps: ktToFps(100), altitudeFt: 3000, gammaRad: 0 }, DEFAULT_SETTINGS)!;
  const fo = derivatives(t.state, t.controls, DEFAULT_SETTINGS).f;
  console.log('100 kt trim: throttle', t.controls.throttle.toFixed(3), 'elev deg', (t.controls.elevatorRad * 57.3).toFixed(2), 'alpha deg', (fo.alpha * 57.3).toFixed(2), 'drag', f(fo.drag));
}
