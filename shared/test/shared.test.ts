import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePoints,
  evaluateAnswer,
  hexNeighbors,
  matchImages,
  numberFromName,
  parseQuizText,
  speedPoints,
  streakMultiplier,
} from '../src/index';

test('очки за скорость: 1000 × (1 − t/limit/2)', () => {
  assert.equal(speedPoints(0, 20000), 1000);
  assert.equal(speedPoints(20000, 20000), 500);
  assert.equal(speedPoints(10000, 20000), 750);
  assert.equal(computePoints({ elapsedMs: 3333, limitMs: 20000, fraction: 1, fullyCorrect: true, streakAfter: 1 }), 916);
  assert.equal(computePoints({ elapsedMs: 0, limitMs: 20000, fraction: 0, fullyCorrect: false, streakAfter: 0 }), 0);
});

test('множитель серии ×1 / ×1.1 / ×1.2 / ×1.3', () => {
  assert.deepEqual([1, 2, 3, 4, 7].map(streakMultiplier), [1, 1.1, 1.2, 1.3, 1.3]);
  assert.equal(computePoints({ elapsedMs: 0, limitMs: 20000, fraction: 1, fullyCorrect: true, streakAfter: 3 }), 1200);
});

test('multiple: доля верных минус штраф за лишние', () => {
  assert.deepEqual(evaluateAnswer('multiple', [0, 1, 3], [0, 1, 3]), { fullyCorrect: true, fraction: 1 });
  const partial = evaluateAnswer('multiple', [0, 1, 3], [0, 1]);
  assert.equal(partial.fullyCorrect, false);
  assert.ok(Math.abs(partial.fraction - 2 / 3) < 1e-9);
  const withExtra = evaluateAnswer('multiple', [0, 1, 3], [0, 1, 2]);
  assert.ok(Math.abs(withExtra.fraction - 1 / 3) < 1e-9);
  assert.equal(evaluateAnswer('multiple', [0], [1, 2]).fraction, 0);
  assert.equal(evaluateAnswer('quiz', [2], [2]).fullyCorrect, true);
  assert.equal(evaluateAnswer('quiz', [2], [1]).fraction, 0);
});

test('ошибки валидации — человеческим языком с номером вопроса', () => {
  const r = parseQuizText(
    JSON.stringify({
      title: 'Т',
      questions: [
        { type: 'quiz', question: 'a', answers: [{ text: 'x', correct: true }, { text: 'y', correct: false }] },
        { type: 'quiz', question: 'b', answers: [{ text: 'x', correct: false }, { text: 'y', correct: false }] },
        { type: 'quiz', question: 'c', answers: [{ text: 'x', correct: true }, { text: 'y', correct: false }] },
        { type: 'quiz', question: 'd', answers: [{ text: 'x', correct: true }, { text: 'y', correct: true }, { text: 'z', correct: false }] },
      ],
    }),
  );
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.startsWith('Вопрос 2: не отмечен правильный ответ')), r.errors.join('\n'));
  assert.ok(
    r.errors.includes(
      'Вопрос 4: указано два правильных ответа, но тип вопроса «один правильный». Либо убери лишний `correct: true`, либо смени тип на `multiple`.',
    ),
    r.errors.join('\n'),
  );
});

test('разбор JSON: markdown-обёртка, синтаксические ошибки, строки "true"', () => {
  const ok = parseQuizText('Вот тест:\n```json\n{"title":"T","questions":[{"question":"q","answers":[{"text":"a","correct":"true"},{"text":"b","correct":false}]}]}\n```');
  assert.equal(ok.ok, true);
  assert.equal(ok.quiz!.questions[0]!.type, 'quiz');
  const bad = parseQuizText('{"title": "T", "questions": [1,]}');
  assert.equal(bad.ok, false);
  assert.match(bad.errors[0]!, /строка 1/);
  const cut = parseQuizText('{"title": "T", "questions": [');
  assert.match(cut.errors[0]!, /обрывается/);
});

test('привязка картинок: явное имя, номер в имени, по порядку', () => {
  assert.equal(numberFromName('вопрос3.jpg'), 3);
  assert.equal(numberFromName('03.png'), 3);
  assert.equal(numberFromName('q12.png'), 12);
  assert.equal(numberFromName('кость.png'), null);

  const r = matchImages(
    [{ image: 'бедро.jpg' }, {}, { image: true }, {}, { image: true }],
    ['бедро.JPG', 'q2.png', 'ааа.png', 'ббб.png', '99.png'],
  );
  assert.deepEqual(r.assignments, ['бедро.JPG', 'q2.png', 'ааа.png', null, 'ббб.png']);
  assert.deepEqual(r.reasons, ['explicit', 'number', 'order', null, 'order']);
  assert.deepEqual(r.unassigned, ['99.png']);

  // Порядок не применяется, если количество не совпадает
  const r2 = matchImages([{ image: true }, { image: true }], ['a.png']);
  assert.deepEqual(r2.assignments, [null, null]);
  assert.deepEqual(r2.unassigned, ['a.png']);
});

test('соседи гекса', () => {
  assert.deepEqual(hexNeighbors(0).sort((a, b) => a - b), [1, 14]);
  assert.equal(hexNeighbors(14 * 3 + 5).length, 6);
});
