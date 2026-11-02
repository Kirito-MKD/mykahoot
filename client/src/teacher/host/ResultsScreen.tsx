import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { HostView } from '@viktorina/shared';
import { api } from '../../lib/api';
import { request } from '../../lib/socket';
import { KEYS, save } from '../../lib/storage';
import { Button } from '../../components/Button';
import { Confetti } from '../../components/Confetti';
import { Podium } from '../../components/Podium';
import { TeamStandings } from './TeamStandings';

function secs(ms: number): string {
  return (ms / 1000).toFixed(1).replace('.', ',') + ' с';
}

export function ResultsScreen({ view }: { view: HostView }) {
  const navigate = useNavigate();
  const r = view.results;
  const [stage, setStage] = useState<'podium' | 'summary'>('podium');
  const [confetti, setConfetti] = useState(false);
  const onRevealed = useCallback(() => setConfetti(true), []);
  if (!r) return null;

  const close = async () => {
    await request('host:close');
    save(KEYS.hostToken, null);
    navigate('/teacher');
  };

  const cards = [
    r.summary.mostCorrect && { icon: '🎯', title: 'Больше всех верных', name: r.summary.mostCorrect.name, value: `${r.summary.mostCorrect.correct} из ${r.questions.length}` },
    r.summary.fastest && { icon: '⚡', title: 'Самый быстрый ответ', name: r.summary.fastest.name, value: `${secs(r.summary.fastest.timeMs)} · вопрос ${r.summary.fastest.question}` },
    r.summary.longestStreak && { icon: '🔥', title: 'Самая длинная серия', name: r.summary.longestStreak.name, value: `${r.summary.longestStreak.streak} подряд` },
    r.summary.modeAward && { icon: '🏅', title: r.summary.modeAward.title, name: r.summary.modeAward.name, value: r.summary.modeAward.value },
  ].filter(Boolean) as { icon: string; title: string; name: string; value: string }[];

  const hardest = [...r.questions].sort((a, b) => a.percent - b.percent).slice(0, 3);

  return (
    <motion.div className="res" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {confetti && <Confetti />}
      <AnimatePresence mode="wait">
        {stage === 'podium' ? (
          <motion.div key="podium" className="res-podium" exit={{ opacity: 0, y: -30 }}>
            {r.summary.winnerTeam && (
              <motion.div className="res-team" style={{ background: r.summary.winnerTeam.color }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 3, type: 'spring' }}>
                Победила команда «{r.summary.winnerTeam.name}» · {r.summary.winnerTeam.value}
              </motion.div>
            )}
            {!r.summary.winnerTeam && r.summary.modeResultLine && <div className="res-line">{r.summary.modeResultLine}</div>}
            <div className="res-podium-stage">
              <Podium players={r.players} onRevealed={onRevealed} />
            </div>
            <div className="res-actions">
              <Button variant="gold" size="lg" onClick={() => setStage('summary')}>
                Сводка и результаты →
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="summary" className="res-summary" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
            <div className="res-sum-head">
              <h1>Итоги</h1>
              {r.summary.modeResultLine && <p>{r.summary.modeResultLine}</p>}
            </div>
            <div className="res-grid">
              <section className="res-col">
                <div className="res-cards">
                  {cards.map((c, i) => (
                    <motion.div key={c.title} className="res-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                      <span className="res-card-icon" aria-hidden="true">
                        {c.icon}
                      </span>
                      <span className="res-card-title">{c.title}</span>
                      <span className="res-card-name">{c.name}</span>
                      <span className="res-card-val">{c.value}</span>
                    </motion.div>
                  ))}
                </div>
                {r.teams.length > 0 && <TeamStandings standings={r.teams} />}
                <div className="res-hard">
                  <h3>Над чем стоит поработать</h3>
                  <ol>
                    {hardest.map((q) => (
                      <li key={q.index}>
                        <span className="res-hard-pct" style={{ background: q.percent < 40 ? 'var(--bad)' : q.percent < 70 ? 'var(--a-yellow)' : 'var(--ok)' }}>
                          {q.percent}%
                        </span>
                        <span>
                          №{q.index + 1}. {q.text}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </section>
              <section className="res-col res-table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Имя</th>
                      <th>Счёт</th>
                      <th>Верно</th>
                      <th>Серия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.players.map((p) => (
                      <tr key={p.id}>
                        <td>{p.rank}</td>
                        <td>
                          <span className="tbl-dot" style={{ background: p.color }} />
                          {p.name}
                        </td>
                        <td>{p.score.toLocaleString('ru-RU')}</td>
                        <td>
                          {p.correct}/{r.questions.length}
                        </td>
                        <td>{p.bestStreak}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
            <div className="res-actions">
              <Button variant="ghost" onClick={() => setStage('podium')}>
                ← Пьедестал
              </Button>
              {r.questions.length > 0 && r.players.length > 0 && (
                <a className="btn btn-gold btn-lg" href={api.csvUrl(r.gameId)} download>
                  ⬇ Скачать результаты (CSV)
                </a>
              )}
              <Button variant="green" size="lg" onClick={close}>
                Закончить и выйти
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
