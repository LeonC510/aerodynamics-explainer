import { expect, test } from 'vitest';
import { ELEVATOR_MAX_RAD, ELEVATOR_MIN_RAD, G, MASS } from '../../src/physics/aircraft';
import {
  DEFAULT_SETTINGS, derivatives, elevatorToYoke, rk4Step, yokeToElevator,
  type Controls, type Settings, type State,
} from '../../src/physics/dynamics';
import { ktToFps } from '../../src/units';

const level = (kt: number): State => ({ x: 0, h: 3000, vx: ktToFps(kt), vz: 0, theta: 0.04, q: 0 });
const c: Controls = { elevatorRad: 0, throttle: 0.5 };
const ALL_ON: Settings = { altitudeEffects: true, thrustFallsWithSpeed: true, powerPitchCoupling: true };

test('angle of attack is pitch minus flight-path angle', () => {
  const { f } = derivatives(level(100), c, DEFAULT_SETTINGS);
  expect(f.alpha).toBeCloseTo(0.04);
  expect(f.gamma).toBe(0);
  const climb: State = { ...level(80), vz: 10, theta: 0.2 };
  expect(derivatives(climb, c, DEFAULT_SETTINGS).f.alpha).toBeCloseTo(0.2 - Math.atan2(10, ktToFps(80)));
});
test('acceleration is exactly the reported forces divided by mass', () => {
  const { d, f } = derivatives(level(100), c, DEFAULT_SETTINGS);
  expect(d.dvz).toBeCloseTo((f.thrust * Math.sin(0.04) + f.lift) / MASS.massSlug - G, 9);
  expect(d.dvx).toBeCloseTo((f.thrust * Math.cos(0.04) - f.drag) / MASS.massSlug, 9);
  expect(d.dx).toBeCloseTo(ktToFps(100));
  expect(d.dh).toBe(0);
  expect(d.dtheta).toBe(0);
});
test('indicated airspeed equals true airspeed when altitude effects are off', () => {
  const { f } = derivatives(level(100), c, DEFAULT_SETTINGS);
  expect(f.iasFps).toBeCloseTo(f.speed);
  const on = derivatives(level(100), c, { ...DEFAULT_SETTINGS, altitudeEffects: true }).f;
  expect(on.iasFps).toBeLessThan(on.speed);
  expect(on.lift).toBeLessThan(f.lift);
});
test('up elevator pitches the nose up, and extra angle of attack is restored', () => {
  const { d } = derivatives(level(100), c, DEFAULT_SETTINGS);
  expect(derivatives(level(100), { ...c, elevatorRad: -0.1 }, DEFAULT_SETTINGS).d.dq).toBeGreaterThan(d.dq);
  expect(derivatives({ ...level(100), theta: 0.14 }, c, DEFAULT_SETTINGS).d.dq).toBeLessThan(d.dq);
});
test('power changes pitch the nose only when power-pitch coupling is on', () => {
  const on = { ...DEFAULT_SETTINGS, powerPitchCoupling: true };
  const dqAt = (thr: number, set: Settings) =>
    derivatives(level(100), { elevatorRad: -0.03, throttle: thr }, set).d.dq;
  // Off: only a small indirect effect remains (thrust bends the flight path, which
  // changes the angle-of-attack rate). On: a direct, much larger nose-up moment.
  const offEffect = dqAt(1, DEFAULT_SETTINGS) - dqAt(0.2, DEFAULT_SETTINGS);
  const onEffect = dqAt(1, on) - dqAt(0.2, on);
  expect(Math.abs(offEffect)).toBeLessThan(0.005);
  expect(onEffect).toBeGreaterThan(20 * Math.abs(offEffect));
});
test('extreme control inputs never produce non-finite state', () => {
  for (const ctl of [
    { elevatorRad: ELEVATOR_MIN_RAD, throttle: 0 },
    { elevatorRad: ELEVATOR_MAX_RAD, throttle: 1 },
    { elevatorRad: ELEVATOR_MIN_RAD, throttle: 1 },
  ])
    for (const set of [DEFAULT_SETTINGS, ALL_ON]) {
      let s = level(100);
      for (let i = 0; i < 120 * 120 && s.h > 0; i++) s = rk4Step(s, ctl, set, 1 / 120);
      expect(Object.values(s).every(Number.isFinite)).toBe(true);
    }
});
test('rk4 step advances position by velocity', () => {
  const s = rk4Step(level(100), c, DEFAULT_SETTINGS, 1 / 120);
  expect(s.x).toBeCloseTo(ktToFps(100) / 120, 2);
});
test('yoke maps to elevator: full back is full up-elevator', () => {
  expect(yokeToElevator(1)).toBeCloseTo(ELEVATOR_MIN_RAD);
  expect(yokeToElevator(-1)).toBeCloseTo(ELEVATOR_MAX_RAD);
  expect(yokeToElevator(0)).toBeCloseTo(0);
  expect(elevatorToYoke(yokeToElevator(0.37))).toBeCloseTo(0.37);
  expect(elevatorToYoke(yokeToElevator(-0.6))).toBeCloseTo(-0.6);
});
