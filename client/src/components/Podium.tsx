import { motion } from 'framer-motion';
import { useEffect } from 'react';
import type { PlayerResult } from '@viktorina/shared';
import { Avatar } from './avatar/Avatar';
import { sfx } from '../lib/sound';

/** Пьедестал: столбики выезжают снизу — сначала третье место, потом второе, потом первое */
export function Podium({ players, onRevealed }: { players: PlayerResult[]; onRevealed?: () => void }) {
  const top = players.slice(0, 3);
  // Порядок на экране: 2 — 1 — 3
  const slots = [
    { p: top[1], place: 2, height: 62, delay: 1.1 },
    { p: top[0], place: 1, height: 82, delay: 2.2 },
    { p: top[2], place: 3, height: 46, delay: 0 },
  ];
  useEffect(() => {
    const t = setTimeout(() => {
      sfx.fanfare();
      onRevealed?.();
    }, 2400);
    return () => clearTimeout(t);
  }, [onRevealed]);
  return (
    <div className="podium">
      {slots.map(({ p, place, height, delay }) => (
        <div key={place} className={`podium-slot place-${place}`}>
          {p && (
            <motion.div
              className="podium-player"
              initial={{ opacity: 0, y: 40, scale: 0.6 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16, delay: delay + 0.55 }}
            >
              <Avatar avatar={p.avatar} size={place === 1 ? 150 : 118} idle />
              <span className="podium-name">{p.name}</span>
              <span className="podium-score">{p.score.toLocaleString('ru-RU')}</span>
            </motion.div>
          )}
          <motion.div
            className="podium-bar"
            initial={{ height: 0 }}
            animate={{ height: `${height}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 18, delay }}
          >
            <span className="podium-place">{place}</span>
          </motion.div>
        </div>
      ))}
    </div>
  );
}
