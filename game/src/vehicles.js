// vehicles.js — car models, arcade driving physics, damage and smoke.
// A car is {x, y, angle, speed, color, kind, health, driver, ...}. Physics is
// deliberately forgiving: strong grip, handbrake slides, collisions bounce.
import { CAR, PALETTE } from './config.js';
import { isSolidAt, moveWithCollision } from './city.js';

export const CAR_COLORS = ['#d94f3d', '#3d7bd9', '#e8b93c', '#7ab648', '#e8e2d2', '#22242a', '#c96f9f', '#4fb3a9', '#ff7a2a'];
export const CAR_KINDS = [
  { name: 'Solstice', w: 46, l: 84, top: 0.9 },
  { name: 'Burrito Van', w: 50, l: 96, top: 1 },
  { name: 'Canyon GT', w: 44, l: 88, top: 1.05 },
  { name: 'Pueblo Taxi', w: 46, l: 84, top: 0.95 },
];

export function spawnCar(city, x, y, angle, color, kindIndex = 0, opts = {}) {
  const kind = CAR_KINDS[kindIndex % CAR_KINDS.length];
  return {
    x, y, angle, speed: 0, color: color ?? CAR_COLORS[0],
    kind: kind.name, w: kind.w, l: kind.l,
    health: CAR.health, smoke: 0, skid: 0, police: false,
    driver: opts.driver ?? null, id: opts.id ?? `car-${Math.floor(x)}-${Math.floor(y)}`,
    ...opts,
  };
}

export function spawnPoliceCar(city, x, y, angle) {
  const car = spawnCar(city, x, y, angle, '#f2f2f2', 2, { police: true, id: `police-${Math.floor(x)}-${Math.floor(y)}` });
  car.siren = 0;
  return car;
}

/** Resolve a car-car overlap along the axis of least penetration: a car
 *  following 24 px off-centre must be pushed straight back, not walked
 *  sideways off the road (a radial push did exactly that on the bridge). */
function resolveBump(city, car, other, fx, fy, rx, ry, lonHalf, latHalf, lon, lat) {
  const lonPen = lonHalf - Math.abs(lon);
  const latPen = latHalf - Math.abs(lat);
  const px = car.x, py = car.y;
  if (lonPen < latPen) {
    car.x -= fx * Math.sign(lon) * lonPen;
    car.y -= fy * Math.sign(lon) * lonPen;
  } else {
    car.x -= rx * Math.sign(lat) * latPen;
    car.y -= ry * Math.sign(lat) * latPen;
  }
  if (isSolidAt(city, car.x, car.y, CAR.radius)) { car.x = px; car.y = py; }
}

/** Drive a car one step. input: {up, down, left, right, handbrake}. Returns
 *  collision events for effects/sound: {hitWall, hitCar}. */
export function driveCar(city, car, input, dt, otherCars = []) {
  const forward = { x: Math.sin(car.angle), y: -Math.cos(car.angle) };
  // cos(±π/2) is ~6e-17, not 0: without snapping, driving exactly east/west
  // leaves a denormal dy that rounds away, and the wall check below reads
  // "moved nowhere on y while dy ≠ 0" as a crash — every single frame.
  if (Math.abs(forward.x) < 1e-9) forward.x = 0;
  if (Math.abs(forward.y) < 1e-9) forward.y = 0;
  if (input.up) car.speed += CAR.accel * dt;
  if (input.down) {
    if (car.speed > 10) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.reverseAccel * dt;
  }
  if (!input.up && !input.down) car.speed -= Math.sign(car.speed) * CAR.drag * 220 * dt;
  if (input.handbrake) {
    car.speed -= Math.sign(car.speed) * CAR.handbrake * dt;
    car.skid = 1;
  } else {
    car.skid = Math.max(0, car.skid - dt * 2);
  }
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  if (Math.abs(car.speed) < 4 && !input.up && !input.down) car.speed = 0;

  const steerAmount = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const grip = input.handbrake ? 1.9 : 1;
  car.angle += steerAmount * CAR.steer * grip * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 120 + 0.25);

  const dx = forward.x * car.speed * dt;
  const dy = forward.y * car.speed * dt;
  const before = { x: car.x, y: car.y };
  const moved = moveWithCollision(city, car.x, car.y, dx, dy, CAR.radius);
  car.x = moved.x; car.y = moved.y;
  // Blocked means (nearly) no displacement on an axis that was asked to move;
  // exact equality would misfire on the snapped-forward rounding above.
  const hitWall = (Math.abs(moved.x - before.x) < 1e-9 && Math.abs(dx) > 1e-9) || (Math.abs(moved.y - before.y) < 1e-9 && Math.abs(dy) > 1e-9);
  if (hitWall && Math.abs(car.speed) > 120) {
    car.speed *= -0.25;
    car.health = Math.max(0, car.health - Math.abs(car.speed) * 0.02 - 4);
    car.smoke = 1;
    if (typeof window !== 'undefined' && window.__dbg) window.__dbg.walls = (window.__dbg.walls ?? 0) + 1;
  }
  // Soft car-car bumps, tested as oriented rectangles: a circle test cannot
  // tell "alongside in the next lane" (48 px apart, a 2 px gap) from a real
  // rear-end, and it sideswiped the player on every passing car.
  let hitCar = null;
  let bumped = false, bumpedOnlyPolice = true, maxImpact = 0;
  const fx = Math.sin(car.angle), fy = -Math.cos(car.angle);
  const rx = Math.cos(car.angle), ry = Math.sin(car.angle);
  for (const other of otherCars) {
    if (other === car) continue;
    const dx = other.x - car.x, dy = other.y - car.y;
    const lon = dx * fx + dy * fy;
    const lat = dx * rx + dy * ry;
    const lonHalf = (car.l + other.l) / 2 - 6;
    const latHalf = (car.w + other.w) / 2 - 4;
    if (Math.abs(lon) < lonHalf && Math.abs(lat) < latHalf) {
      resolveBump(city, car, other, fx, fy, rx, ry, lonHalf, latHalf, lon, lat);
      bumped = true;
      maxImpact = Math.max(maxImpact, Math.abs(car.speed - (other.speed || 0)));
      if (!other.police) bumpedOnlyPolice = false;
      hitCar = other;
    }
  }
  if (bumped) {
    // The speed cost applies only to a hard impact, not to sustained contact:
    // tailgating a slower car matches its speed through the positional push
    // alone, and a per-frame multiplier turned every traffic jam into a stall.
    if (maxImpact > 80) {
      car.speed *= bumpedOnlyPolice ? 0.97 : 0.82;
      if (typeof window !== 'undefined' && window.__dbg) {
        window.__dbg.bumps = (window.__dbg.bumps ?? 0) + 1;
        window.__dbg.maxImpact = Math.max(window.__dbg.maxImpact ?? 0, Math.round(maxImpact));
      }
    }
    if (!bumpedOnlyPolice && maxImpact > 200) car.health = Math.max(0, car.health - 3);
  }
  if (car.health < 45) car.smoke = Math.max(car.smoke, 0.6);
  return { hitWall, hitCar };
}

