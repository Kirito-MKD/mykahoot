import { motion } from 'framer-motion';
import type { HostView } from '@viktorina/shared';
import { Leaderboard } from '../../components/Leaderboard';
import { HexMap } from '../../modes/territory/HexMap';
import { TowerScene } from '../../modes/tower/TowerScene';
import { TeamStandings } from './TeamStandings';

export function LeaderboardScreen({ view, side }: { view: HostView; side?: boolean }) {
  const hasField = view.mode.kind === 'territory' || view.mode.kind === 'tower';
  const board = (
    <div className="lbs-board">
      {view.settings.teamMode && view.teamStandings.length > 0 && <TeamStandings standings={view.teamStandings} />}
      <h2 className="lbs-title">{view.settings.teamMode ? 'Лучшие игроки' : 'Таблица лидеров'}</h2>
      <Leaderboard rows={view.leaderboard} limit={view.settings.teamMode || hasField || side ? 5 : 5} animKey={view.questionIndex} />
    </div>
  );
  if (side) {
    return (
      <motion.div className="lbs lbs-side" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
        {board}
      </motion.div>
    );
  }
  if (hasField) {
    return (
      <motion.div className="lbs lbs-split" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="lbs-field">
          {view.mode.kind === 'territory' && <HexMap state={view.mode} labels />}
          {view.mode.kind === 'tower' && <TowerScene view={view} animate={false} />}
        </div>
        {board}
      </motion.div>
    );
  }
  return (
    <motion.div className="lbs lbs-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {board}
    </motion.div>
  );
}
