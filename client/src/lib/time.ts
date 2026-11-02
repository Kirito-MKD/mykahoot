import { useEffect, useRef, useState } from 'react';

/** Смещение часов сервера относительно клиента. Сервер — источник истины по времени. */
let offset = 0;
let initialized = false;

export function syncServerTime(serverNow: number): void {
  const sample = serverNow - Date.now();
  if (!initialized || Math.abs(sample - offset) > 2000) {
    offset = sample;
    initialized = true;
    return;
  }
  // Предпочитаем выборку с наименьшей задержкой доставки — она ближе к истине
  offset = Math.max(sample, offset - 30);
}

export function serverNow(): number {
  return Date.now() + offset;
}

/** Оставшееся время до момента endsAt (по часам сервера), обновляется каждый кадр */
export function useRemaining(endsAt: number | null | undefined, fps = 30): number {
  const [left, setLeft] = useState(() => (endsAt ? Math.max(0, endsAt - serverNow()) : 0));
  const raf = useRef(0);
  useEffect(() => {
    if (!endsAt) {
      setLeft(0);
      return;
    }
    let last = 0;
    const step = (t: number) => {
      if (t - last >= 1000 / fps) {
        last = t;
        const v = Math.max(0, endsAt - serverNow());
        setLeft(v);
        if (v <= 0) return;
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [endsAt, fps]);
  return left;
}
