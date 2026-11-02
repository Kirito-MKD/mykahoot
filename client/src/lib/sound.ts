/**
 * Звуки и фоновая музыка синтезируются Web Audio API прямо в браузере — никаких файлов
 * с неясной лицензией. Это собственная работа проекта (CC0), см. АССЕТЫ.md.
 */
import { load, save, KEYS } from './storage';

type Listener = () => void;

let ctx: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let muted = load<boolean>(KEYS.muted, false);
let musicOn = load<boolean>(KEYS.music, true);
const listeners = new Set<Listener>();

function context(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.55;
      sfxBus.connect(comp);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.16;
      musicBus.connect(comp);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function sfxCtx(): AudioContext | null {
  if (muted) return null;
  return context();
}

/** Браузеры запускают звук только после действия пользователя — «будим» контекст по клику */
export function unlockAudio(): void {
  if (!muted || musicOn) context();
}

export function isMuted(): boolean {
  return muted;
}
export function setMuted(v: boolean): void {
  muted = v;
  save(KEYS.muted, v);
  listeners.forEach((l) => l());
}
export function isMusicOn(): boolean {
  return musicOn;
}
export function setMusicOn(v: boolean): void {
  musicOn = v;
  save(KEYS.music, v);
  if (!v) music.stop();
  listeners.forEach((l) => l());
}
export function onSoundSettingsChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

interface ToneOpts {
  freq: number;
  to?: number;
  type?: OscillatorType;
  start?: number;
  at?: number;
  dur: number;
  gain?: number;
  attack?: number;
  filter?: number;
  bus?: GainNode | null;
}

function tone(c: AudioContext, o: ToneOpts): void {
  const t0 = o.at ?? c.currentTime + (o.start ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur);
  const peak = o.gain ?? 0.3;
  const attack = o.attack ?? 0.006;
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
  g.connect(o.bus ?? sfxBus!);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.05);
}

