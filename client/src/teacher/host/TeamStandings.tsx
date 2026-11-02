import { motion } from 'framer-motion';
import type { TeamStanding } from '@viktorina/shared';
import { Emblem } from '../../components/Emblem';

export function TeamStandings({ standings }: { standings: TeamStanding[] }) {
  const max = Math.max(1, ...standings.map((s) => s.value));
  return (
    <ol className="ts" aria-label="Команды">
      {standings.map((s, i) => (
        <motion.li key={s.teamId} className="ts-row" layout initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
          <Emblem emblem={s.emblem} color={s.color} size={40} />
          <div className="ts-main">
            <span className="ts-name">
              {i === 0 && s.value > 0 ? '👑 ' : ''}
              {s.name}
            </span>
            <div className="ts-bar">
              <motion.div
                className="ts-fill"
                style={{ background: s.color }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(3, (s.value / max) * 100)}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.2 + i * 0.08 }}
              />
            </div>
          </div>
          <span className="ts-val">
            <b>{s.value.toLocaleString('ru-RU')}</b>
            <small>{s.valueLabel}</small>
          </span>
        </motion.li>
      ))}
    </ol>
  );
}
