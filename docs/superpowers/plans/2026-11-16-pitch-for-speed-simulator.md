# Pitch-for-Speed Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static web page that simulates a Cessna 172P in two dimensions with a set-and-forget yoke and throttle, showing the trajectory (with forecast) and eight diagnostic graphs.

**Architecture:** A pure TypeScript physics module (`src/physics/`) computes forces, moments, and state derivatives from JSBSim `c172p` data. A simulation layer (`src/sim/`) steps it, records history, and produces forecasts. A UI layer (`src/ui/`) draws to canvas and owns DOM controls. Dependencies point one way: `ui → sim → physics`.

**Tech Stack:** TypeScript, Vite (vanilla-ts template), Vitest, Canvas 2D. No runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-11-16-pitch-for-speed-simulator-design.md`

## Global Constraints

- `src/physics/**` imports nothing from `src/sim`, `src/ui`, or browser APIs. `src/sim/**` imports nothing from `src/ui` or browser APIs.
- No plain `.js` source files; TypeScript `strict: true`.
- Internal units are JSBSim's: feet, seconds, slugs, pounds-force, radians. Conversion to knots, ft/min, and degrees happens only in `src/units.ts` callers at the display edge.
- Every aerodynamic, mass, and propulsion constant carries a comment citing its JSBSim file and element (for example `// c172p.xml <metrics><wingarea>`). Anything not from JSBSim is commented `// NOT FROM SOURCE:` with its reason.
- Leon's priority (2026-11-16): match the 172P handbook. Geometry, mass, lift curve, and stability coefficients stay as in JSBSim; drag and propeller thrust are calibrated to handbook performance in Task 6. Every calibrated value is commented `// NOT FROM SOURCE: calibrated to 172P handbook` with the target it serves.
- Climb rate, airspeed, and every graphed value come from the integrated state or from quantities computed by `derivatives()`. No performance tables or closed-form shortcuts.
- Sign conventions: `vz` and `h` positive up; pitch `theta` and moment positive nose-up; elevator `de` positive trailing-edge down (JSBSim convention, range −28° to +23°); yoke `+1` = full back = `de = −28°`.
- Source copies of the JSBSim files are downloaded from `https://raw.githubusercontent.com/JSBSim-Team/jsbsim/master/` (`aircraft/c172p/c172p.xml`, `engine/eng_io320.xml`, `engine/prop_75in2f.xml`) into `reference/jsbsim/` with a `reference/jsbsim/README.md` noting the URL, date, and LGPL licence.
- Commit after every task. Commit messages end with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.

## Handbook calibration (read before Task 6)

The unmodified `c172p` drag table is draggier at low speed than the 172P handbook (hand estimate: about 500 ft/min best climb instead of 700). Leon chose handbook fidelity over source purity. Task 6 calibrates, in this priority order: best climb rate and its speed, maximum level speed, stall speed, power-off glide ratio. The handbook's best-glide speed is known to conflict with the others under one drag polar; it is reported, not forced. Confirm the handbook figures from a published 172P handbook before calibrating; the plan's numbers are from memory.

## Review Focus

1. **Extreme attitudes:** full-back yoke at idle, or any deep stall, drives angle of attack outside the tables and airspeed toward zero. State must stay finite (no `NaN`) until ground contact. Test in Task 5.
2. **Backgrounded tab:** returning after minutes hidden yields a huge frame time. The runner must cap simulated time per frame instead of freezing while it catches up. Test in Task 7.
3. **Slider dragging with forecast on:** each input event recomputes the forecast. One forecast must cost well under a frame. Test in Task 8.
4. **Dive to the ground at 8×:** altitude range grows to thousands of feet and ends at 0. The vertical axis must switch from broken-axis to showing the ground, and the run must stop at ground contact with controls still responsive to Reset. Tests in Tasks 7 and 9.
5. **Long flights:** an hour at 8× produces over 100,000 samples. Drawing must not slow down as history grows. Test in Task 9 (decimation helper).

---

## File Structure

```
index.html                     page shell: left panel + right column
src/main.ts                    wires Simulation, controls, views, animation loop
src/style.css
src/units.ts                   unit conversions
src/physics/table.ts           1-D linear interpolation over [x, y] rows
src/physics/aircraft.ts        c172p constants, tables, loaded mass properties
src/physics/atmosphere.ts      density and engine power factor
src/physics/aero.ts            CL, CD, Cm coefficient functions
src/physics/propulsion.ts      thrust for both thrust modes, prop-induced velocity
src/physics/dynamics.ts        types, derivatives(), rk4Step()
src/physics/trim.ts            steady-state solver
src/sim/simulation.ts          runner: stepping, history, markers, status
src/sim/forecast.ts            run-ahead until stabilised
src/ui/scales.ts               pure view maths: vertical range, fit-then-scroll, decimation
src/ui/scroller.ts             scrollable canvas host with pin-to-end behaviour
src/ui/controls.ts             left panel DOM
src/ui/trajectoryView.ts       trajectory canvas, forecast, aircraft icon
src/ui/closeup.ts              true-angle aircraft inset
src/ui/graphs.ts               diagnostic graphs
tests/**                       mirrors src
reference/jsbsim/              downloaded source files
docs/validation.md             model vs handbook numbers (generated in Task 6)
```

---

### Task 1: Project scaffold, units, interpolation

**Files:**
- Create: Vite vanilla-ts scaffold at repo root, `vitest` dev dependency, `.gitignore`, `src/units.ts`, `src/physics/table.ts`, `tests/units.test.ts`, `tests/physics/table.test.ts`, `reference/jsbsim/*`

**Interfaces:**
- Produces:
  ```ts
  // src/units.ts
  export const KT_TO_FPS = 1.6878099; export const FT_PER_NM = 6076.115;
  export const ktToFps: (kt: number) => number; export const fpsToKt: (fps: number) => number;
  export const fpsToFpm: (fps: number) => number;
  export const degToRad: (d: number) => number; export const radToDeg: (r: number) => number;
  // src/physics/table.ts
  export type Table1D = readonly (readonly [number, number])[]; // rows sorted by x
  export function interp1(table: Table1D, x: number): number;   // linear; clamps to end values outside range
  ```

- [ ] **Step 1:** `git init`. Scaffold with `npm create vite@latest . -- --template vanilla-ts` (the folder already holds `docs/` and `.superpowers/`; keep them). Delete the template's demo files (`src/counter.ts`, `src/typescript.svg`, demo markup). `npm install -D vitest`. Add scripts `"test": "vitest run"` and `"typecheck": "tsc --noEmit"`. `.gitignore`: `node_modules`, `dist`, `.superpowers`, `.vercel`.
- [ ] **Step 2:** Download the three JSBSim files into `reference/jsbsim/` and write its README (see Global Constraints).
- [ ] **Step 3:** Write failing tests:
  ```ts
  expect(fpsToKt(ktToFps(100))).toBeCloseTo(100, 9);
  expect(ktToFps(100)).toBeCloseTo(168.781, 2);
  expect(fpsToFpm(10)).toBe(600);
  const t: Table1D = [[0, 0], [1, 10], [3, 30]];
  expect(interp1(t, 0.5)).toBeCloseTo(5); expect(interp1(t, 2)).toBeCloseTo(20);
  expect(interp1(t, -5)).toBe(0); expect(interp1(t, 99)).toBe(30);
  ```
- [ ] **Step 4:** Run `npm test`; expect failures for missing modules.
- [ ] **Step 5:** Implement `src/units.ts` and `src/physics/table.ts`.
- [ ] **Step 6:** Run `npm test && npm run typecheck && npm run build`; all pass.
- [ ] **Step 7:** Commit `chore: scaffold project with units and interpolation`.

---

### Task 2: Aircraft data, mass properties, atmosphere

**Files:**
- Create: `src/physics/aircraft.ts`, `src/physics/atmosphere.ts`, `tests/physics/aircraft.test.ts`, `tests/physics/atmosphere.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // aircraft.ts — values copied from reference/jsbsim/c172p.xml unless noted
  export const G = 32.174;
  export const WING_AREA = 174; export const CHORD = 4.9;              // <metrics>
  export const AERO_REF_IN = { x: 43.2, z: 59.4 };                      // <location name="AERORP">
  export const PROP_IN = { x: -37.7, z: 26.6 };                         // <thruster><location>
  export const PROP_DIAMETER_FT = 75 / 12;                              // prop_75in2f.xml
  export const MAX_HP = 160; export const MAX_RPM = 2700;               // eng_io320.xml
  export const ELEVATOR_MIN_RAD: number; // −28° (trailing edge up)
  export const ELEVATOR_MAX_RAD: number; // +23°
  export const CL_ALPHA: Table1D;   // CLwbh, column aero/stall-hyst-norm = 0, 17 rows
  export const CD_ALPHA: Table1D;   // CDwbh, flap column 0, 26 rows
  export const CT_J: Table1D; export const CP_J: Table1D; // active (uncommented) C_THRUST / C_POWER tables
  export const CD0 = 0.027, CD_DE = 0.06, CL_DE = 0.43, CL_ADOT = 1.7, CL_Q = 3.9;
  export const CM0 = 0.1, CM_ALPHA = -1.8, CM_Q = -12.4, CM_ADOT = -7.27, CM_DE = -1.122;
  export const STALL_ALPHA_RAD = 0.28; // alpha of peak CL in CL_ALPHA
  export interface MassProps { weightLbf: number; massSlug: number; iyy: number; cgIn: { x: number; z: number } }
  export const MASS: MassProps;       // loaded to 2400 lb, computed at module load
  export const MAX_THRUST_LBF: number; // constant-thrust mode; placeholder 460 until Task 6 calibrates
  // atmosphere.ts
  export const RHO0 = 0.0023769;
  export function density(altitudeFt: number, altitudeEffects: boolean): number;
  export function powerFactor(rho: number): number; // Gagg–Ferrar: 1.132*(rho/RHO0) − 0.132, floored at 0
  ```

**Decisions:**
- Loading to reach the 172P's 2400 lb (NOT FROM SOURCE: chosen loading; positions are the source's point-mass and tank locations): empty 1500 lb at CG (41, 36.5) in; pilot 180 and co-pilot 180 at (36, 24); fuel 185 + 185 at (56, 59.4); rear passengers 85 + 85 at (70, 24).
- `iyy` = empty `1346` + Σ over all seven items of `mass × ((x−cgx)² + (z−cgz)²)` in feet, about the loaded CG.
- Stall hysteresis (the table's second column) is not modelled in version 1; note this in a comment.
- `density`: with effects off, return `RHO0`. With effects on, ISA troposphere: `T = 518.67 − 0.00356616·h`, `rho = RHO0·(T/518.67)^4.2561`.

- [ ] **Step 1:** Write failing tests:
  ```ts
  expect(MASS.weightLbf).toBe(2400);
  expect(MASS.cgIn.x).toBeCloseTo(44.62, 2); expect(MASS.cgIn.z).toBeCloseTo(37.27, 2);
  expect(MASS.iyy).toBeCloseTo(1449.4, 0);
  expect(CL_ALPHA.length).toBe(17); expect(interp1(CL_ALPHA, 0.28)).toBeCloseTo(1.47);
  expect(CD_ALPHA.length).toBe(26); expect(interp1(CD_ALPHA, 0)).toBeCloseTo(0.0052);
  expect(interp1(CT_J, 0)).toBeCloseTo(0.073); expect(interp1(CP_J, 0.7)).toBeCloseTo(0.0469);
  expect(density(3000, false)).toBe(RHO0);
  expect(density(0, true)).toBeCloseTo(RHO0, 9);
  expect(density(3000, true) / RHO0).toBeCloseTo(0.9151, 3);
  expect(powerFactor(RHO0)).toBeCloseTo(1); expect(powerFactor(0)).toBe(0);
  ```
- [ ] **Step 2:** Run; expect failure.
- [ ] **Step 3:** Implement both files, transcribing tables from `reference/jsbsim/`.
- [ ] **Step 4:** Run `npm test && npm run typecheck`; pass.
- [ ] **Step 5:** Commit `feat: c172p aircraft data and atmosphere`.

---

### Task 3: Aerodynamic coefficients

**Files:**
- Create: `src/physics/aero.ts`, `tests/physics/aero.test.ts`

**Interfaces:**
- Consumes: Task 2 constants, `interp1`.
- Produces:
  ```ts
  export function liftCoefficientStatic(alpha: number): number;  // table + post-stall extension
  export function dragCoefficientStatic(alpha: number): number;  // CD0 + table + extension (no elevator term)
  export interface AeroInput { alpha: number; alphaDot: number; q: number; de: number; speed: number; tailQRatio: number }
  export interface AeroCoeffs { cl: number; cd: number; cm: number }
  export function coefficients(i: AeroInput): AeroCoeffs;
  ```

**Decisions:**
- `k = CHORD / (2·max(speed, 1))` (JSBSim's `ci2vel`, guarded against zero speed).
- `cl = liftCoefficientStatic(alpha) + CL_DE·de + k·(CL_ADOT·alphaDot + CL_Q·q)`
- `cd = dragCoefficientStatic(alpha) + CD_DE·|de|`
- `cm = CM0 + CM_ALPHA·alpha + k·(CM_Q·q + CM_ADOT·alphaDot) + CM_DE·de·tailQRatio`. `tailQRatio` is tail dynamic pressure over free-stream; the caller passes `1` unless power-pitch coupling is on (JSBSim applies `qbar-induced` only to `Cmde`).
- Post-stall extension (NOT FROM SOURCE: flat-plate model, tables end near ±20°): wrap `alpha` to (−π, π]. Inside the table range use the table. Outside, flat-plate values `clFP = 1.1·sin(2α)`, `cdFP = CD0 + 2.0·sin²α`. Over the first 0.15 rad beyond each table end, blend linearly from the table's end value to the flat-plate value so both functions are continuous. In the extended region `CM_ALPHA·alpha` uses the wrapped alpha.

- [ ] **Step 1:** Write failing tests:
  ```ts
  expect(liftCoefficientStatic(0)).toBeCloseTo(0.25);
  expect(liftCoefficientStatic(0.28)).toBeCloseTo(1.47);
  expect(dragCoefficientStatic(0)).toBeCloseTo(0.027 + 0.0052);
  // continuity across both table ends and through the blend
  for (const a of [-0.09, -0.0873, 0.3491, 0.36, 0.51, -0.24])
    for (const f of [liftCoefficientStatic, dragCoefficientStatic])
      expect(Math.abs(f(a + 1e-4) - f(a - 1e-4))).toBeLessThan(0.01);
  // flat plate far beyond stall
  expect(liftCoefficientStatic(Math.PI / 2)).toBeCloseTo(0, 5);
  expect(dragCoefficientStatic(Math.PI / 2)).toBeCloseTo(2.027, 3);
  expect(Number.isFinite(coefficients({ alpha: 3, alphaDot: 0, q: 0, de: 0, speed: 0, tailQRatio: 1 }).cm)).toBe(true);
  // derivative terms
  const base = { alpha: 0.05, alphaDot: 0, q: 0, de: 0, speed: 170, tailQRatio: 1 };
  expect(coefficients({ ...base, de: 0.1 }).cm - coefficients(base).cm).toBeCloseTo(-0.1122);
  expect(coefficients({ ...base, de: 0.1, tailQRatio: 1.5 }).cm - coefficients(base).cm).toBeCloseTo(-0.1683);
  expect(coefficients({ ...base, q: 0.1 }).cm).toBeLessThan(coefficients(base).cm); // pitch damping
  expect(coefficients({ ...base, de: -0.1 }).cd - coefficients(base).cd).toBeCloseTo(0.006);
  ```
- [ ] **Step 2:** Run; expect failure. **Step 3:** Implement. **Step 4:** Run tests and typecheck; pass.
- [ ] **Step 5:** Commit `feat: aerodynamic coefficient model`.

---

### Task 4: Propulsion

**Files:**
- Create: `src/physics/propulsion.ts`, `tests/physics/propulsion.test.ts`

**Interfaces:**
- Consumes: Task 2 constants.
- Produces:
  ```ts
  export interface ThrustResult { thrustLbf: number; rpm: number | null; inducedVelocityFps: number }
  export function thrust(throttle: number, axialSpeedFps: number, rho: number, thrustFallsWithSpeed: boolean): ThrustResult;
  ```

**Decisions:**
- `throttle` is clamped to 0…1. `axialSpeedFps` is airspeed along the nose axis, floored at 0 for the propeller maths.
- **Constant-thrust mode** (`thrustFallsWithSpeed = false`): `thrustLbf = throttle · MAX_THRUST_LBF · powerFactor(rho)`; `rpm = null`. With altitude effects off the caller's `rho` is `RHO0`, so the factor is 1.
- **Fixed-pitch propeller mode:** quasi-steady RPM balance (NOT FROM SOURCE as a method: JSBSim integrates RPM dynamically; the tables and limits are the source's). With `n` in rev/s, `D = PROP_DIAMETER_FT`, `J = V/(n·D)`:
  - engine power available `= throttle · MAX_HP · 550 · (n / 45) · powerFactor(rho)` ft·lbf/s
  - propeller power absorbed `= CP_J(J) · rho · n³ · D⁵`
  - solve for `n` by bisection on `n ∈ [5, 45]` rev/s; if available power exceeds absorbed power at `n = 45`, use `n = 45` (the 2700 rpm limit).
  - `thrustLbf = CT_J(J) · rho · n² · D⁴` (may go negative at high speed and low throttle: windmilling drag; keep it). At `throttle = 0` skip the solve and use `n = 5`.
- `inducedVelocityFps` (momentum theory, as JSBSim's `prop-induced-velocity`): with disc area `A = π·D²/4`, `Vi = 0.5·(−V + sqrt(V² + 2·T/(rho·A)))` for `T > 0`, else `0`.

- [ ] **Step 1:** Write failing tests:
  ```ts
  const R = RHO0;
  expect(thrust(0.5, 100, R, false).thrustLbf).toBeCloseTo(0.5 * MAX_THRUST_LBF);
  expect(thrust(0.5, 250, R, false).thrustLbf).toBeCloseTo(0.5 * MAX_THRUST_LBF); // speed-independent
  expect(thrust(1, 100, density(8000, true), false).thrustLbf).toBeLessThan(MAX_THRUST_LBF);
  const s = thrust(1, 0, R, true);                    // static, full throttle
  expect(s.rpm!).toBeGreaterThan(2000); expect(s.rpm!).toBeLessThan(2400);
  expect(s.thrustLbf).toBeGreaterThan(300); expect(s.thrustLbf).toBeLessThan(400);
  expect(thrust(1, 300, R, true).thrustLbf).toBeLessThan(thrust(1, 150, R, true).thrustLbf); // falls with speed
  expect(thrust(1, 300, R, true).rpm!).toBeLessThanOrEqual(2700);
  expect(thrust(0, 170, R, true).thrustLbf).toBeLessThanOrEqual(0); // idle prop does not push
  expect(thrust(0, 170, R, true).inducedVelocityFps).toBe(0);
  expect(s.inducedVelocityFps).toBeGreaterThan(0);
  expect(thrust(2, 100, R, false).thrustLbf).toBeCloseTo(MAX_THRUST_LBF); // clamped
  ```
- [ ] **Step 2:** Run; fail. **Step 3:** Implement. **Step 4:** Run tests and typecheck; pass.
- [ ] **Step 5:** Commit `feat: propulsion with constant-thrust and fixed-pitch modes`.

---

### Task 5: Equations of motion and integrator

**Files:**
- Create: `src/physics/dynamics.ts`, `tests/physics/dynamics.test.ts`

**Interfaces:**
- Consumes: `coefficients`, `thrust`, `density`, `MASS`, aircraft constants.
- Produces:
  ```ts
  export interface State { x: number; h: number; vx: number; vz: number; theta: number; q: number }
  export interface Controls { elevatorRad: number; throttle: number }
  export interface Settings { altitudeEffects: boolean; thrustFallsWithSpeed: boolean; powerPitchCoupling: boolean }
  export const DEFAULT_SETTINGS: Settings; // all false
  export interface Forces {
    speed: number; gamma: number; alpha: number; rho: number; iasFps: number; // iasFps = speed·sqrt(rho/RHO0)
    lift: number; drag: number; thrust: number; moment: number; rpm: number | null;
  }
  export interface Derivs { dx: number; dh: number; dvx: number; dvz: number; dtheta: number; dq: number }
  export function derivatives(s: State, c: Controls, set: Settings): { d: Derivs; f: Forces };
  export function rk4Step(s: State, c: Controls, set: Settings, dt: number): State;
  export function yokeToElevator(yoke: number): number; // +1 → ELEVATOR_MIN_RAD, −1 → ELEVATOR_MAX_RAD, 0 → 0, linear each side
  export function elevatorToYoke(de: number): number;   // inverse
  ```

**Algorithm for `derivatives` (order matters):**
1. `speed = hypot(vx, vz)`; `gamma = atan2(vz, vx)`; `alpha = wrap(theta − gamma)`; `rho = density(h, altitudeEffects)`; `qbar = ½·rho·speed²`.
2. `tr = thrust(throttle, speed·cos(alpha), rho, thrustFallsWithSpeed)`.
3. `tailQRatio = 1` unless `powerPitchCoupling`, then `((u + 2·Vi)/max(u,1))²` with `u = speed·cos(alpha)` floored at 1 and `Vi = tr.inducedVelocityFps` (JSBSim's `qbar-induced`, which adds the induced velocity twice).
4. First pass with `alphaDot = 0`: get `cl, cd`; `L = qbar·S·cl`, `D = qbar·S·cd`. Flight-path rate `gammaDot0 = (L + T·sin(alpha) − W·cos(gamma)) / (m·max(speed,1))`. Then `alphaDot = q − gammaDot0`.
5. Second pass: `coefficients` with that `alphaDot` gives final `cl, cd, cm`, hence `L, D`.
6. Accelerations: `dvx = (T·cos(theta) − D·cos(gamma) − L·sin(gamma))/m`; `dvz = (T·sin(theta) − D·sin(gamma) + L·cos(gamma))/m − G`.
7. Moment about the loaded CG, nose-up positive:
   - `M = qbar·S·CHORD·cm`
   - aerodynamic force transfer from `AERO_REF_IN` to `MASS.cgIn`: normal force `N = L·cos(alpha) + D·sin(alpha)`, axial force `A = D·cos(alpha) − L·sin(alpha)`; `M += −N·(xRef − xCg)/12 + A·(zRef − zCg)/12`. Always applied.
   - if `powerPitchCoupling`: `M += T·(zCg − zProp)/12` (thrust line below the CG pitches the nose up).
8. `dq = M / MASS.iyy`; `dx = vx`; `dh = vz`; `dtheta = q`.

- [ ] **Step 1:** Write failing tests:
  ```ts
  const level = (kt: number): State => ({ x: 0, h: 3000, vx: ktToFps(kt), vz: 0, theta: 0.04, q: 0 });
  const c: Controls = { elevatorRad: 0, throttle: 0.5 };
  const { d, f } = derivatives(level(100), c, DEFAULT_SETTINGS);
  expect(f.alpha).toBeCloseTo(0.04); expect(f.gamma).toBe(0);
  expect(f.iasFps).toBeCloseTo(f.speed);                      // sea-level density when effects off
  // Newton's second law holds exactly for the reported forces
  expect(d.dvz).toBeCloseTo((f.thrust * Math.sin(0.04) + f.lift) / MASS.massSlug - G, 9);
  expect(d.dvx).toBeCloseTo((f.thrust * Math.cos(0.04) - f.drag) / MASS.massSlug, 9);
  expect(d.dh).toBe(0); expect(d.dtheta).toBe(0);
  // climbing flight: angle of attack is pitch minus flight path
  const climb: State = { ...level(80), vz: 10, theta: 0.2 };
  expect(derivatives(climb, c, DEFAULT_SETTINGS).f.alpha).toBeCloseTo(0.2 - Math.atan2(10, ktToFps(80)));
  // up elevator pitches nose up; static stability restores
  expect(derivatives(level(100), { ...c, elevatorRad: -0.1 }, DEFAULT_SETTINGS).d.dq).toBeGreaterThan(d.dq);
  expect(derivatives({ ...level(100), theta: 0.14 }, c, DEFAULT_SETTINGS).d.dq).toBeLessThan(d.dq);
  // power-pitch coupling: more throttle gives more nose-up moment only when the setting is on
  const on = { ...DEFAULT_SETTINGS, powerPitchCoupling: true };
  const dqAt = (thr: number, set: Settings) => derivatives(level(100), { elevatorRad: -0.03, throttle: thr }, set).d.dq;
  expect(dqAt(1, DEFAULT_SETTINGS)).toBeCloseTo(dqAt(0.2, DEFAULT_SETTINGS), 9);
  expect(dqAt(1, on)).toBeGreaterThan(dqAt(0.2, on));
  // altitude effects thin the air
  expect(derivatives(level(100), c, { ...DEFAULT_SETTINGS, altitudeEffects: true }).f.lift).toBeLessThan(f.lift);
  // Review Focus 1: extreme inputs stay finite for 120 s or until h <= 0
  for (const ctl of [{ elevatorRad: ELEVATOR_MIN_RAD, throttle: 0 }, { elevatorRad: ELEVATOR_MAX_RAD, throttle: 1 },
                     { elevatorRad: ELEVATOR_MIN_RAD, throttle: 1 }])
    for (const set of [DEFAULT_SETTINGS, { altitudeEffects: true, thrustFallsWithSpeed: true, powerPitchCoupling: true }]) {
      let s = level(100);
      for (let i = 0; i < 120 * 120 && s.h > 0; i++) s = rk4Step(s, ctl, set, 1 / 120);
      expect(Object.values(s).every(Number.isFinite)).toBe(true);
    }
  expect(yokeToElevator(1)).toBeCloseTo(ELEVATOR_MIN_RAD); expect(yokeToElevator(-1)).toBeCloseTo(ELEVATOR_MAX_RAD);
  expect(elevatorToYoke(yokeToElevator(0.37))).toBeCloseTo(0.37);
  ```
- [ ] **Step 2:** Run; fail. **Step 3:** Implement `derivatives`, classic fourth-order `rk4Step`, and the yoke mapping. **Step 4:** Run tests and typecheck; pass.
- [ ] **Step 5:** Commit `feat: longitudinal equations of motion and RK4 integrator`.

---

### Task 6: Trim solver, thrust calibration, flight validation

**Files:**
- Create: `src/physics/trim.ts`, `tests/physics/trim.test.ts`, `tests/physics/validation.test.ts`, `docs/validation.md`
- Modify: `src/physics/aircraft.ts` (`MAX_THRUST_LBF`)

**Interfaces:**
- Consumes: `derivatives`, `rk4Step`.
- Produces:
  ```ts
  export type TrimTarget =
    | { speedFps: number; altitudeFt: number; gammaRad: number }   // solve throttle
    | { speedFps: number; altitudeFt: number; throttle: number };  // solve flight-path angle
  export interface TrimResult { state: State; controls: Controls; gammaRad: number }
  export function trim(target: TrimTarget, set: Settings): TrimResult | null; // null if no steady state within control limits
  ```
  `speedFps` is true airspeed. The solver finds pitch, elevator, and the third unknown such that `dvx = dvz = dq = 0` with `q = 0`; Newton iteration with a finite-difference Jacobian. Returns `null` when it fails to converge or the solution needs elevator or throttle outside its limits.

- [ ] **Step 1:** Write failing trim tests:
  ```ts
  const t = trim({ speedFps: ktToFps(100), altitudeFt: 3000, gammaRad: 0 }, DEFAULT_SETTINGS)!;
  const { d } = derivatives(t.state, t.controls, DEFAULT_SETTINGS);
  for (const v of [d.dvx, d.dvz, d.dq]) expect(Math.abs(v)).toBeLessThan(1e-6);
  expect(t.controls.throttle).toBeGreaterThan(0.2); expect(t.controls.throttle).toBeLessThan(0.9);
  // steady for 60 s
  let s = t.state; for (let i = 0; i < 7200; i++) s = rk4Step(s, t.controls, DEFAULT_SETTINGS, 1 / 120);
  expect(Math.abs(s.h - 3000)).toBeLessThan(1); expect(Math.abs(fpsToKt(Math.hypot(s.vx, s.vz)) - 100)).toBeLessThan(0.1);
  // impossible request
  expect(trim({ speedFps: ktToFps(100), altitudeFt: 3000, gammaRad: 0.5 }, DEFAULT_SETTINGS)).toBeNull();
  // works with every setting on
  expect(trim({ speedFps: ktToFps(100), altitudeFt: 3000, gammaRad: 0 },
    { altitudeEffects: true, thrustFallsWithSpeed: true, powerPitchCoupling: true })).not.toBeNull();
  ```
- [ ] **Step 2:** Run; fail. **Step 3:** Implement `trim`. **Step 4:** Run; pass.
- [ ] **Step 5: Calibrate constant thrust.** Add a test, then set `MAX_THRUST_LBF` in `aircraft.ts` to the value that satisfies it (expect roughly 450 to 470), with a comment `// NOT FROM SOURCE: calibrated so full-throttle climb at 76 kt, sea level, 2400 lb is 700 ft/min (172P handbook)`:
  ```ts
  const c = trim({ speedFps: ktToFps(76), altitudeFt: 0, throttle: 1 }, DEFAULT_SETTINGS)!;
  expect(fpsToFpm(c.state.vz)).toBeGreaterThan(690); expect(fpsToFpm(c.state.vz)).toBeLessThan(710);
  ```
- [ ] **Step 6: Calibrate to the handbook.** Confirm 172P handbook figures (sea level, 2400 lb): clean stall speed, best rate of climb and its speed, maximum level speed, best-glide speed and glide ratio. Then introduce calibration constants in `aircraft.ts` (each `// NOT FROM SOURCE: calibrated to 172P handbook`) and use them in `aero.ts` / `propulsion.ts`:
  - `CD0_CAL` and `K_INDUCED_CAL`: below the stall angle, drag is `CD0_CAL + K_INDUCED_CAL·CLstatic(α)²` instead of `CD0 + CD_ALPHA`; blend back to the source table's post-stall values over the last 0.05 rad before `STALL_ALPHA_RAD` so drag stays continuous. Update the Task 3 drag tests to the new values.
  - `PROP_THRUST_SCALE`: multiplier on propeller-mode thrust.
  - `IDLE_PROP_DRAG_CD`: extra drag coefficient applied when throttle is 0 (windmilling propeller), in both thrust modes, fading linearly to zero by throttle 0.1.
  - `CL_SCALE_CAL`: multiplier on the lift table only if stall speed is more than 5% from the handbook; otherwise leave at 1.
  Choose values by a small search script (kept in `scripts/calibrate.ts`, run with `npx tsx`) that minimises the relative errors in the priority order above. Re-run Step 5 afterwards so constant-thrust mode still climbs at the handbook rate.
- [ ] **Step 7: Write the validation tests** in `tests/physics/validation.test.ts`, as real assertions:
  ```ts
  // Physics properties (tight)
  // 1. Steady climb: lift + thrust·sin(alpha) equals weight·cos(gamma) to 3 decimals; lift < weight.
  // 2. Phugoid: from 100 kt level trim, elevator −1°, run 600 s: altitude oscillates with period 18–32 s,
  //    successive peak amplitudes shrink, and the last 30 s are steady (IAS range < 0.5 kt).
  // 3. The mantra, DEFAULT_SETTINGS, settle 600 s after each change from 100 kt level trim:
  //    a) elevator −1°, throttle unchanged → settled IAS lower by more than 3 kt.
  //    b) throttle +0.2 → settled IAS within 1.5 kt of 100; settled climb rate > +150 ft/min.
  //    c) throttle −0.2 → settled IAS within 1.5 kt of 100; settled climb rate < −150 ft/min.
  // Handbook targets (calibrated)
  // 4. Stall speed (lowest level-trim speed, sea level) within 5% of handbook.
  // 5. Fixed-pitch mode, full throttle, sea level: best climb rate within 5% of handbook, at a speed within 5 kt
  //    of handbook; maximum level speed within 5% of handbook.
  // 6. Power-off glide ratio within 10% of handbook. Best-glide speed: asserted only to be 55–90 kt.
  ```
  If a physics property fails, fix the model. If a handbook target cannot be met after calibration, keep the closest fit, loosen only that one bound to what was achieved, and state it in `docs/validation.md`.
- [ ] **Step 8:** Write `docs/validation.md`: model versus handbook for every figure above (both thrust modes for climb), phugoid period, the three mantra results, the list of calibrated constants with their values, and any residual mismatch.
- [ ] **Step 9:** Commit `feat: trim solver, thrust calibration, flight validation`.

---

### Task 7: Simulation runner

**Files:**
- Create: `src/sim/simulation.ts`, `tests/sim/simulation.test.ts`

**Interfaces:**
- Consumes: `trim`, `rk4Step`, `derivatives`, types.
- Produces:
  ```ts
  export const DT = 1 / 120; export const SAMPLE_EVERY = 4;        // history at 30 Hz
  export const START_ALTITUDE_FT = 3000; export const START_SPEED_KT = 100;
  export const MAX_SIM_SECONDS_PER_ADVANCE = 2;                    // Review Focus 2
  export interface Sample {                                         // display units
    t: number; x: number; h: number;                               // s, ft, ft
    thetaDeg: number; gammaDeg: number; alphaDeg: number;
    iasKt: number; iasRateKtPerS: number;
    thrustLbf: number; liftLbf: number; liftRateLbfPerS: number;
    climbFpm: number;
  }
  export function makeSample(t: number, s: State, f: Forces, prev: Sample | null): Sample; // rates by finite difference from prev; 0 when prev is null
  export interface Marker { t: number; kind: 'yoke' | 'throttle' | 'setting' }
  export type Status = 'paused' | 'running' | 'ground';
  export class Simulation {
    constructor(settings?: Settings);
    readonly status: Status; readonly time: number; readonly state: State;
    readonly controls: Controls; readonly settings: Settings;
    readonly history: readonly Sample[]; readonly markers: readonly Marker[];
    readonly latest: Sample;
    readonly revision: number;            // increments on any control or setting change and on reset
    playbackSpeed: 1 | 2 | 4 | 8;
    start(): void; pause(): void; reset(): void;
    setElevator(rad: number): void; setThrottle(x: number): void; setSettings(p: Partial<Settings>): void;
    advance(realSeconds: number): void;
  }
  ```

**Decisions:**
- Constructor and `reset()` trim for level flight at `START_SPEED_KT` indicated, `START_ALTITUDE_FT`, using the current settings (convert indicated to true airspeed with the current density). They set `controls` to the trim result, clear history and markers, record one sample at `t = 0`, and leave status `paused`. Settings survive `reset()`.
- `advance` does nothing unless `running`. It adds `realSeconds × playbackSpeed` to an accumulator, capped so one call simulates at most `MAX_SIM_SECONDS_PER_ADVANCE × playbackSpeed` seconds, and takes whole `DT` steps.
- Ground: when a step would end with `h ≤ 0`, set `h = 0`, record a final sample, set status `ground`, discard the accumulator. Only `reset()` leaves `ground`; `start()` is ignored.
- Setters clamp to limits, add a `Marker` at the current time (consecutive same-kind markers closer than 0.5 s apart replace the previous one, so a drag leaves one marker), and increment `revision`. They work in every status except `ground`.

- [ ] **Step 1:** Write failing tests:
  ```ts
  const sim = new Simulation();
  expect(sim.status).toBe('paused'); expect(sim.history.length).toBe(1);
  expect(sim.latest.h).toBeCloseTo(3000); expect(sim.latest.iasKt).toBeCloseTo(100, 1);
  expect(sim.controls.elevatorRad).not.toBe(0);                 // starts at trim, not centred
  sim.advance(1); expect(sim.time).toBe(0);                     // paused
  sim.start(); sim.advance(1);
  expect(sim.time).toBeCloseTo(1, 5); expect(sim.history.length).toBe(31);
  sim.playbackSpeed = 8; sim.advance(0.5); expect(sim.time).toBeCloseTo(5, 5);
  sim.advance(300); expect(sim.time).toBeCloseTo(5 + 16, 5);    // Review Focus 2: capped at 2 s × 8
  // undisturbed trim stays level
  expect(Math.abs(sim.latest.h - 3000)).toBeLessThan(1);
  // markers coalesce during a drag
  const r0 = sim.revision;
  sim.setThrottle(0.3); sim.setThrottle(0.31); sim.setThrottle(0.32);
  expect(sim.markers.filter(m => m.kind === 'throttle').length).toBe(1);
  expect(sim.revision).toBeGreaterThan(r0); expect(sim.controls.throttle).toBeCloseTo(0.32);
  sim.setThrottle(7); expect(sim.controls.throttle).toBe(1);
  // rates
  expect(makeSample(0, sim.state, derivatives(sim.state, sim.controls, sim.settings).f, null).iasRateKtPerS).toBe(0);
  // Review Focus 4: dive to the ground at 8×
  const dive = new Simulation(); dive.playbackSpeed = 8; dive.start();
  dive.setElevator(ELEVATOR_MAX_RAD); dive.setThrottle(1);
  for (let i = 0; i < 2000 && dive.status === 'running'; i++) dive.advance(0.1);
  expect(dive.status).toBe('ground'); expect(dive.latest.h).toBe(0);
  const tEnd = dive.time; dive.start(); dive.advance(1); expect(dive.time).toBe(tEnd);
  dive.setSettings({ thrustFallsWithSpeed: true });
  dive.reset();
  expect(dive.status).toBe('paused'); expect(dive.time).toBe(0); expect(dive.latest.h).toBeCloseTo(3000);
  expect(dive.settings.thrustFallsWithSpeed).toBe(true); expect(dive.markers.length).toBe(0);
  ```
- [ ] **Step 2:** Run; fail. **Step 3:** Implement. **Step 4:** Run tests and typecheck; pass.
- [ ] **Step 5:** Commit `feat: simulation runner with history, markers, ground contact`.

---

### Task 8: Forecast

**Files:**
- Create: `src/sim/forecast.ts`, `tests/sim/forecast.test.ts`

**Interfaces:**
- Consumes: `rk4Step`, `derivatives`, `makeSample`, `DT`.
- Produces:
  ```ts
  export const FORECAST_MAX_S = 600; export const FORECAST_SAMPLE_S = 0.25;
  export const STABLE_WINDOW_S = 10; export const STABLE_IAS_KT = 0.5; export const STABLE_CLIMB_FPM = 20;
  export interface Forecast { samples: Sample[]; end: 'stabilised' | 'ground' | 'timeout' }
  export function forecast(state: State, controls: Controls, settings: Settings, startTime: number): Forecast;
  ```
  Runs the same `rk4Step` at `DT` from `state`, sampling every `FORECAST_SAMPLE_S`. Ends `stabilised` at the first moment when, over the trailing `STABLE_WINDOW_S`, the range (max − min) of `iasKt` is below `STABLE_IAS_KT` and the range of `climbFpm` is below `STABLE_CLIMB_FPM`. Ends `ground` at `h ≤ 0`, `timeout` at `FORECAST_MAX_S`. The first sample is at `startTime`.

- [ ] **Step 1:** Write failing tests:
  ```ts
  const sim = new Simulation();
  const calm = forecast(sim.state, sim.controls, sim.settings, 0);
  expect(calm.end).toBe('stabilised');
  expect(calm.samples.at(-1)!.t).toBeCloseTo(STABLE_WINDOW_S, 0);           // already steady: ends after one window
  const pulled = forecast(sim.state, { ...sim.controls, elevatorRad: sim.controls.elevatorRad - degToRad(1) }, sim.settings, 0);
  expect(pulled.end).toBe('stabilised');
  expect(pulled.samples.at(-1)!.t).toBeGreaterThan(60);
  expect(pulled.samples.at(-1)!.iasKt).toBeLessThan(97);
  // forecast agrees with what the live simulation then does
  sim.setElevator(sim.controls.elevatorRad - degToRad(1)); sim.start();
  while (sim.time < 60) sim.advance(1 / 60);
  const at60 = pulled.samples.find(s => Math.abs(s.t - 60) < 1e-6)!;
  expect(at60.h).toBeCloseTo(sim.latest.h, 0); expect(at60.x).toBeCloseTo(sim.latest.x, 0);
  expect(forecast(sim.state, { elevatorRad: ELEVATOR_MAX_RAD, throttle: 1 }, sim.settings, 0).end).toBe('ground');
  // Review Focus 3: cheap enough to recompute while dragging
  const t0 = performance.now(); for (let i = 0; i < 5; i++) forecast(sim.state, sim.controls, sim.settings, 0);
  expect((performance.now() - t0) / 5).toBeLessThan(25);   // worst case is the 600 s timeout path; test that too
  ```
  Add a timeout-path timing case (full back yoke, idle, from 30,000 ft start state built by hand) with the same 25 ms bound.
- [ ] **Step 2:** Run; fail. **Step 3:** Implement. If the timing bound fails, the fix is to avoid per-step allocation in `rk4Step`/`derivatives` on this path, not to raise the bound or coarsen `DT`.
- [ ] **Step 4:** Run tests and typecheck; pass.
- [ ] **Step 5:** Commit `feat: trajectory forecast to stabilisation`.

---

### Task 9: View maths

**Files:**
- Create: `src/ui/scales.ts`, `tests/ui/scales.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const MIN_VERTICAL_SPAN_FT = 200; export const VERTICAL_MARGIN = 0.15;
  export const GROUND_SNAP = 0.25;
  export interface VerticalRange { lo: number; hi: number; brokenAxis: boolean }
  export function verticalRange(minH: number, maxH: number): VerticalRange;
  export interface FitScroll { pxPerUnit: number; contentPx: number; scrollable: boolean }
  export function fitThenScroll(extent: number, viewPx: number, minSpan: number, minPxPerUnit: number): FitScroll;
  export const TRAJ_MIN_SPAN_FT = 6076;            // 1 nautical mile
  export const TRAJ_MIN_PX_PER_FT = 40 / 3934;     // 40 px per phugoid wavelength at 100 kt
  export const GRAPH_MIN_SPAN_S = 60;
  export const GRAPH_MIN_PX_PER_S = 40 / 23.3;     // 40 px per phugoid period at 100 kt
  export function visibleSlice<T>(items: readonly T[], key: (t: T) => number, lo: number, hi: number): [start: number, end: number]; // binary search, one item of padding each side
  export function strideFor(count: number, widthPx: number): number; // ≥1; so at most ~2 points per pixel are drawn
  export function niceTicks(lo: number, hi: number, target: number): number[]; // 1-2-5 steps
  ```

**Decisions:**
- `verticalRange`: `span = max(maxH − minH, MIN_VERTICAL_SPAN_FT)`, centred on the midpoint, then padded by `VERTICAL_MARGIN × span` each side. If `lo ≤ GROUND_SNAP × (hi − lo)` set `lo = 0` and `brokenAxis = false`; otherwise `brokenAxis = true`. `lo` is never negative.
- `fitThenScroll`: `pxPerUnit = max(viewPx / max(extent, minSpan), minPxPerUnit)`; `contentPx = max(viewPx, extent × pxPerUnit)`; `scrollable = contentPx > viewPx + 0.5`.

- [ ] **Step 1:** Write failing tests:
  ```ts
  // near-flat flight is not magnified: 4 ft of wobble still shows a 200 ft span plus margins
  let v = verticalRange(2998, 3002);
  expect(v.hi - v.lo).toBeCloseTo(260); expect((v.hi + v.lo) / 2).toBeCloseTo(3000); expect(v.brokenAxis).toBe(true);
  // a real oscillation fills the view
  v = verticalRange(2700, 3300); expect(v.lo).toBeCloseTo(2610); expect(v.hi).toBeCloseTo(3390);
  // Review Focus 4: near the ground the axis shows the ground instead of a break
  v = verticalRange(150, 3000); expect(v.lo).toBe(0); expect(v.brokenAxis).toBe(false);
  v = verticalRange(0, 40); expect(v.lo).toBe(0); expect(v.brokenAxis).toBe(false);
  // horizontal: minimum span, then fit, then scroll
  let f = fitThenScroll(100, 1000, TRAJ_MIN_SPAN_FT, TRAJ_MIN_PX_PER_FT);
  expect(f.pxPerUnit).toBeCloseTo(1000 / 6076); expect(f.scrollable).toBe(false);
  f = fitThenScroll(50_000, 1000, TRAJ_MIN_SPAN_FT, TRAJ_MIN_PX_PER_FT);
  expect(f.pxPerUnit).toBeCloseTo(0.02); expect(f.scrollable).toBe(false);
  f = fitThenScroll(500_000, 1000, TRAJ_MIN_SPAN_FT, TRAJ_MIN_PX_PER_FT);
  expect(f.pxPerUnit).toBeCloseTo(TRAJ_MIN_PX_PER_FT); expect(f.contentPx).toBeCloseTo(500_000 * TRAJ_MIN_PX_PER_FT); expect(f.scrollable).toBe(true);
  // Review Focus 5: drawing cost independent of history length
  const xs = Array.from({ length: 200_000 }, (_, i) => i);
  const [a, b] = visibleSlice(xs, x => x, 1000, 2000); expect(a).toBe(999); expect(b).toBe(2001);
  expect(strideFor(200_000, 1000)).toBe(100); expect(strideFor(500, 1000)).toBe(1);
  expect(niceTicks(0, 100, 5)).toEqual([0, 20, 40, 60, 80, 100]);
  ```
- [ ] **Step 2:** Run; fail. **Step 3:** Implement. **Step 4:** Run tests and typecheck; pass.
- [ ] **Step 5:** Commit `feat: view scaling maths`.

---

### Task 10: Page shell, control panel, main loop

**Files:**
- Create: `src/ui/controls.ts`, `src/style.css`
- Modify: `index.html`, `src/main.ts`

**Interfaces:**
- Consumes: `Simulation`, `yokeToElevator`, `elevatorToYoke`.
- Produces:
  ```ts
  export type GraphId = 'alpha' | 'thrust' | 'ias' | 'iasRate' | 'lift' | 'liftRate' | 'altitude' | 'climb';
  export const DEFAULT_GRAPHS: GraphId[]; // ['alpha', 'ias', 'lift', 'altitude']
  export interface UiState { forecastOn: boolean; graphs: Set<GraphId> }
  export function mountControls(root: HTMLElement, sim: Simulation, ui: UiState, onChange: () => void): { sync(): void };
  ```
  `sync()` re-reads the simulation (after reset, ground contact) into the widgets. `onChange` fires after any widget changes `ui` or the simulation.

**Layout (spec section 5):** CSS grid, fixed left panel about 240 px, right column flexible, whole page fills the viewport without page scroll. Right column: `#trajectory` (about 45% height, always shown) above `#graphs` (scrolls vertically inside itself). Left panel top to bottom:
1. Yoke: vertical range input, top = pull back. Value is yoke −1…+1 in steps of 0.002. Labels "Pull back (nose up)" at top, "Push forward (nose down)" at bottom. Readout: elevator in degrees to one decimal.
2. Throttle: horizontal range input 0…100 %, step 0.5, with percent readout.
3. Start/Pause (one toggling button) and Reset.
4. Playback speed: segmented 1×, 2×, 4×, 8×.
5. "Trajectory forecast" checkbox, default off.
6. Graph checkboxes with these labels in this order: Angle of attack, Thrust, Airspeed, Airspeed change, Lift, Lift change, Altitude, Altitude change.
7. Advanced settings in a `<details>` closed by default: "Altitude affects air density and power"; "Thrust falls with airspeed (fixed-pitch propeller)" with helper text "Off: idealised thrust, the same at any speed."; "Power changes pitch the nose".
8. A status line that shows "Ground contact. Press Reset." when status is `ground`; the Start button is disabled in that state.

Use native inputs with visible labels. Styling: calm and minimal (spec references Ciechanowski's *Airfoil*); define colours as CSS custom properties with light and dark schemes.

`src/main.ts`: create `Simulation` and `UiState`, mount controls, run a `requestAnimationFrame` loop calling `sim.advance((now − last) / 1000)` then each view's `draw()`. Views are added in Tasks 11 and 12; until then draw the latest sample's time, airspeed, and altitude as text in `#trajectory` so the loop is observable.

- [ ] **Step 1:** Implement the shell, styles, controls, and loop.
- [ ] **Step 2:** Run `npm run typecheck && npm run build`; pass.
- [ ] **Step 3:** Run `npm run dev` and verify in a browser: sliders start off-centre at the trim values; Start makes time advance; 8× advances eight times faster; moving the yoke back makes airspeed fall and oscillate; Reset restores sliders and time; flying into the ground shows the status line and disables Start. Capture a screenshot for the task report.
- [ ] **Step 4:** Commit `feat: page shell, control panel, animation loop`.

---

### Task 11: Trajectory view and close-up

**Files:**
- Create: `src/ui/scroller.ts`, `src/ui/trajectoryView.ts`, `src/ui/closeup.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `Simulation`, `forecast`, `UiState`, everything in `scales.ts`.
- Produces:
  ```ts
  // scroller.ts
  export class Scroller {            // a horizontally scrollable host with a canvas pinned inside it
    constructor(host: HTMLElement);
    readonly canvas: HTMLCanvasElement; readonly ctx: CanvasRenderingContext2D;
    readonly widthPx: number; readonly heightPx: number;   // CSS pixels; backing store scaled by devicePixelRatio
    setContentWidth(px: number): void;                     // keeps the view pinned to the right end while pinned
    readonly scrollLeft: number; readonly pinned: boolean;
  }
  // trajectoryView.ts
  export function mountTrajectory(host: HTMLElement, sim: Simulation, ui: UiState): { draw(): void };
  // closeup.ts
  export function drawCloseup(ctx: CanvasRenderingContext2D, rect: { x: number; y: number; w: number; h: number }, s: Sample): void;
  ```

**Decisions:**
- `Scroller`: host has `overflow-x: auto`; inside it a spacer `div` of the content width and a canvas with `position: sticky; left: 0` sized to the host. A `ResizeObserver` resizes the backing store for the current `devicePixelRatio`. `pinned` starts true, becomes false when the user scrolls away from the right end, and true again when they scroll to within 2 px of it.
- Horizontal extent = distance flown, plus the forecast's length when the forecast is on. Scale from `fitThenScroll(extent, widthPx, TRAJ_MIN_SPAN_FT, TRAJ_MIN_PX_PER_FT)`. With the forecast off the aircraft sits at the right end of the content; with it on, the forecast's end does.
- Vertical range from `verticalRange` over the samples currently visible horizontally (flown and forecast). Ease the displayed range toward the target each frame (about 10% of the gap per frame) so the axis does not jump.
- Draw: altitude gridlines and labels in feet (`niceTicks`); a distance axis in nautical miles; the flown path solid; the forecast dashed and lighter with a small end mark whose label is "steady", "ground", or omitted for `timeout`; the ground as a filled band when `lo = 0`; a break mark (two short diagonal strokes) at the bottom of the altitude axis when `brokenAxis`.
- Path drawing uses `visibleSlice` then `strideFor` so cost does not grow with history.
- Aircraft icon: a simple side-view silhouette about 44 px long, centred on the current position, rotated by the true pitch angle (not the stretched on-screen path slope).
- Forecast caching: recompute only when `sim.revision` changes, or when the forecast toggles on. While running, drop forecast samples with `t` earlier than `sim.time`. Recompute also when the cached forecast is exhausted and its end was `timeout`.
- Close-up: a 190 × 130 px panel in the top-right of the view, drawn at true angles: horizon line; aircraft silhouette rotated by pitch; an arrow along the flight-path angle labelled "direction of travel"; an arc between the arrow and the nose line labelled with angle of attack in degrees to one decimal. The arc turns the warning colour when angle of attack exceeds `STALL_ALPHA_RAD`.

- [ ] **Step 1:** Implement the three files and replace the Task 10 text placeholder in `main.ts`.
- [ ] **Step 2:** Run `npm run typecheck && npm run build`; pass.
- [ ] **Step 3:** Verify in a browser and capture screenshots of each:
  - undisturbed level flight looks flat, with a broken-axis mark, and is not magnified into waves;
  - after pulling the yoke back, the oscillation fills the view vertically and the path trails behind an aircraft at the right edge;
  - with the forecast on, the dashed path extends to a "steady" mark, the aircraft sits at the join, and moving a slider while paused redraws the forecast immediately;
  - at 8× for several minutes the view stops compressing and a horizontal scrollbar appears; scrolling back unpins, scrolling to the end re-pins;
  - a dive shows the ground band and no break mark;
  - the close-up angle of attack matches the value in the latest sample.
- [ ] **Step 4:** Commit `feat: trajectory view with forecast and true-angle close-up`.

---

### Task 12: Diagnostic graphs

**Files:**
- Create: `src/ui/graphs.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `Simulation`, `UiState`, `GraphId`, `Scroller`, `scales.ts`, `MASS`, `STALL_ALPHA_RAD`.
- Produces: `export function mountGraphs(host: HTMLElement, sim: Simulation, ui: UiState): { draw(): void }`

**Graph definitions (title, `Sample` field, unit, extras):**

| id | title | field | unit | minimum y-span | reference line |
|---|---|---|---|---|---|
| `alpha` | Angle of attack | `alphaDeg` | ° | 4 | stall angle (`STALL_ALPHA_RAD` in degrees), labelled "stall" |
| `thrust` | Thrust | `thrustLbf` | lbf | 50 | none |
| `ias` | Airspeed | `iasKt` | kt | 10 | none |
| `iasRate` | Airspeed change | `iasRateKtPerS` | kt/s | 1 | zero |
| `lift` | Lift | `liftLbf` | lbf | 200 | aircraft weight (`MASS.weightLbf`), labelled "weight" |
| `liftRate` | Lift change | `liftRateLbfPerS` | lbf/s | 50 | zero |
| `altitude` | Altitude | `h` | ft | 200 | none |
| `climb` | Altitude change | `climbFpm` | ft/min | 200 | zero |

**Decisions:**
- One `Scroller` for the whole graph area; every enabled graph is a horizontal band about 110 px tall on the one canvas, in the table's order, sharing the time axis. If the bands exceed the area's height, the area scrolls vertically (the canvas grows; the left panel is unaffected).
- Time scale from `fitThenScroll(sim.time, widthPx, GRAPH_MIN_SPAN_S, GRAPH_MIN_PX_PER_S)`; pinned to the latest time unless scrolled back.
- Each band's y-range is the min and max of its visible samples, widened to the minimum y-span in the table (so a steady value draws as a flat line, not amplified noise) and always including its reference line when that line is within three spans of the data. Eased like the trajectory's vertical range.
- Each band shows its title, unit, y ticks, and the current value at the right edge. A time axis in seconds runs along the bottom.
- Markers: a thin vertical line through all bands at each `sim.markers` time, with a small letter at the top: "Y" yoke, "T" throttle, "S" setting.
- History only; the forecast is not drawn here.
- Drawing uses `visibleSlice` and `strideFor`.

- [ ] **Step 1:** Implement and wire into `main.ts`.
- [ ] **Step 2:** Run `npm run typecheck && npm run build`; pass.
- [ ] **Step 3:** Verify in a browser and capture screenshots: default four graphs shown; toggling checkboxes adds and removes bands; in steady level flight every band is a flat line and lift sits on the "weight" line; after a throttle increase the lift trace settles slightly below the weight line while Altitude change settles positive and Airspeed returns close to its earlier value; markers appear where the sliders moved; with all eight on, the graph area scrolls vertically and the control panel stays put.
- [ ] **Step 4:** Commit `feat: diagnostic graphs`.

---

### Task 13: End-to-end check and deployment readiness

**Files:**
- Create: `README.md`
- Modify: `index.html` (title, description meta)

- [ ] **Step 1:** Run `npm test && npm run typecheck && npm run build`; all pass. Run `npm run preview` and repeat the browser checks from Tasks 10 to 12 against the production build, at window widths 1280 and 1920.
- [ ] **Step 2:** Dependency-direction check: `grep -rnE "from ['\"](\.\./)+(ui|sim)" src/physics; grep -rnE "from ['\"](\.\./)+ui|document\.|window\." src/sim src/physics` prints nothing.
- [ ] **Step 3:** Write `README.md`: what the simulator shows; `npm install`, `npm run dev`, `npm test`; a short map of `src/physics` naming `dynamics.ts` `derivatives()` as the single place where forces become acceleration (this is what Leon will read to confirm climb rate comes from computed lift); a pointer to `docs/validation.md`; JSBSim data attribution and licence note; deployment: import the GitHub repository in Vercel, framework preset Vite, no configuration file needed.
- [ ] **Step 4:** Commit `docs: README and deployment notes`.
- [ ] **Step 5:** Report to Leon: the validation table, screenshots, and the two steps that need his accounts (create the GitHub repository and push; import it in Vercel). Do not push or deploy without his go-ahead.
