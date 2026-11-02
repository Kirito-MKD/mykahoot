import type { Game } from '../game/Game';
import type { ModeHandler } from '../game/types';
import { ClassicMode } from './classic';
import { EscapeMode } from './escape';
import { TerritoryMode } from './territory';
import { TowerMode } from './tower';

export function createMode(game: Game): ModeHandler {
  switch (game.settings.mode) {
    case 'territory':
      return new TerritoryMode(game);
    case 'tower':
      return new TowerMode(game);
    case 'escape':
      return new EscapeMode(game);
    default:
      return new ClassicMode(game);
  }
}
