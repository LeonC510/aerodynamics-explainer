/** Pure view maths: axis ranges, fit-then-scroll scaling, and helpers for drawing long histories. */
import { GROUND_SNAP, MAX_POINTS_PER_PX, MIN_VERTICAL_SPAN_FT, VERTICAL_MARGIN } from '../config/view';

export interface VerticalRange {
  lo: number;
  hi: number;
  /** True when the range does not reach the ground, so the axis should show a break mark. */
  brokenAxis: boolean;
}

/** Altitude range to display for a path spanning minH..maxH (ft). */
export function verticalRange(minH: number, maxH: number): VerticalRange {
  const span = Math.max(maxH - minH, MIN_VERTICAL_SPAN_FT);
  const mid = (minH + maxH) / 2;
  let lo = mid - span / 2 - VERTICAL_MARGIN * span;
  let hi = mid + span / 2 + VERTICAL_MARGIN * span;
  if (lo <= GROUND_SNAP * (hi - lo)) {
    // Close to the ground: show the ground itself.
    hi = Math.max(hi, MIN_VERTICAL_SPAN_FT * (1 + VERTICAL_MARGIN));
    lo = 0;
    return { lo, hi, brokenAxis: false };
  }
  return { lo, hi, brokenAxis: true };
}

export interface FitScroll {
  pxPerUnit: number;
  /** Width of the whole content at this scale, px (at least the view width). */
  contentPx: number;
  scrollable: boolean;
}

/**
 * Scale for an axis that shows everything for as long as it can: it compresses as the
 * extent grows, down to minPxPerUnit, and beyond that the content outgrows the view and scrolls.
 */
export function fitThenScroll(extent: number, viewPx: number, minSpan: number, minPxPerUnit: number): FitScroll {
  const pxPerUnit = Math.max(viewPx / Math.max(extent, minSpan), minPxPerUnit);
  const contentPx = Math.max(viewPx, extent * pxPerUnit);
  return { pxPerUnit, contentPx, scrollable: contentPx > viewPx + 0.5 };
}

/**
 * Index range [start, end) of the items whose key lies in lo..hi, plus one item of
 * padding on each side so lines reach the edges. Items must be sorted by key.
 */
export function visibleSlice<T>(items: readonly T[], key: (t: T) => number, lo: number, hi: number): [number, number] {
  const firstAtLeast = (v: number, strict: boolean): number => {
    let a = 0;
    let b = items.length;
    while (a < b) {
      const mid = (a + b) >> 1;
      const k = key(items[mid]);
      if (strict ? k <= v : k < v) a = mid + 1;
      else b = mid;
    }
    return a;
  };
  const start = Math.max(firstAtLeast(lo, false) - 1, 0);
  const end = Math.min(firstAtLeast(hi, true) + 1, items.length);
  return [start, Math.max(end, start)];
}

/** Step between drawn points so that at most MAX_POINTS_PER_PX points land on each pixel. */
export function strideFor(count: number, widthPx: number): number {
  return Math.max(1, Math.floor(count / (MAX_POINTS_PER_PX * Math.max(widthPx, 1))));
}

/** Round-numbered tick values (steps of 1, 2 or 5 × a power of ten) within lo..hi. */
export function niceTicks(lo: number, hi: number, target: number): number[] {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / Math.max(target, 1);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const frac = raw / pow;
  const step = (frac < 1.5 ? 1 : frac < 3.5 ? 2 : frac < 7.5 ? 5 : 10) * pow;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step)
    ticks.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
  return ticks;
}
