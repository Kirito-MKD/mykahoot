import {
  PHASE_MS,
  TOWER_BLOCK_W,
  TOWER_FALL_RATIO,
  TOWER_PERFECT_RATIO,
  type Ack,
  type PlayerView, type TeamStanding, type TowerBlock, type TowerEvent, type TowerState } from '@viktorina/shared';
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

  private dropping: { endsAt: number; totalMs: number; pending: Set<string> } | null = null;
  private dropTimer: NodeJS.Timeout | null = null;

  /**
   * После верного ответа каждый сам ставит свой блок: блок качается над башней,
   * ученик нажимает — блок падает. Ровно — башня растёт, криво — блок срывается вниз.
   */
  beginEvent(outcome: RoundOutcome): number | null {
    this.round++;
    for (const p of this.game.players.values()) p.lastDrop = null;
    this.lastEvent = { round: this.round, added: [], fails: [] };
    const correct = outcome.entries
      .filter((e) => e.fullyCorrect)
      .sort((a, b) => (a.elapsedMs ?? 0) - (b.elapsedMs ?? 0));
    if (correct.length === 0) {
      // Блоков нет — сразу проверяем монстра и показываем башни
      return this.settle(true);
    }
    const totalMs = PHASE_MS.towerDrop;
    this.dropping = { endsAt: Date.now() + totalMs, totalMs, pending: new Set(correct.map((e) => e.player.id)) };
    this.dropTimer = setTimeout(() => this.autoDropAll(), totalMs);
    // Запас по времени: событие закончит сам режим через finishEventIn
    return totalMs + PHASE_MS.towerMonsterEvent + 4000;
  }

  private topOffset(col: Column): number {
    return col.blocks[col.blocks.length - 1]?.offset ?? 0;
  }

  drop(p: Player, rel: number): Ack<{ result: 'perfect' | 'ok' | 'fail' }> {
    if (!this.dropping || !this.dropping.pending.has(p.id)) return { ok: false, error: 'Сейчас нечего ставить' };
    const result = this.placeBlock(p, rel);
    this.game.broadcast();
    if (this.dropping && this.dropping.pending.size === 0) this.finishDropping();
    return { ok: true, data: { result } };
  }

  private placeBlock(p: Player, relRaw: number): 'perfect' | 'ok' | 'fail' {
    this.dropping?.pending.delete(p.id);
    const rel = Math.max(-1.5, Math.min(1.5, relRaw));
    const col = this.column(this.columnIdOf(p));
    const base = this.topOffset(col);
    const hue = Math.round(Math.random() * 24 - 12);
    if (Math.abs(rel) > TOWER_FALL_RATIO) {
      this.lastEvent!.fails.push({ id: ++this.seq, columnId: col.id, playerName: p.name, offset: base + rel * TOWER_BLOCK_W, hue });
      p.lastDrop = 'fail';
      return 'fail';
    }
    const perfect = Math.abs(rel) < TOWER_PERFECT_RATIO;
    // Сдвиг копится от блока к блоку — башня может накрениться, но не улететь с платформы
    const offset = Math.round(Math.max(-70, Math.min(70, perfect ? base : base + rel * TOWER_BLOCK_W)));
    const block: TowerBlock = { id: ++this.seq, playerId: p.id, playerName: p.name, offset, hue };
    col.blocks.push(block);
    this.contributions.set(p.id, (this.contributions.get(p.id) ?? 0) + 1);
    this.lastEvent!.added.push({ columnId: col.id, blockId: block.id, playerName: p.name, perfect });
    p.lastDrop = perfect ? 'perfect' : 'ok';
    return p.lastDrop;
  }

  /** Время вышло — кто не успел, за того блок ставится сам, чуть криво (но не падает) */
  private autoDropAll(): void {
    if (!this.dropping) return;
    for (const id of [...this.dropping.pending]) {
      const p = this.game.players.get(id);
      if (p) this.placeBlock(p, Math.random() * 0.5 - 0.25);
    }
    this.finishDropping();
  }

  private finishDropping(): void {
    if (this.dropTimer) clearTimeout(this.dropTimer);
    this.dropTimer = null;
    this.dropping = null;
    const ms = this.settle(false);
    this.game.broadcast();
    this.game.finishEventIn(ms ?? PHASE_MS.towerSettle);
  }

  /** Монстр раз в N раундов сносит 2–3 верхних блока у лидера. Возвращает, сколько показывать сцену. */
  private settle(initial: boolean): number {
    let monster: TowerEvent['monster'];
    if (this.round % this.game.settings.monsterEvery === 0) {
      const all = [...this.columns.values()];
      const max = Math.max(0, ...all.map((c) => c.blocks.length));
      if (max >= 3) {
        const leaders = all.filter((c) => c.blocks.length === max);
        const target = leaders[Math.floor(Math.random() * leaders.length)]!;
        const k = Math.min(Math.random() < 0.5 ? 2 : 3, target.blocks.length - 1);
        monster = { columnId: target.id, removed: target.blocks.splice(target.blocks.length - k, k) };
      }
    }
    if (this.lastEvent) this.lastEvent.monster = monster;
    if (monster) return PHASE_MS.towerMonsterEvent;
    return initial ? 2600 : PHASE_MS.towerSettle;
  }

  endEvent(): void {
    // Преподаватель пропустил расстановку — ставим оставшиеся блоки сами
    if (this.dropping) {
      if (this.dropTimer) clearTimeout(this.dropTimer);
      this.dropTimer = null;
      for (const id of [...this.dropping.pending]) {
        const p = this.game.players.get(id);
        if (p) this.placeBlock(p, Math.random() * 0.5 - 0.25);
      }
      this.dropping = null;
      this.settle(false);
    }
  }

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
      dropping: this.dropping
        ? { endsAt: this.dropping.endsAt, totalMs: this.dropping.totalMs, pending: [...this.dropping.pending] }
        : null,
      monsterEvery: rounds,
      roundsUntilMonster: rounds - (this.round % rounds),
      contributions: Object.fromEntries(this.contributions),
    };
  }

  playerExtras(p: Player): Partial<PlayerView> {
    const col = this.column(this.columnIdOf(p));
    const team = this.game.settings.teamMode ? this.game.teams[p.teamId ?? 0] : null;
    return {
      tower: {
        height: col.blocks.length,
        myBlocks: this.contributions.get(p.id) ?? 0,
        columnName: team?.name ?? 'Моя башня',
        color: team?.color ?? p.color,
        top: col.blocks.slice(-6).map((b) => ({ offset: b.offset, hue: b.hue, playerName: b.playerName })),
        canDrop: !!this.dropping?.pending.has(p.id),
        dropEndsAt: this.dropping?.endsAt ?? null,
        dropTotalMs: this.dropping?.totalMs ?? PHASE_MS.towerDrop,
        lastDrop: p.lastDrop,
      },
    };
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

  dispose(): void {
    if (this.dropTimer) clearTimeout(this.dropTimer);
  }
}
