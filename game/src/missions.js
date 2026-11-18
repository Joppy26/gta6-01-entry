// missions.js — the story of Marisol "Sol" Vega in six missions. Each mission is
// a list of steps; a step is one job (steal a car, reach a marker, tail a van,
// survive a chase) with a waypoint, a time limit where it matters, and a line of
// dialogue. startMission / updateMission drive the state machine in main.js.
import { HIGHWAY_Y, MISSION_REWARDS } from './config.js';
import { PLACES as CITY_PLACES } from './city.js';

const P = CITY_PLACES;

export const MISSIONS = [  {
    id: 1, title: 'Homecoming',
    briefing: 'Five years away, and Del Rio still smells like dust and diesel. Tia Rosa needs a driver tonight — first, get yourself a car.',
    reward: MISSION_REWARDS[0],
    steps: [
      { type: 'enterCar', text: 'Steal a car — walk up to one and press E', dialogue: ['SOL', 'Alright, Del Rio. Let’s see if I still remember how to drive.'] },
      { type: 'goto', x: P.riverwalkMeet.x, y: P.riverwalkMeet.y, radius: 90, inCar: true, text: 'Drive to the riverwalk meet', dialogue: ['TIA ROSA', 'Sol! Over here, mija. The riverwalk, by the kiosk. Don’t scratch the paint.'] },
    ],
  },
  {
    id: 2, title: 'The Riverwalk Job',
    briefing: 'A package is waiting under the third bench on the riverwalk. Grab it on foot before the courier’s window closes — and mind the patrol car.',
    reward: MISSION_REWARDS[1],
    steps: [
      { type: 'pickup', x: 2880, y: 900, radius: 60, time: 90, text: 'Pick up the package on foot — 90 seconds', dialogue: ['DARIO', 'Third bench, north end. You’ll know it by the red ribbon. Take the pistol too — you’ll need it.'] },
      { type: 'goto', x: P.safehouse.x, y: P.safehouse.y, radius: 110, text: 'Bring the package back to the garage', dialogue: ['SOL', 'Package secured. Now let’s get out of the open.'] },
    ],
    onStart(state) { state.wanted.heat = 1; state.wanted.stars = 1; state.wanted.lastCrimeAt = state.time; },
    onComplete(state) { state.player.hasPistol = true; state.player.ammo = 48; },
  },
  {
    id: 3, title: 'Canyon Run',
    briefing: 'The county boys want the car you’re driving. Take the canyon highway south, over the new highway bridge across the Rio Seco, thread the checkpoints, and don’t stop for anything.',
    reward: MISSION_REWARDS[2],
    steps: [
      { type: 'drive', checkpoints: [{ x: 1500, y: HIGHWAY_Y, r: 90 }, { x: 2600, y: HIGHWAY_Y, r: 90 }, { x: 3400, y: HIGHWAY_Y, r: 90 }], text: 'Run the canyon highway checkpoints', dialogue: ['RADIO', '…police are in pursuit of a stolen sedan on the canyon highway…'] },
      { type: 'goto', x: P.viewpoint.x, y: P.viewpoint.y, radius: 120, inCar: true, text: 'Reach the canyon overlook', dialogue: ['SOL', 'They’ll never follow me up here. Breathe, Sol. Breathe.'] },
    ],
    onStart(state) { state.policeSetHeat(2); },
  },
  {
    id: 4, title: 'The Toll Bridge',
    briefing: 'A courier van crosses the toll bridge at dusk carrying the cartel’s ledger. Tail it through downtown traffic. Too close and the driver spooks — too far and you lose him.',
    reward: MISSION_REWARDS[3],
    steps: [
      { type: 'tail', holdTime: 18, text: 'Tail the courier van — not too close, not too far', dialogue: ['DARIO', 'White van, plate RIO-7. Follow him. If he sees you, the whole job burns.'] },
      { type: 'goto', x: P.tollBridge.x, y: P.tollBridge.y, radius: 120, inCar: true, text: 'Follow the van onto the toll bridge', dialogue: ['SOL', 'There it is — the toll bridge. Tomorrow, we take it.'] },
    ],
    onStart(state) { state.spawnCourierVan(); },
  },
  {
    id: 5, title: 'Bridge Heist',
    briefing: 'The big one. Hit the courier van on the toll bridge, take the ledger, and get clear before the whole Del Rio force answers.',
    reward: MISSION_REWARDS[4],
    steps: [
      { type: 'combat', count: 4, text: 'Take down the bridge guards', dialogue: ['DARIO', 'Go loud, Sol. The van stops here, one way or another.'] },
      { type: 'pickup', x: P.tollBridge.x, y: P.tollBridge.y, radius: 80, text: 'Grab the ledger from the van', dialogue: ['SOL', 'Ledger’s mine. Now the hard part — leaving.'] },
      { type: 'goto', x: P.safehouse.x, y: P.safehouse.y, radius: 110, text: 'Escape to the garage with 3-star heat', dialogue: ['RADIO', '…armed robbery on the toll bridge, suspects fleeing west…'] },
    ],
    onStart(state) { state.spawnCourierVan(true); state.spawnGuards(); state.policeSetHeat(3); },
  },
  {
    id: 6, title: 'Last Light',
    briefing: 'Everything you stole, everyone you crossed — it all comes due tonight. One last drive across Del Rio, lose the whole force, and be free by last light.',
    reward: MISSION_REWARDS[5],
    steps: [
      { type: 'drive', checkpoints: [{ x: 800, y: 800, r: 100 }, { x: 2240, y: 1760, r: 100 }, { x: 3600, y: 800, r: 100 }], text: 'Cross the city — three checkpoints', dialogue: ['TIA ROSA', 'Drive, mija. Every street you ever knew is behind you now.'] },
      { type: 'loseHeat', text: 'Lose the heat — stay clean and unseen', dialogue: ['SOL', 'Almost there. Just need them to lose me…'] },
      { type: 'goto', x: P.hideout.x, y: P.hideout.y, radius: 120, text: 'Reach the hideout at last light', dialogue: ['SOL', 'Home. Finally home. Del Rio, you beautiful trouble — I’m free.'] },
    ],
    onStart(state) { state.policeSetHeat(4); },
    onComplete(state) { state.storyComplete = true; },
  },
];

