import './style.css';
import { Simulation } from './sim/simulation';
import { DEFAULT_GRAPHS, mountControls, type UiState } from './ui/controls';
import { mountGraphs } from './ui/graphs';
import { mountTrajectory } from './ui/trajectoryView';

const sim = new Simulation();
const ui: UiState = { forecastOn: false, graphs: new Set(DEFAULT_GRAPHS) };

const controls = mountControls(document.querySelector<HTMLElement>('#panel')!, sim, ui, () => controls.sync());
const trajectory = mountTrajectory(document.querySelector<HTMLElement>('#trajectory')!, sim, ui);
const graphs = mountGraphs(document.querySelector<HTMLElement>('#graphs')!, sim, ui);

// For poking at the simulation from the browser console during development.
if (import.meta.env.DEV) Object.assign(window, { sim, ui });

let last = performance.now();
function frame(now: number): void {
  sim.advance((now - last) / 1000);
  last = now;
  controls.sync();
  trajectory.draw();
  graphs.draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
