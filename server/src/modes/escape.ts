import {
  PHASE_MS,
  type EscapeObstacle,
  type EscapeRunner,
  type EscapeState,
  type Phase,
  type PlayerView,
  type TeamStanding,
} from '@viktorina/shared';
import type { Game } from '../game/Game';
import type { Player } from '../game/Player';
import type { ModeHandler, ModeSummary, RoundOutcome } from '../game/types';

const ROBOT_START = -1.6;
/** Насколько робот подбирается при неверных ответах (за раунд, если ошиблись все) */
const WRONG_PUSH = 0.5;
const CLOCK_PHASES: Phase[] = ['question', 'answering'];

/**
 * «Побег». Три уровня. Верный ответ — шаг вперёд, препятствие на пути стоит лишнего хода.
 * Робот идёт по часам уровня (часы тикают, пока показан вопрос и идёт приём ответов).
 * Кого догнал — выбывает до конца уровня.
 */
export class EscapeMode implements ModeHandler {
  private level = 0;
  private levels = 3;
  private trackLength = 4;
  private obstacles: EscapeObstacle[] = [];
  private runners = new Map<string, EscapeRunner>();
  private levelResults: ('passed' | 'failed')[] = [];
  private requiredToPass = 1;
  private budget = 1;
  private usedInLevel = 0;
  private durationMs = 60_000;
  private elapsedMs = 0;
  private clockStartedAt: number | null = null;
  private robotSpeed = 0;
  private wrongPush = 0;
  private moveRev = 0;
  private banner: EscapeState['banner'] = null;
  private over = false;
  private pendingTimers: NodeJS.Timeout[] = [];
  private pendingNextLevel = false;
  private tick: NodeJS.Timeout;
  private steps = new Map<string, number>();
  private escapes = new Map<string, number>();

  constructor(private readonly game: Game) {
    this.tick = setInterval(() => this.onTick(), 200);
  }

  // ───────────── Уровни ─────────────

  init(): void {
    this.levels = Math.max(1, Math.min(3, this.game.questions.length));
    this.startLevel(1);
  }

  private startLevel(n: number): void {
    this.level = n;
    this.pendingNextLevel = false;
    const remainingQ = this.game.questions.length - (this.game.questionIndex + 1);
    const remainingLevels = this.levels - n + 1;
    this.budget = Math.max(1, Math.ceil(remainingQ / remainingLevels));
    this.trackLength = Math.max(2, Math.min(14, Math.round(this.budget * 0.5)));
    const obstacleCount = Math.min(this.trackLength - 1, Math.floor(this.budget / 6));
    const free = Array.from({ length: this.trackLength - 1 }, (_, i) => i + 1);
    this.obstacles = [];
    for (let k = 0; k < obstacleCount; k++) {
      const idx = Math.floor(Math.random() * free.length);
      const cell = free.splice(idx, 1)[0]!;
      this.obstacles.push({ cell, kind: Math.random() < 0.5 ? 'pit' : 'puddle' });
    }
    this.obstacles.sort((a, b) => a.cell - b.cell);

    const next = this.game.questions.slice(this.game.questionIndex + 1, this.game.questionIndex + 1 + this.budget);
    const avgLimit = next.length ? next.reduce((s, q) => s + q.timeLimit, 0) / next.length : 20;
    const estimated = this.budget * (avgLimit + 2) * 1000;
    this.durationMs = Math.round(Math.min(this.game.settings.levelMinutes * 60_000, estimated));
    this.elapsedMs = 0;
    this.clockStartedAt = null;
    this.wrongPush = 0;
    this.usedInLevel = 0;
    this.robotSpeed = (this.trackLength - ROBOT_START) / (this.durationMs / 1000);
    this.requiredToPass = Math.max(1, Math.ceil(this.game.players.size * 0.5));

    this.runners.clear();
    for (const p of this.game.players.values()) this.runners.set(p.id, this.newRunner(p, 0));
    this.moveRev++;
    this.banner = { kind: 'levelStart', title: `Уровень ${n} из ${this.levels}`, subtitle: `Добегите до двери: нужно ${this.requiredToPass} из ${this.game.players.size}` };
  }

