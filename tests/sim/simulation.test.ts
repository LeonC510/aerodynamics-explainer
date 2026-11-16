import { expect, test } from 'vitest';
import { ELEVATOR_MAX_RAD } from '../../src/physics/aircraft';
import { derivatives } from '../../src/physics/dynamics';
import { Simulation, makeSample } from '../../src/sim/simulation';

test('opens paused in steady level flight at 3000 ft and 100 kt, controls at trim', () => {
  const sim = new Simulation();
  expect(sim.status).toBe('paused');
  expect(sim.history.length).toBe(1);
  expect(sim.latest.h).toBeCloseTo(3000);
  expect(sim.latest.iasKt).toBeCloseTo(100, 1);
  expect(sim.controls.elevatorRad).not.toBe(0);
  expect(sim.controls.throttle).toBeGreaterThan(0.2);
  sim.advance(1);
  expect(sim.time).toBe(0);
});
test('advances in real time, scaled by playback speed, sampling 30 times a second', () => {
  const sim = new Simulation();
  sim.start();
  sim.advance(1);
  expect(sim.time).toBeCloseTo(1, 5);
  expect(sim.history.length).toBe(31);
  sim.playbackSpeed = 4;
  sim.advance(1);
  expect(sim.time).toBeCloseTo(5, 5);
  expect(Math.abs(sim.latest.h - 3000)).toBeLessThan(1);
});
test('a very long frame is capped instead of simulated in full', () => {
  const sim = new Simulation();
  sim.playbackSpeed = 4;
  sim.start();
  sim.advance(300);
  expect(sim.time).toBeCloseTo(8, 5);
  sim.advance(0.5);
  expect(sim.time).toBeCloseTo(10, 5); // no backlog carried over
});
test('pause stops time and start resumes it', () => {
  const sim = new Simulation();
  sim.start();
  sim.advance(1);
  sim.pause();
  sim.advance(1);
  expect(sim.time).toBeCloseTo(1, 5);
  expect(sim.status).toBe('paused');
});
test('control changes are clamped, bump the revision, and leave one marker per drag', () => {
  const sim = new Simulation();
  sim.start();
  sim.advance(1);
  const r0 = sim.revision;
  sim.setThrottle(0.3);
  sim.setThrottle(0.31);
  sim.setThrottle(0.32);
  expect(sim.markers.filter((m) => m.kind === 'throttle').length).toBe(1);
  expect(sim.revision).toBeGreaterThan(r0);
  expect(sim.controls.throttle).toBeCloseTo(0.32);
  sim.setThrottle(7);
  expect(sim.controls.throttle).toBe(1);
  sim.setElevator(-9);
  expect(sim.controls.elevatorRad).toBeCloseTo((-28 * Math.PI) / 180);
  sim.advance(1);
  sim.setThrottle(0.5);
  expect(sim.markers.filter((m) => m.kind === 'throttle').length).toBe(2);
});
test('the first sample has zero rates; later samples difference against the previous one', () => {
  const sim = new Simulation();
  const f = derivatives(sim.state, sim.controls, sim.settings).f;
  const a = makeSample(0, sim.state, f, null);
  expect(a.iasRateKtPerS).toBe(0);
  expect(a.liftRateLbfPerS).toBe(0);
  const b = makeSample(0.5, sim.state, { ...f, lift: f.lift + 10 }, a);
  expect(b.liftRateLbfPerS).toBeCloseTo(20);
});
test('a fast-forwarded dive ends in ground contact that only reset clears; settings survive reset', () => {
  const dive = new Simulation();
  dive.playbackSpeed = 16;
  dive.start();
  dive.setElevator(ELEVATOR_MAX_RAD);
  dive.setThrottle(1);
  for (let i = 0; i < 2000 && dive.status === 'running'; i++) dive.advance(0.1);
  expect(dive.status).toBe('ground');
  expect(dive.latest.h).toBe(0);
  const tEnd = dive.time;
  dive.start();
  dive.advance(1);
  expect(dive.time).toBe(tEnd);
  dive.setThrottle(0.1);
  expect(dive.controls.throttle).toBe(1); // controls are dead on the ground
  dive.setSettings({ thrustFallsWithSpeed: true });
  dive.reset();
  expect(dive.status).toBe('paused');
  expect(dive.time).toBe(0);
  expect(dive.latest.h).toBeCloseTo(3000);
  expect(dive.settings.thrustFallsWithSpeed).toBe(true);
  expect(dive.markers.length).toBe(0);
  expect(dive.history.length).toBe(1);
});
test('with altitude effects on, the start is still 100 kt indicated', () => {
  const sim = new Simulation({ altitudeEffects: true, thrustFallsWithSpeed: false, powerPitchCoupling: false });
  expect(sim.latest.iasKt).toBeCloseTo(100, 1);
  sim.start();
  sim.advance(2);
  expect(Math.abs(sim.latest.h - 3000)).toBeLessThan(1);
});

