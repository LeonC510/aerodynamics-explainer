# Pitch for Speed, Power for Glide

An interactive, physics-based simulation of a Cessna 172P in two dimensions (forward/back and
up/down). It lets you discover the flying mantra "pitch for airspeed, power for glide" by playing:
move the yoke and the aircraft oscillates, then settles at a new *airspeed*; move the throttle
and it settles into a climb or descent at nearly the *same* airspeed.

## Running it

```bash
npm install
npm run dev        # local development server
npm test           # physics, simulation and view tests
npm run build      # production build into dist/
```

## How it is organised

| Folder | What is in it |
|---|---|
| `src/config/` | Every tunable number: aircraft data, calibration, time stepping, view scaling, graph list. |
| `src/physics/` | The equations. Pure TypeScript, no browser or UI code. |
| `src/sim/` | Runs the physics in time: history, control-change markers, forecast. |
| `src/ui/` | Control panel and canvas drawing. |
| `scripts/` | `report.ts` (model vs handbook numbers), `calibrate.ts` (refit), `bench-forecast.ts`. |
| `reference/jsbsim/` | Unmodified JSBSim source files the aircraft data comes from. |
| `docs/validation.md` | How the model compares with the 172P handbook, and what was calibrated. |

### Where to check the physics

`src/physics/dynamics.ts`, function `derivatives()`, is the single place where forces become
acceleration. It computes angle of attack from the pitch angle and the direction of travel, then
lift, drag, thrust and the pitching moment, and applies Newton's second law. Climb rate is never
looked up or computed by a formula: it is the vertical velocity that results from integrating
those accelerations (`rk4Step()` in the same file).

### Changing the aircraft

Edit `src/config/aircraft.ts`. Values copied from JSBSim cite the file and element they came
from; values fitted to the handbook are in the `CALIBRATION` block and marked "NOT FROM SOURCE".
After changing handbook targets, run `npx tsx scripts/calibrate.ts` and copy the printed values in,
then `npx tsx scripts/report.ts` to see the result and `npm test` to check it.

## Deploying to Vercel

The site is static. Import the GitHub repository in Vercel and accept the detected **Vite**
preset (build command `npm run build`, output directory `dist`). No configuration file is needed.

## Data and licence notes

Aircraft data is derived from the JSBSim `c172p` model (LGPL 2.1); see `reference/jsbsim/README.md`.
This simulator is for learning and is not a source of flight-planning data.
