/** The trajectory view: altitude against distance, with the forecast and the aircraft. */
import { STABLE_WINDOW_S } from '../config/simulation';
import {
  AIRCRAFT_ICON_PX, CLOSEUP_SIZE_PX, RANGE_EASING, TRAJ_MIN_PX_PER_FT, TRAJ_MIN_SPAN_FT,
} from '../config/view';
import { forecast, type Forecast } from '../sim/forecast';
import type { Sample, Simulation } from '../sim/simulation';
import { FT_PER_NM, degToRad } from '../units';
import { drawAircraft, drawCloseup } from './closeup';
import type { UiState } from './controls';
import { fitThenScroll, niceTicks, strideFor, verticalRange, visibleSlice } from './scales';
import { Scroller } from './scroller';
import { FONT, FONT_BOLD, theme } from './theme';

/** Space around the plot, px. The right side holds the close-up panel and readouts. */
const PAD = { left: 58, right: CLOSEUP_SIZE_PX.w + 24 + AIRCRAFT_ICON_PX / 2 + 10, top: 16, bottom: 30 };
/** Gap between the altitude axis and the start of the flight, so the aircraft icon clears the labels, px. */
const LEAD_IN = 30;
/** Height reserved under a broken axis for the ground line, px. */
const BREAK_PX = 24;

