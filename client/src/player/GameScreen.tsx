import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, type CSSProperties } from 'react';
import { MODE_INFO, NAME_MAX, darken, type PlayerView } from '@viktorina/shared';
import { request } from '../lib/socket';
import { useRemaining } from '../lib/time';
import { usePlayer } from '../store/playerStore';
import { Avatar } from '../components/avatar/Avatar';
import { Button } from '../components/Button';
import { Emblem } from '../components/Emblem';
import { Modal } from '../components/Modal';
import { ANSWER_STYLES, Shape } from '../components/Shape';
import { toast } from '../components/Toast';
import { HexMap } from '../modes/territory/HexMap';
import { AnswerPad } from './AnswerPad';
import { AvatarBuilder } from './AvatarBuilder';
import { BottomBar } from './BottomBar';

function Bar({ endsAt, totalMs }: { endsAt: number | null; totalMs: number }) {
  const left = useRemaining(endsAt);
  const frac = totalMs ? left / totalMs : 0;
  return (
    <div className="pg-timebar" role="timer" aria-label={`Осталось ${Math.ceil(left / 1000)} секунд`}>
      <div className="pg-timebar-fill" style={{ transform: `scaleX(${Math.max(0, Math.min(1, frac))})` }} />
      <span className="pg-timebar-num">{Math.ceil(left / 1000)}</span>
    </div>
  );
}

function Panel({ children, k }: { children: React.ReactNode; k: string }) {
  return (
    <motion.section
      key={k}
      className="pg-panel"
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
    >
      {children}
    </motion.section>
  );
}

function ProfileEditor({ view, onClose }: { view: PlayerView; onClose: () => void }) {
  const [name, setName] = useState(view.me.name);
  const [busy, setBusy] = useState(false);
  return (
    <Modal label="Изменить имя и персонажа" onClose={onClose} wide>
      <label className="pe-name">
        <span>Имя</span>
        <input className="input" value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} />
      </label>
      <AvatarBuilder
        embedded
        title="Персонаж"
        initial={view.me.avatar}
        submitLabel="Сохранить"
        busy={busy}
        onBack={onClose}
        onDone={async (avatar) => {
          setBusy(true);
          const res = await request('player:profile', { name, avatar });
          setBusy(false);
          if (!res.ok) {
            toast(res.error ?? 'Не удалось сохранить', 'error');
            return;
          }
          usePlayer.getState().setProfile({ name: name.trim(), avatar });
          onClose();
        }}
      />
    </Modal>
  );
}

function ordinal(n: number): string {
  return `${n}-е`;
}

