import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KEYS, load } from '../lib/storage';
import { getSocket } from '../lib/socket';
import { Button } from '../components/Button';

/** Если вкладка с игрой была закрыта — предлагаем вернуться в неё (игра ждёт 60 секунд) */
export function ResumeBanner() {
  const navigate = useNavigate();
  const [saved] = useState(() => load<{ token: string; gameId: string } | null>(KEYS.hostToken, null));
  const [alive, setAlive] = useState(false);
  useEffect(() => {
    if (!saved) return;
    const s = getSocket();
    const check = () => s.emit('games:subscribe');
    const onList = (games: { id: string }[]) => setAlive(games.some((g) => g.id === saved.gameId));
    s.on('games:list', onList);
    if (s.connected) check();
    else s.once('connect', check);
    return () => {
      s.off('games:list', onList);
    };
  }, [saved]);
  if (!saved || !alive) return null;
  return (
    <div className="t-resume">
      <span>Игра ещё идёт — дети ждут.</span>
      <Button variant="gold" size="sm" onClick={() => navigate('/teacher/game')}>
        Вернуться в игру
      </Button>
    </div>
  );
}
