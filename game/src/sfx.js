// sfx.js — procedural sound effects, WebAudio only, no audio files. Every effect
// is a short oscillator/noise burst built on demand. Safe to call before the
// audio context exists (headless playtests): it simply does nothing.
export function createSfx() {
  return {
    ctx: null, muted: false, engineOsc: null, engineGain: null, sirenOsc: null, sirenGain: null,
  };
}

/** Call from a user gesture (click/key) — browsers block audio before one. */
export function unlockAudio(sfx) {
  if (sfx.ctx) {
    if (sfx.ctx.state === 'suspended') sfx.ctx.resume().catch(() => {});
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    sfx.ctx = new AC();
    sfx.master = sfx.ctx.createGain();
    sfx.master.gain.value = 0.5;
    sfx.master.connect(sfx.ctx.destination);
  } catch {
    sfx.ctx = null;
  }
}

function noiseBuffer(sfx, seconds) {
  const len = Math.floor(sfx.ctx.sampleRate * seconds);
  const buf = sfx.ctx.createBuffer(1, len, sfx.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  return buf;
}

function blip(sfx, freq, dur, type = 'sine', vol = 0.3) {
  if (!sfx.ctx || sfx.muted) return;
  try {
    const o = sfx.ctx.createOscillator();
    const g = sfx.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, sfx.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, sfx.ctx.currentTime + dur);
    o.connect(g); g.connect(sfx.master);
    o.start(); o.stop(sfx.ctx.currentTime + dur);
  } catch { /* audio is decoration, never fatal */ }
}

export const sfxApi = {
  click(sfx) { blip(sfx, 660, 0.07, 'square', 0.15); },
  punch(sfx) {
    if (!sfx.ctx || sfx.muted) return;
    try {
      const src = sfx.ctx.createBufferSource();
      src.buffer = noiseBuffer(sfx, 0.12);
      const f = sfx.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
      const g = sfx.ctx.createGain(); g.gain.value = 0.5;
      src.connect(f); f.connect(g); g.connect(sfx.master); src.start();
    } catch { /* ignore */ }
  },
  swing(sfx) { blip(sfx, 220, 0.08, 'sine', 0.08); },
  gunshot(sfx, distant = false) {
    if (!sfx.ctx || sfx.muted) return;
    try {
      const src = sfx.ctx.createBufferSource();
      src.buffer = noiseBuffer(sfx, distant ? 0.2 : 0.14);
      const f = sfx.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 900;
      const g = sfx.ctx.createGain(); g.gain.value = distant ? 0.18 : 0.5;
      src.connect(f); f.connect(g); g.connect(sfx.master); src.start();
      blip(sfx, 140, 0.1, 'square', distant ? 0.1 : 0.25);
    } catch { /* ignore */ }
  },
  crash(sfx) {
    if (!sfx.ctx || sfx.muted) return;
    try {
      const src = sfx.ctx.createBufferSource();
      src.buffer = noiseBuffer(sfx, 0.3);
      const f = sfx.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
      const g = sfx.ctx.createGain(); g.gain.value = 0.6;
      src.connect(f); f.connect(g); g.connect(sfx.master); src.start();
    } catch { /* ignore */ }
  },
  pickup(sfx) { blip(sfx, 880, 0.1, 'sine', 0.25); blip(sfx, 1320, 0.14, 'sine', 0.2); },
  mission(sfx) { blip(sfx, 523, 0.12, 'triangle', 0.3); setTimeout(() => blip(sfx, 784, 0.18, 'triangle', 0.3), 120); },
  busted(sfx) { blip(sfx, 330, 0.4, 'sawtooth', 0.25); },
  engine(sfx, speed01) {
    if (!sfx.ctx || sfx.muted) return;
    try {
      if (!sfx.engineOsc) {
        sfx.engineOsc = sfx.ctx.createOscillator();
        sfx.engineOsc.type = 'sawtooth';
        sfx.engineGain = sfx.ctx.createGain();
        sfx.engineGain.gain.value = 0;
        const f = sfx.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
        sfx.engineOsc.connect(f); f.connect(sfx.engineGain); sfx.engineGain.connect(sfx.master);
        sfx.engineOsc.start();
      }
      sfx.engineOsc.frequency.value = 55 + speed01 * 130;
      sfx.engineGain.gain.value = 0.05 + speed01 * 0.06;
    } catch { /* ignore */ }
  },
  engineOff(sfx) { if (sfx.engineGain) sfx.engineGain.gain.value = 0; },
  siren(sfx, on) {
    if (!sfx.ctx || sfx.muted) { if (sfx.sirenGain) sfx.sirenGain.gain.value = 0; return; }
    try {
      if (!sfx.sirenOsc) {
        sfx.sirenOsc = sfx.ctx.createOscillator();
        sfx.sirenOsc.type = 'sine';
        sfx.sirenGain = sfx.ctx.createGain();
        sfx.sirenGain.gain.value = 0;
        sfx.sirenOsc.connect(sfx.sirenGain); sfx.sirenGain.connect(sfx.master);
        sfx.sirenOsc.start();
        sfx.sirenPhase = 0;
      }
      sfx.sirenGain.gain.value = on ? 0.045 : 0;
      if (on) sfx.sirenOsc.frequency.value = 700 + Math.sin(performance.now() / 380) * 260;
    } catch { /* ignore */ }
  },
};
