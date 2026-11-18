// buildCity — Del Rio itself, generated once from a fixed seed: the road grid,
// the Rio Seco river and its three bridges, downtown, riverwalk, suburbs, mercado,
// canyon highway, palms, props, sun discs, photo spots, ramps and taxi stands.
// Also owns the collision queries every mover (player, cars, peds, police) asks.
import { AVENUES, BRIDGES, HIGHWAY_HALF, HIGHWAY_Y, PALETTE, RIVER, ROAD_HALF, STREETS, WORLD } from './config.js';
import { makeRng } from './rng.js';

const ROOF_COLORS = ['#c96f3f', '#d9a441', '#f4ead2', '#b98a5a', '#e07a4a', '#fbf6e9', '#cf8a4b'];
const WALL_COLORS = ['#f4ead2', '#e8d9b0', '#fbf6e9', '#e6c795', '#dfc193'];

// Named places the missions, HUD and screenshots point at.
export const PLACES = {
  safehouse: { x: 600, y: 560, label: "Sol's Garage" },
  riverwalkMeet: { x: 2880, y: 1280, label: 'Riverwalk Meet' },
  mercado: { x: 560, y: 2000, label: 'Mercado Sol' },
  downtown: { x: 1760, y: 1280, label: 'Downtown Del Rio' },
  tollBridge: { x: 3200, y: 800, label: 'Toll Bridge' },
  canyonGate: { x: 2240, y: 2620, label: 'Canyon Gate' },
  viewpoint: { x: 2900, y: 2500, label: 'Canyon Overlook' },
  hideout: { x: 560, y: 560, label: 'Hideout' },
  eastBank: { x: 3600, y: 1760, label: 'La Orilla Este' },
};

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const palms = [];
  const props = []; // {kind:'bench'|'fountain'|'billboard'|'kiosk', x, y, text?}
  const discs = [];
  const ramps = [
    { x: 1500, y: HIGHWAY_Y, angle: 0, label: 'Stunt Jump' },
    { x: 2600, y: HIGHWAY_Y, angle: Math.PI, label: 'Stunt Jump' },
  ];
  const taxiStands = [
    { x: 1330, y: 750, label: 'Taxi Stand' },
    { x: 2290, y: 1710, label: 'Taxi Stand' },
    { x: 2770, y: 1230, label: 'Taxi Stand' },
  ];
  // Photo spots: on-foot viewpoints where Sol can snap a picture for cash.
  // They sit in open ground with no car nearby, so E always means "photo".
  const photoSpots = [
    { x: 2960, y: 2460, label: 'Canyon Overlook', taken: false },
    { x: 2800, y: 1360, label: 'Riverwalk', taken: false },
    { x: 1760, y: 1280, label: 'Downtown Fountain', taken: false },
  ];

  // Road edges, sorted, so blocks are the gaps between roads.
  const xEdges = [0, ...AVENUES.map((c) => c - ROAD_HALF), ...AVENUES.map((c) => c + ROAD_HALF), WORLD.width].sort((a, b) => a - b);
  const yEdges = [0, ...STREETS.map((c) => c - ROAD_HALF), ...STREETS.map((c) => c + ROAD_HALF), HIGHWAY_Y - HIGHWAY_HALF, HIGHWAY_Y + HIGHWAY_HALF, WORLD.height].sort((a, b) => a - b);
  const xBands = [];
  for (let i = 0; i < xEdges.length - 1; i += 2) xBands.push([xEdges[i], xEdges[i + 1]]);
  const yBands = [];
  for (let i = 0; i < yEdges.length - 1; i += 2) yBands.push([yEdges[i], yEdges[i + 1]]);

  const downtown = (x, y) => x > 1100 && x < 2400 && y > 700 && y < 1900;
  const nearPlace = (x, y, p, r) => Math.hypot(x - p.x, y - p.y) < r;

  for (const [bx0, bx1] of xBands) {
    for (const [by0, by1] of yBands) {
      const bw = bx1 - bx0, bh = by1 - by0;
      if (bw < 120 || bh < 120) continue;
      // River column: west bank is the riverwalk plaza, east bank is La Orilla Este.
      const overlapsRiver = bx0 < RIVER.x1 && bx1 > RIVER.x0;
      if (overlapsRiver) {
        if (bx0 < RIVER.x0) {
          // Riverwalk: palms, benches, fountain — no buildings. Palms stay on the west bank.
          // Benches and fountains sit on the west-bank plaza too: the block's
          // centre is mid-river (the gap between avenues 2720 and 3600 spans
          // the Rio Seco), so centre-placed props used to land in the water.
          const bankX = (bx0 + RIVER.x0) / 2;
          for (let i = 0; i < 5; i++) palms.push({ x: bx0 + 30 + rng.range(0, Math.max(10, RIVER.x0 - 60 - bx0)), y: by0 + 30 + rng.range(0, bh - 60), s: rng.range(0.9, 1.3) });
          if (rng.chance(0.5)) props.push({ kind: 'bench', x: bankX, y: (by0 + by1) / 2 });
          if (rng.chance(0.3)) props.push({ kind: 'fountain', x: bankX, y: by0 + bh * 0.5 });
        }
        continue;
      }
      // Safehouse block stays clear for the garage.
      const isSafehouseBlock = bx0 < 800 && bx1 > 320 && by0 < 800 && by1 > 320;
      const count = downtown((bx0 + bx1) / 2, (by0 + by1) / 2) ? 3 : rng.int(1, 2);
      for (let i = 0; i < count; i++) {
        const w = rng.range(90, Math.min(190, bw - 70));
        const h = rng.range(80, Math.min(170, bh - 70));
        const x = bx0 + rng.range(35, Math.max(36, bw - w - 35));
        const y = by0 + rng.range(35, Math.max(36, bh - h - 35));
        if (isSafehouseBlock && nearPlace(x + w / 2, y + h / 2, PLACES.safehouse, 260)) continue;
        if (nearPlace(x + w / 2, y + h / 2, PLACES.viewpoint, 130)) continue;
        const tall = downtown(x, y);
        buildings.push({
          x, y, w, h,
          hgt: tall ? rng.range(46, 110) : rng.range(16, 42),
          roof: rng.pick(ROOF_COLORS),
          wall: rng.pick(WALL_COLORS),
          downtown: tall,
        });
      }
      // Palms along block corners and suburbs.
      const palmCount = downtown((bx0 + bx1) / 2, (by0 + by1) / 2) ? 1 : rng.int(1, 3);
      for (let i = 0; i < palmCount; i++) {
        palms.push({ x: bx0 + rng.range(24, bw - 24), y: by0 + rng.range(24, bh - 24), s: rng.range(0.8, 1.3) });
      }
    }
  }

  // Safehouse + garage (fixed, mission-relevant).
  buildings.push({ x: 520, y: 470, w: 150, h: 110, hgt: 30, roof: '#c96f3f', wall: '#f4ead2', downtown: false, label: "Sol's Garage" });
  props.push({ kind: 'billboard', x: 1760, y: 300, text: 'DEL RIO' });
  props.push({ kind: 'billboard', x: 1280, y: 2300, text: 'RIO SECO' });
  props.push({ kind: 'billboard', x: 2720, y: 300, text: 'SOL VEGA' });
  props.push({ kind: 'kiosk', x: 2860, y: 1280 });
  props.push({ kind: 'fountain', x: 1760, y: 1280 });

  // 12 collectible sun discs on sidewalks, the riverwalk and the overlook —
  // always beside a road, never inside a building.
  const discSpots = [
    [384, 400], [864, 1500], [1344, 400], [2304, 2100], [2656, 500],
    [2850, 900], [2850, 2100], [3536, 1000], [3536, 2000], [864, 2400],
    [2900, 2500], [1760, 2620],
  ];
  for (const [x, y] of discSpots) discs.push({ x, y, taken: false });

  return { buildings, palms, props, discs, photoSpots, ramps, taxiStands, seed };
}

