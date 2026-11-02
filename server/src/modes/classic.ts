import type { ModeState, PlayerView, TeamStanding } from '@viktorina/shared';
import type { Game } from '../game/Game';
import type { Player } from '../game/Player';
import type { ModeHandler, ModeSummary } from '../game/types';

/** «Классика» — ядро движка без мини-игры */
export class ClassicMode implements ModeHandler {
  constructor(private readonly game: Game) {}
  init(): void {}
  onPlayerAdded(): void {}
  onPlayerRemoved(): void {}
  onPhase(): void {}
  beginEvent(): number | null {
    return null;
  }
  endEvent(): void {}
  isOver(): boolean {
    return false;
  }
  state(): ModeState {
    return { kind: 'classic' };
  }
  playerExtras(): Partial<PlayerView> {
    return {};
  }
  teamStandings(): TeamStanding[] {
    return this.game.averageScoreStandings();
  }
  modeValue(p: Player): number {
    return p.correctCount;
  }
  summary(): ModeSummary {
    return { modeAward: null, modeResultLine: null };
  }
  dispose(): void {}
}
