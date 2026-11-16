import { expect, test } from 'vitest';
import { interp1, type Table1D } from '../../src/physics/table';

const t: Table1D = [[0, 0], [1, 10], [3, 30]];
test('interpolates linearly between rows', () => {
  expect(interp1(t, 0.5)).toBeCloseTo(5);
  expect(interp1(t, 2)).toBeCloseTo(20);
});
test('clamps to end values outside the range', () => {
  expect(interp1(t, -5)).toBe(0);
  expect(interp1(t, 99)).toBe(30);
});
