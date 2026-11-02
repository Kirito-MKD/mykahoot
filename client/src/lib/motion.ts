import { useEffect, useState } from 'react';

export const spring = { type: 'spring', stiffness: 300, damping: 20 } as const;
export const softSpring = { type: 'spring', stiffness: 180, damping: 22 } as const;

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function useReducedMotionPref(): boolean {
  const [v, setV] = useState(prefersReducedMotion);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setV(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return v;
}
