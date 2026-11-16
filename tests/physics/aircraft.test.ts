import { expect, test } from 'vitest';
import { CD_ALPHA, CL_ALPHA, CP_J, CT_J, MASS } from '../../src/physics/aircraft';
import { interp1 } from '../../src/physics/table';

test('loaded mass properties are the 2400 lb loading about its own centre of gravity', () => {
  expect(MASS.weightLbf).toBe(2400);
  expect(MASS.massSlug).toBeCloseTo(2400 / 32.174, 6);
  expect(MASS.cgIn.x).toBeCloseTo(44.62, 2);
  expect(MASS.cgIn.z).toBeCloseTo(37.27, 2);
  expect(MASS.iyy).toBeCloseTo(1449.4, 0);
});
test('lift and drag tables match the source rows', () => {
  expect(CL_ALPHA.length).toBe(17);
  expect(interp1(CL_ALPHA, 0.28)).toBeCloseTo(1.47);
  expect(CD_ALPHA.length).toBe(26);
  expect(interp1(CD_ALPHA, 0)).toBeCloseTo(0.0052);
});
test('propeller tables are the active (uncommented) ones', () => {
  expect(interp1(CT_J, 0)).toBeCloseTo(0.073);
  expect(interp1(CP_J, 0.7)).toBeCloseTo(0.0469);
});
