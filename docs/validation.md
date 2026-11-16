# Model validation: simulator versus the Cessna 172P handbook

Sea level, 2400 lb, clean. Regenerate the model numbers with `npx tsx scripts/report.ts`;
refit the calibration with `npx tsx scripts/calibrate.ts`.

## Handbook figures

| Figure | Handbook | Constant-thrust mode (default) | Fixed-pitch propeller mode |
|---|---|---|---|
| Stall speed, flaps up | 51 KCAS | 51.0 kt | 51.0 kt |
| Best rate of climb | 700 ft/min | 700 ft/min | 701 ft/min |
| Speed for best climb | 76 KIAS | 85 kt | 84.5 kt |
| Climb rate at 76 kt | (700 ft/min) | 628 ft/min | 633 ft/min |
| Maximum level speed | 123 kt | 130 kt | 123 kt |
| Best glide ratio | about 9:1 | 9.0 | 8.3 |
| Speed for best glide | 65 KIAS | 70.5 kt | 70.5 kt |
| Glide ratio at 65 kt | about 9:1 | 8.8 | 8.1 |

Handbook sources: maximum speed, climb rate, and stall speed were confirmed against a published
172P specification listing (172guide.com, 1985/86 model). The best-climb speed, best-glide speed,
and glide ratio are from memory of the handbook and have not been independently confirmed.

## Where the model still differs

- **Best-climb speed is about 9 kt high.** Matching both 700 ft/min and 76 kt would need an
  induced-drag factor below what a wing of this aspect ratio can physically have (the fit stopped
  at a span efficiency of 0.85). The climb *rate* was given priority over the speed at which it occurs.
- **Best-glide speed is about 5 kt high**, for the same reason. The glide ratio matches.
- **Constant-thrust mode has a higher top speed (130 kt)** because its thrust, by design, does not
  fall with airspeed. Its maximum thrust is set so that its best climb rate is the handbook's.
- **Fixed-pitch mode glides slightly steeper (8.3:1)** because the idling propeller model adds its own
  small drag on top of the windmilling-drag coefficient that was fitted in constant-thrust mode.

## Calibrated values (not from JSBSim)

All in `src/config/aircraft.ts` under `CALIBRATION`.

| Value | Setting | Unmodified JSBSim equivalent | Fitted to |
|---|---|---|---|
| `cd0` | 0.030 | 0.027 | maximum level speed, climb |
| `kInduced` | 0.0508 | drag table, roughly 0.085 | best climb rate and speed |
| `clMaxScale` | 1.136 | 1 (peak lift coefficient 1.47) | stall speed |
| `propThrustScale` | 1.013 | 1 | maximum level speed |
| `idlePropDragCd` | 0.0219 | none | power-off glide ratio |
| `maxThrustLbf` | 393 lbf | not applicable | best climb rate, constant-thrust mode |

Before calibration the unmodified JSBSim data gave: stall 54.5 kt, best climb 577 ft/min at 92 kt
(propeller mode), maximum level speed 123.5 kt, best glide 9.4:1 at 82 kt.

Unchanged from JSBSim: geometry, mass and inertia, the lift curve below 0.09 rad angle of attack,
all stability and control coefficients (pitching moment, damping, elevator), the post-stall drag
table, and the propeller thrust and power tables.

## Physics properties (tested exactly, independent of calibration)

From steady level flight at 100 kt and 3000 ft, default settings, 600 s after each change:

| Change | Settled airspeed | Settled climb rate | Settled lift (weight is 2400 lbf) |
|---|---|---|---|
| Yoke back, elevator −1° | 94.4 kt | +78 ft/min | 2392 lbf |
| Throttle +20% | 99.9 kt | +333 ft/min | 2391 lbf |
| Throttle −20% | 100.0 kt | −332 ft/min | 2395 lbf |
| Throttle +20%, power-pitch coupling on | 105.3 kt | +274 ft/min | 2394 lbf |

- The yoke changes the settled airspeed; the throttle changes the settled climb rate and leaves
  airspeed alone. This is "pitch for airspeed, power for glide", and it is an automated test.
- Lift settles slightly below weight in every steady climb or descent.
- The oscillation period is 24 to 26 s (simple theory predicts about 23 s at 100 kt) and it damps out.
- With power-pitch coupling on, more power also raises the settled airspeed by about 5 kt. In this
  model the propeller slipstream over the tail outweighs the thrust-line offset at this trim.
