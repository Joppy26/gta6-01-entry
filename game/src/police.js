// police.js — the wanted system: stars rise on crime, police cars spawn and
// chase, roadblocks appear at 3+ stars, foot officers close in at low heat, and
// stars decay when the player stays clean and out of sight. Slipping a big
// chase clean pays a getaway bonus. Also owns the "busted" outcome.
import { WANTED, WORLD } from './config.js';
import { spawnPoliceCar } from './vehicles.js';
import { moveWithCollision, nearestRoadPoint } from './city.js';
import { makeRng } from './rng.js';

export function createWanted() {
  return {
    stars: 0, heat: 0, // heat 0..5, stars = floor(heat) while heat > 0
    maxStars: 0, // highest stars reached this chase (drives the getaway bonus)
    lastCrimeAt: -999, lastSeenAt: -999,
    policeCars: [], officers: [], roadblocks: [],
    bustedTimer: 0, busted: false,
    decayTimer: 0,
  };
}

export function addHeat(wanted, kind, now) {
  const amount = WANTED.crimeHeat[kind] ?? 1;
  wanted.heat = Math.min(WANTED.maxStars, wanted.heat + amount);
  wanted.stars = Math.max(1, Math.ceil(wanted.heat));
  wanted.maxStars = Math.max(wanted.maxStars, wanted.stars);
  wanted.lastCrimeAt = now;
  wanted.lastSeenAt = now;
}

export function setHeat(wanted, stars, now) {
  wanted.heat = stars;
  wanted.stars = stars;
  wanted.maxStars = Math.max(wanted.maxStars, stars);
  wanted.lastCrimeAt = now;
  wanted.lastSeenAt = now;
}

function pickSpawnPoint(px, py, rng) {
  // Spawn on a road 500–700 px away, off-screen in one of the cardinal directions.
  for (let tries = 0; tries < 8; tries++) {
    const angle = rng.range(0, Math.PI * 2);
    const dist = rng.range(520, 700);
    const p = nearestRoadPoint(px + Math.cos(angle) * dist, py + Math.sin(angle) * dist);
    if (Math.hypot(p.x - px, p.y - py) > 420) return p;
  }
  return nearestRoadPoint(px + 600, py);
}

/** Keep the pursuit sized to the stars: spawn fresh patrol cars, retire extras. */
function sizePursuit(state, rng, px, py) {
  const { wanted } = state;
  const wantCars = wanted.stars === 0 ? 0 : Math.min(1 + wanted.stars, 6);
  while (wanted.policeCars.length < wantCars) {
    const spawn = pickSpawnPoint(px, py, rng);
    const car = spawnPoliceCar(state.city, spawn.x, spawn.y, rng.range(0, Math.PI * 2));
    wanted.policeCars.push(car);
    state.addEffect('siren', spawn.x, spawn.y);
  }
  while (wanted.policeCars.length > wantCars) wanted.policeCars.pop();
}

/** Foot officers only at low heat, only while the player is on foot — they do
 *  the arresting; patrol cars never run a pedestrian down. */
function sizeOfficers(state, rng, px, py) {
  const { wanted, player } = state;
  const wantOfficers = wanted.stars >= 1 && wanted.stars <= 2 && !player.inCar ? 2 : 0;
  while (wanted.officers.length < wantOfficers) {
    const spawn = pickSpawnPoint(px, py, rng);
    wanted.officers.push({
      x: spawn.x, y: spawn.y, angle: 0, speed: 150, walkPhase: 0,
      shirt: '#1c3a6e', skin: '#e8b48c', guard: false, health: 50, officer: true,
      id: `officer-${rng.int(0, 99999)}`,
    });
  }
  while (wanted.officers.length > wantOfficers) wanted.officers.pop();
}

/** Roadblocks at 3+ stars: two police cars parked across the road ahead. */
function updateRoadblocks(state, px, py) {
  const { wanted } = state;
  if (wanted.stars >= 3 && wanted.roadblocks.length === 0) {
    const ahead = nearestRoadPoint(px + 500, py);
    const rb = [
      spawnPoliceCar(state.city, ahead.x - 30, ahead.y - 24, 0),
      spawnPoliceCar(state.city, ahead.x + 30, ahead.y + 24, 0),
    ];
    for (const c of rb) { c.speed = 0; c.roadblock = true; }
    wanted.roadblocks = rb;
  }
  if (wanted.stars < 3) wanted.roadblocks = [];
}

/** One patrol car chasing the player: steer at them, ram once per frame max
 *  across all cars, and rest 95 px off instead of parking inside the player —
 *  overlapping is what turned every ram into a dead stop. */
