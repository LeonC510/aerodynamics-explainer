/**
 * AIRCRAFT CONFIGURATION: Cessna 172P.
 *
 * Every number that describes the aircraft lives in this file; the physics code
 * in src/physics/ contains equations only. Values are copied from the JSBSim files
 * in reference/jsbsim/ unless marked "NOT FROM SOURCE".
 * Units: feet, slugs, pounds-force, radians (locations in inches, as in the source).
 */
import type { Table1D } from '../physics/table';

export const G = 32.174; // ft/s²

// --- Geometry: c172p.xml <metrics> ---
export const WING_AREA = 174; // <wingarea> ft²
export const CHORD = 4.9; // <chord> ft
export const AERO_REF_IN = { x: 43.2, z: 59.4 }; // <location name="AERORP">

// --- Propulsion ---
export const PROP_IN = { x: -37.7, z: 26.6 }; // c172p.xml <thruster><location>
export const PROP_DIAMETER_FT = 75 / 12; // prop_75in2f.xml <diameter>
export const MAX_HP = 160; // eng_io320.xml <maxhp>
export const MAX_RPM = 2700; // eng_io320.xml <maxrpm>

// --- Elevator travel: c172p.xml <aerosurface_scale name="Elevator Control"> ---
// Positive deflection is trailing edge down (nose down).
export const ELEVATOR_MIN_RAD = (-28 * Math.PI) / 180; // full back yoke
export const ELEVATOR_MAX_RAD = (23 * Math.PI) / 180; // full forward yoke

// --- Lift: c172p.xml aero/coefficient/CLwbh, column aero/stall-hyst-norm = 0 ---
// The source's second column (stall hysteresis) is not modelled in this version.
export const CL_ALPHA: Table1D = [
  [-0.09, -0.22], [0.0, 0.25], [0.09, 0.73], [0.1, 0.83], [0.12, 0.92], [0.14, 1.02],
  [0.16, 1.08], [0.17, 1.13], [0.19, 1.19], [0.21, 1.25], [0.24, 1.35], [0.26, 1.44],
  [0.28, 1.47], [0.3, 1.43], [0.32, 1.38], [0.34, 1.3], [0.36, 1.15],
];
/** Angle of attack of peak lift in CL_ALPHA. */
export const STALL_ALPHA_RAD = 0.28;

// --- Drag: c172p.xml aero/coefficient/CDwbh, flap column 0 ---
export const CD_ALPHA: Table1D = [
  [-0.0873, 0.0041], [-0.0698, 0.0013], [-0.0524, 0.0001], [-0.0349, 0.0003],
  [-0.0175, 0.002], [0.0, 0.0052], [0.0175, 0.0099], [0.0349, 0.0162], [0.0524, 0.024],
  [0.0698, 0.0334], [0.0873, 0.0442], [0.1047, 0.0566], [0.1222, 0.0706], [0.1396, 0.086],
  [0.1571, 0.0962], [0.1745, 0.1069], [0.192, 0.118], [0.2094, 0.1298], [0.2269, 0.1424],
  [0.2443, 0.1565], [0.2618, 0.1727], [0.2793, 0.1782], [0.2967, 0.1716], [0.3142, 0.1618],
  [0.3316, 0.1475], [0.3491, 0.1097],
];

// --- Coefficients: c172p.xml <aerodynamics> ---
export const CD0 = 0.027; // CDo
export const CD_DE = 0.06; // CDDe, per rad of |elevator|
export const CL_DE = 0.43; // CLDe
export const CL_ADOT = 1.7; // CLadot
export const CL_Q = 3.9; // CLq
export const CM0 = 0.1; // Cmo
export const CM_ALPHA = -1.8; // Cmalpha
export const CM_Q = -12.4; // Cmq
export const CM_ADOT = -7.27; // Cmadot
export const CM_DE = -1.122; // Cmde

// --- Propeller: prop_75in2f.xml, the active (uncommented) tables, against advance ratio J ---
export const CT_J: Table1D = [
  [0.0, 0.073], [0.1, 0.073], [0.2, 0.072], [0.3, 0.071], [0.4, 0.069], [0.5, 0.066],
  [0.6, 0.062], [0.7, 0.055], [0.8, 0.045], [0.9, 0.034], [1.0, 0.024], [1.1, 0.013],
  [1.2, -0.006], [1.3, -0.013], [1.4, -0.024], [1.5, -0.034], [1.6, -0.045], [1.7, -0.055],
  [1.8, -0.062], [1.9, -0.066], [2.0, -0.069], [2.1, -0.071], [2.2, -0.072], [2.3, -0.073],
  [5.0, -0.073],
];
export const CP_J: Table1D = [
  [0.0, 0.066], [0.1, 0.07], [0.2, 0.07], [0.3, 0.066], [0.4, 0.06], [0.5, 0.053],
  [0.6, 0.0501], [0.7, 0.0469], [0.8, 0.0426], [0.9, 0.036], [1.0, 0.0282], [1.1, 0.0191],
  [1.2, 0.0155], [1.3, 0.0191], [1.4, 0.0282], [1.5, 0.036], [1.6, 0.0426], [1.7, 0.0469],
  [1.8, 0.0501], [1.9, 0.0516], [2.0, 0.0525], [2.1, 0.0525], [2.2, 0.0522], [2.3, 0.0511],
  [2.4, 0.0504], [5.0, 0.0493],
];

