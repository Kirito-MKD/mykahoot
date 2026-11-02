import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TOWER_BLOCK_W, TOWER_FALL_RATIO, TOWER_PERFECT_RATIO, darken, lighten, type PlayerView } from '@viktorina/shared';
import { request } from '../lib/socket';
import { sfx } from '../lib/sound';
import { serverNow, useRemaining } from '../lib/time';
import { useReducedMotionPref } from '../lib/motion';

type TowerInfo = NonNullable<PlayerView['tower']>;

const W = 420;
const H = 440;
const BW = 120;
const BH = 34;
const SCALE = BW / TOWER_BLOCK_W;
const HANG_Y = 70;
const O = '#1A1033';

function shade(hex: string, hue: number): string {
  return hue >= 0 ? lighten(hex, hue / 60) : darken(hex, -hue / 60);
}

function Block({ x, y, color, name, rotate = 0 }: { x: number; y: number; color: string; name?: string; rotate?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <rect x={-BW / 2} y={-BH / 2} width={BW} height={BH} rx={6} fill={color} stroke={O} strokeWidth={3} />
      <rect x={-BW / 2 + 5} y={-BH / 2 + 4} width={BW - 10} height={6} rx={3} fill="rgba(255,255,255,0.35)" />
      {name && (
        <text y={7} textAnchor="middle" className="td-name">
          {name.length > 11 ? name.slice(0, 10) + '…' : name}
        </text>
      )}
    </g>
  );
}

type Stage = 'swing' | 'falling' | 'landed' | 'fell';

/**
 * Мини-игра «поставь блок»: блок качается над верхушкой башни, ребёнок нажимает —
 * блок падает. Ровно — башня растёт, сильно мимо — блок срывается вниз.
 */
