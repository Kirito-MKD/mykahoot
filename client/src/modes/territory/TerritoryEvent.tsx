import { motion } from 'framer-motion';
import { BASE_VALUE, type HostView, type TerritoryState } from '@viktorina/shared';
import { useRemaining } from '../../lib/time';
import { Avatar } from '../../components/avatar/Avatar';
import { Emblem } from '../../components/Emblem';
import { HexMap } from './HexMap';

function PlacementTimer({ endsAt, total }: { endsAt: number | null; total: number }) {
  const left = useRemaining(endsAt);
  return (
    <div className="te-timer" role="timer">
      <span>Расстановка флагов</span>
      <b>{Math.ceil(left / 1000)}</b>
      <div className="te-timer-bar">
        <div style={{ transform: `scaleX(${total ? left / total : 0})` }} />
      </div>
    </div>
  );
}

/** Панели команд: герб, игроки, у лидера — корона, рядом число его флагов */
export function TerritoryPanels({ view, state }: { view: HostView; state: TerritoryState }) {
  // Земля: гексы + башни (башня = несколько гексов)
  const count = (id: string) => state.cells.reduce((s, c) => (c.ownerId === id ? s + (c.base ? BASE_VALUE : 1) : s), 0);
  if (view.settings.teamMode) {
    return (
      <div className="te-panels">
        {view.teams.map((t) => {
          const members = view.players.filter((p) => p.teamId === t.id).sort((a, b) => b.score - a.score);
          return (
            <section key={t.id} className="te-team" style={{ ['--tc' as string]: t.color }}>
              <header>
                <Emblem emblem={t.emblem} color={t.color} size={36} />
                <span className="te-team-name">{t.name}</span>
                <span className="te-team-count">{count(`t${t.id}`)}</span>
              </header>
              <ul>
                {members.map((m, i) => (
                  <li key={m.id}>
                    <span className="te-crown" aria-label={i === 0 ? 'лидер команды' : undefined}>
                      {i === 0 ? '👑' : ''}
                    </span>
                    <Avatar avatar={m.avatar} crop="head" size={26} />
                    <span className="te-pname">{m.name}</span>
                    <motion.span key={state.flags[m.id] ?? 0} className="te-flags" initial={{ scale: 1.5 }} animate={{ scale: 1 }}>
                      {state.flags[m.id] ?? 0}🚩
                    </motion.span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    );
  }
  const ranked = [...view.players].sort((a, b) => count(`p${b.id}`) - count(`p${a.id}`)).slice(0, 12);
  return (
    <div className="te-panels">
      <section className="te-team">
        <header>
          <span className="te-team-name">Захватчики</span>
        </header>
        <ul>
          {ranked.map((m, i) => (
            <li key={m.id}>
              <span className="te-crown">{i === 0 ? '👑' : ''}</span>
              <span className="tbl-dot" style={{ background: m.color }} />
              <span className="te-pname">{m.name}</span>
              <span className="te-hexes">{count(`p${m.id}`)}⬢</span>
              <span className="te-flags">{state.flags[m.id] ?? 0}🚩</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function TerritoryEvent({ view }: { view: HostView }) {
  const state = view.mode as TerritoryState;
  return (
    <div className="te">
      <div className="te-map">
        <HexMap state={state} labels />
      </div>
      <aside className="te-side">
        <PlacementTimer endsAt={state.placementEndsAt} total={state.placementTotalMs} />
        <p className="te-hint">Ставьте флаги на своих экранах — рядом со своей землёй. Чужой гекс — 2 флага, чужая башня — 3 флага.</p>
        <TerritoryPanels view={view} state={state} />
      </aside>
    </div>
  );
}
