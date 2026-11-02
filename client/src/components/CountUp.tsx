import { animate, useMotionValue, useTransform, motion } from 'framer-motion';
import { useEffect } from 'react';

/** Число, которое «набегает» от from до to */
export function CountUp({ from = 0, to, duration = 1.2, delay = 0 }: { from?: number; to: number; duration?: number; delay?: number }) {
  const v = useMotionValue(from);
  const text = useTransform(v, (x) => Math.round(x).toLocaleString('ru-RU'));
  useEffect(() => {
    const c = animate(v, to, { duration, delay, ease: 'easeOut' });
    return () => c.stop();
  }, [to, duration, delay, v]);
  return <motion.span>{text}</motion.span>;
}
