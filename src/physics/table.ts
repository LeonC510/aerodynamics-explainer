/** Rows of [x, y], sorted by ascending x. */
export type Table1D = readonly (readonly [number, number])[];

/** Linear interpolation; clamps to the end values outside the table's range. */
export function interp1(table: Table1D, x: number): number {
  const n = table.length;
  if (x <= table[0][0]) return table[0][1];
  if (x >= table[n - 1][0]) return table[n - 1][1];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (table[mid][0] <= x) lo = mid;
    else hi = mid;
  }
  const [x0, y0] = table[lo];
  const [x1, y1] = table[hi];
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}
