import { useEffect, useRef, useState } from 'react';

/** Поле на три цифры: автофокус, автопереход между цифрами, вставка из буфера */
export function CodeInput({ length = 3, onComplete, disabled }: { length?: number; onComplete: (code: string) => void; disabled?: boolean }) {
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(''));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setDigits(Array(length).fill(''));
    refs.current[0]?.focus();
  }, [length]);

  const update = (next: string[]) => {
    setDigits(next);
    if (next.every((d) => d !== '')) onComplete(next.join(''));
  };

  const setAt = (i: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      const next = digits.slice();
      next[i] = '';
      setDigits(next);
      return;
    }
    const next = digits.slice();
    // Вставили несколько цифр сразу — раскладываем по клеткам
    for (let k = 0; k < clean.length && i + k < length; k++) next[i + k] = clean[k]!;
    const focus = Math.min(length - 1, i + clean.length);
    refs.current[focus]?.focus();
    update(next);
  };

  return (
    <div className="code-input" role="group" aria-label="Код игры">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className="code-cell"
          inputMode="numeric"
          autoComplete="off"
          maxLength={length}
          value={d}
          disabled={disabled}
          aria-label={`Цифра ${i + 1}`}
          onChange={(e) => setAt(i, e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !digits[i] && i > 0) {
              const next = digits.slice();
              next[i - 1] = '';
              setDigits(next);
              refs.current[i - 1]?.focus();
              e.preventDefault();
            }
            if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
            if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus();
          }}
        />
      ))}
    </div>
  );
}
