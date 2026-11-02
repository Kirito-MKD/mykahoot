import { useState } from 'react';
import { MODE_INFO, type HostView } from '@viktorina/shared';
import { MusicButton, MuteButton } from '../../components/SoundButtons';
import { request } from '../../lib/socket';
import { useHost } from '../../store/hostStore';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { toast } from '../../components/Toast';
import { AnimatePresence } from 'framer-motion';

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
        {view.phase !== 'finished' && (
          <button
            type="button"
            className={`hh-auto ${view.autoplay ? 'is-on' : ''}`}
            role="switch"
            aria-checked={view.autoplay}
            title="Автоплей: показ ответа и таблица лидеров переключаются сами"
            onClick={() => void request('host:autoplay', { on: !view.autoplay })}
          >
            <span className="hh-auto-track" aria-hidden="true">
              <span className="hh-auto-dot" />
            </span>
            Автоплей
          </button>
        )}
        <MusicButton />
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
