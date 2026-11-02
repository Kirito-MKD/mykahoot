import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { LeaderRow } from '@viktorina/shared';
import { Avatar } from './avatar/Avatar';
import { CountUp } from './CountUp';

interface Props {
  rows: LeaderRow[];
  limit?: number;
  highlightId?: string;
  /** Анимация перестановки запускается при смене ключа (номер вопроса) */
  animKey?: string | number;
}

/** Топ игроков с анимацией перестановки строк: сначала прежний порядок, потом новый */
export function Leaderboard({ rows, limit = 5, highlightId, animKey }: Props) {
  const [phase, setPhase] = useState<'before' | 'after'>('before');
  useEffect(() => {
    setPhase('before');
    const t = setTimeout(() => setPhase('after'), 900);
    return () => clearTimeout(t);
  }, [animKey]);

  const ordered =
    phase === 'before'
      ? [...rows].sort((a, b) => a.prevRank - b.prevRank)
      : [...rows].sort((a, b) => a.rank - b.rank);
  const visible = ordered.slice(0, limit);

  return (
    <ol className="leaderboard" aria-label="Таблица лидеров">
      <AnimatePresence initial={false}>
        {visible.map((r, i) => {
          const moved = phase === 'after' && r.prevRank > r.rank;
          return (
            <motion.li
              key={r.id}
              layout
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className={`lb-row ${r.id === highlightId ? 'is-me' : ''} ${moved ? 'is-up' : ''}`}
              style={{ ['--row-color' as string]: r.color }}
            >
              <span className="lb-rank">{phase === 'after' ? r.rank : i + 1}</span>
              <Avatar avatar={r.avatar} size={44} />
              <span className="lb-name">{r.name}</span>
              {r.streak >= 2 && (
                <span className="lb-streak" title={`Серия: ${r.streak} подряд`}>
                  🔥 {r.streak}
                </span>
              )}
              {r.gained > 0 && phase === 'before' && <span className="lb-gain">+{r.gained}</span>}
              <span className="lb-score">
                {phase === 'after' ? <CountUp from={r.score - r.gained} to={r.score} duration={0.9} /> : (r.score - r.gained).toLocaleString('ru-RU')}
              </span>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}
