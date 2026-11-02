import { motion } from 'framer-motion';
import { useState } from 'react';
import { NAME_MAX } from '@viktorina/shared';
import { request } from '../lib/socket';
import { Button } from '../components/Button';
import { Spinner } from '../components/Spinner';

export function NameStep({ initial, onDone, onBack }: { initial: string; onDone: (name: string) => void; onBack: () => void }) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const clean = name.trim();
    if (!clean) {
      setError('Напиши своё имя');
      return;
    }
    setBusy(true);
    const res = await request('name:check', clean);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Это имя не подходит');
      return;
    }
    onDone(clean);
  };

  return (
    <motion.main className="p-step bg-pattern" initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }}>
      <form
        className="p-name-card card"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <span className="p-step-num">Шаг 1 из 2</span>
        <h1>Как тебя зовут?</h1>
        <p className="text-muted">Имя увидят все на экране преподавателя</p>
        <input
          className="input p-name-input"
          value={name}
          maxLength={NAME_MAX}
          autoFocus
          placeholder="Например, Маша К."
          aria-label="Твоё имя"
          aria-invalid={!!error}
          aria-describedby="name-err"
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
        <div className="p-name-meta">
          <span id="name-err" className="p-error" role="alert">
            {error}
          </span>
          <span className="text-muted">
            {[...name].length}/{NAME_MAX}
          </span>
        </div>
        <div className="row" style={{ gap: 12, justifyContent: 'space-between' }}>
          <Button variant="quiet" onClick={onBack}>
            ← Назад
          </Button>
          <Button variant="primary" size="lg" type="submit" disabled={busy}>
            {busy && <Spinner size={22} />}
            Дальше →
          </Button>
        </div>
      </form>
    </motion.main>
  );
}
