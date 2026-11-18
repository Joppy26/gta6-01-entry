// combat.js — punch and pistol. Fists work up close; the pistol (earned in
// mission 2) aims at the mouse, fires tracers, and makes noise that scares
// pedestrians and draws police. Guards shoot back — and close in on the player
// instead of standing still to be sniped from outside their range.
import { PLAYER } from './config.js';
import { moveWithCollision } from './city.js';

export function createCombat() {
  return { bullets: [], tracers: [], muzzle: 0, shootCooldown: 0 };
}

/** Punch: hits the nearest ped / guard / officer in front of the player. */
export function punch(state) {
  const player = state.player;
  if (player.punchCooldown > 0 || player.inCar) return false;
  player.punchCooldown = 0.45;
  const px = player.x, py = player.y;
  const fx = Math.sin(player.angle), fy = -Math.cos(player.angle);
  const targets = [...state.peds, ...state.missionGuards, ...state.wanted.officers];
  let hit = null, best = Infinity;
  for (const t of targets) {
    if (t.health <= 0) continue;
    const dx = t.x - px, dy = t.y - py;
    const d = Math.hypot(dx, dy);
    const facing = (dx * fx + dy * fy) / (d || 1);
    if (d < PLAYER.punchRange && facing > 0.3 && d < best) { best = d; hit = t; }
  }
  if (hit) {
    hit.health -= PLAYER.punchDamage;
    hit.fleeing = 2;
    state.addEffect('hit', hit.x, hit.y);
    state.sfx.punch();
    if (hit.health <= 0) {
      state.addHeat('kill');
      state.addBanner(hit.officer ? 'Officer down!' : 'Target down', 2);
    } else {
      state.addHeat('assault');
    }
    return true;
  }
  state.sfx.swing();
  return false;
}

/** Fire the pistol toward (tx, ty) in world coords. Returns false if no ammo. */
export function shootPistol(state, tx, ty) {
  const player = state.player;
  const combat = state.combat;
  if (!player.hasPistol || player.ammo <= 0 || combat.shootCooldown > 0) return false;
  combat.shootCooldown = 0.28;
  player.ammo -= 1;
  combat.muzzle = 0.08;
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  const angle = Math.atan2(tx - px, -(ty - py));
  const range = PLAYER.pistolRange;
  const ex = px + Math.sin(angle) * range;
  const ey = py - Math.cos(angle) * range;
  // Hit the first guard / officer / ped the line crosses.
  let hit = null, bestT = 1;
  const targets = [...state.missionGuards, ...state.wanted.officers, ...state.peds];
  for (const t of targets) {
    if (t.health <= 0) continue;
    const dx = t.x - px, dy = t.y - py;
    const along = dx * Math.sin(angle) - dy * Math.cos(angle);
    const side = Math.abs(dx * Math.cos(angle) + dy * Math.sin(angle));
    if (along > 0 && along < range && side < 22) {
      const tt = along / range;
      if (tt < bestT) { bestT = tt; hit = t; }
    }
  }
  const hx = px + Math.sin(angle) * range * bestT;
  const hy = py - Math.cos(angle) * range * bestT;
  combat.tracers.push({ x1: px, y1: py, x2: hx, y2: hy, life: 0.12 });
  state.addEffect('muzzle', px + Math.sin(angle) * 22, py - Math.cos(angle) * 22);
  state.sfx.gunshot();
  state.addHeat('shoot');
  state.scarePeds(px, py, 220);
  if (hit) {
    hit.health -= PLAYER.pistolDamage;
    state.addEffect('hit', hit.x, hit.y);
    if (hit.health <= 0) {
      state.addHeat('kill');
      state.addBanner(hit.guard ? 'Guard down!' : hit.officer ? 'Officer down!' : 'Pedestrian down', 2);
    }
  }
  return true;
}

/** Guards shoot back at the player when close and in the open — and walk the
 *  player down when he is out of range, so the heist cannot be sniped from
 *  520 px away while they stand on the bridge doing nothing. They slide along
 *  the bridge deck and stop at its edge; they never walk into the river. */
export function updateGuardsCombat(state, dt) {
  const px = state.player.inCar ? state.player.inCar.x : state.player.x;
  const py = state.player.inCar ? state.player.inCar.y : state.player.y;
  for (const g of state.missionGuards) {
    if (g.health <= 0) continue;
    g.shootCooldown = (g.shootCooldown ?? 1) - dt;
    const d = Math.hypot(px - g.x, py - g.y);
    if (d > 300) {
      const angle = Math.atan2(px - g.x, -(py - g.y));
      g.angle = angle;
      g.walkPhase += dt * 7;
      const moved = moveWithCollision(state.city, g.x, g.y, Math.sin(angle) * 95 * dt, -Math.cos(angle) * 95 * dt, 16);
      g.x = moved.x; g.y = moved.y;
    }
    if (d < 420 && g.shootCooldown <= 0) {
      g.shootCooldown = 1.4;
      const angle = Math.atan2(px - g.x, -(py - g.y));
      state.combat.tracers.push({
        x1: g.x, y1: g.y,
        x2: px + state.sessionRng.range(-30, 30), y2: py + state.sessionRng.range(-30, 30),
        life: 0.12, enemy: true,
      });
      state.sfx.gunshot(true);
      if (state.sessionRng.chance(0.45)) state.hurtPlayer(8);
      g.angle = angle;
    }
  }
}

export function updateCombat(state, dt) {
  const combat = state.combat;
  combat.shootCooldown = Math.max(0, combat.shootCooldown - dt);
  combat.muzzle = Math.max(0, combat.muzzle - dt);
  for (const t of combat.tracers) t.life -= dt;
  combat.tracers = combat.tracers.filter((t) => t.life > 0);
}
