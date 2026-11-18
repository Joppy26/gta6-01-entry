// main.js — DEL RIO boot + game loop + state machine. Builds the whole game
// state, runs the fixed-step simulation, owns entering/stealing cars, taxi fares,
// stunt jumps, sun discs, photo spots, speeding heat, the garage and saves,
// and paints the world + HUD/menus.
import { CAR, HIGHWAY_Y, PHOTO_REWARD, PLAYER, SEED, SHOT_SEED, STUNT_REWARD, SUN_DISC_REWARD, TAXI_REWARD, WANTED, WORLD } from './config.js';
import { makeRng } from './rng.js';
import { buildCity, drawCity, isSolidAt, nearestRoadPoint } from './city.js';
import { spawnPlayer, updatePlayerOnFoot, drawPlayer, damagePlayer } from './player.js';
import { spawnCar, driveCar, drawCar, carSpeedKmh, CAR_COLORS } from './vehicles.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { spawnPedestrians, updatePedestrians, drawPedestrian, spawnGuard } from './pedestrians.js';
import { createWanted, addHeat, setHeat, updateWanted, clearWanted } from './police.js';
import { MISSIONS, startMission, updateMission, currentStep, missionWaypoint, failMission } from './missions.js';
import { createCombat, punch, shootPistol, updateGuardsCombat, updateCombat } from './combat.js';
import { createEffects, updateEffects, drawEffects, burstDust, burstSmoke, burstSparks, burstSiren, burstFlash, addSkid } from './effects.js';
import { createSfx, unlockAudio, sfxApi } from './sfx.js';
import { createRadio, startRadio, stopRadio, switchStation, currentStationName } from './radio.js';
import { readSave, writeSave } from './save.js';
import { createInput, ACTION_INTERACT, ACTION_PUNCH, ACTION_PAUSE, ACTION_JUMP, ACTION_RADIO, ACTION_MUTE, ACTION_TAXI, ACTION_CONFIRM, ACTION_GARAGE } from './input.js';
import { createCamera, updateCamera, screenToWorld } from './camera.js';
import { drawHUD, drawMenu } from './hud.js';
import { stageShot, shotAutopilot, SHOT_NAMES } from './shots.js';
import { spawnCourierVan, updateCourierVan } from './traffic.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : SEED;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (state) { state.camera.viewW = canvas.width; state.camera.viewH = canvas.height; }
}
window.addEventListener('resize', resize);

// ---- state ---------------------------------------------------------------

const sfxObj = createSfx();
const state = {
  time: 0, clock: 17 * 60 + 40, cash: 150, missionsDone: 0, storyComplete: false,
  garage: [], paint: '#d94f3d', discsGot: 0, photosGot: 0, screen: 'menu', saveFlash: 0,
  objective: 'Welcome to Del Rio — press Enter to start',
  dialogue: null, taxiFare: null, missionVan: null, missionGuards: [],
  mission: null, missionTailDist: 0, briefingIndex: 0, saveData: readSave(),
  shake: 0, shotName, shotMode: null, shotFrames: 0, shotReady: false,
  speedingTimer: 0,
  sessionRng: makeRng(seed),
  city: buildCity(SEED),
  player: spawnPlayer(600, 640),
  cars: [], traffic: [], peds: [],
  wanted: createWanted(), combat: createCombat(), effects: createEffects(),
  radio: createRadio(), camera: null, menuRects: [],
  waypoint: null, missionStep: null, missionTimer: 0,
};
state.camera = createCamera(window.innerWidth, window.innerHeight);
state.sfx = {
  punch: () => sfxApi.punch(sfxObj),
  swing: () => sfxApi.swing(sfxObj),
  gunshot: (d) => sfxApi.gunshot(sfxObj, d),
  crash: () => sfxApi.crash(sfxObj),
  pickup: () => sfxApi.pickup(sfxObj),
  mission: () => sfxApi.mission(sfxObj),
  busted: () => sfxApi.busted(sfxObj),
  click: () => sfxApi.click(sfxObj),
};
resize();

