import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRemaining } from '../../lib/time';
import { darken, lighten, type HostView, type TowerBlock, type TowerColumn, type TowerState } from '@viktorina/shared';
import { sfx } from '../../lib/sound';
import { useReducedMotionPref } from '../../lib/motion';
import { Avatar } from '../../components/avatar/Avatar';
import { Emblem } from '../../components/Emblem';
import { SpaceBackdrop } from './SpaceBackdrop';
import './tower.css';

const COLW = 260;
const VIEW_H = 640;
const GROUND = 560;
const PLAT_H = 34;
const BW = 128;
const BH = 34;
const O = '#1A1033';
const DROP_STAGGER = 0.42;

/** Раунд, анимация которого уже проиграна — чтобы не повторять её при повторном показе сцены */
let lastAnimatedRound = -1;

function shiftHue(hex: string, deg: number): string {
  // Небольшой сдвиг яркости вместо оттенка — блоки одной команды различимы, но остаются «своими»
  return deg >= 0 ? lighten(hex, deg / 60) : darken(hex, -deg / 60);
}

function Block({ b, color, x, y }: { b: TowerBlock; color: string; x: number; y: number }) {
  const fill = shiftHue(color, b.hue);
  const name = b.playerName.length > 12 ? b.playerName.slice(0, 11) + '…' : b.playerName;
  return (
    <g transform={`translate(${x + b.offset - BW / 2} ${y - BH})`}>
      <rect width={BW} height={BH} rx={6} fill={fill} stroke={O} strokeWidth={3} />
      <rect x={5} y={4} width={BW - 10} height={6} rx={3} fill="rgba(255,255,255,0.35)" />
      <circle cx={12} cy={BH / 2 + 3} r={3} fill="rgba(26,16,51,0.35)" />
      <circle cx={BW - 12} cy={BH / 2 + 3} r={3} fill="rgba(26,16,51,0.35)" />
      <text x={BW / 2} y={BH / 2 + 8} textAnchor="middle" className="tw-block-name">
        {name}
      </text>
    </g>
  );
}

interface Flyer {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  color: string;
  b: TowerBlock;
}