// ---------- Memory guard ----------
import { HISTORY_BYTES_PER_SAMPLE } from '../../src/config/simulation';

test('estimated history memory grows with the number of samples', () => {
  const sim = new Simulation();
  expect(sim.estimatedMemoryBytes).toBe(HISTORY_BYTES_PER_SAMPLE);
  sim.start();
  sim.advance(1);
  expect(sim.estimatedMemoryBytes).toBe(31 * HISTORY_BYTES_PER_SAMPLE);
});
test('the run pauses each time history memory crosses another pause threshold', () => {
  const step = 60 * HISTORY_BYTES_PER_SAMPLE; // 60 samples = 2 s of flight
  const sim = new Simulation(undefined, { pauseEveryBytes: step });
  sim.start();
  sim.advance(2);
  sim.advance(2);
  expect(sim.status).toBe('paused');
  expect(sim.memoryNotice).toBe('paused');
  expect(sim.history.length).toBe(60);
  sim.advance(2);
  expect(sim.history.length).toBe(60); // stays paused until resumed
  sim.start();
  expect(sim.memoryNotice).toBe('none');
  sim.advance(1);
  expect(sim.status).toBe('running');
});
test('every second threshold asks for a reset instead, and reset clears the count', () => {
  const step = 60 * HISTORY_BYTES_PER_SAMPLE;
  const sim = new Simulation(undefined, { pauseEveryBytes: step });
  sim.start();
  for (let i = 0; i < 3 && sim.status === 'running'; i++) sim.advance(2);
  expect(sim.memoryNotice).toBe('paused');
  sim.start();
  for (let i = 0; i < 3 && sim.status === 'running'; i++) sim.advance(2);
  expect(sim.history.length).toBe(120);
  expect(sim.status).toBe('paused');
  expect(sim.memoryNotice).toBe('reset-advised');
  sim.reset();
  expect(sim.memoryNotice).toBe('none');
  sim.start();
  sim.advance(1);
  expect(sim.status).toBe('running');
});

import { PLAYBACK_SPEEDS } from '../../src/config/simulation';

test('playback speeds are four steps of 4×, up to 64×, and 64× covers 64 s of flight per second', () => {
  expect([...PLAYBACK_SPEEDS]).toEqual([1, 4, 16, 64]);
  const sim = new Simulation();
  sim.playbackSpeed = 64;
  sim.start();
  sim.advance(1);
  expect(sim.time).toBeCloseTo(64, 5);
  expect(Math.abs(sim.latest.h - 3000)).toBeLessThan(1);
});

test('after a loop, the recorded nose angle stays within ±180° and still equals travel angle plus angle of attack', () => {
  const sim = new Simulation();
  const looped = { ...sim.state, theta: sim.state.theta + 4 * Math.PI }; // two full loops later
  const f = derivatives(looped, sim.controls, sim.settings).f;
  const s = makeSample(0, looped, f, null);
  expect(s.thetaDeg).toBeGreaterThan(-180);
  expect(s.thetaDeg).toBeLessThanOrEqual(180);
  expect(s.thetaDeg).toBeCloseTo(sim.latest.thetaDeg, 6);
  expect(s.thetaDeg).toBeCloseTo(s.gammaDeg + s.alphaDeg, 6);
});
