import { randomBytes, randomUUID } from 'node:crypto';
import type { Server } from 'socket.io';
import {
  PHASE_MS,
  REACTION_COOLDOWN_MS,
  REACTIONS,
  TEAM_PRESETS,
  EMOTE_COOLDOWN_MS,
  type EmoteId,
  computePoints,
  evaluateAnswer,
  soloColor,
  type Ack,
  type Avatar,
  type ClientToServerEvents,
  type GameResults,
  type GameSettings,
  type HostView,
  type LeaderRow,
  type Phase,
  type PlayerResult,
  type PlayerView,
  type PublicQuestion,
  type QuestionResult,
  type QuizQuestion,
  type ReactionEmoji,
  type RevealInfo,
  type ServerToClientEvents,
  type StoredQuiz,
  type TeamInfo,
  type TeamStanding,
} from '@viktorina/shared';
import { Player } from './Player';
import type { ModeHandler, RoundEntry, RoundOutcome } from './types';
import { createMode } from '../modes';

export type IO = Server<ClientToServerEvents, ServerToClientEvents>;

export interface GameCallbacks {
  listChanged: () => void;
  finished: (game: Game, results: GameResults) => void;
  closed: (game: Game) => void;
}

interface QuestionStat {
  correct: number;
  wrong: number;
  unanswered: number;
  times: number[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export class Game {
  readonly id = randomBytes(6).toString('hex');
  readonly hostToken = randomUUID();
  readonly createdAt = Date.now();
  readonly questions: QuizQuestion[];
  readonly teams: TeamInfo[] = [];
  readonly players = new Map<string, Player>();
  /** Игроки, удалённые преподавателем: их токены больше не принимаются */
  readonly kickedTokens = new Set<string>();

  phase: Phase = 'lobby';
  phaseEndsAt: number | null = null;
  questionIndex = -1;
  answeringStartedAt = 0;
  reveal: RevealInfo | null = null;
  leaderboard: LeaderRow[] = [];
  startedAt = 0;
  finishedAt = 0;
  results: GameResults | null = null;
  mode: ModeHandler;

  hostSocketId: string | null = null;
  private hostGraceTimer: NodeJS.Timeout | null = null;
  private timer: NodeJS.Timeout | null = null;
  private answersFlush: NodeJS.Timeout;
  private answersDirty = false;
  private stateDirty = false;
  private stats: QuestionStat[] = [];
  private prevRanks = new Map<string, number>();
  private closed = false;
  private soloColorCounter = 0;

  constructor(
    readonly io: IO,
    readonly code: string,
    readonly quiz: StoredQuiz,
    readonly settings: GameSettings,
    private readonly cb: GameCallbacks,
  ) {
    const qs = settings.shuffleQuestions ? shuffle(quiz.questions) : [...quiz.questions];
    this.questions = qs.map((q) => ({
      ...q,
      timeLimit: settings.timeLimitOverride ?? q.timeLimit,
    }));
    this.stats = this.questions.map(() => ({ correct: 0, wrong: 0, unanswered: 0, times: [] }));
    if (settings.teamMode) {
      for (let i = 0; i < settings.teamCount; i++) {
        const preset = TEAM_PRESETS[i]!;
        this.teams.push({
          id: i,
          name: settings.teamNames[i]?.trim() || preset.name,
          color: preset.color,
          dark: preset.dark,
          emblem: preset.emblem,
        });
      }
    }
    this.mode = createMode(this);
    this.autoplay = settings.autoplay;
    // Пакетная рассылка: не событие на каждый ответ, а счётчик раз в 250 мс
    this.answersFlush = setInterval(() => this.flush(), 250);
  }

  // ───────────────────────── Комнаты и рассылка ─────────────────────────

  get hostRoom(): string {
    return `host:${this.id}`;
  }
  get playersRoom(): string {
    return `players:${this.id}`;
  }
  get question(): QuizQuestion | null {
    return this.questions[this.questionIndex] ?? null;
  }
  get hostConnected(): boolean {
    return this.hostSocketId !== null;
  }
  get isActive(): boolean {
    return !this.closed;
  }

  private flush(): void {
    if (this.answersDirty) {
      this.answersDirty = false;
      const payload = { count: this.answeredCount(), total: this.activePlayers().length };
      this.io.to(this.hostRoom).to(this.playersRoom).emit('game:answers', payload);
    }
    if (this.stateDirty) {
      this.stateDirty = false;
      this.sendHost();
    }
  }

  /** Отложенная рассылка состояния преподавателю (склеивает частые изменения в лобби) */
  markHostDirty(): void {
    this.stateDirty = true;
  }

  sendHost(): void {
    if (this.closed) return;
    this.io.to(this.hostRoom).emit('host:state', this.hostView());
  }

  sendPlayer(p: Player): void {
    if (this.closed || !p.socketId) return;
    this.io.to(p.socketId).emit('player:state', this.playerView(p));
  }

  broadcast(): void {
    this.sendHost();
    for (const p of this.players.values()) this.sendPlayer(p);
  }

  activePlayers(): Player[] {
    return [...this.players.values()];
  }

  answeredCount(): number {
    let n = 0;
    for (const p of this.players.values()) if (p.answers.has(this.questionIndex)) n++;
    return n;
  }

  // ───────────────────────── Игроки ─────────────────────────

  addPlayer(name: string, avatar: Avatar): Player {
    const p = new Player(name, avatar);
    p.color = soloColor(this.soloColorCounter++);
    this.players.set(p.id, p);
    if (this.phase !== 'lobby') {
      if (this.settings.teamMode) p.teamId = this.smallestTeam();
      this.mode.onPlayerAdded(p);
    }
    this.cb.listChanged();
    return p;
  }

  private smallestTeam(): number {
    const counts = this.teams.map((t) => [...this.players.values()].filter((p) => p.teamId === t.id).length);
    let best = 0;
    counts.forEach((c, i) => {
      if (c < counts[best]!) best = i;
    });
    return best;
  }

  findByToken(token: string): Player | null {
    for (const p of this.players.values()) if (p.token === token) return p;
    return null;
  }

  removePlayer(id: string): Player | null {
    const p = this.players.get(id);
    if (!p) return null;
    this.players.delete(id);
    this.kickedTokens.add(p.token);
    this.mode.onPlayerRemoved(p);
    this.cb.listChanged();
    this.broadcast();
    this.maybeEndAnswering();
    return p;
  }

  updateProfile(p: Player, name: string, avatar: Avatar): void {
    p.name = name;
    p.avatar = avatar;
    this.broadcast();
  }

  playerConnected(p: Player, socketId: string): void {
    p.socketId = socketId;
    p.lastSeen = Date.now();
    this.markHostDirty();
    this.sendPlayer(p);
  }

  playerDisconnected(p: Player): void {
    p.socketId = null;
    p.lastSeen = Date.now();
    this.markHostDirty();
  }

  // ───────────────────────── Преподаватель ─────────────────────────

  hostAttached(socketId: string): void {
    this.hostSocketId = socketId;
    if (this.hostGraceTimer) {
      clearTimeout(this.hostGraceTimer);
      this.hostGraceTimer = null;
    }
    this.broadcast();
  }

  hostDetached(socketId: string): void {
    if (this.hostSocketId !== socketId) return;
    this.hostSocketId = null;
    this.broadcast();
    // Игра не умирает сразу: ждём переподключения преподавателя
    this.hostGraceTimer = setTimeout(() => {
      this.close('Преподаватель отключился. Игра завершена.');
    }, PHASE_MS.hostGrace);
  }

  setTeamNames(names: string[]): void {
    names.forEach((n, i) => {
      const t = this.teams[i];
      const clean = n.trim().slice(0, 30);
      if (t && clean) t.name = clean;
    });
    this.broadcast();
  }

  // ───────────────────────── Ход игры ─────────────────────────

  private setPhase(phase: Phase, durationMs: number | null, onEnd?: () => void): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.phase = phase;
    // Автоплей: показ ответа и таблица лидеров переключаются сами
    if (durationMs === null && this.autoplay) {
      const auto = this.autoDuration(phase);
      if (auto !== null) {
        durationMs = auto;
        onEnd = () => this.next();
      }
    }
    this.phaseEndsAt = durationMs === null ? null : Date.now() + durationMs;
    this.mode.onPhase(phase);
    if (durationMs !== null && onEnd) {
      this.timer = setTimeout(onEnd, durationMs);
    }
    this.cb.listChanged();
    this.broadcast();
  }

  start(): Ack {
    if (this.phase !== 'lobby') return { ok: false, error: 'Игра уже идёт' };
    if (this.players.size === 0) return { ok: false, error: 'Пока никто не подключился' };
    this.startedAt = Date.now();
    if (this.settings.teamMode) {
      // Случайное распределение — дети не выбирают команду сами
      shuffle([...this.players.values()]).forEach((p, i) => {
        p.teamId = i % this.teams.length;
      });
    }
    this.mode.init();
    this.updateRanks();
    if (this.settings.showRules) this.setPhase('rules', PHASE_MS.rules, () => this.beginIntro());
    else this.beginIntro();
    return { ok: true };
  }

  private beginIntro(): void {
    this.setPhase('intro', PHASE_MS.intro, () => this.nextQuestion());
  }

  autoplay = false;

  private autoDuration(phase: Phase): number | null {
    if (phase === 'reveal') return PHASE_MS.autoReveal;
    if (phase === 'leaderboard') return PHASE_MS.autoLeaderboard;
    return null;
  }

  /** Включить/выключить автоплей прямо во время игры */
  setAutoplay(on: boolean): void {
    this.autoplay = on;
    const auto = this.autoDuration(this.phase);
    if (auto !== null) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      if (on) {
        this.phaseEndsAt = Date.now() + auto;
        this.timer = setTimeout(() => this.next(), auto);
      } else {
        this.phaseEndsAt = null;
      }
    }
    this.broadcast();
  }

