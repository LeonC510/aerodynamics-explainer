/** Thrust from the engine and propeller, for both thrust modes. */
import { CALIBRATION, CP_J, CT_J, IDLE_RPM, MAX_HP, MAX_RPM, PROP_DIAMETER_FT } from './aircraft';
import { powerFactor } from './atmosphere';
import { interp1 } from './table';

export interface ThrustResult {
  thrustLbf: number;
  /** Propeller speed; null in constant-thrust mode, which has no propeller model. */
  rpm: number | null;
  /** Extra air velocity the propeller adds at its disc, ft/s (momentum theory). */
  inducedVelocityFps: number;
}

const FT_LBF_PER_S_PER_HP = 550;
const DISC_AREA = (Math.PI * PROP_DIAMETER_FT ** 2) / 4;

function inducedVelocity(thrustLbf: number, speed: number, rho: number): number {
  if (thrustLbf <= 0) return 0;
  return 0.5 * (-speed + Math.sqrt(speed * speed + (2 * thrustLbf) / (rho * DISC_AREA)));
}

/**
 * Propeller speed (rev/s) at which the engine's available power equals the power
 * the propeller absorbs. Quasi-steady: the propeller is assumed to reach this speed
 * instantly (JSBSim integrates it as a spinning mass; the tables and limits are the source's).
 */
function balancedRevsPerSecond(throttle: number, speed: number, rho: number): number {
  const D = PROP_DIAMETER_FT;
  const nMin = IDLE_RPM / 60;
  const nMax = MAX_RPM / 60;
  // Engine power is taken as proportional to rpm at a given throttle.
  const surplus = (n: number): number => {
    const available = throttle * MAX_HP * FT_LBF_PER_S_PER_HP * (n / nMax) * powerFactor(rho);
    const absorbed = interp1(CP_J, speed / (n * D)) * rho * n ** 3 * D ** 5;
    return available - absorbed;
  };
  if (surplus(nMax) >= 0) return nMax; // rpm limit reached
  if (surplus(nMin) <= 0) return nMin;
  let lo = nMin;
  let hi = nMax;
  for (let i = 0; i < 40; i++) {
    const mid = 0.5 * (lo + hi);
    if (surplus(mid) > 0) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/**
 * @param throttle 0..1 (clamped)
 * @param axialSpeedFps airspeed along the nose axis, ft/s
 * @param rho air density, slug/ft³
 * @param thrustFallsWithSpeed false: idealised constant thrust; true: fixed-pitch propeller
 */
export function thrust(
  throttle: number,
  axialSpeedFps: number,
  rho: number,
  thrustFallsWithSpeed: boolean,
): ThrustResult {
  const thr = Math.min(Math.max(throttle, 0), 1);
  const speed = Math.max(axialSpeedFps, 0);

  if (!thrustFallsWithSpeed) {
    const thrustLbf = thr * CALIBRATION.maxThrustLbf * powerFactor(rho);
    return { thrustLbf, rpm: null, inducedVelocityFps: inducedVelocity(thrustLbf, speed, rho) };
  }

  const D = PROP_DIAMETER_FT;
  const n = thr === 0 ? IDLE_RPM / 60 : balancedRevsPerSecond(thr, speed, rho);
  const thrustLbf = CALIBRATION.propThrustScale * interp1(CT_J, speed / (n * D)) * rho * n * n * D ** 4;
  return { thrustLbf, rpm: n * 60, inducedVelocityFps: inducedVelocity(thrustLbf, speed, rho) };
}
