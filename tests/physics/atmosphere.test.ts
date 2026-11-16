import { expect, test } from 'vitest';
import { RHO0, density, powerFactor } from '../../src/physics/atmosphere';

test('density is sea-level standard at any altitude when altitude effects are off', () => {
  expect(density(3000, false)).toBe(RHO0);
});
test('density follows the standard atmosphere when altitude effects are on', () => {
  expect(density(0, true)).toBeCloseTo(RHO0, 9);
  expect(density(3000, true) / RHO0).toBeCloseTo(0.9151, 3);
});
test('engine power factor is 1 at sea level and never negative', () => {
  expect(powerFactor(RHO0)).toBeCloseTo(1);
  expect(powerFactor(0)).toBe(0);
});
