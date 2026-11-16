/** Finds steady flight conditions: the controls and attitude at which nothing accelerates. */
import { ELEVATOR_MAX_RAD, ELEVATOR_MIN_RAD, STALL_ALPHA_RAD } from './aircraft';
import { derivatives, type Controls, type Settings, type State } from './dynamics';

export type TrimTarget =
  /** Hold this speed along this flight-path angle; solve for throttle. */
  | { speedFps: number; altitudeFt: number; gammaRad: number }
  /** Hold this speed at this throttle; solve for the flight-path angle. */
  | { speedFps: number; altitudeFt: number; throttle: number };

export interface TrimResult {
  state: State;
  controls: Controls;
  gammaRad: number;
}

type Vec3 = [number, number, number];

/** Solves the 3×3 system J·x = r by Cramer's rule; null if singular. */
function solve3(J: Vec3[], r: Vec3): Vec3 | null {
  const det = (m: Vec3[]): number =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const d = det(J);
  if (!Number.isFinite(d) || Math.abs(d) < 1e-14) return null;
  const col = (k: number): Vec3[] => J.map((row, i) => row.map((v, j) => (j === k ? r[i] : v)) as Vec3);
  return [det(col(0)) / d, det(col(1)) / d, det(col(2)) / d];
}

/**
 * Newton iteration on three unknowns — angle of attack, elevator, and either throttle
 * or flight-path angle — until horizontal, vertical and pitch accelerations are all zero.
 * Returns null if there is no such state within the control limits and below the stall.
 */
export function trim(target: TrimTarget, set: Settings): TrimResult | null {
  const solveThrottle = 'gammaRad' in target;

  const build = (u: Vec3): { state: State; controls: Controls; gamma: number } => {
    const gamma = solveThrottle ? target.gammaRad : u[2];
    const throttle = solveThrottle ? u[2] : target.throttle;
    return {
      gamma,
      state: {
        x: 0,
        h: target.altitudeFt,
        vx: target.speedFps * Math.cos(gamma),
        vz: target.speedFps * Math.sin(gamma),
        theta: u[0] + gamma,
        q: 0,
      },
      controls: { elevatorRad: u[1], throttle },
    };
  };
  const residual = (u: Vec3): Vec3 => {
    const b = build(u);
    const { d } = derivatives(b.state, b.controls, set);
    return [d.dvx, d.dvz, d.dq];
  };

  let u: Vec3 = [0.05, -0.02, solveThrottle ? 0.5 : 0];
  const maxStep: Vec3 = [0.05, 0.1, solveThrottle ? 0.3 : 0.1];
  let converged = false;
  for (let iter = 0; iter < 80; iter++) {
    const r = residual(u);
    if (Math.max(Math.abs(r[0]), Math.abs(r[1]), Math.abs(r[2])) < 1e-9) {
      converged = true;
      break;
    }
    const J: Vec3[] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let k = 0; k < 3; k++) {
      const eps = 1e-6;
      const up = [...u] as Vec3;
      up[k] += eps;
      const dn = [...u] as Vec3;
      dn[k] -= eps;
      const rp = residual(up);
      const rn = residual(dn);
      for (let i = 0; i < 3; i++) J[i][k] = (rp[i] - rn[i]) / (2 * eps);
    }
    const step = solve3(J, r);
    if (!step) return null;
    // Limit the step so the iteration cannot jump across the stall or a control stop.
    const scale = Math.min(1, ...step.map((s, k) => maxStep[k] / Math.max(Math.abs(s), 1e-12)));
    u = [u[0] - scale * step[0], u[1] - scale * step[1], u[2] - scale * step[2]];
    if (!u.every(Number.isFinite)) return null;
  }
  if (!converged) return null;

  const b = build(u);
  const tol = 1e-9;
  if (u[0] > STALL_ALPHA_RAD || u[0] < -STALL_ALPHA_RAD) return null;
  if (b.controls.elevatorRad < ELEVATOR_MIN_RAD - tol || b.controls.elevatorRad > ELEVATOR_MAX_RAD + tol) return null;
  if (b.controls.throttle < -tol || b.controls.throttle > 1 + tol) return null;
  if (Math.abs(b.gamma) > Math.PI / 2) return null;
  b.controls.throttle = Math.min(Math.max(b.controls.throttle, 0), 1);
  return { state: b.state, controls: b.controls, gammaRad: b.gamma };
}