export function TowerDrop({ tower }: { tower: TowerInfo }) {
  const reduced = useReducedMotionPref();
  const [stage, setStage] = useState<Stage>('swing');
  const [dropX, setDropX] = useState(0);
  const [result, setResult] = useState<'perfect' | 'ok' | 'fail' | null>(null);
  const blockRef = useRef<SVGGElement>(null);
  const heightAtDrop = useRef(0);
  const xRef = useRef(0);
  const start = useRef(performance.now());
  const left = useRemaining(tower.dropEndsAt);

  // Чем выше башня — тем быстрее качается блок
  const period = Math.max(1100, 1900 - tower.height * 60);
  const amp = BW * 1.1;

  useEffect(() => {
    if (stage !== 'swing') return;
    let raf = 0;
    const step = (t: number) => {
      const phase = ((t - start.current) % period) / period;
      // Треугольная волна — постоянная скорость, легче поймать момент
      const tri = phase < 0.5 ? phase * 4 - 1 : 3 - phase * 4;
      xRef.current = tri * amp;
      blockRef.current?.setAttribute('transform', `translate(${W / 2 + xRef.current} ${HANG_Y})`);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [stage, period, amp]);

  const topCount = tower.top.length;
  const topY = H - 46 - topCount * BH; // верхняя кромка башни
  const topOffset = tower.top[topCount - 1]?.offset ?? 0;

  const drop = useCallback(async () => {
    if (stage !== 'swing') return;
    const x = xRef.current;
    heightAtDrop.current = tower.height;
    setDropX(x);
    setStage('falling');
    const rel = x / BW;
    const predicted: 'perfect' | 'ok' | 'fail' = Math.abs(rel) > TOWER_FALL_RATIO ? 'fail' : Math.abs(rel) < TOWER_PERFECT_RATIO ? 'perfect' : 'ok';
    window.setTimeout(() => {
      setStage(predicted === 'fail' ? 'fell' : 'landed');
      setResult(predicted);
      if (predicted === 'fail') sfx.fall();
      else if (predicted === 'perfect') sfx.perfect();
      else sfx.thud();
    }, reduced ? 50 : 380);
    const res = await request<{ result: 'perfect' | 'ok' | 'fail' }>('player:drop', { rel });
    if (res.ok && res.data) setResult(res.data.result);
  }, [stage, reduced, tower.height]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        void drop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drop]);

  // Время вышло — сервер поставит блок сам
  const timedOut = tower.dropEndsAt !== null && serverNow() > tower.dropEndsAt && stage === 'swing';

  const towerBlocks = tower.top.map((b, i) => ({
    x: W / 2 + (b.offset - topOffset) * SCALE,
    y: H - 46 - i * BH - BH / 2,
    color: shade(tower.color, b.hue),
    name: b.playerName,
  }));

  const landY = topY - BH / 2;
  const message =
    result === 'perfect' ? 'Идеально! 🎯' : result === 'ok' ? 'Есть! Башня растёт' : result === 'fail' ? 'Упал! Слишком криво 😬' : timedOut ? 'Время вышло…' : null;

  return (
    <div className="td">
      <div className="td-head">
        <h1>{stage === 'swing' ? 'Поставь свой блок!' : message}</h1>
        <p className="pg-sub">
          {stage === 'swing' ? 'Нажми, когда блок ровно над башней. Можно мышкой, пробелом или Enter.' : 'Смотри на экран — башня растёт!'}
        </p>
        {stage === 'swing' && (
          <div className="pg-timebar" role="timer" aria-label={`Осталось ${Math.ceil(left / 1000)} секунд`}>
            <div className="pg-timebar-fill" style={{ transform: `scaleX(${Math.max(0, Math.min(1, left / tower.dropTotalMs))})` }} />
            <span className="pg-timebar-num">{Math.ceil(left / 1000)}</span>
          </div>
        )}
      </div>
      <button className="td-stage" onClick={() => void drop()} disabled={stage !== 'swing'} aria-label="Бросить блок">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMax meet">
          {/* Направляющая — где верхушка башни */}
          <line x1={W / 2} y1={HANG_Y + 30} x2={W / 2} y2={topY} stroke="rgba(255,255,255,0.35)" strokeWidth={3} strokeDasharray="6 8" />
          {/* Платформа */}
          <path d={`M${W / 2 - 110} ${H - 46} H${W / 2 + 110} L${W / 2 + 80} ${H - 6} H${W / 2 - 80} Z`} fill="#5B5577" stroke={O} strokeWidth={4} strokeLinejoin="round" />
          <rect x={W / 2 - 104} y={H - 50} width={208} height={12} rx={5} fill={tower.color} stroke={O} strokeWidth={3} />
          {towerBlocks.map((b, i) => (
            <Block key={i} x={b.x} y={b.y} color={b.color} name={b.name} />
          ))}
          {/* Кран и качающийся блок */}
          {stage === 'swing' && (
            <g ref={blockRef} transform={`translate(${W / 2} ${HANG_Y})`}>
              <line x1={0} y1={-70} x2={0} y2={-BH / 2} stroke={O} strokeWidth={3} />
              <circle cx={0} cy={-70} r={6} fill={O} />
              <Block x={0} y={0} color={tower.color} />
            </g>
          )}
          <AnimatePresence>
            {stage !== 'swing' && !(stage === 'landed' && tower.height > heightAtDrop.current) && (
              <motion.g
                key="dropped"
                initial={{ x: W / 2 + dropX, y: HANG_Y, rotate: 0, opacity: 1 }}
                animate={
                  stage === 'falling'
                    ? { y: landY }
                    : stage === 'fell'
                      ? { y: H + 120, x: W / 2 + dropX + Math.sign(dropX || 1) * 120, rotate: Math.sign(dropX || 1) * 120, opacity: 0.9 }
                      : { y: landY, x: W / 2 + (result === 'perfect' ? 0 : dropX) }
                }
                transition={
                  stage === 'falling'
                    ? { duration: reduced ? 0.01 : 0.36, ease: 'easeIn' }
                    : stage === 'fell'
                      ? { duration: 1, ease: [0.3, 0, 0.8, 0.6] }
                      : { type: 'spring', stiffness: 500, damping: 14 }
                }
              >
                <Block x={0} y={0} color={tower.color} />
              </motion.g>
            )}
          </AnimatePresence>
        </svg>
        {stage === 'swing' && <span className="td-hint">ЖМИ!</span>}
      </button>
      {result === 'perfect' && !reduced && <div className="td-burst" aria-hidden="true" />}
    </div>
  );
}
