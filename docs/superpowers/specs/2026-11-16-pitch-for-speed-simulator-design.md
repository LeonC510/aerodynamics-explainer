# Pitch-for-Speed Simulator: Design (version 1)

Date: 2026-11-16
Status: approved by Leon on 2026-11-16 (172P variant; power-pitch coupling default off)

Items marked **[Claude's call]** were chosen by Claude and not explicitly agreed by Leon. Everything else is Leon's decision as stated in conversation.

## 1. Intent

Leon is building an interactive explainer for the flying mantra "pitch for airspeed, power for glide" as a capstone project. Most people assume the opposite: the yoke sets altitude ("the plane goes where you point it") and the throttle sets speed.

Version 1 is a sandbox simulation of a Cessna 172 in two dimensions (forward/back and up/down). The intended experience:

1. The user moves the yoke and sees the aircraft head the "expected" way for a while, then drop back.
2. The aircraft oscillates and settles into a steady state.
3. From the zoomed-out trajectory and the graphs, the user sees that the yoke changed the *speed* the aircraft settled at, and the throttle changed whether it *climbs or descends*.

The user discovers this by playing; version 1 contains no explanatory text.

## 2. Goals, non-goals, anti-goals

**Goals**
- A physically honest simulation: every displayed quantity comes from the simulated state, driven by computed forces and moments.
- The oscillation (phugoid) and its settling emerge from the physics; they are not scripted.
- Yoke and throttle can be changed at any time, running or paused.
- A readable picture of the whole flight, plus a forecast of where the current control settings lead.
- Deployable to Vercel as a static site.

**Non-goals for version 1**
- Lateral motion, roll, yaw, rudder.
- Flaps, wind, turbulence, ground effect, fuel burn, takeoff, landing.
- Explanatory text, glossary, tutorial levels, guided challenges (likely later versions).
- A phone layout. The target is a laptop-sized landscape window.
- Sound.

**Anti-goals** (these make it a failure even if it runs)
- Climb rate, airspeed, or any other output taken from a performance table or closed-form shortcut rather than from integrating forces. Leon will check specifically that climb rate follows from computed lift, drag, thrust, and weight.
- Physics code mixed with drawing or UI code.
- A trajectory view that magnifies a near-flat flight into dramatic-looking waves, or that hides a real oscillation.

## 3. Technology

- **TypeScript**, built with **Vite** into a static site. Leon dislikes reading and writing plain JavaScript; TypeScript is acceptable, and efficiency and clear structure outrank language preference.
- **No physics library.** Leon chose hand-written standard equations with coefficients from published sources (section 4.7), after general physics engines and JSBSim-in-the-browser were ruled out.
- **Canvas 2D** for the trajectory view, the aircraft close-up, and the graphs, without a charting library. **[Claude's call]**
- **No UI framework**; plain TypeScript modules and DOM controls. The builder may introduce a small framework if the UI state becomes awkward without one. **[Claude's call]**
- **Vitest** for unit tests. **[Claude's call]**
- The project lives in a git repository at `/Users/leon/Documents/misc_projects/aerodynamics_explainer`. Vercel deployment is expected to be through a GitHub repository; Leon sets up the GitHub and Vercel accounts and links.

**Required structure:** the physics is a pure module with no imports from UI or browser APIs. It takes a state, control inputs, and settings, and returns derivatives and the intermediate quantities (angle of attack, lift, drag, thrust, and so on). The live simulation, the forecast, and the tests all call this same module.

## 4. Physics model

### 4.1 Aircraft
Cessna 172P, 160 hp, fixed-pitch propeller, clean configuration, at the 172P's maximum gross weight (2400 lb). Leon asked that the variant, weight, and coefficients all come from one consistent source; the 172P is chosen because it is the variant JSBSim's `c172p` model describes. Mass, inertia, and centre-of-gravity position are taken from that model's loading at this weight.

### 4.2 State
Six numbers: horizontal position, altitude, horizontal velocity, vertical velocity, pitch angle (nose angle relative to the horizon), and pitch rate.

Derived each step:
- Flight path angle: direction of the velocity vector relative to the horizon.
- Angle of attack: pitch angle minus flight path angle (plus wing incidence if the chosen data source defines coefficients that way). It is never set directly.

### 4.3 Forces and moment
- **Lift**, perpendicular to the velocity: from a lift coefficient curve over angle of attack that includes the stall break and post-stall behaviour, plus the elevator's small lift contribution if the data source provides it.
- **Drag**, opposite the velocity: parasite plus induced drag, with a post-stall rise.
- **Thrust**, along the aircraft's nose direction. By default it acts through the centre of gravity and causes no direct pitching moment; see section 4.6a for the optional power-pitch coupling.
- **Weight**, straight down.
- **Pitching moment**: static stability (restoring moment proportional to angle of attack), elevator moment, and pitch damping (proportional to pitch rate). This, with the pitch moment of inertia, drives pitch rotation and is what makes the phugoid appear.

Velocity changes come from the sum of the four forces divided by mass. Position changes come from velocity. Nothing else may modify the state.

### 4.4 Controls
- **Yoke**: sets elevator deflection directly, over the real C172 travel (about 28° up, 23° down). There is no separate trim model; the slider stays where the user leaves it, so it behaves like a held yoke or a trim setting.
- **Throttle**: 0 to 100 percent.

### 4.5 Thrust modes (advanced setting "Thrust falls with airspeed", default off)
- **Off (default): idealised constant thrust.** Thrust equals throttle fraction times a fixed maximum thrust, independent of airspeed. The maximum is calibrated so full throttle gives about the 172P handbook best climb rate at sea level and maximum weight (roughly 700 ft/min near 76 knots; confirm against the 172P handbook). The UI describes this as idealised thrust, not as a constant-speed propeller (which would hold power constant, not thrust).
- **On: fixed-pitch propeller.** Engine power equals throttle fraction times rated power; thrust comes from power through a propeller efficiency curve that depends on airspeed, with a sensible static-thrust limit at low speed.

### 4.6 Altitude effects (advanced setting, default off)
- **Off (default):** air density is fixed at the sea-level standard value at all altitudes.
- **On:** density follows the standard atmosphere, and available engine power (or, in constant-thrust mode, maximum thrust) falls with density. **[Claude's call on applying the reduction in constant-thrust mode]**

Changing either advanced setting mid-run takes effect immediately and keeps the current state. **[Claude's call]**

### 4.6a Power-pitch coupling (advanced setting "Power changes pitch the nose", default off)A real C172 pitches when power changes, for two reasons: the thrust line does not pass exactly through the centre of gravity, and the propeller slipstream changes the airflow over the tail. Note that even with this setting off, adding power raises the nose over the following seconds, because the aircraft holds its trimmed speed and so climbs; that response comes from the basic physics and is always present.
- **Off (default):** thrust acts through the centre of gravity and the tail sees the free-stream airflow.
- **On:** thrust acts at the propeller position given by the `c172p` model, producing a pitching moment from its offset to the centre of gravity, and the slipstream's effect on the tail is modelled if and as the `c172p` model defines it. With this on, a throttle change also shifts the settled airspeed somewhat.

### 4.7 Data sources
JSBSim's `c172p` model is the source for geometry, mass, inertia, propeller position, the lift curve, and stability coefficients. Where its performance disagrees with the Cessna 172P handbook, the handbook wins (Leon, 2026-11-16): drag and propeller thrust are calibrated to handbook figures, and each calibrated value is marked as such in the code. Roskam's Cessna 172 data may be used only as a cross-check, not mixed in. Performance targets come from the Cessna 172P handbook. Each constant in the code carries a comment citing its source. Where sources lack post-stall data, a standard flat-plate-style extension is acceptable, noted as such. The builder picks specific values; the tests in section 8 decide whether they are good enough.

### 4.8 Integration
Fixed time step (around 1/120 s) with fourth-order Runge-Kutta, decoupled from the display frame rate. Faster playback runs more steps per frame; it never enlarges the step. **[Claude's call]**

### 4.9 Start, ground, reset
- The run starts at 3000 ft above sea level; the ground is at 0 ft.
- The initial state is steady level flight at 3000 ft and about 100 knots **[Claude's call on speed]**. A trim solver finds the elevator and throttle positions that hold this state, and the yoke and throttle sliders start at those positions, not at centre.
- The simulation opens paused.
- Reaching 0 ft ends the run with a plain "ground contact" state; only Reset continues. No crash animation.
- Reset restores the initial state and slider positions and clears history. Advanced settings keep their values. **[Claude's call]**

## 5. Screen layout

Leon chose the "left side panel" arrangement for a landscape window.

**Left panel, top to bottom**
- Yoke: vertical slider, up = pull back (nose up), ends labelled.
- Throttle: slider.
- Start/Pause and Reset.
- Playback speed: 1×, 2×, 4×, 8×.
- Trajectory forecast toggle.
- Graph toggles: one checkbox per diagnostic graph.
- Advanced settings (collapsed by default): altitude effects; thrust falls with airspeed; power changes pitch the nose.

**Right side**
- Trajectory view on top, with the aircraft close-up inset in a corner.
- Diagnostic graphs stacked below, sharing one time axis. If more graphs are enabled than fit, the graph area scrolls vertically; the left panel stays fixed.

Visual styling is left to the builder. Leon's references for tone are Bartosz Ciechanowski's *Airfoil* essay and Ableton's *Learning Synths*: clean, calm, visual-first.

## 6. Trajectory view

Altitude against horizontal distance.

**Contents**
- The flown path as a solid line.
- An oversized aircraft icon on the line at the current position, rotated by the true pitch angle. Leon wants to try this first and revise if it reads badly. Known risk: because height is stretched (below), the path's drawn slope is steeper than the icon's true angle.
- A close-up inset drawn at true angles: aircraft side view, horizon reference, velocity direction, and the angle of attack between nose and velocity, with its value. **[Claude's call to keep this alongside the icon; easy to remove]**

**Forecast (toggle)**
- Off: the aircraft sits at the right edge with the flown path behind it.
- On: the view shows the flown path, then the forecast path continuing from the aircraft to the point where flight stabilises. The aircraft sits where the two meet.
- The forecast is the same physics module run forward from the current state with the current yoke, throttle, and settings held.
- It is recomputed whenever the yoke, throttle, or an advanced setting changes, including while paused, so a paused user can preview a control change. Between changes the existing forecast is simply consumed as the aircraft flies along it. **[Claude's call]**
- "Stabilised" means airspeed and climb rate have both stayed essentially constant for about 10 seconds. The forecast also ends on ground contact or at a time cap (about 10 simulated minutes) for cases that never settle. Thresholds are the builder's to tune. **[Claude's call]**
- The forecast is drawn dashed and lighter than the flown path. **[Claude's call]**

**Vertical axis**
- Shows only the altitude range covered by the visible path (and forecast when on), plus a margin.
- It never shows less than a minimum span (start around 200 ft and tune), so a nearly flat flight looks nearly flat while a real oscillation fills the view. This is the specific safeguard Leon asked for.
- If the shown range does not reach the ground, a broken-axis mark indicates the gap down to 0 ft. When the path nears the ground, the ground itself is shown.

**Horizontal axis**
- Shows the whole flight since the start, compressing as the flight grows.
- Compression stops at a limit; beyond it the view scrolls sideways. It stays pinned to the aircraft (and forecast) unless the user scrolls back, and re-pins when they scroll to the end.
- The limit should keep individual oscillations legible: roughly 40 pixels per oscillation wavelength at the starting speed, as a tunable constant. **[Claude's call on the number]**
- At the start of a run, a minimum horizontal span avoids an absurdly magnified first second. **[Claude's call]**

## 7. Diagnostic graphs

Eight graphs against time, each independently toggleable:

| Graph | Quantity | Unit |
|---|---|---|
| Angle of attack | wing angle of attack | degrees |
| Thrust | thrust force | lbf |
| Airspeed | indicated airspeed | knots |
| Airspeed change | rate of change of airspeed | knots per second |
| Lift | lift force | lbf |
| Lift change | rate of change of lift | lbf per second |
| Altitude | altitude above sea level | feet |
| Altitude change | climb rate | feet per minute |

- Default on: angle of attack, airspeed, lift, altitude. **[Claude's call]**
- Airspeed is indicated airspeed, the value a pilot reads. It equals true airspeed while altitude effects are off. **[Claude's call]**
- The lift graph carries a reference line at aircraft weight, so the user can see lift settle slightly below weight in a steady climb and exceed it only in transitions. **[Claude's call]**
- The angle of attack graph marks the stall angle. **[Claude's call]**
- Each yoke or throttle change leaves a small marker on the graphs' time axis.
- Graphs show flown history only, not the forecast, in version 1. **[Claude's call]**
- The time axis follows the same fit-then-scroll rule as the trajectory view. Linking the graphs' scroll position to the trajectory's is desirable but not required.

## 8. Verification

Unit tests on the physics module, with tolerances the builder sets (around 10 percent unless noted):
- The trim solver's state is steady: running it forward produces no meaningful drift in speed or altitude.
- All handbook figures below are for the 172P at 2400 lb and are approximate from memory; the builder confirms them against the 172P handbook before using them as targets.
- Clean stall speed at maximum weight lands near the handbook figure (about 51 knots calibrated).
- Power-off best glide is near 65 knots with a glide ratio near 9:1.
- In fixed-pitch propeller mode at sea level, full-throttle best climb is near 700 ft/min around 76 knots, and maximum level speed is near the handbook value (about 123 knots).
- With power-pitch coupling on, a throttle increase from trim produces a nose-up pitching moment before speed has changed.
- After a yoke step from trim, the response is a damped oscillation with a period in the range simple theory predicts for the speed (roughly 0.14 seconds per ft/s of airspeed, so 20 to 30 seconds near 100 knots), settling to a new steady speed.
- In a steady climb, lift is slightly less than weight (weight times the cosine of the climb angle).
- A yoke change with fixed throttle changes the settled airspeed; a throttle change with fixed yoke leaves settled airspeed nearly unchanged and changes the settled climb rate. This is the mantra itself, as a test.

Manual check by Leon: read the physics module and confirm climb rate arises only from integrating computed forces.

## 9. Left to the builder

- Exact coefficient values and curve shapes, within section 4.7 and the tests in section 8.
- Trim solver method.
- Forecast stabilisation thresholds, vertical minimum span, compression limit values.
- Module and file layout beyond the pure-physics requirement.
- Visual design, colours, typography, light/dark handling.
- History storage and sampling rate for drawing.
- Keyboard shortcuts, if any.
