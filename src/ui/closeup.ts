/** Side view of the aircraft, and the true-angle close-up showing angle of attack. */
import { STALL_ALPHA_RAD } from '../physics/aircraft';
import type { Sample } from '../sim/simulation';
import { degToRad } from '../units';
import { FONT_BOLD_SMALL, FONT_SMALL, theme } from './theme';

/**
 * Draws a high-wing aircraft seen from its left side, centred on (cx, cy), `length` px
 * long, with its nose `pitchRad` above the horizon (nose points right).
 */
export function drawAircraft(ctx: CanvasRenderingContext2D, cx: number, cy: number, length: number, pitchRad: number, colour: string): void {
  const u = length / 100; // the shape below is drawn on a 100-unit-long grid
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-pitchRad);
  ctx.scale(u, u);
  ctx.fillStyle = colour;
  ctx.strokeStyle = colour;
  ctx.lineJoin = 'round';
  // Fuselage and tail boom.
  ctx.beginPath();
  ctx.moveTo(46, 2);
  ctx.quadraticCurveTo(50, -3, 44, -8);
  ctx.lineTo(22, -12);
  ctx.quadraticCurveTo(10, -13, 2, -7);
  ctx.lineTo(-44, -3);
  ctx.lineTo(-50, -20); // fin
  ctx.lineTo(-40, -20);
  ctx.lineTo(-30, -4);
  ctx.lineTo(-48, 1);
  ctx.lineTo(-6, 9);
  ctx.quadraticCurveTo(20, 12, 40, 8);
  ctx.closePath();
  ctx.fill();
  // High wing (seen edge-on) and its strut.
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-4, -15);
  ctx.lineTo(28, -15);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(14, -14);
  ctx.lineTo(6, 6);
  ctx.stroke();
  // Main wheel and propeller disc.
  ctx.beginPath();
  ctx.arc(8, 15, 4, 0, 2 * Math.PI);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(8, 8);
  ctx.lineTo(8, 14);
  ctx.moveTo(49, -18);
  ctx.lineTo(49, 14);
  ctx.stroke();
  ctx.restore();
}

/** The close-up panel: aircraft, horizon, direction of travel, and angle of attack, at true angles. */
export function drawCloseup(ctx: CanvasRenderingContext2D, rect: { x: number; y: number; w: number; h: number }, s: Sample): void {
  const th = theme();
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = th.surface;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = th.line;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.clip();

  const cx = x + w * 0.38;
  const cy = y + h * 0.52;
  const pitch = degToRad(s.thetaDeg);
  const path = degToRad(s.gammaDeg);
  const stalled = degToRad(s.alphaDeg) > STALL_ALPHA_RAD;
  const reach = w * 0.54;

  // Horizon.
  ctx.strokeStyle = th.muted;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(x + 8, cy);
  ctx.lineTo(x + w - 8, cy);
  ctx.stroke();
  ctx.setLineDash([]);

  drawAircraft(ctx, cx, cy, w * 0.42, pitch, th.ink);

  // Nose line (where the aircraft points).
  ctx.strokeStyle = th.ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + reach * Math.cos(pitch), cy - reach * Math.sin(pitch));
  ctx.stroke();

  // Direction of travel.
  const ex = cx + reach * Math.cos(path);
  const ey = cy - reach * Math.sin(path);
  ctx.strokeStyle = th.accent;
  ctx.fillStyle = th.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - 8 * Math.cos(path - 0.4), ey + 8 * Math.sin(path - 0.4));
  ctx.lineTo(ex - 8 * Math.cos(path + 0.4), ey + 8 * Math.sin(path + 0.4));
  ctx.closePath();
  ctx.fill();

  // Angle of attack: the arc between direction of travel and nose line.
  ctx.strokeStyle = stalled ? th.warn : th.accent;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  // Swept from the direction of travel through the angle of attack itself, so it is always the
  // short way round even when the two directions straddle ±180° (inverted flight, loops).
  const alpha = degToRad(s.alphaDeg);
  ctx.arc(cx, cy, reach * 0.8, -path, -(path + alpha), alpha > 0);
  ctx.stroke();

  // Labels.
  ctx.font = FONT_BOLD_SMALL;
  ctx.fillStyle = stalled ? th.warn : th.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`Angle of attack ${s.alphaDeg.toFixed(1)}°`, x + 8, y + 7);
  if (stalled) {
    ctx.font = FONT_SMALL;
    ctx.fillText('stalled', x + 8, y + 21);
  }
  ctx.font = FONT_SMALL;
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = th.ink;
  ctx.fillText(`Nose ${signed(s.thetaDeg)}°`, x + 8, y + h - 6);
  ctx.fillStyle = th.accent;
  ctx.textAlign = 'right';
  ctx.fillText(`Travel ${signed(s.gammaDeg)}°`, x + w - 8, y + h - 6);
  ctx.restore();
}

const signed = (deg: number): string => `${deg >= 0 ? '+' : '−'}${Math.abs(deg).toFixed(1)}`;
