/** Unit conversions. Internal units are feet, seconds, slugs, pounds-force, radians. */
export const KT_TO_FPS = 1.6878099;
export const FT_PER_NM = 6076.115;

export const ktToFps = (kt: number): number => kt * KT_TO_FPS;
export const fpsToKt = (fps: number): number => fps / KT_TO_FPS;
export const fpsToFpm = (fps: number): number => fps * 60;
export const degToRad = (d: number): number => (d * Math.PI) / 180;
export const radToDeg = (r: number): number => (r * 180) / Math.PI;
