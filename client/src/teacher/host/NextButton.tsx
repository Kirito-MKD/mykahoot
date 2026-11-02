import { motion } from 'framer-motion';
import type { HostView } from '@viktorina/shared';
import { request } from '../../lib/socket';
import { Button } from '../../components/Button';
import { toast } from '../../components/Toast';

function label(view: HostView): { text: string; variant: 'gold' | 'ghost' } | null {
  switch (view.phase) {
    case 'intro':
    case 'question':
      return { text: 'Пропустить', variant: 'ghost' };
    case 'answering':
      return { text: 'Закончить приём ответов', variant: 'ghost' };
    case 'reveal':
      return { text: 'Далее →', variant: 'gold' };
    case 'event':
      return { text: view.mode.kind === 'territory' ? 'Закончить расстановку' : 'Пропустить', variant: 'ghost' };
    case 'leaderboard':
      return { text: view.hasNext ? 'Следующий вопрос →' : 'К итогам →', variant: 'gold' };
    default:
      return null;
  }
}

/** Главная кнопка ведущего — всегда в одном месте, справа внизу. Дублируется пробелом. */
export function NextButton({ view, inline }: { view: HostView; inline?: boolean }) {
  const l = label(view);
  if (!l) return null;
  return (
    <motion.div className={inline ? 'host-next-inline' : 'host-next'} key={view.phase} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: view.phase === 'reveal' ? 0.6 : 0.2 }}>
      <Button
        variant={l.variant}
        size={l.variant === 'gold' ? 'lg' : 'md'}
        onClick={async () => {
          const r = await request(view.phase === 'answering' || view.phase === 'event' ? 'host:skip' : 'host:next');
          if (!r.ok) toast(r.error ?? 'Не получилось', 'error');
        }}
        title="Можно нажать пробел"
      >
        {l.text}
      </Button>
      {l.variant === 'gold' && <span className="host-next-hint">или пробел</span>}
    </motion.div>
  );
}
