/** The diagnostic graphs: one band per enabled quantity, sharing a time axis. */
import { GRAPHS, type GraphDef, type GraphId } from '../config/graphs';
import { GRAPH_BAND_HEIGHT_PX, GRAPH_MIN_PX_PER_S, GRAPH_MIN_SPAN_S, RANGE_EASING } from '../config/view';
import { MASS, STALL_ALPHA_RAD } from '../physics/aircraft';
import type { Sample, Simulation } from '../sim/simulation';
import { radToDeg } from '../units';
import type { UiState } from './controls';
import { fitThenScroll, niceTicks, strideFor, visibleSlice } from './scales';
import { Scroller } from './scroller';
import { FONT, FONT_BOLD, theme } from './theme';

const PAD = { left: 58, right: 14, top: 22, bottom: 8 };
/** Height of the time axis under the last band, px. */
const TIME_AXIS_PX = 24;
const MARKER_LETTER = { pitch: 'P', throttle: 'T', setting: 'S' } as const;

function referenceLine(def: GraphDef): { value: number; label: string } | null {
  switch (def.reference) {
    case 'zero': return { value: 0, label: '' };
    case 'stall': return { value: radToDeg(STALL_ALPHA_RAD), label: 'stall' };
    case 'weight': return { value: MASS.weightLbf, label: 'weight' };
    default: return null;
  }
}

export function mountGraphs(host: HTMLElement, sim: Simulation, ui: UiState): { draw(): void } {
  const scroller = new Scroller(host);
  const getT = (s: Sample): number => s.t;
  const ranges = new Map<GraphId, { lo: number; hi: number }>();

  function draw(): void {
    const th = theme();
    const history = sim.history;
    const shown = GRAPHS.filter((g) => ui.graphs.has(g.id));

    const plotW = Math.max(scroller.widthPx - PAD.left - PAD.right, 50);
    const fit = fitThenScroll(sim.time, plotW, GRAPH_MIN_SPAN_S, GRAPH_MIN_PX_PER_S);
    const contentH = shown.length * GRAPH_BAND_HEIGHT_PX + TIME_AXIS_PX;
    scroller.setContentSize(fit.contentPx + PAD.left + PAD.right, contentH);
    const ctx = scroller.begin();
    const W = scroller.widthPx;
    const scroll = scroller.scrollLeft;
    const tPx = (t: number): number => PAD.left + t * fit.pxPerUnit - scroll;
    const tLo = scroll / fit.pxPerUnit;
    const tHi = (scroll + plotW) / fit.pxPerUnit;
    const [i0, i1] = visibleSlice(history, getT, tLo, tHi);
    const stride = strideFor(i1 - i0, plotW);

    ctx.font = FONT;
    ctx.lineJoin = 'round';

    if (shown.length === 0) {
      ctx.fillStyle = th.muted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Turn on a graph in the panel on the left.', W / 2, 40);
      return;
    }

    shown.forEach((def, band) => {
      const top = band * GRAPH_BAND_HEIGHT_PX;
      const plotTop = top + PAD.top;
      const plotBottom = top + GRAPH_BAND_HEIGHT_PX - PAD.bottom;
      const field = def.field;
      const ref = referenceLine(def);

      // Value range of the visible samples, never narrower than the graph's minimum span.
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = i0; i < i1; i++) {
        const v = history[i][field];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      if (!Number.isFinite(lo)) lo = hi = sim.latest[field];
      const dataSpan = Math.max(hi - lo, def.minSpan);
      if (ref && ref.value > lo - 3 * dataSpan && ref.value < hi + 3 * dataSpan) {
        lo = Math.min(lo, ref.value);
        hi = Math.max(hi, ref.value);
      }
      const span = Math.max(hi - lo, def.minSpan);
      const mid = (lo + hi) / 2;
      const target = { lo: mid - span * 0.58, hi: mid + span * 0.58 };
      let r = ranges.get(def.id);
      if (!r) {
        r = { ...target };
        ranges.set(def.id, r);
      }
      r.lo += (target.lo - r.lo) * RANGE_EASING;
      r.hi += (target.hi - r.hi) * RANGE_EASING;
      const range = r;
      const yPx = (v: number): number => plotBottom - ((v - range.lo) / (range.hi - range.lo)) * (plotBottom - plotTop);

      // Band separator.
      ctx.strokeStyle = th.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, top + GRAPH_BAND_HEIGHT_PX - 0.5);
      ctx.lineTo(W, top + GRAPH_BAND_HEIGHT_PX - 0.5);
      ctx.stroke();

      // Value grid and labels.
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (const tick of niceTicks(range.lo, range.hi, 3)) {
        const y = yPx(tick);
        if (y < plotTop - 2 || y > plotBottom + 2) continue;
        ctx.strokeStyle = th.grid;
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(W - PAD.right, y);
        ctx.stroke();
        ctx.fillStyle = th.muted;
        ctx.fillText(tick.toLocaleString('en-US'), PAD.left - 8, y);
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(PAD.left, top + 1, W - PAD.left - PAD.right, GRAPH_BAND_HEIGHT_PX - 2);
      ctx.clip();

      // Reference line.
      if (ref) {
        const y = yPx(ref.value);
        ctx.strokeStyle = th.reference;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(W - PAD.right, y);
        ctx.stroke();
        ctx.setLineDash([]);
        if (ref.label) {
          ctx.fillStyle = th.reference;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(ref.label, PAD.left + 6, y - 2);
        }
      }

      // Trace.
      ctx.strokeStyle = th.trace;
      ctx.lineWidth = 1.75;
      ctx.beginPath();
      for (let i = i0; i < i1; i += stride) {
        const p = history[i];
        if (i === i0) ctx.moveTo(tPx(p.t), yPx(p[field]));
        else ctx.lineTo(tPx(p.t), yPx(p[field]));
      }
      ctx.lineTo(tPx(sim.latest.t), yPx(sim.latest[field]));
      ctx.stroke();
      ctx.restore();

      // Title and current value.
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.font = FONT_BOLD;
      ctx.fillStyle = th.ink;
      ctx.fillText(def.title, PAD.left + 18, top + 5);
      ctx.textAlign = 'right';
      ctx.fillText(`${sim.latest[field].toFixed(def.decimals)} ${def.unit}`, W - PAD.right - 4, top + 5);
      ctx.font = FONT;
    });

    // Control-change markers through every band.
    const bandsBottom = shown.length * GRAPH_BAND_HEIGHT_PX;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const m of sim.markers) {
      const x = tPx(m.t);
      if (x < PAD.left || x > W - PAD.right) continue;
      ctx.strokeStyle = th.marker;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, bandsBottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = th.marker;
      ctx.textAlign = 'left';
      ctx.fillText(MARKER_LETTER[m.kind], x + 4, 4);
    }

    // Time axis.
    ctx.textAlign = 'center';
    ctx.fillStyle = th.muted;
    for (const t of niceTicks(tLo, tHi, 10)) {
      const x = tPx(t);
      if (x < PAD.left - 1 || x > W - PAD.right + 1) continue;
      ctx.fillRect(x, bandsBottom, 1, 4);
      ctx.fillText(`${t} s`, x, bandsBottom + 7);
    }
  }

  return { draw };
}
