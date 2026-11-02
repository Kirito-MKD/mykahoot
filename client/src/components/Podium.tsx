import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { EmoteId, PlayerResult } from '@viktorina/shared';
import { sfx } from '../lib/sound';
import { useHost } from '../store/hostStore';
import { EmoteAvatar } from './EmoteAvatar';

const SLOTS = [
  { index: 1, place: 2, height: 30, delay: 1.1 },
  { index: 0, place: 1, height: 42, delay: 2.2 },
  { index: 2, place: 3, height: 20, delay: 0 },
] as const;

/**
 * Пьедестал: столбики выезжают снизу — сначала третье место, потом второе, потом первое.
 * Первое место — самое высокое. Ученики могут запускать эмоции со своих компьютеров.
 */
export function Podium({ players, onRevealed }: { players: PlayerResult[]; onRevealed?: () => void }) {
  const emotes = useHost((s) => s.emotes);
  const [auto, setAuto] = useState<{ emote: EmoteId; at: number } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      sfx.fanfare();
      onRevealed?.();
      // Победитель сам пускается в пляс
      setAuto({ emote: 'dance', at: Date.now() });
    }, 2400);
    return () => clearTimeout(t);
  }, [onRevealed]);

  const others = players.slice(3, 27);

  return (
    <div className="podium-wrap">
      <div className="podium">
        {SLOTS.map(({ index, place, height, delay }) => {
          const p = players[index];
          const em = p ? (emotes[p.id] ?? (place === 1 ? auto : null)) : null;
          return (
            <div key={place} className={`podium-slot place-${place}`}>
              {p && (
                <motion.div
                  className="podium-player"
                  initial={{ opacity: 0, y: 40, scale: 0.6 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 16, delay: delay + 0.55 }}
                >
                  <div className="podium-avatar">
                    <EmoteAvatar avatar={p.avatar} size={place === 1 ? 170 : 130} emote={em} idle />
                  </div>
                  <span className="podium-name">{p.name}</span>
                  <span className="podium-score">{p.score.toLocaleString('ru-RU')}</span>
                </motion.div>
              )}
              <motion.div
                className="podium-bar"
                style={{ height: `${height}%` }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ type: 'spring', stiffness: 120, damping: 18, delay }}
              >
                <span className="podium-place">{place}</span>
              </motion.div>
            </div>
          );
        })}
      </div>
      {others.length > 0 && (
        <motion.div className="dancefloor" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3 }}>
          <span className="dancefloor-label">Танцпол</span>
          {others.map((p) => (
            <div key={p.id} className="dancefloor-item" title={`${p.rank}. ${p.name}`}>
              <EmoteAvatar avatar={p.avatar} size={70} emote={emotes[p.id]} />
              <span>{p.name}</span>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
