import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { MODE_INFO, type HostView } from '@viktorina/shared';
import { request } from '../../lib/socket';
import { useHost } from '../../store/hostStore';
import { Avatar } from '../../components/avatar/Avatar';
import { Button } from '../../components/Button';
import { Emblem } from '../../components/Emblem';
import { toast } from '../../components/Toast';
import { ModeIcon } from '../GameSetup';

function prettyUrl(u: string): string {
  return u.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function Lobby({ view }: { view: HostView }) {
  const info = useHost((s) => s.info);
  const [names, setNames] = useState(() => view.teams.map((t) => t.name));
  useEffect(() => setNames(view.teams.map((t) => t.name)), [view.teams]);

  const primary = info ? (info.mdnsOk ? info.mdnsUrl : (info.ipUrls[0] ?? info.primaryUrl)) : '';
  const secondary = info ? (info.mdnsOk ? info.ipUrls[0] : info.ipUrls[1]) : undefined;

  const start = async () => {
    const r = await request('host:start');
    if (!r.ok) toast(r.error ?? 'Не получилось начать', 'error');
  };

  return (
    <motion.div className="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <aside className="lobby-join">
        <span className="lobby-step">Как подключиться</span>
        <p className="lobby-lead">Открой в браузере на своём компьютере:</p>
        <div className={`lobby-url ${info && !info.mdnsOk ? 'is-ip' : ''}`}>{primary ? prettyUrl(primary) : '…'}</div>
        {secondary && (
          <p className="lobby-alt">
            если не открывается — <b>{prettyUrl(secondary)}</b>
          </p>
        )}
        {info && !info.mdnsOk && <p className="lobby-alt">Имя viktorina.local в этой сети не работает — используйте адрес выше.</p>}
        <div className="lobby-qr-row">
          {info?.qrDataUrl && <img className="lobby-qr" src={info.qrDataUrl} alt={`QR-код со ссылкой ${info.qrUrl}`} />}
          <div className="lobby-code">
            <span>Код игры</span>
            <b>{view.code}</b>
            <small>Вводить не нужно — кнопка входа появится у всех сама</small>
          </div>
        </div>
      </aside>

      <section className="lobby-main">
        <div className="lobby-head">
          <ModeIcon mode={view.settings.mode} size={52} />
          <div className="grow">
            <h1>{MODE_INFO[view.settings.mode].title}</h1>
            <p>{MODE_INFO[view.settings.mode].tagline}</p>
          </div>
          <div className="lobby-count" aria-live="polite">
            <b>{view.players.length}</b>
            <span>{view.players.length === 1 ? 'ученик' : view.players.length >= 2 && view.players.length <= 4 ? 'ученика' : 'учеников'}</span>
          </div>
        </div>

        {view.settings.teamMode && (
          <div className="lobby-teams">
            {view.teams.map((t, i) => (
              <label key={t.id} className="lobby-team" style={{ ['--tc' as string]: t.color }}>
                <Emblem emblem={t.emblem} color={t.color} size={32} />
                <input
                  value={names[i] ?? ''}
                  maxLength={30}
                  aria-label={`Название команды ${i + 1}`}
                  onChange={(e) => setNames((n) => n.map((x, k) => (k === i ? e.target.value : x)))}
                  onBlur={() => void request('host:teams', { names })}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                />
              </label>
            ))}
            <span className="lobby-teams-hint">Дети распределятся по командам случайно при старте</span>
          </div>
        )}

        <div className="lobby-players">
          {view.players.length === 0 ? (
            <div className="lobby-empty">
              <div className="lobby-pulse" aria-hidden="true" />
              <p>Ждём учеников…</p>
              <small>Как только ребёнок откроет страницу, у него появится кнопка «Присоединиться»</small>
            </div>
          ) : (
            <ul className="lobby-grid">
              <AnimatePresence>
                {view.players.map((p) => (
                  <motion.li
                    key={p.id}
                    className={`lobby-player ${p.connected ? '' : 'is-off'}`}
                    layout
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                  >
                    <Avatar avatar={p.avatar} crop="head" size={54} />
                    <span className="lobby-player-name">{p.name}</span>
                    <button
                      className="lobby-kick"
                      aria-label={`Убрать ${p.name} из игры`}
                      title="Убрать из игры"
                      onClick={() => void request('host:kick', { playerId: p.id })}
                    >
                      ×
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>

        <div className="lobby-actions">
          <span className="text-muted-light">
            {view.questionCount} вопросов · {view.players.length === 0 ? 'нужен хотя бы один ученик' : 'можно начинать, опоздавшие подключатся по ходу'}
          </span>
          <Button variant="gold" size="xl" disabled={view.players.length === 0} onClick={start}>
            Начать игру
          </Button>
        </div>
      </section>
    </motion.div>
  );
}
