export const BASE_POINTS = 1000;

/** Множитель серии: 1-й верный подряд ×1, 2-й ×1.1, 3-й ×1.2, 4-й и дальше ×1.3 */
export function streakMultiplier(streak: number): number {
  if (streak >= 4) return 1.3;
  if (streak === 3) return 1.2;
  if (streak === 2) return 1.1;
  return 1;
}

/** Базовые очки за скорость: 1000 × (1 − t / limit / 2) */
export function speedPoints(elapsedMs: number, limitMs: number): number {
  const ratio = Math.min(1, Math.max(0, elapsedMs / limitMs));
  return BASE_POINTS * (1 - ratio / 2);
}

export type QuestionKind = 'quiz' | 'trueFalse' | 'multiple';

export interface AnswerEvaluation {
  /** Полностью верный ответ (для серий, флагов, блоков и шагов) */
  fullyCorrect: boolean;
  /** Доля зачтённых очков 0..1 (для multiple может быть частичной) */
  fraction: number;
}

/**
 * Проверка ответа.
 * multiple: очки × доля_верных − штраф_за_лишние, где штраф за каждый лишний
 * выбор равен «весу» одного верного варианта. Не меньше нуля.
 */
export function evaluateAnswer(kind: QuestionKind, correct: number[], chosen: number[]): AnswerEvaluation {
  const correctSet = new Set(correct);
  const chosenSet = new Set(chosen);
  if (kind !== 'multiple') {
    const ok = chosenSet.size === 1 && correctSet.has([...chosenSet][0]!);
    return { fullyCorrect: ok, fraction: ok ? 1 : 0 };
  }
  let hits = 0;
  let extras = 0;
  for (const c of chosenSet) {
    if (correctSet.has(c)) hits++;
    else extras++;
  }
  const total = correctSet.size || 1;
  const fraction = Math.max(0, hits / total - extras / total);
  return { fullyCorrect: hits === total && extras === 0, fraction };
}

/**
 * Итоговые очки за ответ.
 * streakAfter — длина серии с учётом этого ответа (если он полностью верный).
 */
export function computePoints(opts: {
  elapsedMs: number;
  limitMs: number;
  fraction: number;
  fullyCorrect: boolean;
  streakAfter: number;
  questionMultiplier?: number;
}): number {
  if (opts.fraction <= 0) return 0;
  const mult = opts.fullyCorrect ? streakMultiplier(opts.streakAfter) : 1;
  const q = opts.questionMultiplier ?? 1;
  return Math.floor(speedPoints(opts.elapsedMs, opts.limitMs) * opts.fraction * mult * q);
}
