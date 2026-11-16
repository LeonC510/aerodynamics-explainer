/** Times the forecast and one physics evaluation. Run with: npx tsx scripts/bench-forecast.ts */
import { Simulation } from '../src/sim/simulation';
import { forecast } from '../src/sim/forecast';
import { derivatives } from '../src/physics/dynamics';
const sim = new Simulation();
const c = { ...sim.controls, elevatorRad: sim.controls.elevatorRad - 0.01745 };
for (let k = 0; k < 3; k++) { const t0 = performance.now(); const f = forecast(sim.state, c, sim.settings, 0); console.log(f.end, f.samples.at(-1)!.t, (performance.now() - t0).toFixed(1), 'ms'); }
const s = sim.state; const t0 = performance.now(); for (let i = 0; i < 200000; i++) derivatives(s, c, sim.settings); console.log('deriv µs', ((performance.now() - t0) / 200000 * 1000).toFixed(3));
