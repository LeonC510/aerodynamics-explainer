/** Runs the physics ahead of the present, with the controls held, until flight stabilises. */
import {
  FORECAST_DT, FORECAST_MAX_S, FORECAST_SAMPLE_S, STABLE_CLIMB_FPM, STABLE_IAS_KT, STABLE_WINDOW_S,
} from '../config/simulation';
import { derivatives, rk4Step, type Controls, type Settings, type State } from '../physics/dynamics';
import { makeSample, type Sample } from './simulation';

export { FORECAST_MAX_S, FORECAST_SAMPLE_S, STABLE_WINDOW_S, STABLE_IAS_KT, STABLE_CLIMB_FPM };

export interface Forecast {
  samples: Sample[];
  /** Why the forecast stopped. */
  end: 'stabilised' | 'ground' | 'timeout';
}

export function forecast(state: State, controls: Controls, settings: Settings, startTime: number): Forecast {
  const stepsPerSample = Math.round(FORECAST_SAMPLE_S / FORECAST_DT);
  const windowSamples = Math.round(STABLE_WINDOW_S / FORECAST_SAMPLE_S);
  const maxSamples = Math.round(FORECAST_MAX_S / FORECAST_SAMPLE_S);

  let s = state;
  const samples: Sample[] = [makeSample(startTime, s, derivatives(s, controls, settings).f, null)];

  for (let n = 1; n <= maxSamples; n++) {
    for (let i = 0; i < stepsPerSample; i++) {
      s = rk4Step(s, controls, settings, FORECAST_DT);
      if (s.h <= 0) {
        s = { ...s, h: 0 };
        const t = startTime + ((n - 1) * stepsPerSample + i + 1) * FORECAST_DT;
        samples.push(makeSample(t, s, derivatives(s, controls, settings).f, samples[samples.length - 1]));
        return { samples, end: 'ground' };
      }
    }
    const t = startTime + n * stepsPerSample * FORECAST_DT;
    samples.push(makeSample(t, s, derivatives(s, controls, settings).f, samples[samples.length - 1]));

    if (n >= windowSamples && isSteady(samples, windowSamples)) return { samples, end: 'stabilised' };
  }
  return { samples, end: 'timeout' };
}

/** True if airspeed and climb rate have both stayed within their limits over the last window. */
function isSteady(samples: Sample[], windowSamples: number): boolean {
  let iasLo = Infinity, iasHi = -Infinity, climbLo = Infinity, climbHi = -Infinity;
  for (let i = samples.length - 1 - windowSamples; i < samples.length; i++) {
    const p = samples[i];
    if (p.iasKt < iasLo) iasLo = p.iasKt;
    if (p.iasKt > iasHi) iasHi = p.iasKt;
    if (p.climbFpm < climbLo) climbLo = p.climbFpm;
    if (p.climbFpm > climbHi) climbHi = p.climbFpm;
    if (iasHi - iasLo >= STABLE_IAS_KT || climbHi - climbLo >= STABLE_CLIMB_FPM) return false;
  }
  return true;
}