export function mountTrajectory(host: HTMLElement, sim: Simulation, ui: UiState): { draw(): void } {
  const scroller = new Scroller(host);
  const getX = (s: Sample): number => s.x;

  let cached: { revision: number; result: Forecast } | null = null;
  let range: { lo: number; hi: number } | null = null;

  /** The part of the forecast still ahead of the aircraft; empty when flight is already steady. */
  function forecastAhead(): { samples: Sample[]; end: Forecast['end'] } | null {
    if (!ui.forecastOn || sim.status === 'ground') return null;
    const exhausted = cached !== null && cached.result.samples[cached.result.samples.length - 1].t <= sim.time;
    if (!cached || cached.revision !== sim.revision || (exhausted && cached.result.end === 'timeout')) {
      cached = { revision: sim.revision, result: forecast(sim.state, sim.controls, sim.settings, sim.time) };
    }
    const { samples, end } = cached.result;
    const duration = samples[samples.length - 1].t - samples[0].t;
    if (end === 'stabilised' && duration <= STABLE_WINDOW_S + 1) return null; // already steady
    const ahead = samples.filter((s) => s.t > sim.time);
    return ahead.length ? { samples: ahead, end } : null;
  }

  function draw(): void {
    const th = theme();
    const now = sim.latest;
    const history = sim.history;
    const ahead = forecastAhead();

    // --- Horizontal scale: fit the whole flight, then stop compressing and scroll. ---
    const plotW = Math.max(scroller.widthPx - PAD.left - PAD.right, 50);
    const fitW = plotW - LEAD_IN; // width available to the flight itself
    const extent = ahead ? ahead.samples[ahead.samples.length - 1].x : now.x;
    const fit = fitThenScroll(extent, fitW, TRAJ_MIN_SPAN_FT, TRAJ_MIN_PX_PER_FT);
    scroller.setContentSize(fit.contentPx + LEAD_IN + PAD.left + PAD.right);
    const ctx = scroller.begin();
    const W = scroller.widthPx;
    const H = scroller.heightPx;
    const scroll = scroller.scrollLeft;
    const xPx = (x: number): number => PAD.left + LEAD_IN + x * fit.pxPerUnit - scroll;
    const xLo = (scroll - LEAD_IN) / fit.pxPerUnit;
    const xHi = (scroll - LEAD_IN + plotW) / fit.pxPerUnit;

    // --- Vertical scale: only the altitudes the visible path covers. ---
    const [h0, h1] = visibleSlice(history, getX, xLo, xHi);
    let minH = Infinity;
    let maxH = -Infinity;
    for (let i = h0; i < h1; i++) {
      if (history[i].h < minH) minH = history[i].h;
      if (history[i].h > maxH) maxH = history[i].h;
    }
    let f0 = 0;
    let f1 = 0;
    if (ahead) {
      [f0, f1] = visibleSlice(ahead.samples, getX, xLo, xHi);
      for (let i = f0; i < f1; i++) {
        if (ahead.samples[i].h < minH) minH = ahead.samples[i].h;
        if (ahead.samples[i].h > maxH) maxH = ahead.samples[i].h;
      }
    }
    if (!Number.isFinite(minH)) minH = maxH = now.h;
    const target = verticalRange(minH, maxH);
    if (!range) range = { lo: target.lo, hi: target.hi };
    range.lo += (target.lo - range.lo) * RANGE_EASING;
    range.hi += (target.hi - range.hi) * RANGE_EASING;
    if (target.lo === 0 && range.lo < 1) range.lo = 0;
    const broken = range.lo > 0;
    const plotTop = PAD.top;
    const plotBottom = H - PAD.bottom - (broken ? BREAK_PX : 0);
    const yPx = (h: number): number => plotBottom - ((h - range!.lo) / (range!.hi - range!.lo)) * (plotBottom - plotTop);

    const plotRight = PAD.left + plotW;
    ctx.font = FONT;
    ctx.lineJoin = 'round';

    // --- Grid and altitude labels. ---
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const tick of niceTicks(range.lo, range.hi, 5)) {
      const y = yPx(tick);
      if (y < plotTop - 1 || y > plotBottom + 1) continue;
      ctx.strokeStyle = th.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(plotRight, y);
      ctx.stroke();
      ctx.fillStyle = th.muted;
      ctx.fillText(`${tick.toLocaleString('en-US')} ft`, PAD.left - 8, y);
    }

    // --- Ground: a filled band when in range, otherwise a line below a broken axis. ---
    const groundY = broken ? H - PAD.bottom : yPx(0);
    ctx.fillStyle = th.ground;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(PAD.left, groundY, plotW, H - groundY);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = th.ground;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD.left, groundY);
    ctx.lineTo(plotRight, groundY);
    ctx.stroke();
    if (broken) {
      ctx.fillStyle = th.muted;
      ctx.textAlign = 'right';
      ctx.fillText('0 ft', PAD.left - 8, groundY);
    }

    // --- Altitude axis. When it does not reach the ground it continues down to the ground
    //     line through an axis break: a gap in the axis between two parallel slashes. ---
    ctx.strokeStyle = th.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD.left, plotTop);
    if (broken) {
      const mid = plotBottom + BREAK_PX / 2;
      const gap = 4; // half the height of the gap in the axis
      ctx.lineTo(PAD.left, mid - gap);
      ctx.moveTo(PAD.left, mid + gap);
      ctx.lineTo(PAD.left, groundY);
      for (const y of [mid - gap, mid + gap]) {
        ctx.moveTo(PAD.left - 6, y + 2.5);
        ctx.lineTo(PAD.left + 6, y - 2.5);
      }
    } else {
      ctx.lineTo(PAD.left, groundY);
    }
    ctx.stroke();

    // --- Distance axis. ---
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = th.muted;
    for (const nm of niceTicks(Math.max(xLo, 0) / FT_PER_NM, xHi / FT_PER_NM, 8)) {
      const x = xPx(nm * FT_PER_NM);
      if (x < PAD.left + 4 || x > plotRight - 4) continue;
      ctx.fillRect(x, H - PAD.bottom, 1, 4);
      ctx.fillText(`${Number(nm.toFixed(2))} nm`, x, H - PAD.bottom + 7);
    }

    // --- Paths, clipped to the plot. ---
    ctx.save();
    ctx.beginPath();
    ctx.rect(PAD.left, 0, plotW + AIRCRAFT_ICON_PX / 2, groundY);
    ctx.clip();

    // Flown path.
    ctx.strokeStyle = th.path;
    ctx.lineWidth = 2.25;
    ctx.beginPath();
    const stride = strideFor(h1 - h0, plotW);
    for (let i = h0; i < h1; i += stride) {
      const p = history[i];
      if (i === h0) ctx.moveTo(xPx(p.x), yPx(p.h));
      else ctx.lineTo(xPx(p.x), yPx(p.h));
    }
    ctx.lineTo(xPx(now.x), yPx(now.h));
    ctx.stroke();

    // Forecast.
    if (ahead) {
      ctx.strokeStyle = th.forecast;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.moveTo(xPx(now.x), yPx(now.h));
      const fStride = strideFor(f1 - f0, plotW);
      for (let i = f0; i < f1; i += fStride) ctx.lineTo(xPx(ahead.samples[i].x), yPx(ahead.samples[i].h));
      const last = ahead.samples[ahead.samples.length - 1];
      ctx.lineTo(xPx(last.x), yPx(last.h));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();

    // Where the forecast ends, and why.
    if (ahead && ahead.end !== 'timeout') {
      const last = ahead.samples[ahead.samples.length - 1];
      const ex = xPx(last.x);
      const ey = yPx(last.h);
      ctx.fillStyle = th.forecast;
      ctx.beginPath();
      ctx.arc(ex, ey, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(ahead.end === 'stabilised' ? 'steady' : 'ground', ex - 7, ey - 5);
    }

    // --- Aircraft: larger than life, rotated by its true pitch angle. ---
    const ax = xPx(now.x);
    if (ax > PAD.left - AIRCRAFT_ICON_PX && ax < plotRight + AIRCRAFT_ICON_PX)
      drawAircraft(ctx, ax, yPx(now.h), AIRCRAFT_ICON_PX, degToRad(now.thetaDeg), th.ink);

    // --- Right column: close-up at true angles, and the current readings. ---
    const cx = W - CLOSEUP_SIZE_PX.w - 12;
    ctx.fillStyle = th.bg;
    ctx.fillRect(cx - 6, 0, W, H);
    drawCloseup(ctx, { x: cx, y: 12, w: CLOSEUP_SIZE_PX.w, h: CLOSEUP_SIZE_PX.h }, now);
    const rows: [string, string][] = [
      ['Airspeed', `${now.iasKt.toFixed(1)} kt`],
      ['Altitude', `${Math.round(now.h).toLocaleString('en-US')} ft`],
      ['Climb rate', `${now.climbFpm >= 0 ? '+' : '−'}${Math.abs(Math.round(now.climbFpm)).toLocaleString('en-US')} ft/min`],
      ['Time', `${now.t.toFixed(0)} s`],
    ];
    ctx.textBaseline = 'top';
    rows.forEach(([label, value], i) => {
      const y = 12 + CLOSEUP_SIZE_PX.h + 12 + i * 19;
      if (y > H - 16) return;
      ctx.font = FONT;
      ctx.fillStyle = th.muted;
      ctx.textAlign = 'left';
      ctx.fillText(label, cx + 2, y);
      ctx.font = FONT_BOLD;
      ctx.fillStyle = th.ink;
      ctx.textAlign = 'right';
      ctx.fillText(value, W - 14, y);
    });
  }

  return { draw };
}