export function GameScreen({ view }: { view: PlayerView }) {
  const connected = usePlayer((s) => s.connected);
  const answers = usePlayer((s) => s.answers);
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => setSending(false), [view.question?.index, view.phase]);

  const team = view.team;
  const style = (team
    ? { ['--team']: team.color, ['--team-dark']: team.dark, ['--team-deep']: darken(team.color, 0.55) }
    : {}) as CSSProperties;

  const submit = async (choices: number[]) => {
    if (!view.question) return;
    setSending(true);
    const res = await request('player:answer', { questionIndex: view.question.index, choices });
    if (!res.ok) {
      setSending(false);
      toast(res.error ?? 'Ответ не принят', 'error');
    }
  };

  const leave = () => {
    usePlayer.getState().setToken(null);
    usePlayer.getState().setView(null);
    import('../lib/socket').then(({ getSocket }) => getSocket().emit('player:leave'));
  };

  const q = view.question;
  let content: React.ReactNode = null;

  switch (view.phase) {
    case 'lobby':
      content = (
        <Panel k="lobby">
          <div className="pg-lobby">
            <h1 className="pg-big">Ты в игре!</h1>
            <p className="pg-sub">Твоё имя на экране?</p>
            <div className="pg-lobby-me">
              <Avatar avatar={view.me.avatar} size={200} idle />
              <button className="pg-edit" onClick={() => setEditing(true)} aria-label="Изменить имя и персонажа" title="Изменить имя и персонажа">
                ✎
              </button>
            </div>
            <span className="pg-name-plate">{view.me.name}</span>
            <p className="pg-hint">
              {MODE_INFO[view.mode].title}
              {view.teamMode ? ' · командная игра — команду выберет случай' : ''}
            </p>
            <button className="link-btn light" onClick={leave}>
              Выйти из игры
            </button>
          </div>
        </Panel>
      );
      break;

    case 'intro':
      content = (
        <Panel k="intro">
          {team ? (
            <div className="pg-intro">
              <p className="pg-sub">Ты в команде</p>
              <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 12 }}>
                <Emblem emblem={team.emblem} color={team.color} size={140} />
              </motion.div>
              <h1 className="pg-big">{team.name}</h1>
              <div className="pg-mates">
                {view.teamMates.map((m) => (
                  <span key={m.id} className="pg-mate">
                    <Avatar avatar={m.avatar} size={40} />
                    {m.name}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="pg-intro">
              <h1 className="pg-big">Приготовься!</h1>
              <p className="pg-sub">Сейчас будет первый вопрос</p>
              <Avatar avatar={view.me.avatar} size={160} idle />
            </div>
          )}
        </Panel>
      );
      break;

    case 'question':
      content = q && (
        <Panel k={`q-${q.index}`}>
          <div className="pg-question-only">
            <span className="pg-qnum">
              Вопрос {q.index + 1} из {q.total}
            </span>
            <h1 className="pg-qtext">{q.text}</h1>
            {q.imageUrl && <img className="pg-qimg" src={q.imageUrl} alt="Картинка к вопросу" />}
            <p className="pg-sub">Читай вопрос — варианты появятся через секунду…</p>
            <Bar endsAt={view.phaseEndsAt} totalMs={2000} />
          </div>
        </Panel>
      );
      break;

    case 'answering':
      content = q && (
        <Panel k={`a-${q.index}`}>
          <div className="pg-answering">
            <div className="pg-qhead">
              <span className="pg-qnum">
                {q.index + 1}/{q.total}
              </span>
              <h1 className="pg-qtext-sm">{q.text}</h1>
              {q.imageUrl && <img className="pg-qimg-sm" src={q.imageUrl} alt="Картинка к вопросу" />}
            </div>
            <Bar endsAt={view.phaseEndsAt} totalMs={q.timeLimit * 1000} />
            {view.myAnswer ? (
              <div className="pg-answered">
                <motion.div className="pg-answered-chips" initial={{ scale: 0.6 }} animate={{ scale: 1 }}>
                  {view.myAnswer.map((i) => (
                    <span key={i} className="pg-chip" style={{ background: ANSWER_STYLES[i]!.color }}>
                      <Shape index={i} size={30} />
                    </span>
                  ))}
                </motion.div>
                <h2 className="pg-big">Ответ принят!</h2>
                <p className="pg-sub">
                  Ждём остальных{answers ? ` · ответили ${answers.count} из ${answers.total}` : '…'}
                </p>
              </div>
            ) : (
              <AnswerPad question={q} onSubmit={submit} sending={sending} />
            )}
          </div>
        </Panel>
      );
      break;

    case 'reveal': {
      const r = view.lastResult;
      const tone = !r?.answered ? 'none' : r.correct ? 'ok' : r.points > 0 ? 'partial' : 'bad';
      const titles = { ok: 'Верно!', bad: 'Неверно', partial: 'Почти!', none: 'Время вышло' };
      content = (
        <Panel k={`r-${r?.questionIndex}`}>
          <div className={`pg-result is-${tone}`}>
            <motion.div className="pg-result-icon" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 12 }}>
              {tone === 'ok' ? '✓' : tone === 'partial' ? '½' : tone === 'none' ? '⏱' : '✕'}
            </motion.div>
            <h1 className="pg-big">{titles[tone]}</h1>
            {r && r.points > 0 && <span className="pg-points">+{r.points.toLocaleString('ru-RU')}</span>}
            {r && r.correct && r.streak >= 2 && <span className="pg-streak">🔥 Серия: {r.streak} подряд</span>}
            {r && r.flagsEarned > 0 && (
              <motion.span className="pg-flags-earned" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring' }}>
                +{r.flagsEarned} 🚩 {r.flagsEarned === 1 ? 'флаг' : 'флага'}
              </motion.span>
            )}
            {tone !== 'ok' && view.correctAnswers && q && (
              <div className="pg-correct">
                <span>Правильный ответ:</span>
                {view.correctAnswers.map((i) => (
                  <span key={i} className="pg-correct-item" style={{ background: ANSWER_STYLES[i]!.color }}>
                    <Shape index={i} size={22} /> {q.answers[i]}
                  </span>
                ))}
              </div>
            )}
            {r && <p className="pg-sub">Ты на {ordinal(r.rank)} месте</p>}
          </div>
        </Panel>
      );
      break;
    }

    case 'event':
      if (view.mode === 'territory' && view.territory) {
        const ownerId = view.teamMode ? `t${view.me.teamId}` : `p${view.me.id}`;
        content = (
          <Panel k="place">
            <div className="pg-place">
              <div className="pg-place-head">
                <h1>{view.me.flags > 0 ? 'Расставь флаги!' : 'Флагов нет — смотри, как захватывают другие'}</h1>
                <p className="pg-sub">
                  {view.me.flags > 0
                    ? 'Ставь рядом со своей территорией. Свободный гекс — 1 флаг, чужой — 2.'
                    : 'Отвечай верно — и в следующем раунде флаги будут у тебя.'}
                </p>
                <Bar endsAt={view.territory.placementEndsAt} totalMs={view.territory.placementTotalMs} />
              </div>
              <div className="pg-place-map">
                <HexMap
                  state={view.territory}
                  labels
                  interactive={
                    view.me.flags > 0
                      ? {
                          ownerId,
                          flags: view.me.flags,
                          onPick: async (cell) => {
                            const res = await request('player:place', { cell });
                            if (!res.ok) toast(res.error ?? 'Сюда нельзя', 'error');
                          },
                        }
                      : undefined
                  }
                />
              </div>
            </div>
          </Panel>
        );
      } else if (view.mode === 'escape' && view.escape) {
        const e = view.escape;
        content = (
          <Panel k="escape">
            <div className="pg-watch">
              <h1 className="pg-big">Смотри на экран!</h1>
              <p className="pg-sub">
                Уровень {e.level} из {e.levels}
              </p>
              <div className="pg-track" aria-label={`Ты прошёл ${e.pos} из ${e.trackLength} шагов`}>
                <div className="pg-track-fill" style={{ width: `${Math.min(100, (e.pos / e.trackLength) * 100)}%` }} />
                <span className="pg-track-door">🚪</span>
              </div>
              <p className="pg-status">
                {e.status === 'escaped' ? 'Ты добежал до двери! 🎉' : e.status === 'caught' ? 'Робот тебя догнал — вернёшься на следующем уровне' : `Шагов до двери: ${Math.max(0, e.trackLength - e.pos)}`}
              </p>
            </div>
          </Panel>
        );
      } else {
        content = (
          <Panel k="tower">
            <div className="pg-watch">
              <h1 className="pg-big">Смотри на экран!</h1>
              {view.tower && (
                <>
                  <p className="pg-sub">{view.tower.columnName}: башня растёт</p>
                  <div className="pg-tower-stats">
                    <span>
                      <b>{view.tower.height}</b> блоков в башне
                    </span>
                    <span>
                      <b>{view.tower.myBlocks}</b> положил(а) ты
                    </span>
                  </div>
                </>
              )}
            </div>
          </Panel>
        );
      }
      break;

    case 'leaderboard':
      content = (
        <Panel k="lb">
          <div className="pg-rank">
            <p className="pg-sub">Ты сейчас на</p>
            <motion.span className="pg-rank-num" initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 12 }}>
              {view.me.rank}
            </motion.span>
            <p className="pg-sub">месте из {view.playersCount}</p>
            <span className="pg-score-big">{view.me.score.toLocaleString('ru-RU')} очков</span>
            {view.escape && (
              <p className="pg-status">
                {view.escape.status === 'escaped' ? 'Ты уже у двери 🎉' : view.escape.status === 'caught' ? 'Пойман роботом' : `До двери: ${Math.max(0, view.escape.trackLength - view.escape.pos)} шаг.`}
              </p>
            )}
          </div>
        </Panel>
      );
      break;

    case 'finished': {
      const f = view.final;
      const medal = f && f.rank <= 3 ? ['🥇', '🥈', '🥉'][f.rank - 1] : null;
      content = f && (
        <Panel k="final">
          <div className="pg-final">
            {medal && (
              <motion.span className="pg-medal" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 10, delay: 0.3 }}>
                {medal}
              </motion.span>
            )}
            <h1 className="pg-big">{f.rank === 1 ? 'Ты победил(а)!' : `${ordinal(f.rank)} место`}</h1>
            <p className="pg-sub">из {f.playersCount} участников</p>
            <div className="pg-final-stats">
              <span>
                <b>{f.score.toLocaleString('ru-RU')}</b> очков
              </span>
              <span>
                <b>
                  {f.correct} из {f.total}
                </b>{' '}
                верно
              </span>
            </div>
            {f.winnerTeam && <p className="pg-status">Победила команда «{f.winnerTeam}»</p>}
            <Button variant="gold" size="lg" onClick={leave}>
              На главную
            </Button>
          </div>
        </Panel>
      );
      break;
    }
  }

  return (
    <motion.div className={`pg ${team ? 'has-team' : ''}`} style={style} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <header className="pg-top">
        <span className="pg-top-title">{view.quizTitle}</span>
        <span className="pg-top-code">Код {view.code}</span>
      </header>
      <AnimatePresence>
        {(!connected || view.hostPaused) && (
          <motion.div className="pg-banner" initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }} role="status">
            {!connected ? 'Связь потерялась — переподключаемся…' : 'Преподаватель отключился — подождём немного'}
          </motion.div>
        )}
      </AnimatePresence>
      <main className="pg-main">
        <AnimatePresence mode="wait">{content}</AnimatePresence>
      </main>
      <BottomBar view={view} />
      <AnimatePresence>{editing && <ProfileEditor view={view} onClose={() => setEditing(false)} />}</AnimatePresence>
    </motion.div>
  );
}
