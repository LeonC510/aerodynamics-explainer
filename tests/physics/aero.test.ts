import { expect, test } from 'vitest';
import { coefficients, dragCoefficientStatic, liftCoefficientStatic } from '../../src/physics/aero';

test('static lift follows the source table inside its range', () => {
  expect(liftCoefficientStatic(0)).toBeCloseTo(0.25);
  expect(liftCoefficientStatic(0.09)).toBeCloseTo(0.73);
});
test('lift and drag are continuous across the table ends and the post-stall blend', () => {
  for (const a of [-0.09, -0.0873, 0.3491, 0.36, 0.51, -0.24, Math.PI, -Math.PI + 0.001])
    for (const f of [liftCoefficientStatic, dragCoefficientStatic])
      expect(Math.abs(f(a + 1e-4) - f(a - 1e-4))).toBeLessThan(0.01);
});
test('far beyond the stall the wing behaves like a flat plate', () => {
  expect(liftCoefficientStatic(Math.PI / 2)).toBeCloseTo(0, 5);
  expect(dragCoefficientStatic(Math.PI / 2)).toBeCloseTo(2.027, 3);
});
test('coefficients stay finite at zero airspeed and extreme angle', () => {
  const c = coefficients({ alpha: 3, alphaDot: 0, q: 0, de: 0, speed: 0, tailQRatio: 1 });
  expect(Number.isFinite(c.cl) && Number.isFinite(c.cd) && Number.isFinite(c.cm)).toBe(true);
});
const base = { alpha: 0.05, alphaDot: 0, q: 0, de: 0, speed: 170, tailQRatio: 1 };
test('elevator moment scales with tail dynamic-pressure ratio', () => {
  expect(coefficients({ ...base, de: 0.1 }).cm - coefficients(base).cm).toBeCloseTo(-0.1122);
  expect(coefficients({ ...base, de: 0.1, tailQRatio: 1.5 }).cm - coefficients(base).cm).toBeCloseTo(-0.1683);
});
test('pitch rate is damped', () => {
  expect(coefficients({ ...base, q: 0.1 }).cm).toBeLessThan(coefficients(base).cm);
});
test('elevator deflection in either direction adds drag', () => {
  expect(coefficients({ ...base, de: -0.1 }).cd - coefficients(base).cd).toBeCloseTo(0.006);
});
test('pitching moment is continuous when the aircraft tumbles through 180° angle of attack', () => {
  const cm = (alpha: number) => coefficients({ ...base, alpha }).cm;
  expect(Math.abs(cm(Math.PI - 1e-4) - cm(-Math.PI + 1e-4))).toBeLessThan(0.01);
  expect(Math.abs(cm(0.5 + 1e-4) - cm(0.5 - 1e-4))).toBeLessThan(0.01);
  expect(cm(0.2) - cm(0.1)).toBeCloseTo(-0.18); // unchanged inside the normal range
});

import { CALIBRATION, STALL_ALPHA_RAD } from '../../src/physics/aircraft';
import { idlePropellerDragCoefficient } from '../../src/physics/aero';

test('below the stall, drag is the calibrated polar CD0 + K·CL²', () => {
  for (const a of [-0.05, 0, 0.05, 0.1, 0.2]) {
    const cl = liftCoefficientStatic(a);
    expect(dragCoefficientStatic(a)).toBeCloseTo(CALIBRATION.cd0 + CALIBRATION.kInduced * cl * cl, 9);
  }
});
test('lift is the source table in cruise and scaled up only toward the stall', () => {
  expect(liftCoefficientStatic(0.05)).toBeCloseTo(0.25 + (0.48 * 0.05) / 0.09, 9);
  expect(liftCoefficientStatic(STALL_ALPHA_RAD)).toBeCloseTo(1.47 * CALIBRATION.clMaxScale, 9);
});
test('windmilling-propeller drag applies at idle and is gone by 10% throttle', () => {
  expect(idlePropellerDragCoefficient(0)).toBeCloseTo(CALIBRATION.idlePropDragCd);
  expect(idlePropellerDragCoefficient(0.05)).toBeCloseTo(CALIBRATION.idlePropDragCd / 2);
  expect(idlePropellerDragCoefficient(0.1)).toBe(0);
  expect(idlePropellerDragCoefficient(1)).toBe(0);
});
