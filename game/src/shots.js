// shots.js — the four deterministic screenshot scenes behind ?shot=<name>&seed=1.
// Each one places the player, cars, police, pedestrians and mission state exactly,
// then the game runs forward with a small autopilot, so the frame is a real moment
// of play — cars moving, police lights flashing, dust in the air — and the same
// seed always gives the same frame.
import { CAR_COLORS, spawnCar } from './vehicles.js';
import { spawnTrafficCar } from './traffic.js';
import { spawnPedestrian } from './pedestrians.js';
import { startMission } from './missions.js';
import { makeRng } from './rng.js';

export const SHOT_NAMES = ['chase', 'mission', 'heist', 'roam'];

/** Add traffic cars on roads near (cx, cy) so the frame feels alive. */
function seedNearbyTraffic(state, cx, cy, n) {
  const rng = makeRng(99);
  let added = 0, tries = 0;
  while (added < n && tries < n * 12) {
    tries += 1;
    const car = spawnTrafficCar(state.city, rng);
    if (!car) continue;
    if (Math.hypot(car.x - cx, car.y - cy) > 700) continue;
    state.traffic.push(car);
    added += 1;
  }
}

function seedNearbyPeds(state, cx, cy, n) {
  const rng = makeRng(77);
  let added = 0, tries = 0;
  while (added < n && tries < n * 12) {
    tries += 1;
    const ped = spawnPedestrian(state.city, rng);
    if (!ped) continue;
    if (Math.hypot(ped.x - cx, ped.y - cy) > 650) continue;
    state.peds.push(ped);
    added += 1;
  }
}

function putPlayerInCar(state, x, y, angle, color, kindIndex) {
  const car = spawnCar(state.city, x, y, angle, color, kindIndex, { id: 'player-car' });
  state.cars.push(car);
  state.player.inCar = car;
  state.player.x = x; state.player.y = y;
  return car;
}

