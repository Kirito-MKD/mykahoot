import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { QUESTION_TYPE_LABELS, type HostView } from '@viktorina/shared';
import { sfx } from '../../lib/sound';
import { useRemaining } from '../../lib/time';
import { useHost } from '../../store/hostStore';
import { ANSWER_STYLES, Shape } from '../../components/Shape';
import { TimerRing } from '../../components/TimerRing';
import { DistributionChart } from '../../components/DistributionChart';
import { NextButton } from './NextButton';

function ReadBar({ endsAt }: { endsAt: number | null }) {
  const left = useRemaining(endsAt);
  return (
    <div className="q-readbar" aria-hidden="true">
      <div style={{ transform: `scaleX(${Math.max(0, Math.min(1, left / 2000))})` }} />
    </div>
  );
}

export function QuestionScreen({ view, compact }: { view: HostView; compact?: boolean }) {
  const q = view.question!;
  const answers = useHost((s) => s.answers);
  const count = view.phase === 'answering' ? (answers?.count ?? view.answersCount) : view.answersCount;
  const total = answers?.total ?? view.players.length;
  const reveal = view.phase === 'reveal' ? view.reveal : null;

  useEffect(() => {
    if (!reveal) return;
    if (reveal.correctCount * 2 >= Math.max(1, reveal.answeredCount)) sfx.correct();
    else sfx.wrong();
  }, [reveal]);

  if (view.phase === 'question') {
    return (
      <motion.div className={`q q-intro ${compact ? 'is-compact' : ''}`} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
        <span className="q-num">
          Вопрос {q.index + 1} из {q.total} · {QUESTION_TYPE_LABELS[q.type]}
          {q.points !== 1 ? ` · очки ×${q.points}` : ''}
        </span>
        <motion.h1 className="q-text q-text-big" initial={{ y: 30 }} animate={{ y: 0 }}>
          {q.text}
        </motion.h1>
        {q.imageUrl && !compact && <img className="q-img-big" src={q.imageUrl} alt="" />}
        <ReadBar endsAt={view.phaseEndsAt} />
        <NextButton view={view} inline />
      </motion.div>
    );
  }

  return (
    <motion.div className={`q ${compact ? 'is-compact' : ''} ${reveal ? 'is-reveal' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <h1 className="q-text">{q.text}</h1>
      <div className="q-mid">
        <div className="q-side">
          {reveal ? (
            <div className="q-stat">
              <b>
                {reveal.correctCount}/{reveal.totalPlayers}
              </b>
              <span>ответили верно</span>
            </div>
          ) : (
            <TimerRing endsAt={view.phaseEndsAt} totalMs={q.timeLimit * 1000} size={compact ? 92 : 140} ticking />
          )}
        </div>
        <div className="q-center">
          {reveal ? (
            <DistributionChart answers={q.answers} distribution={reveal.distribution} correct={reveal.correct} />
          ) : q.imageUrl ? (
            <img className="q-img" src={q.imageUrl} alt="Картинка к вопросу" />
          ) : (
            <div className="q-noimg" aria-hidden="true">
              {q.type === 'multiple' ? 'Несколько верных ответов' : q.type === 'trueFalse' ? 'Правда или ложь?' : '?'}
            </div>
          )}
        </div>
        <div className="q-side q-side-right">
          <div className="q-stat" aria-live="polite">
            <motion.b key={count} initial={{ scale: 1.4 }} animate={{ scale: 1 }}>
              {count}
            </motion.b>
            <span>{reveal ? 'ответили' : `из ${total} ответили`}</span>
          </div>
          <NextButton view={view} inline />
        </div>
      </div>
      <div className={`q-tiles q-tiles-${q.answers.length}`}>
        {q.answers.map((a, i) => {
          const st = ANSWER_STYLES[i]!;
          const correct = reveal?.correct.includes(i);
          return (
            <motion.div
              key={i}
              className={`q-tile ${reveal ? (correct ? 'is-correct' : 'is-wrong') : ''}`}
              style={{ background: st.color, boxShadow: `0 6px 0 ${st.dark}` }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: reveal && !correct ? 0.35 : 1, y: 0, scale: reveal && correct ? [1, 1.04, 1] : 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: i * 0.05 }}
            >
              <Shape index={i} size={40} />
              <span className="q-tile-text">{a}</span>
              {reveal && correct && (
                <svg width={40} height={40} viewBox="0 0 24 24" aria-label="верный ответ">
                  <path d="M4 12.5 L9.5 18 L20 6.5" fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