  private nextQuestion(): void {
    if (this.mode.isOver() || this.questionIndex + 1 >= this.questions.length) {
      this.finish();
      return;
    }
    this.questionIndex++;
    this.reveal = null;
    for (const p of this.players.values()) p.lastPoints = 0;
    this.setPhase('question', PHASE_MS.question, () => this.beginAnswering());
  }

  private beginAnswering(): void {
    const q = this.question!;
    this.answeringStartedAt = Date.now();
    this.setPhase('answering', q.timeLimit * 1000, () => this.endAnswering());
    this.answersDirty = true;
  }

  answer(p: Player, questionIndex: number, choices: number[]): Ack {
    if (this.phase !== 'answering') return { ok: false, error: 'Время на ответ вышло' };
    if (questionIndex !== this.questionIndex) return { ok: false, error: 'Это уже другой вопрос' };
    if (p.answers.has(questionIndex)) return { ok: false, error: 'Ответ уже принят' };
    const q = this.question!;
    const uniq = [...new Set(choices)].filter((c) => Number.isInteger(c) && c >= 0 && c < q.answers.length);
    if (uniq.length === 0) return { ok: false, error: 'Выбери вариант ответа' };
    if (q.type !== 'multiple' && uniq.length !== 1) return { ok: false, error: 'Нужен один вариант' };
    // Сервер — источник истины по времени: засчитывается момент получения ответа
    const elapsedMs = Math.min(Date.now() - this.answeringStartedAt, q.timeLimit * 1000);
    const correct = q.answers.map((a, i) => (a.correct ? i : -1)).filter((i) => i >= 0);
    const ev = evaluateAnswer(q.type, correct, uniq);
    p.answers.set(questionIndex, { choices: uniq, elapsedMs, fullyCorrect: ev.fullyCorrect, fraction: ev.fraction, points: 0 });
    this.answersDirty = true;
    this.maybeEndAnswering();
    return { ok: true };
  }

