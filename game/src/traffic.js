// traffic.js — AI cars driving the road grid: they pick an avenue or street,
// cruise in a lane, turn at intersections, brake for the car ahead (traffic,
// police, the courier van, or Sol herself), and never leave the roads.
// Colours and models come from the seeded city RNG.
import { AVENUES, HIGHWAY_Y, ROAD_HALF, STREETS, WORLD } from './config.js';
import { spawnCar, CAR_COLORS } from './vehicles.js';
import { makeRng } from './rng.js';

export function spawnTraffic(city, count, rng) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const car = spawnTrafficCar(city, rng);
    if (car) cars.push(car);
  }
  return cars;
}

export function spawnTrafficCar(city, rng) {
  const vertical = rng.chance(0.5);
  let x, y, angle;
  if (vertical) {
    const avenue = rng.pick(AVENUES);
    const dir = rng.chance(0.5) ? 1 : -1;
    x = avenue + (dir > 0 ? 24 : -24);
    y = rng.range(100, WORLD.height - 100);
    angle = dir > 0 ? Math.PI : 0;
  } else {
    const street = rng.pick(STREETS);
    const dir = rng.chance(0.5) ? 1 : -1;
    x = rng.range(100, WORLD.width - 100);
    y = street + (dir > 0 ? 24 : -24);
    angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  // Keep traffic off the river (bridges excepted) and off the highway centre.
  if (x > 3000 && x < 3400 && !STREETS.some((s) => Math.abs(y - s) < ROAD_HALF)) return null;
  const car = spawnCar(city, x, y, angle, rng.pick(CAR_COLORS), rng.int(0, 3), { id: `traffic-${rng.int(0, 99999)}` });
  car.cruise = rng.range(140, 230);
  car.axis = vertical ? 'v' : 'h';
  car.road = vertical ? x - (angle === Math.PI ? 24 : -24) : y - (angle === Math.PI / 2 ? 24 : -24);
  car.turnCooldown = rng.range(1, 5);
  return car;
}

/** True when anything worth stopping for is directly ahead of this car. */
function blockedAhead(car, obstacles) {
  const forward = { x: Math.sin(car.angle), y: -Math.cos(car.angle) };
  for (const other of obstacles) {
    if (other === car) continue;
    const dx = other.x - car.x, dy = other.y - car.y;
    const along = dx * forward.x + dy * forward.y;
    const side = Math.abs(dx * forward.y - dy * forward.x);
    if (along > 0 && along < 80 && side < 30) return true;
  }
  return false;
}

/** One traffic step: cruise, turn at intersections, brake for cars ahead.
 *  obstacles is every solid thing on the road this frame — other traffic, the
 *  player's car, parked cars, police, the courier van, and Sol on foot — so
 *  traffic queues behind a chase instead of driving through it. */
export function updateTraffic(city, cars, dt, rng, obstacles) {
  const all = obstacles ?? cars;
  for (const car of cars) {
    car.turnCooldown -= dt;
    const forward = { x: Math.sin(car.angle), y: -Math.cos(car.angle) };
    const target = blockedAhead(car, all) ? 0 : car.cruise;
    car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
    car.x += forward.x * car.speed * dt;
    car.y += forward.y * car.speed * dt;

    // At an intersection, sometimes turn onto the crossing road.
    const onV = AVENUES.find((c) => Math.abs(car.x - c) < 30);
    const onH = STREETS.find((c) => Math.abs(car.y - c) < 30) ?? (Math.abs(car.y - HIGHWAY_Y) < 30 ? HIGHWAY_Y : undefined);
    if (car.turnCooldown <= 0 && onV !== undefined && onH !== undefined && rng.chance(0.35)) {
      car.turnCooldown = rng.range(4, 9);
      if (car.axis === 'v') {
        car.axis = 'h';
        car.angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
        car.y = onH + (car.angle === Math.PI / 2 ? 24 : -24);
      } else {
        car.axis = 'v';
        car.angle = rng.chance(0.5) ? Math.PI : 0;
        car.x = onV + (car.angle === Math.PI ? 24 : -24);
      }
    }
    // Wrap around the world edges so traffic never runs out.
    if (car.x < -80) car.x = WORLD.width + 60;
    if (car.x > WORLD.width + 80) car.x = -60;
    if (car.y < -80) car.y = WORLD.height + 60;
    if (car.y > WORLD.height + 80) car.y = -60;
  }
}

/** A scripted courier van for the tail/heist missions: follows waypoints. */
export function spawnCourierVan(city, waypoints) {
  const start = waypoints[0];
  const van = spawnCar(city, start.x, start.y, 0, '#ffd23e', 1, { id: 'courier-van' });
  van.cruise = 170;
  van.waypoints = waypoints;
  van.wpIndex = 1;
  van.courier = true;
  return van;
}

export function updateCourierVan(city, van, dt) {
  const target = van.waypoints[Math.min(van.wpIndex, van.waypoints.length - 1)];
  const dx = target.x - van.x, dy = target.y - van.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 40 && van.wpIndex < van.waypoints.length - 1) van.wpIndex += 1;
  const want = Math.atan2(dx, -dy);
  let diff = want - van.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  van.angle += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
  van.speed += (van.cruise - van.speed) * Math.min(1, dt * 1.2);
  van.x += Math.sin(van.angle) * van.speed * dt;
  van.y += -Math.cos(van.angle) * van.speed * dt;
  return dist;
}
