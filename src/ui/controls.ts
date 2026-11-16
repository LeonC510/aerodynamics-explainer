/** The left control panel: yoke, throttle, run controls, and view toggles. */
import { DEFAULT_GRAPHS, GRAPHS, type GraphId } from '../config/graphs';
import { PLAYBACK_SPEEDS } from '../config/simulation';
import { elevatorToYoke, yokeToElevator, type Settings } from '../physics/dynamics';
import type { PlaybackSpeed, Simulation } from '../sim/simulation';
import { radToDeg } from '../units';

export type { GraphId };
export { DEFAULT_GRAPHS };

export interface UiState {
  forecastOn: boolean;
  graphs: Set<GraphId>;
}

const SETTINGS: readonly { key: keyof Settings; label: string; hint: string }[] = [
  { key: 'altitudeEffects', label: 'Altitude affects air density and power', hint: 'Off: sea-level air at every altitude.' },
  { key: 'thrustFallsWithSpeed', label: 'Thrust falls with airspeed (fixed-pitch propeller)', hint: 'Off: idealised thrust, the same at any speed.' },
  { key: 'powerPitchCoupling', label: 'Power changes pitch the nose', hint: 'Off: thrust acts through the centre of gravity.' },
];

export function mountControls(root: HTMLElement, sim: Simulation, ui: UiState, onChange: () => void): { sync(): void } {
  root.innerHTML = `
    <h1>Pitch for speed,<br>power for glide</h1>

    <div class="group">
      <h2>Yoke</h2>
      <div class="yoke">
        <input id="yoke" type="range" min="-1" max="1" step="0.002" aria-label="Yoke position" />
        <div class="ends">
          <span><strong>Pull back</strong>nose up</span>
          <span class="readout" id="yoke-readout"></span>
          <span><strong>Push forward</strong>nose down</span>
        </div>
      </div>
    </div>

    <div class="group throttle">
      <h2>Throttle</h2>
      <input id="throttle" type="range" min="0" max="100" step="0.5" aria-label="Throttle" />
      <span class="readout" id="throttle-readout"></span>
    </div>

    <div class="group">
      <div class="row">
        <button id="run" class="primary" type="button">Start</button>
        <button id="reset" type="button">Reset</button>
      </div>
      <div class="status" id="status" role="status"></div>
      <div class="row">
        <span>Speed</span>
        <span class="segmented" role="radiogroup" aria-label="Playback speed">
          ${PLAYBACK_SPEEDS.map((s) => `<label><input type="radio" name="speed" value="${s}" ${s === 1 ? 'checked' : ''}/>${s}×</label>`).join('')}
        </span>
      </div>
    </div>

    <div class="group">
      <h2>Trajectory</h2>
      <label class="check"><input id="forecast" type="checkbox" /><span>Show forecast<small>Where the current yoke and throttle lead.</small></span></label>
    </div>

    <div class="group">
      <h2>Graphs</h2>
      <div class="graph-toggles">
        ${GRAPHS.map((g) => `<label class="check"><input type="checkbox" data-graph="${g.id}" /><span>${g.title}</span></label>`).join('')}
      </div>
    </div>

    <details>
      <summary>Advanced settings</summary>
      ${SETTINGS.map((s) => `<label class="check"><input type="checkbox" data-setting="${s.key}" /><span>${s.label}<small>${s.hint}</small></span></label>`).join('')}
    </details>
  `;

  const $ = <T extends HTMLElement>(sel: string): T => root.querySelector<T>(sel)!;
  const yoke = $<HTMLInputElement>('#yoke');
  const yokeReadout = $('#yoke-readout');
  const throttle = $<HTMLInputElement>('#throttle');
  const throttleReadout = $('#throttle-readout');
  const run = $<HTMLButtonElement>('#run');
  const reset = $<HTMLButtonElement>('#reset');
  const status = $('#status');
  const forecast = $<HTMLInputElement>('#forecast');

  yoke.addEventListener('input', () => {
    sim.setElevator(yokeToElevator(Number(yoke.value)));
    onChange();
  });
  throttle.addEventListener('input', () => {
    sim.setThrottle(Number(throttle.value) / 100);
    onChange();
  });
  run.addEventListener('click', () => {
    if (sim.status === 'running') sim.pause();
    else sim.start();
    onChange();
  });
  reset.addEventListener('click', () => {
    sim.reset();
    onChange();
  });
  root.querySelectorAll<HTMLInputElement>('input[name="speed"]').forEach((el) =>
    el.addEventListener('change', () => {
      sim.playbackSpeed = Number(el.value) as PlaybackSpeed;
      onChange();
    }),
  );
  forecast.checked = ui.forecastOn;
  forecast.addEventListener('change', () => {
    ui.forecastOn = forecast.checked;
    onChange();
  });
  root.querySelectorAll<HTMLInputElement>('input[data-graph]').forEach((el) => {
    const id = el.dataset.graph as GraphId;
    el.checked = ui.graphs.has(id);
    el.addEventListener('change', () => {
      if (el.checked) ui.graphs.add(id);
      else ui.graphs.delete(id);
      onChange();
    });
  });
  root.querySelectorAll<HTMLInputElement>('input[data-setting]').forEach((el) => {
    const key = el.dataset.setting as keyof Settings;
    el.checked = sim.settings[key];
    el.addEventListener('change', () => {
      sim.setSettings({ [key]: el.checked });
      onChange();
    });
  });

  /** Copies the simulation's state into the widgets. Cheap; called every frame. */
  function sync(): void {
    const yokeValue = elevatorToYoke(sim.controls.elevatorRad).toFixed(3);
    if (document.activeElement !== yoke || Math.abs(Number(yoke.value) - Number(yokeValue)) > 0.0015) yoke.value = yokeValue;
    const deg = radToDeg(sim.controls.elevatorRad);
    const yokeText = `Elevator <b>${Math.abs(deg).toFixed(1)}°</b> ${deg < -0.05 ? 'up' : deg > 0.05 ? 'down' : ''}`;
    if (yokeReadout.innerHTML !== yokeText) yokeReadout.innerHTML = yokeText;

    const pct = sim.controls.throttle * 100;
    if (Math.abs(Number(throttle.value) - pct) > 0.26) throttle.value = String(pct);
    const throttleText = `<b>${pct.toFixed(0)}%</b>`;
    if (throttleReadout.innerHTML !== throttleText) throttleReadout.innerHTML = throttleText;

    const onGround = sim.status === 'ground';
    const runText = sim.status === 'running' ? 'Pause' : sim.time > 0 ? 'Resume' : 'Start';
    if (run.textContent !== runText) run.textContent = runText;
    run.disabled = onGround;
    yoke.disabled = onGround;
    throttle.disabled = onGround;
    const statusText = onGround ? 'Ground contact. Press Reset.' : '';
    if (status.textContent !== statusText) status.textContent = statusText;
  }

  sync();
  return { sync };
}