// ---- collision ------------------------------------------------------------

/** True when a circle of radius r at (x,y) would hit a building, the river (off a
 *  bridge deck), or the edge of the world. */
export function isSolidAt(city, x, y, r) {
  if (x < r || y < r || x > WORLD.width - r || y > WORLD.height - r) return true;
  if (x > RIVER.x0 - r && x < RIVER.x1 + r) {
    const onBridge = BRIDGES.some((by) => Math.abs(y - by) < ROAD_HALF + 8);
    if (!onBridge) return true;
  }
  for (const b of city.buildings) {
    if (x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r) return true;
  }
  return false;
}

/** Slide a circle along obstacles: try x then y separately, so cars and people
 *  glide along walls instead of sticking to them. Returns the new position. */
export function moveWithCollision(city, x, y, dx, dy, r) {
  let nx = x, ny = y;
  if (!isSolidAt(city, x + dx, y, r)) nx = x + dx;
  if (!isSolidAt(city, nx, y + dy, r)) ny = y + dy;
  return { x: nx, y: ny };
}

export function onRoad(x, y) {
  if (Math.abs(y - HIGHWAY_Y) < HIGHWAY_HALF) return true;
  if (AVENUES.some((c) => Math.abs(x - c) < ROAD_HALF)) return true;
  if (STREETS.some((c) => Math.abs(y - c) < ROAD_HALF)) return true;
  return false;
}

