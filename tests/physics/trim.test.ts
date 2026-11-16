import { expect, test } from 'vitest';
import { DEFAULT_SETTINGS, derivatives, rk4Step } from '../../src/physics/dynamics';
import { trim } from '../../src/physics/trim';
import { fpsToKt, ktToFps } from '../../src/units';

test('level trim at 100 kt has zero acceleration and a mid-range throttle', () => {
  const t = trim({ speedFps: ktToFps(100), altitudeFt: 3000, gammaRad: 0 }, DEFAULT_SETTINGS)!;
  const { d } = derivatives(t.state, t.controls, DEFAULT_SETTINGS);
  for (const v of [d.dvx, d.dvz, d.dq]) expect(Math.abs(v)).toBeLessThan(1e-6);
  expect(t.controls.throttle).toBeGreaterThan(0.2);
  expect(t.controls.throttle).toBeLessThan(0.9);
  expect(t.gammaRad).toBe(0);
});
test('a trimmed aircraft left alone stays put for a minute', () => {
  const t = trim({ speedFps: ktToFps(100), altitudeFt: 3000, gammaRad: 0 }, DEFAULT_SETTINGS)!;
  let s = t.state;
  for (let i = 0; i < 7200; i++) s = rk4Step(s, t.controls, DEFAULT_SETTINGS, 1 / 120);
  expect(Math.abs(s.h - 3000)).toBeLessThan(1);
  expect(Math.abs(fpsToKt(Math.hypot(s.vx, s.vz)) - 100)).toBeLessThan(0.1);
});
test('a fixed-throttle trim solves for the flight-path angle', () => {
  const glide = trim({ speedFps: ktToFps(80), altitudeFt: 3000, throttle: 0 }, DEFAULT_SETTINGS)!;
  expect(glide.gammaRad).toBeLessThan(0);
  expect(glide.controls.throttle).toBe(0);
  const { d } = derivatives(glide.state, glide.controls, DEFAULT_SETTINGS);
  for (const v of [d.dvx, d.dvz, d.dq]) expect(Math.abs(v)).toBeLessThan(1e-6);
});
test('an impossible steady state returns null', () => {
  expect(trim({ speedFps: ktToFps(100), altitudeFt: 3000, gammaRad: 0.5 }, DEFAULT_SETTINGS)).toBeNull();
  expect(trim({ speedFps: ktToFps(30), altitudeFt: 3000, gammaRad: 0 }, DEFAULT_SETTINGS)).toBeNull();
});
test('trim works with every advanced setting on', () => {
  const all = { altitudeEffects: true, thrustFallsWithSpeed: true, powerPitchCoupling: true };
  const t = trim({ speedFps: ktToFps(100), altitudeFt: 3000, gammaRad: 0 }, all)!;
  const { d } = derivatives(t.state, t.controls, all);
  for (const v of [d.dvx, d.dvz, d.dq]) expect(Math.abs(v)).toBeLessThan(1e-6);
});
