import { create } from 'zustand';
import type { Avatar, GameListing, PlayerView, TerritoryCell } from '@viktorina/shared';
import { KEYS, load, save } from '../lib/storage';

export interface Profile {
  name: string;
  avatar: Avatar;
}

interface PlayerStore {
  connected: boolean;
  games: GameListing[];
  gamesLoaded: boolean;
  view: PlayerView | null;
  answers: { count: number; total: number } | null;
  notice: string | null;
  profile: Profile | null;
  token: string | null;
  setConnected: (v: boolean) => void;
  setGames: (g: GameListing[]) => void;
  setView: (v: PlayerView | null) => void;
  setAnswers: (a: { count: number; total: number }) => void;
  patchCell: (cell: TerritoryCell, flags: Record<string, number>) => void;
  setNotice: (n: string | null) => void;
  setProfile: (p: Profile) => void;
  setToken: (t: string | null) => void;
}

export const usePlayer = create<PlayerStore>((set) => ({
  connected: false,
  games: [],
  gamesLoaded: false,
  view: null,
  answers: null,
  notice: null,
  profile: load<Profile | null>(KEYS.profile, null),
  token: load<string | null>(KEYS.playerToken, null),
  setConnected: (connected) => set({ connected }),
  setGames: (games) => set({ games, gamesLoaded: true }),
  setView: (view) => set({ view }),
  setAnswers: (answers) => set({ answers }),
  patchCell: (cell, flags) =>
    set((s) => {
      if (!s.view?.territory) return s;
      const cells = s.view.territory.cells.slice();
      cells[cell.i] = cell;
      const myFlags = flags[s.view.me.id] ?? s.view.me.flags;
      return { view: { ...s.view, me: { ...s.view.me, flags: myFlags }, territory: { ...s.view.territory, cells, flags } } };
    }),
  setNotice: (notice) => set({ notice }),
  setProfile: (profile) => {
    save(KEYS.profile, profile);
    set({ profile });
  },
  setToken: (token) => {
    save(KEYS.playerToken, token);
    set({ token });
  },
}));
