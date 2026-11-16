/**
 * ATMOSPHERE CONFIGURATION. Standard-atmosphere constants (not aircraft-specific).
 */
/** Sea-level standard air density, slug/ft³. */
export const RHO0 = 0.0023769;
/** Sea-level standard temperature, °R. */
export const SEA_LEVEL_TEMP_R = 518.67;
/** Temperature lapse rate in the troposphere, °R per ft. */
export const LAPSE_RATE_R_PER_FT = 0.00356616;
/** Exponent relating density ratio to temperature ratio in the troposphere. */
export const DENSITY_EXPONENT = 4.2561;
/**
 * NOT FROM SOURCE: Gagg–Ferrar relation for normally aspirated piston engines,
 * power fraction = A·(rho/RHO0) − B. (JSBSim models manifold pressure in detail instead.)
 */
export const POWER_FACTOR_A = 1.132;
export const POWER_FACTOR_B = 0.132;