let noiseBuf: AudioBuffer | null = null;
function noiseBuffer(c: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function noise(
  c: AudioContext,
  o: { start?: number; at?: number; dur: number; gain: number; type?: BiquadFilterType; freq: number; bus?: GainNode | null },
): void {
  const t0 = o.at ?? c.currentTime + (o.start ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const f = c.createBiquadFilter();
  f.type = o.type ?? 'lowpass';
  f.frequency.value = o.freq;
  const g = c.createGain();
  g.gain.setValueAtTime(o.gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  src.connect(f);
  f.connect(g);
  g.connect(o.bus ?? sfxBus!);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + o.dur + 0.05);
}

export const sfx = {
  /** Мягкий щелчок любой кнопки */
  click() {
    const c = sfxCtx();
    if (!c) return;
    tone(c, { freq: 900, to: 620, type: 'triangle', dur: 0.06, gain: 0.12 });
    noise(c, { dur: 0.03, gain: 0.05, type: 'highpass', freq: 4000 });
  },
  /** Тиканье на последних 5 секундах */
  tick(high = false) {
    const c = sfxCtx();
    if (!c) return;
    tone(c, { freq: high ? 1560 : 1180, type: 'square', dur: 0.05, gain: 0.12, filter: 3200 });
    tone(c, { freq: high ? 780 : 590, type: 'triangle', dur: 0.08, gain: 0.12 });
  },
  correct() {
    const c = sfxCtx();
    if (!c) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, { freq: f, type: 'triangle', start: i * 0.07, dur: 0.35, gain: 0.22 }));
  },
  wrong() {
    const c = sfxCtx();
    if (!c) return;
    tone(c, { freq: 311, to: 196, type: 'sawtooth', dur: 0.32, gain: 0.16, filter: 900 });
    tone(c, { freq: 233, to: 147, type: 'sawtooth', start: 0.18, dur: 0.42, gain: 0.16, filter: 800 });
  },
  /** Отправка реакции — «пуньк» вверх */
  send() {
    const c = sfxCtx();
    if (!c) return;
    tone(c, { freq: 520, to: 1400, type: 'sine', dur: 0.14, gain: 0.2 });
    tone(c, { freq: 1400, to: 1900, type: 'triangle', start: 0.08, dur: 0.1, gain: 0.1 });
  },
  /** Реакция пришла на экран преподавателя */
  bubble() {
    const c = sfxCtx();
    if (!c) return;
    tone(c, { freq: 700 + Math.random() * 300, to: 1300, type: 'sine', dur: 0.09, gain: 0.08 });
  },
  /** Фанфары на пьедестале */
  fanfare() {
    const c = sfxCtx();
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
    noise(c, { start: 1.2, dur: 0.8, gain: 0.05, freq: 6000 });
  },
  /** Победа у ученика: короткий радостный перезвон */
  victory() {
    const c = sfxCtx();
    if (!c) return;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      tone(c, { freq: f, type: 'triangle', start: i * 0.09, dur: 0.5, gain: 0.18 });
      tone(c, { freq: f * 2, type: 'sine', start: i * 0.09, dur: 0.3, gain: 0.05 });
    });
    noise(c, { start: 0.45, dur: 0.6, gain: 0.06, type: 'highpass', freq: 5000 });
  },
  pop() {
    const c = sfxCtx();
    if (!c) return;
    tone(c, { freq: 620, to: 1240, type: 'sine', dur: 0.12, gain: 0.2 });
  },
  thud() {
    const c = sfxCtx();
    if (!c) return;
    tone(c, { freq: 140, to: 60, type: 'sine', dur: 0.22, gain: 0.35 });
    noise(c, { dur: 0.12, gain: 0.12, freq: 900 });
  },
  /** Блок поставлен идеально */
  perfect() {
    const c = sfxCtx();
    if (!c) return;
    tone(c, { freq: 988, type: 'triangle', dur: 0.12, gain: 0.18 });
    tone(c, { freq: 1480, type: 'triangle', start: 0.08, dur: 0.25, gain: 0.18 });
  },
  /** Блок сорвался */
  fall() {
    const c = sfxCtx();
    if (!c) return;
    tone(c, { freq: 600, to: 120, type: 'square', dur: 0.5, gain: 0.08, filter: 1600 });
  },
  roar() {
    const c = sfxCtx();
    if (!c) return;
    tone(c, { freq: 110, to: 70, type: 'sawtooth', dur: 0.9, gain: 0.22, filter: 500, attack: 0.08 });
    tone(c, { freq: 116, to: 74, type: 'sawtooth', dur: 0.9, gain: 0.16, filter: 420, attack: 0.08 });
    noise(c, { start: 0.05, dur: 0.9, gain: 0.18, freq: 700 });
  },
  crash() {
    const c = sfxCtx();
    if (!c) return;
    noise(c, { dur: 0.6, gain: 0.3, freq: 2500 });
    tone(c, { freq: 90, to: 40, type: 'sine', dur: 0.5, gain: 0.4 });
  },
  flag() {
    const c = sfxCtx();
    if (!c) return;
    tone(c, { freq: 880, to: 1320, type: 'triangle', dur: 0.1, gain: 0.16 });
  },
  zap() {
    const c = sfxCtx();
    if (!c) return;
    tone(c, { freq: 1800, to: 200, type: 'sawtooth', dur: 0.25, gain: 0.12, filter: 4000 });
    noise(c, { dur: 0.2, gain: 0.1, freq: 5000 });
  },
  whoosh() {
    const c = sfxCtx();
    if (!c) return;
    noise(c, { dur: 0.5, gain: 0.14, freq: 1800 });
  },
};

// ───────────────────────── Фоновая музыка ─────────────────────────

/** Настроение трека: спокойный грув в лобби, драйв во время вопроса */
export type MusicMood = 'groove' | 'drive' | 'quiet';
const MOOD_VOLUME: Record<MusicMood, number> = { groove: 0.15, drive: 0.17, quiet: 0.06 };

