import { expect, test } from 'vitest';
import { FORECAST_MAX_S, STABLE_WINDOW_S } from '../../src/config/simulation';
import { ELEVATOR_MAX_RAD } from '../../src/physics/aircraft';
import { forecast } from '../../src/sim/forecast';
import { Simulation } from '../../src/sim/simulation';
import { degToRad } from '../../src/units';

test('steady flight is forecast as stabilised after one stability window', () => {
  const sim = new Simulation();
  const calm = forecast(sim.state, sim.controls, sim.settings, 0);
  expect(calm.end).toBe('stabilised');
  expect(calm.samples[0].t).toBe(0);
  expect(calm.samples.at(-1)!.t).toBeCloseTo(STABLE_WINDOW_S, 0);
});
test('a yoke change is forecast through its oscillation to the new steady speed', () => {
  const sim = new Simulation();
  const pulled = forecast(sim.state, { ...sim.controls, elevatorRad: sim.controls.elevatorRad - degToRad(1) }, sim.settings, 0);
  expect(pulled.end).toBe('stabilised');
  expect(pulled.samples.at(-1)!.t).toBeGreaterThan(60);
  expect(pulled.samples.at(-1)!.iasKt).toBeLessThan(97);
});
test('the forecast matches what the live simulation then does', () => {
  const sim = new Simulation();
  const de = sim.controls.elevatorRad - degToRad(1);
  const pulled = forecast(sim.state, { ...sim.controls, elevatorRad: de }, sim.settings, 0);
  sim.setElevator(de);
  sim.start();
  while (sim.time < 60 - 1e-9) sim.advance(1 / 60);
  const at60 = pulled.samples.find((s) => Math.abs(s.t - 60) < 1e-6)!;
  expect(at60.h).toBeCloseTo(sim.latest.h, 0);
  expect(at60.x).toBeCloseTo(sim.latest.x, 0);
});
test('forecast times continue from the given start time', () => {
  const sim = new Simulation();
  expect(forecast(sim.state, sim.controls, sim.settings, 42).samples[0].t).toBe(42);
});
test('a dive is forecast to the ground', () => {
  const sim = new Simulation();
  const f = forecast(sim.state, { elevatorRad: ELEVATOR_MAX_RAD, throttle: 1 }, sim.settings, 0);
  expect(f.end).toBe('ground');
  expect(f.samples.at(-1)!.h).toBe(0);
});
test('a forecast is fast enough to recompute on every slider movement', () => {
  const sim = new Simulation();
  const controls = { ...sim.controls, elevatorRad: sim.controls.elevatorRad - degToRad(1) };
  let simulated = 0;
  const run = () => {
    const f = forecast(sim.state, controls, sim.settings, 0);
    simulated = f.samples.at(-1)!.t;
  };
  for (let i = 0; i < 5; i++) run(); // warm up
  const t0 = performance.now();
  for (let i = 0; i < 5; i++) run();
  const ms = (performance.now() - t0) / 5;
  // A guard against order-of-magnitude regressions only: the test runner executes this
  // code about 4× slower than a browser or plain Node. Real timings come from
  // scripts/bench-forecast.ts: about 6 ms typical, 17 ms for a full-length forecast.
  expect(ms).toBeLessThan(100);
  expect((ms / simulated) * FORECAST_MAX_S).toBeLessThan(250);
  console.log(`forecast: ${simulated.toFixed(0)} s simulated in ${ms.toFixed(2)} ms`);
});
