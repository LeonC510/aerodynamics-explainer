/** Aerodynamic coefficients of the whole aircraft as functions of the flight condition. */
import {
  CD0, CD_ALPHA, CD_DE, CHORD, CL_ADOT, CL_ALPHA, CL_DE, CL_Q, CM0, CM_ADOT, CM_ALPHA, CM_DE, CM_Q,
  FLAT_PLATE_CD, FLAT_PLATE_CL, POST_STALL_BLEND_RAD, STABILITY_LINEAR_LIMIT_RAD,
} from './aircraft';
import { interp1, type Table1D } from './table';

/** Wraps an angle to (−π, π]. */
export function wrapAngle(a: number): number {
  const w = a % (2 * Math.PI);
  if (w > Math.PI) return w - 2 * Math.PI;
  if (w <= -Math.PI) return w + 2 * Math.PI;
  return w;
}

// Beyond the source tables the wing is modelled as a flat plate (see config/aircraft.ts).
const flatPlateLift = (alpha: number): number => FLAT_PLATE_CL * Math.sin(2 * alpha);
const flatPlateDrag = (alpha: number): number => CD0 + FLAT_PLATE_CD * Math.sin(alpha) ** 2;

function extended(table: Table1D, offset: number, flatPlate: (a: number) => number, alphaIn: number): number {
  const alpha = wrapAngle(alphaIn);
  const lo = table[0][0];
  const hi = table[table.length - 1][0];
  if (alpha >= lo && alpha <= hi) return offset + interp1(table, alpha);
  const beyond = alpha > hi ? alpha - hi : lo - alpha;
  const endValue = offset + (alpha > hi ? table[table.length - 1][1] : table[0][1]);
  if (beyond >= POST_STALL_BLEND_RAD) return flatPlate(alpha);
  const w = beyond / POST_STALL_BLEND_RAD;
  return (1 - w) * endValue + w * flatPlate(alpha);
}

/** Lift coefficient from angle of attack alone (rad). */
export function liftCoefficientStatic(alpha: number): number {
  return extended(CL_ALPHA, 0, flatPlateLift, alpha);
}

/** Drag coefficient from angle of attack alone (rad): zero-lift drag plus drag due to alpha. */
export function dragCoefficientStatic(alpha: number): number {
  return extended(CD_ALPHA, CD0, flatPlateDrag, alpha);
}

export interface AeroInput {
  /** Angle of attack, rad. */
  alpha: number;
  /** Rate of change of angle of attack, rad/s. */
  alphaDot: number;
  /** Pitch rate, rad/s. */
  q: number;
  /** Elevator deflection, rad, positive trailing edge down. */
  de: number;
  /** True airspeed, ft/s. */
  speed: number;
  /** Dynamic pressure at the tail divided by free-stream dynamic pressure. */
  tailQRatio: number;
}

export interface AeroCoeffs {
  cl: number;
  cd: number;
  cm: number;
}

/**
 * Angle used by the static-stability term. Equal to alpha in normal flight.
 * Beyond STABILITY_LINEAR_LIMIT_RAD it follows a sine (see config/aircraft.ts).
 */
function stabilityAlpha(alpha: number): number {
  const LIMIT = STABILITY_LINEAR_LIMIT_RAD;
  if (Math.abs(alpha) <= LIMIT) return alpha;
  return (Math.sign(alpha) * LIMIT * Math.sin(Math.abs(alpha))) / Math.sin(LIMIT);
}

export function coefficients(i: AeroInput): AeroCoeffs {
  const alpha = wrapAngle(i.alpha);
  const k = CHORD / (2 * Math.max(i.speed, 1)); // JSBSim's ci2vel
  return {
    cl: liftCoefficientStatic(alpha) + CL_DE * i.de + k * (CL_ADOT * i.alphaDot + CL_Q * i.q),
    cd: dragCoefficientStatic(alpha) + CD_DE * Math.abs(i.de),
    cm: CM0 + CM_ALPHA * stabilityAlpha(alpha) + k * (CM_Q * i.q + CM_ADOT * i.alphaDot) + CM_DE * i.de * i.tailQRatio,
  };
}
