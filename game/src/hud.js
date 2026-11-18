// hud.js — everything the player reads: the HUD (minimap, wanted stars, cash,
// health, ammo, speed, objective banner, mission progress, clock, radio,
// timers), the dialogue box, and every menu (title, briefing, pause, mission
// results, busted/wasted, garage). All of it is drawn on the game canvas, so
// screenshots capture it exactly.
import { AVENUES, HIGHWAY_Y, MISSION_REWARDS, PALETTE, RIVER, STREETS, WORLD } from './config.js';
import { MISSIONS, missionProgress } from './missions.js';
import { currentStationName } from './radio.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MAP_W = 210, MAP_H = 158;

function panel(ctx, x, y, w, h, alpha = 0.82) {
  ctx.fillStyle = `rgba(20,14,8,${alpha})`;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,176,58,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

function stars(ctx, x, y, count, max = 5) {
  ctx.font = '26px ' + FONT;
  ctx.textAlign = 'left';
  for (let i = 0; i < max; i++) {
    ctx.fillStyle = i < count ? '#ffcf3d' : 'rgba(255,255,255,0.35)';
    ctx.fillText('★', x + i * 28, y);
  }
}

export function drawMinimap(ctx, state, x, y) {
  const sx = MAP_W / WORLD.width, sy = MAP_H / WORLD.height;
  panel(ctx, x - 6, y - 6, MAP_W + 12, MAP_H + 26, 0.85);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, MAP_W, MAP_H); ctx.clip();
  ctx.fillStyle = '#c9a86a';
  ctx.fillRect(x, y, MAP_W, MAP_H);
  // River.
  ctx.fillStyle = '#2fb3c9';
  ctx.fillRect(x + RIVER.x0 * sx, y, (RIVER.x1 - RIVER.x0) * sx, MAP_H);
  // Roads.
  ctx.strokeStyle = '#3d3a38';
  ctx.lineWidth = 3;
  for (const c of AVENUES) { ctx.beginPath(); ctx.moveTo(x + c * sx, y); ctx.lineTo(x + c * sx, y + MAP_H); ctx.stroke(); }
  for (const c of STREETS) { ctx.beginPath(); ctx.moveTo(x, y + c * sy); ctx.lineTo(x + MAP_W, y + c * sy); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(x, y + HIGHWAY_Y * sy); ctx.lineTo(x + MAP_W, y + HIGHWAY_Y * sy); ctx.stroke();
  // Downtown blocks.
  ctx.fillStyle = 'rgba(120,70,30,0.55)';
  for (const b of state.city.buildings) {
    if (b.downtown) ctx.fillRect(x + b.x * sx, y + b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
  }
  // Taxi fare marker.
  if (state.taxiFare) {
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(x + state.taxiFare.x * sx, y + state.taxiFare.y * sy, 5, 0, Math.PI * 2); ctx.fill();
  }
  // Photo spots (untaken only).
  for (const s of state.city.photoSpots) {
    if (s.taken) continue;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x + s.x * sx, y + s.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Mission waypoint — pulsing diamond.
  const wp = state.waypoint;
  if (wp) {
    const pulse = 4 + Math.sin(state.time * 5) * 1.5;
    ctx.fillStyle = '#ffe14d';
    ctx.save();
    ctx.translate(x + wp.x * sx, y + wp.y * sy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-pulse, -pulse, pulse * 2, pulse * 2);
    ctx.restore();
  }
  // Police blips.
  for (const c of state.wanted.policeCars) {
    ctx.fillStyle = Math.floor(state.time * 4) % 2 === 0 ? '#ff3b30' : '#3a7bff';
    ctx.beginPath(); ctx.arc(x + c.x * sx, y + c.y * sy, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  const px = state.player.inCar ? state.player.inCar.x : state.player.x;
  const py = state.player.inCar ? state.player.inCar.y : state.player.y;
  const ang = state.player.inCar ? state.player.inCar.angle : state.player.angle;
  ctx.save();
  ctx.translate(x + px * sx, y + py * sy);
  ctx.rotate(ang);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#c96f3f'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
  ctx.restore();
  // North + legend + river name + waypoint distance.
  ctx.fillStyle = '#fff3d6';
  ctx.font = 'bold 12px ' + FONT;
  ctx.textAlign = 'left';
  ctx.fillText('N ↑  DEL RIO', x, y + MAP_H + 16);
  ctx.save();
  ctx.translate(x + (RIVER.x0 + RIVER.x1) / 2 * sx, y + MAP_H / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 8px ' + FONT;
  ctx.textAlign = 'center';
  ctx.fillText('RIO SECO', 0, 3);
  ctx.restore();
  if (wp) {
    const d = Math.round(Math.hypot(px - wp.x, py - wp.y));
    ctx.fillStyle = '#ffe14d';
    ctx.font = 'bold 12px ' + FONT;
    ctx.textAlign = 'right';
    ctx.fillText(`${d}m →`, x + MAP_W, y + MAP_H + 16);
  }
}

export function drawHUD(ctx, state, viewW, viewH) {
  drawMinimap(ctx, state, 14, 14);
  // Wanted + cash + health + ammo, top right.
  const rx = viewW - 260;
  panel(ctx, rx, 8, 246, 130, 0.82);
  stars(ctx, rx + 12, 38, state.wanted.stars);
  // Heat-cooling hint: stars only fall while clean and unseen.
  if (state.wanted.stars > 0 && state.time - state.wanted.lastCrimeAt > 12) {
    ctx.fillStyle = '#7fd4e0';
    ctx.font = 'bold 11px ' + FONT;
    ctx.textAlign = 'right';
    ctx.fillText('LAY LOW — cooling', rx + 234, 54);
  }
  ctx.fillStyle = PALETTE.hud;
  ctx.font = 'bold 20px ' + FONT;
  ctx.textAlign = 'left';
  ctx.fillText(`$${state.cash.toLocaleString('en-US')}`, rx + 12, 66);
  ctx.font = '13px ' + FONT;
  ctx.fillStyle = '#ffd9a0';
  ctx.fillText(`Missions ${state.missionsDone}/6   Sun discs ${state.discsGot}/12`, rx + 12, 86);
  ctx.fillText(`Photos ${state.photosGot}/3${state.player.hasPistol ? `   Ammo ${state.player.ammo}` : ''}`, rx + 12, 102);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(rx + 12, 112, 222, 12);
  ctx.fillStyle = state.player.health > 35 ? '#7ab648' : '#ff4b3e';
  ctx.fillRect(rx + 12, 112, 222 * Math.max(0, state.player.health / 100), 12);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px ' + FONT;
  ctx.fillText(`HEALTH ${Math.round(state.player.health)}`, rx + 16, 121);

  // Objective banner, top centre, with mission progress underneath.
  if (state.objective) {
    ctx.font = 'bold 17px ' + FONT;
    const w = ctx.measureText(state.objective).width + 36;
    panel(ctx, (viewW - w) / 2, 10, w, 34, 0.85);
    ctx.fillStyle = '#ffe14d';
    ctx.textAlign = 'center';
    ctx.fillText(state.objective, viewW / 2, 33);
    const prog = missionProgress(state);
    if (prog) {
      ctx.fillStyle = '#ffd9a0';
      ctx.font = 'bold 13px ' + FONT;
      ctx.fillText(`MISSION ${MISSIONS[prog.index].id} · step ${prog.step}/${prog.total}`, viewW / 2, 62);
    }
  }
  // Mission timer.
  const step = state.missionStep;
  if (step && step.time) {
    const left = Math.max(0, step.time - state.missionTimer);
    ctx.fillStyle = left < 15 ? '#ff4b3e' : '#fff3d6';
    ctx.font = 'bold 22px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(`⏱ ${Math.ceil(left)}s`, viewW / 2, 88);
  }
  // Big centre banners (mission start, checkpoint, stunt...).
  let by = 110;
  for (const b of state.effects.banners) {
    const a = Math.min(1, b.time);
    ctx.globalAlpha = a;
    ctx.font = 'bold 30px ' + FONT;
    const w = ctx.measureText(b.text).width + 44;
    panel(ctx, (viewW - w) / 2, by, w, 46, 0.9);
    ctx.fillStyle = '#ffe14d';
    ctx.textAlign = 'center';
    ctx.fillText(b.text, viewW / 2, by + 32);
    ctx.globalAlpha = 1;
    by += 54;
  }
  // Speed + car health, bottom right.
  if (state.player.inCar) {
    const car = state.player.inCar;
    panel(ctx, viewW - 190, viewH - 96, 176, 82, 0.82);
    ctx.fillStyle = '#fff3d6';
    ctx.font = 'bold 30px ' + FONT;
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(Math.abs(car.speed) * 0.32)}`, viewW - 62, viewH - 58);
    ctx.font = '13px ' + FONT;
    ctx.fillText('km/h', viewW - 26, viewH - 58);
    ctx.fillStyle = '#ffd9a0';
    ctx.font = '12px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText(`${car.kind} — ${car.color === '#f2f2f2' ? 'POLICIA' : 'stolen'}`, viewW - 178, viewH - 34);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(viewW - 178, viewH - 28, 152, 8);
    ctx.fillStyle = car.health > 35 ? '#7ab648' : '#ff4b3e';
    ctx.fillRect(viewW - 178, viewH - 28, 152 * Math.max(0, car.health / 100), 8);
  }
  // Radio + clock + save, bottom left.
  panel(ctx, 14, viewH - 64, 300, 50, 0.82);
  ctx.fillStyle = '#fff3d6';
  ctx.font = 'bold 14px ' + FONT;
  ctx.textAlign = 'left';
  ctx.fillText(`♪ ${currentStationName(state.radio)}  [R]`, 24, viewH - 44);
  ctx.font = '13px ' + FONT;
  ctx.fillStyle = '#ffd9a0';
  const hh = Math.floor(state.clock / 60) % 24, mm = Math.floor(state.clock % 60);
  ctx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  •  ${state.saveFlash > 0 ? '✓ SAVED' : 'WASD move · E car · F punch · M mute'}`, 24, viewH - 26);

  // Dialogue box during missions.
  if (state.dialogue) {
    const w = Math.min(720, viewW - 120);
    panel(ctx, (viewW - w) / 2, viewH - 150, w, 76, 0.92);
    ctx.fillStyle = '#ffb03a';
    ctx.font = 'bold 15px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText(state.dialogue.who, (viewW - w) / 2 + 18, viewH - 122);
    ctx.fillStyle = '#fff3d6';
    ctx.font = '16px ' + FONT;
    wrapText(ctx, state.dialogue.line, (viewW - w) / 2 + 18, viewH - 100, w - 36, 20);
  }
  // Busted warning pulse.
  if (state.wanted.bustedTimer > 0.4) {
    ctx.fillStyle = `rgba(255,40,30,${0.25 + Math.sin(state.time * 10) * 0.12})`;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('THEY HAVE YOU — BREAK FREE!', viewW / 2, viewH / 2 - 120);
  }
  // Low health vignette.
  if (state.player.health < 30) {
    ctx.fillStyle = `rgba(255,0,0,${0.12 + Math.sin(state.time * 6) * 0.06})`;
    ctx.fillRect(0, 0, viewW, 40); ctx.fillRect(0, viewH - 40, viewW, 40);
    ctx.fillRect(0, 0, 40, viewH); ctx.fillRect(viewW - 40, 0, 40, viewH);
  }
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = word; y += lh;
    } else line = test;
  }
  ctx.fillText(line, x, y);
}

// ---- menus ----------------------------------------------------------------

function titleBlock(ctx, viewW, title, sub) {
  ctx.fillStyle = 'rgba(20,10,4,0.55)';
  ctx.fillRect(0, 0, viewW, 190);
  ctx.fillStyle = '#ffb03a';
  ctx.font = 'bold 74px ' + FONT;
  ctx.textAlign = 'center';
  ctx.fillText(title, viewW / 2, 96);
  ctx.fillStyle = '#fff3d6';
  ctx.font = '20px ' + FONT;
  ctx.fillText(sub, viewW / 2, 132);
  ctx.fillStyle = '#ff7a2a';
  ctx.fillRect(viewW / 2 - 160, 150, 320, 4);
}

function button(ctx, rect, label, enabled = true, hot = false) {
  ctx.fillStyle = enabled ? (hot ? '#ffb03a' : 'rgba(30,20,10,0.9)') : 'rgba(60,60,60,0.7)';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = enabled ? '#ffb03a' : '#666';
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
  ctx.fillStyle = enabled ? (hot ? '#241505' : '#fff3d6') : '#999';
  ctx.font = 'bold 19px ' + FONT;
  ctx.textAlign = 'center';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 7);
}

function menuButtons(ctx, viewW, startY, labels) {
  const rects = [];
  labels.forEach((item, i) => {
    const rect = { x: viewW / 2 - 190, y: startY + i * 58, w: 380, h: 46, id: item.id };
    button(ctx, rect, item.label, item.enabled !== false);
    rects.push({ ...rect, enabled: item.enabled !== false });
  });
  return rects;
}

/** Draw the current menu screen; returns clickable button rects [{id,x,y,w,h}]. */
export function drawMenu(ctx, state, viewW, viewH) {
  const screen = state.screen;
  ctx.fillStyle = '#1a0f06';
  ctx.fillRect(0, 0, viewW, viewH);
  if (screen === 'menu') {
    // Sun-soaked title backdrop: gradient sky + skyline silhouette.
    const g = ctx.createLinearGradient(0, 0, 0, viewH);
    g.addColorStop(0, '#ff9a3d'); g.addColorStop(0.55, '#e86a4a'); g.addColorStop(1, '#7a3a2a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, viewW, viewH);
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(viewW - 190, 130, 62, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(60,25,10,0.85)';
    const skyline = [90, 150, 110, 190, 130, 170, 210, 140, 100, 180, 120];
    let sx = 40;
    for (const h of skyline) { ctx.fillRect(sx, viewH - 240 - h, 96, h + 240); sx += 112; }
    ctx.fillStyle = 'rgba(47,179,201,0.9)';
    ctx.fillRect(0, viewH - 60, viewW, 60);
    titleBlock(ctx, viewW, 'DEL RIO', 'A sun-baked getaway — Marisol “Sol” Vega comes home');
    const hasSave = !!state.saveData;
    const rects = menuButtons(ctx, viewW, 250, [
      { id: 'continue', label: '▶  Continue', enabled: hasSave },
      { id: 'new', label: 'New Game' },
      { id: 'missions', label: 'Missions — pick a job' },
      { id: 'controls', label: 'Controls & radio' },
    ]);
    ctx.fillStyle = '#fff3d6';
    ctx.font = '15px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('6 story missions · police chases · heists · taxi fares · stunt jumps · photo spots', viewW / 2, 510);
    ctx.fillText('WASD move · mouse aim · E enter car / take photo · F punch · Space jump · R radio · M mute', viewW / 2, 536);
    ctx.fillText('An original game. No Rockstar, no GTA — Del Rio is ours.', viewW / 2, 580);
    return rects;
  }
  if (screen === 'missionSelect') {
    titleBlock(ctx, viewW, 'MISSIONS', 'Pick a job — earlier jobs unlock in order');
    const rects = [];
    MISSIONS.forEach((m, i) => {
      const unlocked = i <= state.missionsDone;
      const done = i < state.missionsDone;
      const rect = { x: viewW / 2 - 330, y: 220 + i * 62, w: 660, h: 50, id: `mission-${i}` };
      button(ctx, rect, `${done ? '✓ ' : ''}${m.id}. ${m.title} — $${m.reward}${unlocked ? '' : '  (locked)'}`, unlocked);
      rects.push({ ...rect, enabled: unlocked });
    });
    rects.push(...menuButtons(ctx, viewW, 220 + 6 * 62 + 10, [{ id: 'back', label: '← Back' }]));
    return rects;
  }
  if (screen === 'controls') {
    titleBlock(ctx, viewW, 'CONTROLS', 'Keyboard + mouse — built for desktop Chrome');
    ctx.fillStyle = '#fff3d6';
    ctx.font = '18px ' + FONT;
    ctx.textAlign = 'left';
    const lines = [
      'WASD / arrows — move on foot, drive in a car',
      'Mouse — aim the pistol (after mission 2) · click to shoot',
      'E — enter / exit a car ·  on foot at a 📷 spot, E takes a photo (+$75)',
      'F — punch ·  Space — jump',
      'Shift — sprint on foot ·  Right-click — handbrake',
      'T — start a taxi fare at a yellow TAXI stand',
      'G — garage at Sol’s house (buy cars, change paint)',
      'R — switch radio station ·  M — mute ·  Esc — pause',
      '',
      'RADIO: Radio Sol (cumbia del Rio) · Neon Drive (synth nights)',
      'WANTED: crime raises stars. Hide, stay clean, and they fall.',
      'Speeding past a patrol car adds heat. Lose a 3+ star chase: +$200.',
    ];
    lines.forEach((l, i) => ctx.fillText(l, viewW / 2 - 330, 240 + i * 30));
    return menuButtons(ctx, viewW, 580, [{ id: 'back', label: '← Back' }]);
  }
  if (screen === 'briefing') {
    const m = MISSIONS[state.briefingIndex];
    titleBlock(ctx, viewW, `MISSION ${m.id} — ${m.title.toUpperCase()}`, `Reward $${m.reward}`);
    ctx.fillStyle = '#fff3d6';
    ctx.font = '19px ' + FONT;
    ctx.textAlign = 'left';
    wrapText(ctx, m.briefing, viewW / 2 - 330, 250, 660, 27);
    ctx.font = '16px ' + FONT;
    ctx.fillStyle = '#ffd9a0';
    m.steps.forEach((s, i) => ctx.fillText(`${i + 1}. ${s.text}`, viewW / 2 - 330, 380 + i * 28));
    return menuButtons(ctx, viewW, 560, [
      { id: 'startMission', label: '▶  Start the job' },
      { id: 'back', label: '← Back' },
    ]);
  }
  if (screen === 'paused') {
    titleBlock(ctx, viewW, 'PAUSED', 'Del Rio waits for no one — except now');
    return menuButtons(ctx, viewW, 260, [
      { id: 'resume', label: 'Resume' },
      { id: 'garage', label: 'Garage (at Sol’s house)' },
      { id: 'quit', label: 'Quit to title' },
    ]);
  }
  if (screen === 'missionComplete') {
    const m = MISSIONS[state.mission.index];
    titleBlock(ctx, viewW, 'JOB DONE', `${m.title} — +$${m.reward}`);
    ctx.fillStyle = '#fff3d6';
    ctx.font = '20px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(`Cash: $${state.cash.toLocaleString('en-US')}   •   Missions ${state.missionsDone}/6`, viewW / 2, 260);
    if (state.storyComplete) ctx.fillText('STORY COMPLETE — free roam unlocked. Del Rio is yours, Sol.', viewW / 2, 300);
    return menuButtons(ctx, viewW, 340, [
      { id: 'nextMission', label: state.missionsDone < 6 ? '▶  Next mission' : 'Free roam' },
      { id: 'roam', label: 'Free roam' },
    ]);
  }
  if (screen === 'missionFailed') {
    titleBlock(ctx, viewW, 'JOB FAILED', state.mission?.failReason ?? 'The job went south.');
    return menuButtons(ctx, viewW, 280, [
      { id: 'retry', label: '↻  Retry the mission' },
      { id: 'roam', label: 'Free roam instead' },
    ]);
  }
  if (screen === 'busted') {
    titleBlock(ctx, viewW, 'BUSTED', 'The Del Rio police took you in — $200 fine, car impounded.');
    return menuButtons(ctx, viewW, 280, [
      { id: 'respawn', label: 'Walk out — back to the garage' },
    ]);
  }
  if (screen === 'wasted') {
    titleBlock(ctx, viewW, 'WASTED', 'Sol went down — but Del Rio doesn’t keep a good driver down.');
    return menuButtons(ctx, viewW, 280, [
      { id: 'respawn', label: 'Get up — back to the garage' },
    ]);
  }
  if (screen === 'storyComplete') {
    titleBlock(ctx, viewW, 'LAST LIGHT', 'Story complete. Six jobs, one free driver, one sun-baked city.');
    ctx.fillStyle = '#fff3d6';
    ctx.font = '20px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(`Final cash: $${state.cash.toLocaleString('en-US')} — keep playing in free roam.`, viewW / 2, 260);
    return menuButtons(ctx, viewW, 320, [{ id: 'roam', label: '▶  Free roam' }]);
  }
  if (screen === 'garage') {
    titleBlock(ctx, viewW, 'SOL’S GARAGE', `Cash $${state.cash.toLocaleString('en-US')} — cars & paint`);
    const rects = [];
    const cars = [
      { id: 'buy-gt', name: 'Canyon GT — $1,500', price: 1500 },
      { id: 'buy-van', name: 'Burrito Van — $800', price: 800 },
      { id: 'buy-taxi', name: 'Pueblo Taxi — $600', price: 600 },
    ];
    cars.forEach((c, i) => {
      const owned = state.garage.includes(c.id);
      const rect = { x: viewW / 2 - 330, y: 220 + i * 62, w: 660, h: 50, id: c.id };
      button(ctx, rect, owned ? `✓ ${c.name} (owned)` : `${c.name}`, !owned && state.cash >= c.price);
      rects.push({ ...rect, enabled: !owned && state.cash >= c.price });
    });
    const paints = ['#d94f3d', '#3d7bd9', '#e8b93c', '#7ab648', '#ff7a2a'];
    paints.forEach((color, i) => {
      const rect = { x: viewW / 2 - 200 + i * 82, y: 430, w: 66, h: 44, id: `paint-${i}` };
      ctx.fillStyle = color;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = state.paint === color ? '#fff' : '#ffb03a';
      ctx.lineWidth = state.paint === color ? 4 : 2;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      rects.push({ ...rect, enabled: true });
    });
    ctx.fillStyle = '#fff3d6';
    ctx.font = '15px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('Paint — $100 (click a colour)', viewW / 2, 500);
    rects.push(...menuButtons(ctx, viewW, 540, [{ id: 'back', label: '← Back' }]));
    return rects;
  }
  return [];
}
