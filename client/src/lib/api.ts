import type { GameResults, QuizSummary, ServerInfo, StoredQuiz } from '@viktorina/shared';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Ошибка сервера (${res.status})`;
    try {
      const body = await res.json();
      msg = body.error ?? body.errors?.join('\n') ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export interface HistoryItem {
  id: string;
  quizTitle: string;
  mode: string;
  teamMode: boolean;
  startedAt: number;
  finishedAt: number;
  playersCount: number;
}

export const api = {
  serverInfo: () => fetch('/api/server-info').then((r) => json<ServerInfo>(r)),
  quizzes: () => fetch('/api/quizzes').then((r) => json<QuizSummary[]>(r)),
  quiz: (id: string) => fetch(`/api/quizzes/${id}`).then((r) => json<StoredQuiz>(r)),
  deleteQuiz: (id: string) => fetch(`/api/quizzes/${id}`, { method: 'DELETE' }).then((r) => json<{ ok: boolean }>(r)),
  history: () => fetch('/api/history').then((r) => json<HistoryItem[]>(r)),
  historyItem: (id: string) => fetch(`/api/history/${id}`).then((r) => json<GameResults>(r)),
  deleteHistory: (id: string) => fetch(`/api/history/${id}`, { method: 'DELETE' }).then((r) => json<{ ok: boolean }>(r)),
  csvUrl: (id: string) => `/api/history/${id}/csv`,
  async saveQuiz(form: FormData): Promise<{ ok: true; id: string } | { ok: false; errors: string[] }> {
    const res = await fetch('/api/quizzes', { method: 'POST', body: form });
    const body = await res.json().catch(() => ({ errors: ['Сервер вернул непонятный ответ'] }));
    if (!res.ok) return { ok: false, errors: body.errors ?? ['Не удалось сохранить тест'] };
    return { ok: true, id: body.id };
  },
};
