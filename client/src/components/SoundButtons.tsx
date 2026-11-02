import { useEffect, useState } from 'react';
import { isMusicOn, isMuted, onSoundSettingsChange, setMusicOn, setMuted } from '../lib/sound';
import { Button } from './Button';

function useSoundSettings() {
  const [, force] = useState(0);
  useEffect(() => onSoundSettingsChange(() => force((n) => n + 1)), []);
  return { muted: isMuted(), music: isMusicOn() };
}

export function MuteButton({ variant = 'ghost' }: { variant?: 'ghost' | 'quiet' }) {
  const { muted } = useSoundSettings();
  const color = variant === 'ghost' ? '#fff' : 'var(--ink)';
  return (
    <Button
      variant={variant}
      size="sm"
      iconOnly
      aria-pressed={!muted}
      aria-label={muted ? 'Включить звуки' : 'Выключить звуки'}
      title={muted ? 'Включить звуки' : 'Выключить звуки'}
      onClick={() => setMuted(!muted)}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9 H8 L13 5 V19 L8 15 H4 Z" fill={color} />
        {muted ? (
          <path d="M16 9 L21 14 M21 9 L16 14" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
        ) : (
          <path d="M16 8.5 Q19 12 16 15.5 M18.5 6 Q23 12 18.5 18" stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        )}
      </svg>
    </Button>
  );
}

export function MusicButton() {
  const { music } = useSoundSettings();
  return (
    <Button
      variant="ghost"
      size="sm"
      iconOnly
      aria-pressed={music}
      aria-label={music ? 'Выключить музыку' : 'Включить музыку'}
      title={music ? 'Выключить музыку' : 'Включить музыку'}
      onClick={() => setMusicOn(!music)}
      className={music ? '' : 'is-off'}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 17 V5 L19 3 V15" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
        <circle cx="6.5" cy="17.5" r="2.8" fill="#fff" />
        <circle cx="16.5" cy="15.5" r="2.8" fill="#fff" />
        {!music && <path d="M3 3 L21 21" stroke="#E21B3C" strokeWidth="2.6" strokeLinecap="round" />}
      </svg>
    </Button>
  );
}

export { useSoundSettings };
