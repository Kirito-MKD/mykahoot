import { AnimatePresence, motion } from 'framer-motion';
import { useHost } from '../../store/hostStore';
import { Avatar } from '../../components/avatar/Avatar';
import { useReducedMotionPref } from '../../lib/motion';

/** Реакции учеников: всплывают снизу вверх рядом с аватаром отправителя, покачиваясь, и растворяются */
export function ReactionsLayer() {
  const reactions = useHost((s) => s.reactions);
  const remove = useHost((s) => s.removeReaction);
  const reduced = useReducedMotionPref();
  return (
    <div className="reactions" aria-hidden="true">
      <AnimatePresence>
        {reactions.map((r) => (
          <motion.div
            key={r.id}
            className="reaction"
            style={{ right: `${r.x}%`, ['--rc' as string]: r.color }}
            initial={{ y: 0, opacity: 0, scale: 0.6 }}
            animate={
              reduced
                ? { opacity: [0, 1, 1, 0], y: -40 }
                : { y: -window.innerHeight * 0.62, opacity: [0, 1, 1, 0], scale: 1, x: [0, 14, -12, 10, -6, 0] }
            }
            transition={{ duration: reduced ? 2 : 3.6, ease: 'easeOut', times: reduced ? undefined : undefined }}
            onAnimationComplete={() => remove(r.id)}
          >
            <span className="reaction-emoji">{r.emoji}</span>
            <span className="reaction-who">
              <Avatar avatar={r.avatar} size={26} />
              {r.name}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
