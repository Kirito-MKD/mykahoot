import { motion } from 'framer-motion';
import { useState } from 'react';
import { MODE_INFO } from '@viktorina/shared';
import { usePlayer } from '../store/playerStore';
import { Avatar } from '../components/avatar/Avatar';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { Spinner } from '../components/Spinner';
import { CodeInput } from './CodeInput';

interface Props {
  onJoin: (code: string) => void;
  onEditProfile: (code: string) => void;
  joining: boolean;
}

/** Постоянная страница ученика: открыта всегда, кнопка входа появляется сама */
export function Home({ onJoin, onEditProfile, joining }: Props) {
  const games = usePlayer((s) => s.games);
  const loaded = usePlayer((s) => s.gamesLoaded);
  const connected = usePlayer((s) => s.connected);
  const profile = usePlayer((s) => s.profile);
  const notice = usePlayer((s) => s.notice);
  const [showCode, setShowCode] = useState(false);
  const codeLength = games.some((g) => g.code.length === 4) ? 4 : 3;

  const single = games.length === 1 ? games[0]! : null;

  return (
    <motion.main className="p-home bg-pattern" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <header className="p-home-top">
        <Logo size={44} />
        {!connected && (
          <span className="chip" role="status">
            <Spinner size={14} /> Подключаемся…
          </span>
        )}
      </header>

      <section className="p-home-center">
        {notice && (
          <motion.p className="p-notice" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            {notice}
          </motion.p>
        )}

        {!loaded ? (
          <Spinner size={56} />
        ) : single && !showCode ? (
          <motion.div className="p-join-card" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} key={single.id}>
            <span className="p-join-kicker">
              {single.phase === 'lobby' ? 'Тест готов к началу' : 'Тест уже идёт — можно присоединиться'} · {MODE_INFO[single.mode].title}
            </span>
            <Button variant="gold" size="xl" className="p-join-btn" onClick={() => onJoin(single.code)} disabled={joining} autoFocus>
              {joining ? <Spinner size={28} color="var(--ink)" /> : null}
              <span>
                Присоединиться к тесту <span className="p-join-title">«{single.title}»</span>
              </span>
            </Button>
            {profile && (
              <div className="p-join-as">
                <Avatar avatar={profile.avatar} crop="head" size={44} />
                <span>
                  Ты зайдёшь как <b>{profile.name}</b>
                </span>
                <button className="link-btn" onClick={() => onEditProfile(single.code)}>
                  изменить
                </button>
              </div>
            )}
          </motion.div>
        ) : games.length > 1 && !showCode ? (
          <div className="p-games">
            <h1 className="p-h1">Выбери тест</h1>
            <ul className="p-game-list">
              {games.map((g, i) => (
                <motion.li key={g.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                  <button className="p-game-item" onClick={() => onJoin(g.code)} disabled={joining}>
                    <span className="p-game-code">{g.code}</span>
                    <span className="p-game-title">{g.title}</span>
                    <span className="p-game-meta">
                      {MODE_INFO[g.mode].title} · {g.playersCount} уч.
                    </span>
                  </button>
                </motion.li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="p-wait">
            <h1 className="p-h1">{games.length ? 'Введи код игры' : 'Дождись, пока преподаватель запустит тест'}</h1>
            <p className="p-sub">{games.length ? 'Код написан вверху экрана преподавателя' : 'Кнопка входа появится здесь сама. А если у тебя есть код — введи его:'}</p>
            {!games.length && (
              <div className="p-wait-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            )}
            <CodeInput length={codeLength} onComplete={onJoin} disabled={joining} />
          </div>
        )}
      </section>

      <footer className="p-home-bottom">
        {games.length > 0 && (
          <button className="link-btn light" onClick={() => setShowCode((v) => !v)}>
            {showCode ? '← Назад к списку игр' : 'У меня есть код игры'}
          </button>
        )}
        {profile && !single && (
          <button className="p-profile-pill" onClick={() => onEditProfile('')}>
            <Avatar avatar={profile.avatar} crop="head" size={32} />
            {profile.name}
            <span aria-hidden="true">✎</span>
          </button>
        )}
      </footer>
    </motion.main>
  );
}
