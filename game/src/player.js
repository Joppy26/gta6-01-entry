// player.js — Marisol "Sol" Vega on foot: WASD movement, sprint, jump, and the
// little stylised figure the camera follows. Entering a car is handled in main.js;
// this file only knows how a person moves and looks.
import { PLAYER } from './config.js';
import { moveWithCollision } from './city.js';

export function spawnPlayer(x, y) {
  return {
    x, y, angle: 0, vx: 0, vy: 0,
    health: PLAYER.health, inCar: null, jumping: 0, jumpT: 0,
    walkPhase: 0, moving: false, hasPistol: false, ammo: 0,
    punchCooldown: 0, hurtFlash: 0,
  };
}

export function updatePlayerOnFoot(city, player, input, dt) {
  const speed = input.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len > 0) { mx /= len; my /= len; }
  const nx = mx * speed * dt;
  const ny = my * speed * dt;
  const moved = moveWithCollision(city, player.x, player.y, nx, ny, PLAYER.radius);
  player.x = moved.x; player.y = moved.y;
  player.moving = len > 0;
  if (player.moving) {
    player.angle = Math.atan2(mx, -my);
    player.walkPhase += dt * (input.sprint ? 13 : 9);
  }
  if (input.jump && player.jumping === 0) {
    player.jumping = 1; player.jumpT = 0;
  }
  if (player.jumping) {
    player.jumpT += dt;
    if (player.jumpT > 0.45) player.jumping = 0;
  }
  player.punchCooldown = Math.max(0, player.punchCooldown - dt);
  player.hurtFlash = Math.max(0, player.hurtFlash - dt);
  return player;
}

export function damagePlayer(player, amount) {
  player.health = Math.max(0, player.health - amount);
  player.hurtFlash = 0.4;
  return player.health <= 0;
}

/** Draw Sol top-down: shadow, legs mid-stride, jacket, hair, facing arrow. */
export function drawPlayer(ctx, player, time) {
  const jumpLift = player.jumping ? Math.sin((player.jumpT / 0.45) * Math.PI) * 14 : 0;
  const bob = player.moving ? Math.sin(player.walkPhase) * 3 : 0;
  ctx.save();
  ctx.translate(player.x, player.y - jumpLift);
  // Shadow stays on the ground.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, jumpLift, 15, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(player.angle);
  if (player.hurtFlash > 0) {
    ctx.fillStyle = 'rgba(255,60,40,0.5)';
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
  }
  // Legs.
  ctx.fillStyle = '#2c2f3a';
  ctx.fillRect(-8, -2 + bob, 6, 14);
  ctx.fillRect(2, -2 - bob, 6, 14);
  // Jacket (terracotta, Sol's signature).
  ctx.fillStyle = '#c96f3f';
  ctx.beginPath(); ctx.arc(0, -2, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f4ead2';
  ctx.fillRect(-3, -12, 6, 8);
  // Hair + head.
  ctx.fillStyle = '#2a1a12';
  ctx.beginPath(); ctx.arc(0, -6, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8b48c';
  ctx.beginPath(); ctx.arc(0, -4, 6, 0, Math.PI * 2); ctx.fill();
  // Facing tick.
  ctx.fillStyle = '#ffb03a';
  ctx.fillRect(-2, -20, 4, 7);
  // Pistol in hand once earned.
  if (player.hasPistol) {
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -14, 4, 12);
  }
  ctx.restore();
}
