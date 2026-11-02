import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkName, isProfane } from '../src/moderation';
import { generateCode } from '../src/game/manager';
import { resultsToCsv } from '../src/csv';
import type { GameResults } from '@viktorina/shared';

test('фильтр имён', () => {
  assert.equal(checkName('Маша').ok, true);
  assert.equal(checkName('Глеб').ok, true);
  assert.equal(checkName('Команда А').ok, true);
  assert.equal(checkName('Herobrine').ok, true);
  assert.equal(checkName('').ok, false);
  assert.equal(checkName('x'.repeat(21)).ok, false);
  assert.equal(isProfane('сука'), true);
  assert.equal(isProfane('Пи3да'), true);
  assert.equal(isProfane('huy'), true);
  assert.equal(isProfane('ХУУУЙ'), true);
  assert.equal(isProfane('f u c k'), true);
});

test('коды игр: трёхзначные, уникальные, затем четырёхзначные', () => {
  const taken = new Set<string>();
  for (let i = 0; i < 900; i++) {
    const c = generateCode(taken);
    assert.equal(c.length, 3);
    assert.ok(!taken.has(c));
    taken.add(c);
  }
  assert.equal(generateCode(taken).length, 4);
});

test('CSV: BOM, точка с запятой, два блока', () => {
  const r: GameResults = {
    gameId: 'g',
    quizTitle: 'Скелет; часть 1',
    mode: 'classic',
    teamMode: false,
    startedAt: Date.now(),
    finishedAt: Date.now(),
    players: [
      {
        id: '1', name: '=Вася', avatar: { base: 'cat', color: 0, hat: 'none', glasses: 'none', outfit: 'tshirt' },
        teamId: null, teamName: null, color: '#000', score: 1500, rank: 1, correct: 2, wrong: 1, unanswered: 0,
        percent: 67, bestStreak: 2, avgTimeMs: 4567, modeValue: 0,
      },
    ],
    questions: [{ index: 0, text: 'Кость "бедро"', correct: 1, wrong: 0, unanswered: 0, percent: 100, avgTimeMs: 3000 }],
    teams: [],
    summary: { fastest: null, longestStreak: null, mostCorrect: null, modeAward: null, winnerTeam: null, modeResultLine: null },
  };
  const csv = resultsToCsv(r);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.includes('"Скелет; часть 1"'));
  assert.ok(csv.includes('УЧЕНИКИ'));
  assert.ok(csv.includes('ВОПРОСЫ'));
  assert.ok(csv.includes("'=Вася"));
  assert.ok(csv.includes('4,6'));
  assert.ok(csv.includes('"Кость ""бедро"""'));
});
