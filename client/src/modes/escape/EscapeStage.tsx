import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import type { EscapeState, HostView } from '@viktorina/shared';
import { useHost } from '../../store/hostStore';
import { serverNow, useRemaining } from '../../lib/time';
import { useReducedMotionPref } from '../../lib/motion';
import { Avatar } from '../../components/avatar/Avatar';
import { EscapeWorld } from './world';
import './escape.css';

function LevelTimer({ s, at }: { s: EscapeState; at: number }) {
  // Часы уровня идут только во время вопроса; иначе показываем замершее значение
  const endsAt = s.clockRunning ? at + s.levelRemainingMs : null;
  const live = useRemaining(endsAt, 4);
  const ms = s.clockRunning ? live : s.levelRemainingMs;
  const sec = Math.ceil(ms / 1000);
  const mm = Math.floor(sec / 60);
  const ss = String(sec % 60).padStart(2, '0');
  return (
    <div className={`es-timer ${sec <= 20 ? 'is-low' : ''} ${s.clockRunning ? '' : 'is-paused'}`} title="Когда время выйдет, робот доберётся до двери">
      <span>⏱</span>
      {mm}:{ss}
    </div>
  );
}

function RobotPos({ s, at }: { s: EscapeState; at: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const step = () => {
      const elapsed = s.clockRunning ? (serverNow() - at) / 1000 : 0;
      const pos = Math.min(s.trackLength, s.robotPos + s.robotSpeed * elapsed);
      if (ref.current) ref.current.style.left = `${Math.max(0, (pos / s.trackLength) * 100)}%`;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [s, at]);
  return (
    <div ref={ref} className="es-bar-robot" aria-label="Робот">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <rect x="5" y="7" width="24" height="20" rx="6" fill="#9AA3B5" stroke="#1A1033" strokeWidth="3" />
        <circle cx="13" cy="16" r="3" fill="#FF3B3B" />
        <circle cx="21" cy="16" r="3" fill="#FF3B3B" />
        <path d="M17 7 V2" stroke="#1A1033" strokeWidth="3" />
      </svg>
    </div>
  );
}

/** Полоса прогресса: где каждый персонаж между стартом и дверью */
function ProgressBar({ s, at }: { s: EscapeState; at: number }) {
  const groups = new Map<number, typeof s.runners>();
  for (const r of s.runners) {
    if (r.status === 'caught') continue;
    const k = r.status === 'escaped' ? s.trackLength : r.pos;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return (
    <div className="es-bar" role="img" aria-label="Полоса прогресса до двери">
      <div className="es-bar-track">
        {s.obstacles.map((o) => (
          <span key={o.cell} className={`es-bar-obs is-${o.kind}`} style={{ left: `${(o.cell / s.trackLength) * 100}%` }} />
        ))}
        {Array.from({ length: s.trackLength + 1 }, (_, i) => (
          <span key={i} className="es-bar-tick" style={{ left: `${(i / s.trackLength) * 100}%` }} />
        ))}
      </div>
      <RobotPos s={s} at={at} />
      <AnimatePresence>
        {[...groups.entries()].flatMap(([k, list]) =>
          list.map((r, i) => (
            <motion.div
              key={r.playerId}
              className="es-bar-runner"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: (i % 3) * -18, left: `${(k / s.trackLength) * 100}%`, x: Math.floor(i / 3) * 14 }}
              exit={{ opacity: 0, y: 40, scale: 0.6, transition: { duration: 0.6 } }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              style={{ ['--rc' as string]: r.color, zIndex: 10 - (i % 3) }}
              title={r.name}
            >
              <Avatar avatar={r.avatar} size={30} />
            </motion.div>
          )),
        )}
      </AnimatePresence>
      <span className="es-bar-door" aria-hidden="true">
        🚪
      </span>
    </div>
  );
}

export function EscapeStage({ view }: { view: HostView }) {
  const s = view.mode as EscapeState;
  const box = useRef<HTMLDivElement>(null);
  const world = useRef<EscapeWorld | null>(null);
  const reduced = useReducedMotionPref();
  const caught = useHost((st) => st.caughtTick);
  const at = useRef(serverNow());
  at.current = view.serverNow;

  useEffect(() => {
    const w = new EscapeWorld(box.current!, reduced);
    world.current = w;
    return () => {
      w.destroy();
      world.current = null;
    };
  }, [reduced]);

  useEffect(() => {
    world.current?.update(s);
  }, [s]);

  useEffect(() => {
    if (caught) world.current?.caught(caught.playerId);
  }, [caught]);

  const escaped = s.runners.filter((r) => r.status === 'escaped').length;
  const banner = s.banner;
  const transition = banner?.kind === 'levelStart' && view.phase === 'event';

  return (
    <div className="es">
      <div className="es-hud">
        <div className="es-level">
          Уровень <b>{s.level}</b> из {s.levels}
          <span className="es-levels">
            {Array.from({ length: s.levels }, (_, i) => (
              <span key={i} className={`es-dot ${s.levelResults[i] ?? (i + 1 === s.level ? 'current' : '')}`} />
            ))}
          </span>
        </div>
        <ProgressBar s={s} at={at.current} />
        <div className="es-goal">
          🚪 {escaped}/{s.requiredToPass}
        </div>
        <LevelTimer s={s} at={at.current} />
      </div>
      <div className="es-canvas" ref={box} />
      <AnimatePresence>
        {banner && banner.kind !== 'levelStart' && (
          <motion.div
            key={banner.kind + s.level}
            className={`es-banner is-${banner.kind}`}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16 }}
          >
            <h2>{banner.title}</h2>
            {banner.subtitle && <p>{banner.subtitle}</p>}
          </motion.div>
        )}
        {transition && (
          <motion.div key={`t${s.level}`} className="es-transition" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
            <motion.h2 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
              {banner!.title}
            </motion.h2>
            {banner!.subtitle && <p>{banner!.subtitle}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
