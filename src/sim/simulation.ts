/** Runs the physics in time: stepping, history, control-change markers, ground contact. */
import {
  DT, HISTORY_BYTES_PER_SAMPLE, MARKER_MERGE_S, MAX_SIM_SECONDS_PER_ADVANCE, MEMORY_PAUSE_EVERY_BYTES,
  MEMORY_RESET_EVERY_PAUSES, PLAYBACK_SPEEDS, SAMPLE_EVERY, START_ALTITUDE_FT, START_SPEED_KT,
} from '../config/simulation';
import { wrapAngle } from '../physics/aero';
import { ELEVATOR_MAX_RAD, ELEVATOR_MIN_RAD } from '../physics/aircraft';
import { RHO0, density } from '../physics/atmosphere';
import {
  DEFAULT_SETTINGS, derivatives, rk4Step, type Controls, type Forces, type Settings, type State,
} from '../physics/dynamics';
import { trim } from '../physics/trim';
import { fpsToFpm, fpsToKt, ktToFps, radToDeg } from '../units';

export { DT, SAMPLE_EVERY, START_ALTITUDE_FT, START_SPEED_KT, MAX_SIM_SECONDS_PER_ADVANCE };

/** One recorded moment of the flight, in display units. */
export interface Sample {
  /** Time since the start, s. */
  t: number;
  /** Distance flown, ft. */
  x: number;
  /** Altitude, ft. */
  h: number;
  thetaDeg: number;
  gammaDeg: number;
  alphaDeg: number;
  iasKt: number;
  iasRateKtPerS: number;
  thrustLbf: number;
  liftLbf: number;
  liftRateLbfPerS: number;
  climbFpm: number;
}

/** Builds a sample; rates of change are differenced against the previous sample (zero if none). */
export function makeSample(t: number, s: State, f: Forces, prev: Sample | null): Sample {
  const iasKt = fpsToKt(f.iasFps);
  const dt = prev ? t - prev.t : 0;
  return {
    t,
    x: s.x,
    h: s.h,
    // The pitch angle keeps counting through loops (720° after two); record it within ±180°.
    thetaDeg: radToDeg(wrapAngle(s.theta)),
    gammaDeg: radToDeg(f.gamma),
    alphaDeg: radToDeg(f.alpha),
    iasKt,
    iasRateKtPerS: prev && dt > 0 ? (iasKt - prev.iasKt) / dt : 0,
    thrustLbf: f.thrust,
    liftLbf: f.lift,
    liftRateLbfPerS: prev && dt > 0 ? (f.lift - prev.liftLbf) / dt : 0,
    climbFpm: fpsToFpm(s.vz),
  };
}

export interface Marker {
  t: number;
  kind: 'pitch' | 'throttle' | 'setting';
}

export type Status = 'paused' | 'running' | 'ground';
/**
 * Set when the run has paused itself because the flight history has grown large:
 * 'paused' at each pause threshold, 'reset-advised' at each reset threshold.
 */
export type MemoryNotice = 'none' | 'paused' | 'reset-advised';

export interface SimulationOptions {
  /** History growth that triggers an automatic pause, bytes. Defaults to the configured 500 MB. */
  pauseEveryBytes?: number;
}

export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

export class Simulation {
  playbackSpeed: PlaybackSpeed = 1;

  private _status: Status = 'paused';
  private _state!: State;
  private _controls!: Controls;
  private _settings: Settings;
  private _history: Sample[] = [];
  private _markers: Marker[] = [];
  private _revision = 0;
  private steps = 0;
  private accumulator = 0;
  private _memoryNotice: MemoryNotice = 'none';
  private memoryPauses = 0;
  private readonly pauseEveryBytes: number;

  constructor(settings: Settings = DEFAULT_SETTINGS, options: SimulationOptions = {}) {
    this._settings = { ...settings };
    this.pauseEveryBytes = options.pauseEveryBytes ?? MEMORY_PAUSE_EVERY_BYTES;
    this.reset();
  }

  /** Approximate memory held by the flight history, bytes. */
  get estimatedMemoryBytes(): number { return this._history.length * HISTORY_BYTES_PER_SAMPLE; }
  get memoryNotice(): MemoryNotice { return this._memoryNotice; }