  private maybeEndAnswering(): void {
    if (this.phase !== 'answering') return;
    const connected = [...this.players.values()].filter((p) => p.connected);
    if (connected.length === 0) return;
    if (connected.every((p) => p.answers.has(this.questionIndex))) {
      // Небольшая пауза, чтобы последний ответивший увидел «Ответ принят»
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => this.endAnswering(), 400);
    }
  }

  private endAnswering(): void {
    if (this.phase !== 'answering') return;
    const q = this.question!;
    const qi = this.questionIndex;
    const correct = q.answers.map((a, i) => (a.correct ? i : -1)).filter((i) => i >= 0);
    const distribution = q.answers.map(() => 0);
    const stat = this.stats[qi]!;
    const entries: RoundEntry[] = [];
    this.prevRanks = new Map(this.leaderboardRanks());

    for (const p of this.players.values()) {
      const a = p.answers.get(qi);
      if (!a) {
        p.streak = 0;
        p.unansweredCount++;
        p.lastPoints = 0;
        p.lastFlagsEarned = 0;
        stat.unanswered++;
        entries.push({ player: p, answered: false, fullyCorrect: false, streakAfter: 0, elapsedMs: null });
        continue;
      }
      for (const c of a.choices) distribution[c]!++;
      stat.times.push(a.elapsedMs);
      if (a.fullyCorrect) {
        p.streak++;
        p.bestStreak = Math.max(p.bestStreak, p.streak);
        p.correctCount++;
        stat.correct++;
      } else {
        p.streak = 0;
        p.wrongCount++;
        stat.wrong++;
      }
      a.points = computePoints({
        elapsedMs: a.elapsedMs,
        limitMs: q.timeLimit * 1000,
        fraction: a.fraction,
        fullyCorrect: a.fullyCorrect,
        streakAfter: p.streak,
        questionMultiplier: q.points,
      });
      p.score += a.points;
      p.lastPoints = a.points;
      p.lastFlagsEarned = 0;
      entries.push({ player: p, answered: true, fullyCorrect: a.fullyCorrect, streakAfter: p.streak, elapsedMs: a.elapsedMs });
    }

    this.reveal = {
      correct,
      distribution,
      answeredCount: stat.correct + stat.wrong,
      correctCount: stat.correct,
      totalPlayers: this.players.size,
    };
    this.pendingOutcome = { questionIndex: qi, entries };
    this.playedCount = qi + 1;
    this.mode.onRoundScored?.(this.pendingOutcome);
    this.updateRanks();
    this.answersDirty = true;
    this.setPhase('reveal', null);
  }

  private pendingOutcome: RoundOutcome | null = null;
  private playedCount = 0;

  /** Кнопка «Далее» преподавателя */
  next(): Ack {
    switch (this.phase) {
      case 'lobby':
        return this.start();
      case 'rules':
        this.beginIntro();
        return { ok: true };
      case 'intro':
        this.nextQuestion();
        return { ok: true };
      case 'question':
        this.beginAnswering();
        return { ok: true };
      case 'answering':
        this.endAnswering();
        return { ok: true };
      case 'reveal': {
        const outcome = this.pendingOutcome;
        this.pendingOutcome = null;
        const duration = outcome ? this.mode.beginEvent(outcome) : null;
        if (duration !== null) this.setPhase('event', duration, () => this.endEvent());
        else this.showLeaderboard();
        return { ok: true };
      }
      case 'event':
        this.endEvent();
        return { ok: true };
      case 'leaderboard':
        this.nextQuestion();
        return { ok: true };
      case 'finished':
        return { ok: false, error: 'Игра окончена' };
    }
  }

  /** «Пропустить»: закончить приём ответов досрочно */
  skip(): Ack {
    if (['answering', 'question', 'event', 'intro', 'rules'].includes(this.phase)) {
      return this.next();
    }
    return { ok: false, error: 'Сейчас нечего пропускать' };
  }

  endEventIfDone(): void {
    if (this.phase === 'event' && this.mode.canEndEventEarly?.()) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => this.endEvent(), 900);
    }
  }

  /** Режим сам решил, что событие закончено (например, все поставили блоки) */
  finishEventIn(ms: number): void {
    if (this.phase !== 'event') return;
    if (this.timer) clearTimeout(this.timer);
    this.phaseEndsAt = Date.now() + ms;
    this.timer = setTimeout(() => this.endEvent(), ms);
  }

  private endEvent(): void {
    if (this.phase !== 'event') return;
    this.mode.endEvent();
    this.showLeaderboard();
  }

  private showLeaderboard(): void {
    this.updateRanks();
    this.setPhase('leaderboard', null);
  }

  private leaderboardRanks(): Map<string, number> {
    const sorted = this.sortedPlayers();
    return new Map(sorted.map((p, i) => [p.id, i + 1]));
  }

  sortedPlayers(): Player[] {
    return [...this.players.values()].sort(
      (a, b) => b.score - a.score || b.correctCount - a.correctCount || a.joinedAt - b.joinedAt,
    );
  }

  rankOf(p: Player): number {
    return this.sortedPlayers().indexOf(p) + 1;
  }

  private updateRanks(): void {
    const sorted = this.sortedPlayers();
    this.leaderboard = sorted.slice(0, 10).map((p, i) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      teamId: p.teamId,
      color: p.teamId !== null ? this.teams[p.teamId]!.color : p.color,
      score: p.score,
      gained: p.lastPoints,
      rank: i + 1,
      prevRank: this.prevRanks.get(p.id) ?? i + 1,
      streak: p.streak,
    }));
  }

  /** Досрочное завершение преподавателем */
  end(): Ack {
    if (this.phase === 'finished') return { ok: false, error: 'Игра уже окончена' };
    if (this.phase === 'lobby') {
      this.close('Преподаватель отменил игру.');
      return { ok: true };
    }
    if (this.phase === 'answering') this.endAnswering();
    this.finish();
    return { ok: true };
  }

  private finish(): void {
    if (this.phase === 'finished') return;
    this.finishedAt = Date.now();
    this.results = this.buildResults();
    this.setPhase('finished', null);
    this.cb.finished(this, this.results);
  }

  close(reason: string): void {
    if (this.closed) return;
    if (this.timer) clearTimeout(this.timer);
    if (this.hostGraceTimer) clearTimeout(this.hostGraceTimer);
    clearInterval(this.answersFlush);
    this.mode.dispose();
    this.io.to(this.playersRoom).to(this.hostRoom).emit('game:closed', { reason });
    this.closed = true;
    this.cb.closed(this);
  }

  // ───────────────────────── Реакции и действия режимов ─────────────────────────

  react(p: Player, emoji: ReactionEmoji): Ack<{ cooldownUntil: number }> {
    if (!REACTIONS.includes(emoji)) return { ok: false, error: 'Неизвестная реакция' };
    if (this.phase === 'answering') return { ok: false, error: 'Во время ответа реакции недоступны' };
    const now = Date.now();
    if (now - p.lastReactionAt < REACTION_COOLDOWN_MS) {
      return { ok: false, error: 'Подожди немного', data: { cooldownUntil: p.lastReactionAt + REACTION_COOLDOWN_MS } };
    }
    p.lastReactionAt = now;
    const color = p.teamId !== null ? this.teams[p.teamId]!.color : p.color;
    this.io.to(this.hostRoom).emit('game:reaction', { playerId: p.id, name: p.name, avatar: p.avatar, emoji, color });
    return { ok: true, data: { cooldownUntil: now + REACTION_COOLDOWN_MS } };
  }

  emote(p: Player, emote: EmoteId): Ack {
    if (this.phase !== 'finished') return { ok: false, error: 'Эмоции доступны на пьедестале' };
    const now = Date.now();
    if (now - p.lastEmoteAt < EMOTE_COOLDOWN_MS) return { ok: false, error: 'Подожди секунду' };
    p.lastEmoteAt = now;
    this.io.to(this.hostRoom).emit('game:emote', { playerId: p.id, emote });
    return { ok: true };
  }

  drop(p: Player, rel: number): Ack<{ result: 'perfect' | 'ok' | 'fail' }> {
    if (!this.mode.drop) return { ok: false, error: 'В этом режиме блоки не ставят' };
    return this.mode.drop(p, rel);
  }

  place(p: Player, cell: number): Ack {
    if (!this.mode.place) return { ok: false, error: 'В этом режиме нельзя ставить флаги' };
    return this.mode.place(p, cell);
  }

  // ───────────────────────── Представления ─────────────────────────

  publicQuestion(): PublicQuestion | null {
    const q = this.question;
    if (!q) return null;
    return {
      index: this.questionIndex,
      total: this.questions.length,
      type: q.type,
      text: q.question,
      imageUrl: q.imageUrl,
      answers: q.answers.map((a) => a.text),
      timeLimit: q.timeLimit,
      points: q.points,
    };
  }

  teamStandings(): TeamStanding[] {
    if (!this.settings.teamMode) return [];
    return this.mode.teamStandings();
  }

  /** Средний счёт команды — показатель для «Классики» */
  averageScoreStandings(): TeamStanding[] {
    return this.teams
      .map((t) => {
        const members = [...this.players.values()].filter((p) => p.teamId === t.id);
        const avg = members.length ? Math.round(members.reduce((s, p) => s + p.score, 0) / members.length) : 0;
        return {
          teamId: t.id,
          name: t.name,
          color: t.color,
          emblem: t.emblem,
          value: avg,
          valueLabel: 'очков в среднем',
          members: members.length,
        };
      })
      .sort((a, b) => b.value - a.value);
  }

  hostView(): HostView {
    const showQuestion = this.phase === 'question' || this.phase === 'answering' || this.phase === 'reveal';
    return {
      gameId: this.id,
      code: this.code,
      quizTitle: this.quiz.title,
      settings: this.settings,
      phase: this.phase,
      phaseEndsAt: this.phaseEndsAt,
      serverNow: Date.now(),
      hostPaused: !this.hostConnected,
      autoplay: this.autoplay,
      questionIndex: this.questionIndex,
      questionCount: this.questions.length,
      question: showQuestion || this.phase === 'event' || this.phase === 'leaderboard' ? this.publicQuestion() : null,
      answersCount: this.answeredCount(),
      teams: this.teams,
      players: [...this.players.values()].map((p) => p.public(this.phase === 'answering' ? this.questionIndex : null)),
      reveal: this.phase === 'reveal' || this.phase === 'event' || this.phase === 'leaderboard' ? this.reveal : null,
      leaderboard: this.leaderboard,
      teamStandings: this.teamStandings(),
      mode: this.mode.state(),
      results: this.results,
      hasNext: this.questionIndex + 1 < this.questions.length && !this.mode.isOver(),
    };
  }

  playerView(p: Player): PlayerView {
    const q = this.publicQuestion();
    const showQ = this.phase === 'question' || this.phase === 'answering' || this.phase === 'reveal';
    const a = p.answers.get(this.questionIndex);
    const team = p.teamId !== null ? this.teams[p.teamId]! : null;
    const rank = this.rankOf(p);
    const afterAnswer = this.phase === 'reveal' || this.phase === 'event' || this.phase === 'leaderboard';
    const winnerTeam = this.results?.summary.winnerTeam?.name ?? null;
    const base: PlayerView = {
      gameId: this.id,
      code: this.code,
      quizTitle: this.quiz.title,
      mode: this.settings.mode,
      teamMode: this.settings.teamMode,
      phase: this.phase,
      phaseEndsAt: this.phaseEndsAt,
      serverNow: Date.now(),
      hostPaused: !this.hostConnected,
      playersCount: this.players.size,
      me: { ...p.public(this.questionIndex), rank, flags: p.flags },
      team,
      teamMates: team
        ? [...this.players.values()].filter((o) => o.teamId === team.id).map((o) => ({ id: o.id, name: o.name, avatar: o.avatar }))
        : [],
      question: showQ ? q : null,
      myAnswer: a ? a.choices : null,
      lastResult:
        afterAnswer && this.questionIndex >= 0
          ? {
              questionIndex: this.questionIndex,
              answered: !!a,
              correct: !!a?.fullyCorrect,
              fraction: a?.fraction ?? 0,
              points: a?.points ?? 0,
              streak: p.streak,
              rank,
              flagsEarned: p.lastFlagsEarned,
            }
          : null,
      correctAnswers: afterAnswer && this.reveal ? this.reveal.correct : null,
      territory: null,
      escape: null,
      tower: null,
      final:
        this.phase === 'finished'
          ? {
              rank,
              score: p.score,
              correct: p.correctCount,
              total: this.playedCount,
              playersCount: this.players.size,
              winnerTeam,
            }
          : null,
      reactionCooldownUntil: p.lastReactionAt + REACTION_COOLDOWN_MS,
    };
    return { ...base, ...this.mode.playerExtras(p) };
  }

  private buildResults(): GameResults {
    const played = this.playedCount;
    const sorted = this.sortedPlayers();
    const players: PlayerResult[] = sorted.map((p, i) => {
      const times = [...p.answers.entries()].filter(([qi]) => qi < played).map(([, a]) => a.elapsedMs);
      const team = p.teamId !== null ? this.teams[p.teamId]! : null;
      return {
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        teamId: p.teamId,
        teamName: team?.name ?? null,
        color: team?.color ?? p.color,
        score: p.score,
        rank: i + 1,
        correct: p.correctCount,
        wrong: p.wrongCount,
        unanswered: Math.max(0, played - p.correctCount - p.wrongCount),
        percent: played ? Math.round((p.correctCount / played) * 100) : 0,
        bestStreak: p.bestStreak,
        avgTimeMs: times.length ? Math.round(times.reduce((s, t) => s + t, 0) / times.length) : null,
        modeValue: this.mode.modeValue(p),
      };
    });
    const questions: QuestionResult[] = this.questions.slice(0, played).map((q, i) => {
      const s = this.stats[i]!;
      const total = s.correct + s.wrong + s.unanswered;
      return {
        index: i,
        text: q.question,
        correct: s.correct,
        wrong: s.wrong,
        unanswered: s.unanswered,
        percent: total ? Math.round((s.correct / total) * 100) : 0,
        avgTimeMs: s.times.length ? Math.round(s.times.reduce((a, b) => a + b, 0) / s.times.length) : null,
      };
    });

    let fastest: GameResults['summary']['fastest'] = null;
    for (const p of this.players.values()) {
      for (const [qi, a] of p.answers) {
        if (a.fullyCorrect && (!fastest || a.elapsedMs < fastest.timeMs)) fastest = { name: p.name, timeMs: a.elapsedMs, question: qi + 1 };
      }
    }
    const streaker = [...this.players.values()].sort((a, b) => b.bestStreak - a.bestStreak)[0];
    const corrector = [...this.players.values()].sort((a, b) => b.correctCount - a.correctCount)[0];
    const teams = this.teamStandings();
    const modeSummary = this.mode.summary();
    return {
      gameId: this.id,
      quizTitle: this.quiz.title,
      mode: this.settings.mode,
      teamMode: this.settings.teamMode,
      startedAt: this.startedAt || this.createdAt,
      finishedAt: this.finishedAt,
      players,
      questions,
      teams,
      summary: {
        fastest,
        longestStreak: streaker && streaker.bestStreak > 0 ? { name: streaker.name, streak: streaker.bestStreak } : null,
        mostCorrect: corrector && corrector.correctCount > 0 ? { name: corrector.name, correct: corrector.correctCount } : null,
        modeAward: modeSummary.modeAward,
        winnerTeam: teams[0] ? { name: teams[0].name, color: teams[0].color, value: `${teams[0].value} ${teams[0].valueLabel}` } : null,
        modeResultLine: modeSummary.modeResultLine,
      },
    };
  }
}
