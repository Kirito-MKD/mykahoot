import { avatarSchema, gameSettingsSchema, REACTIONS, type Ack } from '@viktorina/shared';
import type { Socket } from 'socket.io';
import { z } from 'zod';
import { getQuiz } from './db';
import type { Game, IO } from './game/Game';
import type { GameManager } from './game/manager';
import type { Player } from './game/Player';
import { checkName } from './moderation';

interface SocketData {
  role?: 'host' | 'player';
  gameId?: string;
  playerId?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sock = Socket<any, any, any, SocketData>;

const joinSchema = z.object({
  code: z.string().trim().min(3).max(4),
  name: z.string(),
  avatar: avatarSchema,
  token: z.string().optional(),
});

/** Безопасный вызов колбэка: клиент мог не передать функцию */
function reply<T>(cb: unknown, res: Ack<T>): void {
  if (typeof cb === 'function') (cb as (r: Ack<T>) => void)(res);
}

export function registerSockets(io: IO, manager: GameManager): void {
  io.on('connection', (rawSocket) => {
    const socket = rawSocket as unknown as Sock;
    const data = socket.data as SocketData;

    const currentGame = (): Game | null => (data.gameId ? (manager.games.get(data.gameId) ?? null) : null);
    const currentPlayer = (): { game: Game; player: Player } | null => {
      const g = currentGame();
      if (!g || data.role !== 'player' || !data.playerId) return null;
      const p = g.players.get(data.playerId);
      return p ? { game: g, player: p } : null;
    };
    const hostGame = (): Game | null => {
      const g = currentGame();
      return g && data.role === 'host' && g.hostSocketId === socket.id ? g : null;
    };

    const attachPlayer = (game: Game, player: Player) => {
      // Один игрок — одна вкладка: старое соединение отключаем от комнаты
      if (player.socketId && player.socketId !== socket.id) {
        const old = io.sockets.sockets.get(player.socketId);
        old?.leave(game.playersRoom);
      }
      data.role = 'player';
      data.gameId = game.id;
      data.playerId = player.id;
      socket.join(game.playersRoom);
      game.playerConnected(player, socket.id);
    };

    // ─────────── Список игр для страницы ученика ───────────
    socket.on('games:subscribe', () => {
      socket.join('watchers');
      socket.emit('games:list', manager.listings());
    });

    socket.on('name:check', (name: unknown, cb: unknown) => {
      const res = checkName(String(name ?? ''));
      reply(cb, res.ok ? { ok: true } : { ok: false, error: res.error });
    });

    // ─────────── Ученик ───────────
    socket.on('player:join', (payload: unknown, cb: unknown) => {
      const parsed = joinSchema.safeParse(payload);
      if (!parsed.success) return reply(cb, { ok: false, error: 'Не получилось войти. Обнови страницу и попробуй ещё раз' });
      const { code, avatar, token } = parsed.data;
      const game = manager.byCode(code);
      if (!game || game.phase === 'finished') return reply(cb, { ok: false, error: 'Игра с таким кодом не найдена' });
      // Вернулся тот же ученик (например, после перезагрузки) — продолжаем с тем же счётом
      if (token) {
        if (game.kickedTokens.has(token)) return reply(cb, { ok: false, error: 'Преподаватель убрал тебя из этой игры' });
        const existing = game.findByToken(token);
        if (existing) {
          attachPlayer(game, existing);
          return reply(cb, { ok: true, data: { token: existing.token, gameId: game.id } });
        }
      }
      const name = checkName(parsed.data.name);
      if (!name.ok) return reply(cb, { ok: false, error: name.error });
      if (game.players.size >= 60) return reply(cb, { ok: false, error: 'В игре уже слишком много участников' });
      const player = game.addPlayer(name.name, avatar);
      attachPlayer(game, player);
      game.broadcast();
      reply(cb, { ok: true, data: { token: player.token, gameId: game.id } });
    });

    socket.on('player:resume', (payload: unknown, cb: unknown) => {
      const token = z.object({ token: z.string() }).safeParse(payload);
      if (!token.success) return reply(cb, { ok: false, error: 'Нет токена' });
      const found = manager.findPlayer(token.data.token);
      if (!found) return reply(cb, { ok: false, error: 'Игра уже закончилась' });
      attachPlayer(found.game, found.player);
      reply(cb, { ok: true, data: { gameId: found.game.id } });
    });

    socket.on('player:profile', (payload: unknown, cb: unknown) => {
      const ctx = currentPlayer();
      if (!ctx) return reply(cb, { ok: false, error: 'Ты не в игре' });
      const parsed = z.object({ name: z.string(), avatar: avatarSchema }).safeParse(payload);
      if (!parsed.success) return reply(cb, { ok: false, error: 'Неверные данные' });
      const name = checkName(parsed.data.name);
      if (!name.ok) return reply(cb, { ok: false, error: name.error });
      ctx.game.updateProfile(ctx.player, name.name, parsed.data.avatar);
      reply(cb, { ok: true });
    });

    socket.on('player:answer', (payload: unknown, cb: unknown) => {
      const ctx = currentPlayer();
      if (!ctx) return reply(cb, { ok: false, error: 'Ты не в игре' });
      const parsed = z.object({ questionIndex: z.number().int(), choices: z.array(z.number().int()).max(4) }).safeParse(payload);
      if (!parsed.success) return reply(cb, { ok: false, error: 'Неверный ответ' });
      const res = ctx.game.answer(ctx.player, parsed.data.questionIndex, parsed.data.choices);
      if (res.ok) ctx.game.sendPlayer(ctx.player);
      reply(cb, res);
    });

    socket.on('player:react', (payload: unknown, cb: unknown) => {
      const ctx = currentPlayer();
      if (!ctx) return reply(cb, { ok: false, error: 'Ты не в игре' });
      const parsed = z.object({ emoji: z.enum(REACTIONS) }).safeParse(payload);
      if (!parsed.success) return reply(cb, { ok: false, error: 'Неизвестная реакция' });
      reply(cb, ctx.game.react(ctx.player, parsed.data.emoji));
    });

    socket.on('player:place', (payload: unknown, cb: unknown) => {
      const ctx = currentPlayer();
      if (!ctx) return reply(cb, { ok: false, error: 'Ты не в игре' });
      const parsed = z.object({ cell: z.number().int().min(0) }).safeParse(payload);
      if (!parsed.success) return reply(cb, { ok: false, error: 'Неверная клетка' });
      reply(cb, ctx.game.place(ctx.player, parsed.data.cell));
    });

    socket.on('player:leave', () => {
      const ctx = currentPlayer();
      if (!ctx) return;
      socket.leave(ctx.game.playersRoom);
      if (ctx.game.phase === 'lobby') ctx.game.removePlayer(ctx.player.id);
      else ctx.game.playerDisconnected(ctx.player);
      data.gameId = undefined;
      data.playerId = undefined;
      data.role = undefined;
    });

    // ─────────── Преподаватель ───────────
    socket.on('host:create', (payload: unknown, cb: unknown) => {
      const parsed = z.object({ quizId: z.string(), settings: gameSettingsSchema }).safeParse(payload);
      if (!parsed.success) return reply(cb, { ok: false, error: 'Неверные настройки игры' });
      const quiz = getQuiz(parsed.data.quizId);
      if (!quiz) return reply(cb, { ok: false, error: 'Тест не найден' });
      const game = manager.create(quiz, parsed.data.settings);
      data.role = 'host';
      data.gameId = game.id;
      socket.join(game.hostRoom);
      game.hostAttached(socket.id);
      reply(cb, { ok: true, data: { gameId: game.id, hostToken: game.hostToken } });
    });

    socket.on('host:resume', (payload: unknown, cb: unknown) => {
      const parsed = z.object({ hostToken: z.string() }).safeParse(payload);
      if (!parsed.success) return reply(cb, { ok: false, error: 'Нет токена' });
      const game = manager.byHostToken(parsed.data.hostToken);
      if (!game) return reply(cb, { ok: false, error: 'Игра уже закрыта' });
      if (game.hostSocketId && game.hostSocketId !== socket.id) {
        io.sockets.sockets.get(game.hostSocketId)?.leave(game.hostRoom);
      }
      data.role = 'host';
      data.gameId = game.id;
      socket.join(game.hostRoom);
      game.hostAttached(socket.id);
      reply(cb, { ok: true, data: { gameId: game.id } });
    });

    const hostAction = (event: string, fn: (g: Game, payload: unknown) => Ack) => {
      socket.on(event as 'host:start', (...args: unknown[]) => {
        const cb = args[args.length - 1];
        const payload = args.length > 1 ? args[0] : undefined;
        const g = hostGame();
        if (!g) return reply(cb, { ok: false, error: 'Игра не найдена — обнови страницу' });
        reply(cb, fn(g, payload));
      });
    };

    hostAction('host:start', (g) => g.start());
    hostAction('host:next', (g) => g.next());
    hostAction('host:skip', (g) => g.skip());
    hostAction('host:end', (g) => g.end());
    hostAction('host:close', (g) => {
      g.close('Игра завершена.');
      return { ok: true };
    });
    hostAction('host:kick', (g, payload) => {
      const parsed = z.object({ playerId: z.string() }).safeParse(payload);
      if (!parsed.success) return { ok: false, error: 'Нет игрока' };
      const p = g.players.get(parsed.data.playerId);
      if (!p) return { ok: false, error: 'Игрок не найден' };
      if (p.socketId) {
        io.to(p.socketId).emit('player:kicked');
        io.sockets.sockets.get(p.socketId)?.leave(g.playersRoom);
      }
      g.removePlayer(p.id);
      return { ok: true };
    });
    hostAction('host:teams', (g, payload) => {
      const parsed = z.object({ names: z.array(z.string()).max(4) }).safeParse(payload);
      if (!parsed.success) return { ok: false, error: 'Неверные названия' };
      if (g.phase !== 'lobby') return { ok: false, error: 'Команды можно переименовать только до старта' };
      g.setTeamNames(parsed.data.names);
      return { ok: true };
    });

    socket.on('disconnect', () => {
      const g = currentGame();
      if (!g) return;
      if (data.role === 'host') g.hostDetached(socket.id);
      if (data.role === 'player' && data.playerId) {
        const p = g.players.get(data.playerId);
        if (p && p.socketId === socket.id) g.playerDisconnected(p);
      }
    });
  });
}
