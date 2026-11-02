/**
 * Звуки синтезируются Web Audio API прямо в браузере — никаких файлов с неясной лицензией.
 * Это собственная работа проекта (CC0), см. АССЕТЫ.md.
 */
import { load, save, KEYS } from './storage';

type Listener = (muted: boolean) => void;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = load<boolean>(KEYS.muted, false);
const listeners = new Set<Listener>();

function audio(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Браузеры запускают звук только после действия пользователя — «будим» контекст по первому клику */
export function unlockAudio(): void {
  audio();
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(v: boolean): void {
  muted = v;
  save(KEYS.muted, v);
  if (v && ctx) void ctx.suspend();
  if (!v) audio();
  listeners.forEach((l) => l(v));
}

export function onMutedChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

interface ToneOpts {
  freq: number;
  to?: number;
  type?: OscillatorType;
  start?: number;
  dur: number;
  gain?: number;
  attack?: number;
  filter?: number;
}

function tone(c: AudioContext, o: ToneOpts): void {
  const t0 = c.currentTime + (o.start ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);
  const peak = o.gain ?? 0.3;
  const attack = o.attack ?? 0.008;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  let node: AudioNode = osc;
  if (o.filter) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.filter;
    osc.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(master!);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.05);
}

function noise(c: AudioContext, start: number, dur: number, gain: number, filterFreq: number): void {
  const t0 = c.currentTime + start;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filterFreq;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f);
  f.connect(g);
  g.connect(master!);
  src.start(t0);
}

export const sfx = {
  /** Тиканье на последних 5 секундах */
  tick(high = false) {
    const c = audio();
    if (!c) return;
    tone(c, { freq: high ? 1560 : 1180, type: 'square', dur: 0.05, gain: 0.12, filter: 3200 });
    tone(c, { freq: high ? 780 : 590, type: 'triangle', dur: 0.08, gain: 0.12 });
  },
  correct() {
    const c = audio();
    if (!c) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, { freq: f, type: 'triangle', start: i * 0.07, dur: 0.35, gain: 0.22 }));
  },
  wrong() {
    const c = audio();
    if (!c) return;
    tone(c, { freq: 311, to: 196, type: 'sawtooth', dur: 0.32, gain: 0.16, filter: 900 });
    tone(c, { freq: 233, to: 147, type: 'sawtooth', start: 0.18, dur: 0.42, gain: 0.16, filter: 800 });
  },
  /** Фанфары на пьедестале */
  fanfare() {
    const c = audio();
    if (!c) return;
    const notes: [number, number, number][] = [
      [392, 0, 0.18],
      [523.25, 0.18, 0.18],
      [659.25, 0.36, 0.18],
      [783.99, 0.54, 0.5],
      [659.25, 1.04, 0.16],
      [783.99, 1.2, 0.9],
    ];
    for (const [f, st, d] of notes) {
      tone(c, { freq: f, type: 'sawtooth', start: st, dur: d + 0.15, gain: 0.13, filter: 2400, attack: 0.02 });
      tone(c, { freq: f / 2, type: 'triangle', start: st, dur: d + 0.15, gain: 0.12 });
    }
    noise(c, 1.2, 0.8, 0.05, 6000);
  },
  /** Новый игрок в лобби */
  pop() {
    const c = audio();
    if (!c) return;
    tone(c, { freq: 620, to: 1240, type: 'sine', dur: 0.12, gain: 0.2 });
  },
  /** Блок приземлился */
  thud() {
    const c = audio();
    if (!c) return;
    tone(c, { freq: 140, to: 60, type: 'sine', dur: 0.22, gain: 0.35 });
    noise(c, 0, 0.12, 0.12, 900);
  },
  /** Монстр */
  roar() {
    const c = audio();
    if (!c) return;
    tone(c, { freq: 110, to: 70, type: 'sawtooth', dur: 0.9, gain: 0.22, filter: 500, attack: 0.08 });
    tone(c, { freq: 116, to: 74, type: 'sawtooth', dur: 0.9, gain: 0.16, filter: 420, attack: 0.08 });
    noise(c, 0.05, 0.9, 0.18, 700);
  },
  crash() {
    const c = audio();
    if (!c) return;
    noise(c, 0, 0.6, 0.3, 2500);
    tone(c, { freq: 90, to: 40, type: 'sine', dur: 0.5, gain: 0.4 });
  },
  flag() {
    const c = audio();
    if (!c) return;
    tone(c, { freq: 880, to: 1320, type: 'triangle', dur: 0.1, gain: 0.16 });
  },
  /** Робот поймал игрока */
  zap() {
    const c = audio();
    if (!c) return;
    tone(c, { freq: 1800, to: 200, type: 'sawtooth', dur: 0.25, gain: 0.12, filter: 4000 });
    noise(c, 0, 0.2, 0.1, 5000);
  },
  whoosh() {
    const c = audio();
    if (!c) return;
    noise(c, 0, 0.5, 0.14, 1800);
  },
};
