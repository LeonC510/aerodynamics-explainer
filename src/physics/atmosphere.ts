import {
  DENSITY_EXPONENT, LAPSE_RATE_R_PER_FT, POWER_FACTOR_A, POWER_FACTOR_B, RHO0, SEA_LEVEL_TEMP_R,
} from '../config/atmosphere';

export { RHO0 };

/**
 * Air density in slug/ft³. With altitude effects off the air is sea-level standard everywhere.
 * With them on: International Standard Atmosphere, troposphere.
 */
export function density(altitudeFt: number, altitudeEffects: boolean): number {
  if (!altitudeEffects) return RHO0;
  const T = Math.max(SEA_LEVEL_TEMP_R - LAPSE_RATE_R_PER_FT * Math.max(altitudeFt, 0), 1);
  return RHO0 * Math.pow(T / SEA_LEVEL_TEMP_R, DENSITY_EXPONENT);
}

/** Fraction of sea-level engine power available at density rho (Gagg–Ferrar). */
export function powerFactor(rho: number): number {
  return Math.max(POWER_FACTOR_A * (rho / RHO0) - POWER_FACTOR_B, 0);
}
