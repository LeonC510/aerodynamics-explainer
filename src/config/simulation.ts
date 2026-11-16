/**
 * SIMULATION CONFIGURATION: time stepping, starting condition, and forecast settings.
 */
/** Physics time step, s. Fixed; faster playback takes more steps, never bigger ones. */
export const DT = 1 / 120;
/** A history sample is recorded every this many physics steps (120 / 4 = 30 per second). */
export const SAMPLE_EVERY = 4;
/** Starting altitude above sea level, ft. The ground is at 0 ft. */
export const START_ALTITUDE_FT = 3000;
/** Starting indicated airspeed, kt, in steady level flight. */
export const START_SPEED_KT = 100;
/**
 * Most simulated time one animation frame may cover, per 1× of playback speed, s.
 * Stops a long pause (a backgrounded tab) from freezing the page while it catches up.
 */
export const MAX_SIM_SECONDS_PER_ADVANCE = 2;
/** Control changes of the same kind closer together than this merge into one graph marker, s. */
export const MARKER_MERGE_S = 0.5;
/** Playback speed multipliers offered in the control panel. */
export const PLAYBACK_SPEEDS = [1, 2, 4, 8, 16, 32] as const;

// --- Forecast ---
/** Longest forecast, simulated s; used when flight never settles. */
export const FORECAST_MAX_S = 600;
/**
 * Time step used by the forecast, s. Coarser than DT so a forecast can be recomputed while
 * a slider is being dragged; fourth-order integration gives the same path to within a
 * fraction of a foot (checked by a test against the live simulation).
 */
export const FORECAST_DT = 1 / 30;
/** Spacing of forecast samples, s. A whole multiple of FORECAST_DT. */
export const FORECAST_SAMPLE_S = 0.2;
/** Flight counts as stabilised when it has varied less than the limits below for this long, s. */
export const STABLE_WINDOW_S = 10;
/** Largest airspeed variation (max − min) within the window, kt. */
export const STABLE_IAS_KT = 0.5;
/** Largest climb-rate variation (max − min) within the window, ft/min. */
export const STABLE_CLIMB_FPM = 20;

// --- Memory guard ---
/**
 * Approximate memory one history sample occupies, bytes. Measured in Node
 * (1,080,001 samples used about 322 bytes each); browsers are similar.
 */
export const HISTORY_BYTES_PER_SAMPLE = 320;
/** The run pauses itself each time the flight history grows by this much, bytes (500 MB). */
export const MEMORY_PAUSE_EVERY_BYTES = 500 * 1024 * 1024;
/** Every this-many pauses (so every 1 GB), the pause also asks for a reset. */
export const MEMORY_RESET_EVERY_PAUSES = 2;
