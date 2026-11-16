import { expect, test } from 'vitest';
import { TRAJ_MIN_PX_PER_FT, TRAJ_MIN_SPAN_FT } from '../../src/config/view';
import { fitThenScroll, niceTicks, strideFor, verticalRange, visibleSlice } from '../../src/ui/scales';

test('a nearly flat flight is not magnified: 4 ft of wobble still shows a 200 ft span plus margins', () => {
  const v = verticalRange(2998, 3002);
  expect(v.hi - v.lo).toBeCloseTo(260);
  expect((v.hi + v.lo) / 2).toBeCloseTo(3000);
  expect(v.brokenAxis).toBe(true);
});
test('a real oscillation fills the view with a margin', () => {
  const v = verticalRange(2700, 3300);
  expect(v.lo).toBeCloseTo(2610);
  expect(v.hi).toBeCloseTo(3390);
  expect(v.brokenAxis).toBe(true);
});
test('near the ground the axis shows the ground instead of a break', () => {
  let v = verticalRange(150, 3000);
  expect(v.lo).toBe(0);
  expect(v.brokenAxis).toBe(false);
  v = verticalRange(0, 40);
  expect(v.lo).toBe(0);
  expect(v.hi).toBeGreaterThanOrEqual(200);
  expect(v.brokenAxis).toBe(false);
});
test('horizontal scale: minimum span, then fit everything, then stop compressing and scroll', () => {
  let f = fitThenScroll(100, 1000, TRAJ_MIN_SPAN_FT, TRAJ_MIN_PX_PER_FT);
  expect(f.pxPerUnit).toBeCloseTo(1000 / 6076);
  expect(f.scrollable).toBe(false);
  f = fitThenScroll(50_000, 1000, TRAJ_MIN_SPAN_FT, TRAJ_MIN_PX_PER_FT);
  expect(f.pxPerUnit).toBeCloseTo(0.02);
  expect(f.contentPx).toBeCloseTo(1000);
  expect(f.scrollable).toBe(false);
  f = fitThenScroll(500_000, 1000, TRAJ_MIN_SPAN_FT, TRAJ_MIN_PX_PER_FT);
  expect(f.pxPerUnit).toBeCloseTo(TRAJ_MIN_PX_PER_FT);
  expect(f.contentPx).toBeCloseTo(500_000 * TRAJ_MIN_PX_PER_FT);
  expect(f.scrollable).toBe(true);
});
test('only the visible part of a long history is selected, with one point of padding each side', () => {
  const xs = Array.from({ length: 200_000 }, (_, i) => i);
  expect(visibleSlice(xs, (x) => x, 1000, 2000)).toEqual([999, 2002]);
  expect(visibleSlice(xs, (x) => x, -50, 3)).toEqual([0, 5]);
  expect(visibleSlice(xs, (x) => x, 199_990, 999_999)).toEqual([199_989, 200_000]);
  expect(visibleSlice([], (x: number) => x, 0, 1)).toEqual([0, 0]);
});
test('drawing stride keeps the number of drawn points proportional to the width', () => {
  expect(strideFor(200_000, 1000)).toBe(100);
  expect(strideFor(500, 1000)).toBe(1);
});
test('ticks fall on round numbers', () => {
  expect(niceTicks(0, 100, 5)).toEqual([0, 20, 40, 60, 80, 100]);
  expect(niceTicks(2610, 3390, 4)).toEqual([2800, 3000, 3200]);
  expect(niceTicks(5, 5, 4)).toEqual([5]);
});
