// radio.js — two procedural radio stations, generated live with WebAudio:
// "Radio Sol" (a cumbia-ish groove) and "Neon Drive" (a synth-drive arpeggio).
// No audio files anywhere. R switches station, M mutes everything.
import { sfxApi } from './sfx.js';

export const STATIONS = [
  { id: 'sol', name: 'Radio Sol — Cumbia del Rio' },
  { id: 'neon', name: 'Neon Drive — Synth Nights' },
];

export function createRadio() {
  return {
    station: 0, playing: false, nextNoteAt: 0, step: 0,
    timer: null,
  };
}

const CUMBIA_BASS = [0, 0, 7, 0, 5, 0, 7, 10]; // scale degrees, 8 steps
const CUMBIA_CHORD = [0, 3, 7, 10];
const NEON_ARP = [0, 3, 7, 12, 10, 7, 3, 0];
const SCALE = [0, 2, 3, 5, 7, 8, 10]; // minor

function noteFreq(semitones, base = 110) {
  return base * Math.pow(2, semitones / 12);
}

function playTone(sfx, freq, dur, type, vol) {
  if (!sfx.ctx || sfx.muted) return;
  try {
    const o = sfx.ctx.createOscillator();
    const g = sfx.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, sfx.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, sfx.ctx.currentTime + dur);
    o.connect(g); g.connect(sfx.master);
    o.start(); o.stop(sfx.ctx.currentTime + dur);
  } catch { /* ignore */ }
}

function scheduleStep(radio, sfx) {
  if (!radio.playing || !sfx.ctx) return;
  const station = STATIONS[radio.station];
  const step = radio.step % 16;
  if (station.id === 'sol') {
    // Cumbia groove: bass on 0/4/8/12, off-beat pluck, shaker-ish tick.
    if (step % 4 === 0) playTone(sfx, noteFreq(CUMBIA_BASS[(step / 4) % 8] - 12, 98), 0.22, 'triangle', 0.32);
    if (step % 2 === 1) playTone(sfx, noteFreq(SCALE[step % 7] + 12, 220), 0.12, 'square', 0.07);
    if (step % 4 === 2) playTone(sfx, noteFreq(CUMBIA_CHORD[step % 4] + 12, 220), 0.1, 'sine', 0.1);
  } else {
    // Synth drive: 16th-note arp + four-on-the-floor bass.
    playTone(sfx, noteFreq(NEON_ARP[step % 8] + 12, 110), 0.14, 'sawtooth', 0.09);
    if (step % 4 === 0) playTone(sfx, noteFreq(0, 55), 0.3, 'sine', 0.35);
    if (step % 8 === 4) playTone(sfx, noteFreq(7, 220), 0.2, 'triangle', 0.08);
  }
  radio.step += 1;
}

export function startRadio(radio, sfx) {
  if (radio.playing) return;
  radio.playing = true;
  radio.step = 0;
  if (radio.timer) clearInterval(radio.timer);
  radio.timer = setInterval(() => scheduleStep(radio, sfx), 150);
}

export function stopRadio(radio) {
  radio.playing = false;
  if (radio.timer) { clearInterval(radio.timer); radio.timer = null; }
}

export function switchStation(radio, sfx) {
  radio.station = (radio.station + 1) % STATIONS.length;
  radio.step = 0;
  sfxApi.click(sfx);
  return STATIONS[radio.station].name;
}

export function currentStationName(radio) {
  return STATIONS[radio.station].name;
}
