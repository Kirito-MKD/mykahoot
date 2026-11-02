import type { GameListing, GameResults, GameSettings, StoredQuiz } from '@viktorina/shared';
import { saveGameResults } from '../db';
import { Game, type IO } from './Game';

/**
 * Трёхзначный код от 100 до 999, уникальный среди активных игр.
 * Если все 900 заняты — переходим на четырёхзначные.
 */
export function generateCode(taken: Set<string>, rnd: () => number = Math.random): string {
  for (const [min, max] of [
    [100, 999],
    [1000, 9999],
  ] as const) {
    const span = max - min + 1;
    if ([...taken].filter((c) => c.length === String(min).length).length >= span) continue;
    for (let attempt = 0; attempt < 50; attempt++) {
      const code = String(min + Math.floor(rnd() * span));
      if (!taken.has(code)) return code;
    }
    for (let n = min; n <= max; n++) if (!taken.has(String(n))) return String(n);
  }
  throw new Error('Нет свободных кодов игры');
}

export class GameManager {
  readonly games = new Map<string, Game>();
  private listTimer: NodeJS.Timeout | null = null;

  constructor(private readonly io: IO) {
    // Брошенные завершённые игры убираем через 3 часа
    setInterval(() => {
      const now = Date.now();
      for (const g of this.games.values()) {
        if (g.phase === 'finished' && now - g.finishedAt > 3 * 3600_000) g.close('Игра закрыта.');
        if (g.phase === 'lobby' && !g.hostConnected && now - g.createdAt > 3 * 3600_000) g.close('Игра закрыта.');
      }
    }, 10 * 60_000).unref();
  }

  create(quiz: StoredQuiz, settings: GameSettings): Game {
    const taken = new Set([...this.games.values()].map((g) => g.code));
    const code = generateCode(taken);
    const game = new Game(this.io, code, quiz, settings, {
      listChanged: () => this.scheduleList(),
      finished: (g: Game, r: GameResults) => this.onFinished(g, r),
      closed: (g: Game) => {
        this.games.delete(g.id);
        this.scheduleList();
      },
    });
    this.games.set(game.id, game);
    this.scheduleList();
    return game;
  }

  private onFinished(game: Game, results: GameResults): void {
    if (results.players.length === 0 || results.questions.length === 0) return;
    try {
      saveGameResults(game.quiz.id, results);
    } catch (err) {
      console.error('Не удалось сохранить результаты игры:', err);
    }
  }

  byCode(code: string): Game | null {
    const c = code.trim();
    for (const g of this.games.values()) if (g.code === c) return g;
    return null;
  }

  byHostToken(token: string): Game | null {
    for (const g of this.games.values()) if (g.hostToken === token) return g;
    return null;
  }

  findPlayer(token: string) {
    for (const g of this.games.values()) {
      const p = g.findByToken(token);
      if (p) return { game: g, player: p };
    }
    return null;
  }

  /** Игры, к которым можно присоединиться: в лобби или уже идущие (для опоздавших) */
  listings(): GameListing[] {
    return [...this.games.values()]
      .filter((g) => g.phase !== 'finished')
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((g) => ({
        id: g.id,
        code: g.code,
        title: g.quiz.title,
        phase: g.phase,
        playersCount: g.players.size,
        mode: g.settings.mode,
      }));
  }

  private scheduleList(): void {
    if (this.listTimer) return;
    this.listTimer = setTimeout(() => {
      this.listTimer = null;
      this.io.to('watchers').emit('games:list', this.listings());
    }, 150);
  }
}
