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

/** The shared AudioContext, lazily created on first use (see unlock() --
 * it can only actually start making sound after a user gesture). Exposed
 * so public/js/music.js can hang its own gain node off the same context
 * instead of opening a second one. */
export function getContext() {
  return ensure();
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
  shoot: () => {
    blip({ freq: 1100, to: 300, dur: 0.09, type: 'sawtooth', gain: 0.14 });
    noise({ dur: 0.04, gain: 0.08, freq: 3000 });
  },
  tag: () => {
    blip({ freq: 880, to: 220, dur: 0.2, type: 'sawtooth', gain: 0.2 });
    noise({ dur: 0.16, gain: 0.12, freq: 2200 });
  },
  tagged: () => {
    blip({ freq: 200, to: 90, dur: 0.3, type: 'square', gain: 0.22 });
  },
  // A jagged electric buzz layered on top of a tag on Frankenstein's Lab --
  // the jolt that turns whoever's caught into the monster.
  zap: () => {
    blip({ freq: 90, to: 1000, dur: 0.05, type: 'square', gain: 0.16 });
    blip({ freq: 750, to: 60, dur: 0.09, type: 'sawtooth', gain: 0.14, delay: 0.05 });
    blip({ freq: 950, to: 120, dur: 0.06, type: 'square', gain: 0.12, delay: 0.12 });
    noise({ dur: 0.22, gain: 0.13, freq: 3200 });
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
  // A ~3s wrapper-crinkle texture -- a lot of short, irregularly-timed noise
  // crackles layered together, matching the candy freeze duration exactly so
  // the sound only stops once you can actually move again.
  candy: () => {
    const bursts = 36;
    for (let i = 0; i < bursts; i++) {
      const delay = (i / bursts) * 2.9 + Math.random() * 0.06;
      noise({ dur: 0.03 + Math.random() * 0.05, gain: 0.05 + Math.random() * 0.05, freq: 2200 + Math.random() * 2600, delay });
    }
  },
  // Heard when someone ELSE gets caught -- one quick crinkle-catch cue
  // instead of the full 3s texture, so a busy round doesn't turn into a
  // wall of wrapper noise.
  candyPop: () => {
    noise({ dur: 0.04, gain: 0.08, freq: 3200 });
    noise({ dur: 0.05, gain: 0.06, freq: 2400, delay: 0.05 });
    blip({ freq: 700, to: 500, dur: 0.08, type: 'triangle', gain: 0.08, delay: 0.02 });
  },
  // A rising magical arpeggio for grabbing a power orb yourself.
  orb: () => {
    [520, 780, 1040, 1400].forEach((f, i) => blip({ freq: f, dur: 0.13, type: 'sine', gain: 0.14, delay: i * 0.045 }));
  },
  // A quieter, shorter cue heard when someone ELSE grabs one.
  orbFar: () => {
    blip({ freq: 700, to: 1100, dur: 0.12, type: 'sine', gain: 0.06 });
  },
  // A ~3s icy crystalline chime, matching CANDY_FREEZE_TIME -- cold and
  // glassy where candy's cue is a warm paper crinkle, so the Frost Touch
  // power doesn't sound like a candy wrapper appeared out of nowhere on a
  // map with no candy in sight.
  freeze: () => {
    const notes = 14;
    for (let i = 0; i < notes; i++) {
      const delay = (i / notes) * 2.8 + Math.random() * 0.05;
      const freq = 1500 + Math.random() * 1300;
      blip({
        freq, to: freq * 0.7, dur: 0.4, type: 'sine', gain: 0.05, delay,
      });
    }
  },
  // Heard by whoever lands the freeze, and by anyone else nearby -- one
  // quick icy crack instead of the full sustained chime.
  freezePop: () => {
    blip({ freq: 1400, to: 700, dur: 0.14, type: 'sine', gain: 0.1 });
    blip({
      freq: 2000, to: 1000, dur: 0.1, type: 'triangle', gain: 0.06, delay: 0.03,
    });
  },
  // Musical Chairs: a harsh needle-scratch the instant the music cuts out.
  chairsStop: () => {
    noise({ dur: 0.18, gain: 0.18, freq: 1800 });
    blip({
      freq: 260, to: 70, dur: 0.35, type: 'sawtooth', gain: 0.2, delay: 0.04,
    });
  },
  // A short sad buzzer for the local player missing a chair.
  chairsOut: () => {
    blip({ freq: 300, to: 90, dur: 0.4, type: 'sawtooth', gain: 0.2 });
    blip({
      freq: 200, to: 60, dur: 0.5, type: 'square', gain: 0.12, delay: 0.15,
    });
  },
  // A quieter thud heard when someone ELSE misses a chair.
  chairsOutFar: () => {
    noise({ dur: 0.06, gain: 0.08, freq: 500 });
    blip({ freq: 220, to: 130, dur: 0.12, type: 'triangle', gain: 0.08 });
  },
};
