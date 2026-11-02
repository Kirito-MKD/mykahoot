import { AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { HostView } from '@viktorina/shared';
import { api } from '../../lib/api';
import { getSocket, request } from '../../lib/socket';
import { sfx } from '../../lib/sound';
import { KEYS, load, save } from '../../lib/storage';
import { syncServerTime } from '../../lib/time';
import { useHost } from '../../store/hostStore';
import { FullscreenSpinner } from '../../components/Spinner';
import { toast } from '../../components/Toast';
import { HostHeader } from './HostHeader';
import { Lobby } from './Lobby';
import { Intro } from './Intro';
import { QuestionScreen } from './QuestionScreen';
import { LeaderboardScreen } from './LeaderboardScreen';
import { ResultsScreen } from './ResultsScreen';
import { ReactionsLayer } from './ReactionsLayer';
import { NextButton } from './NextButton';
import { EventScreen } from './EventScreen';
import { EscapeStage } from '../../modes/escape/EscapeStage';
import './host.css';

/** Главный экран преподавателя на проекторе */
export function HostGame() {
  const navigate = useNavigate();
  const view = useHost((s) => s.view);
  const [failed, setFailed] = useState(false);
  const prevPlayers = useRef(0);

  useEffect(() => {
    const saved = load<{ token: string; gameId: string } | null>(KEYS.hostToken, null);
    if (!saved) {
      navigate('/teacher', { replace: true });
      return;
    }
    const socket = getSocket();
    const st = useHost.getState;
    const resume = async () => {
      const res = await request<{ gameId: string }>('host:resume', { hostToken: saved.token });
      if (!res.ok) {
        save(KEYS.hostToken, null);
        setFailed(true);
        toast(res.error ?? 'Игра уже закрыта', 'error');
        navigate('/teacher', { replace: true });
      }
    };
    const onConnect = () => {
      st().setConnected(true);
      void resume();
    };
    const onDisconnect = () => st().setConnected(false);
    const onState = (v: HostView) => {
      syncServerTime(v.serverNow);
      st().setView(v);
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('host:state', onState);
    socket.on('game:answers', (a) => st().setAnswers(a));
    socket.on('game:reaction', (r) => st().addReaction(r));
    socket.on('territory:cell', ({ cell, flags, captured }) => {
      st().patchCell(cell, flags, captured);
      sfx.flag();
    });
    socket.on('escape:caught', ({ playerId }) => {
      st().setCaught(playerId);
      sfx.zap();
    });
    socket.on('game:closed', ({ reason }) => {
      save(KEYS.hostToken, null);
      st().setView(null);
      toast(reason);
      navigate('/teacher', { replace: true });
    });
    if (socket.connected) onConnect();
    api.serverInfo().then((i) => st().setInfo(i)).catch(() => undefined);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('host:state', onState);
      socket.off('game:answers');
      socket.off('game:reaction');
      socket.off('territory:cell');
      socket.off('escape:caught');
      socket.off('game:closed');
      st().setView(null);
    };
  }, [navigate]);

  // Звук «пуф», когда в лобби заходит новый ученик
  useEffect(() => {
    const n = view?.players.length ?? 0;
    if (view?.phase === 'lobby' && n > prevPlayers.current) sfx.pop();
    prevPlayers.current = n;
  }, [view?.players.length, view?.phase]);

  // Пробел / Enter / → — «Далее»
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.tagName === 'BUTTON') return;
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        const v = useHost.getState().view;
        if (!v || v.phase === 'finished') return;
        if (v.phase === 'lobby' && v.players.length === 0) return;
        e.preventDefault();
        void request('host:next');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!view || failed) return <FullscreenSpinner />;

  const escape = view.mode.kind === 'escape' && view.phase !== 'lobby' && view.phase !== 'finished' && view.phase !== 'intro';
  let content: React.ReactNode;
  switch (view.phase) {
    case 'lobby':
      content = <Lobby key="lobby" view={view} />;
      break;
    case 'intro':
      content = <Intro key="intro" view={view} />;
      break;
    case 'question':
    case 'answering':
    case 'reveal':
      content = <QuestionScreen key={`q-${view.questionIndex}`} view={view} compact={escape} />;
      break;
    case 'event':
      content = escape ? null : <EventScreen key={`e-${view.questionIndex}`} view={view} />;
      break;
    case 'leaderboard':
      content = <LeaderboardScreen key={`l-${view.questionIndex}`} view={view} side={escape} />;
      break;
    case 'finished':
      content = <ResultsScreen key="results" view={view} />;
      break;
  }

  return (
    <div className={`host host-${view.mode.kind} phase-${view.phase} ${escape ? 'with-escape' : ''}`}>
      <HostHeader view={view} />
      <div className="host-body">
        {escape && (
          <div className={`host-escape-stage is-${view.phase}`}>
            <EscapeStage view={view} />
          </div>
        )}
        <div className="host-content">
          <AnimatePresence mode="wait">{content}</AnimatePresence>
        </div>
      </div>
      {!['question', 'answering', 'reveal'].includes(view.phase) && <NextButton view={view} />}
      <ReactionsLayer />
    </div>
  );
}
