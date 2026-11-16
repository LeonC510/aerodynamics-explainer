import './style.css';
import { DEFAULT_GRAPHS, mountControls, type UiState } from './ui/controls';
import { Simulation } from './sim/simulation';

const sim = new Simulation();
const ui: UiState = { forecastOn: false, graphs: new Set(DEFAULT_GRAPHS) };

const controls = mountControls(document.querySelector<HTMLElement>('#panel')!, sim, ui, () => controls.sync());
const placeholder = document.querySelector<HTMLElement>('#trajectory')!;

let last = performance.now();
function frame(now: number): void {
  sim.advance((now - last) / 1000);
  last = now;
  controls.sync();
  const s = sim.latest;
  placeholder.textContent = `t ${s.t.toFixed(1)} s · ${s.iasKt.toFixed(1)} kt · ${s.h.toFixed(0)} ft`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
