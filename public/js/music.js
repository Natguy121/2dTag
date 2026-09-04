// Procedural background music -- 20 short looping tracks synthesized in real
// time with WebAudio, so there are no audio files to ship, matching how
// public/js/audio.js already handles every sound effect. Each track is just
// a parameter set (tempo, scale, chord progression, waveforms) fed through
// one shared bass/lead/drum generator below -- that's what makes 20
// distinct-sounding tracks tractable without hand-authoring 20 scores.

import { getContext } from './audio.js';

let master = null;
let scheduler = null;
let track = null;
let currentTrackId = null;
let nextNoteTime = 0;
let secondsPerBeat = 0.5;
let barBeat = 0; // 0..15, one 16th-note step within the current 4-beat bar
let barCount = 0; // increments every bar; drives the chord progression
// The saved preference can arrive (via setVolume) before the gain node
// exists -- WebAudio can't do anything before a user gesture, but Settings
// is free to load beforehand. Remembered here so the node picks it up
// instead of a hardcoded default the moment it's actually created.
let desiredVolume = 0.35;

const LOOKAHEAD = 0.12; // seconds scheduled ahead of "now" on every tick
const TICK_MS = 40;

function ensureMaster(ctx) {
  if (!master) {
    master = ctx.createGain();
    master.gain.value = desiredVolume;
    master.connect(ctx.destination);
  }
  return master;
}

export function setVolume(v) {
  desiredVolume = v;
  if (master) master.gain.value = v;
}

// --------------------------------------------------------------- scales

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
};

function noteFreq(root, semitones) {
  return root * Math.pow(2, semitones / 12);
}

// -------------------------------------------------------------- voices

function playNote(ctx, dest, freq, t0, dur, { wave = 'triangle', gain = 0.1, filter = null } = {}) {
  const osc = ctx.createOscillator();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, t0);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.02, dur * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filter;
    osc.connect(f);
    f.connect(g);
  } else {
    osc.connect(g);
  }
  g.connect(dest);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function playKick(ctx, dest, t0, gain = 0.22) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, t0);
  osc.frequency.exponentialRampToValueAtTime(45, t0 + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
  osc.connect(g);
  g.connect(dest);
  osc.start(t0);
  osc.stop(t0 + 0.2);
}

function playHat(ctx, dest, t0, gain = 0.05) {
  const dur = 0.045;
  const frames = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 6000;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  src.start(t0);
}

// ---------------------------------------------------------- track catalogue

export const MUSIC_TRACKS = [
  { id: 'chiptune-rush',    name: 'Chiptune Rush',    bpm: 150, root: 262, scale: 'major',          chords: [0, 3, 4, 3], lead: 'square',   bass: 'square',   drums: true },
  { id: 'lofi-chill',       name: 'Lo-Fi Chill',      bpm: 84,  root: 220, scale: 'dorian',          chords: [0, 3, 5, 4], lead: 'triangle', bass: 'sine',     drums: false },
  { id: 'retro-arcade',     name: 'Retro Arcade',     bpm: 140, root: 294, scale: 'pentatonic',      chords: [0, 2, 3, 2], lead: 'square',   bass: 'triangle', drums: true },
  { id: 'epic-chase',       name: 'Epic Chase',       bpm: 160, root: 196, scale: 'minor',           chords: [0, 5, 3, 4], lead: 'sawtooth', bass: 'sawtooth', drums: true },
  { id: 'candy-pop',        name: 'Candy Pop',        bpm: 132, root: 349, scale: 'major',           chords: [0, 4, 5, 3], lead: 'triangle', bass: 'square',   drums: true },
  { id: 'space-drift',      name: 'Space Drift',      bpm: 70,  root: 174, scale: 'minorPentatonic', chords: [0, 3, 4, 3], lead: 'sine',     bass: 'sine',     drums: false },
  { id: 'neon-nights',      name: 'Neon Nights',      bpm: 118, root: 233, scale: 'dorian',          chords: [0, 3, 5, 3], lead: 'sawtooth', bass: 'square',   drums: true },
  { id: 'jungle-groove',    name: 'Jungle Groove',    bpm: 128, root: 220, scale: 'minorPentatonic', chords: [0, 2, 3, 4], lead: 'triangle', bass: 'sine',     drums: true },
  { id: 'frost-waltz',      name: 'Frost Waltz',      bpm: 100, root: 262, scale: 'major',           chords: [0, 4, 5, 4], lead: 'sine',     bass: 'triangle', drums: false },
  { id: 'volcano-heat',     name: 'Volcano Heat',     bpm: 168, root: 220, scale: 'minor',           chords: [0, 3, 4, 3], lead: 'square',   bass: 'sawtooth', drums: true },
  { id: 'moonlight-float',  name: 'Moonlight Float',  bpm: 78,  root: 294, scale: 'major',           chords: [0, 5, 3, 4], lead: 'sine',     bass: 'sine',     drums: false },
  { id: 'turbo-blitz',      name: 'Turbo Blitz',      bpm: 176, root: 262, scale: 'pentatonic',      chords: [0, 2, 4, 2], lead: 'sawtooth', bass: 'square',   drums: true },
  { id: 'spy-stealth',      name: 'Spy Stealth',      bpm: 96,  root: 196, scale: 'minor',           chords: [0, 3, 5, 4], lead: 'square',   bass: 'sine',     drums: true },
  { id: 'carnival-fun',     name: 'Carnival Fun',     bpm: 138, root: 262, scale: 'major',           chords: [0, 3, 4, 0], lead: 'triangle', bass: 'triangle', drums: true },
  { id: 'dungeon-crawl',    name: 'Dungeon Crawl',    bpm: 90,  root: 174, scale: 'minor',           chords: [0, 2, 3, 4], lead: 'sawtooth', bass: 'sine',     drums: false },
  { id: 'sunny-meadow',     name: 'Sunny Meadow',     bpm: 112, root: 294, scale: 'major',           chords: [0, 3, 4, 3], lead: 'triangle', bass: 'triangle', drums: false },
  { id: 'robot-factory',    name: 'Robot Factory',    bpm: 144, root: 220, scale: 'dorian',          chords: [0, 2, 4, 2], lead: 'square',   bass: 'square',   drums: true },
  { id: 'pixel-dreams',     name: 'Pixel Dreams',     bpm: 108, root: 349, scale: 'pentatonic',      chords: [0, 3, 4, 3], lead: 'square',   bass: 'sine',     drums: false },
  { id: 'disco-dash',       name: 'Disco Dash',       bpm: 124, root: 262, scale: 'major',           chords: [0, 5, 3, 4], lead: 'sawtooth', bass: 'square',   drums: true },
  { id: 'victory-march',    name: 'Victory March',    bpm: 132, root: 294, scale: 'major',           chords: [0, 3, 4, 0], lead: 'sawtooth', bass: 'triangle', drums: true },
];

