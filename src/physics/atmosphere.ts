/** Sea-level standard air density, slug/ft³. */
export const RHO0 = 0.0023769;

/**
 * Air density in slug/ft³. With altitude effects off the air is sea-level standard everywhere.
 * With them on: International Standard Atmosphere, troposphere.
 */
export function density(altitudeFt: number, altitudeEffects: boolean): number {
  if (!altitudeEffects) return RHO0;
  const T0 = 518.67; // °R
  const T = Math.max(T0 - 0.00356616 * Math.max(altitudeFt, 0), 1);
  return RHO0 * Math.pow(T / T0, 4.2561);
}

/**
 * Fraction of sea-level engine power available at density rho.
 * NOT FROM SOURCE: Gagg–Ferrar relation for normally aspirated piston engines
 * (JSBSim models manifold pressure in detail instead).
 */
export function powerFactor(rho: number): number {
  return Math.max(1.132 * (rho / RHO0) - 0.132, 0);
}
