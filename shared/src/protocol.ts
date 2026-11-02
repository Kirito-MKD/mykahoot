import type { Avatar } from './avatar';
import type { GameMode } from './modes';
import type { GameSettings, ReactionEmoji } from './settings';
import type { QuestionType } from './quiz';
import type { EmblemId } from './teams';

export type Phase =
  | 'lobby'
  | 'intro'
  | 'question'
  | 'answering'
  | 'reveal'
  | 'event'
  | 'leaderboard'
  | 'finished';

export interface TeamInfo {
  id: number;
  name: string;
  color: string;
  dark: string;
  emblem: EmblemId;
}

export interface PlayerPublic {
  id: string;
  name: string;
  avatar: Avatar;
  teamId: number | null;
  /** Свой цвет в режиме «каждый сам за себя» */
  color: string;
  score: number;
  connected: boolean;
  streak: number;
  correctCount: number;
  answered: boolean;
}

export interface PublicQuestion {
  index: number;
  total: number;
  type: QuestionType;
  text: string;
  imageUrl?: string;
  answers: string[];
  timeLimit: number;
  points: number;
}

export interface RevealInfo {
  correct: number[];
  distribution: number[];
  answeredCount: number;
  correctCount: number;
  totalPlayers: number;
}

export interface LeaderRow {
  id: string;
  name: string;
  avatar: Avatar;
  teamId: number | null;
  color: string;
  score: number;
  gained: number;
  rank: number;
  prevRank: number;
  streak: number;
}

export interface TeamStanding {
  teamId: number;
  name: string;
  color: string;
  emblem: EmblemId;
  /** Показатель режима: средний счёт / гексы / высота / сбежавшие */
  value: number;
  valueLabel: string;
  members: number;
}

// ───────────── Режимы ─────────────

export interface TerritoryOwner {
  id: string;
  name: string;
  color: string;
  emblem?: EmblemId;
}

export interface TerritoryCell {
  i: number;
  ownerId: string | null;
  playerId?: string;
  playerName?: string;
  base?: boolean;
  /** Увеличивается при каждом изменении — по нему клиенты запускают анимацию */
  rev: number;
  prevOwnerId?: string | null;
}

export interface TerritoryState {
  kind: 'territory';
  cols: number;
  rows: number;
  cells: TerritoryCell[];
  owners: TerritoryOwner[];
  /** Флаги у каждого игрока */
  flags: Record<string, number>;
  /** Гексы, захваченные каждым игроком */
  captured: Record<string, number>;
  placementEndsAt: number | null;
  placementTotalMs: number;
}

export interface TowerBlock {
  id: number;
  playerId: string;
  playerName: string;
  offset: number;
  hue: number;
}

export interface TowerColumn {
  id: string;
  name: string;
  color: string;
  emblem?: EmblemId;
  avatar?: Avatar;
  blocks: TowerBlock[];
}

export interface TowerEvent {
  round: number;
  added: { columnId: string; blockId: number; playerName: string }[];
  monster?: { columnId: string; removed: TowerBlock[] };
}

export interface TowerState {
  kind: 'tower';
  columns: TowerColumn[];
  /** В индивидуальной игре — башни, не попавшие в топ-6 */
  others: { id: string; name: string; height: number; color: string }[];
  lastEvent: TowerEvent | null;
  monsterEvery: number;
  roundsUntilMonster: number;
  /** Вклад игроков: сколько блоков добавил каждый */
  contributions: Record<string, number>;
}

export type RunnerStatus = 'running' | 'escaped' | 'caught';

export interface EscapeRunner {
  playerId: string;
  name: string;
  avatar: Avatar;
  color: string;
  pos: number;
  status: RunnerStatus;
  /** Клетки препятствий, которые бегун уже обошёл */
  detoured: number[];
  /** Последнее действие — для анимации на экране */
  lastMove: 'step' | 'detour' | 'stand' | null;
}

export interface EscapeObstacle {
  cell: number;
  kind: 'pit' | 'puddle';
}

export interface EscapeState {
  kind: 'escape';
  level: number;
  levels: number;
  trackLength: number;
  obstacles: EscapeObstacle[];
  robotPos: number;
  /** Клеток в секунду, пока идут часы уровня */
  robotSpeed: number;
  clockRunning: boolean;
  /** Сколько осталось до конца уровня, мс (на момент serverNow) */
  levelRemainingMs: number;
  levelDurationMs: number;
  runners: EscapeRunner[];
  requiredToPass: number;
  levelResults: ('passed' | 'failed')[];
  /** Номер «шага» — увеличивается при каждом ходе бегунов */
  moveRev: number;
  banner: { kind: 'levelPassed' | 'levelFailed' | 'levelStart' | 'gameOver'; title: string; subtitle?: string } | null;
}

export type ModeState = TerritoryState | TowerState | EscapeState | { kind: 'classic' };

// ───────────── Итоги ─────────────

export interface PlayerResult {
  id: string;
  name: string;
  avatar: Avatar;
  teamId: number | null;
  teamName: string | null;
  color: string;
  score: number;
  rank: number;
  correct: number;
  wrong: number;
  unanswered: number;
  percent: number;
  bestStreak: number;
  avgTimeMs: number | null;
  /** Вклад в режиме: гексы / блоки / шаги */
  modeValue: number;
}

export interface QuestionResult {
  index: number;
  text: string;
  correct: number;
  wrong: number;
  unanswered: number;
  percent: number;
  avgTimeMs: number | null;
}