/** Разлёт блоков после удара монстра: угол + гравитация */
function FlyingBlocks({ flyers, reduced }: { flyers: Flyer[]; reduced: boolean }) {
  const [, setTick] = useState(0);
  const state = useRef<Flyer[]>([]);
  useEffect(() => {
    state.current = flyers.map((f) => ({ ...f }));
    if (!flyers.length) return;
    let raf = 0;
    let last = performance.now();
    const start = last;
    const step = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      for (const f of state.current) {
        f.vy += 1900 * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.rot += f.vr * dt;
      }
      setTick((n) => n + 1);
      if (t - start < 2600) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [flyers]);
  return (
    <g pointerEvents="none">
      {state.current.map((f) => (
        <motion.g key={f.id} initial={{ opacity: 1 }} animate={{ opacity: reduced ? 0 : [1, 1, 0] }} transition={{ duration: reduced ? 0.6 : 2.4 }}>
          <g transform={`translate(${f.x} ${f.y}) rotate(${f.rot})`}>
            <rect x={-BW / 2} y={-BH / 2} width={BW} height={BH} rx={6} fill={f.color} stroke={O} strokeWidth={3} />
            <rect x={-BW / 2 + 5} y={-BH / 2 + 4} width={BW - 10} height={6} rx={3} fill="rgba(255,255,255,0.35)" />
          </g>
        </motion.g>
      ))}
    </g>
  );
}

function Monster({
  x,
  baseY,
  mirror,
  phase,
  reduced,
}: {
  x: number;
  baseY: number;
  mirror: boolean;
  phase: 'hidden' | 'up' | 'windup' | 'strike' | 'down';
  reduced: boolean;
}) {
  // Прячется под платформой и вылезает из-за неё
  const hiddenY = GROUND + 260 - baseY;
  const y = phase === 'hidden' || phase === 'down' ? hiddenY : 0;
  const arm = phase === 'windup' ? -55 : phase === 'strike' ? 40 : -10;
  return (
    <motion.g
      initial={{ y: hiddenY, opacity: reduced ? 0 : 1 }}
      animate={{ y: reduced ? 0 : y, opacity: reduced ? (phase === 'hidden' || phase === 'down' ? 0 : 1) : 1 }}
      transition={{ type: 'spring', stiffness: phase === 'up' ? 180 : 120, damping: phase === 'up' ? 12 : 20 }}
    >
      <g transform={`translate(${x} ${baseY}) scale(${mirror ? -1 : 1} 1)`}>
        {/* огонь снизу */}
        <g className="tw-fire">
          <path d="M-70 120 Q-60 40 -40 70 Q-30 10 -6 60 Q6 0 26 62 Q44 16 54 72 Q70 46 74 120 Z" fill="#FF6A2B" stroke={O} strokeWidth={4} strokeLinejoin="round" />
          <path d="M-46 120 Q-36 72 -22 88 Q-10 50 6 86 Q20 54 34 90 Q48 74 50 120 Z" fill="#FFC531" />
        </g>
        {/* тело */}
        <path d="M-78 40 Q-90 -110 0 -122 Q90 -110 78 40 Z" fill="#6B3FC9" stroke={O} strokeWidth={5} strokeLinejoin="round" />
        <path d="M-50 -100 L-70 -150 L-28 -114 Z" fill="#F4EBD6" stroke={O} strokeWidth={4} strokeLinejoin="round" />
        <path d="M50 -100 L70 -150 L28 -114 Z" fill="#F4EBD6" stroke={O} strokeWidth={4} strokeLinejoin="round" />
        <circle cx={-26} cy={-60} r={20} fill="#fff" stroke={O} strokeWidth={4} />
        <circle cx={26} cy={-60} r={20} fill="#fff" stroke={O} strokeWidth={4} />
        <circle cx={-22} cy={-56} r={8} fill={O} />
        <circle cx={22} cy={-56} r={8} fill={O} />
        <path d="M-48 -88 L-8 -78 M48 -88 L8 -78" stroke={O} strokeWidth={6} strokeLinecap="round" />
        <path d="M-40 -14 Q0 26 40 -14 Z" fill="#2A1033" stroke={O} strokeWidth={4} strokeLinejoin="round" />
        <path d="M-30 -10 L-24 4 L-18 -6 M18 -6 L24 4 L30 -10" fill="#fff" stroke={O} strokeWidth={2} strokeLinejoin="round" />
        {/* лапа для удара */}
        <motion.g animate={{ rotate: arm }} transition={{ type: 'spring', stiffness: phase === 'strike' ? 700 : 200, damping: phase === 'strike' ? 14 : 16 }} style={{ originX: '10%', originY: '90%' }}>
          <path d="M60 -30 Q120 -60 120 -150" fill="none" stroke={O} strokeWidth={30} strokeLinecap="round" />
          <path d="M60 -30 Q120 -60 120 -150" fill="none" stroke="#6B3FC9" strokeWidth={20} strokeLinecap="round" />
          <circle cx={120} cy={-160} r={24} fill="#6B3FC9" stroke={O} strokeWidth={5} />
          <path d="M104 -178 L98 -194 M120 -184 L120 -202 M136 -178 L142 -194" stroke="#F4EBD6" strokeWidth={6} strokeLinecap="round" />
        </motion.g>
        <path d="M-60 -30 Q-96 0 -96 30" fill="none" stroke={O} strokeWidth={26} strokeLinecap="round" />
        <path d="M-60 -30 Q-96 0 -96 30" fill="none" stroke="#6B3FC9" strokeWidth={16} strokeLinecap="round" />
      </g>
    </motion.g>
  );
}

function Column({
  col,
  index,
  blocks,
  newIds,
  animate,
  reduced,
  members,
  onLand,
}: {
  col: TowerColumn;
  index: number;
  blocks: TowerBlock[];
  newIds: Map<number, number>;
  animate: boolean;
  reduced: boolean;
  members: { id: string; avatar: import('@viktorina/shared').Avatar }[];
  onLand: (colId: string, b: TowerBlock, top: number) => void;
}) {
  const cx = index * COLW + COLW / 2;
  const shake = useAnimationControls();
  const top = GROUND - PLAT_H;
  return (
    <motion.g animate={shake}>
      {blocks.map((b, i) => {
        const order = newIds.get(b.id);
        const fresh = animate && order !== undefined;
        const y = top - i * BH;
        return (
          <motion.g
            key={b.id}
            initial={fresh ? (reduced ? { opacity: 0 } : { y: -900 - i * BH, opacity: 1 }) : false}
            animate={reduced ? { opacity: 1 } : { y: 0, opacity: 1 }}
            transition={
              reduced
                ? { duration: 0.3, delay: (order ?? 0) * DROP_STAGGER }
                : { type: 'spring', stiffness: 240, damping: 13, delay: (order ?? 0) * DROP_STAGGER }
            }
            onAnimationComplete={() => {
              if (!fresh) return;
              onLand(col.id, b, y - BH);
              // Вся башня коротко вздрагивает — затухающее колебание
              if (!reduced) void shake.start({ x: [0, -7, 6, -4, 2.5, -1, 0], transition: { duration: 0.55 } });
            }}
          >
            <Block b={b} color={col.color} x={cx} y={y} />
          </motion.g>
        );
      })}
      {/* платформа */}
      <g transform={`translate(${cx} ${GROUND})`}>
        <path d={`M${-COLW / 2 + 22} ${-PLAT_H} H${COLW / 2 - 22} Q${COLW / 2 - 8} ${-PLAT_H} ${COLW / 2 - 14} ${-PLAT_H + 16} L${COLW / 2 - 40} 40 Q0 70 ${-COLW / 2 + 40} 40 L${-COLW / 2 + 14} ${-PLAT_H + 16} Q${-COLW / 2 + 8} ${-PLAT_H} ${-COLW / 2 + 22} ${-PLAT_H} Z`} fill="#5B5577" stroke={O} strokeWidth={4} strokeLinejoin="round" />
        <rect x={-COLW / 2 + 18} y={-PLAT_H} width={COLW - 36} height={14} rx={6} fill={col.color} stroke={O} strokeWidth={3} />
        <path d="M-40 10 L-30 26 M20 14 L34 30 M-6 30 L4 44" stroke="#3E3A57" strokeWidth={4} strokeLinecap="round" />
      </g>
      {/* жители башни */}
      {members.slice(0, 4).map((m, k) => {
        const side = k % 2 === 0 ? -1 : 1;
        const slot = Math.floor(k / 2);
        const ax = cx + side * (BW / 2 + 18 + slot * 30) - 24;
        return (
          <g key={m.id} transform={`translate(${ax} ${GROUND - PLAT_H - 60})`}>
            <Avatar avatar={m.avatar} size={48} />
          </g>
        );
      })}
      {members.length > 4 && (
        <text x={cx + COLW / 2 - 26} y={GROUND - PLAT_H - 66} textAnchor="middle" className="tw-more">
          +{members.length - 4}
        </text>
      )}
    </motion.g>
  );
}

function DropBanner({ endsAt, totalMs, placed, total }: { endsAt: number; totalMs: number; placed: number; total: number }) {
  const left = useRemaining(endsAt);
  return (
    <motion.div className="tw-drop" initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
      <span>Ставим блоки на своих экранах!</span>
      <b>
        {placed} из {total}
      </b>
      <div className="tw-drop-bar">
        <div style={{ transform: `scaleX(${Math.max(0, Math.min(1, left / totalMs))})` }} />
      </div>
    </motion.div>
  );
}

interface Popup {
  id: number;
  x: number;
  y: number;
  text: string;
}

export function TowerScene({ view, animate }: { view: HostView; animate: boolean }) {
  const state = view.mode as TowerState;
  const reduced = useReducedMotionPref();
  const ev = state.lastEvent;
  // Живая анимация — только в фазе события и только один раз за раунд
  const [live] = useState(() => animate && !!ev && ev.round !== lastAnimatedRound);
  const [monsterPhase, setMonsterPhase] = useState<'hidden' | 'up' | 'windup' | 'strike' | 'down'>('hidden');
  const [hit, setHit] = useState(false);
  const [batches, setBatches] = useState<{ id: number; flyers: Flyer[] }[]>([]);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [shaking, setShaking] = useState(false);
  // Блоки и промахи, которые уже были на экране, когда сцена открылась, — их не анимируем
  const seen = useRef<Set<number> | null>(null);
  if (seen.current === null) {
    seen.current = new Set(state.columns.flatMap((c) => c.blocks.map((b) => b.id)));
    if (!live) for (const f of ev?.fails ?? []) seen.current.add(f.id);
  }
  const monsterPlayed = useRef(false);

  useEffect(() => {
    if (live && ev) lastAnimatedRound = ev.round;
  }, [live, ev]);

  const columns = state.columns;
  const W = Math.max(2, columns.length) * COLW;
  const targetIdx = ev?.monster ? columns.findIndex((c) => c.id === ev.monster!.columnId) : -1;

  const newIds = useMemo(() => {
    const m = new Map<number, number>();
    if (!live) return m;
    for (const c of columns) for (const b of c.blocks) if (!seen.current!.has(b.id)) m.set(b.id, 0);
    for (const b of ev?.monster?.removed ?? []) if (!seen.current!.has(b.id)) m.set(b.id, 0);
    return m;
  }, [live, columns, ev]);

  const displayBlocks = (c: TowerColumn): TowerBlock[] =>
    live && ev?.monster && ev.monster.columnId === c.id && !hit ? [...c.blocks, ...ev.monster.removed] : c.blocks;

  // Промахи: блок срывается с верхушки и улетает вниз
  useEffect(() => {
    if (!live || !ev) return;
    const fresh = ev.fails.filter((f) => !seen.current!.has(f.id));
    if (!fresh.length) return;
    for (const f of fresh) seen.current!.add(f.id);
    const flyers: Flyer[] = fresh.map((f) => {
      const idx = columns.findIndex((c) => c.id === f.columnId);
      const col = columns[idx];
      const h = col ? col.blocks.length : 0;
      return {
        id: f.id,
        b: { id: f.id, playerId: '', playerName: f.playerName, offset: f.offset, hue: f.hue },
        x: idx * COLW + COLW / 2 + f.offset,
        y: GROUND - PLAT_H - h * BH - BH * 2,
        vx: Math.sign(f.offset || 1) * (200 + Math.random() * 160),
        vy: -260,
        rot: 0,
        vr: Math.sign(f.offset || 1) * (300 + Math.random() * 300),
        color: shiftHue(col?.color ?? '#888888', f.hue),
      };
    });
    setBatches((b) => [...b, { id: fresh[0]!.id, flyers }]);
    sfx.fall();
    for (const f of fresh) {
      const idx = columns.findIndex((c) => c.id === f.columnId);
      const id = f.id * 10 + 7;
      setPopups((p) => [...p, { id, x: idx * COLW + COLW / 2, y: GROUND - PLAT_H - 40, text: `Мимо! ${f.playerName}` }]);
      window.setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 1800);
    }
  }, [live, ev, columns]);

  // Сценарий монстра
  useEffect(() => {
    if (!live || !ev?.monster || targetIdx < 0 || monsterPlayed.current) return;
    monsterPlayed.current = true;
    const monster = ev.monster;
    const dropsDone = 0.7;
    const timers: number[] = [];
    const at = (sec: number, fn: () => void) => timers.push(window.setTimeout(fn, sec * 1000));
    at(dropsDone, () => {
      setMonsterPhase('up');
      sfx.roar();
    });
    at(dropsDone + 1.1, () => setMonsterPhase('windup'));
    at(dropsDone + 1.7, () => {
      setMonsterPhase('strike');
      const col = columns[targetIdx]!;
      const base = col.blocks.length;
      const cx = targetIdx * COLW + COLW / 2;
      setBatches((b) => [
        ...b,
        {
          id: -monster.removed[0]!.id,
          flyers: monster.removed.map((bl, k) => ({
            id: bl.id,
            b: bl,
            x: cx + bl.offset,
            y: GROUND - PLAT_H - (base + k) * BH - BH / 2,
            vx: (Math.random() < 0.5 ? -1 : 1) * (260 + Math.random() * 420),
            vy: -(520 + Math.random() * 420),
            rot: 0,
            vr: (Math.random() - 0.5) * 900,
            color: shiftHue(col.color, bl.hue),
          })),
        },
      ]);
      setHit(true);
      sfx.crash();
      if (!reduced) {
        setShaking(true);
        window.setTimeout(() => setShaking(false), 650);
      }
    });
    at(dropsDone + 3.1, () => setMonsterPhase('down'));
    // Таймеры не сбрасываем при обновлениях состояния — сценарий доигрывается до конца
  }, [live, ev, targetIdx, columns, reduced]);

  // Камера: если башня выше экрана — плавно отъезжаем
  const tallest = Math.max(0, ...columns.map((c) => displayBlocks(c).length));
  const needed = PLAT_H + tallest * BH + 150;
  const scale = Math.min(1, (GROUND - 30) / needed);

  const membersOf = (c: TowerColumn) => {
    if (c.avatar) return [{ id: c.id, avatar: c.avatar }];
    const teamId = Number(c.id.slice(1));
    return view.players.filter((p) => p.teamId === teamId).map((p) => ({ id: p.id, avatar: p.avatar }));
  };

  const onLand = (colId: string, b: TowerBlock, topY: number) => {
    sfx.thud();
    const idx = columns.findIndex((c) => c.id === colId);
    const id = b.id * 10 + Math.floor(Math.random() * 9);
    const perfect = ev?.added.find((a) => a.blockId === b.id)?.perfect;
    if (perfect) sfx.perfect();
    setPopups((p) => [...p, { id, x: idx * COLW + COLW / 2, y: topY - 16, text: perfect ? `Идеально! ${b.playerName}` : `+10 ${b.playerName}` }]);
    window.setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 1800);
  };

  const dropping = live ? state.dropping : null;
  const placed = (ev?.added.length ?? 0) + (ev?.fails.length ?? 0);
  const noneAdded = live && ev && !dropping && ev.added.length === 0 && ev.fails.length === 0 && !ev.monster;

  return (
    <div className={`tower-scene ${shaking ? 'is-shaking' : ''} ${state.others.length ? 'has-others' : ''}`}>
      <SpaceBackdrop reduced={reduced} />
      <div className="tw-counters" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
        {columns.map((c) => (
          <div key={c.id} className="tw-counter" style={{ ['--tc' as string]: c.color }}>
            <div className="tw-counter-name">
              {c.emblem && <Emblem emblem={c.emblem} color={c.color} size={28} />}
              <span>{c.name}</span>
            </div>
            <motion.b key={c.blocks.length} initial={{ scale: 1.5 }} animate={{ scale: 1 }}>
              {c.blocks.length}
            </motion.b>
            <small>{c.blocks.length === 1 ? 'блок' : c.blocks.length >= 2 && c.blocks.length <= 4 ? 'блока' : 'блоков'}</small>
          </div>
        ))}
      </div>
      <svg className="tw-svg" viewBox={`0 0 ${W} ${VIEW_H}`} preserveAspectRatio="xMidYMax meet">
        <motion.g animate={{ scale }} style={{ originX: 0.5, originY: 1 }} transition={{ type: 'spring', stiffness: 60, damping: 18 }}>
          {targetIdx >= 0 && live && (() => {
            const target = columns[targetIdx]!;
            const height = target.blocks.length + (ev?.monster?.removed.length ?? 0);
            const topY = GROUND - PLAT_H - height * BH;
            // Монстр стоит сбоку от башни-лидера и тянется лапой к её верхушке
            const side = targetIdx === columns.length - 1 && columns.length > 1 ? -1 : 1;
            return (
              <Monster
                x={targetIdx * COLW + COLW / 2 + side * (BW / 2 + 92)}
                baseY={Math.min(GROUND - 40, topY + 120)}
                mirror={side === 1}
                phase={monsterPhase}
                reduced={reduced}
              />
            );
          })()}
          {columns.map((c, i) => (
            <Column
              key={c.id}
              col={c}
              index={i}
              blocks={displayBlocks(c)}
              newIds={newIds}
              animate={live}
              reduced={reduced}
              members={membersOf(c)}
              onLand={onLand}
            />
          ))}
          {batches.map((b) => (
            <FlyingBlocks key={b.id} flyers={b.flyers} reduced={reduced} />
          ))}
          <AnimatePresence>
            {popups.map((p) => (
              <motion.text
                key={p.id}
                x={p.x}
                y={p.y}
                textAnchor="middle"
                className="tw-popup"
                initial={{ opacity: 0, y: p.y }}
                animate={{ opacity: [0, 1, 1, 0], y: p.y - 90 }}
                transition={{ duration: 1.7, ease: 'easeOut' }}
              >
                {p.text}
              </motion.text>
            ))}
          </AnimatePresence>
        </motion.g>
      </svg>
      {noneAdded && <div className="tw-note">В этом раунде никто не добавил блок</div>}
      {dropping && (
        <DropBanner endsAt={dropping.endsAt} totalMs={dropping.totalMs} placed={placed} total={placed + dropping.pending.length} />
      )}
      {live && ev?.monster && monsterPhase !== 'hidden' && (
        <motion.div className="tw-alert" initial={{ scale: 0 }} animate={{ scale: 1 }}>
          Монстр! Лидер теряет {ev.monster.removed.length} блока
        </motion.div>
      )}
      {!live && state.roundsUntilMonster > 0 && view.phase === 'leaderboard' && (
        <div className="tw-note tw-note-small">
          Монстр придёт через {state.roundsUntilMonster} {state.roundsUntilMonster === 1 ? 'раунд' : state.roundsUntilMonster <= 4 ? 'раунда' : 'раундов'}
        </div>
      )}
      {state.others.length > 0 && (
        <aside className="tw-others" aria-label="Остальные башни">
          <span>Остальные башни</span>
          <ol start={columns.length + 1}>
            {state.others.map((o) => (
              <li key={o.id}>
                <span className="tbl-dot" style={{ background: o.color }} />
                {o.name}
                <b>{o.height}</b>
              </li>
            ))}
          </ol>
        </aside>
      )}
    </div>
  );
}