function chaseCar(state, car, px, py, dt, ramState) {
  const { wanted, player, city, time } = state;
  const dx = px - car.x, dy = py - car.y;
  const dist = Math.hypot(dx, dy) || 1;
  const want = Math.atan2(dx, -dy);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  // Chase speed: fast from afar, a slow nudge up close — a police car that
  // parks inside the player would pin them in place, so it backs off.
  const targetSpeed = dist > 300 ? 520 : (player.inCar ? (dist < 90 ? 60 : 470) : (dist < 110 ? 0 : 200));
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.4);
  const nx = car.x + Math.sin(car.angle) * car.speed * dt;
  const ny = car.y - Math.cos(car.angle) * car.speed * dt;
  // Police slide around buildings instead of stopping dead.
  const moved = moveWithCollision(city, car.x, car.y, nx - car.x, ny - car.y, 26);
  car.x = moved.x; car.y = moved.y;
  car.siren = time;
  // Separation: a patrol car rests against the player, it never parks inside
  // them — the gap (95 px) sits outside the player's collision rectangle
  // (~82 px long), so a trailing patrol car cannot trip the bump test every
  // frame; it closes in, rams, and is pushed back out — a pulsing chase.
  const sep = Math.hypot(px - car.x, py - car.y);
  if (sep < 95 && sep > 0.01) {
    const push = 95 - sep;
    car.x -= ((px - car.x) / sep) * push;
    car.y -= ((py - car.y) / sep) * push;
  }
  // Ram: contact damages the player's car and shakes the camera. The speed
  // cost applies once per frame, however many cars are touching — otherwise
  // four patrol cars multiply into a dead stop.
  if (dist < 56 && player.inCar) {
    player.inCar.health = Math.max(0, player.inCar.health - 14 * dt);
    if (!ramState.rammed) { player.inCar.speed *= 0.98; ramState.rammed = true; }
    state.shake = Math.max(state.shake, 6);
    if (typeof window !== 'undefined' && window.__dbg) window.__dbg.rams = (window.__dbg.rams ?? 0) + 1;
    if (player.inCar.health <= 0) state.wreckPlayerCar();
  }
}

/** Officers walk at the player; touching one while stopped means busted. */
function updateOfficers(state, px, py, dt) {
  const { wanted, player } = state;
  let touching = false;
  for (const o of wanted.officers) {
    const dx = px - o.x, dy = py - o.y;
    const dist = Math.hypot(dx, dy) || 1;
    o.angle = Math.atan2(dx, -dy);
    o.walkPhase += dt * 8;
    o.x += Math.sin(o.angle) * o.speed * dt;
    o.y += -Math.cos(o.angle) * o.speed * dt;
    if (dist < 34) touching = true;
  }
  const playerStopped = player.inCar ? Math.abs(player.inCar.speed) < 8 : true;
  if (touching && playerStopped) {
    wanted.bustedTimer += dt;
    if (wanted.bustedTimer > 1.5) {
      wanted.busted = true;
      state.setScreen('busted');
    }
  } else {
    wanted.bustedTimer = Math.max(0, wanted.bustedTimer - dt * 2);
  }
}

/** Wanted level maintenance: spawn/despawn pursuit, decay stars when hidden. */
export function updateWanted(state, dt) {
  const { wanted, player, time } = state;
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;

  // Nearest police distance decides whether the player is "seen".
  let nearest = Infinity;
  for (const c of wanted.policeCars) nearest = Math.min(nearest, Math.hypot(c.x - px, c.y - py));
  for (const o of wanted.officers) nearest = Math.min(nearest, Math.hypot(o.x - px, o.y - py));
  if (nearest < 520) wanted.lastSeenAt = time;

  // Decay: clean for a while and unseen, stars fall one at a time. Slipping a
  // 3+ star chase clean pays a getaway bonus — the escape is the job.
  if (wanted.stars > 0 && time - wanted.lastCrimeAt > WANTED.decayDelay && time - wanted.lastSeenAt > 4) {
    wanted.decayTimer = (wanted.decayTimer ?? 0) + dt;
    if (wanted.decayTimer > WANTED.decayInterval) {
      wanted.decayTimer = 0;
      wanted.heat = Math.max(0, wanted.heat - 1);
      wanted.stars = Math.floor(wanted.heat);
      if (wanted.stars === 0) {
        if (wanted.maxStars >= WANTED.cleanGetawayMinStars) {
          state.cash += WANTED.cleanGetawayBonus;
          state.addBanner(`CLEAN GETAWAY +$${WANTED.cleanGetawayBonus}`, 3);
          state.sfx.mission();
        } else {
          state.addBanner('HEAT OFF — you slipped away', 3);
        }
        wanted.maxStars = 0;
      }
    }
  } else {
    wanted.decayTimer = 0;
  }

  const rng = state.sessionRng;
  sizePursuit(state, rng, px, py);
  sizeOfficers(state, rng, px, py);
  updateRoadblocks(state, px, py);

  const ramState = { rammed: false };
  for (const car of wanted.policeCars) {
    if (car.roadblock) continue;
    chaseCar(state, car, px, py, dt, ramState);
  }
  updateOfficers(state, px, py, dt);
}

/** Clear all heat after a bust, a waste, or a mission's clean getaway. */
export function clearWanted(wanted) {
  wanted.stars = 0; wanted.heat = 0; wanted.maxStars = 0;
  wanted.policeCars = []; wanted.officers = []; wanted.roadblocks = [];
  wanted.bustedTimer = 0; wanted.busted = false; wanted.decayTimer = 0;
}