/** Stage one named scene on a fresh state. Returns the autopilot mode. */
export function stageShot(state, name) {
  state.screen = 'playing';
  state.cash = 2450;
  state.missionsDone = name === 'mission' ? 1 : name === 'heist' ? 4 : name === 'roam' ? 5 : 2;
  switch (name) {
    case 'chase': {
      // Cover: mid police chase on a palm avenue, 3 stars, downtown + river in frame.
      // Starts south so the frame lands downtown, where the city is densest.
      // Northbound lane (west side, x=1736) so oncoming traffic passes clean.
      const car = putPlayerInCar(state, 1736, 2100, 0, '#d94f3d', 2);
      car.speed = 380;
      state.policeSetHeat(3);
      state.setObjective('Escape the Del Rio police — lose the heat');
      state.addBanner('WANTED — Canyon Run', 4);
      state.dialogue = { who: 'RADIO', line: '…police are in pursuit of a red Canyon GT on Avenida Sol…' };
      seedNearbyTraffic(state, 1760, 1300, 8);
      seedNearbyPeds(state, 1760, 1300, 10);
      // Parked cars along the avenue for depth.
      state.cars.push(spawnCar(state.city, 1830, 1150, 0, '#3d7bd9', 0, { id: 'parked-1' }));
      state.cars.push(spawnCar(state.city, 1690, 980, 0, '#e8b93c', 3, { id: 'parked-2' }));
      state.cameraSnap(1760, 1400);
      return 'drive';
    }
    case 'mission': {
      // On foot at the riverwalk, mission 2 in progress, waypoint + dialogue visible.
      startMission(state, 1);
      state.player.inCar = null;
      state.player.x = 2880; state.player.y = 1560;
      state.player.hasPistol = true; state.player.ammo = 48;
      state.cash = 1250;
      state.dialogue = { who: 'DARIO', line: 'Third bench, north end. You’ll know it by the red ribbon. Take the pistol too — you’ll need it.' };
      seedNearbyTraffic(state, 2880, 1100, 5);
      seedNearbyPeds(state, 2880, 1100, 12);
      state.cars.push(spawnCar(state.city, 2720, 900, Math.PI / 2, '#7ab648', 0, { id: 'parked-3' }));
      state.cars.push(spawnCar(state.city, 2720, 1500, -Math.PI / 2, '#e8e2d2', 1, { id: 'parked-4' }));
      state.cameraSnap(2880, 1080);
      return 'walk';
    }
    case 'heist': {
      // The toll-bridge heist: player car + courier van on the bridge, police closing.
      startMission(state, 4);
      // Mission 5 step 0 is combat; jump to the ledger pickup step for the shot.
      state.mission.stepIndex = 1;
      state.setObjective('Grab the ledger from the van');
      // The van starts just west of the river so it is still mid-bridge at
      // screenshot time; the player follows it on in the south lane (y=824).
      const car = putPlayerInCar(state, 2720, 824, Math.PI / 2, '#22242a', 2);
      car.speed = 200;
      if (state.missionVan) {
        state.missionVan.x = 2900; state.missionVan.y = 800;
        state.missionVan.angle = Math.PI / 2; state.missionVan.speed = 200;
        state.missionVan.cruise = 200;
      }
      state.policeSetHeat(3);
      state.dialogue = { who: 'SOL', line: 'Ledger’s mine. Now the hard part — leaving.' };
      // Keep the bridge approach clear of slow traffic so the chase reads.
      state.traffic = state.traffic.filter((c) => !(Math.abs(c.y - 800) < 70 && c.x > 2500 && c.x < 3700));
      seedNearbyTraffic(state, 3200, 800, 4);
      state.traffic = state.traffic.filter((c) => !(Math.abs(c.y - 800) < 70 && c.x > 2500 && c.x < 3700));
      seedNearbyPeds(state, 3200, 800, 4);
      state.cameraSnap(3200, 800);
      return 'drive';
    }
    case 'roam': {
      // Free roam at the canyon overlook: Sol on foot beside a stolen sports car,
      // city + river + bridges below, taxi fare + stunt ramp in frame.
      state.player.inCar = null;
      state.player.x = 2880; state.player.y = 2500;
      state.player.hasPistol = true; state.player.ammo = 24;
      const car = spawnCar(state.city, 2940, 2540, Math.PI / 2, '#ff7a2a', 2, { id: 'player-car' });
      state.cars.push(car);
      state.setObjective('Free roam — Del Rio is yours');
      state.taxiFare = { x: 2770, y: 2400, reward: 120, active: true };
      state.addBanner('CANYON OVERLOOK — free roam', 4);
      state.dialogue = { who: 'SOL', line: 'Six jobs, one free driver, one sun-baked city. Not bad for a homecoming.' };
      seedNearbyTraffic(state, 2800, 2500, 5);
      seedNearbyPeds(state, 2800, 2500, 6);
      state.cameraSnap(2900, 2500);
      return 'idle';
    }
    default:
      return stageShot(state, 'chase');
  }
}

/** Scripted input so a staged scene stays in motion while the screenshot waits. */
export function shotAutopilot(state, mode, dt) {
  const input = { up: false, down: false, left: false, right: false, handbrake: false, sprint: false, jump: false };
  if (mode === 'drive' && state.player.inCar) {
    const car = state.player.inCar;
    // Heist: cruise behind the van instead of rear-ending it — the shot wants
    // the chase, not a pile-up. Chase: flat out.
    input.up = state.shotName === 'heist' ? car.speed < 220 : true;
    // Gentle steering to hold the lane: chase northbound (x=1736), heist
    // eastbound in the south lane (y=824).
    if (state.shotName === 'chase') {
      if (car.x < 1724) input.right = true;
      if (car.x > 1748) input.left = true;
    }
    if (state.shotName === 'heist') {
      if (car.y < 812) input.right = true;
      if (car.y > 836) input.left = true;
    }
  }
  if (mode === 'walk') {
    input.up = true; // walk north toward the riverwalk pickup
  }
  return input;
}
