import Database from 'better-sqlite3';
import fs from 'node:fs';
import type { GameResults, QuizSummary, StoredQuiz } from '@viktorina/shared';
import { DATA_DIR, DB_PATH, UPLOADS_DIR } from './paths';

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS quizzes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    quiz_id TEXT,
    quiz_title TEXT NOT NULL,
    mode TEXT NOT NULL,
    team_mode INTEGER NOT NULL,
    started_at INTEGER NOT NULL,
    finished_at INTEGER NOT NULL,
    players_count INTEGER NOT NULL,
    results TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS games_finished ON games(finished_at DESC);
`);

const insertQuiz = db.prepare(
  'INSERT INTO quizzes (id, title, description, created_at, data) VALUES (@id, @title, @description, @createdAt, @data)',
);
const selectQuizzes = db.prepare('SELECT id, title, description, created_at, data FROM quizzes ORDER BY created_at DESC');
const selectQuiz = db.prepare('SELECT id, title, description, created_at, data FROM quizzes WHERE id = ?');
const deleteQuizStmt = db.prepare('DELETE FROM quizzes WHERE id = ?');

interface QuizRow {
  id: string;
  title: string;
  description: string;
  created_at: number;
  data: string;
}

function rowToQuiz(r: QuizRow): StoredQuiz {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    createdAt: r.created_at,
    questions: JSON.parse(r.data),
  };
}

export function saveQuiz(q: StoredQuiz): void {
  insertQuiz.run({ id: q.id, title: q.title, description: q.description, createdAt: q.createdAt, data: JSON.stringify(q.questions) });
}

export function listQuizzes(): QuizSummary[] {
  return (selectQuizzes.all() as QuizRow[]).map((r) => {
    const q = rowToQuiz(r);
    const withImages = q.questions.filter((x) => x.imageUrl);
    return {
      id: q.id,
      title: q.title,
      description: q.description,
      createdAt: q.createdAt,
      questionCount: q.questions.length,
      imageCount: withImages.length,
      coverUrl: withImages[0]?.imageUrl,
    };
  });
}

export function getQuiz(id: string): StoredQuiz | null {
  const r = selectQuiz.get(id) as QuizRow | undefined;
  return r ? rowToQuiz(r) : null;
}

export function deleteQuiz(id: string): boolean {
  return deleteQuizStmt.run(id).changes > 0;
}

const insertGame = db.prepare(`
  INSERT OR REPLACE INTO games (id, quiz_id, quiz_title, mode, team_mode, started_at, finished_at, players_count, results)
  VALUES (@id, @quizId, @quizTitle, @mode, @teamMode, @startedAt, @finishedAt, @playersCount, @results)
`);
const selectGames = db.prepare(
  'SELECT id, quiz_title, mode, team_mode, started_at, finished_at, players_count FROM games ORDER BY finished_at DESC LIMIT 500',
);
const selectGame = db.prepare('SELECT results FROM games WHERE id = ?');
const deleteGameStmt = db.prepare('DELETE FROM games WHERE id = ?');

export interface HistoryItem {
  id: string;
  quizTitle: string;
  mode: string;
  teamMode: boolean;
  startedAt: number;
  finishedAt: number;
  playersCount: number;
}

export function saveGameResults(quizId: string, r: GameResults): void {
  insertGame.run({
    id: r.gameId,
    quizId,
    quizTitle: r.quizTitle,
    mode: r.mode,
    teamMode: r.teamMode ? 1 : 0,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    playersCount: r.players.length,
    results: JSON.stringify(r),
  });
}

export function listGames(): HistoryItem[] {
  return (selectGames.all() as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    quizTitle: r.quiz_title as string,
    mode: r.mode as string,
    teamMode: r.team_mode === 1,
    startedAt: r.started_at as number,
    finishedAt: r.finished_at as number,
    playersCount: r.players_count as number,
  }));
}

export function getGameResults(id: string): GameResults | null {
  const r = selectGame.get(id) as { results: string } | undefined;
  return r ? (JSON.parse(r.results) as GameResults) : null;
}

export function deleteGame(id: string): boolean {
  return deleteGameStmt.run(id).changes > 0;
}
