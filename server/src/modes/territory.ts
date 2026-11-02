import {
  HEX_COLS,
  HEX_ROWS,
  cornerCells,
  hexNeighbors,
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
  private placementEndsAt: number | null = null;

  constructor(private readonly game: Game) {
    this.cells = Array.from({ length: HEX_COLS * HEX_ROWS }, (_, i) => ({ i, ownerId: null, rev: 0 }));
  }

  private ownerOf(p: Player): string {
    return this.game.settings.teamMode ? `t${p.teamId ?? 0}` : `p${p.id}`;
  }

  init(): void {
    if (this.game.settings.teamMode) {
      const corners = cornerCells();
      this.game.teams.forEach((t, k) => {
        const c = this.cells[corners[k]!]!;
        c.ownerId = `t${t.id}`;
        c.base = true;
        c.playerName = t.name;
        c.rev++;
      });
    }
  }

  onPlayerAdded(): void {}

  onPlayerRemoved(p: Player): void {
    // Гексы ушедшего игрока остаются за командой; в одиночной игре освобождаем их
    if (this.game.settings.teamMode) return;
    for (const c of this.cells) {
      if (c.playerId === p.id) {
        c.prevOwnerId = c.ownerId;
        c.ownerId = null;
        c.playerId = undefined;
        c.playerName = undefined;
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

  canEndEventEarly(): boolean {
    const connected = [...this.game.players.values()].filter((p) => p.connected);
    return connected.length > 0 && connected.every((p) => p.flags === 0 || !this.hasAnyMove(p));
  }

  private hasAnyMove(p: Player): boolean {
    const mine = this.ownerOf(p);
    const owns = this.cells.some((c) => c.ownerId === mine);
    return this.cells.some((c) => {
      if (c.base || c.ownerId === mine) return false;
      const cost = c.ownerId === null ? 1 : RECAPTURE_COST;
      if (p.flags < cost) return false;
      if (!owns) return c.ownerId === null;
      return hexNeighbors(c.i).some((n) => this.cells[n]!.ownerId === mine);
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
    if (cell.base) return { ok: false, error: 'Базу захватить нельзя' };
    if (cell.ownerId === mine) return { ok: false, error: this.game.settings.teamMode ? 'Это уже территория твоей команды' : 'Это уже твоя территория' };
    const cost = cell.ownerId === null ? 1 : RECAPTURE_COST;
    if (p.flags < cost) {
      return { ok: false, error: cost === RECAPTURE_COST ? 'Чтобы перебить чужой гекс, нужно два флага' : 'Флаги закончились' };
    }
    const ownsAny = this.cells.some((c) => c.ownerId === mine);
    if (ownsAny) {
      const adjacent = hexNeighbors(index).some((n) => this.cells[n]!.ownerId === mine);
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
    cell.playerName = p.name;
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

  private capturedBy(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const c of this.cells) if (c.playerId && !c.base) out[c.playerId] = (out[c.playerId] ?? 0) + 1;
    return out;
  }

  state(): TerritoryState {
    const flags: Record<string, number> = {};
    for (const p of this.game.players.values()) flags[p.id] = p.flags;
    return {
      kind: 'territory',
      cols: HEX_COLS,
      rows: HEX_ROWS,
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

  private countFor(ownerId: string): number {
    return this.cells.filter((c) => c.ownerId === ownerId && !c.base).length;
  }

  teamStandings(): TeamStanding[] {
    return this.game.teams
      .map((t) => ({
        teamId: t.id,
        name: t.name,
        color: t.color,
        emblem: t.emblem,
        value: this.countFor(`t${t.id}`),
        valueLabel: 'гексов',
        members: [...this.game.players.values()].filter((p) => p.teamId === t.id).length,
      }))
      .sort((a, b) => b.value - a.value);
  }

  modeValue(p: Player): number {
    return this.capturedBy()[p.id] ?? 0;
  }

  summary(): ModeSummary {
    const cap = this.capturedBy();
    const best = [...this.game.players.values()].sort((a, b) => (cap[b.id] ?? 0) - (cap[a.id] ?? 0))[0];
    const award = best && (cap[best.id] ?? 0) > 0 ? { title: 'Главный захватчик', name: best.name, value: `${cap[best.id]} гекс.` } : null;
    let line: string | null = null;
    if (this.game.settings.teamMode) {
      const top = this.teamStandings()[0];
      if (top) line = `Больше всех гексов у команды «${top.name}» — ${top.value}`;
    } else if (best && (cap[best.id] ?? 0) > 0) {
      line = `Больше всех гексов у игрока ${best.name} — ${cap[best.id]}`;
    }
    return { modeAward: award, modeResultLine: line };
  }

  dispose(): void {}
}