export const TRACK_BY_ID = Object.fromEntries(MUSIC_TRACKS.map((t) => [t.id, t]));
export const DEFAULT_TRACK = 'chiptune-rush';

export function getTrackInfo(id) {
  return TRACK_BY_ID[id] || TRACK_BY_ID[DEFAULT_TRACK];
}

// ------------------------------------------------------------- scheduler
// A classic lookahead scheduler: setInterval "ticks" often and cheaply, and
// each tick schedules any notes that fall within the next LOOKAHEAD window
// using the AudioContext's own clock (ctx.currentTime), not the interval
// itself -- that's what keeps timing tight despite JS timer jitter.

function scheduleTick() {
  const ctx = getContext();
  if (!ctx || !track) return;
  const dest = ensureMaster(ctx);

  while (nextNoteTime < ctx.currentTime + LOOKAHEAD) {
    const scale = SCALES[track.scale];
    const chordIdx = track.chords[barCount % track.chords.length];
    const chordDegree = scale[chordIdx % scale.length];

    // Bass: root note on beats 0 and 2 of the bar (every 8th sixteenth-step).
    if (barBeat % 8 === 0) {
      const bassFreq = noteFreq(track.root, chordDegree) / 2;
      playNote(ctx, dest, bassFreq, nextNoteTime, secondsPerBeat * 1.8, { wave: track.bass, gain: 0.1, filter: 1200 });
    }
    // Lead: a simple arpeggio through the current chord, one note every
    // other sixteenth, with the occasional rest for a bit of breathing room.
    if (barBeat % 2 === 0 && Math.random() > 0.15) {
      const arpPattern = [0, 2, 4, 2];
      const arpDegree = scale[(chordIdx + arpPattern[(barBeat / 2) % 4]) % scale.length];
      const octaveUp = barBeat % 16 >= 8 ? 24 : 12;
      const leadFreq = noteFreq(track.root, arpDegree + octaveUp);
      playNote(ctx, dest, leadFreq, nextNoteTime, secondsPerBeat * 0.4, { wave: track.lead, gain: 0.065 });
    }
    // Light percussion for tracks that want it.
    if (track.drums) {
      if (barBeat % 8 === 0) playKick(ctx, dest, nextNoteTime);
      if (barBeat % 4 === 2) playHat(ctx, dest, nextNoteTime);
    }

    nextNoteTime += secondsPerBeat / 4; // one sixteenth note
    barBeat += 1;
    if (barBeat >= 16) { barBeat = 0; barCount += 1; }
  }
}

/** Start (or switch to) a looping track. No-op if WebAudio isn't available. */
export function play(trackId) {
  const ctx = getContext();
  if (!ctx) return;
  track = getTrackInfo(trackId);
  currentTrackId = track.id;
  secondsPerBeat = 60 / track.bpm;
  barBeat = 0;
  barCount = 0;
  nextNoteTime = ctx.currentTime + 0.05;
  if (!scheduler) scheduler = setInterval(scheduleTick, TICK_MS);
}

export function stop() {
  if (scheduler) { clearInterval(scheduler); scheduler = null; }
  track = null;
  currentTrackId = null;
}

export function currentTrack() {
  return currentTrackId;
}
