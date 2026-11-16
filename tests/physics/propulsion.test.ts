import { expect, test } from 'vitest';
import { MAX_THRUST_LBF } from '../../src/physics/aircraft';
import { RHO0, density } from '../../src/physics/atmosphere';
import { thrust } from '../../src/physics/propulsion';

const R = RHO0;
test('constant-thrust mode: thrust is throttle times maximum, at any speed', () => {
  expect(thrust(0.5, 100, R, false).thrustLbf).toBeCloseTo(0.5 * MAX_THRUST_LBF);
  expect(thrust(0.5, 250, R, false).thrustLbf).toBeCloseTo(0.5 * MAX_THRUST_LBF);
  expect(thrust(0.5, 100, R, false).rpm).toBeNull();
});
test('constant-thrust mode: thinner air reduces thrust', () => {
  expect(thrust(1, 100, density(8000, true), false).thrustLbf).toBeLessThan(MAX_THRUST_LBF);
});
test('throttle is clamped to 0..1', () => {
  expect(thrust(2, 100, R, false).thrustLbf).toBeCloseTo(MAX_THRUST_LBF);
  expect(thrust(-1, 100, R, false).thrustLbf).toBe(0);
});
test('propeller mode: static full-throttle rpm and thrust are plausible for a fixed-pitch 160 hp', () => {
  const s = thrust(1, 0, R, true);
  expect(s.rpm!).toBeGreaterThan(2000);
  expect(s.rpm!).toBeLessThan(2400);
  expect(s.thrustLbf).toBeGreaterThan(300);
  expect(s.thrustLbf).toBeLessThan(400);
  expect(s.inducedVelocityFps).toBeGreaterThan(0);
});
test('propeller mode: thrust falls with airspeed and rpm never exceeds the limit', () => {
  expect(thrust(1, 300, R, true).thrustLbf).toBeLessThan(thrust(1, 150, R, true).thrustLbf);
  expect(thrust(1, 300, R, true).rpm!).toBeLessThanOrEqual(2700);
});
test('propeller mode: an idling propeller does not push, and induces no slipstream', () => {
  const idle = thrust(0, 170, R, true);
  expect(idle.thrustLbf).toBeLessThanOrEqual(0);
  expect(idle.inducedVelocityFps).toBe(0);
});
