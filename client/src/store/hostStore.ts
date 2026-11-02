import { create } from 'zustand';
import type { Avatar, EmoteId, HostView, ReactionEmoji, ServerInfo, TerritoryCell } from '@viktorina/shared';

export interface FloatingReaction {
  id: number;
  emoji: ReactionEmoji;
  name: string;
  avatar: Avatar;
  color: string;
  x: number;
}

interface HostStore {
  connected: boolean;
  view: HostView | null;
  answers: { count: number; total: number } | null;
  reactions: FloatingReaction[];
  info: ServerInfo | null;
  caughtTick: { playerId: string; at: number } | null;
  emotes: Record<string, { emote: EmoteId; at: number }>;
  setEmote: (playerId: string, emote: EmoteId) => void;
  setConnected: (v: boolean) => void;
  setView: (v: HostView | null) => void;
  setAnswers: (a: { count: number; total: number }) => void;
  addReaction: (r: Omit<FloatingReaction, 'id' | 'x'>) => void;
  removeReaction: (id: number) => void;
  setInfo: (i: ServerInfo) => void;
  patchCell: (cell: TerritoryCell, flags: Record<string, number>, captured: Record<string, number>) => void;
  setCaught: (playerId: string) => void;
}

let rid = 0;

export const useHost = create<HostStore>((set) => ({
  connected: false,
  view: null,
  answers: null,
  reactions: [],
  info: null,
  caughtTick: null,
  emotes: {},
  setEmote: (playerId, emote) => set((s) => ({ emotes: { ...s.emotes, [playerId]: { emote, at: Date.now() } } })),
  setConnected: (connected) => set({ connected }),
  setView: (view) => set({ view }),
  setAnswers: (answers) => set({ answers }),
  addReaction: (r) =>
    set((s) => ({
      // При потоке реакций держим не больше 40 одновременно
      reactions: [...s.reactions.slice(-39), { ...r, id: ++rid, x: 4 + Math.random() * 22 }],
    })),
  removeReaction: (id) => set((s) => ({ reactions: s.reactions.filter((r) => r.id !== id) })),
  setInfo: (info) => set({ info }),
  patchCell: (cell, flags, captured) =>
    set((s) => {
      if (!s.view || s.view.mode.kind !== 'territory') return s;
      const cells = s.view.mode.cells.slice();
      cells[cell.i] = cell;
      return { view: { ...s.view, mode: { ...s.view.mode, cells, flags, captured } } };
    }),
  setCaught: (playerId) => set({ caughtTick: { playerId, at: Date.now() } }),
}));
