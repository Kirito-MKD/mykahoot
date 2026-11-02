import { MODE_INFO, type GameResults } from '@viktorina/shared';

/** UTF-8 BOM — без него Excel на Windows показывает кракозябры вместо русских букв */
const BOM = '﻿';
const SEP = ';';

function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  let s = typeof v === 'number' ? formatNumber(v) : String(v);
  // Защита от CSV-инъекций формул в Excel
  if (/^[=+\-@\t\r]/.test(s) && typeof v !== 'number') s = "'" + s;
  if (/[";\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** Русская локаль Excel ждёт десятичную запятую */
function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}

function row(values: (string | number | null | undefined)[]): string {
  return values.map(cell).join(SEP);
}

function seconds(ms: number | null): number | null {
  return ms === null ? null : Math.round(ms / 100) / 10;
}

export function resultsToCsv(r: GameResults): string {
  const lines: string[] = [];
  const date = new Date(r.startedAt).toLocaleString('ru-RU');
  lines.push(row(['Тест', r.quizTitle]));
  lines.push(row(['Режим', MODE_INFO[r.mode].title + (r.teamMode ? ' (командная игра)' : ' (каждый сам за себя)')]));
  lines.push(row(['Дата', date]));
  lines.push(row(['Участников', r.players.length]));
  lines.push('');
  lines.push(row(['УЧЕНИКИ']));
  lines.push(
    row(['Место', 'Имя', 'Команда', 'Итоговый счёт', 'Верных ответов', 'Неверных', 'Без ответа', 'Процент верных', 'Самая длинная серия', 'Среднее время ответа, с']),
  );
  for (const p of r.players) {
    lines.push(
      row([p.rank, p.name, p.teamName ?? '—', p.score, p.correct, p.wrong, p.unanswered, p.percent, p.bestStreak, seconds(p.avgTimeMs)]),
    );
  }
  lines.push('');
  lines.push(row(['ВОПРОСЫ']));
  lines.push(row(['№', 'Вопрос', 'Ответили верно', 'Ответили неверно', 'Не ответили', 'Процент верных', 'Среднее время ответа, с']));
  for (const q of r.questions) {
    lines.push(row([q.index + 1, q.text, q.correct, q.wrong, q.unanswered, q.percent, seconds(q.avgTimeMs)]));
  }
  return BOM + lines.join('\r\n') + '\r\n';
}

export function csvFileName(r: GameResults): string {
  const d = new Date(r.startedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
  const safeTitle = r.quizTitle.replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || 'Результаты';
  return `${safeTitle}_${stamp}.csv`;
}
