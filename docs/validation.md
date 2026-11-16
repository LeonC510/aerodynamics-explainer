# Model validation: simulator versus the Cessna 172P handbook

Sea level, 2400 lb, clean. Regenerate the model numbers with `npx tsx scripts/report.ts`;
refit the calibration with `npx tsx scripts/calibrate.ts`.

## Handbook figures

| Figure | Handbook | Constant-thrust mode (default) | Fixed-pitch propeller mode |
|---|---|---|---|
| Stall speed, flaps up | 51 KCAS | 51.0 kt | 51.0 kt |
| Best rate of climb | 700 ft/min | 699 ft/min | 700 ft/min |
| Speed for best climb | 76 KIAS | 86 kt | 76.5 kt |
| Maximum level speed | 123 kt | 131 kt | 122.75 kt |
| Best glide ratio | about 9:1 | 9.0 | 8.3 |
| Speed for best glide | 65 KIAS | 70.5 kt | 70.5 kt |
| Glide ratio at 65 kt | about 9:1 | 8.7 | 8.1 |

Handbook sources: maximum speed, climb rate, and stall speed were confirmed against a published
172P specification listing (172guide.com, 1985/86 model). The best-climb speed, best-glide speed,
and glide ratio are from memory of the handbook and have not been independently confirmed.

## Why the first calibration was off, and what changed

The first calibration left the best-climb speed 9 kt high. The equations were not at fault: the
force balance is tested exactly. Two things in the source data caused it.

- **The source's propeller table is generic.** Its thrust is almost flat from 70 to 95 kt, where a
  real fixed-pitch propeller's thrust is already falling by about 2 lbf per knot. Climb rate is
  (thrust − drag) × speed, so flat thrust pushes the best-climb speed up, to about 85 kt. The
  fix is a propeller correction curve fitted to the handbook climb rate, best-climb speed, and
  top speed. The propeller efficiency it implies is plausible: about 0.63 at 60 kt, 0.69 at
  76 kt, 0.85 at 123 kt.
- **The first fit squeezed induced drag to an unrealistic value** trying to compensate. Induced
  drag is now set from an assumed span efficiency of 0.8 rather than fitted.

The handbook figures are consistent with each other: a drag polar with a zero-lift coefficient
near 0.03 and span efficiency near 0.8 reproduces the top speed, the climb, and the glide ratio together.

## Where the model still differs

- **Best-glide speed is 5.5 kt high (70.5 against 65 kt); the glide ratio matches.** The source lift
  table has a kink between 0.09 and 0.10 rad angle of attack (lift coefficient jumps from 0.73 to
  0.83), which is where the aircraft flies at about 70 kt. Combined with the source's elevator drag,
  that pins the best lift-to-drag point there. Removing it would mean reshaping the source lift curve.
- **Constant-thrust mode has a higher best-climb speed (86 kt) and top speed (131 kt).** This is
  inherent in thrust that does not fall with airspeed, not a calibration gap. Its maximum thrust is
  set so that its best climb rate is the handbook's. Turn on "Thrust falls with airspeed" for
  handbook-like speeds.
- **Fixed-pitch mode glides slightly steeper (8.3:1)** because the idling propeller model adds its own
  small drag on top of the windmilling-drag coefficient that was fitted in constant-thrust mode.

## Calibrated values (not from JSBSim)

All in `src/config/aircraft.ts` under `CALIBRATION`.

| Value | Setting | Unmodified JSBSim equivalent | Fitted to |
|---|---|---|---|
| `cd0` | 0.0294 | 0.027 | maximum level speed |
| `kInduced` | 0.054 | drag table, roughly 0.085 | not fitted: span efficiency 0.8 |
| `clMaxScale` | 1.136 | 1 (peak lift coefficient 1.47) | stall speed |
| `propThrustAtVy` | 1.071 | 1 | best climb rate |
| `propThrustSlopePerKt` | −0.0105 | 0 | best-climb speed |
| `idlePropDragCd` | 0.0203 | none | power-off glide ratio |
| `maxThrustLbf` | 394 lbf | not applicable | best climb rate, constant-thrust mode |

Before calibration the unmodified JSBSim data gave: stall 54.5 kt, best climb 577 ft/min at 92 kt
(propeller mode), maximum level speed 123.5 kt, best glide 9.4:1 at 82 kt.

Unchanged from JSBSim: geometry, mass and inertia, the lift curve below 0.09 rad angle of attack,
all stability and control coefficients (pitching moment, damping, elevator), the post-stall drag
table, and the propeller power table.

## Physics properties (tested exactly, independent of calibration)

From steady level flight at 100 kt and 3000 ft, default settings, 600 s after each change:

| Change | Settled airspeed | Settled climb rate | Settled lift (weight is 2400 lbf) |
|---|---|---|---|
| Yoke back, elevator −1° | 94.4 kt | +75 ft/min | 2392 lbf |
| Throttle +20% | 99.9 kt | +334 ft/min | 2391 lbf |
| Throttle −20% | 100.0 kt | −333 ft/min | 2395 lbf |
| Throttle +20%, power-pitch coupling on | 105.3 kt | +278 ft/min | 2394 lbf |

- The yoke changes the settled airspeed; the throttle changes the settled climb rate and leaves
  airspeed alone. This is "pitch for airspeed, power for glide", and it is an automated test.
- Lift settles slightly below weight in every steady climb or descent.
- The oscillation period is 24 to 26 s (simple theory predicts about 23 s at 100 kt) and it damps out.
- With power-pitch coupling on, more power also raises the settled airspeed by about 5 kt. In this
  model the propeller slipstream over the tail outweighs the thrust-line offset at this trim.