/** Begin mission i (0-based). Resets step state, shows the briefing. */
export function startMission(state, index) {
  const def = MISSIONS[index];
  state.mission = {
    index, def, stepIndex: 0, stepState: {},
    timer: 0, failed: false, complete: false,
    startedAt: state.time,
  };
  if (def.onStart) def.onStart(state);
  state.setObjective(def.steps[0].text);
  state.addBanner(`MISSION ${def.id}: ${def.title}`, 4);
  state.setScreen('playing');
  state.saveGame();
  return def;
}

export function currentStep(state) {
  if (!state.mission) return null;
  return state.mission.def.steps[state.mission.stepIndex] ?? null;
}

/** "2/3" style progress for the HUD: which step of this mission Sol is on. */
export function missionProgress(state) {
  if (!state.mission) return null;
  return { index: state.mission.index, step: state.mission.stepIndex + 1, total: state.mission.def.steps.length };
}

export function advanceStep(state) {
  state.mission.stepIndex += 1;
  state.mission.stepState = {};
  state.mission.timer = 0;
  const step = currentStep(state);
  if (!step) {
    completeMission(state);
    return;
  }
  state.setObjective(step.text);
  state.addBanner(step.text, 3);
}

function completeMission(state) {
  const m = state.mission;
  m.complete = true;
  state.cash += m.def.reward;
  state.missionsDone = Math.max(state.missionsDone, m.index + 1);
  if (m.def.onComplete) m.def.onComplete(state);
  state.clearWantedSoft();
  state.setScreen('missionComplete');
  state.saveGame();
}

