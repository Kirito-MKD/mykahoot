import { PHASE_MS, type PlayerView, type TeamStanding, type TowerBlock, type TowerEvent, type TowerState } from '@viktorina/shared';
import type { Game } from '../game/Game';
import type { Player } from '../game/Player';
import type { ModeHandler, ModeSummary, RoundOutcome } from '../game/types';

const TOP_COLUMNS = 6;

interface Column {
  id: string;
  blocks: TowerBlock[];
}

export class TowerMode implements ModeHandler {
  private columns = new Map<string, Column>();
  private round = 0;
  private seq = 0;
  private lastEvent: TowerEvent | null = null;
  private contributions = new Map<string, number>();

  constructor(private readonly game: Game) {}

  private columnIdOf(p: Player): string {
    return this.game.settings.teamMode ? `t${p.teamId ?? 0}` : `p${p.id}`;
  }

  private column(id: string): Column {
    let c = this.columns.get(id);
    if (!c) {
      c = { id, blocks: [] };
      this.columns.set(id, c);
    }
    return c;
  }

  init(): void {
    if (this.game.settings.teamMode) for (const t of this.game.teams) this.column(`t${t.id}`);
    else for (const p of this.game.players.values()) this.column(`p${p.id}`);
  }

  onPlayerAdded(p: Player): void {
    this.column(this.columnIdOf(p));
  }

  onPlayerRemoved(p: Player): void {
    if (!this.game.settings.teamMode) this.columns.delete(`p${p.id}`);
  }

  onPhase(): void {}

  beginEvent(outcome: RoundOutcome): number | null {
    this.round++;
    const added: TowerEvent['added'] = [];
    const correct = outcome.entries
      .filter((e) => e.fullyCorrect)
      .sort((a, b) => (a.elapsedMs ?? 0) - (b.elapsedMs ?? 0));
    for (const e of correct) {
      const col = this.column(this.columnIdOf(e.player));
      const block: TowerBlock = {
        id: ++this.seq,
        playerId: e.player.id,
        playerName: e.player.name,
        // Небольшое случайное смещение ±4px — башня выглядит живой, а не линейкой
        offset: Math.round(Math.random() * 8 - 4),
        hue: Math.round(Math.random() * 24 - 12),
      };
      col.blocks.push(block);
      this.contributions.set(e.player.id, (this.contributions.get(e.player.id) ?? 0) + 1);
      added.push({ columnId: col.id, blockId: block.id, playerName: e.player.name });
    }

    let monster: TowerEvent['monster'];
    if (this.round % this.game.settings.monsterEvery === 0) {
      const all = [...this.columns.values()];
      const max = Math.max(0, ...all.map((c) => c.blocks.length));
      if (max >= 3) {
        const leaders = all.filter((c) => c.blocks.length === max);
        const target = leaders[Math.floor(Math.random() * leaders.length)]!;
        const k = Math.min(Math.random() < 0.5 ? 2 : 3, target.blocks.length - 1);
        const removed = target.blocks.splice(target.blocks.length - k, k);
        monster = { columnId: target.id, removed };
      }
    }
    this.lastEvent = { round: this.round, added, monster };
    if (monster) return PHASE_MS.towerMonsterEvent;
    return added.length ? PHASE_MS.towerEvent : 2600;
  }

  endEvent(): void {}

  isOver(): boolean {
    return false;
  }

  private sortedColumns(): Column[] {
    return [...this.columns.values()].sort((a, b) => b.blocks.length - a.blocks.length);
  }

  state(): TowerState {
    const teamMode = this.game.settings.teamMode;
    const describe = (c: Column) => {
      if (teamMode) {
        const t = this.game.teams[Number(c.id.slice(1))]!;
        return { id: c.id, name: t.name, color: t.color, emblem: t.emblem, blocks: c.blocks };
      }
      const p = this.game.players.get(c.id.slice(1));
      return { id: c.id, name: p?.name ?? '—', color: p?.color ?? '#888', avatar: p?.avatar, blocks: c.blocks };
    };
    let columns: Column[];
    let others: Column[] = [];
    if (teamMode) {
      columns = this.game.teams.map((t) => this.column(`t${t.id}`));
    } else {
      // При 15–20 игроках колонок слишком много: показываем топ-6, остальных списком
      const sorted = this.sortedColumns().filter((c) => this.game.players.has(c.id.slice(1)));
      const top = sorted.slice(0, TOP_COLUMNS);
      // Порядок колонок стабилен — по времени подключения, а не по высоте
      columns = top.sort((a, b) => (this.game.players.get(a.id.slice(1))?.joinedAt ?? 0) - (this.game.players.get(b.id.slice(1))?.joinedAt ?? 0));
      others = sorted.slice(TOP_COLUMNS);
    }
    const rounds = this.game.settings.monsterEvery;
    return {
      kind: 'tower',
      columns: columns.map(describe),
      others: others.map((c) => {
        const d = describe(c);
        return { id: d.id, name: d.name, height: c.blocks.length, color: d.color };
      }),
      lastEvent: this.lastEvent,
      monsterEvery: rounds,
      roundsUntilMonster: rounds - (this.round % rounds),
      contributions: Object.fromEntries(this.contributions),
    };
  }

  playerExtras(p: Player): Partial<PlayerView> {
    const col = this.column(this.columnIdOf(p));
    const name = this.game.settings.teamMode ? (this.game.teams[p.teamId ?? 0]?.name ?? '') : 'Моя башня';
    return { tower: { height: col.blocks.length, myBlocks: this.contributions.get(p.id) ?? 0, columnName: name } };
  }

  teamStandings(): TeamStanding[] {
    return this.game.teams
      .map((t) => ({
        teamId: t.id,
        name: t.name,
        color: t.color,
        emblem: t.emblem,
        value: this.column(`t${t.id}`).blocks.length,
        valueLabel: 'блоков',
        members: [...this.game.players.values()].filter((p) => p.teamId === t.id).length,
      }))
      .sort((a, b) => b.value - a.value);
  }

  modeValue(p: Player): number {
    return this.contributions.get(p.id) ?? 0;
  }

  summary(): ModeSummary {
    const best = [...this.game.players.values()].sort(
      (a, b) => (this.contributions.get(b.id) ?? 0) - (this.contributions.get(a.id) ?? 0),
    )[0];
    const n = best ? (this.contributions.get(best.id) ?? 0) : 0;
    const award = best && n > 0 ? { title: 'Лучший строитель', name: best.name, value: `${n} блок.` } : null;
    let line: string | null = null;
    if (this.game.settings.teamMode) {
      const top = this.teamStandings()[0];
      if (top) line = `Самая высокая башня — у команды «${top.name}»: ${top.value} блок.`;
    } else {
      const top = this.sortedColumns()[0];
      const p = top ? this.game.players.get(top.id.slice(1)) : undefined;
      if (top && p && top.blocks.length > 0) line = `Самая высокая башня — у игрока ${p.name}: ${top.blocks.length} блок.`;
    }
    return { modeAward: award, modeResultLine: line };
  }

  dispose(): void {}
}
