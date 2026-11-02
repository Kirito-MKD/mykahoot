import { z } from 'zod';
import { locateJsonError } from './jsonLocate';

/**
 * Формат теста, который загружает преподаватель (см. README).
 * Схема намеренно снисходительна к мелочам (строки "true"/"false", числа в кавычках,
 * отсутствующий type), но строга к смыслу: число вариантов и правильных ответов.
 */

export const QUESTION_TYPES = ['quiz', 'trueFalse', 'multiple'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  quiz: 'один правильный',
  trueFalse: 'правда или ложь',
  multiple: 'несколько правильных',
};

export const MAX_ANSWERS = 4;
export const MIN_TIME_LIMIT = 5;
export const MAX_TIME_LIMIT = 240;
export const DEFAULT_TIME_LIMIT = 20;

const boolish = z.preprocess((v) => {
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === 'да' || s === 'верно') return true;
    if (s === 'false' || s === 'нет' || s === 'неверно') return false;
  }
  if (v === 1) return true;
  if (v === 0) return false;
  return v;
}, z.boolean({
  required_error: 'не указано, верный ли это вариант. Добавь "correct": true или "correct": false',
  invalid_type_error: 'поле "correct" должно быть true или false',
}));

const numberish = (label: string) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : v),
    z.number({ invalid_type_error: `${label} должно быть числом` }),
  );

export const answerInputSchema = z.object({
  text: z.preprocess(
    (v) => (typeof v === 'number' ? String(v) : v),
    z
      .string({
        required_error: 'у варианта нет текста. Добавь поле "text"',
        invalid_type_error: 'текст варианта должен быть строкой в кавычках',
      })
      .trim()
      .min(1, 'текст варианта пустой')
      .max(150, 'текст варианта слишком длинный (больше 150 символов) — сократи его'),
  ),
  correct: boolish,
});

export const questionInputSchema = z
  .object({
    type: z.preprocess(
      (v) => (v === undefined || v === null || v === '' ? 'quiz' : v),
      z.enum(QUESTION_TYPES, {
        errorMap: (issue, ctx) => ({
          message:
            issue.code === 'invalid_enum_value'
              ? `неизвестный тип вопроса «${String(issue.received)}». Допустимы: quiz (один правильный), trueFalse (правда/ложь), multiple (несколько правильных)`
              : ctx.defaultError,
        }),
      }),
    ),
    question: z.preprocess(
      (v) => (typeof v === 'number' ? String(v) : v),
      z
        .string({
          required_error: 'нет текста вопроса. Добавь поле "question"',
          invalid_type_error: 'текст вопроса должен быть строкой в кавычках',
        })
        .trim()
        .min(1, 'текст вопроса пустой')
        .max(400, 'текст вопроса слишком длинный (больше 400 символов) — сократи его'),
    ),
    image: z
      .union([z.string().trim(), z.boolean()], {
        errorMap: () => ({ message: 'поле "image" должно быть именем файла (например "3.jpg") или true' }),
      })
      .optional()
      .nullable(),
    timeLimit: numberish('время на вопрос (timeLimit)')
      .pipe(
        z
          .number()
          .min(MIN_TIME_LIMIT, `время на вопрос меньше ${MIN_TIME_LIMIT} секунд — дети не успеют прочитать`)
          .max(MAX_TIME_LIMIT, `время на вопрос больше ${MAX_TIME_LIMIT} секунд — так долго ждать не стоит`),
      )
      .optional()
      .nullable(),
    points: numberish('множитель очков (points)')
      .pipe(z.number().min(0, 'множитель очков не может быть отрицательным').max(3, 'множитель очков — не больше 3'))
      .optional()
      .nullable(),
    answers: z
      .array(answerInputSchema, {
        required_error: 'нет вариантов ответа. Добавь список "answers"',
        invalid_type_error: 'варианты ответа ("answers") должны быть списком в квадратных скобках [ ]',
      }),
  })
  .superRefine((q, ctx) => {
    const n = q.answers.length;
    const correctCount = q.answers.filter((a) => a.correct).length;
    const add = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ['answers'] });

    if (n > MAX_ANSWERS) {
      add(`вариантов ответа ${n}, а можно не больше ${MAX_ANSWERS} — на экране всего четыре цветные кнопки. Убери лишние`);
      return;
    }
    if (q.type === 'trueFalse') {
      if (n !== 2) add(`у вопроса «правда или ложь» должно быть ровно два варианта, а указано ${n}. Либо оставь два варианта, либо смени тип на \`quiz\``);
      else if (correctCount !== 1) add(correctCount === 0
        ? 'не отмечен правильный вариант. Поставь "correct": true у верного'
        : 'оба варианта отмечены правильными, а в вопросе «правда или ложь» верный только один');
      return;
    }
    if (n < 2) {
      add(n === 0 ? 'нет ни одного варианта ответа' : 'всего один вариант ответа — нужно минимум два');
      return;
    }
    if (q.type === 'quiz') {
      if (correctCount === 0) add('не отмечен правильный ответ. Поставь "correct": true у верного варианта');
      else if (correctCount > 1)
        add(`указано ${countWord(correctCount)} правильных ответа, но тип вопроса «один правильный». Либо убери лишний \`correct: true\`, либо смени тип на \`multiple\``);
      return;
    }
    // multiple
    if (correctCount === 0) add('не отмечен ни один правильный ответ. Поставь "correct": true у верных вариантов');
    else if (correctCount > 3) add('отмечены правильными больше трёх вариантов — в вопросе с несколькими ответами верных может быть от одного до трёх');
    else if (correctCount === n) add('все варианты отмечены правильными — тогда вопрос ничего не проверяет. Оставь хотя бы один неверный');
  });

