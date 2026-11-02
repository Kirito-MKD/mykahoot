import { motion } from 'framer-motion';
import type { HostView } from '@viktorina/shared';
import { useRemaining } from '../../lib/time';
import { Avatar } from '../../components/avatar/Avatar';
import { Emblem } from '../../components/Emblem';

export function Intro({ view }: { view: HostView }) {
  const left = useRemaining(view.phaseEndsAt);
  if (view.settings.teamMode) {
    return (
      <motion.div className="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <h1 className="intro-title">Команды</h1>
        <div className="intro-teams">
          {view.teams.map((t, ti) => {
            const members = view.players.filter((p) => p.teamId === t.id);
            return (
              <motion.div
                key={t.id}
                className="intro-team"
                style={{ background: t.color, boxShadow: `0 8px 0 ${t.dark}` }}
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18, delay: ti * 0.12 }}
              >
                <Emblem emblem={t.emblem} color={t.color} size={64} />
                <h2>{t.name}</h2>
                <ul>
                  {members.map((m, k) => (
                    <motion.li key={m.id} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4 + ti * 0.1 + k * 0.05 }}>
                      <Avatar avatar={m.avatar} size={34} />
                      {m.name}
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div className="intro intro-solo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <h1 className="intro-title">Приготовьтесь!</h1>
      <motion.span key={Math.ceil(left / 1000)} className="intro-count" initial={{ scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        {Math.max(1, Math.ceil(left / 1000))}
      </motion.span>
      <p>{view.questionCount} вопросов · {view.players.length} участников</p>
    </motion.div>
  );
}
