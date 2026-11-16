import { expect, test } from 'vitest';
import { fpsToFpm, fpsToKt, ktToFps } from '../src/units';

test('knots and feet per second convert both ways', () => {
  expect(fpsToKt(ktToFps(100))).toBeCloseTo(100, 9);
  expect(ktToFps(100)).toBeCloseTo(168.781, 2);
});
test('feet per second to feet per minute', () => {
  expect(fpsToFpm(10)).toBe(600);
});