const BPM = 126;
const STEP = 60 / BPM / 4; // шестнадцатая
// Am – F – C – G: энергичная поп-последовательность
const CHORDS: number[][] = [
  [57, 60, 64],
  [53, 57, 60],
  [48, 52, 55],
  [55, 59, 62],
];
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class MusicEngine {
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private mood: MusicMood = 'groove';
  private playing = false;

  setMood(m: MusicMood): void {
    this.mood = m;
    // Учитель объясняет ответ — музыка уходит на фон, потом возвращается
    if (this.playing && ctx && musicBus) {
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.setValueAtTime(Math.max(0.0001, musicBus.gain.value), ctx.currentTime);
      musicBus.gain.exponentialRampToValueAtTime(MOOD_VOLUME[m], ctx.currentTime + 0.6);
    }
  }

  start(mood: MusicMood = this.mood): void {
    this.mood = mood;
    if (!musicOn || this.playing) return;
    const c = context();
    if (!c) return;
    this.playing = true;
    this.nextTime = c.currentTime + 0.08;
    this.step = 0;
    musicBus!.gain.cancelScheduledValues(c.currentTime);
    musicBus!.gain.setValueAtTime(0.0001, c.currentTime);
    musicBus!.gain.exponentialRampToValueAtTime(MOOD_VOLUME[this.mood], c.currentTime + 1.2);
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop(): void {
    if (!this.playing) return;
    this.playing = false;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    if (ctx && musicBus) {
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime);
      musicBus.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    }
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  private schedule(): void {
    const c = ctx;
    if (!c || !musicBus) return;
    while (this.nextTime < c.currentTime + 0.15) {
      this.playStep(c, this.step, this.nextTime);
      this.nextTime += STEP;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(c: AudioContext, step: number, t: number): void {
    const bus = musicBus;
    const s = step % 16;
    const chord = CHORDS[Math.floor(step / 16)]!;
    const drive = this.mood === 'drive';
    // Бочка — каждая четверть
    if (s % 4 === 0) {
      tone(c, { at: t, freq: 150, to: 42, type: 'sine', dur: 0.24, gain: 0.9, bus });
    }
    // Малый барабан — на 2 и 4
    if (s === 4 || s === 12) {
      noise(c, { at: t, dur: 0.16, gain: 0.35, type: 'bandpass', freq: 1800, bus });
      tone(c, { at: t, freq: 220, to: 160, type: 'triangle', dur: 0.1, gain: 0.25, bus });
    }
    // Хэты: восьмые, в драйве — шестнадцатые
    if (drive ? true : s % 2 === 0) {
      noise(c, { at: t, dur: s % 4 === 2 ? 0.07 : 0.035, gain: s % 4 === 2 ? 0.16 : 0.09, type: 'highpass', freq: 7000, bus });
    }
    // Бас — восьмые с октавным прыжком
    if (s % 2 === 0) {
      const root = chord[0]! - 24;
      const n = s % 4 === 2 ? root + 12 : root;
      tone(c, { at: t, freq: midi(n), type: 'sawtooth', dur: STEP * 1.8, gain: 0.32, filter: drive ? 900 : 650, bus });
    }
    // Арпеджио аккорда
    const arpEvery = drive ? 1 : 2;
    if (s % arpEvery === 0) {
      const idx = (s / arpEvery) % 4;
      const note = idx === 3 ? chord[1]! + 12 : chord[idx]! + 12;
      tone(c, { at: t, freq: midi(note), type: 'square', dur: STEP * 0.9, gain: 0.07, filter: 3000, bus });
    }
    // Короткий «стаб» аккорда в начале такта
    if (s === 0) {
      for (const n of chord) tone(c, { at: t, freq: midi(n), type: 'sawtooth', dur: STEP * 3, gain: 0.05, filter: 1800, bus });
    }
  }
}

export const music = new MusicEngine();