  private newRunner(p: Player, pos: number): EscapeRunner {
    const team = p.teamId !== null ? this.game.teams[p.teamId] : null;
    return {
      playerId: p.id,
      name: p.name,
      avatar: p.avatar,
      color: team?.color ?? p.color,
      pos,
      status: 'running',
      detoured: [],
      lastMove: null,
    };
  }

  onPlayerAdded(p: Player): void {
    if (this.level === 0) return;
    const pos = Math.max(0, Math.min(this.trackLength - 1, Math.floor(this.robotPos()) + 1));
    this.runners.set(p.id, this.newRunner(p, pos));
  }

  onPlayerRemoved(p: Player): void {
    this.runners.delete(p.id);
  }

  // ───────────── Часы и робот ─────────────

  private currentElapsed(): number {
    return this.elapsedMs + (this.clockStartedAt !== null ? Date.now() - this.clockStartedAt : 0);
  }

  private robotPos(): number {
    const raw = ROBOT_START + this.robotSpeed * (this.currentElapsed() / 1000) + this.wrongPush;
    return Math.min(this.trackLength, raw);
  }

  onPhase(phase: Phase): void {
    const shouldRun = CLOCK_PHASES.includes(phase) && !this.over && this.level > 0;
    if (shouldRun && this.clockStartedAt === null) this.clockStartedAt = Date.now();
    if (!shouldRun && this.clockStartedAt !== null) {
      this.elapsedMs += Date.now() - this.clockStartedAt;
      this.clockStartedAt = null;
    }
    if (phase === 'question') this.banner = null;
  }

  private onTick(): void {
    if (this.clockStartedAt === null) return;
    if (this.catchRunners()) this.game.sendHost();
  }

  /** Отмечает пойманных; возвращает true, если кто-то выбыл */
  private catchRunners(): boolean {
    const robot = this.robotPos();
    const timeUp = this.currentElapsed() >= this.durationMs;
    let changed = false;
    for (const r of this.runners.values()) {
      if (r.status !== 'running') continue;
      if (timeUp || r.pos <= robot) {
        r.status = 'caught';
        changed = true;
        this.game.io.to(this.game.hostRoom).emit('escape:caught', { playerId: r.playerId });
        const p = this.game.players.get(r.playerId);
        if (p) this.game.sendPlayer(p);
      }
    }
    return changed;
  }

  // ───────────── Раунд ─────────────

  beginEvent(outcome: RoundOutcome): number | null {
    if (this.over) return null;
    this.usedInLevel++;
    let running = 0;
    let wrong = 0;
    for (const e of outcome.entries) {
      const r = this.runners.get(e.player.id);
      if (!r || r.status !== 'running') continue;
      running++;
      if (!e.fullyCorrect) {
        wrong++;
        r.lastMove = 'stand';
        continue;
      }
      const next = r.pos + 1;
      const obstacle = this.obstacles.find((o) => o.cell === next);
      if (obstacle && !r.detoured.includes(next)) {
        // Обход препятствия стоит одного хода
        r.detoured.push(next);
        r.lastMove = 'detour';
      } else {
        r.pos = next;
        r.lastMove = 'step';
        this.steps.set(r.playerId, (this.steps.get(r.playerId) ?? 0) + 1);
        if (r.pos >= this.trackLength) {
          r.status = 'escaped';
          this.escapes.set(r.playerId, (this.escapes.get(r.playerId) ?? 0) + 1);
        }
      }
    }
    if (running > 0) this.wrongPush += WRONG_PUSH * (wrong / running);
    this.moveRev++;
    this.catchRunners();

    const all = [...this.runners.values()];
    const escaped = all.filter((r) => r.status === 'escaped').length;
    const stillRunning = all.filter((r) => r.status === 'running').length;
    const questionsLeft = this.game.questionIndex + 1 < this.game.questions.length;
    const timeUp = this.currentElapsed() >= this.durationMs;
    const resolved =
      escaped >= this.requiredToPass || stillRunning === 0 || this.usedInLevel >= this.budget || timeUp || !questionsLeft;
    if (!resolved) return PHASE_MS.escapeEvent;

    const passed = escaped >= this.requiredToPass;
    // Кто не успел — робот настигает в конце уровня
    for (const r of all) if (r.status === 'running' && !passed) r.status = 'caught';
    this.levelResults.push(passed ? 'passed' : 'failed');
    const lastLevel = this.level >= this.levels || !questionsLeft;
    let duration = PHASE_MS.escapeEvent + PHASE_MS.escapeLevelEnd;

    this.later(PHASE_MS.escapeEvent, () => {
      this.banner = {
        kind: passed ? 'levelPassed' : 'levelFailed',
        title: passed ? 'Уровень пройден!' : 'Робот победил…',
        subtitle: `До двери добежали ${escaped} из ${all.length}`,
      };
      this.game.broadcast();
    });

    if (lastLevel) {
      this.over = true;
      const passedCount = this.levelResults.filter((x) => x === 'passed').length;
      this.later(PHASE_MS.escapeEvent + PHASE_MS.escapeLevelEnd - 600, () => {
        this.banner = { kind: 'gameOver', title: 'Побег окончен', subtitle: `Пройдено уровней: ${passedCount} из ${this.levels}` };
        this.game.broadcast();
      });
    } else {
      this.pendingNextLevel = true;
      duration += PHASE_MS.escapeTransition;
      this.later(PHASE_MS.escapeEvent + PHASE_MS.escapeLevelEnd, () => {
        this.startLevel(this.level + 1);
        this.game.broadcast();
      });
    }
    return duration;
  }

