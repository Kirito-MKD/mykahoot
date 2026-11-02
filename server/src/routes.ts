import express, { type Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import multer from 'multer';
import sharp from 'sharp';
import { normalizeQuestions, validateQuizObject, type QuizQuestion, type ServerInfo, type StoredQuiz } from '@viktorina/shared';
import { deleteGame, deleteQuiz, getGameResults, getQuiz, listGames, listQuizzes, saveQuiz } from './db';
import { csvFileName, resultsToCsv } from './csv';
import { UPLOADS_DIR } from './paths';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 220, fieldSize: 5 * 1024 * 1024 },
});

/**
 * Сжимаем картинку до ширины 1200px и WebP: файл падает с ~300 КБ до 60–80 КБ,
 * и 20 детей одновременно получают картинку вопроса без задержек.
 */
async function toWebp(buf: Buffer, mime: string): Promise<Buffer> {
  const animated = mime === 'image/gif';
  return sharp(buf, { animated, failOn: 'none' })
    .rotate()
    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80, effort: 4 })
    .toBuffer();
}

export function createApiRouter(getInfo: () => ServerInfo): Router {
  const r = express.Router();

  r.get('/server-info', (_req, res) => {
    res.json(getInfo());
  });

  r.get('/quizzes', (_req, res) => {
    res.json(listQuizzes());
  });

  r.get('/quizzes/:id', (req, res) => {
    const q = getQuiz(req.params.id);
    if (!q) return res.status(404).json({ error: 'Тест не найден' });
    res.json(q);
  });

  /** Скачать тест обратно в формате JSON (без картинок) */
  r.get('/quizzes/:id/export', (req, res) => {
    const q = getQuiz(req.params.id);
    if (!q) return res.status(404).json({ error: 'Тест не найден' });
    const out = {
      title: q.title,
      description: q.description,
      questions: q.questions.map((x, i) => ({
        type: x.type,
        question: x.question,
        ...(x.imageUrl ? { image: `${i + 1}.webp` } : {}),
        timeLimit: x.timeLimit,
        ...(x.points !== 1 ? { points: x.points } : {}),
        answers: x.answers,
      })),
    };
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(q.title)}.json`);
    res.send(JSON.stringify(out, null, 2));
  });

  r.post('/quizzes', upload.any(), async (req, res) => {
    try {
      const raw = (req.body as Record<string, string>).quiz;
      if (!raw) return res.status(400).json({ errors: ['Не получен текст теста.'] });
      let data: unknown;
      try {
        data = JSON.parse(raw);
      } catch {
        return res.status(400).json({ errors: ['Текст теста повреждён при отправке. Попробуй ещё раз.'] });
      }
      const parsed = validateQuizObject(data);
      if (!parsed.ok || !parsed.quiz) return res.status(400).json({ errors: parsed.errors });

      const id = randomBytes(8).toString('hex');
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      const questions: QuizQuestion[] = normalizeQuestions(parsed.quiz);
      const dir = path.join(UPLOADS_DIR, id);
      const imageErrors: string[] = [];
      for (const f of files) {
        const m = f.fieldname.match(/^img_(\d+)$/);
        if (!m) continue;
        const qi = Number(m[1]);
        if (!questions[qi]) continue;
        try {
          const webp = await toWebp(f.buffer, f.mimetype);
          fs.mkdirSync(dir, { recursive: true });
          const name = `${qi + 1}-${randomBytes(3).toString('hex')}.webp`;
          fs.writeFileSync(path.join(dir, name), webp);
          questions[qi]!.imageUrl = `/uploads/${id}/${name}`;
        } catch {
          imageErrors.push(`Вопрос ${qi + 1}: картинку «${Buffer.from(f.originalname, 'latin1').toString('utf8')}» не удалось открыть — возможно, файл повреждён.`);
        }
      }
      if (imageErrors.length) {
        fs.rmSync(dir, { recursive: true, force: true });
        return res.status(400).json({ errors: imageErrors });
      }
      const quiz: StoredQuiz = {
        id,
        title: parsed.quiz.title,
        description: parsed.quiz.description ?? '',
        createdAt: Date.now(),
        questions,
      };
      saveQuiz(quiz);
      res.json({ ok: true, id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ errors: ['Не удалось сохранить тест: ' + (err instanceof Error ? err.message : String(err))] });
    }
  });

  r.delete('/quizzes/:id', (req, res) => {
    const id = req.params.id;
    if (!/^[a-f0-9]+$/.test(id)) return res.status(400).json({ error: 'Неверный id' });
    const ok = deleteQuiz(id);
    fs.rmSync(path.join(UPLOADS_DIR, id), { recursive: true, force: true });
    res.json({ ok });
  });

  r.get('/history', (_req, res) => {
    res.json(listGames());
  });

  r.get('/history/:id', (req, res) => {
    const g = getGameResults(req.params.id);
    if (!g) return res.status(404).json({ error: 'Игра не найдена' });
    res.json(g);
  });

  r.get('/history/:id/csv', (req, res) => {
    const g = getGameResults(req.params.id);
    if (!g) return res.status(404).send('Игра не найдена');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(csvFileName(g))}`);
    res.send(resultsToCsv(g));
  });

  r.delete('/history/:id', (req, res) => {
    res.json({ ok: deleteGame(req.params.id) });
  });

  return r;
}
