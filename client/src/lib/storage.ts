/** localStorage с защитой от исключений (приватный режим, запрет хранилища) */
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* хранилище недоступно — работаем без него */
  }
}

export const KEYS = {
  profile: 'viktorina.profile',
  playerToken: 'viktorina.playerToken',
  hostToken: 'viktorina.hostToken',
  muted: 'viktorina.muted',
  lastSettings: 'viktorina.lastSettings',
} as const;