export const quizInputSchema = z.object({
  title: z
    .string({
      required_error: 'не указано название теста. Добавь в начало поле "title": "Название"',
      invalid_type_error: 'название теста ("title") должно быть строкой в кавычках',
    })
    .trim()
    .min(1, 'название теста пустое')
    .max(120, 'название теста слишком длинное — до 120 символов'),
  description: z
    .string({ invalid_type_error: 'описание ("description") должно быть строкой в кавычках' })
    .trim()
    .max(300, 'описание слишком длинное — до 300 символов')
    .optional()
    .nullable(),
  defaultTimeLimit: numberish('время по умолчанию (defaultTimeLimit)')
    .pipe(z.number().min(MIN_TIME_LIMIT, `время по умолчанию меньше ${MIN_TIME_LIMIT} секунд`).max(MAX_TIME_LIMIT, `время по умолчанию больше ${MAX_TIME_LIMIT} секунд`))
    .optional()
    .nullable(),
  questions: z
    .array(questionInputSchema, {
      required_error: 'в тесте нет вопросов. Добавь список "questions"',
      invalid_type_error: 'вопросы ("questions") должны быть списком в квадратных скобках [ ]',
    })
    .min(1, 'в тесте нет ни одного вопроса')
    .max(200, 'слишком много вопросов — не больше 200 в одном тесте'),
});

export type QuizInput = z.infer<typeof quizInputSchema>;
export type QuestionInput = z.infer<typeof questionInputSchema>;

/** Вопрос в сохранённом тесте */
export interface QuizQuestion {
  type: QuestionType;
  question: string;
  imageUrl?: string;
  timeLimit: number;
  points: number;
  answers: { text: string; correct: boolean }[];
}

export interface StoredQuiz {
  id: string;
  title: string;
  description: string;
  createdAt: number;
  questions: QuizQuestion[];
}

export interface QuizSummary {
  id: string;
  title: string;
  description: string;
  createdAt: number;
  questionCount: number;
  imageCount: number;
  coverUrl?: string;
}

function countWord(n: number): string {
  return ['ноль', 'один', 'два', 'три', 'четыре'][n] ?? String(n);
}

// ───────────────────────── Разбор и человеческие ошибки ─────────────────────────

export interface QuizParseResult {
  ok: boolean;
  quiz?: QuizInput;
  errors: string[];
}

/** Убирает markdown-обёртку ```json ... ``` и текст вокруг JSON — нейросети часто так отвечают */
export function extractJsonText(raw: string): string {
  let s = raw.replace(/^﻿/, '').trim();
  const fence = s.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1]!.trim();
  if (!s.startsWith('{')) {
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first !== -1 && last > first) s = s.slice(first, last + 1);
  }
  // «Умные» кавычки из текстовых редакторов
  s = s.replace(/[“”„«»]/g, (m) => (m === '«' || m === '»' ? m : '"'));
  return s;
}

