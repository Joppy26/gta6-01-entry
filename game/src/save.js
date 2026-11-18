// save.js — localStorage save/load for Del Rio: cash, story progress, garage
// cars and paint, sun discs, photo spots, and where Sol was standing. Versioned
// so an old save never crashes a new build.
import { SAVE_KEY } from './config.js';

export const SAVE_VERSION = 1;

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== SAVE_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    const data = {
      version: SAVE_VERSION,
      cash: state.cash,
      missionsDone: state.missionsDone,
      storyComplete: state.storyComplete,
      garage: state.garage,
      paint: state.paint,
      discsTaken: state.city.discs.filter((d) => d.taken).length,
      // Photo spots are positional: store which indices Sol already shot.
      photosTaken: state.city.photoSpots.map((s, i) => (s.taken ? i : -1)).filter((i) => i >= 0),
      playerX: state.player.inCar ? state.player.inCar.x : state.player.x,
      playerY: state.player.inCar ? state.player.inCar.y : state.player.y,
      hasPistol: state.player.hasPistol,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    state.saveFlash = 1.2;
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
