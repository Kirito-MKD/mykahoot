import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_SETTINGS, MODES, MODE_INFO, TEAM_PRESETS, type GameMode, type GameSettings, type QuizSummary } from '@viktorina/shared';
import { request } from '../lib/socket';
import { KEYS, load, save } from '../lib/storage';
import { Button } from '../components/Button';
import { Emblem } from '../components/Emblem';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import { toast } from '../components/Toast';

export function ModeIcon({ mode, size = 56 }: { mode: GameMode; size?: number }) {
  const O = '#1A1033';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {mode === 'classic' && (
        <g>
          <rect x="6" y="10" width="24" height="20" rx="4" fill="#E21B3C" stroke={O} strokeWidth="3" />
          <rect x="34" y="10" width="24" height="20" rx="4" fill="#1368CE" stroke={O} strokeWidth="3" />
          <rect x="6" y="34" width="24" height="20" rx="4" fill="#D89E00" stroke={O} strokeWidth="3" />
          <rect x="34" y="34" width="24" height="20" rx="4" fill="#26890C" stroke={O} strokeWidth="3" />
          <path d="M18 16 L24 25 H12 Z" fill="#fff" />
          <path d="M46 14 L51 20 L46 26 L41 20 Z" fill="#fff" />
          <circle cx="18" cy="44" r="5" fill="#fff" />
          <rect x="41" y="39" width="10" height="10" rx="1" fill="#fff" />
        </g>
      )}
      {mode === 'territory' && (
        <g>
          <polygon points="20,8 32,15 32,29 20,36 8,29 8,15" fill="#8BCB6A" stroke={O} strokeWidth="3" strokeLinejoin="round" />
          <polygon points="44,8 56,15 56,29 44,36 32,29 32,15" fill="#E8572A" stroke={O} strokeWidth="3" strokeLinejoin="round" />
          <polygon points="32,29 44,36 44,50 32,57 20,50 20,36" fill="#1E88E5" stroke={O} strokeWidth="3" strokeLinejoin="round" />
          <path d="M42 30 V12 M42 12 L52 16 L42 20" stroke={O} strokeWidth="3" fill="#fff" strokeLinejoin="round" strokeLinecap="round" />
        </g>
      )}
      {mode === 'tower' && (
        <g>
          <circle cx="50" cy="12" r="6" fill="#FFC531" stroke={O} strokeWidth="2.5" />
          <rect x="14" y="44" width="36" height="12" rx="3" fill="#7B61FF" stroke={O} strokeWidth="3" />
          <rect x="18" y="32" width="28" height="12" rx="3" fill="#E8572A" stroke={O} strokeWidth="3" />
          <rect x="16" y="20" width="28" height="12" rx="3" fill="#2E9E4F" stroke={O} strokeWidth="3" />
          <rect x="20" y="8" width="24" height="12" rx="3" fill="#1E88E5" stroke={O} strokeWidth="3" />
        </g>
      )}
      {mode === 'escape' && (
        <g>
          <rect x="42" y="8" width="16" height="46" rx="3" fill="#3FD07A" stroke={O} strokeWidth="3" />
          <circle cx="53" cy="32" r="2" fill={O} />
          <rect x="4" y="22" width="18" height="22" rx="5" fill="#9AA3B5" stroke={O} strokeWidth="3" />
          <circle cx="10" cy="31" r="3" fill="#FF3B3B" />
          <circle cx="17" cy="31" r="3" fill="#FF3B3B" />
          <circle cx="32" cy="24" r="6" fill="#FFC531" stroke={O} strokeWidth="3" />
          <path d="M32 30 L30 42 L24 50 M30 42 L36 50 M31 34 L24 38 M31 34 L38 32" stroke={O} strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M2 56 H62" stroke={O} strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}

/** Настройки перед созданием игры: режим, команды, время */
export function GameSetup({ quiz, onClose }: { quiz: QuizSummary; onClose: () => void }) {
  const navigate = useNavigate();
  const [s, setS] = useState<GameSettings>(() => ({ ...DEFAULT_SETTINGS, ...load<Partial<GameSettings>>(KEYS.lastSettings, {}) }));
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof GameSettings>(k: K, v: GameSettings[K]) => setS((p) => ({ ...p, [k]: v }));

  const teamNames = Array.from({ length: s.teamCount }, (_, i) => s.teamNames[i] ?? '');

  const create = async () => {
    setBusy(true);
    const settings: GameSettings = { ...s, teamNames: teamNames.map((n, i) => n.trim() || TEAM_PRESETS[i]!.name) };
    save(KEYS.lastSettings, { ...settings, teamNames: [] });
    const res = await request<{ gameId: string; hostToken: string }>('host:create', { quizId: quiz.id, settings });
    setBusy(false);
    if (!res.ok || !res.data) {
      toast(res.error ?? 'Не удалось создать игру', 'error');
      return;
    }
    save(KEYS.hostToken, { token: res.data.hostToken, gameId: res.data.gameId });
    navigate('/teacher/game');
  };

  return (
    <Modal label="Настройки игры" onClose={onClose} wide>
      <div className="gs">
        <header className="gs-head">
          <span className="rc-kicker">Новая игра</span>
          <h2>{quiz.title}</h2>
        </header>

        <fieldset className="gs-block">
          <legend>Режим</legend>
          <div className="gs-modes" role="radiogroup">
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={s.mode === m}
                className={`gs-mode ${s.mode === m ? 'is-on' : ''}`}
                onClick={() => set('mode', m)}
              >
                <ModeIcon mode={m} />
                <span className="gs-mode-title">{MODE_INFO[m].title}</span>
                <span className="gs-mode-tag">{MODE_INFO[m].tagline}</span>
              </button>
            ))}
          </div>
          <p className="gs-desc">{MODE_INFO[s.mode].description}</p>
        </fieldset>

        <fieldset className="gs-block">
          <legend>Кто против кого</legend>
          <div className="seg" role="radiogroup">
            <button type="button" role="radio" aria-checked={!s.teamMode} className={!s.teamMode ? 'is-on' : ''} onClick={() => set('teamMode', false)}>
              Каждый сам за себя
            </button>
            <button type="button" role="radio" aria-checked={s.teamMode} className={s.teamMode ? 'is-on' : ''} onClick={() => set('teamMode', true)}>
              Командная игра
            </button>
          </div>
          {s.teamMode && (
            <div className="gs-teams">
              <div className="row" style={{ gap: 10 }}>
                <span>Команд:</span>
                {[2, 3, 4].map((n) => (
                  <button key={n} type="button" className={`gs-num ${s.teamCount === n ? 'is-on' : ''}`} onClick={() => set('teamCount', n)} aria-pressed={s.teamCount === n}>
                    {n}
                  </button>
                ))}
                <span className="text-muted" style={{ fontSize: 14 }}>
                  Дети распределятся случайно при старте
                </span>
              </div>
              <div className="gs-team-names">
                {teamNames.map((n, i) => (
                  <label key={i} className="gs-team-name" style={{ ['--tc' as string]: TEAM_PRESETS[i]!.color }}>
                    <Emblem emblem={TEAM_PRESETS[i]!.emblem} color={TEAM_PRESETS[i]!.color} size={34} />
                    <input
                      className="input"
                      value={n}
                      maxLength={30}
                      placeholder={TEAM_PRESETS[i]!.name}
                      aria-label={`Название команды ${i + 1}`}
                      onChange={(e) => {
                        const next = teamNames.slice();
                        next[i] = e.target.value;
                        set('teamNames', next);
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
        </fieldset>

        <fieldset className="gs-block gs-grid">
          <legend>Время и правила</legend>
          <label className="gs-field">
            <span>Время на вопрос</span>
            <select
              className="input"
              value={s.timeLimitOverride ?? ''}
              onChange={(e) => set('timeLimitOverride', e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">как в тесте</option>
              {[10, 15, 20, 30, 45, 60, 90, 120].map((t) => (
                <option key={t} value={t}>
                  {t} сек на каждый
                </option>
              ))}
            </select>
          </label>
          <label className="gs-check">
            <input type="checkbox" checked={s.shuffleQuestions} onChange={(e) => set('shuffleQuestions', e.target.checked)} />
            Перемешать вопросы
          </label>
          {s.mode === 'territory' && (
            <label className="gs-field">
              <span>Расстановка флагов</span>
              <select className="input" value={s.placementSeconds} onChange={(e) => set('placementSeconds', Number(e.target.value))}>
                {[10, 15, 20, 30].map((t) => (
                  <option key={t} value={t}>
                    {t} сек
                  </option>
                ))}
              </select>
            </label>
          )}
          {s.mode === 'tower' && (
            <label className="gs-field">
              <span>Монстр приходит</span>
              <select className="input" value={s.monsterEvery} onChange={(e) => set('monsterEvery', Number(e.target.value))}>
                {[3, 4, 5, 6, 8, 10].map((t) => (
                  <option key={t} value={t}>
                    каждый {t}-й раунд
                  </option>
                ))}
              </select>
            </label>
          )}
          {s.mode === 'escape' && (
            <label className="gs-field">
              <span>Время на уровень (максимум)</span>
              <select className="input" value={s.levelMinutes} onChange={(e) => set('levelMinutes', Number(e.target.value))}>
                {[2, 3, 4, 5, 7, 10].map((t) => (
                  <option key={t} value={t}>
                    {t} мин
                  </option>
                ))}
              </select>
            </label>
          )}
        </fieldset>

        <footer className="rc-actions">
          <Button variant="quiet" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="green" size="lg" onClick={create} disabled={busy}>
            {busy && <Spinner size={22} />}
            Создать игру
          </Button>
        </footer>
      </div>
    </Modal>
  );
}
