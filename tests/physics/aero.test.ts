import { expect, test } from 'vitest';
import { coefficients, dragCoefficientStatic, liftCoefficientStatic } from '../../src/physics/aero';

test('static lift and drag follow the source tables inside their range', () => {
  expect(liftCoefficientStatic(0)).toBeCloseTo(0.25);
  expect(liftCoefficientStatic(0.28)).toBeCloseTo(1.47);
  expect(dragCoefficientStatic(0)).toBeCloseTo(0.027 + 0.0052);
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