export interface GameSummary {
  fastest: { name: string; timeMs: number; question: number } | null;
  longestStreak: { name: string; streak: number } | null;
  mostCorrect: { name: string; correct: number } | null;
  /** Особая награда режима (лучший строитель, лучший захватчик…) */
  modeAward: { title: string; name: string; value: string } | null;
  winnerTeam: { name: string; color: string; value: string } | null;
  modeResultLine: string | null;
}

export interface GameResults {
  gameId: string;
  quizTitle: string;
  mode: GameMode;
  teamMode: boolean;
  startedAt: number;
  finishedAt: number;
  players: PlayerResult[];
  questions: QuestionResult[];
  teams: TeamStanding[];
  summary: GameSummary;
}

// ───────────── Представления для экранов ─────────────

export interface ServerInfo {
  port: number;
  mdnsOk: boolean;
  mdnsUrl: string;
  ipUrls: string[];
  primaryUrl: string;
  qrUrl: string;
  qrDataUrl: string;
  shortcutPath: string | null;
}

export interface HostView {
  gameId: string;
  code: string;
  quizTitle: string;
  settings: GameSettings;
  phase: Phase;
  phaseEndsAt: number | null;
  serverNow: number;
  hostPaused: boolean;
  questionIndex: number;
  questionCount: number;
  question: PublicQuestion | null;
  answersCount: number;
  teams: TeamInfo[];
  players: PlayerPublic[];
  reveal: RevealInfo | null;
  leaderboard: LeaderRow[];
  teamStandings: TeamStanding[];
  mode: ModeState;
  results: GameResults | null;
  /** Есть ли ещё вопросы — для подписи кнопки «Далее» */
  hasNext: boolean;
}

export interface MyResult {
  questionIndex: number;
  answered: boolean;
  correct: boolean;
  fraction: number;
  points: number;
  streak: number;
  rank: number;
  flagsEarned: number;
}

export interface PlayerView {
  gameId: string;
  code: string;
  quizTitle: string;
  mode: GameMode;
  teamMode: boolean;
  phase: Phase;
  phaseEndsAt: number | null;
  serverNow: number;
  hostPaused: boolean;
  playersCount: number;
  me: PlayerPublic & { rank: number; flags: number };
  team: TeamInfo | null;
  teamMates: { id: string; name: string; avatar: Avatar }[];
  question: PublicQuestion | null;
  myAnswer: number[] | null;
  lastResult: MyResult | null;
  correctAnswers: number[] | null;
  territory: TerritoryState | null;
  escape: { level: number; levels: number; pos: number; trackLength: number; status: RunnerStatus } | null;
  tower: { height: number; myBlocks: number; columnName: string } | null;
  final: { rank: number; score: number; correct: number; total: number; playersCount: number; winnerTeam: string | null } | null;
  reactionCooldownUntil: number;
}

export interface GameListing {
  id: string;
  code: string;
  title: string;
  phase: Phase;
  playersCount: number;
  mode: GameMode;
}

export interface Ack<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

// ───────────── События Socket.IO ─────────────

export interface ClientToServerEvents {
  'games:subscribe': () => void;
  'name:check': (name: string, cb: (res: Ack) => void) => void;
  'player:join': (
    p: { code: string; name: string; avatar: Avatar; token?: string },
    cb: (res: Ack<{ token: string; gameId: string }>) => void,
  ) => void;
  'player:resume': (p: { token: string }, cb: (res: Ack<{ gameId: string }>) => void) => void;
  'player:profile': (p: { name: string; avatar: Avatar }, cb: (res: Ack) => void) => void;
  'player:answer': (p: { questionIndex: number; choices: number[] }, cb: (res: Ack) => void) => void;
  'player:react': (p: { emoji: ReactionEmoji }, cb: (res: Ack<{ cooldownUntil: number }>) => void) => void;
  'player:place': (p: { cell: number }, cb: (res: Ack) => void) => void;
  'player:leave': () => void;

  'host:create': (
    p: { quizId: string; settings: GameSettings },
    cb: (res: Ack<{ gameId: string; hostToken: string }>) => void,
  ) => void;
  'host:resume': (p: { hostToken: string }, cb: (res: Ack<{ gameId: string }>) => void) => void;
  'host:teams': (p: { names: string[] }, cb: (res: Ack) => void) => void;
  'host:start': (cb: (res: Ack) => void) => void;
  'host:next': (cb: (res: Ack) => void) => void;
  'host:skip': (cb: (res: Ack) => void) => void;
  'host:kick': (p: { playerId: string }, cb: (res: Ack) => void) => void;
  'host:end': (cb: (res: Ack) => void) => void;
  'host:close': (cb: (res: Ack) => void) => void;
}

export interface ServerToClientEvents {
  'games:list': (games: GameListing[]) => void;
  'host:state': (view: HostView) => void;
  'player:state': (view: PlayerView) => void;
  'game:answers': (p: { count: number; total: number }) => void;
  'game:reaction': (p: { playerId: string; name: string; avatar: Avatar; emoji: ReactionEmoji; color: string }) => void;
  'territory:cell': (p: { cell: TerritoryCell; flags: Record<string, number>; captured: Record<string, number> }) => void;
  'escape:caught': (p: { playerId: string }) => void;
  'player:kicked': () => void;
  'game:closed': (p: { reason: string }) => void;
}
