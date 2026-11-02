import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { REACTIONS, REACTION_COOLDOWN_MS, type ReactionEmoji } from '@viktorina/shared';
import { request } from '../lib/socket';
import { serverNow, useRemaining } from '../lib/time';
import { sfx } from '../lib/sound';

/** Кнопка «Реакции»: веер из 6 эмодзи, откат 2 секунды с круговым индикатором */
export function ReactionButton({ disabled, initialCooldown }: { disabled: boolean; initialCooldown: number }) {
  const [open, setOpen] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(initialCooldown);
  const left = useRemaining(cooldownUntil > serverNow() ? cooldownUntil : null);
  const cooling = left > 0;
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const send = async (emoji: ReactionEmoji) => {
    setOpen(false);
    sfx.send();
    setCooldownUntil(serverNow() + REACTION_COOLDOWN_MS);
    const res = await request<{ cooldownUntil: number }>('player:react', { emoji });
    if (res.data?.cooldownUntil) setCooldownUntil(res.data.cooldownUntil);
  };

  const frac = cooling ? left / REACTION_COOLDOWN_MS : 0;
  const isDisabled = disabled || cooling;

  return (
    <div className="react-wrap" ref={wrap}>
      <AnimatePresence>
        {open && (
          <motion.div className="react-fan" role="menu" aria-label="Выбери реакцию" initial="closed" animate="open" exit="closed">
            {REACTIONS.map((e, i) => {
              // Кнопка у правого края экрана — раскрываем веер вверх и влево
              const angle = (-178 + (i * 90) / (REACTIONS.length - 1)) * (Math.PI / 180);
              const r = 132;
              return (
                <motion.button
                  key={e}
                  role="menuitem"
                  className="react-emoji"
                  aria-label={`Отправить ${e}`}
                  variants={{
                    closed: { x: 0, y: 0, scale: 0.2, opacity: 0 },
                    open: { x: Math.cos(angle) * r, y: Math.sin(angle) * r, scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 400, damping: 20, delay: i * 0.03 } },
                  }}
                  onClick={() => void send(e)}
                  autoFocus={i === 0}
                >
                  {e}
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        className={`react-btn ${open ? 'is-open' : ''}`}
        disabled={isDisabled}
        aria-expanded={open}
        aria-haspopup="menu"
        title={disabled ? 'Реакции появятся после ответа' : cooling ? 'Подожди пару секунд' : 'Отправить реакцию'}
        onClick={() => setOpen((v) => !v)}
        style={{ ['--cd' as string]: `${frac * 360}deg` }}
      >
        {cooling && <span className="react-cd" aria-hidden="true" />}
        <span aria-hidden="true">😊</span>
        <span className="react-label">Реакции</span>
      </button>
    </div>
  );
}
