import { useEffect, useState } from 'react';
import { MODE_INFO, type HostView } from '@viktorina/shared';
import { isMuted, onMutedChange, setMuted } from '../../lib/sound';
import { request } from '../../lib/socket';
import { useHost } from '../../store/hostStore';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { toast } from '../../components/Toast';
import { AnimatePresence } from 'framer-motion';

export function MuteButton() {
  const [m, setM] = useState(isMuted());
  useEffect(() => onMutedChange(setM), []);
  return (
    <Button
      variant="ghost"
      size="sm"
      iconOnly
      aria-pressed={m}
      aria-label={m ? 'Включить звук' : 'Выключить звук'}
      title={m ? 'Включить звук' : 'Выключить звук'}
      onClick={() => setMuted(!m)}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9 H8 L13 5 V19 L8 15 H4 Z" fill="#fff" />
        {m ? (
          <path d="M16 9 L21 14 M21 9 L16 14" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
        ) : (
          <path d="M16 8.5 Q19 12 16 15.5 M18.5 6 Q23 12 18.5 18" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        )}
      </svg>
    </Button>
  );
}

/** Шапка: код игры всегда на виду */
export function HostHeader({ view }: { view: HostView }) {
  const connected = useHost((s) => s.connected);
  const [confirm, setConfirm] = useState(false);
  const online = view.players.filter((p) => p.connected).length;
  const q = view.questionIndex >= 0 && view.phase !== 'lobby' && view.phase !== 'finished' && view.phase !== 'intro';
  return (
    <header className="hh">
      <div className="hh-left">
        <span className="hh-title">{view.quizTitle}</span>
        <span className="hh-sub">
          {MODE_INFO[view.settings.mode].title}
          {view.settings.teamMode ? ' · команды' : ''}
          {q && ` · вопрос ${view.questionIndex + 1} из ${view.questionCount}`}
        </span>
      </div>
      <div className="hh-code" aria-label={`Код игры ${view.code}`}>
        <span>Код</span>
        <b>{view.code}</b>
      </div>
      <div className="hh-right">
        {!connected && <span className="chip hh-warn">Нет связи с сервером…</span>}
        <span className="chip" title="Подключено учеников">
          👥 {online}
          {online !== view.players.length ? ` / ${view.players.length}` : ''}
        </span>
        <MuteButton />
        {view.phase !== 'finished' && (
          <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
            {view.phase === 'lobby' ? 'Отменить игру' : 'Завершить'}
          </Button>
        )}
      </div>
      <AnimatePresence>
        {confirm && (
          <Modal label="Завершить игру" onClose={() => setConfirm(false)}>
            <h2>{view.phase === 'lobby' ? 'Отменить игру?' : 'Завершить игру сейчас?'}</h2>
            <p className="text-muted" style={{ marginBottom: 20 }}>
              {view.phase === 'lobby'
                ? 'Дети вернутся на начальный экран.'
                : 'Покажем пьедестал по текущим очкам. Результаты сохранятся в истории.'}
            </p>
            <div className="row" style={{ gap: 12, justifyContent: 'flex-end' }}>
              <Button variant="quiet" onClick={() => setConfirm(false)}>
                Продолжить игру
              </Button>
              <Button
                variant="danger"
                autoFocus
                onClick={async () => {
                  setConfirm(false);
                  const r = await request('host:end');
                  if (!r.ok) toast(r.error ?? 'Не получилось', 'error');
                }}
              >
                {view.phase === 'lobby' ? 'Отменить' : 'Завершить'}
              </Button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </header>
  );
}