  get status(): Status { return this._status; }
  get time(): number { return this.steps * DT; }
  get state(): State { return this._state; }
  get controls(): Controls { return this._controls; }
  get settings(): Settings { return this._settings; }
  get history(): readonly Sample[] { return this._history; }
  get markers(): readonly Marker[] { return this._markers; }
  get latest(): Sample { return this._history[this._history.length - 1]; }
  /** Increments whenever a control or setting changes, and on reset. */
  get revision(): number { return this._revision; }

  start(): void {
    if (this._status !== 'paused') return;
    this._status = 'running';
    this._memoryNotice = 'none';
  }

  pause(): void {
    if (this._status === 'running') this._status = 'paused';
  }

  /** Back to steady level flight at the starting altitude and speed. Settings are kept. */
  reset(): void {
    const rho = density(START_ALTITUDE_FT, this._settings.altitudeEffects);
    const trueSpeed = ktToFps(START_SPEED_KT) / Math.sqrt(rho / RHO0);
    const t = trim({ speedFps: trueSpeed, altitudeFt: START_ALTITUDE_FT, gammaRad: 0 }, this._settings);
    if (!t) throw new Error('No steady level flight exists at the starting condition');
    this._state = t.state;
    this._controls = t.controls;
    this._status = 'paused';
    this.steps = 0;
    this.accumulator = 0;
    this._markers = [];
    this._history = [];
    this._memoryNotice = 'none';
    this.memoryPauses = 0;
    this.record();
    this._revision++;
  }

  setElevator(rad: number): void {
    if (this._status === 'ground') return;
    this._controls = { ...this._controls, elevatorRad: clamp(rad, ELEVATOR_MIN_RAD, ELEVATOR_MAX_RAD) };
    this.changed('pitch');
  }

  setThrottle(x: number): void {
    if (this._status === 'ground') return;
    this._controls = { ...this._controls, throttle: clamp(x, 0, 1) };
    this.changed('throttle');
  }

  /** Takes effect immediately and keeps the current flight state. */
  setSettings(patch: Partial<Settings>): void {
    this._settings = { ...this._settings, ...patch };
    this.changed('setting');
  }

  /** Advances the simulation by a span of real time, scaled by the playback speed. */
  advance(realSeconds: number): void {
    if (this._status !== 'running') return;
    const cap = MAX_SIM_SECONDS_PER_ADVANCE * this.playbackSpeed;
    this.accumulator = Math.min(this.accumulator + realSeconds * this.playbackSpeed, cap);
    while (this.accumulator >= DT - 1e-12) {
      this.accumulator -= DT;
      this._state = rk4Step(this._state, this._controls, this._settings, DT);
      this.steps++;
      if (this._state.h <= 0) {
        this._state = { ...this._state, h: 0 };
        this.record();
        this._status = 'ground';
        this.accumulator = 0;
        return;
      }
      if (this.steps % SAMPLE_EVERY === 0) {
        this.record();
        if (this.memoryGuardTripped()) return;
      }
    }
    if (this.accumulator < 0) this.accumulator = 0;
  }

  /**
   * Pauses the run each time the history has grown by another pauseEveryBytes, so an
   * unattended tab cannot grow without limit. Returns true if it paused.
   */
  private memoryGuardTripped(): boolean {
    const crossed = Math.floor(this.estimatedMemoryBytes / this.pauseEveryBytes);
    if (crossed <= this.memoryPauses) return false;
    this.memoryPauses = crossed;
    this._status = 'paused';
    this.accumulator = 0;
    this._memoryNotice = crossed % MEMORY_RESET_EVERY_PAUSES === 0 ? 'reset-advised' : 'paused';
    return true;
  }

  private record(): void {
    const f = derivatives(this._state, this._controls, this._settings).f;
    const prev = this._history.length ? this._history[this._history.length - 1] : null;
    this._history.push(makeSample(this.time, this._state, f, prev));
  }

  private changed(kind: Marker['kind']): void {
    this._revision++;
    const last = this._markers[this._markers.length - 1];
    if (last && last.kind === kind && this.time - last.t < MARKER_MERGE_S) return;
    this._markers.push({ t: this.time, kind });
  }
}
