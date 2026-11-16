/** The left control panel: pitch, throttle, run controls, and view toggles. */
import { DEFAULT_GRAPHS, GRAPHS, type GraphId } from '../config/graphs';
import { PLAYBACK_SPEEDS } from '../config/simulation';
import {
  FINE_REPEAT_DELAY_MS, FINE_REPEAT_INTERVAL_MS, FINE_STEP_ELEVATOR_DEG, FINE_STEP_THROTTLE_PCT,
} from '../config/view';
import { elevatorToYoke, yokeToElevator, type Settings } from '../physics/dynamics';
import type { PlaybackSpeed, Simulation } from '../sim/simulation';
import { degToRad, radToDeg } from '../units';

export type { GraphId };
export { DEFAULT_GRAPHS };

export interface UiState {
  forecastOn: boolean;
  graphs: Set<GraphId>;
}

const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5h4.5v15H6zM13.5 4.5H18v15h-4.5z" fill="currentColor"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  reset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12a7 7 0 1 0 2.3-5.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M4.5 3.5v5h5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
} as const;

const SETTINGS: readonly { key: keyof Settings; label: string; hint: string }[] = [
  { key: 'altitudeEffects', label: 'Altitude affects air density and power', hint: 'Off: sea-level air at every altitude.' },
  { key: 'thrustFallsWithSpeed', label: 'Thrust falls with airspeed (fixed-pitch propeller)', hint: 'Off: idealised thrust, the same at any speed.' },
  { key: 'powerPitchCoupling', label: 'Power changes pitch the nose', hint: 'Off: thrust acts through the centre of gravity.' },
];