  private later(ms: number, fn: () => void): void {
    this.pendingTimers.push(setTimeout(fn, ms));
  }

  endEvent(): void {
    for (const t of this.pendingTimers) clearTimeout(t);
    this.pendingTimers = [];
    // Преподаватель пропустил анимацию — переход на следующий уровень всё равно должен случиться
    if (this.pendingNextLevel) this.startLevel(this.level + 1);
    for (const r of this.runners.values()) r.lastMove = null;
  }

  isOver(): boolean {
    return this.over;
  }

  // ───────────── Представления ─────────────

  state(): EscapeState {
    const elapsed = this.currentElapsed();
    return {
      kind: 'escape',
      level: this.level,
      levels: this.levels,
      trackLength: this.trackLength,
      obstacles: this.obstacles,
      robotPos: this.robotPos(),
      robotSpeed: this.robotSpeed,
      clockRunning: this.clockStartedAt !== null,
      levelRemainingMs: Math.max(0, this.durationMs - elapsed),
      levelDurationMs: this.durationMs,
      runners: [...this.runners.values()].map((r) => ({ ...r, detoured: [...r.detoured] })),
      requiredToPass: this.requiredToPass,
      levelResults: this.levelResults,
      moveRev: this.moveRev,
      banner: this.banner,
    };
  }

  playerExtras(p: Player): Partial<PlayerView> {
    const r = this.runners.get(p.id);
    return {
      escape: {
        level: this.level,
        levels: this.levels,
        pos: r?.pos ?? 0,
        trackLength: this.trackLength,
        status: r?.status ?? 'running',
      },
    };
  }

  teamStandings(): TeamStanding[] {
    return this.game.teams
      .map((t) => {
        const members = [...this.game.players.values()].filter((p) => p.teamId === t.id);
        return {
          teamId: t.id,
          name: t.name,
          color: t.color,
          emblem: t.emblem,
          value: members.reduce((s, p) => s + (this.escapes.get(p.id) ?? 0), 0),
          valueLabel: 'побегов',
          members: members.length,
        };
      })
      .sort((a, b) => b.value - a.value);
  }

  modeValue(p: Player): number {
    return this.escapes.get(p.id) ?? 0;
  }

  summary(): ModeSummary {
    const best = [...this.game.players.values()].sort((a, b) => (this.steps.get(b.id) ?? 0) - (this.steps.get(a.id) ?? 0))[0];
    const n = best ? (this.steps.get(best.id) ?? 0) : 0;
    const passed = this.levelResults.filter((x) => x === 'passed').length;
    return {
      modeAward: best && n > 0 ? { title: 'Самый быстрый беглец', name: best.name, value: `${n} шаг.` } : null,
      modeResultLine: `Пройдено уровней: ${passed} из ${this.levels}`,
    };
  }

  dispose(): void {
    clearInterval(this.tick);
    for (const t of this.pendingTimers) clearTimeout(t);
  }
}
