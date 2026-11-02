import { motion } from 'framer-motion';
import { useState } from 'react';
import { QUESTION_TYPE_LABELS, type QuizInput } from '@viktorina/shared';
import { Button } from '../components/Button';
import { Spinner } from '../components/Spinner';
import type { PoolImage } from './importer';

interface Props {
  quiz: QuizInput;
  images: PoolImage[];
  assignments: (string | null)[];
  reasons: (string | null)[];
  onChange: (assignments: (string | null)[]) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  errors: string[];
  warnings: string[];
}

const REASON_LABEL: Record<string, string> = {
  explicit: 'по имени из теста',
  number: 'по номеру в имени файла',
  order: 'по порядку',
  manual: 'вручную',
};

/** Таблица сверки: вопрос ↔ картинка. Ничего не сохраняется до «Сохранить тест». */
export function Reconcile({ quiz, images, assignments, reasons, onChange, onSave, onCancel, saving, errors, warnings }: Props) {
  const [dragOver, setDragOver] = useState<number | null>(null);
  const byKey = new Map(images.map((i) => [i.key, i]));
  const used = new Set(assignments.filter(Boolean) as string[]);
  const unassigned = images.filter((i) => !used.has(i.key));

  const assign = (qi: number, key: string | null) => {
    const next = assignments.slice();
    // Картинка может быть только у одного вопроса: снимаем её с прежнего места
    if (key) {
      const prev = next.indexOf(key);
      if (prev !== -1) next[prev] = null;
    }
    next[qi] = key;
    onChange(next);
  };

  const missing = quiz.questions
    .map((q, i) => ({ q, i }))
    .filter(({ q, i }) => q.image && !assignments[i]);

  return (
    <motion.div className="rc card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <header className="rc-head">
        <div>
          <span className="rc-kicker">Проверка перед сохранением</span>
          <h2>{quiz.title}</h2>
          {quiz.description && <p className="text-muted">{quiz.description}</p>}
        </div>
        <div className="rc-stats">
          <span>
            <b>{quiz.questions.length}</b> вопросов
          </span>
          <span>
            <b>{used.size}</b> с картинками
          </span>
        </div>
      </header>

      {warnings.length > 0 && (
        <ul className="rc-warn">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      {missing.length > 0 && (
        <p className="rc-warn-line">
          Ждут картинку: {missing.map(({ i }) => `№${i + 1}`).join(', ')}. Перетащи файлы в зону загрузки выше или прямо на строку вопроса.
        </p>
      )}

      <div className="rc-table" role="table" aria-label="Сверка вопросов и картинок">
        <div className="rc-row rc-row-head" role="row">
          <span role="columnheader">№</span>
          <span role="columnheader">Вопрос</span>
          <span role="columnheader">Картинка</span>
          <span role="columnheader">Привязка</span>
        </div>
        {quiz.questions.map((q, i) => {
          const key = assignments[i];
          const img = key ? byKey.get(key) : undefined;
          return (
            <div
              key={i}
              role="row"
              className={`rc-row ${dragOver === i ? 'is-drop' : ''}`}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes('application/x-viktorina-image')) {
                  e.preventDefault();
                  setDragOver(i);
                }
              }}
              onDragLeave={() => setDragOver((d) => (d === i ? null : d))}
              onDrop={(e) => {
                const k = e.dataTransfer.getData('application/x-viktorina-image');
                setDragOver(null);
                if (k) {
                  e.preventDefault();
                  e.stopPropagation();
                  assign(i, k);
                }
              }}
            >
              <span className="rc-num">{i + 1}</span>
              <span className="rc-q">
                <span className="rc-q-text">{q.question}</span>
                <span className="rc-q-meta">
                  {QUESTION_TYPE_LABELS[q.type]} · {q.answers.length} вар. · {q.timeLimit ?? quiz.defaultTimeLimit ?? 20} с
                </span>
              </span>
              <span className="rc-thumb">
                {img ? (
                  <img
                    src={img.url}
                    alt={img.name}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('application/x-viktorina-image', img.key)}
                  />
                ) : (
                  <span className={`rc-thumb-empty ${q.image ? 'is-wanted' : ''}`}>{q.image ? 'нужна картинка' : '—'}</span>
                )}
              </span>
              <span className="rc-pick">
                <select
                  className="input rc-select"
                  value={key ?? ''}
                  aria-label={`Картинка для вопроса ${i + 1}`}
                  onChange={(e) => assign(i, e.target.value || null)}
                >
                  <option value="">без картинки</option>
                  {images.map((im) => (
                    <option key={im.key} value={im.key}>
                      {im.name}
                      {used.has(im.key) && im.key !== key ? ` (сейчас у №${assignments.indexOf(im.key) + 1})` : ''}
                    </option>
                  ))}
                </select>
                {key && reasons[i] && <span className="rc-reason">{REASON_LABEL[reasons[i]!] ?? ''}</span>}
              </span>
            </div>
          );
        })}
      </div>

      {unassigned.length > 0 && (
        <div className="rc-pool">
          <span className="rc-pool-label">Не привязаны — перетащи на нужную строку:</span>
          <div className="rc-pool-list">
            {unassigned.map((im) => (
              <figure
                key={im.key}
                className="rc-pool-item"
                draggable
                onDragStart={(e) => e.dataTransfer.setData('application/x-viktorina-image', im.key)}
                title={im.name}
              >
                <img src={im.url} alt="" />
                <figcaption>{im.name}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <ul className="err-list" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <footer className="rc-actions">
        <Button variant="quiet" onClick={onCancel} disabled={saving}>
          Отмена
        </Button>
        <Button variant="green" size="lg" onClick={onSave} disabled={saving}>
          {saving && <Spinner size={22} />}
          Сохранить тест
        </Button>
      </footer>
    </motion.div>
  );
}
