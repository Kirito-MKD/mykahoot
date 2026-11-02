import { z } from 'zod';
import { MODES } from './modes';

export const gameSettingsSchema = z.object({
  mode: z.enum(MODES),
  teamMode: z.boolean(),
  teamCount: z.number().int().min(2).max(4),
  teamNames: z.array(z.string().trim().min(1).max(30)).max(4),
  /** Переопределить время на все вопросы (секунды) или null — как в тесте */
  timeLimitOverride: z.number().int().min(5).max(240).nullable(),
  shuffleQuestions: z.boolean(),
  /** «Башня»: монстр приходит каждый N-й раунд */
  monsterEvery: z.number().int().min(2).max(20),
  /** «Побег»: минут на уровень */
  levelMinutes: z.number().min(1).max(15),
  /** «Захват территории»: секунд на расстановку флагов */
  placementSeconds: z.number().int().min(5).max(60),
  /** Автоплей: после показа ответа и таблицы лидеров игра идёт дальше сама */
  autoplay: z.boolean().default(false),
  /** Показывать экран с правилами режима перед первым вопросом */
  showRules: z.boolean().default(true),
});
export type GameSettings = z.infer<typeof gameSettingsSchema>;

export const DEFAULT_SETTINGS: GameSettings = {
  mode: 'classic',
  teamMode: false,
  teamCount: 2,
  teamNames: [],
  timeLimitOverride: null,
  shuffleQuestions: false,
  monsterEvery: 5,
  levelMinutes: 5,
  placementSeconds: 15,
  autoplay: false,
  showRules: true,
};

/** Длительности фаз (мс) */
export const PHASE_MS = {
  intro: 4000,
  rules: 16000,
  /** Автоплей: сколько показывать правильный ответ и таблицу лидеров */
  autoReveal: 6000,
  autoLeaderboard: 6000,
  /** «Башня»: сколько ждать, пока дети поставят блоки */
  towerDrop: 12000,
  towerSettle: 2200,
  question: 2000,
  towerEvent: 4200,
  towerMonsterEvent: 7600,
  escapeEvent: 3800,
  escapeLevelEnd: 4200,
  escapeTransition: 3200,
  hostGrace: 60_000,
} as const;

export const REACTIONS = ['👏', '😂', '😮', '😢', '🔥', '❤️'] as const;
export type ReactionEmoji = (typeof REACTIONS)[number];
export const REACTION_COOLDOWN_MS = 2000;

export const NAME_MAX = 20;

/** Эмоции персонажа на пьедестале */
export const EMOTES = ['dance', 'jump', 'spin', 'wave', 'flex', 'floss'] as const;
export type EmoteId = (typeof EMOTES)[number];
export const EMOTE_INFO: Record<EmoteId, { label: string; icon: string }> = {
  dance: { label: 'Танец', icon: '💃' },
  jump: { label: 'Прыжки', icon: '🦘' },
  spin: { label: 'Вертушка', icon: '🌀' },
  wave: { label: 'Привет', icon: '👋' },
  flex: { label: 'Сила', icon: '💪' },
  floss: { label: 'Флосс', icon: '🕺' },
};
export const EMOTE_COOLDOWN_MS = 1200;

/** «Башня»: если блок сдвинут больше чем на эту долю ширины — он падает */
export const TOWER_FALL_RATIO = 0.55;
/** Меньше этой доли — «Идеально!», блок ставится ровно */
export const TOWER_PERFECT_RATIO = 0.08;
/** Ширина блока в единицах сцены */
export const TOWER_BLOCK_W = 128;
/** «Захват территории»: сколько флагов стоит чужая башня-база */
export const BASE_CAPTURE_COST = 3;
/** «Захват территории»: башня-база в подсчёте стоит столько гексов */
export const BASE_VALUE = 3;
