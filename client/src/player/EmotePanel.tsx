import { motion } from 'framer-motion';
import { useState } from 'react';
import { EMOTES, EMOTE_COOLDOWN_MS, EMOTE_INFO, type Avatar as AvatarData, type EmoteId } from '@viktorina/shared';
import { request } from '../lib/socket';
import { sfx } from '../lib/sound';
import { EmoteAvatar } from '../components/EmoteAvatar';

/** Эмоции на пьедестале: ребёнок выбирает танец — его персонаж танцует на экране класса */
export function EmotePanel({ avatar }: { avatar: AvatarData }) {
  const [current, setCurrent] = useState<{ emote: EmoteId; at: number } | null>(null);
  const [busyUntil, setBusyUntil] = useState(0);
  const send = async (emote: EmoteId) => {
    if (Date.now() < busyUntil) return;
    setBusyUntil(Date.now() + EMOTE_COOLDOWN_MS);
    setCurrent({ emote, at: Date.now() });
    sfx.send();
    await request('player:emote', { emote });
  };
  return (
    <div className="emo">
      <div className="emo-preview">
        <EmoteAvatar avatar={avatar} size={120} emote={current} />
      </div>
      <div className="emo-side">
        <p className="emo-title">Станцуй на экране класса!</p>
        <div className="emo-grid" role="group" aria-label="Эмоции персонажа">
          {EMOTES.map((e) => (
            <motion.button key={e} className="emo-btn" whileTap={{ scale: 0.9 }} onClick={() => void send(e)} aria-label={EMOTE_INFO[e].label}>
              <span aria-hidden="true">{EMOTE_INFO[e].icon}</span>
              {EMOTE_INFO[e].label}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
