import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { isImageName, matchImages, normalizeQuestions, parseQuizText, type StoredQuiz } from '@viktorina/shared';
import { db, saveQuiz } from './db';
import { ROOT_DIR, UPLOADS_DIR } from './paths';

db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');

/** При первом запуске кладём в «Мои тесты» демо-тест из папки «примеры», чтобы было с чем попробовать */
export async function seedDemoQuiz(): Promise<void> {
  const done = db.prepare("SELECT value FROM meta WHERE key = 'demo_seeded'").get();
  if (done) return;
  const dir = path.join(ROOT_DIR, 'примеры', 'Демо-тест');
  const jsonPath = path.join(dir, 'тест.json');
  if (!fs.existsSync(jsonPath)) return;
  const parsed = parseQuizText(fs.readFileSync(jsonPath, 'utf8'));
  if (!parsed.ok || !parsed.quiz) throw new Error(parsed.errors.join(' '));
  const images = fs.readdirSync(dir).filter(isImageName);
  const match = matchImages(parsed.quiz.questions, images);
  const id = randomBytes(8).toString('hex');
  const questions = normalizeQuestions(parsed.quiz) as StoredQuiz['questions'];
  for (let i = 0; i < questions.length; i++) {
    const file = match.assignments[i];
    if (!file) continue;
    const out = path.join(UPLOADS_DIR, id, `${i + 1}.webp`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await sharp(path.join(dir, file)).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 80 }).toFile(out);
    questions[i]!.imageUrl = `/uploads/${id}/${i + 1}.webp`;
  }
  saveQuiz({ id, title: parsed.quiz.title, description: parsed.quiz.description ?? '', createdAt: Date.now(), questions });
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('demo_seeded', '1')").run();
}
