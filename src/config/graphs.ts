/**
 * GRAPH CONFIGURATION: the eight diagnostic graphs, in display order.
 */
import type { Sample } from '../sim/simulation';

export type GraphId = 'alpha' | 'thrust' | 'ias' | 'iasRate' | 'lift' | 'liftRate' | 'altitude' | 'climb';

export interface GraphDef {
  id: GraphId;
  title: string;
  /** Which recorded quantity the graph plots. */
  field: keyof Sample;
  unit: string;
  /** The value axis never spans less than this, so a steady value draws as a flat line. */
  minSpan: number;
  /** Decimal places for the current-value readout. */
  decimals: number;
  /** A labelled horizontal reference line, if any. */
  reference?: 'zero' | 'stall' | 'weight';
}

export const GRAPHS: readonly GraphDef[] = [
  { id: 'alpha', title: 'Angle of attack', field: 'alphaDeg', unit: '°', minSpan: 4, decimals: 1, reference: 'stall' },
  { id: 'thrust', title: 'Thrust', field: 'thrustLbf', unit: 'lbf', minSpan: 50, decimals: 0 },
  { id: 'ias', title: 'Airspeed', field: 'iasKt', unit: 'kt', minSpan: 10, decimals: 1 },
  { id: 'iasRate', title: 'Airspeed change', field: 'iasRateKtPerS', unit: 'kt/s', minSpan: 1, decimals: 2, reference: 'zero' },
  { id: 'lift', title: 'Lift', field: 'liftLbf', unit: 'lbf', minSpan: 200, decimals: 0, reference: 'weight' },
  { id: 'liftRate', title: 'Lift change', field: 'liftRateLbfPerS', unit: 'lbf/s', minSpan: 50, decimals: 1, reference: 'zero' },
  { id: 'altitude', title: 'Altitude', field: 'h', unit: 'ft', minSpan: 200, decimals: 0 },
  { id: 'climb', title: 'Altitude change', field: 'climbFpm', unit: 'ft/min', minSpan: 200, decimals: 0, reference: 'zero' },
];

/** Graphs shown when the page opens. */
export const DEFAULT_GRAPHS: readonly GraphId[] = ['alpha', 'ias', 'lift', 'altitude'];
