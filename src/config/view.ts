/**
 * VIEW CONFIGURATION: how the trajectory and graphs are scaled and drawn.
 */
// --- Trajectory: vertical axis ---
/**
 * The altitude axis never spans less than this, ft. It stops a nearly flat flight from
 * being magnified into dramatic-looking waves, while a real oscillation still fills the view.
 */
export const MIN_VERTICAL_SPAN_FT = 200;
/** Empty margin above and below the path, as a fraction of the span. */
export const VERTICAL_MARGIN = 0.15;
/** If the bottom of the range is within this fraction of the range from the ground, show the ground. */
export const GROUND_SNAP = 0.25;
/** Fraction of the remaining gap the displayed axis range closes each frame (smooths rescaling). */
export const RANGE_EASING = 0.12;

// --- Trajectory: horizontal axis ---
/** The distance axis never spans less than this, ft (1 nautical mile). */
export const TRAJ_MIN_SPAN_FT = 6076;
/**
 * Compression limit, px per ft: 40 px per oscillation wavelength (3934 ft at 100 kt).
 * Past this the view stops compressing and scrolls sideways.
 */
export const TRAJ_MIN_PX_PER_FT = 40 / 3934;

// --- Graphs: time axis ---
/** The time axis never spans less than this, s. */
export const GRAPH_MIN_SPAN_S = 60;
/** Compression limit, px per s: 40 px per oscillation period (23.3 s at 100 kt). */
export const GRAPH_MIN_PX_PER_S = 40 / 23.3;
/** Height of one graph band, px. */
export const GRAPH_BAND_HEIGHT_PX = 112;

// --- Drawing ---
/** At most this many path points are drawn per horizontal pixel. */
export const MAX_POINTS_PER_PX = 2;
/** Length of the aircraft icon on the trajectory, px (deliberately larger than life). */
export const AIRCRAFT_ICON_PX = 46;
/** Size of the true-angle close-up panel, px. */
export const CLOSEUP_SIZE_PX = { w: 150, h: 104 };
/** A scroll position within this many px of the right end counts as "following the aircraft". */
export const PIN_TOLERANCE_PX = 2;

// --- Fine-adjust buttons beside the pitch and throttle sliders ---
/** Elevator change per press of a pitch fine-adjust button, degrees. */
export const FINE_STEP_ELEVATOR_DEG = 0.1;
/** Throttle change per press of a throttle fine-adjust button, percent. */
export const FINE_STEP_THROTTLE_PCT = 0.5;
/** Holding a fine-adjust button repeats it: first after this delay, ms... */
export const FINE_REPEAT_DELAY_MS = 350;
/** ...then at this interval, ms. */
export const FINE_REPEAT_INTERVAL_MS = 70;
