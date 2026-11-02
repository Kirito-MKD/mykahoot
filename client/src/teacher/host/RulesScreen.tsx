import { motion } from 'framer-motion';
import { MODE_INFO, MODE_RULES, type HostView } from '@viktorina/shared';
import { useRemaining } from '../../lib/time';
import { ModeIcon } from '../GameSetup';

/** Экран правил перед игрой — идёт сам по таймеру, пропускается кнопкой или пробелом */
export function RulesScreen({ view }: { view: HostView }) {
  const mode = view.settings.mode;
  const left = useRemaining(view.phaseEndsAt);
  const total = 16000;
  return (
    <motion.div className="rules" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -20 }}>
      <motion.div className="rules-head" initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <ModeIcon mode={mode} size={84} />
        <div>
          <span className="rules-kicker">Как играть</span>
          <h1>{MODE_INFO[mode].title}</h1>
        </div>
      </motion.div>
      <ol className="rules-list">
        {MODE_RULES[mode].map((r, i) => (
          <motion.li
            key={r.title}
            className="rules-card"
            initial={{ opacity: 0, y: 40, rotate: i % 2 ? 3 : -3 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.25 + i * 0.35 }}
          >
            <span className="rules-num">{i + 1}</span>
            <span className="rules-icon" aria-hidden="true">
              {r.icon}
            </span>
            <h2>{r.title}</h2>
            <p>{r.text}</p>
          </motion.li>
        ))}
      </ol>
      <div className="rules-foot">
        <div className="rules-bar" aria-hidden="true">
          <div style={{ transform: `scaleX(${Math.max(0, Math.min(1, left / total))})` }} />
        </div>
        <span>Начнём через {Math.ceil(left / 1000)} с — или нажми «Пропустить»</span>
      </div>
    </motion.div>
  );
}
