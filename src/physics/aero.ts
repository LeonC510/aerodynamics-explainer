/** Aerodynamic coefficients of the whole aircraft as functions of the flight condition. */
import {
  CALIBRATION, CD0, CD_ALPHA, CD_DE, CL_SCALE_START_RAD, DRAG_BLEND_BELOW_STALL_RAD,
  IDLE_DRAG_FADE_THROTTLE, STALL_ALPHA_RAD, CHORD, CL_ADOT, CL_ALPHA, CL_DE, CL_Q, CM0, CM_ADOT, CM_ALPHA, CM_DE, CM_Q,
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

/**
 * Handbook calibration of the lift peak: 1 in cruise, rising linearly to
 * CALIBRATION.clMaxScale at the stall angle and staying there beyond it.
 */
function liftScale(alpha: number): number {
  const t = (alpha - CL_SCALE_START_RAD) / (STALL_ALPHA_RAD - CL_SCALE_START_RAD);
  return 1 + (CALIBRATION.clMaxScale - 1) * Math.min(Math.max(t, 0), 1);
}

/** Lift coefficient from angle of attack alone (rad). */
export function liftCoefficientStatic(alphaIn: number): number {
  const alpha = wrapAngle(alphaIn);
  const hi = CL_ALPHA[CL_ALPHA.length - 1][0];
  const scale = alpha <= hi + POST_STALL_BLEND_RAD ? liftScale(Math.min(alpha, hi)) : 1;
  // Past the blend region the flat-plate model applies unscaled; inside it, scale the table part.
  if (alpha > hi && alpha < hi + POST_STALL_BLEND_RAD) {
    const w = (alpha - hi) / POST_STALL_BLEND_RAD;
    return (1 - w) * CL_ALPHA[CL_ALPHA.length - 1][1] * scale + w * flatPlateLift(alpha);
  }
  return extended(CL_ALPHA, 0, flatPlateLift, alpha) * scale;
}

/** Drag for a given angle of attack and the static lift coefficient at that angle. */
function dragFromLift(alpha: number, cl: number): number {
  const source = extended(CD_ALPHA, CD0, flatPlateDrag, alpha);
  if (alpha < CD_ALPHA[0][0] || alpha >= STALL_ALPHA_RAD) return source;
  const polar = CALIBRATION.cd0 + CALIBRATION.kInduced * cl * cl;
  const blendStart = STALL_ALPHA_RAD - DRAG_BLEND_BELOW_STALL_RAD;
  if (alpha <= blendStart) return polar;
  const w = (alpha - blendStart) / DRAG_BLEND_BELOW_STALL_RAD;
  return (1 - w) * polar + w * source;
}

/**
 * Drag coefficient from angle of attack alone (rad).
 * Below the stall: the handbook-calibrated polar CD = cd0 + kInduced·CL².
 * Around and beyond the stall: the source table, then the flat-plate extension.
 */
export function dragCoefficientStatic(alphaIn: number): number {
  const alpha = wrapAngle(alphaIn);
  return dragFromLift(alpha, liftCoefficientStatic(alpha));
}

/** The parts of lift and drag that depend on angle of attack only. */
export interface StaticCoeffs {
  cl: number;
  cd: number;
}

export function staticCoefficients(alphaIn: number): StaticCoeffs {
  const alpha = wrapAngle(alphaIn);
  const cl = liftCoefficientStatic(alpha);
  return { cl, cd: dragFromLift(alpha, cl) };
}

/** Extra drag coefficient from a windmilling propeller: full at idle, zero by 10% throttle. */
export function idlePropellerDragCoefficient(throttle: number): number {
  const t = Math.min(Math.max(throttle, 0), 1);
  return CALIBRATION.idlePropDragCd * Math.max(0, 1 - t / IDLE_DRAG_FADE_THROTTLE);
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
  /** 0..1; adds windmilling-propeller drag near idle. Omitted: no idle drag. */
  throttle?: number;
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

/**
 * Full coefficients for a flight condition. `st` may be passed to reuse the
 * angle-of-attack-only parts when evaluating the same alpha more than once.
 */
export function coefficients(i: AeroInput, st: StaticCoeffs = staticCoefficients(i.alpha)): AeroCoeffs {
  const alpha = wrapAngle(i.alpha);
  const k = CHORD / (2 * Math.max(i.speed, 1)); // JSBSim's ci2vel
  return {
    cl: st.cl + CL_DE * i.de + k * (CL_ADOT * i.alphaDot + CL_Q * i.q),
    cd: st.cd + CD_DE * Math.abs(i.de) + idlePropellerDragCoefficient(i.throttle ?? 1),
    cm: CM0 + CM_ALPHA * stabilityAlpha(alpha) + k * (CM_Q * i.q + CM_ADOT * i.alphaDot) + CM_DE * i.de * i.tailQRatio,
  };
}
