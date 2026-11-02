import { useEffect, useRef } from 'react';
import { useRemaining } from '../lib/time';
import { sfx } from '../lib/sound';

interface Props {
  endsAt: number | null;
  totalMs: number;
  size?: number;
  /** Тикать последние 5 секунд (только на экране преподавателя) */
  ticking?: boolean;
}

/** Таймер-кольцо: сервер присылает момент окончания, клиент только рисует */
export function TimerRing({ endsAt, totalMs, size = 120, ticking = false }: Props) {
  const left = useRemaining(endsAt);
  const secs = Math.ceil(left / 1000);
  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    if (!ticking || !endsAt) return;
    if (secs <= 5 && secs >= 1 && lastTick.current !== secs) {
      lastTick.current = secs;
      sfx.tick(secs <= 2);
    }
  }, [secs, ticking, endsAt]);

  const r = 44;
  const c = 2 * Math.PI * r;
  const frac = totalMs > 0 ? Math.max(0, Math.min(1, left / totalMs)) : 0;
  const urgent = secs <= 5;
  return (
    <div className={`timer-ring ${urgent ? 'is-urgent' : ''}`} style={{ width: size, height: size }} role="timer" aria-label={`Осталось ${secs} секунд`}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <circle cx={50} cy={50} r={r} fill="var(--purple-ink)" stroke="rgba(255,255,255,0.18)" strokeWidth={9} />
        <circle
          cx={50}
          cy={50}
          r={r}
          fill="none"
          stroke={urgent ? 'var(--bad)' : 'var(--gold)'}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span className="timer-ring-num" style={{ fontSize: size * 0.36 }}>
        {secs}
      </span>
    </div>
  );
}
