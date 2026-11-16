/** Aircraft data (re-exported from the configuration file) plus derived mass properties. */
import { EMPTY_IYY, G, LOADING, type MassProps } from '../config/aircraft';

export * from '../config/aircraft';

function loadedMassProps(): MassProps {
  const weightLbf = LOADING.reduce((sum, i) => sum + i.weightLbf, 0);
  const cgX = LOADING.reduce((sum, i) => sum + i.weightLbf * i.x, 0) / weightLbf;
  const cgZ = LOADING.reduce((sum, i) => sum + i.weightLbf * i.z, 0) / weightLbf;
  // Parallel-axis theorem about the loaded centre of gravity.
  const iyy = LOADING.reduce(
    (sum, i) => sum + (i.weightLbf / G) * (((i.x - cgX) / 12) ** 2 + ((i.z - cgZ) / 12) ** 2),
    EMPTY_IYY,
  );
  return { weightLbf, massSlug: weightLbf / G, iyy, cgIn: { x: cgX, z: cgZ } };
}

export const MASS: MassProps = loadedMassProps();

