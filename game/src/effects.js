// effects.js — dust, smoke, sparks, skid marks, siren flashes and screen shake.
// All particles are cheap pooled objects drawn under the HUD; skid marks persist
// on the road.
export function createEffects() {
  return { particles: [], skids: [], shake: 0, banners: [], flash: 0 };
}

export function addParticle(state, kind, x, y, opts = {}) {
  const list = state.effects.particles;
  if (list.length > 400) list.shift();
  list.push({
    kind, x, y,
    vx: opts.vx ?? (state.sessionRng.range(-40, 40)),
    vy: opts.vy ?? (state.sessionRng.range(-40, 40)),
    life: opts.life ?? 0.6, maxLife: opts.life ?? 0.6,
    size: opts.size ?? 6, color: opts.color,
  });
}

export function burstDust(state, x, y, n = 6) {
  for (let i = 0; i < n; i++) addParticle(state, 'dust', x, y, { life: 0.7, size: state.sessionRng.range(4, 9), color: '#d9c49a' });
}

export function burstSmoke(state, x, y, n = 4) {
  for (let i = 0; i < n; i++) addParticle(state, 'smoke', x, y, { vy: -30, life: 1.1, size: state.sessionRng.range(8, 14), color: '#8a8a8a' });
}

export function burstSparks(state, x, y, n = 10) {
  for (let i = 0; i < n; i++) addParticle(state, 'spark', x, y, { vx: state.sessionRng.range(-220, 220), vy: state.sessionRng.range(-220, 220), life: 0.35, size: 3, color: '#ffd23e' });
}

/** Red/blue flash where a patrol car spawns — the siren arriving, not just a car. */
export function burstSiren(state, x, y) {
  for (let i = 0; i < 10; i++) {
    addParticle(state, 'siren', x, y, {
      vx: state.sessionRng.range(-90, 90), vy: state.sessionRng.range(-90, 90),
      life: 0.5, size: state.sessionRng.range(5, 9),
      color: i % 2 === 0 ? '#ff3b30' : '#3a7bff',
    });
  }
}

/** White camera flash for a photo-spot snapshot. */
export function burstFlash(state, x, y) {
  state.effects.flash = 0.18;
  for (let i = 0; i < 8; i++) {
    addParticle(state, 'spark', x, y, {
      vx: state.sessionRng.range(-160, 160), vy: state.sessionRng.range(-160, 160),
      life: 0.3, size: 3, color: '#ffffff',
    });
  }
}

/** Record a skid segment behind a sliding car (capped so the road stays clean). */
export function addSkid(state, x1, y1, x2, y2) {
  const skids = state.effects.skids;
  if (skids.length > 220) skids.shift();
  skids.push({ x1, y1, x2, y2, life: 14 });
}

export function updateEffects(state, dt) {
  const fx = state.effects;
  for (const p of fx.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96; p.vy *= 0.96;
  }
  fx.particles = fx.particles.filter((p) => p.life > 0);
  for (const s of fx.skids) s.life -= dt;
  fx.skids = fx.skids.filter((s) => s.life > 0);
  fx.shake = Math.max(0, fx.shake - dt * 26);
  fx.flash = Math.max(0, fx.flash - dt);
  for (const b of fx.banners) b.time -= dt;
  fx.banners = fx.banners.filter((b) => b.time > 0);
}

export function drawEffects(ctx, state) {
  const fx = state.effects;
  ctx.strokeStyle = 'rgba(30,20,10,0.5)';
  ctx.lineWidth = 4;
  for (const s of fx.skids) {
    ctx.globalAlpha = Math.min(1, s.life / 6);
    ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const p of fx.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a * (p.kind === 'smoke' ? 0.5 : 0.85);
    ctx.fillStyle = p.color ?? '#fff';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.kind === 'smoke' ? (1.6 - a * 0.6) : 1), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Photo flash washes the whole frame for a beat.
  if (fx.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${fx.flash * 2.4})`;
    ctx.fillRect(state.camera.view.x0, state.camera.view.y0, state.camera.viewW, state.camera.viewH);
  }
}
