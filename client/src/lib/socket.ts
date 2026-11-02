import { io, type Socket } from 'socket.io-client';
import type { Ack, ClientToServerEvents, ServerToClientEvents } from '@viktorina/shared';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!socket) {
    socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    });
  }
  return socket;
}

/** Отправка события с подтверждением и таймаутом */
export function request<T = undefined>(event: keyof ClientToServerEvents, ...args: unknown[]): Promise<Ack<T>> {
  const s = getSocket();
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve({ ok: false, error: 'Нет связи с сервером. Проверь подключение к сети.' });
    }, 8000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s.emit as any)(event, ...args, (res: Ack<T>) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(res);
    });
  });
}
