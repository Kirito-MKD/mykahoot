import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { Avatar, PlayerView } from '@viktorina/shared';
import { getSocket, request } from '../lib/socket';
import { syncServerTime } from '../lib/time';
import { usePlayer } from '../store/playerStore';
import { ToastLayer, toast } from '../components/Toast';
import { Home } from './Home';
import { NameStep } from './NameStep';
import { AvatarBuilder } from './AvatarBuilder';
import { GameScreen } from './GameScreen';
import './player.css';

type Step = { kind: 'home' } | { kind: 'name'; code: string } | { kind: 'avatar'; code: string; name: string };

export function PlayerApp() {
  const view = usePlayer((s) => s.view);
  const profile = usePlayer((s) => s.profile);
  const [step, setStep] = useState<Step>({ kind: 'home' });
  const [joining, setJoining] = useState(false);

  // ─── Сокет: список игр, состояние игрока, переподключение ───
  useEffect(() => {
    const socket = getSocket();
    const st = usePlayer.getState;
    const resume = async () => {
      const token = st().token;
      if (!token) return;
      const res = await request<{ gameId: string }>('player:resume', { token });
      if (!res.ok) {
        st().setToken(null);
        st().setView(null);
      }
    };
    const onConnect = () => {
      st().setConnected(true);
      socket.emit('games:subscribe');
      void resume();
    };
    const onDisconnect = () => st().setConnected(false);
    const onState = (v: PlayerView) => {
      syncServerTime(v.serverNow);
      st().setView(v);
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('games:list', (g) => st().setGames(g));
    socket.on('player:state', onState);
    socket.on('game:answers', (a) => st().setAnswers(a));
    socket.on('territory:cell', ({ cell, flags }) => st().patchCell(cell, flags));
    socket.on('player:kicked', () => {
      st().setToken(null);
      st().setView(null);
      st().setNotice('Преподаватель убрал тебя из игры.');
    });
    socket.on('game:closed', ({ reason }) => {
      st().setToken(null);
      st().setView(null);
      st().setNotice(reason);
    });
    if (socket.connected) onConnect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('games:list');
      socket.off('player:state', onState);
      socket.off('game:answers');
      socket.off('territory:cell');
      socket.off('player:kicked');
      socket.off('game:closed');
    };
  }, []);

  const join = useCallback(async (code: string, name: string, avatar: Avatar) => {
    setJoining(true);
    const res = await request<{ token: string; gameId: string }>('player:join', {
      code,
      name,
      avatar,
      token: usePlayer.getState().token ?? undefined,
    });
    setJoining(false);
    if (!res.ok || !res.data) {
      toast(res.error ?? 'Не получилось войти', 'error');
      return false;
    }
    usePlayer.getState().setToken(res.data.token);
    usePlayer.getState().setProfile({ name, avatar });
    usePlayer.getState().setNotice(null);
    setStep({ kind: 'home' });
    return true;
  }, []);

  const startJoin = useCallback(
    (code: string) => {
      // Имя и аватар уже сохранены — одна кнопка, и ребёнок в игре
      if (profile) void join(code, profile.name, profile.avatar);
      else setStep({ kind: 'name', code });
    },
    [profile, join],
  );

  let content;
  if (view) {
    content = <GameScreen key="game" view={view} />;
  } else if (step.kind === 'name') {
    content = (
      <NameStep
        key="name"
        initial={profile?.name ?? ''}
        onBack={() => setStep({ kind: 'home' })}
        onDone={(name) => setStep({ kind: 'avatar', code: step.code, name })}
      />
    );
  } else if (step.kind === 'avatar') {
    content = (
      <AvatarBuilder
        key="avatar"
        initial={profile?.avatar}
        submitLabel="В игру!"
        busy={joining}
        onBack={() => setStep({ kind: 'name', code: step.code })}
        onDone={(avatar) => {
          if (step.code) void join(step.code, step.name, avatar);
          else {
            // Просто сохранили профиль — игры пока нет
            usePlayer.getState().setProfile({ name: step.name, avatar });
            setStep({ kind: 'home' });
          }
        }}
      />
    );
  } else {
    content = <Home key="home" onJoin={startJoin} onEditProfile={(code) => setStep({ kind: 'name', code })} joining={joining} />;
  }

  return (
    <>
      <AnimatePresence mode="wait">{content}</AnimatePresence>
      <ToastLayer />
    </>
  );
}
