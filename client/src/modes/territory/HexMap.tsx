import { motion } from 'framer-motion';
import { memo, useMemo, useRef, useState } from 'react';
import { BASE_CAPTURE_COST, hexCenter, hexNeighbors, hexPolygon, type TerritoryCell, type TerritoryState } from '@viktorina/shared';
import { useReducedMotionPref } from '../../lib/motion';
import './territory.css';

const SIZE = 30;
const GRASS = '#8BCB6A';
const GRASS_DARK = '#5E9E45';
const OUTLINE = '#1A1033';

interface Interactive {
  ownerId: string;
  flags: number;
  onPick: (cell: number) => void;
}

interface Props {
  state: TerritoryState;
  interactive?: Interactive;
  /** Подписывать гексы именами (на большом экране) */
  labels?: boolean;
  className?: string;
}

function hexPoints(size: number): string {
  return hexPolygon(0, 0, size);
}

const SHARDS = Array.from({ length: 7 }, (_, k) => {
  const a = (Math.PI * 2 * k) / 7 + 0.3;
  return { dx: Math.cos(a) * 46, dy: Math.sin(a) * 46, rot: (k % 2 ? 1 : -1) * (120 + k * 20) };
});

const Cell = memo(function Cell({
  cell,
  color,
  prevColor,
  labels,
  allowed,
  cost,
  interactive,
  onPick,
  reduced,
  cols,
}: {
  cols: number;
  cell: TerritoryCell;
  color: string | null;
  prevColor: string | null;
  labels: boolean;
  allowed: boolean;
  cost: number;
  interactive: boolean;
  onPick?: (i: number) => void;
  reduced: boolean;
}) {
  const { x, y } = hexCenter(cell.i, SIZE, cols);
  const [hover, setHover] = useState(false);
  // Вспышка и осколки — только для перехвата, случившегося на глазах, а не при повторном показе карты
  const mountRev = useRef(cell.rev);
  const recaptured = !!prevColor && prevColor !== color && cell.rev > mountRev.current;
  const name = cell.playerName ?? '';
  const short = name.length > 7 ? name.slice(0, 6) + '…' : name;
  return (
    <g
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
      className={`hex ${interactive ? (allowed ? 'is-allowed' : 'is-blocked') : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={interactive && allowed ? () => onPick?.(cell.i) : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive && allowed ? 0 : undefined}
      aria-label={interactive ? `Клетка ${cell.i + 1}${cell.playerName ? `, занята: ${cell.playerName}` : ', свободна'}${allowed ? `, стоимость ${cost}` : ''}` : undefined}
      onKeyDown={
        interactive && allowed
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onPick?.(cell.i);
              }
            }
          : undefined
      }
    >
      <polygon points={hexPoints(SIZE - 1)} fill={GRASS} stroke={GRASS_DARK} strokeWidth={2} />
      {color && (
        // Заливка цветом — волной от центра наружу, с лёгким перелётом (пружина)
        <motion.polygon
          key={`fill-${cell.rev}`}
          points={hexPoints(SIZE - 1)}
          fill={color}
          stroke={OUTLINE}
          strokeWidth={2}
          initial={reduced ? { opacity: 0 } : { scale: 0 }}
          animate={reduced ? { opacity: 1 } : { scale: 1 }}
          transition={reduced ? { duration: 0.2 } : { type: 'spring', stiffness: 320, damping: 11 }}
        />
      )}
      {recaptured && !reduced && (
        <g key={`fx-${cell.rev}`} pointerEvents="none">
          <motion.polygon
            points={hexPoints(SIZE)}
            fill="#fff"
            initial={{ opacity: 0.95, scale: 1 }}
            animate={{ opacity: 0, scale: 1.5 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
          {SHARDS.map((s, k) => (
            <motion.path
              key={k}
              d="M0 -9 L8 6 L-8 6 Z"
              fill={prevColor!}
              stroke={OUTLINE}
              strokeWidth={1.5}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
              animate={{ x: s.dx, y: s.dy + 30, opacity: 0, rotate: s.rot, scale: 0.6 }}
              transition={{ duration: 0.9, ease: [0.2, 0.7, 0.4, 1] }}
            />
          ))}
        </g>
      )}
      {cell.base && color && <Base color={color} />}
      {cell.base && labels && cell.playerName && (
        <text y={21} textAnchor="middle" className="hex-label hex-label-base">
          {short}
        </text>
      )}
      {!cell.base && cell.ownerId && (
        <motion.g
          key={`flag-${cell.rev}`}
          initial={reduced ? { opacity: 0 } : { y: -34, opacity: 0 }}
          animate={reduced ? { opacity: 1 } : { y: 0, opacity: 1 }}
          transition={reduced ? { duration: 0.2 } : { type: 'spring', stiffness: 500, damping: 13, delay: 0.12 }}
        >
          <g className="hex-flag" style={{ animationDelay: `${(cell.i % 7) * -0.23}s` }}>
            <path d="M-3 8 L-3 -18" stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" />
            <path d="M-2 -18 L14 -12.5 L-2 -7 Z" fill="#fff" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
            <path d="M-2 -16 L9 -12.5 L-2 -9 Z" fill={color ?? '#fff'} />
          </g>
          {labels && short && (
            <text y={20} textAnchor="middle" className="hex-label">
              {short}
            </text>
          )}
        </motion.g>
      )}
      {interactive && allowed && (
        <polygon points={hexPoints(SIZE - 4)} fill="none" className="hex-allowed-ring" strokeWidth={3} />
      )}
      {interactive && allowed && hover && (
        <g pointerEvents="none">
          <polygon points={hexPoints(SIZE - 2)} fill="rgba(255,255,255,0.35)" />
          <text y={6} textAnchor="middle" className="hex-cost">
            {cost}🚩
          </text>
        </g>
      )}
    </g>
  );
});

function Base({ color }: { color: string }) {
  return (
    <g pointerEvents="none">
      <rect x={-12} y={-16} width={24} height={26} rx={2} fill={color} stroke={OUTLINE} strokeWidth={2.5} />
      <path d="M-14 -16 L-14 -24 L-8 -24 L-8 -19 L-3 -19 L-3 -24 L3 -24 L3 -19 L8 -19 L8 -24 L14 -24 L14 -16 Z" fill={color} stroke={OUTLINE} strokeWidth={2.5} strokeLinejoin="round" />
      <rect x={-4} y={-2} width={8} height={12} rx={4} fill={OUTLINE} />
    </g>
  );
}

/** Гекс-карта «Захвата территории» */
export function HexMap({ state, interactive, labels = true, className }: Props) {
  const reduced = useReducedMotionPref();
  const colors = useMemo(() => new Map(state.owners.map((o) => [o.id, o.color])), [state.owners]);
  const w = Math.sqrt(3) * SIZE * (state.cols + 0.5);
  const h = SIZE * 2 + 1.5 * SIZE * (state.rows - 1);

  const allowed = useMemo(() => {
    const set = new Map<number, number>();
    if (!interactive) return set;
    const mine = interactive.ownerId;
    const ownsAny = state.cells.some((c) => c.ownerId === mine);
    for (const c of state.cells) {
      if (c.ownerId === mine) continue;
      const cost = c.ownerId === null ? 1 : c.base ? BASE_CAPTURE_COST : 2;
      if (interactive.flags < cost) continue;
      if (!ownsAny) {
        if (c.ownerId === null) set.set(c.i, cost);
        continue;
      }
      if (hexNeighbors(c.i, state.cols, state.rows).some((n) => state.cells[n]?.ownerId === mine)) set.set(c.i, cost);
    }
    return set;
  }, [interactive, state.cells, state.cols, state.rows]);

  return (
    <svg className={`hexmap ${className ?? ''}`} viewBox={`-4 -4 ${w + 8} ${h + 8}`} preserveAspectRatio="xMidYMid meet">
      {state.cells.map((c) => (
          <Cell
            key={c.i}
            cell={c}
            color={c.ownerId ? (colors.get(c.ownerId) ?? '#999') : null}
            prevColor={c.prevOwnerId ? (colors.get(c.prevOwnerId) ?? null) : null}
            labels={labels}
            allowed={allowed.has(c.i)}
            cost={allowed.get(c.i) ?? 0}
            interactive={!!interactive}
            onPick={interactive?.onPick}
            reduced={reduced}
            cols={state.cols}
          />
        ))}
    </svg>
  );
}
