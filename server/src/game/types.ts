import type { Ack, ModeState, PlayerView, TeamStanding } from '@viktorina/shared';
import type { Game } from './Game';
import type { Player } from './Player';

export interface RoundEntry {
  player: Player;
  answered: boolean;
  fullyCorrect: boolean;
  /** Серия после этого ответа */
  streakAfter: number;
  elapsedMs: number | null;
}

export interface RoundOutcome {
  questionIndex: number;
  entries: RoundEntry[];
}

export interface ModeSummary {
  modeAward: { title: string; name: string; value: string } | null;
  modeResultLine: string | null;
}

/** Расширение движка под конкретный режим. Движок общий, режим — только визуализация и награды. */
export interface ModeHandler {
  /** Вызывается при старте игры (команды уже распределены) */
  init(): void;
  /** Игрок подключился после старта */
  onPlayerAdded(player: Player): void;
  onPlayerRemoved(player: Player): void;
  /** Смена фазы — например, «Побег» запускает и останавливает часы уровня */
  onPhase(phase: Game['phase']): void;
  /** Ответы раунда посчитаны (до показа правильного ответа) — например, выдать флаги */
  onRoundScored?(outcome: RoundOutcome): void;
  /**
   * После показа правильного ответа. Возвращает длительность игрового события (мс)
   * или null, если события нет и можно сразу показывать таблицу лидеров.
   */
  beginEvent(outcome: RoundOutcome): number | null;
  /** Событие закончилось (по таймеру или преподаватель нажал «Далее») */
  endEvent(): void;
  /** Режим может завершить игру раньше, чем кончатся вопросы */
  isOver(): boolean;
  state(): ModeState;
  playerExtras(player: Player): Partial<PlayerView>;
  teamStandings(): TeamStanding[];
  modeValue(player: Player): number;
  summary(): ModeSummary;
  place?(player: Player, cell: number): Ack;
  drop?(player: Player, rel: number): Ack<{ result: 'perfect' | 'ok' | 'fail' }>;
  /** Можно ли закончить событие раньше (например, все флаги расставлены) */
  canEndEventEarly?(): boolean;
  dispose(): void;
}
