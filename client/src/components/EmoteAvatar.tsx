import { motion, useAnimationControls, type TargetAndTransition } from 'framer-motion';
import { useEffect } from 'react';
import type { Avatar as AvatarData, EmoteId } from '@viktorina/shared';
import { Avatar } from './avatar/Avatar';
import { useReducedMotionPref } from '../lib/motion';

/** Анимации эмоций — как танцы персонажей в играх */
const EMOTE_ANIM: Record<EmoteId, TargetAndTransition> = {
  dance: {
    rotate: [0, -12, 12, -12, 12, -8, 8, 0],
    y: [0, -10, 0, -10, 0, -10, 0, 0],
    transition: { duration: 2.2, ease: 'easeInOut' },
  },
  jump: {
    y: [0, -60, 0, -45, 0, -30, 0],
    scaleY: [1, 1.08, 0.86, 1.06, 0.9, 1.04, 1],
    transition: { duration: 1.8, ease: 'easeOut' },
  },
  spin: {
    rotateY: [0, 360, 720],
    y: [0, -24, 0],
    transition: { duration: 1.6, ease: 'easeInOut' },
  },
  wave: {
    rotate: [0, 10, -6, 10, -6, 10, 0],
    x: [0, 6, -4, 6, -4, 6, 0],
    transition: { duration: 1.8, ease: 'easeInOut' },
  },
  flex: {
    scale: [1, 1.18, 1.05, 1.2, 1],
    y: [0, -12, 0, -12, 0],
    transition: { duration: 1.6, ease: 'easeInOut' },
  },
  floss: {
    x: [0, -26, 26, -26, 26, -26, 26, 0],
    rotate: [0, 8, -8, 8, -8, 8, -8, 0],
    transition: { duration: 2, ease: 'linear' },
  },
};

export function EmoteAvatar({
  avatar,
  size,
  emote,
  idle,
}: {
  avatar: AvatarData;
  size: number;
  emote: { emote: EmoteId; at: number } | null | undefined;
  idle?: boolean;
}) {
  const controls = useAnimationControls();
  const reduced = useReducedMotionPref();
  useEffect(() => {
    if (!emote) return;
    if (reduced) {
      void controls.start({ scale: [1, 1.08, 1], transition: { duration: 0.6 } });
      return;
    }
    void controls.start(EMOTE_ANIM[emote.emote]);
  }, [emote?.at, emote?.emote, controls, reduced]);
  return (
    <motion.div animate={controls} style={{ transformOrigin: '50% 100%', display: 'inline-block', perspective: 600 }}>
      <Avatar avatar={avatar} size={size} idle={idle && !emote} />
    </motion.div>
  );
}
