import { CAMERA_LIMITS, view, type CameraMode } from "@/store/game";

/**
 * Camera input helpers. No three.js here, so the HUD can use them without
 * pulling the 3D bundle into the first download.
 */
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function clampView(mode: CameraMode) {
  const l = CAMERA_LIMITS[mode];
  view.pitch[mode] = clamp(view.pitch[mode], l.pitch[0], l.pitch[1]);
  view.dist[mode] = clamp(view.dist[mode], l.dist[0], l.dist[1]);
}

/** Zoom by a factor, so the wheel feels the same at 5 m and at 120 m. */
export function zoomBy(factor: number) {
  const m = view.mode;
  view.dist[m] *= factor;
  clampView(m);
  view.idle = 0;
}

export function orbitBy(dx: number, dy: number) {
  const m = view.mode;
  view.lookT = performance.now();
  view.yaw -= dx * 0.0055;
  view.pitch[m] += dy * 0.003;
  clampView(m);
  view.idle = 0;
}

/** Pan the free camera in screen space (pixels). */
export function panBy(dx: number, dy: number) {
  if (view.mode !== "free") return;
  const k = view.dist.free * 0.0022;
  const s = Math.sin(view.yaw);
  const c = Math.cos(view.yaw);
  view.panX += (-dx * c - dy * s) * k;
  view.panZ += (dx * s - dy * c) * k;
  const r = Math.hypot(view.panX, view.panZ);
  if (r > 90) {
    view.panX *= 90 / r;
    view.panZ *= 90 / r;
  }
  view.idle = 0;
}
