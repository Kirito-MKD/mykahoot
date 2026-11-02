import { motion } from 'framer-motion';
import type { PlayerView } from '@viktorina/shared';
import { Avatar } from '../components/avatar/Avatar';
import { Emblem } from '../components/Emblem';
import { ReactionButton } from './ReactionButton';
import { MuteButton } from '../components/SoundButtons';

/** Нижняя полоса ученика: аватар, имя, флаги, реакции — всегда на месте */
export function BottomBar({ view }: { view: PlayerView }) {
  const inGame = view.phase !== 'lobby';
  return (
    <footer className="pg-bar">
      <div className="pg-bar-me">
        <Avatar avatar={view.me.avatar} crop="head" size={46} />
        <div className="stack" style={{ minWidth: 0 }}>
          <span className="pg-bar-name">{view.me.name}</span>
          {view.team ? (
            <span className="pg-bar-team">
              <Emblem emblem={view.team.emblem} color={view.team.color} size={18} /> {view.team.name}
            </span>
          ) : inGame && view.me.score > 0 ? (
            <span className="pg-bar-team">{view.me.rank}-е место</span>
          ) : null}
        </div>
      </div>
      {inGame && (
        <div className="pg-bar-score" aria-label="Твои очки">
          {view.me.score.toLocaleString('ru-RU')}
        </div>
      )}
      <div className="pg-bar-right">
        {view.mode === 'territory' && inGame && (
          <motion.span key={view.me.flags} className="pg-flags" initial={{ scale: 1.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 10 }} aria-label={`Флагов: ${view.me.flags}`}>
            {view.me.flags} ×🚩
          </motion.span>
        )}
        <MuteButton variant="quiet" />
        <ReactionButton disabled={view.phase === 'answering'} initialCooldown={view.reactionCooldownUntil} />
      </div>
    </footer>
  );
}
