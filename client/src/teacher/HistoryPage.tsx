import { motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { MODE_INFO, type GameMode, type GameResults } from '@viktorina/shared';
import { api, type HistoryItem } from '../lib/api';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import { toast } from '../components/Toast';
import { ModeIcon } from './GameSetup';

function fmt(ts: number): string {
  return new Date(ts).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

export function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [details, setDetails] = useState<GameResults | null>(null);
  const refresh = useCallback(() => {
    api
      .history()
      .then(setItems)
      .catch(() => toast('Не удалось загрузить историю', 'error'));
  }, []);
  useEffect(refresh, [refresh]);

  return (
    <div className="tp">
      <h2 className="tp-h2">История игр</h2>
      {items === null ? (
        <Spinner color="var(--purple)" />
      ) : items.length === 0 ? (
        <p className="tp-empty">Здесь появятся завершённые игры. Результаты любой из них можно будет скачать в CSV для Excel.</p>
      ) : (
        <ul className="hist">
          {items.map((g, i) => (
            <motion.li key={g.id} className="hist-row" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
              <ModeIcon mode={g.mode as GameMode} size={44} />
              <div className="hist-main">
                <span className="hist-title">{g.quizTitle}</span>
                <span className="hist-meta">
                  {MODE_INFO[g.mode as GameMode]?.title ?? g.mode}
                  {g.teamMode ? ', команды' : ''} · {g.playersCount} уч. · {fmt(g.startedAt)}
                </span>
              </div>
              <Button variant="quiet" size="sm" onClick={() => api.historyItem(g.id).then(setDetails).catch(() => toast('Не удалось открыть', 'error'))}>
                Подробнее
              </Button>
              <a className="btn btn-primary btn-sm" href={api.csvUrl(g.id)} download>
                ⬇ CSV
              </a>
              <Button
                variant="quiet"
                size="sm"
                iconOnly
                title="Удалить из истории"
                aria-label="Удалить из истории"
                onClick={async () => {
                  if (!confirm('Удалить эту игру из истории?')) return;
                  await api.deleteHistory(g.id);
                  refresh();
                }}
              >
                🗑
              </Button>
            </motion.li>
          ))}
        </ul>
      )}
      {details && (
        <Modal label="Результаты игры" onClose={() => setDetails(null)} wide>
          <h2>{details.quizTitle}</h2>
          <p className="text-muted" style={{ marginBottom: 14 }}>
            {fmt(details.startedAt)} · {details.players.length} участников
          </p>
          <div className="hist-tables">
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Имя</th>
                  <th>Счёт</th>
                  <th>Верно</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {details.players.map((p) => (
                  <tr key={p.id}>
                    <td>{p.rank}</td>
                    <td>{p.name}</td>
                    <td>{p.score}</td>
                    <td>{p.correct}</td>
                    <td>{p.percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="tbl">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Вопрос</th>
                  <th>% верных</th>
                </tr>
              </thead>
              <tbody>
                {details.questions.map((q) => (
                  <tr key={q.index} className={q.percent < 50 ? 'is-hard' : ''}>
                    <td>{q.index + 1}</td>
                    <td>{q.text}</td>
                    <td>{q.percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
            <a className="btn btn-primary" href={api.csvUrl(details.gameId)} download>
              ⬇ Скачать CSV
            </a>
            <Button variant="quiet" onClick={() => setDetails(null)}>
              Закрыть
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
