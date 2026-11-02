import { randomBytes, randomUUID } from 'node:crypto';
import type { Avatar, PlayerPublic } from '@viktorina/shared';

export interface PlayerAnswer {
  choices: number[];
  elapsedMs: number;
  fullyCorrect: boolean;
  fraction: number;
  points: number;
}

export class Player {
  readonly id = randomBytes(5).toString('hex');
  readonly token = randomUUID();
  readonly joinedAt = Date.now();
  teamId: number | null = null;
  color = '#888888';
  score = 0;
  streak = 0;
  bestStreak = 0;
  correctCount = 0;
  wrongCount = 0;
  unansweredCount = 0;
  socketId: string | null = null;
  lastSeen = Date.now();
  lastReactionAt = 0;
  lastEmoteAt = 0;
  /** «Башня»: результат последней постановки блока */
  lastDrop: 'perfect' | 'ok' | 'fail' | null = null;
  /** Ответы по номеру вопроса */
  answers = new Map<number, PlayerAnswer>();
  lastPoints = 0;
  lastFlagsEarned = 0;
  /** Флаги «Захвата территории» */
  flags = 0;

  constructor(
    public name: string,
    public avatar: Avatar,
  ) {}

  get connected(): boolean {
    return this.socketId !== null;
  }

  public(answeredQuestion: number | null): PlayerPublic {
    return {
      id: this.id,
      name: this.name,
      avatar: this.avatar,
      teamId: this.teamId,
      color: this.color,
      score: this.score,
      connected: this.connected,
      streak: this.streak,
      correctCount: this.correctCount,
      answered: answeredQuestion !== null && this.answers.has(answeredQuestion),
    };
  }
}