/** Nearest point on the road network (used to spawn traffic and police). */
export function nearestRoadPoint(x, y) {
  let best = null, bestD = Infinity;
  for (const c of AVENUES) {
    const d = Math.abs(x - c);
    if (d < bestD) { bestD = d; best = { x: c, y: Math.min(Math.max(y, 60), WORLD.height - 60) }; }
  }
  for (const c of STREETS) {
    const d = Math.abs(y - c);
    if (d < bestD) { bestD = d; best = { x: Math.min(Math.max(x, 60), WORLD.width - 60), y: c }; }
  }
  const dh = Math.abs(y - HIGHWAY_Y);
  if (dh < bestD) best = { x: Math.min(Math.max(x, 60), WORLD.width - 60), y: HIGHWAY_Y };
  return best;
}

// ---- drawing ---------------------------------------------------------------

function drawRoads(ctx, cam) {
  ctx.fillStyle = PALETTE.asphalt;
  for (const c of AVENUES) ctx.fillRect(c - ROAD_HALF, 0, ROAD_HALF * 2, WORLD.height);
  for (const c of STREETS) ctx.fillRect(0, c - ROAD_HALF, WORLD.width, ROAD_HALF * 2);
  ctx.fillRect(0, HIGHWAY_Y - HIGHWAY_HALF, WORLD.width, HIGHWAY_HALF * 2);
  // Bridge decks over the river.
  ctx.fillStyle = PALETTE.asphaltLight;
  for (const by of BRIDGES) ctx.fillRect(RIVER.x0 - 10, by - ROAD_HALF, RIVER.x1 - RIVER.x0 + 20, ROAD_HALF * 2);
  // Bridge edge lines, so the deck reads as a bridge, not a wider road.
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 3;
  for (const by of BRIDGES) {
    ctx.beginPath(); ctx.moveTo(RIVER.x0 - 10, by - ROAD_HALF); ctx.lineTo(RIVER.x1 + 10, by - ROAD_HALF); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(RIVER.x0 - 10, by + ROAD_HALF); ctx.lineTo(RIVER.x1 + 10, by + ROAD_HALF); ctx.stroke();
  }
  // Centre dashes.
  ctx.fillStyle = '#e8d98a';
  for (const c of AVENUES) {
    for (let y = 0; y < WORLD.height; y += 64) {
      if (Math.abs(y - HIGHWAY_Y) < HIGHWAY_HALF + 40) continue;
      ctx.fillRect(c - 3, y, 6, 30);
    }
  }
  for (const c of STREETS) {
    for (let x = 0; x < WORLD.width; x += 64) {
      if (x > RIVER.x0 - 60 && x < RIVER.x1 + 60) continue;
      ctx.fillRect(x, c - 3, 30, 6);
    }
  }
  for (let x = 0; x < WORLD.width; x += 80) ctx.fillRect(x, HIGHWAY_Y - 3, 40, 6);
  // Crosswalks at downtown intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const ax of [1280, 1760, 2240]) {
    for (const sy of [800, 1280, 1760]) {
      for (let i = -3; i <= 3; i++) ctx.fillRect(ax + i * 13 - 4, sy - ROAD_HALF - 16, 8, 14);
    }
  }
}

