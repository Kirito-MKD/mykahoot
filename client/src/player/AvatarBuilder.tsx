import { motion } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import {
  AVATAR_BASES,
  AVATAR_BASE_LABELS,
  AVATAR_COLORS,
  AVATAR_GLASSES,
  AVATAR_GLASSES_LABELS,
  AVATAR_HATS,
  AVATAR_HAT_LABELS,
  AVATAR_OUTFITS,
  AVATAR_OUTFIT_LABELS,
  randomAvatar,
  type Avatar as AvatarData,
} from '@viktorina/shared';
import { Avatar } from '../components/avatar/Avatar';
import { paletteFor } from '../components/avatar/parts';
import { Button } from '../components/Button';
import { Spinner } from '../components/Spinner';

interface Props {
  initial?: AvatarData;
  submitLabel: string;
  busy?: boolean;
  onDone: (a: AvatarData) => void;
  onBack?: () => void;
  title?: string;
  embedded?: boolean;
}

function Ribbon({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ab-ribbon">
      <span className="ab-ribbon-label">{label}</span>
      <div className="ab-ribbon-scroll" role="radiogroup" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

function Option({ selected, label, onSelect, children }: { selected: boolean; label: string; onSelect: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      className={`ab-opt ${selected ? 'is-selected' : ''}`}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}

/** Конструктор аватара: крупное превью по центру, выбор — горизонтальными лентами */
export function AvatarBuilder({ initial, submitLabel, busy, onDone, onBack, title = 'Собери своего персонажа', embedded }: Props) {
  const [a, setA] = useState<AvatarData>(() => initial ?? randomAvatar());
  const [spin, setSpin] = useState(0);
  const set = <K extends keyof AvatarData>(k: K, v: AvatarData[K]) => setA((prev) => ({ ...prev, [k]: v }));

  const body = (
    <div className="ab">
      <div className="ab-top">
        {!embedded && <span className="p-step-num">Шаг 2 из 2</span>}
        <h1>{title}</h1>
        <Button
          variant="gold"
          onClick={() => {
            setA(randomAvatar());
            setSpin((s) => s + 1);
          }}
          icon={<span aria-hidden="true">🎲</span>}
        >
          Случайный
        </Button>
      </div>

      <div className="ab-preview">
        <motion.div key={spin} initial={{ scale: 0.7, rotate: -10 }} animate={{ scale: 1, rotate: 0 }}>
          <Avatar avatar={a} size={190} idle title="Твой персонаж" />
        </motion.div>
      </div>

      <div className="ab-ribbons">
        <Ribbon label="Животное">
          {AVATAR_BASES.map((b) => (
            <Option key={b} label={AVATAR_BASE_LABELS[b]} selected={a.base === b} onSelect={() => set('base', b)}>
              <Avatar avatar={{ ...a, base: b, hat: 'none', glasses: 'none' }} size={58} />
            </Option>
          ))}
        </Ribbon>
        <Ribbon label="Цвет">
          {AVATAR_COLORS.map((c) => (
            <Option key={c.id} label={c.label} selected={a.color === c.id} onSelect={() => set('color', c.id)}>
              <span className="ab-swatch" style={{ background: paletteFor(a.base, c.id).fur }} />
              <span className="ab-swatch-label">{c.label}</span>
            </Option>
          ))}
        </Ribbon>
        <Ribbon label="Шапка">
          {AVATAR_HATS.map((h) => (
            <Option key={h} label={AVATAR_HAT_LABELS[h]} selected={a.hat === h} onSelect={() => set('hat', h)}>
              {h === 'none' ? <span className="ab-none">без</span> : <Avatar avatar={{ ...a, hat: h }} size={58} />}
            </Option>
          ))}
        </Ribbon>
        <Ribbon label="Очки">
          {AVATAR_GLASSES.map((g) => (
            <Option key={g} label={AVATAR_GLASSES_LABELS[g]} selected={a.glasses === g} onSelect={() => set('glasses', g)}>
              {g === 'none' ? <span className="ab-none">без</span> : <Avatar avatar={{ ...a, glasses: g, hat: 'none' }} size={58} />}
            </Option>
          ))}
        </Ribbon>
        <Ribbon label="Одежда">
          {AVATAR_OUTFITS.map((o) => (
            <Option key={o} label={AVATAR_OUTFIT_LABELS[o]} selected={a.outfit === o} onSelect={() => set('outfit', o)}>
              <Avatar avatar={{ ...a, outfit: o }} size={58} />
            </Option>
          ))}
        </Ribbon>
      </div>

      <div className="ab-actions">
        {onBack ? (
          <Button variant="quiet" onClick={onBack}>
            ← Назад
          </Button>
        ) : (
          <span />
        )}
        <Button variant="green" size="lg" onClick={() => onDone(a)} disabled={busy}>
          {busy && <Spinner size={22} />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );

  if (embedded) return body;
  return (
    <motion.main className="p-step bg-pattern" initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }}>
      <div className="card ab-card">{body}</div>
    </motion.main>
  );
}
