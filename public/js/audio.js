// Tiny WebAudio synth so the game has sound without shipping audio files.
// The context can only start after a user gesture, so everything is lazy.

import { profile } from './storage.js';

let ctx = null;
let master = null;

function ensure() {
  if (ctx) return ctx;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  try {
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = profile.volume;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

export function unlock() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

export function setVolume(v) {
  if (master) master.gain.value = v;
}

function blip({ freq = 440, to = null, dur = 0.12, type = 'square', gain = 0.18, delay = 0 }) {
  const c = ensure();
  if (!c || profile.volume <= 0) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.18, gain = 0.14, delay = 0, freq = 1200 }) {
  const c = ensure();
  if (!c || profile.volume <= 0) return;
  const t0 = c.currentTime + delay;
  const frames = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t0);
}

export const sfx = {
  jump: () => blip({ freq: 380, to: 700, dur: 0.11, type: 'triangle', gain: 0.1 }),
  land: () => noise({ dur: 0.07, gain: 0.05, freq: 500 }),
  spring: () => blip({ freq: 300, to: 1200, dur: 0.22, type: 'sine', gain: 0.16 }),
  portal: () => {
    blip({ freq: 700, to: 1400, dur: 0.16, type: 'sine', gain: 0.12 });
    blip({ freq: 1400, to: 500, dur: 0.22, type: 'sine', gain: 0.1, delay: 0.05 });
  },
  tag: () => {
    blip({ freq: 880, to: 220, dur: 0.2, type: 'sawtooth', gain: 0.2 });
    noise({ dur: 0.16, gain: 0.12, freq: 2200 });
  },
  tagged: () => {
    blip({ freq: 200, to: 90, dur: 0.3, type: 'square', gain: 0.22 });
  },
  hazard: () => blip({ freq: 160, to: 60, dur: 0.35, type: 'sawtooth', gain: 0.18 }),
  count: () => blip({ freq: 520, dur: 0.1, type: 'square', gain: 0.14 }),
  go: () => {
    blip({ freq: 660, dur: 0.14, type: 'square', gain: 0.18 });
    blip({ freq: 990, dur: 0.2, type: 'square', gain: 0.16, delay: 0.1 });
  },
  win: () => {
    [523, 659, 784, 1046].forEach((f, i) => blip({ freq: f, dur: 0.22, type: 'triangle', gain: 0.16, delay: i * 0.11 }));
  },
  lose: () => {
    [400, 330, 260].forEach((f, i) => blip({ freq: f, dur: 0.26, type: 'triangle', gain: 0.14, delay: i * 0.13 }));
  },
  click: () => blip({ freq: 620, dur: 0.05, type: 'square', gain: 0.08 }),
  join: () => blip({ freq: 500, to: 800, dur: 0.14, type: 'sine', gain: 0.12 }),
};
