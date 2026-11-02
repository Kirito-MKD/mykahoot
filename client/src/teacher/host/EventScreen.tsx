import { motion } from 'framer-motion';
import type { HostView } from '@viktorina/shared';
import { TerritoryEvent } from '../../modes/territory/TerritoryEvent';
import { TowerScene } from '../../modes/tower/TowerScene';

/** Игровое событие режима после показа ответа */
export function EventScreen({ view }: { view: HostView }) {
  return (
    <motion.div className="event" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {view.mode.kind === 'territory' && <TerritoryEvent view={view} />}
      {view.mode.kind === 'tower' && <TowerScene view={view} animate />}
    </motion.div>
  );
}
