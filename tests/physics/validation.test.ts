/**
 * Flight validation: physics properties (tight) and 172P handbook figures (calibrated).
 * See docs/validation.md for the numbers these tests produce.
 */
import { expect, test } from 'vitest';
import { bestClimb, bestGlide, maxLevelSpeedKt, stallSpeedKt } from '../../scripts/performance';
import { HANDBOOK, MASS } from '../../src/physics/aircraft';
import {
  DEFAULT_SETTINGS, derivatives, rk4Step, type Controls, type Settings, type State,
} from '../../src/physics/dynamics';
import { trim } from '../../src/physics/trim';
import { degToRad, fpsToFpm, fpsToKt, ktToFps } from '../../src/units';

const PROP: Settings = { ...DEFAULT_SETTINGS, thrustFallsWithSpeed: true };
const DT = 1 / 120;

interface Point { t: number; h: number; iasKt: number; climbFpm: number }

/** Flies for `seconds` with fixed controls, sampling once a second. */
function fly(start: State, controls: Controls, seconds: number, set = DEFAULT_SETTINGS): Point[] {
  const out: Point[] = [];
  let s = start;
  for (let i = 0; i <= seconds * 120; i++) {
    if (i % 120 === 0) {
      const f = derivatives(s, controls, set).f;
      out.push({ t: i / 120, h: s.h, iasKt: fpsToKt(f.iasFps), climbFpm: fpsToFpm(s.vz) });
    }
    s = rk4Step(s, controls, set, DT);
  }
  return out;
}
const range = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
const level100 = () => trim({ speedFps: ktToFps(100), altitudeFt: 3000, gammaRad: 0 }, DEFAULT_SETTINGS)!;

// ---------- Physics properties ----------

test('in a steady climb, lift is below weight: it balances only weight·cos(climb angle)', () => {
  const cl = trim({ speedFps: ktToFps(76), altitudeFt: 0, throttle: 1 }, DEFAULT_SETTINGS)!;
  const f = derivatives(cl.state, cl.controls, DEFAULT_SETTINGS).f;
  expect(cl.gammaRad).toBeGreaterThan(0.03);
  expect(f.lift).toBeLessThan(MASS.weightLbf);
  expect(f.lift + f.thrust * Math.sin(f.alpha)).toBeCloseTo(MASS.weightLbf * Math.cos(cl.gammaRad), 3);
});

test('a yoke step produces a damped phugoid that settles to a steady state', () => {
  const t = level100();
  const pts = fly(t.state, { ...t.controls, elevatorRad: t.controls.elevatorRad - degToRad(1) }, 600);
  const settled = pts.at(-1)!.climbFpm;
  // Times at which the climb rate crosses its settled value going upward: one per cycle.
  const crossings: number[] = [];
  for (let i = 1; i < 200; i++)
    if (pts[i - 1].climbFpm < settled && pts[i].climbFpm >= settled) crossings.push(pts[i].t);
  expect(crossings.length).toBeGreaterThanOrEqual(3);
  const period = (crossings[2] - crossings[0]) / 2;
  expect(period).toBeGreaterThan(18);
  expect(period).toBeLessThan(32);
  // Amplitude shrinks: climb-rate swing in successive 60 s windows.
  const swing = (a: number, b: number) => range(pts.slice(a, b).map((p) => p.climbFpm));
  expect(swing(60, 120)).toBeLessThan(swing(0, 60));
  expect(swing(120, 180)).toBeLessThan(swing(60, 120));
  // Steady at the end.
  expect(range(pts.slice(-30).map((p) => p.iasKt))).toBeLessThan(0.5);
  expect(range(pts.slice(-30).map((p) => p.climbFpm))).toBeLessThan(20);
});

test('the mantra: pitch sets the settled airspeed', () => {
  const t = level100();
  const end = fly(t.state, { ...t.controls, elevatorRad: t.controls.elevatorRad - degToRad(1) }, 600).at(-1)!;
  expect(end.iasKt).toBeLessThan(97);
});

test('the mantra: power sets climb or descent and leaves the settled airspeed alone', () => {
  const t = level100();
  const more = fly(t.state, { ...t.controls, throttle: t.controls.throttle + 0.2 }, 600).at(-1)!;
  expect(Math.abs(more.iasKt - 100)).toBeLessThan(1.5);
  expect(more.climbFpm).toBeGreaterThan(150);
  const less = fly(t.state, { ...t.controls, throttle: t.controls.throttle - 0.2 }, 600).at(-1)!;
  expect(Math.abs(less.iasKt - 100)).toBeLessThan(1.5);
  expect(less.climbFpm).toBeLessThan(-150);
});

// ---------- Handbook figures (calibrated; see docs/validation.md) ----------

const within = (value: number, target: number, fraction: number) =>
  expect(Math.abs(value - target) / target).toBeLessThan(fraction);

test('stall speed is within 5% of the handbook', () => {
  within(stallSpeedKt(DEFAULT_SETTINGS), HANDBOOK.stallKcas, 0.05);
});
test('fixed-pitch mode: best climb rate, its speed, and maximum level speed match the handbook', () => {
  const c = bestClimb(PROP);
  within(c.fpm, HANDBOOK.bestClimbFpm, 0.03);
  expect(Math.abs(c.kt - HANDBOOK.bestClimbKias)).toBeLessThan(3);
  within(maxLevelSpeedKt(PROP), HANDBOOK.maxLevelKt, 0.02);
});
test('constant-thrust mode: best climb rate is within 5% of the handbook', () => {
  within(bestClimb(DEFAULT_SETTINGS).fpm, HANDBOOK.bestClimbFpm, 0.05);
});
test('power-off glide ratio is within 10% of the handbook in both thrust modes', () => {
  for (const set of [DEFAULT_SETTINGS, PROP]) {
    const g = bestGlide(set);
    within(g.ratio, HANDBOOK.glideRatio, 0.1);
    // Known residual: best-glide speed sits about 5 kt above the handbook's 65 kt (see docs/validation.md).
    expect(Math.abs(g.kt - HANDBOOK.bestGlideKias)).toBeLessThan(7);
  }
});