export function failMission(state, reason) {
  if (!state.mission || state.mission.complete) return;
  state.mission.failed = true;
  state.mission.failReason = reason;
  state.setScreen('missionFailed');
  state.saveGame();
}

/** Per-frame mission logic. Returns nothing; advances steps and fails on timers. */
export function updateMission(state, dt) {
  const m = state.mission;
  if (!m || m.complete || m.failed) return;
  const step = currentStep(state);
  if (!step) return;
  m.timer += dt;
  const px = state.player.inCar ? state.player.inCar.x : state.player.x;
  const py = state.player.inCar ? state.player.inCar.y : state.player.y;
  const distTo = (x, y) => Math.hypot(px - x, py - y);

  if (step.time && m.timer > step.time) {
    failMission(state, 'Out of time — the window closed.');
    return;
  }

  switch (step.type) {
    case 'enterCar':
      if (state.player.inCar) advanceStep(state);
      break;
    case 'goto':
      if ((!step.inCar || state.player.inCar) && distTo(step.x, step.y) < step.radius) advanceStep(state);
      break;
    case 'pickup':
      if (!state.player.inCar && distTo(step.x, step.y) < step.radius) {
        state.addEffect('pickup', step.x, step.y);
        advanceStep(state);
      }
      break;
    case 'drive': {
      const cps = step.checkpoints;
      const idx = m.stepState.cp ?? 0;
      const cp = cps[idx];
      if (cp && distTo(cp.x, cp.y) < (cp.r ?? 90)) {
        m.stepState.cp = idx + 1;
        state.addBanner(`Checkpoint ${idx + 1}/${cps.length}`, 2);
        state.addEffect('pickup', cp.x, cp.y);
        if (idx + 1 >= cps.length) advanceStep(state);
        else state.setObjective(`${step.text} — ${idx + 1}/${cps.length} done`);
      }
      break;
    }
    case 'tail': {
      const van = state.missionVan;
      if (!van) { failMission(state, 'The courier van is gone.'); return; }
      const d = Math.hypot(px - van.x, py - van.y);
      state.missionTailDist = d;
      if (d < 70) {
        m.stepState.spook = (m.stepState.spook ?? 0) + dt;
        if (m.stepState.spook > 2.5) { failMission(state, 'Too close — the driver spooked and called it in.'); return; }
      } else if (d > 430) {
        m.stepState.lost = (m.stepState.lost ?? 0) + dt;
        if (m.stepState.lost > 5) { failMission(state, 'You lost the van in traffic.'); return; }
      } else {
        m.stepState.spook = 0; m.stepState.lost = 0;
        m.stepState.held = (m.stepState.held ?? 0) + dt;
        if (m.stepState.held >= step.holdTime) advanceStep(state);
      }
      break;
    }
    case 'combat': {
      const left = state.missionGuards.filter((g) => g.health > 0).length;
      m.stepState.left = left;
      state.setObjective(`${step.text} — ${left} left`);
      if (left <= 0) advanceStep(state);
      break;
    }
    case 'loseHeat':
      if (state.wanted.stars === 0) advanceStep(state);
      break;
    default:
      break;
  }
}

/** Waypoint for the minimap + world beacon: where the player must go next. */
export function missionWaypoint(state) {
  const step = currentStep(state);
  if (!step) return null;
  switch (step.type) {
    case 'goto': case 'pickup': return { x: step.x, y: step.y };
    case 'drive': {
      const cps = step.checkpoints;
      const idx = state.mission.stepState.cp ?? 0;
      return cps[Math.min(idx, cps.length - 1)] ?? null;
    }
    case 'tail': return state.missionVan ? { x: state.missionVan.x, y: state.missionVan.y } : null;
    case 'combat': {
      const g = state.missionGuards.find((gu) => gu.health > 0);
      return g ? { x: g.x, y: g.y } : null;
    }
    case 'loseHeat': return { x: PLACES.hideout.x, y: PLACES.hideout.y };
    default: return null;
  }
}