export function mountControls(root: HTMLElement, sim: Simulation, ui: UiState, onChange: () => void): { sync(): void } {
  root.innerHTML = `
    <h1>Pitch for speed,<br>power for glide</h1>

    <div class="group">
      <h2>Pitch</h2>
      <div class="yoke">
        <div class="yoke-column">
          <button class="fine" type="button" data-fine="pitch-forward" aria-label="Push forward slightly" title="Push forward ${FINE_STEP_ELEVATOR_DEG}°">${ICON.up}</button>
          <input id="yoke" type="range" min="-1" max="1" step="0.002" aria-label="Pitch control" />
          <button class="fine" type="button" data-fine="pitch-back" aria-label="Pull back slightly" title="Pull back ${FINE_STEP_ELEVATOR_DEG}°">${ICON.down}</button>
        </div>
        <div class="ends">
          <span><strong>Push forward</strong>nose down</span>
          <span class="readout" id="yoke-readout"></span>
          <span><strong>Pull back</strong>nose up</span>
        </div>
      </div>
    </div>

    <div class="group throttle">
      <h2>Throttle</h2>
      <div class="row">
        <button class="fine" type="button" data-fine="throttle-less" aria-label="Reduce throttle slightly" title="Throttle −${FINE_STEP_THROTTLE_PCT}%">${ICON.minus}</button>
        <input id="throttle" type="range" min="0" max="100" step="0.1" aria-label="Throttle" />
        <button class="fine" type="button" data-fine="throttle-more" aria-label="Increase throttle slightly" title="Throttle +${FINE_STEP_THROTTLE_PCT}%">${ICON.plus}</button>
      </div>
      <span class="readout" id="throttle-readout"></span>
    </div>

    <div class="group">
      <div class="row">
        <button id="run" class="primary icon" type="button"></button>
        <button id="reset" class="icon" type="button" aria-label="Reset" title="Reset">${ICON.reset}</button>
      </div>
      <div class="status" id="status" role="status"></div>
    </div>

    <div class="group speed">
      <h2>Speed <span class="readout" id="speed-readout"></span></h2>
      <input id="speed" type="range" min="0" max="${PLAYBACK_SPEEDS.length - 1}" step="1" value="0" aria-label="Playback speed" />
      <div class="stops" aria-hidden="true">${PLAYBACK_SPEEDS.map((s) => `<span>${s}×</span>`).join('')}</div>
    </div>

    <div class="group">
      <h2>Trajectory</h2>
      <label class="check"><input id="forecast" type="checkbox" /><span>Show forecast<small>Where the current pitch and throttle settings lead.</small></span></label>
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
  // Fine-adjust buttons: one small step per press, repeating while held.
  const fineActions: Record<string, () => void> = {
    // Positive elevator is trailing edge down, which is what pushing forward does.
    'pitch-forward': () => sim.setElevator(sim.controls.elevatorRad + degToRad(FINE_STEP_ELEVATOR_DEG)),
    'pitch-back': () => sim.setElevator(sim.controls.elevatorRad - degToRad(FINE_STEP_ELEVATOR_DEG)),
    'throttle-less': () => sim.setThrottle(sim.controls.throttle - FINE_STEP_THROTTLE_PCT / 100),
    'throttle-more': () => sim.setThrottle(sim.controls.throttle + FINE_STEP_THROTTLE_PCT / 100),
  };
  const fineButtons = root.querySelectorAll<HTMLButtonElement>('button[data-fine]');
  fineButtons.forEach((button) => {
    const act = (): void => {
      fineActions[button.dataset.fine!]();
      onChange();
    };
    let delay = 0;
    let repeat = 0;
    const stop = (): void => {
      window.clearTimeout(delay);
      window.clearInterval(repeat);
    };
    button.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      act();
      stop();
      delay = window.setTimeout(() => {
        repeat = window.setInterval(act, FINE_REPEAT_INTERVAL_MS);
      }, FINE_REPEAT_DELAY_MS);
    });
    for (const type of ['pointerup', 'pointerleave', 'pointercancel', 'blur'] as const) button.addEventListener(type, stop);
    // Keyboard activation (Enter or Space) arrives as a click with no pointer press.
    button.addEventListener('click', (e) => {
      if (e.detail === 0) act();
    });
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
  const speed = $<HTMLInputElement>('#speed');
  const speedReadout = $('#speed-readout');
  speed.addEventListener('input', () => {
    sim.playbackSpeed = PLAYBACK_SPEEDS[Number(speed.value)] as PlaybackSpeed;
    onChange();
  });
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
    if (Math.abs(Number(throttle.value) - pct) > 0.051) throttle.value = pct.toFixed(1);
    const throttleText = `<b>${pct.toFixed(1)}%</b>`;
    if (throttleReadout.innerHTML !== throttleText) throttleReadout.innerHTML = throttleText;

    const speedIndex = String(PLAYBACK_SPEEDS.indexOf(sim.playbackSpeed));
    if (speed.value !== speedIndex) speed.value = speedIndex;
    const speedText = `${sim.playbackSpeed}×`;
    if (speedReadout.textContent !== speedText) speedReadout.textContent = speedText;

    const onGround = sim.status === 'ground';
    const runLabel = sim.status === 'running' ? 'Pause' : sim.time > 0 ? 'Resume' : 'Start';
    if (run.getAttribute('aria-label') !== runLabel) {
      run.setAttribute('aria-label', runLabel);
      run.title = runLabel;
      run.innerHTML = sim.status === 'running' ? ICON.pause : ICON.play;
    }
    run.disabled = onGround;
    yoke.disabled = onGround;
    throttle.disabled = onGround;
    fineButtons.forEach((button) => {
      button.disabled = onGround;
    });

    let statusText = '';
    if (onGround) statusText = 'Ground contact. Press Reset.';
    else if (sim.memoryNotice !== 'none') {
      const mb = sim.estimatedMemoryBytes / (1024 * 1024);
      const size = mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
      statusText =
        sim.memoryNotice === 'reset-advised'
          ? `Paused: this flight's history now uses about ${size} of memory. Reset to clear it.`
          : `Paused: this flight's history now uses about ${size} of memory. Resume to continue, or Reset to clear it.`;
    }
    if (status.textContent !== statusText) status.textContent = statusText;
    reset.classList.toggle('attention', onGround || sim.memoryNotice === 'reset-advised');
  }

  sync();
  return { sync };
}
