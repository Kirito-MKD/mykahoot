import type { EmblemId } from '@viktorina/shared';

/** Гербы команд — собственные SVG */
export function Emblem({ emblem, color, size = 40 }: { emblem: EmblemId; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ flex: 'none' }}>
      <path d="M24 3 L42 9 V24 Q42 38 24 45 Q6 38 6 24 V9 Z" fill={color} stroke="#1A1033" strokeWidth={3.5} strokeLinejoin="round" />
      {emblem === 'flame' && (
        <path d="M24 13 Q31 20 29 27 Q33 25 32 21 Q38 30 30 36 Q24 40 18 36 Q11 30 17 22 Q17 27 21 28 Q17 20 24 13 Z" fill="#fff" stroke="#1A1033" strokeWidth={2} strokeLinejoin="round" />
      )}
      {emblem === 'wave' && (
        <path d="M11 30 Q15 24 19 30 Q23 36 27 30 Q31 24 35 30 Q37 33 38 33 M11 21 Q15 15 19 21 Q23 27 27 21 Q31 15 35 21" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" />
      )}
      {emblem === 'leaf' && (
        <g>
          <path d="M14 34 Q12 14 34 12 Q36 34 14 34 Z" fill="#fff" stroke="#1A1033" strokeWidth={2} strokeLinejoin="round" />
          <path d="M15 33 Q22 24 30 17" fill="none" stroke="#1A1033" strokeWidth={2} strokeLinecap="round" />
        </g>
      )}
      {emblem === 'star' && (
        <path d="M24 11 L27.5 20 L37 20.5 L29.5 26.5 L32 36 L24 30.5 L16 36 L18.5 26.5 L11 20.5 L20.5 20 Z" fill="#fff" stroke="#1A1033" strokeWidth={2} strokeLinejoin="round" />
      )}
    </svg>
  );
}