function lineCol(text: string, pos: number): { line: number; col: number } {
  const before = text.slice(0, pos);
  const line = before.split('\n').length;
  const col = pos - before.lastIndexOf('\n');
  return { line, col };
}

export function describeJsonSyntaxError(text: string): string {
  const loc = locateJsonError(text);
  if (!loc) return 'Это не похоже на правильный JSON. Проверь, что текст начинается с { и заканчивается }.';
  const { line, col } = lineCol(text, loc.pos);
  const where = ` (строка ${line}, символ ${col})`;
  switch (loc.reason) {
    case 'unexpectedEnd':
      return `Текст обрывается на середине${where}. Похоже, скопирован не весь ответ нейросети — проверь, что в конце есть закрывающая фигурная скобка }.`;
    case 'trailingComma':
      return `Лишняя запятая перед закрывающей скобкой${where}. Удали её.`;
    case 'missingComma':
      return `Пропущена запятая между элементами${where}.`;
    case 'unclosedString':
      return `Не закрыта кавычка${where}. У каждого текста должны быть кавычки и в начале, и в конце.`;
    case 'singleQuote':
      return `Текст взят в одинарные кавычки ' '${where}, а в JSON нужны двойные " ".`;
    default:
      return `Это не похоже на правильный JSON${where}. Частые причины: лишняя запятая, пропущенная запятая, незакрытая кавычка.`;
  }
}

export function formatIssuePath(path: (string | number)[]): string {
  const parts: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    if (p === 'questions' && typeof path[i + 1] === 'number') {
      parts.push(`Вопрос ${(path[i + 1] as number) + 1}`);
      i++;
    } else if (p === 'answers' && typeof path[i + 1] === 'number') {
      parts.push(`вариант ${(path[i + 1] as number) + 1}`);
      i++;
    }
  }
  return parts.join(', ');
}

export function formatZodIssues(issues: z.ZodIssue[], limit = 25): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const issue of issues) {
    let message = issue.message;
    if (issue.code === 'invalid_type' && issue.received === 'undefined' && /^Required$/i.test(message)) {
      const field = String(issue.path[issue.path.length - 1] ?? '');
      message = `не хватает поля "${field}"`;
    } else if (issue.code === 'invalid_type' && /^Expected/.test(message)) {
      const field = String(issue.path[issue.path.length - 1] ?? '');
      message = `поле "${field}" записано в неверном виде`;
    }
    const prefix = formatIssuePath(issue.path);
    const line = prefix ? `${prefix}: ${message}.` : capitalize(message) + '.';
    const clean = line.replace(/\.\.$/, '.');
    if (!seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
    if (out.length >= limit) break;
  }
  return out;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function validateQuizObject(data: unknown): QuizParseResult {
  if (Array.isArray(data)) {
    // Нейросеть иногда отдаёт просто список вопросов — завернём его сами
    data = { title: 'Тест без названия', questions: data };
  }
  if (typeof data !== 'object' || data === null) {
    return { ok: false, errors: ['Внутри файла должен быть объект в фигурных скобках { … } с полями "title" и "questions".'] };
  }
  const res = quizInputSchema.safeParse(data);
  if (res.success) return { ok: true, quiz: res.data, errors: [] };
  return { ok: false, errors: formatZodIssues(res.error.issues) };
}

export function parseQuizText(raw: string): QuizParseResult {
  const text = extractJsonText(raw);
  if (!text) return { ok: false, errors: ['Пусто: вставь текст теста в формате JSON.'] };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    // Вторая попытка: «умные» кавычки из Word/Google Docs вместо обычных
    try {
      data = JSON.parse(text.replace(/[\u201C\u201D\u201E]/g, '"'));
    } catch {
      void err;
      return { ok: false, errors: [describeJsonSyntaxError(text)] };
    }
  }
  return validateQuizObject(data);
}

/** Приводит проверенный ввод к виду, в котором тест хранится и играется */
export function normalizeQuestions(quiz: QuizInput): Omit<QuizQuestion, 'imageUrl'>[] {
  const def = quiz.defaultTimeLimit ?? DEFAULT_TIME_LIMIT;
  return quiz.questions.map((q) => ({
    type: q.type,
    question: q.question,
    timeLimit: Math.round(q.timeLimit ?? def),
    points: q.points ?? 1,
    answers: q.answers.map((a) => ({ text: a.text, correct: a.correct })),
  }));
}
