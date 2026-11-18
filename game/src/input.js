// input.js — keyboard and mouse for Del Rio. Held keys give movement/steering;
// one-shot presses (interact, punch, pause, radio, mute, menus) are queued as
// flags and taken once by the loop, so a press between frames is never lost.
export const ACTION_INTERACT = 1;
export const ACTION_PUNCH = 2;
export const ACTION_PAUSE = 4;
export const ACTION_JUMP = 8;
export const ACTION_RADIO = 16;
export const ACTION_MUTE = 32;
export const ACTION_TAXI = 64;
export const ACTION_CONFIRM = 128;
export const ACTION_GARAGE = 256;

const KEYS = {
  up: new Set(['KeyW', 'ArrowUp']),
  down: new Set(['KeyS', 'ArrowDown']),
  left: new Set(['KeyA', 'ArrowLeft']),
  right: new Set(['KeyD', 'ArrowRight']),
};

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, sprint: false, handbrake: false };
  let actions = 0;
  let mouseX = 0, mouseY = 0, mouseDown = false, clicked = false;
  let lastKey = '';

  window.addEventListener('keydown', (event) => {
    const c = event.code;
    if (KEYS.up.has(c)) held.up = true;
    else if (KEYS.down.has(c)) held.down = true;
    else if (KEYS.left.has(c)) held.left = true;
    else if (KEYS.right.has(c)) held.right = true;
    else if (c === 'ShiftLeft' || c === 'ShiftRight') held.sprint = true;
    else if (c === 'Space') { if (!event.repeat) actions |= ACTION_JUMP; }
    else if (c === 'KeyE') { if (!event.repeat) actions |= ACTION_INTERACT; }
    else if (c === 'KeyF') { if (!event.repeat) actions |= ACTION_PUNCH; }
    else if (c === 'Escape' || c === 'KeyP') { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (c === 'KeyR') { if (!event.repeat) actions |= ACTION_RADIO; }
    else if (c === 'KeyM') { if (!event.repeat) actions |= ACTION_MUTE; }
    else if (c === 'KeyT') { if (!event.repeat) actions |= ACTION_TAXI; }
    else if (c === 'KeyG') { if (!event.repeat) actions |= ACTION_GARAGE; }
    else if (c === 'Enter') { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else return;
    lastKey = c;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    const c = event.code;
    if (KEYS.up.has(c)) held.up = false;
    else if (KEYS.down.has(c)) held.down = false;
    else if (KEYS.left.has(c)) held.left = false;
    else if (KEYS.right.has(c)) held.right = false;
    else if (c === 'ShiftLeft' || c === 'ShiftRight') held.sprint = false;
  });
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = held.sprint = held.handbrake = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left; mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouseDown = true; clicked = true; }
    if (e.button === 2) held.handbrake = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouseDown = false;
    if (e.button === 2) held.handbrake = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    held,
    mouse() { return { x: mouseX, y: mouseY, down: mouseDown, clicked: takeClick() }; },
    takeActions() { const t = actions; actions = 0; return t; },
    lastKey() { return lastKey; },
  };

  function takeClick() { const c = clicked; clicked = false; return c; }
}
