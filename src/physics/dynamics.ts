/**
 * Longitudinal (two-dimensional) equations of motion.
 *
 * derivatives() is the single place where forces become acceleration:
 * it computes lift, drag, thrust, weight and the pitching moment from the current
 * state, then applies Newton's second law. Everything the simulator shows comes
 * from integrating what this function returns.
 */
import { coefficients, wrapAngle } from './aero';
import {
  AERO_REF_IN, CHORD, ELEVATOR_MAX_RAD, ELEVATOR_MIN_RAD, G, MASS, PROP_IN, WING_AREA,
} from './aircraft';
import { RHO0, density } from './atmosphere';
import { thrust as computeThrust } from './propulsion';

export interface State {
  /** Horizontal distance flown, ft. */
  x: number;
  /** Altitude above sea level, ft. */
  h: number;
  /** Horizontal velocity, ft/s. */
  vx: number;
  /** Vertical velocity, ft/s, positive up. */
  vz: number;
  /** Pitch angle: nose above the horizon, rad. */
  theta: number;
  /** Pitch rate, rad/s, positive nose-up. */
  q: number;
}

export interface Controls {
  /** Elevator deflection, rad, positive trailing edge down (nose down). */
  elevatorRad: number;
  /** 0..1 */
  throttle: number;
}

export interface Settings {
  /** Air density and engine power fall with altitude. */
  altitudeEffects: boolean;
  /** Fixed-pitch propeller model instead of idealised constant thrust. */
  thrustFallsWithSpeed: boolean;
  /** Thrust-line offset and propeller slipstream over the tail pitch the nose. */
  powerPitchCoupling: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  altitudeEffects: false,
  thrustFallsWithSpeed: false,
  powerPitchCoupling: false,
};

/** Quantities computed on the way to the derivatives; these are what the graphs show. */
export interface Forces {
  /** True airspeed, ft/s. */
  speed: number;
  /** Flight-path angle: direction of travel above the horizon, rad. */
  gamma: number;
  /** Angle of attack, rad. */
  alpha: number;
  rho: number;
  /** Indicated (equivalent) airspeed, ft/s. */
  iasFps: number;
  lift: number;
  drag: number;
  thrust: number;
  /** Pitching moment about the centre of gravity, lbf·ft, positive nose-up. */
  moment: number;
  rpm: number | null;
}

export interface Derivs {
  dx: number;
  dh: number;
  dvx: number;
  dvz: number;
  dtheta: number;
  dq: number;
}

