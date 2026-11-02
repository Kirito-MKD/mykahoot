/**
 * Автоматическая привязка загруженных картинок к вопросам.
 * Правила (по порядку):
 *  1. Явное поле "image": "вопрос3.png" — ищем файл с таким именем.
 *  2. Номер в имени файла: 3.png, вопрос3.jpg, q3.png, 03.png → вопрос №3.
 *  3. По порядку: если номеров в именах нет, а картинок ровно столько же,
 *     сколько вопросов с "image": true, — раскладываем в порядке сортировки имён.
 */

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'] as const;

export function isImageName(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return (IMAGE_EXTENSIONS as readonly string[]).includes(ext);
}

export function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function stem(name: string): string {
  const b = baseName(name);
  const dot = b.lastIndexOf('.');
  return dot > 0 ? b.slice(0, dot) : b;
}

function norm(s: string): string {
  return s.normalize('NFC').toLowerCase().trim();
}

/** Первое число из имени файла (без расширения) */
export function numberFromName(name: string): number | null {
  const m = stem(name).match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

export type MatchReason = 'explicit' | 'number' | 'order';

export interface MatchInputQuestion {
  image?: string | boolean | null;
}

export interface MatchResult {
  /** Для каждого вопроса — имя привязанного файла или null */
  assignments: (string | null)[];
  reasons: (MatchReason | null)[];
  /** Файлы, которые никуда не легли */
  unassigned: string[];
}

export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, 'ru', { numeric: true, sensitivity: 'base' });
}

export function matchImages(questions: MatchInputQuestion[], fileNames: string[]): MatchResult {
  const files = [...fileNames].sort((a, b) => naturalCompare(baseName(a), baseName(b)));
  const used = new Set<string>();
  const assignments: (string | null)[] = questions.map(() => null);
  const reasons: (MatchReason | null)[] = questions.map(() => null);

  // 1. Явное имя
  questions.forEach((q, i) => {
    if (typeof q.image !== 'string' || !q.image.trim()) return;
    const want = norm(baseName(q.image));
    let found = files.find((f) => !used.has(f) && norm(baseName(f)) === want);
    if (!found) {
      const wantStem = norm(stem(q.image));
      found = files.find((f) => !used.has(f) && norm(stem(f)) === wantStem);
    }
    if (found) {
      assignments[i] = found;
      reasons[i] = 'explicit';
      used.add(found);
    }
  });

  // 2. Номер в имени файла
  for (const f of files) {
    if (used.has(f)) continue;
    const n = numberFromName(f);
    if (n === null) continue;
    const idx = n - 1;
    if (idx < 0 || idx >= questions.length || assignments[idx] !== null) continue;
    assignments[idx] = f;
    reasons[idx] = 'number';
    used.add(f);
  }

  // 3. По порядку — только для файлов без номеров в имени
  const noNumber = files.filter((f) => !used.has(f) && numberFromName(f) === null);
  const waiting = questions
    .map((q, i) => ({ q, i }))
    .filter(({ q, i }) => q.image === true && assignments[i] === null)
    .map(({ i }) => i);
  if (noNumber.length > 0 && noNumber.length === waiting.length) {
    waiting.forEach((qi, k) => {
      const f = noNumber[k]!;
      assignments[qi] = f;
      reasons[qi] = 'order';
      used.add(f);
    });
  }

  return { assignments, reasons, unassigned: files.filter((f) => !used.has(f)) };
}