export function carSpeedKmh(car) {
  return Math.round(Math.abs(car.speed) * 0.32);
}

/** Draw a car top-down: body, roof, windshield, wheels, headlights, damage smoke.
 *  headlights paints the dusk beam ahead of the player's car — Del Rio is shot
 *  at golden hour, and the beam is what sells the chase in the screenshots. */
export function drawCar(ctx, car, time, headlights = false) {
  if (headlights) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const g = ctx.createLinearGradient(0, -car.l / 2, 0, -car.l / 2 - 190);
    g.addColorStop(0, 'rgba(255,233,168,0.28)');
    g.addColorStop(1, 'rgba(255,233,168,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-car.w / 2 + 4, -car.l / 2);
    ctx.lineTo(car.w / 2 - 4, -car.l / 2);
    ctx.lineTo(car.w / 2 + 26, -car.l / 2 - 190);
    ctx.lineTo(-car.w / 2 - 26, -car.l / 2 - 190);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-car.w / 2 + 4, -car.l / 2 + 5, car.w, car.l);
  // Wheels.
  ctx.fillStyle = '#1a1a1a';
  for (const [wx, wy] of [[-car.w / 2 - 2, -car.l * 0.32], [car.w / 2 - 2, -car.l * 0.32], [-car.w / 2 - 2, car.l * 0.32], [car.w / 2 - 2, car.l * 0.32]]) {
    ctx.fillRect(wx, wy, 5, 16);
  }
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -car.w / 2, -car.l / 2, car.w, car.l, 10);
  ctx.fill();
  // Roof + glass.
  ctx.fillStyle = 'rgba(20,20,26,0.85)';
  roundRect(ctx, -car.w / 2 + 6, -car.l * 0.28, car.w - 12, car.l * 0.3, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  roundRect(ctx, -car.w / 2 + 6, car.l * 0.12, car.w - 12, car.l * 0.16, 5);
  ctx.fill();
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(-car.w / 2 + 4, -car.l / 2 - 2, 8, 5);
  ctx.fillRect(car.w / 2 - 12, -car.l / 2 - 2, 8, 5);
  // Brake lights glow when the car is slowing hard (handbrake or heavy braking).
  if (car.skid > 0) {
    ctx.fillStyle = '#ff2a1e';
    ctx.fillRect(-car.w / 2 + 4, car.l / 2 - 3, 8, 5);
    ctx.fillRect(car.w / 2 - 12, car.l / 2 - 3, 8, 5);
  }
  if (car.police) {
    const phase = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = phase ? PALETTE.policeRed : PALETTE.policeBlue;
    ctx.fillRect(-10, -car.l * 0.05, 9, 7);
    ctx.fillStyle = phase ? PALETTE.policeBlue : PALETTE.policeRed;
    ctx.fillRect(1, -car.l * 0.05, 9, 7);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICIA', 0, car.l * 0.32);
  }
  ctx.restore();
  // Damage smoke drifts up from the hood.
  if (car.smoke > 0.2) {
    ctx.fillStyle = 'rgba(120,120,120,0.5)';
    ctx.beginPath();
    ctx.arc(car.x + Math.sin(time * 7) * 4, car.y - car.l * 0.3 - Math.sin(time * 3) * 6, 8 + car.smoke * 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
