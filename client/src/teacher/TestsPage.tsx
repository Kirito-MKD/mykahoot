import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { matchImages, parseQuizText, type QuizInput, type QuizSummary } from '@viktorina/shared';
import { api } from '../lib/api';
import { AI_PROMPT } from '../data/aiPrompt';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import { toast } from '../components/Toast';
import { filesFromDataTransfer, readBatch, type PoolImage } from './importer';
import { Reconcile } from './Reconcile';
import { GameSetup } from './GameSetup';

interface Draft {
  quiz: QuizInput;
  images: PoolImage[];
  assignments: (string | null)[];
  reasons: (string | null)[];
}

/** Автопривязка: уже назначенные картинки не трогаем, остальное раскладываем по правилам */
function autoMatch(quiz: QuizInput, images: PoolImage[], keep?: (string | null)[]) {
  const keyByName = new Map<string, string>();
  for (const im of images) if (!keyByName.has(im.name)) keyByName.set(im.name, im.key);
  const kept = new Set((keep ?? []).filter(Boolean) as string[]);
  const free = [...keyByName.entries()].filter(([, k]) => !kept.has(k)).map(([n]) => n);
  const questions = quiz.questions.map((q, i) => (keep?.[i] ? { image: null } : { image: q.image }));
  const m = matchImages(questions, free);
  const assignments = quiz.questions.map((_, i) => keep?.[i] ?? (m.assignments[i] ? keyByName.get(m.assignments[i]!)! : null));
  const reasons = quiz.questions.map((_, i) => (keep?.[i] ? 'manual' : m.reasons[i]));
  return { assignments, reasons };
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Запасной путь для http-страниц, где Clipboard API недоступен
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function TestsPage() {
  const [quizzes, setQuizzes] = useState<QuizSummary[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState<PoolImage[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [playQuiz, setPlayQuiz] = useState<QuizSummary | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<QuizSummary | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    api
      .quizzes()
      .then(setQuizzes)
      .catch(() => toast('Не удалось загрузить список тестов', 'error'));
  }, []);
  useEffect(refresh, [refresh]);

  const acceptJson = useCallback((text: string, name: string, pool: PoolImage[], extraWarnings: string[]) => {
    const parsed = parseQuizText(text);
    if (!parsed.ok || !parsed.quiz) {
      setErrors(parsed.errors.map((e) => (name ? `${e}` : e)));
      setPending(pool);
      setDraft(null);
      setWarnings(extraWarnings);
      return;
    }
    const { assignments, reasons } = autoMatch(parsed.quiz, pool);
    setErrors([]);
    setWarnings(extraWarnings);
    setPending([]);
    setDraft({ quiz: parsed.quiz, images: pool, assignments, reasons });
  }, []);

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setBusy(true);
      try {
        const batch = await readBatch(files);
        const pool = [...(draft?.images ?? pending), ...batch.images];
        const warns = [...batch.warnings];
        if (batch.jsonTexts.length > 1) warns.push(`Найдено несколько JSON-файлов — взят «${batch.jsonTexts[0]!.name}».`);
        if (batch.jsonTexts.length) {
          acceptJson(batch.jsonTexts[0]!.text, batch.jsonTexts[0]!.name, pool, warns);
        } else if (draft) {
          const { assignments, reasons } = autoMatch(draft.quiz, pool, draft.assignments);
          setDraft({ ...draft, images: pool, assignments, reasons: reasons.map((r, i) => (draft.assignments[i] ? draft.reasons[i]! : r)) });
          setWarnings(warns);
          toast(`Добавлено картинок: ${batch.images.length}`, 'ok');
        } else {
          setPending(pool);
          setWarnings(warns);
          if (batch.images.length) toast(`Картинки получены (${pool.length}). Теперь добавь JSON с вопросами.`);
        }
      } finally {
        setBusy(false);
      }
    },
    [draft, pending, acceptJson],
  );

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const form = new FormData();
    form.append('quiz', JSON.stringify(draft.quiz));
    const byKey = new Map(draft.images.map((i) => [i.key, i]));
    draft.assignments.forEach((k, i) => {
      const im = k ? byKey.get(k) : null;
      if (im) form.append(`img_${i}`, im.blob, im.name);
    });
    const res = await api.saveQuiz(form).catch(() => ({ ok: false as const, errors: ['Нет связи с сервером'] }));
    setSaving(false);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    draft.images.forEach((i) => URL.revokeObjectURL(i.url));
    setDraft(null);
    setErrors([]);
    setWarnings([]);
    toast('Тест сохранён', 'ok');
    refresh();
  };

  const cancel = () => {
    draft?.images.forEach((i) => URL.revokeObjectURL(i.url));
    pending.forEach((i) => URL.revokeObjectURL(i.url));
    setDraft(null);
    setPending([]);
    setErrors([]);
    setWarnings([]);
  };

  const copyPrompt = async () => {
    const ok = await copyText(AI_PROMPT);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 6000);
    } else toast('Не получилось скопировать — выдели текст вручную', 'error');
  };

  return (
    <div className="tp">
      <section
        className={`drop ${over ? 'is-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setOver(false);
        }}
        onDrop={async (e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.types.includes('application/x-viktorina-image')) return;
          await handleFiles(await filesFromDataTransfer(e.dataTransfer));
        }}
        aria-label="Зона загрузки теста"
      >
        <div className="drop-art" aria-hidden="true">
          <svg width="74" height="74" viewBox="0 0 64 64">
            <rect x="10" y="6" width="38" height="48" rx="6" fill="#fff" stroke="#1A1033" strokeWidth="3.5" />
            <path d="M18 20 H40 M18 28 H40 M18 36 H32" stroke="#B9AEDC" strokeWidth="4" strokeLinecap="round" />
            <circle cx="46" cy="46" r="13" fill="#FFC531" stroke="#1A1033" strokeWidth="3.5" />
            <path d="M46 52 V40 M40.5 45 L46 39.5 L51.5 45" stroke="#1A1033" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </div>
        <div className="drop-text">
          <h2>{busy ? 'Читаю файлы…' : 'Перетащи сюда тест'}</h2>
          <p>
            JSON с вопросами, картинки, zip-архив или целую папку — можно всё сразу. Картинки сами привяжутся к вопросам по номеру в
            имени файла.
          </p>
          <div className="drop-actions">
            <Button variant="primary" onClick={() => fileInput.current?.click()} disabled={busy}>
              {busy ? <Spinner size={20} /> : null}
              Выбрать файлы
            </Button>
            <Button variant="quiet" onClick={() => folderInput.current?.click()} disabled={busy}>
              Выбрать папку
            </Button>
            <Button variant="quiet" onClick={() => setPasteOpen(true)}>
              Вставить JSON текстом
            </Button>
          </div>
        </div>
        <div className="drop-ai">
          <Button variant="gold" onClick={copyPrompt} icon={<span aria-hidden="true">✨</span>}>
            Скопировать промпт для нейросети
          </Button>
          <AnimatePresence>
            {copied ? (
              <motion.p className="drop-ai-tip is-done" role="status" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                Скопировано. Открой ChatGPT или Claude, вставь промпт и приложи свой файл с вопросами
              </motion.p>
            ) : (
              <p className="drop-ai-tip">Нейросеть превратит твой Word, PDF или презентацию в готовый тест</p>
            )}
          </AnimatePresence>
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          accept=".json,.txt,.zip,.png,.jpg,.jpeg,.webp,.gif,application/json,application/zip,image/*"
          onChange={async (e) => {
            await handleFiles([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
        <input
          ref={folderInput}
          type="file"
          hidden
          // @ts-expect-error — нестандартный атрибут выбора папки
          webkitdirectory=""
          directory=""
          onChange={async (e) => {
            await handleFiles([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
      </section>

      {pending.length > 0 && !draft && errors.length === 0 && (
        <p className="tp-pending">
          Картинок в очереди: {pending.length}. Добавь JSON с вопросами — и они привяжутся.{' '}
          <button className="link-btn" onClick={cancel}>
            Очистить
          </button>
        </p>
      )}

      {errors.length > 0 && !draft && (
        <motion.div className="err-box card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} role="alert">
          <h3>В тесте есть ошибки — поправь и загрузи снова</h3>
          <ul className="err-list">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          {warnings.length > 0 && (
            <ul className="rc-warn">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <Button variant="quiet" onClick={cancel}>
            Закрыть
          </Button>
        </motion.div>
      )}

      {draft && (
        <Reconcile
          quiz={draft.quiz}
          images={draft.images}
          assignments={draft.assignments}
          reasons={draft.reasons}
          onChange={(assignments) =>
            setDraft({ ...draft, assignments, reasons: assignments.map((a, i) => (a && a !== draft.assignments[i] ? 'manual' : a ? draft.reasons[i]! : null)) })
          }
          onSave={save}
          onCancel={cancel}
          saving={saving}
          errors={errors}
          warnings={warnings}
        />
      )}

      <section className="tp-list">
        <h2 className="tp-h2">Мои тесты</h2>
        {quizzes === null ? (
          <Spinner color="var(--purple)" />
        ) : quizzes.length === 0 ? (
          <p className="tp-empty">Пока нет ни одного теста. Перетащи файл в зону выше — или скопируй промпт для нейросети.</p>
        ) : (
          <ul className="tp-grid">
            {quizzes.map((q, i) => (
              <motion.li key={q.id} className="qcard" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.04 }}>
                <div className="qcard-cover" style={q.coverUrl ? { backgroundImage: `url(${q.coverUrl})` } : undefined}>
                  {!q.coverUrl && <span aria-hidden="true">?</span>}
                </div>
                <div className="qcard-body">
                  <h3>{q.title}</h3>
                  {q.description && <p className="qcard-desc">{q.description}</p>}
                  <p className="qcard-meta">
                    {q.questionCount} {plural(q.questionCount, 'вопрос', 'вопроса', 'вопросов')}
                    {q.imageCount > 0 && ` · ${q.imageCount} ${plural(q.imageCount, 'картинка', 'картинки', 'картинок')}`} · {formatDate(q.createdAt)}
                  </p>
                </div>
                <div className="qcard-actions">
                  <Button variant="green" onClick={() => setPlayQuiz(q)}>
                    ▶ Играть
                  </Button>
                  <a className="btn btn-quiet btn-sm" href={`/api/quizzes/${q.id}/export`} download title="Скачать тест в формате JSON">
                    JSON
                  </a>
                  <Button variant="quiet" size="sm" iconOnly aria-label={`Удалить тест «${q.title}»`} title="Удалить" onClick={() => setConfirmDelete(q)}>
                    🗑
                  </Button>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </section>

      <AnimatePresence>
        {pasteOpen && (
          <PasteModal
            onClose={() => setPasteOpen(false)}
            onSubmit={(text) => {
              setPasteOpen(false);
              acceptJson(text, '', draft?.images ?? pending, []);
            }}
          />
        )}
        {playQuiz && <GameSetup quiz={playQuiz} onClose={() => setPlayQuiz(null)} />}
        {confirmDelete && (
          <Modal label="Удалить тест" onClose={() => setConfirmDelete(null)}>
            <h2>Удалить тест?</h2>
            <p className="text-muted" style={{ marginBottom: 20 }}>
              «{confirmDelete.title}» исчезнет из списка вместе с картинками. История прошедших игр останется.
            </p>
            <div className="row" style={{ gap: 12, justifyContent: 'flex-end' }}>
              <Button variant="quiet" onClick={() => setConfirmDelete(null)}>
                Отмена
              </Button>
              <Button
                variant="danger"
                autoFocus
                onClick={async () => {
                  const q = confirmDelete;
                  setConfirmDelete(null);
                  await api.deleteQuiz(q.id).catch(() => toast('Не удалось удалить', 'error'));
                  refresh();
                }}
              >
                Удалить
              </Button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function PasteModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (text: string) => void }) {
  const [text, setText] = useState('');
  return (
    <Modal label="Вставить JSON текстом" onClose={onClose} wide>
      <h2>Вставить JSON текстом</h2>
      <p className="text-muted" style={{ marginBottom: 12 }}>
        Скопируй ответ нейросети целиком и вставь сюда (Ctrl+V). Обёртку ```json и лишний текст вокруг уберём сами.
      </p>
      <textarea
        className="input"
        autoFocus
        rows={14}
        value={text}
        placeholder='{ "title": "…", "questions": [ … ] }'
        onChange={(e) => setText(e.target.value)}
        aria-label="Текст теста в формате JSON"
      />
      <div className="row" style={{ gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
        <Button variant="quiet" onClick={onClose}>
          Отмена
        </Button>
        <Button variant="primary" disabled={!text.trim()} onClick={() => onSubmit(text)}>
          Проверить
        </Button>
      </div>
    </Modal>
  );
}