export function derivatives(s: State, c: Controls, set: Settings): { d: Derivs; f: Forces } {
  const m = MASS.massSlug;
  const W = MASS.weightLbf;

  // 1. Flight condition.
  const speed = Math.hypot(s.vx, s.vz);
  const gamma = Math.atan2(s.vz, s.vx);
  const alpha = wrapAngle(s.theta - gamma);
  const rho = density(s.h, set.altitudeEffects);
  const qbar = 0.5 * rho * speed * speed;
  const qS = qbar * WING_AREA;

  // 2. Thrust, along the nose.
  const axialSpeed = speed * Math.cos(alpha);
  const tr = computeThrust(c.throttle, axialSpeed, rho, set.thrustFallsWithSpeed);
  const T = tr.thrustLbf;

  // 3. Dynamic pressure at the tail relative to free stream. With power-pitch coupling
  //    the propeller slipstream speeds up the air over the elevator (JSBSim's qbar-induced).
  let tailQRatio = 1;
  if (set.powerPitchCoupling) {
    const u = Math.max(axialSpeed, 1);
    tailQRatio = ((u + 2 * tr.inducedVelocityFps) / u) ** 2;
  }

  // 4. First pass without the alpha-rate terms, to estimate how fast the flight path is turning.
  const first = coefficients({ alpha, alphaDot: 0, q: s.q, de: c.elevatorRad, speed, tailQRatio, throttle: c.throttle });
  const gammaDot = (qS * first.cl + T * Math.sin(alpha) - W * Math.cos(gamma)) / (m * Math.max(speed, 1));
  const alphaDot = s.q - gammaDot;

  // 5. Final coefficients, lift and drag.
  const co = coefficients({ alpha, alphaDot, q: s.q, de: c.elevatorRad, speed, tailQRatio, throttle: c.throttle });
  const lift = qS * co.cl; // perpendicular to the direction of travel
  const drag = qS * co.cd; // opposite the direction of travel

  // 6. Newton's second law. Weight acts straight down.
  const dvx = (T * Math.cos(s.theta) - drag * Math.cos(gamma) - lift * Math.sin(gamma)) / m;
  const dvz = (T * Math.sin(s.theta) - drag * Math.sin(gamma) + lift * Math.cos(gamma)) / m - G;

  // 7. Pitching moment about the centre of gravity.
  let moment = qS * CHORD * co.cm;
  // Lift and drag act at the aerodynamic reference point, not at the centre of gravity.
  const normal = lift * Math.cos(alpha) + drag * Math.sin(alpha); // toward the aircraft's top
  const axial = drag * Math.cos(alpha) - lift * Math.sin(alpha); // toward the tail
  moment += (-normal * (AERO_REF_IN.x - MASS.cgIn.x)) / 12 + (axial * (AERO_REF_IN.z - MASS.cgIn.z)) / 12;
  // The thrust line passes below the centre of gravity.
  if (set.powerPitchCoupling) moment += (T * (MASS.cgIn.z - PROP_IN.z)) / 12;

  return {
    d: { dx: s.vx, dh: s.vz, dvx, dvz, dtheta: s.q, dq: moment / MASS.iyy },
    f: { speed, gamma, alpha, rho, iasFps: speed * Math.sqrt(rho / RHO0), lift, drag, thrust: T, moment, rpm: tr.rpm },
  };
}

function advance(s: State, d: Derivs, dt: number): State {
  return {
    x: s.x + d.dx * dt,
    h: s.h + d.dh * dt,
    vx: s.vx + d.dvx * dt,
    vz: s.vz + d.dvz * dt,
    theta: s.theta + d.dtheta * dt,
    q: s.q + d.dq * dt,
  };
}

/** One classic fourth-order Runge–Kutta step. */
export function rk4Step(s: State, c: Controls, set: Settings, dt: number): State {
  const k1 = derivatives(s, c, set).d;
  const k2 = derivatives(advance(s, k1, dt / 2), c, set).d;
  const k3 = derivatives(advance(s, k2, dt / 2), c, set).d;
  const k4 = derivatives(advance(s, k3, dt), c, set).d;
  const mix = (a: number, b: number, cc: number, d: number): number => (a + 2 * b + 2 * cc + d) / 6;
  return advance(
    s,
    {
      dx: mix(k1.dx, k2.dx, k3.dx, k4.dx),
      dh: mix(k1.dh, k2.dh, k3.dh, k4.dh),
      dvx: mix(k1.dvx, k2.dvx, k3.dvx, k4.dvx),
      dvz: mix(k1.dvz, k2.dvz, k3.dvz, k4.dvz),
      dtheta: mix(k1.dtheta, k2.dtheta, k3.dtheta, k4.dtheta),
      dq: mix(k1.dq, k2.dq, k3.dq, k4.dq),
    },
    dt,
  );
}

/** Yoke position −1 (full forward) .. +1 (full back) to elevator deflection. */
export function yokeToElevator(yoke: number): number {
  const y = Math.min(Math.max(yoke, -1), 1);
  return y >= 0 ? y * ELEVATOR_MIN_RAD : -y * ELEVATOR_MAX_RAD;
}

export function elevatorToYoke(de: number): number {
  return de <= 0 ? de / ELEVATOR_MIN_RAD : -de / ELEVATOR_MAX_RAD;
}