function drawBuilding(ctx, b) {
  const s = b.hgt;
  // Drop shadow / south face gives the top-down view its height.
  ctx.fillStyle = 'rgba(60,30,10,0.35)';
  ctx.fillRect(b.x + s * 0.35, b.y + s * 0.45, b.w, b.h);
  ctx.fillStyle = shade(b.wall, -28);
  ctx.fillRect(b.x + s * 0.35, b.y + s * 0.45, b.w, b.h);
  ctx.fillStyle = b.roof;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
  // Roof furniture: AC box + skylight.
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.25, Math.min(26, b.w * 0.2), Math.min(20, b.h * 0.2));
  ctx.fillStyle = PALETTE.glass;
  ctx.fillRect(b.x + b.w * 0.62, b.y + b.h * 0.55, Math.min(30, b.w * 0.24), Math.min(18, b.h * 0.22));
  if (b.downtown) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, 5);
  }
  if (b.label) {
    ctx.fillStyle = '#5a3a1a';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 5);
  }
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

function drawPalm(ctx, p, time) {
  const sway = Math.sin(time * 0.8 + p.x * 0.01) * 2;
  ctx.strokeStyle = '#8a6a42';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + sway, p.y - 16 * p.s); ctx.stroke();
  ctx.fillStyle = PALETTE.palm;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.ellipse(p.x + sway + Math.cos(a) * 11 * p.s, p.y - 16 * p.s + Math.sin(a) * 8 * p.s, 12 * p.s, 4.5 * p.s, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = PALETTE.palmDark;
  ctx.beginPath(); ctx.arc(p.x + sway, p.y - 16 * p.s, 4 * p.s, 0, Math.PI * 2); ctx.fill();
}

