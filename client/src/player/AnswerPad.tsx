import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { PublicQuestion } from '@viktorina/shared';
import { ANSWER_STYLES, Shape } from '../components/Shape';
import { Button } from '../components/Button';

interface Props {
  question: PublicQuestion;
  onSubmit: (choices: number[]) => void;
  sending: boolean;
}

/** Варианты ответа: мышь, Tab/Enter и цифры 1–4 как горячие клавиши */
export function AnswerPad({ question, onSubmit, sending }: Props) {
  const multiple = question.type === 'multiple';
  const [picked, setPicked] = useState<number[]>([]);

  useEffect(() => setPicked([]), [question.index]);

  const choose = (i: number) => {
    if (sending) return;
    if (!multiple) {
      setPicked([i]);
      onSubmit([i]);
      return;
    }
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const n = Number(e.key);
      if (n >= 1 && n <= question.answers.length) {
        e.preventDefault();
        choose(n - 1);
      }
      if (multiple && e.key === 'Enter' && picked.length > 0 && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        onSubmit(picked);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="pad-wrap">
      <div className={`pad pad-${question.answers.length}`}>
        {question.answers.map((text, i) => {
          const st = ANSWER_STYLES[i]!;
          const on = picked.includes(i);
          return (
            <motion.button
              key={i}
              className={`pad-tile ${on ? 'is-on' : ''} ${picked.length && !on && !multiple ? 'is-dim' : ''}`}
              style={{ ['--tile' as string]: st.color, ['--tile-dark' as string]: st.dark }}
              onClick={() => choose(i)}
              disabled={sending && !multiple}
              aria-pressed={multiple ? on : undefined}
              aria-label={`${i + 1}: ${text} (${st.label})`}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: i * 0.05 }}
            >
              <Shape index={i} size={44} />
              <span className="pad-text">{text}</span>
              {multiple ? (
                <span className={`pad-check ${on ? 'is-on' : ''}`} aria-hidden="true">
                  {on ? '✓' : ''}
                </span>
              ) : (
                <kbd className="pad-key">{i + 1}</kbd>
              )}
            </motion.button>
          );
        })}
      </div>
      {multiple && (
        <div className="pad-submit">
          <span className="pad-hint">Отметь все верные варианты (клавиши 1–4), затем нажми «Ответить» или Enter</span>
          <Button variant="gold" size="lg" disabled={picked.length === 0 || sending} onClick={() => onSubmit(picked)}>
            Ответить
          </Button>
        </div>
      )}
    </div>
  );
}
