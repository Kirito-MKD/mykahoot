import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../lib/motion';

const COLORS = ['#E21B3C', '#1368CE', '#D89E00', '#26890C', '#FFC531', '#FF7AC6', '#7FD3F7', '#ffffff'];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  shape: 0 | 1;
}

/** Конфетти сверху на canvas. При prefers-reduced-motion не рисуется. */
export function Confetti({ count = 220, duration = 6000 }: { count?: number; duration?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let w = (canvas.width = canvas.offsetWidth * devicePixelRatio);
    let h = (canvas.height = canvas.offsetHeight * devicePixelRatio);
    const onResize = () => {
      w = canvas.width = canvas.offsetWidth * devicePixelRatio;
      h = canvas.height = canvas.offsetHeight * devicePixelRatio;
    };
    window.addEventListener('resize', onResize);
    const make = (initial: boolean): Piece => ({
      x: Math.random() * w,
      y: initial ? -Math.random() * h * 0.8 : -20,
      vx: (Math.random() - 0.5) * 2.2 * devicePixelRatio,
      vy: (2 + Math.random() * 3) * devicePixelRatio,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.25,
      w: (8 + Math.random() * 8) * devicePixelRatio,
      h: (5 + Math.random() * 6) * devicePixelRatio,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      shape: Math.random() < 0.3 ? 1 : 0,
    });
    let pieces = Array.from({ length: count }, () => make(true));
    const start = performance.now();
    let last = start;
    let raf = 0;
    let slowFrames = 0;
    const frame = (t: number) => {
      const dt = Math.min(3, (t - last) / 16.67);
      last = t;
      // Если кадры проседают ниже 30 fps — уменьшаем число частиц
      if (dt > 2) slowFrames++;
      if (slowFrames > 10 && pieces.length > 60) {
        pieces = pieces.slice(0, Math.floor(pieces.length * 0.6));
        slowFrames = 0;
      }
      ctx.clearRect(0, 0, w, h);
      const running = t - start < duration;
      for (const p of pieces) {
        p.x += p.vx * dt + Math.sin((t / 400) + p.rot) * 0.6;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.y > h + 20 && running) Object.assign(p, make(false));
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 1) {
          ctx.beginPath();
          ctx.arc(0, 0, p.h / 1.4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)) + 1);
        }
        ctx.restore();
      }
      if (running || pieces.some((p) => p.y < h + 20)) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [count, duration]);
  return <canvas ref={ref} className="confetti-canvas" aria-hidden="true" />;
}
