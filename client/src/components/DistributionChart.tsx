import { motion } from 'framer-motion';
import { ANSWER_STYLES, Shape } from './Shape';

interface Props {
  answers: string[];
  distribution: number[];
  correct: number[];
}

/** Столбчатая диаграмма распределения ответов */
export function DistributionChart({ answers, distribution, correct }: Props) {
  const max = Math.max(1, ...distribution);
  return (
    <div className="dist" role="img" aria-label="Сколько учеников выбрали каждый вариант">
      {answers.map((_, i) => {
        const st = ANSWER_STYLES[i]!;
        const isCorrect = correct.includes(i);
        const h = (distribution[i]! / max) * 100;
        return (
          <div key={i} className={`dist-col ${isCorrect ? 'is-correct' : 'is-wrong'}`}>
            <span className="dist-count">{distribution[i]}</span>
            <div className="dist-track">
              <motion.div
                className="dist-bar"
                style={{ background: st.color, boxShadow: `inset 0 -6px 0 ${st.dark}` }}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(4, h)}%` }}
                transition={{ type: 'spring', stiffness: 200, damping: 22, delay: 0.1 + i * 0.08 }}
              />
            </div>
            <div className="dist-label" style={{ background: st.color, boxShadow: `0 4px 0 ${st.dark}` }}>
              <Shape index={i} size={24} />
              {isCorrect && (
                <svg width={26} height={26} viewBox="0 0 24 24" aria-label="верный ответ">
                  <path d="M4 12.5 L9.5 18 L20 6.5" fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