// --- Mass ---
export interface MassProps {
  weightLbf: number;
  massSlug: number;
  /** Pitch moment of inertia about the loaded centre of gravity, slug·ft². */
  iyy: number;
  cgIn: { x: number; z: number };
}

export const EMPTY_IYY = 1346; // c172p.xml <mass_balance><iyy>, about the empty CG

/**
 * NOT FROM SOURCE: the choice of loading that brings the aircraft to the 172P's
 * 2400 lb maximum weight. Positions are the source's point-mass and tank locations.
 */
export const LOADING: readonly { name: string; weightLbf: number; x: number; z: number }[] = [
  { name: 'Empty aircraft', weightLbf: 1500, x: 41, z: 36.5 }, // <emptywt>, <location name="CG">
  { name: 'Pilot', weightLbf: 180, x: 36, z: 24 },
  { name: 'Co-pilot', weightLbf: 180, x: 36, z: 24 },
  { name: 'Left tank (full)', weightLbf: 185, x: 56, z: 59.4 },
  { name: 'Right tank (full)', weightLbf: 185, x: 56, z: 59.4 },
  { name: 'Left rear passenger', weightLbf: 85, x: 70, z: 24 },
  { name: 'Right rear passenger', weightLbf: 85, x: 70, z: 24 },
];

// --- Post-stall extension ---
// NOT FROM SOURCE: the source tables end near ±20°. Beyond them the wing is modelled
// as a flat plate: CL = FLAT_PLATE_CL·sin(2α), CD = CD0 + FLAT_PLATE_CD·sin²α,
// blended in linearly over POST_STALL_BLEND_RAD past each table end.
export const FLAT_PLATE_CL = 1.1;
export const FLAT_PLATE_CD = 2.0;
export const POST_STALL_BLEND_RAD = 0.15;
/**
 * NOT FROM SOURCE: beyond this angle of attack the static-stability term follows a sine,
 * so the restoring moment stays continuous if the aircraft tumbles through ±180°.
 */
export const STABILITY_LINEAR_LIMIT_RAD = 0.5;

/** Engine idle speed, rpm. eng_io320.xml <idlerpm>. Lower bound of the propeller-speed solve. */
export const IDLE_RPM = 550;

/**
 * HANDBOOK CALIBRATION.
 * NOT FROM SOURCE: Leon's priority is to match the Cessna 172P handbook. The unmodified
 * JSBSim drag table and lift peak give a climb rate about 120 ft/min low and a stall speed
 * about 3.5 kt high, so these values are fitted (scripts/calibrate.ts) to the handbook
 * figures in HANDBOOK below. Geometry, mass, the lift curve in cruise, and all
 * stability coefficients remain the source's.
 */
export const CALIBRATION = {
  /** Zero-lift drag coefficient of the airframe. Target: maximum level speed. */
  cd0: 0.03,
  /** Induced-drag factor: CD = cd0 + kInduced·CL² below the stall. Target: best climb rate and speed. */
  kInduced: 0.0508,
  /** Multiplier on the lift table at the stall angle, fading to 1 at CL_SCALE_START_RAD. Target: stall speed. */
  clMaxScale: 1.1359,
  /** Multiplier on fixed-pitch propeller thrust. Target: best climb rate and maximum level speed. */
  propThrustScale: 1.0128,
  /** Extra drag coefficient of a windmilling propeller at idle. Target: power-off glide ratio in constant-thrust mode. */
  idlePropDragCd: 0.0219,
  /**
   * Full-throttle thrust in constant-thrust mode, lbf. Target: the best climb rate at
   * full throttle equals the handbook's.
   */
  maxThrustLbf: 393,
};
/** Angle of attack above which clMaxScale starts to apply (end of the lift table's straight part). */
export const CL_SCALE_START_RAD = 0.09;
/** Calibrated drag blends back to the source table over this range just below the stall angle. */
export const DRAG_BLEND_BELOW_STALL_RAD = 0.05;
/** Windmilling-propeller drag fades linearly to zero by this throttle setting. */
export const IDLE_DRAG_FADE_THROTTLE = 0.1;

/**
 * Cessna 172P handbook performance at sea level, 2400 lb.
 * Maximum speed, climb rate and stall speed confirmed against a published 172P
 * specification listing; best-climb speed, best-glide speed and glide ratio are
 * from memory of the handbook and not independently confirmed.
 */
export const HANDBOOK = {
  stallKcas: 51,
  bestClimbFpm: 700,
  bestClimbKias: 76,
  maxLevelKt: 123,
  bestGlideKias: 65,
  glideRatio: 9,
};
