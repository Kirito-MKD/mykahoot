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
};

/** Длительности фаз (мс) */
export const PHASE_MS = {
  intro: 4000,
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