/** Paint the whole static city inside the camera view. */
export function drawCity(ctx, city, cam, time) {
  const { x0, y0, x1, y1 } = cam.view;
  // Ground: sun-baked sand with seeded patches.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  const rng = makeRng(city.seed + 7);
  ctx.fillStyle = 'rgba(180,140,70,0.25)';
  for (let i = 0; i < 260; i++) {
    const x = rng.range(0, WORLD.width), y = rng.range(0, WORLD.height);
    if (x < x0 - 40 || x > x1 + 40 || y < y0 - 40 || y > y1 + 40) continue;
    ctx.beginPath(); ctx.ellipse(x, y, rng.range(20, 70), rng.range(12, 40), rng.range(0, 3), 0, Math.PI * 2); ctx.fill();
  }
  // River with animated shimmer.
  ctx.fillStyle = PALETTE.riverDeep;
  ctx.fillRect(RIVER.x0, 0, RIVER.x1 - RIVER.x0, WORLD.height);
  ctx.fillStyle = PALETTE.river;
  ctx.fillRect(RIVER.x0 + 14, 0, RIVER.x1 - RIVER.x0 - 28, WORLD.height);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let y = 0; y < WORLD.height; y += 90) {
    const off = Math.sin(time * 1.2 + y * 0.02) * 14;
    ctx.fillRect(RIVER.x0 + 60 + off, y + ((time * 30) % 90), 90, 5);
  }
  ctx.fillStyle = PALETTE.riverBank;
  ctx.fillRect(RIVER.x0 - 12, 0, 12, WORLD.height);
  ctx.fillRect(RIVER.x1, 0, 12, WORLD.height);
  // River name, written down the water so the map reads at a glance.
  ctx.save();
  ctx.translate((RIVER.x0 + RIVER.x1) / 2, Math.max(y0 + 120, Math.min(y1 - 120, 1440)));
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('R I O   S E C O', 0, 0);
  ctx.restore();
  // Bridge support pillars under the highway bridge.
  ctx.fillStyle = 'rgba(30,60,70,0.6)';
  ctx.fillRect(RIVER.x0 + 90, HIGHWAY_Y - 8, 24, 16);
  ctx.fillRect(RIVER.x1 - 114, HIGHWAY_Y - 8, 24, 16);

  drawRoads(ctx, cam);

  // Sidewalk edging around blocks (drawn as pale frames on the road edges).
  ctx.strokeStyle = PALETTE.sidewalk;
  ctx.lineWidth = 10;
  for (const c of AVENUES) {
    ctx.beginPath(); ctx.moveTo(c - ROAD_HALF - 5, 0); ctx.lineTo(c - ROAD_HALF - 5, WORLD.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c + ROAD_HALF + 5, 0); ctx.lineTo(c + ROAD_HALF + 5, WORLD.height); ctx.stroke();
  }
  for (const c of STREETS) {
    ctx.beginPath(); ctx.moveTo(0, c - ROAD_HALF - 5); ctx.lineTo(WORLD.width, c - ROAD_HALF - 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, c + ROAD_HALF + 5); ctx.lineTo(WORLD.width, c + ROAD_HALF + 5); ctx.stroke();
  }

  // Buildings, sorted by y so taller ones overlap correctly.
  const visible = city.buildings.filter((b) => b.x + b.w + b.hgt > x0 && b.x - b.hgt < x1 && b.y + b.h + b.hgt > y0 && b.y - b.hgt < y1);
  visible.sort((a, b) => a.y - b.y);
  for (const b of visible) drawBuilding(ctx, b);

  // Props.
  for (const p of city.props) {
    if (p.x < x0 - 80 || p.x > x1 + 80 || p.y < y0 - 80 || p.y > y1 + 80) continue;
    if (p.kind === 'bench') {
      ctx.fillStyle = '#7a5230'; ctx.fillRect(p.x - 22, p.y - 6, 44, 12);
      ctx.fillStyle = '#9c6f42'; ctx.fillRect(p.x - 22, p.y - 10, 44, 5);
    } else if (p.kind === 'fountain') {
      ctx.fillStyle = '#d9c9a0'; ctx.beginPath(); ctx.arc(p.x, p.y, 34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PALETTE.river; ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(p.x, p.y, 8 + Math.sin(time * 3) * 2, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === 'kiosk') {
      ctx.fillStyle = '#e07a4a'; ctx.fillRect(p.x - 18, p.y - 14, 36, 28);
      ctx.fillStyle = '#f4ead2'; ctx.fillRect(p.x - 18, p.y - 18, 36, 6);
    } else if (p.kind === 'billboard') {
      ctx.fillStyle = '#5a3a1a'; ctx.fillRect(p.x - 4, p.y, 8, 44);
      ctx.fillStyle = '#fff3d6'; ctx.fillRect(p.x - 70, p.y - 52, 140, 52);
      ctx.strokeStyle = '#c96f3f'; ctx.lineWidth = 4; ctx.strokeRect(p.x - 70, p.y - 52, 140, 52);
      ctx.fillStyle = '#c96f3f'; ctx.font = 'bold 22px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y - 18);
    }
  }

  for (const p of city.palms) {
    if (p.x < x0 - 40 || p.x > x1 + 40 || p.y < y0 - 40 || p.y > y1 + 40) continue;
    drawPalm(ctx, p, time);
  }

  // Sun discs (collectibles).
  for (const d of city.discs) {
    if (d.taken) continue;
    if (d.x < x0 - 40 || d.x > x1 + 40 || d.y < y0 - 40 || d.y > y1 + 40) continue;
    const pulse = 1 + Math.sin(time * 4 + d.x) * 0.15;
    ctx.fillStyle = '#ffb03a';
    ctx.beginPath(); ctx.arc(d.x, d.y, 14 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffdf7a';
    ctx.beginPath(); ctx.arc(d.x, d.y, 8 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a4a00'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('☀', d.x, d.y + 5);
  }

  // Photo spots: a pulsing viewfinder ring with a camera mark and a label.
  for (const s of city.photoSpots) {
    if (s.taken) continue;
    if (s.x < x0 - 60 || s.x > x1 + 60 || s.y < y0 - 60 || s.y > y1 + 60) continue;
    const pulse = 1 + Math.sin(time * 3 + s.x) * 0.12;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(s.x, s.y, 24 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(20,14,8,0.75)';
    ctx.beginPath(); ctx.arc(s.x, s.y, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3d6';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📷', s.x, s.y + 5);
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = '#241505';
    ctx.fillText(`${s.label} — press E`, s.x, s.y + 42);
  }

  // Stunt ramps.
  for (const r of city.ramps) {
    ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.angle);
    ctx.fillStyle = '#ff7a2a'; ctx.fillRect(-34, -20, 68, 40);
    ctx.fillStyle = '#fff3d6';
    for (let i = 0; i < 3; i++) ctx.fillRect(-30 + i * 22, -16, 12, 32);
    ctx.restore();
  }

  // Taxi stands.
  for (const t of city.taxiStands) {
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(t.x, t.y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('TAXI', t.x, t.y + 4);
  }
}