// Seed the world: parked cars, traffic, pedestrians. The city is big
// (3840x2880), so the streets need enough cars and walkers to feel alive.
(function seedWorld() {
  const rng = makeRng(SEED + 3);
  const parked = [
    [800, 900, 0], [1280, 1100, Math.PI / 2], [1760, 2250, 0], [2240, 900, -Math.PI / 2],
    [900, 1760, Math.PI], [2720, 2100, Math.PI / 2], [3600, 1300, 0], [1400, 2620, Math.PI / 2],
  ];
  for (const [x, y, a] of parked) {
    state.cars.push(spawnCar(state.city, x, y, a, rng.pick(CAR_COLORS), rng.int(0, 3), { id: `parked-${x}-${y}` }));
  }
  state.traffic = spawnTraffic(state.city, 24, makeRng(SEED + 5));
  state.peds = spawnPedestrians(state.city, 34, makeRng(SEED + 9));
})();

// ---- state helpers (called by the systems) --------------------------------

state.setScreen = (s) => { state.screen = s; };
state.setObjective = (t) => { state.objective = t; };
state.addBanner = (text, seconds = 3) => { state.effects.banners.push({ text, time: seconds }); };
state.addHeat = (kind) => addHeat(state.wanted, kind, state.time);
state.policeSetHeat = (stars) => setHeat(state.wanted, stars, state.time);
state.clearWantedSoft = () => {
  state.wanted.stars = 0; state.wanted.heat = 0; state.wanted.maxStars = 0;
  state.wanted.decayTimer = 0;
};
state.addEffect = (kind, x, y) => {
  if (kind === 'pickup') { burstSparks(state, x, y, 12); state.sfx.pickup(); }
  else if (kind === 'hit') burstSparks(state, x, y, 8);
  else if (kind === 'muzzle') burstSparks(state, x, y, 3);
  else if (kind === 'siren') burstSiren(state, x, y);
  else if (kind === 'flash') burstFlash(state, x, y);
};
state.hurtPlayer = (amount) => {
  if (damagePlayer(state.player, amount)) {
    clearWanted(state.wanted);
    state.sfx.busted();
    state.setScreen('wasted');
  }
};
state.wreckPlayerCar = () => {
  const car = state.player.inCar;
  if (!car) return;
  burstSmoke(state, car.x, car.y, 10);
  state.addBanner('Car wrecked — get out!', 3);
  state.sfx.crash();
};
state.scarePeds = (x, y, radius) => {
  for (const p of state.peds) {
    if (Math.hypot(p.x - x, p.y - y) < radius) p.fleeing = 2.5;
  }
};
state.spawnCourierVan = (onBridge = false) => {
  const waypoints = [
    { x: 1280, y: 800 }, { x: 2240, y: 800 }, { x: 2720, y: 800 },
    { x: 3200, y: 800 }, { x: 3600, y: 800 }, { x: 3600, y: 1760 },
  ];
  state.missionVan = spawnCourierVan(state.city, waypoints);
  if (onBridge) { state.missionVan.x = 3200; state.missionVan.y = 800; state.missionVan.wpIndex = 4; }
  state.cars.push(state.missionVan);
};
state.spawnGuards = () => {
  // All four stand ON the toll-bridge deck (y 752–848): a guard at y=860
  // would be standing in the river.
  state.missionGuards = [
    spawnGuard(state.city, 3150, 760),
    spawnGuard(state.city, 3250, 840),
    spawnGuard(state.city, 3180, 845),
    spawnGuard(state.city, 3280, 760),
  ];
};
state.saveGame = () => { writeSave(state); };
state.cameraSnap = (x, y) => {
  state.camera.x = Math.max(0, Math.min(WORLD.width - state.camera.viewW, x - state.camera.viewW / 2));
  state.camera.y = Math.max(0, Math.min(WORLD.height - state.camera.viewH, y - state.camera.viewH / 2));
  state.camera.view = { x0: state.camera.x, y0: state.camera.y, x1: state.camera.x + state.camera.viewW, y1: state.camera.y + state.camera.viewH };
};

