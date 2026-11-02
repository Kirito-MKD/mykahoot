import {
  BASE_CAPTURE_COST,
  BASE_VALUE,
  hexDistance,
  hexNeighbors,
  spreadBases,
  territorySize,
  type Ack,
  type PlayerView,
  type TeamStanding,
  type TerritoryCell,
  type TerritoryOwner,
  type TerritoryState,
} from '@viktorina/shared';
import type { Game } from '../game/Game';
import type { Player } from '../game/Player';
import type { ModeHandler, ModeSummary, RoundOutcome } from '../game/types';

const RECAPTURE_COST = 2;

export class TerritoryMode implements ModeHandler {
  private cells: TerritoryCell[] = [];
  private cols = 8;
  private rows = 6;
  private placementEndsAt: number | null = null;

  constructor(private readonly game: Game) {
    this.resize(8, 6);
  }

  private resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    this.cells = Array.from({ length: cols * rows }, (_, i) => ({ i, ownerId: null, rev: 0 }));
  }

  private ownerOf(p: Player): string {
    return this.game.settings.teamMode ? `t${p.teamId ?? 0}` : `p${p.id}`;
  }

  private neighbors(i: number): number[] {
    return hexNeighbors(i, this.cols, this.rows);
  }

  private setBase(cellIndex: number, ownerId: string, name: string, playerId?: string): void {
    const c = this.cells[cellIndex]!;
    c.ownerId = ownerId;
    c.base = true;
    c.playerName = name;
    c.playerId = playerId;
    c.rev++;
  }

  init(): void {
    const players = this.game.players.size;
    const { cols, rows } = territorySize(players, this.game.settings.teamMode);
    this.resize(cols, rows);
    if (this.game.settings.teamMode) {
      const bases = spreadBases(this.game.teams.length, cols, rows);
      this.game.teams.forEach((t, k) => this.setBase(bases[k]!, `t${t.id}`, t.name));
    } else {
      // В игре «каждый сам за себя» у каждого своя башня-база
      const list = [...this.game.players.values()];
      const bases = spreadBases(list.length, cols, rows);
      list.forEach((p, k) => this.setBase(bases[k]!, `p${p.id}`, p.name, p.id));
    }
  }

  onPlayerAdded(p: Player): void {
    if (this.game.settings.teamMode || this.cells.length === 0) return;
    // Опоздавшему — свободная клетка подальше от остальных
    const taken = this.cells.filter((c) => c.ownerId !== null).map((c) => c.i);
    let best = -1;
    let bestD = -1;
    for (const c of this.cells) {
      if (c.ownerId !== null) continue;
      const d = taken.length ? Math.min(...taken.map((t) => hexDistance(c.i, t, this.cols))) : 99;
      if (d > bestD) {
        bestD = d;
        best = c.i;
      }
    }
    if (best >= 0) this.setBase(best, `p${p.id}`, p.name, p.id);
  }

  onPlayerRemoved(p: Player): void {
    // Гексы ушедшего игрока остаются за командой; в одиночной игре освобождаем их
    if (this.game.settings.teamMode) return;
    for (const c of this.cells) {
      if (c.ownerId === `p${p.id}`) {
        c.prevOwnerId = c.ownerId;
        c.ownerId = null;
        c.playerId = undefined;
        c.playerName = undefined;
        c.base = false;
        c.rev++;
      }
    }
  }

  onPhase(): void {}

  onRoundScored(outcome: RoundOutcome): void {
    for (const e of outcome.entries) {
      if (!e.fullyCorrect) continue;
      // 1 флаг за верный ответ, 3 — за верный в серии от трёх подряд
      const earned = e.streakAfter >= 3 ? 3 : 1;
      e.player.flags += earned;
      e.player.lastFlagsEarned = earned;
    }
  }

  beginEvent(): number | null {
    const anyFlags = [...this.game.players.values()].some((p) => p.flags > 0);
    if (!anyFlags) return null;
    const ms = this.game.settings.placementSeconds * 1000;
    this.placementEndsAt = Date.now() + ms;
    return ms;
  }

  endEvent(): void {
    this.placementEndsAt = null;
  }

  private costOf(cell: TerritoryCell): number {
    if (cell.ownerId === null) return 1;
    return cell.base ? BASE_CAPTURE_COST : RECAPTURE_COST;
  }

  canEndEventEarly(): boolean {
    const connected = [...this.game.players.values()].filter((p) => p.connected);
    return connected.length > 0 && connected.every((p) => p.flags === 0 || !this.hasAnyMove(p));
  }

  private hasAnyMove(p: Player): boolean {
    const mine = this.ownerOf(p);
    const owns = this.cells.some((c) => c.ownerId === mine);
    return this.cells.some((c) => {
      if (c.ownerId === mine) return false;
      if (p.flags < this.costOf(c)) return false;
      if (!owns) return c.ownerId === null;
      return this.neighbors(c.i).some((n) => this.cells[n]!.ownerId === mine);
    });
  }

  isOver(): boolean {
    return false;
  }

  place(p: Player, index: number): Ack {
    if (this.game.phase !== 'event' || this.placementEndsAt === null) return { ok: false, error: 'Сейчас не время расставлять флаги' };
    const cell = this.cells[index];
    if (!cell) return { ok: false, error: 'Такой клетки нет' };
    const mine = this.ownerOf(p);
    if (cell.ownerId === mine) return { ok: false, error: this.game.settings.teamMode ? 'Это уже территория твоей команды' : 'Это уже твоя территория' };
    const cost = this.costOf(cell);
    if (p.flags < cost) {
      if (cell.base) return { ok: false, error: `Чтобы захватить чужую башню, нужно ${BASE_CAPTURE_COST} флага` };
      return { ok: false, error: cost === RECAPTURE_COST ? 'Чтобы перебить чужой гекс, нужно два флага' : 'Флаги закончились' };
    }
    const ownsAny = this.cells.some((c) => c.ownerId === mine);
    if (ownsAny) {
      const adjacent = this.neighbors(index).some((n) => this.cells[n]!.ownerId === mine);
      if (!adjacent) {
        return {
          ok: false,
          error: this.game.settings.teamMode ? 'Ставь флаг рядом с территорией своей команды' : 'Ставь флаг рядом со своей территорией',
        };
      }
    } else if (cell.ownerId !== null) {
      return { ok: false, error: 'Первый флаг ставь на свободную клетку' };
    }

    cell.prevOwnerId = cell.ownerId;
    cell.ownerId = mine;
    cell.playerId = p.id;
    if (!cell.base) cell.playerName = p.name;
    else cell.playerName = this.game.settings.teamMode ? (this.game.teams[p.teamId ?? 0]?.name ?? p.name) : p.name;
    cell.rev++;
    p.flags -= cost;

    const s = this.state();
    this.game.io.to(this.game.hostRoom).to(this.game.playersRoom).emit('territory:cell', {
      cell: { ...cell },
      flags: s.flags,
      captured: s.captured,
    });
    this.game.sendPlayer(p);
    this.game.endEventIfDone();
    return { ok: true };
  }

  private owners(): TerritoryOwner[] {
    if (this.game.settings.teamMode) {
      return this.game.teams.map((t) => ({ id: `t${t.id}`, name: t.name, color: t.color, emblem: t.emblem }));
    }
    return [...this.game.players.values()].map((p) => ({ id: `p${p.id}`, name: p.name, color: p.color }));
  }

  /** Гексы, захваченные каждым игроком (башня считается за несколько гексов) */
  private capturedBy(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const c of this.cells) {
      if (!c.playerId || !c.ownerId) continue;
      if (c.base && this.game.settings.teamMode && c.prevOwnerId === undefined) continue;
      if (c.base && !this.game.settings.teamMode && c.ownerId === `p${c.playerId}` && c.prevOwnerId === undefined) continue;
      out[c.playerId] = (out[c.playerId] ?? 0) + (c.base ? BASE_VALUE : 1);
    }
    return out;
  }

  state(): TerritoryState {
    const flags: Record<string, number> = {};
    for (const p of this.game.players.values()) flags[p.id] = p.flags;
    return {
      kind: 'territory',
      cols: this.cols,
      rows: this.rows,
      cells: this.cells.map((c) => ({ ...c })),
      owners: this.owners(),
      flags,
      captured: this.capturedBy(),
      placementEndsAt: this.placementEndsAt,
      placementTotalMs: this.game.settings.placementSeconds * 1000,
    };
  }

  playerExtras(): Partial<PlayerView> {
    return { territory: this.state() };
  }

  /** Земля владельца: гексы + башни (каждая башня = несколько гексов) */
  private landOf(ownerId: string): number {
    return this.cells.reduce((s, c) => (c.ownerId === ownerId ? s + (c.base ? BASE_VALUE : 1) : s), 0);
  }

  teamStandings(): TeamStanding[] {
    return this.game.teams
      .map((t) => ({
        teamId: t.id,
        name: t.name,
        color: t.color,
        emblem: t.emblem,
        value: this.landOf(`t${t.id}`),
        valueLabel: 'гексов земли',
        members: [...this.game.players.values()].filter((p) => p.teamId === t.id).length,
      }))
      .sort((a, b) => b.value - a.value);
  }

  modeValue(p: Player): number {
    return this.game.settings.teamMode ? (this.capturedBy()[p.id] ?? 0) : this.landOf(`p${p.id}`);
  }

  summary(): ModeSummary {
    const players = [...this.game.players.values()];
    const value = (p: Player) => this.modeValue(p);
    const best = players.sort((a, b) => value(b) - value(a))[0];
    const award = best && value(best) > 0 ? { title: 'Главный захватчик', name: best.name, value: `${value(best)} гекс.` } : null;
    let line: string | null = null;
    if (this.game.settings.teamMode) {
      const top = this.teamStandings()[0];
      if (top) line = `Больше всех земли у команды «${top.name}» — ${top.value} гекс.`;
    } else if (best && value(best) > 0) {
      line = `Больше всех земли у игрока ${best.name} — ${value(best)} гекс.`;
    }
    return { modeAward: award, modeResultLine: line };
  }

  dispose(): void {}
}
