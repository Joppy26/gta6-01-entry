// camera.js — the third-person follow camera: it chases the player (or their
// car), eases instead of snapping, looks slightly ahead at speed, and never
// shows past the edge of the world. Screen shake rides on top of it.
import { WORLD } from './config.js';

export function createCamera(viewW, viewH) {
  return {
    x: 0, y: 0, viewW, viewH,
    view: { x0: 0, y0: 0, x1: viewW, y1: viewH },
    zoom: 1,
  };
}

export function updateCamera(camera, focusX, focusY, lookX, lookY, dt, shake) {
  const tx = focusX + lookX - camera.viewW / 2;
  const ty = focusY + lookY - camera.viewH / 2;
  const k = Math.min(1, dt * 5);
  camera.x += (tx - camera.x) * k;
  camera.y += (ty - camera.y) * k;
  const maxX = Math.max(0, WORLD.width - camera.viewW);
  const maxY = Math.max(0, WORLD.height - camera.viewH);
  camera.x = Math.max(0, Math.min(maxX, camera.x));
  camera.y = Math.max(0, Math.min(maxY, camera.y));
  const sx = shake > 0 ? (Math.random() * 2 - 1) * shake : 0;
  const sy = shake > 0 ? (Math.random() * 2 - 1) * shake : 0;
  camera.view = {
    x0: camera.x + sx, y0: camera.y + sy,
    x1: camera.x + camera.viewW + sx, y1: camera.y + camera.viewH + sy,
  };
}

/** World → screen coordinates for the current camera. */
export function worldToScreen(camera, x, y) {
  return { x: x - camera.view.x0, y: y - camera.view.y0 };
}

/** Screen → world coordinates (mouse aiming, menu clicks). */
export function screenToWorld(camera, x, y) {
  return { x: x + camera.view.x0, y: y + camera.view.y0 };
}
