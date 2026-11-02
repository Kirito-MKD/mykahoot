import { memo } from 'react';

function stars(count: number, seed: number, w: number, h: number, maxR: number) {
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: count }, (_, i) => (
    <circle key={i} cx={(rnd() * w).toFixed(1)} cy={(rnd() * h).toFixed(1)} r={(0.6 + rnd() * maxR).toFixed(2)} fill="#fff" opacity={(0.35 + rnd() * 0.6).toFixed(2)} />
  ));
}

/**
 * Космос в три слоя параллакса: дальние звёзды — медленно, планеты — средне, ближний слой — быстрее.
 * Каждый слой — две одинаковые половины, сдвигается на 50% по кругу.
 */
export const SpaceBackdrop = memo(function SpaceBackdrop({ reduced }: { reduced: boolean }) {
  const half = (content: React.ReactNode, w: number, h: number) => (
    <svg viewBox={`0 0 ${w * 2} ${h}`} preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
      <g>{content}</g>
      <g transform={`translate(${w} 0)`}>{content}</g>
    </svg>
  );
  return (
    <div className={`space ${reduced ? 'is-static' : ''}`} aria-hidden="true">
      <div className="space-layer space-far">{half(stars(140, 7, 1600, 900, 1.3), 1600, 900)}</div>
      <div className="space-layer space-mid">
        {half(
          <>
            <g>
              <circle cx={260} cy={220} r={90} fill="#F08A5D" stroke="#1A1033" strokeWidth={6} />
              <path d="M186 190 Q260 170 336 196 M176 238 Q262 222 346 246" stroke="#D86A3C" strokeWidth={12} fill="none" strokeLinecap="round" />
              <circle cx={232} cy={196} r={12} fill="#D86A3C" />
            </g>
            <g>
              <circle cx={1180} cy={560} r={58} fill="#6EC1E4" stroke="#1A1033" strokeWidth={6} />
              <ellipse cx={1180} cy={560} rx={110} ry={20} fill="none" stroke="#C9E9F7" strokeWidth={10} transform="rotate(-18 1180 560)" />
            </g>
            <circle cx={820} cy={130} r={26} fill="#B58CF2" stroke="#1A1033" strokeWidth={5} />
          </>,
          1600,
          900,
        )}
      </div>
      <div className="space-layer space-near">
        {half(
          <>
            {stars(22, 99, 1600, 900, 2.6)}
            <path d="M420 760 l26 -12 l18 14 l-8 22 l-28 4 z" fill="#5B5577" stroke="#1A1033" strokeWidth={4} />
            <path d="M1300 300 l18 -8 l12 10 l-6 16 l-20 2 z" fill="#5B5577" stroke="#1A1033" strokeWidth={4} />
          </>,
          1600,
          900,
        )}
      </div>
    </div>
  );
});