function announce(message) { statusEl.textContent = message; }

// ---- car enter / exit / steal ---------------------------------------------

function nearestCar(maxDist) {
  const p = state.player;
  let best = null, bestD = maxDist;
  for (const car of [...state.cars, ...state.traffic]) {
    if (car === state.missionVan) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

/** The nearest untaken photo spot within range, if Sol is on foot there. */
function nearestPhotoSpot() {
  const p = state.player;
  if (p.inCar) return null;
  for (const s of state.city.photoSpots) {
    if (!s.taken && Math.hypot(p.x - s.x, p.y - s.y) < PLAYER.photoRange) return s;
  }
  return null;
}

function takePhoto() {
  const spot = nearestPhotoSpot();
  if (!spot) return false;
  spot.taken = true;
  state.photosGot += 1;
  state.cash += PHOTO_REWARD;
  state.addEffect('flash', spot.x, spot.y);
  state.addBanner(`📷 ${spot.label} — +$${PHOTO_REWARD}`, 3);
  state.sfx.pickup();
  state.saveGame();
  return true;
}

function enterCar() {
  const car = nearestCar(PLAYER.enterRange);
  if (!car) return;
  const wasTraffic = state.traffic.includes(car);
  if (wasTraffic) {
    state.traffic = state.traffic.filter((c) => c !== car);
    state.cars.push(car);
  }
  state.player.inCar = car;
  car.driver = 'player';
  car.speed = 0;
  state.addHeat('steal');
  state.addBanner(`Stole a ${car.kind}`, 2);
  state.sfx.click();
  if (car.police) state.addHeat('steal');
}

function exitCar() {
  const car = state.player.inCar;
  if (!car || Math.abs(car.speed) > 120) return;
  const px = car.x - Math.cos(car.angle) * 40;
  const py = car.y - Math.sin(car.angle) * 40;
  if (!isSolidAt(state.city, px, py, 16)) { state.player.x = px; state.player.y = py; }
  else { state.player.x = car.x + 44; state.player.y = car.y; }
  state.player.angle = car.angle;
  state.player.inCar = null;
  car.driver = null;
  car.speed = 0;
}

// ---- taxi fares, stunts, discs, garage ------------------------------------

function startTaxiFare() {
  if (state.taxiFare || !state.player.inCar) return;
  const p = state.player.inCar;
  const dest = nearestRoadPoint(p.x + 900, p.y + 600);
  state.taxiFare = { x: dest.x, y: dest.y, reward: TAXI_REWARD, active: true };
  state.setObjective('Taxi fare — drive the passenger to the marker');
  state.addBanner(`TAXI FARE — $${TAXI_REWARD}`, 3);
}

function updateSideActivities(dt) {
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  // Sun discs.
  for (const d of state.city.discs) {
    if (!d.taken && Math.hypot(px - d.x, py - d.y) < 30) {
      d.taken = true;
      state.discsGot += 1;
      state.cash += SUN_DISC_REWARD;
      state.addBanner(`SUN DISC +$${SUN_DISC_REWARD}`, 2);
      state.sfx.pickup();
    }
  }
  // Taxi fare delivery.
  if (state.taxiFare && Math.hypot(px - state.taxiFare.x, py - state.taxiFare.y) < 90) {
    state.cash += state.taxiFare.reward;
    state.addBanner(`FARE PAID +$${state.taxiFare.reward}`, 3);
    state.taxiFare = null;
    state.setObjective(state.mission ? currentStep(state)?.text ?? 'Free roam' : 'Free roam — Del Rio is yours');
    state.sfx.mission();
  }
  // Stunt jumps on the highway ramps.
  if (p.inCar && Math.abs(p.inCar.speed) > 350) {
    for (const r of state.city.ramps) {
      if (Math.hypot(px - r.x, py - r.y) < 60 && !r.cooldown) {
        r.cooldown = 5;
        state.cash += STUNT_REWARD;
        state.addBanner(`STUNT JUMP! +$${STUNT_REWARD}`, 3);
        burstDust(state, px, py, 14);
        state.shake = 8;
        state.sfx.crash();
      }
    }
  }
  for (const r of state.city.ramps) r.cooldown = Math.max(0, (r.cooldown ?? 0) - dt);
}

/** Speeding past a patrol car adds heat — the 'speeding' crime used to be
 *  dead config no system ever raised. Ticked at most once per interval. */
function updateSpeedingHeat(dt) {
  state.speedingTimer = Math.max(0, state.speedingTimer - dt);
  const car = state.player.inCar;
  if (!car || state.speedingTimer > 0) return;
  if (Math.abs(car.speed) < WANTED.speedingSpeed) return;
  const nearPolice = state.wanted.policeCars.some((c) => Math.hypot(c.x - car.x, c.y - car.y) < WANTED.speedingNearPolice);
  if (!nearPolice) return;
  state.speedingTimer = WANTED.speedingInterval;
  state.addHeat('speeding');
  state.addBanner('SPEEDING — the patrol saw you', 2);
}

function buyCar(id, price, kindIndex, color) {
  if (state.cash < price || state.garage.includes(id)) return;
  state.cash -= price;
  state.garage.push(id);
  const car = spawnCar(state.city, 700, 640, 0, color, kindIndex, { id });
  state.cars.push(car);
  state.addBanner(`Bought a ${car.kind} — parked at the garage`, 3);
  state.saveGame();
}

// ---- menu actions -----------------------------------------------------------

function menuAction(id) {
  state.sfx.click();
  switch (id) {
    case 'continue': {
      const s = state.saveData;
      if (s) {
        state.cash = s.cash; state.missionsDone = s.missionsDone;
        state.storyComplete = s.storyComplete; state.garage = s.garage ?? [];
        state.paint = s.paint ?? state.paint; state.discsGot = s.discsTaken ?? 0;
        state.player.x = s.playerX ?? 600; state.player.y = s.playerY ?? 640;
        state.player.hasPistol = s.hasPistol ?? state.player.hasPistol;
        // Restore taken photo spots by index (older saves have none).
        const taken = s.photosTaken ?? [];
        state.city.photoSpots.forEach((spot, i) => { spot.taken = taken.includes(i); });
        state.photosGot = state.city.photoSpots.filter((spot) => spot.taken).length;
        state.setObjective(state.missionsDone >= 6 ? 'Free roam — Del Rio is yours' : `Next job: ${MISSIONS[state.missionsDone].title}`);
      }
      state.setScreen('playing');
      break;
    }
    case 'new':
      state.cash = 150; state.missionsDone = 0; state.storyComplete = false;
      state.garage = []; state.discsGot = 0; state.photosGot = 0;
      for (const d of state.city.discs) d.taken = false;
      for (const s of state.city.photoSpots) s.taken = false;
      state.player.x = 600; state.player.y = 640; state.player.inCar = null; state.player.health = 100;
      state.player.hasPistol = false; state.player.ammo = 0;
      state.briefingIndex = 0;
      state.setScreen('briefing');
      break;
    case 'missions': state.setScreen('missionSelect'); break;
    case 'controls': state.setScreen('controls'); break;
    case 'back': state.setScreen(state.returnScreen ?? 'menu'); break;
    case 'resume': state.setScreen('playing'); break;
    case 'quit': state.setScreen('menu'); state.saveGame(); break;
    case 'garage': state.returnScreen = state.screen; state.setScreen('garage'); break;
    case 'roam': state.mission = null; state.setObjective('Free roam — Del Rio is yours'); state.setScreen('playing'); break;
    case 'nextMission':
      if (state.missionsDone < 6) { state.briefingIndex = state.missionsDone; state.setScreen('briefing'); }
      else { state.mission = null; state.setScreen('playing'); }
      break;
    case 'retry': if (state.mission) startMission(state, state.mission.index); break;
    case 'respawn':
      state.player.health = 100; state.player.x = 600; state.player.y = 640;
      state.player.inCar = null; state.cash = Math.max(0, state.cash - 200);
      clearWanted(state.wanted);
      state.setObjective('Free roam — Del Rio is yours');
      state.setScreen('playing');
      break;
    case 'startMission': startMission(state, state.briefingIndex); break;
    case 'buy-gt': buyCar('buy-gt', 1500, 2, '#ff7a2a'); break;
    case 'buy-van': buyCar('buy-van', 800, 1, '#e8e2d2'); break;
    case 'buy-taxi': buyCar('buy-taxi', 600, 3, '#ffd23e'); break;
    default:
      if (id.startsWith('mission-')) {
        state.briefingIndex = Number(id.slice(8));
        state.setScreen('briefing');
      } else if (id.startsWith('paint-')) {
        const colors = ['#d94f3d', '#3d7bd9', '#e8b93c', '#7ab648', '#ff7a2a'];
        const color = colors[Number(id.slice(6))];
        if (state.cash >= 100 && state.paint !== color) {
          state.cash -= 100; state.paint = color;
          if (state.player.inCar) state.player.inCar.color = color;
          state.saveGame();
        }
      }
      break;
  }
}

// ---- simulation step ---------------------------------------------------------

const input = createInput(canvas);

function step(dt) {
  state.time += dt;
  state.clock += dt * 0.5;
  state.saveFlash = Math.max(0, state.saveFlash - dt);
  const actions = input.takeActions();
  const mouse = input.mouse();

  // Menus eat input; the world waits.
  if (state.screen !== 'playing') {
    if (state.screen === 'paused' && (actions & ACTION_PAUSE)) { state.setScreen('playing'); return; }
    if (mouse.clicked) {
      for (const r of state.menuRects) {
        if (r.enabled !== false && mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h) {
          menuAction(r.id);
          break;
        }
      }
    }
    if ((actions & ACTION_CONFIRM) && (state.screen === 'menu' || state.screen === 'missionComplete' || state.screen === 'missionFailed')) {
      if (state.screen === 'menu') menuAction(state.saveData ? 'continue' : 'new');
      else if (state.screen === 'missionComplete') menuAction('nextMission');
      else menuAction('retry');
    }
    return;
  }

  // Pause / radio / mute.
  if (actions & ACTION_PAUSE) { state.setScreen('paused'); state.returnScreen = 'menu'; state.saveGame(); return; }
  if (actions & ACTION_RADIO) { state.addBanner(switchStation(state.radio, sfxObj), 2); }
  if (actions & ACTION_MUTE) {
    sfxObj.muted = !sfxObj.muted;
    state.addBanner(sfxObj.muted ? 'Muted' : 'Sound on', 2);
  }
  if (actions & ACTION_TAXI) startTaxiFare();
  if (actions & ACTION_GARAGE) {
    if (!state.player.inCar && Math.hypot(state.player.x - 600, state.player.y - 560) < 200) {
      state.returnScreen = 'playing';
      state.setScreen('garage');
    }
  }
  if (actions & ACTION_INTERACT) {
    // On foot at a photo spot, E takes the picture instead of grabbing a car.
    if (state.player.inCar) exitCar();
    else if (!takePhoto()) enterCar();
  }
  if (actions & ACTION_PUNCH) punch(state);
  if (actions & ACTION_JUMP) state.player.jump = true;

  // Shot autopilot overrides held keys in screenshot mode.
  let held = input.held;
  if (state.shotMode) held = shotAutopilot(state, state.shotMode, dt);

  const p = state.player;
  if (p.inCar) {
    const car = p.inCar;
    const before = { x: car.x, y: car.y };
    // Police pursuit cars are NOT in the bump list: their ram code (damage +
    // a small speed cost) and their separation rule handle contact, so four
    // converging patrol cars cannot shove the player off the road. Roadblocks
    // do block: they are parked across the road ahead.
    const result = driveCar(state.city, car, held, dt, [...state.traffic, ...state.cars, ...state.wanted.roadblocks]);
    if (result.hitWall && Math.abs(car.speed) > 200) { state.shake = 8; state.sfx.crash(); burstSmoke(state, car.x, car.y, 3); }
    if (result.hitCar && Math.abs(car.speed) > 200) { state.shake = 6; state.sfx.crash(); }
    if (car.skid > 0 && Math.abs(car.speed) > 150) {
      addSkid(state, before.x, before.y, car.x, car.y);
      if (state.sessionRng.chance(0.5)) burstDust(state, car.x, car.y, 1);
    }
    if (Math.abs(car.speed) > 300 && state.sessionRng.chance(0.1)) burstDust(state, car.x, car.y, 1);
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    sfxApi.engine(sfxObj, Math.abs(car.speed) / CAR.maxSpeed);
    // Shooting from the car window.
    if (mouse.clicked && p.hasPistol) {
      const w = screenToWorld(state.camera, mouse.x, mouse.y);
      shootPistol(state, w.x, w.y);
    }
  } else {
    updatePlayerOnFoot(state.city, p, { ...held, jump: !!p.jump }, dt);
    p.jump = false;
    sfxApi.engineOff(sfxObj);
    // Sprinting kicks up dust on the sun-baked streets.
    if (p.moving && held.sprint && state.sessionRng.chance(0.25)) burstDust(state, p.x, p.y + 10, 1);
    if (mouse.clicked && p.hasPistol) {
      const w = screenToWorld(state.camera, mouse.x, mouse.y);
      shootPistol(state, w.x, w.y);
    }
  }

  // Traffic, peds, police, missions, combat, effects. Traffic brakes for
  // everything on the road — other traffic, parked cars, police, the courier
  // van, and Sol herself on foot — so a chase queues up instead of clipping.
  const trafficObstacles = [
    ...state.traffic, ...state.cars,
    ...state.wanted.policeCars, ...state.wanted.roadblocks,
    ...(state.missionVan ? [state.missionVan] : []),
    ...(p.inCar ? [p.inCar] : [{ x: p.x, y: p.y, speed: 0 }]),
  ];
  updateTraffic(state.city, state.traffic, dt, state.sessionRng, trafficObstacles);
  updatePedestrians(state.city, state.peds, dt, state.sessionRng, state.combat.muzzle > 0 ? { x: p.x, y: p.y } : null);
  if (state.missionVan) updateCourierVan(state.city, state.missionVan, dt);
  updateWanted(state, dt);
  updateMission(state, dt);
  updateGuardsCombat(state, dt);
  updateCombat(state, dt);
  updateEffects(state, dt);
  updateSideActivities(dt);
  updateSpeedingHeat(dt);

  // Wanted siren + police proximity sound.
  sfxApi.siren(sfxObj, state.wanted.policeCars.length > 0);

  // Camera follows the player, looking ahead at speed.
  const fx = p.inCar ? p.inCar.x : p.x;
  const fy = p.inCar ? p.inCar.y : p.y;
  const lookX = p.inCar ? Math.sin(p.inCar.angle) * Math.min(90, Math.abs(p.inCar.speed) * 0.18) : 0;
  const lookY = p.inCar ? -Math.cos(p.inCar.angle) * Math.min(90, Math.abs(p.inCar.speed) * 0.18) : 0;
  updateCamera(state.camera, fx, fy, lookX, lookY, dt, state.effects.shake + state.shake);
  state.shake = Math.max(0, state.shake - dt * 30);

  // HUD state.
  state.waypoint = state.mission ? missionWaypoint(state) : (state.taxiFare ? { x: state.taxiFare.x, y: state.taxiFare.y } : null);
  state.missionStep = currentStep(state);
  state.missionTimer = state.mission ? state.mission.timer : 0;
  const stepDef = currentStep(state);
  state.dialogue = stepDef?.dialogue ? { who: stepDef.dialogue[0], line: stepDef.dialogue[1] } : null;
}

// ---- rendering ----------------------------------------------------------------

function drawWaypointBeacon() {
  const wp = state.waypoint;
  if (!wp || state.screen !== 'playing') return;
  const pulse = 1 + Math.sin(state.time * 4) * 0.15;
  ctx.fillStyle = 'rgba(255,225,77,0.16)';
  ctx.fillRect(wp.x - 26, wp.y - 260, 52, 260);
  ctx.fillStyle = '#ffe14d';
  ctx.save();
  ctx.translate(wp.x, wp.y);
  ctx.rotate(Math.PI / 4 + state.time * 0.8);
  const s = 16 * pulse;
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.restore();
  ctx.strokeStyle = '#ffe14d';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(wp.x, wp.y, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#241505';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const p = state.player;
  const d = Math.round(Math.hypot((p.inCar ? p.inCar.x : p.x) - wp.x, (p.inCar ? p.inCar.y : p.y) - wp.y));
  ctx.fillText(`${d}m`, wp.x, wp.y - 44);
}

function draw() {
  const viewW = canvas.width, viewH = canvas.height;
  ctx.clearRect(0, 0, viewW, viewH);
  if (state.screen === 'playing' || state.screen === 'paused' || state.screen === 'busted' || state.screen === 'wasted') {
    const cam = state.camera.view;
    ctx.save();
    ctx.translate(-cam.x0, -cam.y0);
    drawCity(ctx, state.city, state.camera, state.time);
    drawWaypointBeacon();
    // Taxi fare marker.
    if (state.taxiFare) {
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath(); ctx.arc(state.taxiFare.x, state.taxiFare.y, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', state.taxiFare.x, state.taxiFare.y + 5);
    }
    for (const car of state.cars) drawCar(ctx, car, state.time);
    for (const car of state.traffic) drawCar(ctx, car, state.time);
    for (const car of state.wanted.policeCars) drawCar(ctx, car, state.time);
    for (const car of state.wanted.roadblocks) drawCar(ctx, car, state.time);
    for (const g of state.missionGuards) if (g.health > 0) drawPedestrian(ctx, g, state.time);
    for (const o of state.wanted.officers) drawPedestrian(ctx, o, state.time);
    for (const ped of state.peds) if (ped.health > 0) drawPedestrian(ctx, ped, state.time);
    if (state.player.inCar) drawCar(ctx, state.player.inCar, state.time, true);
    else drawPlayer(ctx, state.player, state.time);
    // Tracers.
    for (const t of state.combat.tracers) {
      ctx.strokeStyle = t.enemy ? '#ff6a5e' : '#ffe14d';
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = Math.max(0, t.life / 0.12);
      ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Muzzle flash.
    if (state.combat.muzzle > 0) {
      const px = state.player.inCar ? state.player.inCar.x : state.player.x;
      const py = state.player.inCar ? state.player.inCar.y : state.player.y;
      ctx.fillStyle = 'rgba(255,220,90,0.9)';
      ctx.beginPath(); ctx.arc(px, py, 18, 0, Math.PI * 2); ctx.fill();
    }
    drawEffects(ctx, state);
    ctx.restore();
    drawHUD(ctx, state, viewW, viewH);
    if (state.screen === 'paused') {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, viewW, viewH);
      state.menuRects = drawMenu(ctx, state, viewW, viewH);
    }
    if (state.screen === 'busted' || state.screen === 'wasted') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, viewW, viewH);
      state.menuRects = drawMenu(ctx, state, viewW, viewH);
    }
  } else {
    state.menuRects = drawMenu(ctx, state, viewW, viewH);
  }
}

// ---- main loop -----------------------------------------------------------------

function frame(now) {
  requestAnimationFrame(frame);
  if (state.shotMode && state.shotReady) { draw(); return; }
  const dtMs = Math.min((now - (frame.last ?? now)) / 1000, MAX_FRAME);
  frame.last = now;
  let acc = (frame.acc ?? 0) + dtMs;
  let steps = 0;
  while (acc >= STEP && steps < 8) {
    step(STEP);
    acc -= STEP;
    steps += 1;
    if (state.shotMode) {
      state.shotFrames += 1;
      if (state.shotFrames >= 150) { state.shotReady = true; window.__shotReady = true; }
    }
  }
  frame.acc = acc;
  draw();
}

function announceScreen() {
  announce('DEL RIO — a sun-baked getaway. Press Enter or click to start. WASD to move, E to enter a car.');
}

// ---- boot ----------------------------------------------------------------------

if (shotName && SHOT_NAMES.includes(shotName)) {
  state.sessionRng = makeRng(SHOT_SEED);
  state.shotMode = stageShot(state, shotName);
  state.cameraSnap(state.player.inCar ? state.player.inCar.x : state.player.x, state.player.inCar ? state.player.inCar.y : state.player.y);
  // Re-centre the camera on the staged focus, then let the loop run the scene.
  const fx = state.player.inCar ? state.player.inCar.x : state.player.x;
  const fy = state.player.inCar ? state.player.inCar.y : state.player.y;
  state.camera.x = Math.max(0, Math.min(WORLD.width - state.camera.viewW, fx - state.camera.viewW / 2));
  state.camera.y = Math.max(0, Math.min(WORLD.height - state.camera.viewH, fy - state.camera.viewH / 2));
  window.__shotReady = false;
  announce(`Screenshot scene: ${shotName}.`);
} else {
  announceScreen();
  canvas.addEventListener('pointerdown', () => {
    unlockAudio(sfxObj);
    if (!state.radio.playing) startRadio(state.radio, sfxObj);
  }, { once: false });
  window.addEventListener('keydown', () => {
    unlockAudio(sfxObj);
    if (!state.radio.playing) startRadio(state.radio, sfxObj);
  }, { once: false });
}

// Exposed for playtests: a small read-only summary of live game state.
window.__dbg = { walls: 0, bumps: 0, rams: 0, maxImpact: 0 };
window.__delrioDebug = () => {
  const p = state.player.inCar ?? state.player;
  return {
    police: state.wanted.policeCars.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y), d: Math.round(Math.hypot(c.x - p.x, c.y - p.y)), speed: Math.round(c.speed) })),
    roadblocks: state.wanted.roadblocks.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y) })),
    trafficNear: state.traffic.filter((c) => Math.hypot(c.x - p.x, c.y - p.y) < 200).map((c) => ({ x: Math.round(c.x), y: Math.round(c.y), speed: Math.round(c.speed) })),
    carsNear: state.cars.filter((c) => c !== state.player.inCar && Math.hypot(c.x - p.x, c.y - p.y) < 200).map((c) => ({ id: c.id, x: Math.round(c.x), y: Math.round(c.y) })),
  };
};
// Playtest warp: move Sol (and her car, if any) to a world point and centre
// the camera there. Used by the Playwright probes; invisible in normal play.
window.__delrioWarp = (x, y, angle) => {
  const p = state.player;
  if (p.inCar) {
    p.inCar.x = x; p.inCar.y = y; p.inCar.speed = 0;
    if (typeof angle === 'number') p.inCar.angle = angle;
  }
  p.x = x; p.y = y;
  if (typeof angle === 'number') p.angle = angle;
  state.cameraSnap(x, y);
  return window.__delrio();
};
window.__delrio = () => ({
  screen: state.screen,
  cash: state.cash,
  stars: state.wanted.stars,
  health: Math.round(state.player.health),
  inCar: !!state.player.inCar,
  speedKmh: state.player.inCar ? carSpeedKmh(state.player.inCar) : 0,
  mission: state.mission ? { id: state.mission.def.id, title: state.mission.def.title, step: state.mission.stepIndex } : null,
  missionsDone: state.missionsDone,
  traffic: state.traffic.length,
  peds: state.peds.length,
  policeCars: state.wanted.policeCars.length,
  van: state.missionVan ? { x: Math.round(state.missionVan.x), y: Math.round(state.missionVan.y), speed: Math.round(state.missionVan.speed) } : null,
  carHealth: state.player.inCar ? Math.round(state.player.inCar.health) : null,
  guards: state.missionGuards.filter((g) => g.health > 0).length,
  objective: state.objective,
  discsGot: state.discsGot,
  photosGot: state.photosGot,
  ammo: state.player.ammo,
  x: Math.round(state.player.inCar ? state.player.inCar.x : state.player.x),
  y: Math.round(state.player.inCar ? state.player.inCar.y : state.player.y),
});

requestAnimationFrame(frame);
