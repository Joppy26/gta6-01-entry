// pedestrians.js — AI walkers on the sidewalks: they stroll along a road's edge,
// turn at intersections, chat in place, and run when gunshots or police get close.
import { AVENUES, ROAD_HALF, STREETS, WORLD } from './config.js';
import { makeRng } from './rng.js';

const SHIRT_COLORS = ['#d94f3d', '#3d7bd9', '#e8b93c', '#7ab648', '#c96f9f', '#4fb3a9', '#f4ead2', '#8a6a42'];
const SKIN_COLORS = ['#e8b48c', '#c98a5a', '#8a5a3a', '#f0c8a0'];

export function spawnPedestrians(city, count, rng) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const ped = spawnPedestrian(city, rng);
    if (ped) peds.push(ped);
  }
  return peds;
}

export function spawnPedestrian(city, rng, x, y) {
  const vertical = rng.chance(0.5);
  let px = x, py = y;
  if (px === undefined) {
    if (vertical) {
      const avenue = rng.pick(AVENUES);
      px = avenue + (rng.chance(0.5) ? ROAD_HALF + 16 : -ROAD_HALF - 16);
      py = rng.range(100, WORLD.height - 100);
    } else {
      const street = rng.pick(STREETS);
      px = rng.range(100, WORLD.width - 100);
      py = street + (rng.chance(0.5) ? ROAD_HALF + 16 : -ROAD_HALF - 16);
    }
  }
  if (px > 3020 && px < 3380) return null; // nobody strolls in the river
  return {
    x: px, y: py,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(40, 75),
    shirt: rng.pick(SHIRT_COLORS),
    skin: rng.pick(SKIN_COLORS),
    walkPhase: rng.range(0, 6),
    fleeing: 0, panic: 0, guard: false, health: 50,
    id: `ped-${rng.int(0, 99999)}`,
  };
}

/** Peds walk their sidewalk; fleeFrom (a point) makes nearby peds run away. */
export function updatePedestrians(city, peds, dt, rng, fleeFrom) {
  for (const ped of peds) {
    ped.walkPhase += dt * 7;
    let speed = ped.speed;
    let angle = ped.angle;
    if (ped.fleeing > 0) {
      ped.fleeing -= dt;
      speed = 190;
      if (fleeFrom) angle = Math.atan2(ped.x - fleeFrom.x, -(ped.y - fleeFrom.y));
    } else if (fleeFrom && Math.hypot(ped.x - fleeFrom.x, ped.y - fleeFrom.y) < 160) {
      ped.fleeing = rng.range(1.5, 3);
    }
    // Turn at intersections, or reverse at the world edge.
    const nearIntersection =
      AVENUES.some((c) => Math.abs(ped.x - c) < 40) && STREETS.some((c) => Math.abs(ped.y - c) < 40);
    if (nearIntersection && rng.chance(dt * 0.25)) angle += rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    if (ped.x < 40 || ped.x > WORLD.width - 40 || ped.y < 40 || ped.y > WORLD.height - 40) angle += Math.PI;
    ped.angle = angle;
    const nx = ped.x + Math.sin(angle) * speed * dt;
    const ny = ped.y - Math.cos(angle) * speed * dt;
    // Peds stay out of buildings and the river.
    const inBuilding = city.buildings.some((b) => nx > b.x - 8 && nx < b.x + b.w + 8 && ny > b.y - 8 && ny < b.y + b.h + 8);
    const inRiver = nx > 3040 && nx < 3360;
    if (!inBuilding && !inRiver) { ped.x = nx; ped.y = ny; }
    else ped.angle += Math.PI / 2;
  }
}

/** A guard for the bridge heist: stands his ground and shoots at the player.
 *  Built directly (not via spawnPedestrian) because guards stand on the bridge
 *  deck over the river, where normal pedestrians never spawn. */
export function spawnGuard(city, x, y) {
  return {
    x, y, angle: 0, speed: 0, walkPhase: 0,
    shirt: '#22242a', skin: '#e8b48c',
    fleeing: 0, panic: 0, guard: true, health: 60,
    shootCooldown: 1,
    id: `guard-${Math.floor(x)}-${Math.floor(y)}`,
  };
}

export function drawPedestrian(ctx, ped, time) {
  const bob = Math.sin(ped.walkPhase) * 2.5;
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(0, 2, 11, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(ped.angle);
  ctx.fillStyle = '#2c2f3a';
  ctx.fillRect(-6, 0 + bob, 5, 10);
  ctx.fillRect(1, 0 - bob, 5, 10);
  ctx.fillStyle = ped.shirt;
  ctx.beginPath(); ctx.arc(0, -2, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath(); ctx.arc(0, -5, 5.5, 0, Math.PI * 2); ctx.fill();
  if (ped.guard) {
    ctx.fillStyle = '#111';
    ctx.fillRect(6, -12, 3, 10);
    ctx.fillStyle = '#ff4b3e';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, -16);
  }
  ctx.restore();
}
