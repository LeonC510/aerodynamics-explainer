import { expect, test } from 'vitest';
import { CALIBRATION, HANDBOOK, PROP_CORRECTION_MIN_KT } from '../../src/physics/aircraft';
import { RHO0, density } from '../../src/physics/atmosphere';
import { propellerCorrection, thrust } from '../../src/physics/propulsion';
import { ktToFps } from '../../src/units';

const R = RHO0;
test('constant-thrust mode: thrust is throttle times maximum, at any speed', () => {
  expect(thrust(0.5, 100, R, false).thrustLbf).toBeCloseTo(0.5 * CALIBRATION.maxThrustLbf);
  expect(thrust(0.5, 250, R, false).thrustLbf).toBeCloseTo(0.5 * CALIBRATION.maxThrustLbf);
  expect(thrust(0.5, 100, R, false).rpm).toBeNull();
});
test('constant-thrust mode: thinner air reduces thrust', () => {
  expect(thrust(1, 100, density(8000, true), false).thrustLbf).toBeLessThan(CALIBRATION.maxThrustLbf);
});
test('throttle is clamped to 0..1', () => {
  expect(thrust(2, 100, R, false).thrustLbf).toBeCloseTo(CALIBRATION.maxThrustLbf);
  expect(thrust(-1, 100, R, false).thrustLbf).toBe(0);
});
test('propeller mode: static full-throttle rpm and thrust are plausible for a fixed-pitch 160 hp', () => {
  const s = thrust(1, 0, R, true);
  expect(s.rpm!).toBeGreaterThan(2000);
  expect(s.rpm!).toBeLessThan(2400);
  expect(s.thrustLbf).toBeGreaterThan(300);
  expect(s.thrustLbf).toBeLessThan(480);
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

test('the handbook propeller correction is 1 at the handbook top speed and constant outside its range', () => {
  expect(propellerCorrection(ktToFps(HANDBOOK.maxLevelKt))).toBeCloseTo(1, 9);
  expect(propellerCorrection(ktToFps(HANDBOOK.bestClimbKias))).toBeCloseTo(CALIBRATION.propThrustAtVy, 9);
  expect(propellerCorrection(ktToFps(160))).toBeCloseTo(1, 9);
  expect(propellerCorrection(0)).toBeCloseTo(propellerCorrection(ktToFps(PROP_CORRECTION_MIN_KT)), 9);
  // Thrust falls faster with speed than the source table alone: the correction decreases.
  expect(propellerCorrection(ktToFps(90))).toBeLessThan(propellerCorrection(ktToFps(70)));
});
