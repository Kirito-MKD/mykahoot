/**
 * Детали аватара — собственные SVG в едином стиле:
 * округлые формы, толстый контур 4px, плоская заливка без градиентов.
 * Система координат: viewBox 0 0 200 220, центр головы ≈ (100, 96).
 */
import type { ReactNode } from 'react';
import { AVATAR_COLORS, darken, lighten, type AvatarBase, type AvatarGlasses, type AvatarHat, type AvatarOutfit } from '@viktorina/shared';

export const OUTLINE = '#1A1033';
const SW = 4;
const s = { stroke: OUTLINE, strokeWidth: SW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const PINK = '#F59BB5';
const WHITE = '#FFFFFF';

interface BaseSpec {
  fur: string;
}

const BASE_DEFAULT: Record<AvatarBase, BaseSpec> = {
  cat: { fur: '#F4A340' },
  fox: { fur: '#EE6A2B' },
  panda: { fur: '#3A3445' },
  rabbit: { fur: '#E9E4F2' },
  raccoon: { fur: '#8E8A99' },
  gorilla: { fur: '#4D4757' },
  bear: { fur: '#9A6338' },
  penguin: { fur: '#353B55' },
  frog: { fur: '#6CC24A' },
  owl: { fur: '#A9764A' },
  wolf: { fur: '#7F8796' },
  hedgehog: { fur: '#8A5E3C' },
};

export interface Palette {
  fur: string;
  light: string;
  dark: string;
}

export function paletteFor(base: AvatarBase, color: number): Palette {
  const chosen = AVATAR_COLORS[color];
  const fur = chosen && 'fur' in chosen ? chosen.fur : BASE_DEFAULT[base].fur;
  return { fur, light: lighten(fur, 0.72), dark: darken(fur, 0.38) };
}

function Eyes({ y = 92, dx = 20, r = 7 }: { y?: number; dx?: number; r?: number }) {
  return (
    <g>
      <circle cx={100 - dx} cy={y} r={r} fill={OUTLINE} />
      <circle cx={100 + dx} cy={y} r={r} fill={OUTLINE} />
      <circle cx={100 - dx + r * 0.35} cy={y - r * 0.4} r={r * 0.35} fill={WHITE} />
      <circle cx={100 + dx + r * 0.35} cy={y - r * 0.4} r={r * 0.35} fill={WHITE} />
    </g>
  );
}

function Cheeks({ y = 112, dx = 36 }: { y?: number; dx?: number }) {
  return (
    <g opacity={0.55}>
      <ellipse cx={100 - dx} cy={y} rx={9} ry={5} fill={PINK} />
      <ellipse cx={100 + dx} cy={y} rx={9} ry={5} fill={PINK} />
    </g>
  );
}

function Smile({ y = 120 }: { y?: number }) {
  return <path d={`M91 ${y} Q100 ${y + 8} 109 ${y}`} fill="none" {...s} strokeWidth={3.5} />;
}

function CatMouth({ y = 118 }: { y?: number }) {
  return <path d={`M90 ${y} Q95 ${y + 6} 100 ${y} Q105 ${y + 6} 110 ${y}`} fill="none" {...s} strokeWidth={3.5} />;
}

/** Части животного: back — за головой (уши), head — голова и мордочка */
export function BaseParts({ base, p }: { base: AvatarBase; p: Palette }): { back: ReactNode; head: ReactNode } {
  switch (base) {
    case 'cat':
      return {
        back: (
          <g>
            <path d="M48 76 L56 24 L92 50 Z" fill={p.fur} {...s} />
            <path d="M152 76 L144 24 L108 50 Z" fill={p.fur} {...s} />
            <path d="M58 62 L61 38 L80 52 Z" fill={PINK} />
            <path d="M142 62 L139 38 L120 52 Z" fill={PINK} />
          </g>
        ),
        head: (
          <g>
            <ellipse cx={100} cy={98} rx={58} ry={52} fill={p.fur} {...s} />
            <path d="M84 52 Q88 62 86 70 M100 50 L100 66 M116 52 Q112 62 114 70" stroke={p.dark} strokeWidth={4} strokeLinecap="round" fill="none" />
            <ellipse cx={100} cy={116} rx={22} ry={14} fill={p.light} />
            <Eyes />
            <Cheeks />
            <path d="M94 106 L106 106 L100 113 Z" fill={PINK} {...s} strokeWidth={2.5} />
            <CatMouth y={116} />
            <path d="M72 112 L46 106 M72 120 L46 122 M128 112 L154 106 M128 120 L154 122" stroke={OUTLINE} strokeWidth={2.5} strokeLinecap="round" />
          </g>
        ),
      };
    case 'fox':
      return {
        back: (
          <g>
            <path d="M46 82 L50 18 L94 52 Z" fill={p.fur} {...s} />
            <path d="M154 82 L150 18 L106 52 Z" fill={p.fur} {...s} />
            <path d="M50 18 L54 40 L66 34 Z" fill={OUTLINE} />
            <path d="M150 18 L146 40 L134 34 Z" fill={OUTLINE} />
            <path d="M58 64 L58 38 L80 54 Z" fill={p.light} />
            <path d="M142 64 L142 38 L120 54 Z" fill={p.light} />
          </g>
        ),
        head: (
          <g>
            <path d="M40 92 Q40 48 100 46 Q160 48 160 92 Q160 122 100 150 Q40 122 40 92 Z" fill={p.fur} {...s} />
            <path d="M42 96 Q74 100 100 148 Q126 100 158 96 Q154 126 100 150 Q46 126 42 96 Z" fill={WHITE} />
            <path d="M40 92 Q40 48 100 46 Q160 48 160 92 Q160 122 100 150 Q40 122 40 92 Z" fill="none" {...s} />
            <Eyes y={88} dx={22} />
            <ellipse cx={100} cy={132} rx={8} ry={6} fill={OUTLINE} />
            <path d="M100 138 L100 142" {...s} strokeWidth={3} />
          </g>
        ),
      };
    case 'panda':
      return {
        back: (
          <g>
            <circle cx={54} cy={52} r={19} fill={p.fur} {...s} />
            <circle cx={146} cy={52} r={19} fill={p.fur} {...s} />
          </g>
        ),
        head: (
          <g>
            <ellipse cx={100} cy={98} rx={58} ry={52} fill={WHITE} {...s} />
            <ellipse cx={77} cy={94} rx={15} ry={19} transform="rotate(30 77 94)" fill={p.fur} />
            <ellipse cx={123} cy={94} rx={15} ry={19} transform="rotate(-30 123 94)" fill={p.fur} />
            <circle cx={79} cy={92} r={6} fill={WHITE} />
            <circle cx={121} cy={92} r={6} fill={WHITE} />
            <circle cx={80} cy={92} r={3.5} fill={OUTLINE} />
            <circle cx={120} cy={92} r={3.5} fill={OUTLINE} />
            <ellipse cx={100} cy={113} rx={9} ry={6} fill={OUTLINE} />
            <Smile y={121} />
            <Cheeks y={116} dx={38} />
          </g>
        ),
      };
    case 'rabbit':
      return {
        back: (
          <g>
            <ellipse cx={76} cy={34} rx={14} ry={40} transform="rotate(-10 76 34)" fill={p.fur} {...s} />
            <ellipse cx={124} cy={34} rx={14} ry={40} transform="rotate(10 124 34)" fill={p.fur} {...s} />
            <ellipse cx={76} cy={36} rx={6} ry={28} transform="rotate(-10 76 36)" fill={PINK} />
            <ellipse cx={124} cy={36} rx={6} ry={28} transform="rotate(10 124 36)" fill={PINK} />
          </g>
        ),
        head: (
          <g>
            <ellipse cx={100} cy={100} rx={56} ry={50} fill={p.fur} {...s} />
            <ellipse cx={100} cy={118} rx={20} ry={14} fill={p.light} />
            <Eyes y={94} />
            <Cheeks y={114} />
            <ellipse cx={100} cy={110} rx={6} ry={4.5} fill={PINK} {...s} strokeWidth={2.5} />
            <CatMouth y={117} />
            <rect x={94} y={121} width={12} height={10} rx={2} fill={WHITE} {...s} strokeWidth={2.5} />
          </g>
        ),
      };
    case 'raccoon':
      return {
        back: (
          <g>
            <path d="M48 70 Q46 34 76 46 Z" fill={p.fur} {...s} />
            <path d="M152 70 Q154 34 124 46 Z" fill={p.fur} {...s} />
            <path d="M56 62 Q56 46 70 50 Z" fill={p.dark} />
            <path d="M144 62 Q144 46 130 50 Z" fill={p.dark} />
          </g>
        ),
        head: (
          <g>
            <ellipse cx={100} cy={98} rx={58} ry={52} fill={p.fur} {...s} />
            <path d="M100 48 Q92 64 100 82 Q108 64 100 48 Z" fill={p.dark} />
            <path d="M44 96 Q70 74 100 90 Q130 74 156 96 Q142 114 120 106 Q100 98 80 106 Q58 114 44 96 Z" fill={OUTLINE} />
            <path d="M58 122 Q100 156 142 122 Q130 104 100 104 Q70 104 58 122 Z" fill={p.light} />
            <circle cx={80} cy={93} r={6} fill={WHITE} />
            <circle cx={120} cy={93} r={6} fill={WHITE} />
            <circle cx={81} cy={93} r={3} fill={OUTLINE} />
            <circle cx={119} cy={93} r={3} fill={OUTLINE} />
            <ellipse cx={100} cy={116} rx={8} ry={5.5} fill={OUTLINE} />
            <Smile y={124} />
          </g>
        ),
      };
    case 'gorilla':
      return {
        back: (
          <g>
            <circle cx={42} cy={100} r={13} fill={p.fur} {...s} />
            <circle cx={158} cy={100} r={13} fill={p.fur} {...s} />
            <circle cx={42} cy={100} r={6} fill="#B9A08F" />
            <circle cx={158} cy={100} r={6} fill="#B9A08F" />
          </g>
        ),
        head: (
          <g>
            <path d="M44 100 Q40 46 100 42 Q160 46 156 100 Q156 150 100 150 Q44 150 44 100 Z" fill={p.fur} {...s} />
            <path d="M90 44 Q100 30 110 44" fill={p.fur} {...s} />
            <path d="M58 98 Q58 72 100 80 Q142 72 142 98 Q150 142 100 144 Q50 142 58 98 Z" fill="#C7AE9B" {...s} strokeWidth={3} />
            <path d="M62 82 Q80 70 98 82 M102 82 Q120 70 138 82" stroke={p.dark} strokeWidth={7} strokeLinecap="round" fill="none" />
            <Eyes y={94} dx={18} r={6} />
            <ellipse cx={93} cy={114} rx={3.5} ry={2.5} fill={OUTLINE} />
            <ellipse cx={107} cy={114} rx={3.5} ry={2.5} fill={OUTLINE} />
            <path d="M84 128 Q100 136 116 128" fill="none" {...s} strokeWidth={3.5} />
          </g>
        ),
      };
    case 'bear':
      return {
        back: (
          <g>
            <circle cx={56} cy={52} r={19} fill={p.fur} {...s} />
            <circle cx={144} cy={52} r={19} fill={p.fur} {...s} />
            <circle cx={56} cy={52} r={9} fill={p.light} />
            <circle cx={144} cy={52} r={9} fill={p.light} />
          </g>
        ),
        head: (
          <g>
            <ellipse cx={100} cy={98} rx={58} ry={52} fill={p.fur} {...s} />
            <ellipse cx={100} cy={118} rx={25} ry={18} fill={p.light} {...s} strokeWidth={3} />
            <Eyes y={90} />
            <ellipse cx={100} cy={110} rx={9} ry={6.5} fill={OUTLINE} />
            <path d="M100 116 L100 122 M92 124 Q100 130 108 124" fill="none" {...s} strokeWidth={3} />
            <Cheeks y={108} dx={40} />
          </g>
        ),
      };
    case 'penguin':
      return {
        back: null,
        head: (
          <g>
            <ellipse cx={100} cy={96} rx={58} ry={54} fill={p.fur} {...s} />
            <path d="M52 108 Q50 70 80 72 Q96 74 100 86 Q104 74 120 72 Q150 70 148 108 Q146 146 100 148 Q54 146 52 108 Z" fill={WHITE} />
            <Eyes y={96} dx={22} />
            <path d="M88 110 L112 110 L100 126 Z" fill="#FFA62B" {...s} strokeWidth={3} />
            <Cheeks y={118} dx={34} />
          </g>
        ),
      };
    case 'frog':
      return {
        back: (
          <g>
            <circle cx={68} cy={56} r={24} fill={p.fur} {...s} />
            <circle cx={132} cy={56} r={24} fill={p.fur} {...s} />
          </g>
        ),
        head: (
          <g>
            <ellipse cx={100} cy={104} rx={64} ry={46} fill={p.fur} {...s} />
            <circle cx={68} cy={56} r={24} fill={p.fur} />
            <circle cx={132} cy={56} r={24} fill={p.fur} />
            <circle cx={68} cy={56} r={14} fill={WHITE} {...s} strokeWidth={3} />
            <circle cx={132} cy={56} r={14} fill={WHITE} {...s} strokeWidth={3} />
            <circle cx={70} cy={58} r={7} fill={OUTLINE} />
            <circle cx={130} cy={58} r={7} fill={OUTLINE} />
            <path d="M58 112 Q100 146 142 112" fill="none" {...s} />
            <circle cx={92} cy={96} r={2.5} fill={OUTLINE} />
            <circle cx={108} cy={96} r={2.5} fill={OUTLINE} />
            <Cheeks y={114} dx={46} />
          </g>
        ),
      };
    case 'owl':
      return {
        back: (
          <g>
            <path d="M46 70 L44 26 L80 50 Z" fill={p.fur} {...s} />
            <path d="M154 70 L156 26 L120 50 Z" fill={p.fur} {...s} />
          </g>
        ),
        head: (
          <g>
            <ellipse cx={100} cy={98} rx={58} ry={54} fill={p.fur} {...s} />
            <circle cx={77} cy={94} r={23} fill={p.light} {...s} strokeWidth={3} />
            <circle cx={123} cy={94} r={23} fill={p.light} {...s} strokeWidth={3} />
            <Eyes y={94} dx={23} r={10} />
            <path d="M92 112 L108 112 L100 128 Z" fill="#FFA62B" {...s} strokeWidth={3} />
            <path d="M70 136 L76 142 L82 136 M94 140 L100 146 L106 140 M118 136 L124 142 L130 136" fill="none" stroke={p.dark} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ),
      };
    case 'wolf':
      return {
        back: (
          <g>
            <path d="M44 80 L50 16 L92 50 Z" fill={p.fur} {...s} />
            <path d="M156 80 L150 16 L108 50 Z" fill={p.fur} {...s} />
            <path d="M56 64 L58 36 L78 52 Z" fill={p.light} />
            <path d="M144 64 L142 36 L122 52 Z" fill={p.light} />
          </g>
        ),
        head: (
          <g>
            <path d="M42 96 Q40 48 100 46 Q160 48 158 96 L150 120 L132 116 L120 144 Q100 152 80 144 L68 116 L50 120 Z" fill={p.fur} {...s} />
            <path d="M74 106 Q100 96 126 106 L120 142 Q100 150 80 142 Z" fill={p.light} />
            <path d="M84 56 L100 76 L116 56" fill={p.light} />
            <Eyes y={88} dx={22} />
            <ellipse cx={100} cy={118} rx={10} ry={7} fill={OUTLINE} />
            <path d="M100 125 L100 132 M90 134 Q100 140 110 134" fill="none" {...s} strokeWidth={3} />
          </g>
        ),
      };
    case 'hedgehog':
      return {
        back: (
          <g>
            <path
              d="M36 112 L24 92 L40 86 L28 62 L50 62 L44 36 L66 46 L70 20 L88 38 L100 14 L112 38 L130 20 L134 46 L156 36 L150 62 L172 62 L160 86 L176 92 L164 112 Z"
              fill={p.fur}
              {...s}
            />
          </g>
        ),
        head: (
          <g>
            <path d="M48 104 Q48 62 100 62 Q152 62 152 104 Q152 148 100 148 Q48 148 48 104 Z" fill="#F3D9B1" {...s} />
            <path d="M58 78 Q78 62 100 76 Q122 62 142 78" fill="none" stroke={p.fur} strokeWidth={8} strokeLinecap="round" />
            <Eyes y={100} dx={20} />
            <ellipse cx={100} cy={122} rx={13} ry={10} fill="#E9C496" {...s} strokeWidth={3} />
            <circle cx={100} cy={118} r={5} fill={OUTLINE} />
            <Cheeks y={120} dx={34} />
          </g>
        ),
      };
  }
}

// ───────────────────────── Одежда ─────────────────────────

const TORSO = 'M34 224 Q36 162 100 150 Q164 162 166 224 Z';

export function Outfit({ outfit }: { outfit: AvatarOutfit }): ReactNode {
  switch (outfit) {
    case 'tshirt':
      return (
        <g>
          <path d={TORSO} fill="#3F8CFF" {...s} />
          <path d="M80 154 Q100 172 120 154" fill="none" {...s} />
          <circle cx={128} cy={190} r={9} fill="#FFC531" {...s} strokeWidth={3} />
        </g>
      );
    case 'hoodie':
      return (
        <g>
          <path d="M58 172 Q60 140 100 140 Q140 140 142 172 Z" fill="#2FA36B" {...s} />
          <path d={TORSO} fill="#38B87A" {...s} />
          <path d="M70 160 Q100 186 130 160" fill="#2FA36B" {...s} />
          <path d="M90 176 L88 198 M110 176 L112 198" {...s} strokeWidth={3} />
          <path d="M70 224 L70 206 Q100 214 130 206 L130 224" fill="#2FA36B" {...s} strokeWidth={3} />
        </g>
      );
    case 'stripes':
      return (
        <g>
          <defs>
            <clipPath id="av-torso-clip">
              <path d={TORSO} />
            </clipPath>
          </defs>
          <path d={TORSO} fill="#FFFFFF" />
          <g clipPath="url(#av-torso-clip)">
            {[160, 184, 208].map((y) => (
              <rect key={y} x={20} y={y} width={160} height={12} fill="#E8434F" />
            ))}
          </g>
          <path d={TORSO} fill="none" {...s} />
          <path d="M82 154 Q100 168 118 154" fill="none" {...s} />
        </g>
      );
    case 'suit':
      return (
        <g>
          <path d={TORSO} fill="#2E3350" {...s} />
          <path d="M80 154 L100 200 L120 154 Q100 150 80 154 Z" fill="#FFFFFF" {...s} strokeWidth={3} />
          <path d="M96 164 L104 164 L108 196 L100 206 L92 196 Z" fill="#E21B3C" {...s} strokeWidth={3} />
          <path d="M80 154 L92 196 L70 174 Z M120 154 L108 196 L130 174 Z" fill="#3B4166" {...s} strokeWidth={3} />
        </g>
      );
    case 'space':
      return (
        <g>
          <path d={TORSO} fill="#F2F4F8" {...s} />
          <path d="M66 160 Q100 176 134 160 Q132 150 100 148 Q68 150 66 160 Z" fill="#A7B0C2" {...s} strokeWidth={3} />
          <rect x={78} y={182} width={44} height={28} rx={6} fill="#5E6A85" {...s} strokeWidth={3} />
          <circle cx={90} cy={196} r={5} fill="#FF5E5E" />
          <circle cx={104} cy={196} r={5} fill="#FFC531" />
          <circle cx={116} cy={196} r={3} fill="#3FD07A" />
          <path d="M44 210 L60 200 M156 210 L140 200" stroke="#FF8A3D" strokeWidth={6} strokeLinecap="round" />
        </g>
      );
    case 'sport':
      return (
        <g>
          <path d={TORSO} fill="#FFC531" {...s} />
          <path d="M80 154 Q100 170 120 154" fill="none" stroke="#E21B3C" strokeWidth={6} strokeLinecap="round" />
          <path d="M44 196 L56 176 M156 196 L144 176" stroke="#E21B3C" strokeWidth={6} strokeLinecap="round" />
          <text x={100} y={210} textAnchor="middle" fontSize={34} fontWeight={900} fill="#E21B3C" stroke={OUTLINE} strokeWidth={2} fontFamily="Nunito, sans-serif">
            7
          </text>
        </g>
      );
    case 'cape':
      return (
        <g>
          <path d="M40 166 Q100 140 160 166 L180 224 L20 224 Z" fill="#E21B3C" {...s} />
          <path d={TORSO} fill="#2F6BFF" {...s} />
          <path d="M100 170 L112 184 L100 204 L88 184 Z" fill="#FFC531" {...s} strokeWidth={3} />
          <circle cx={70} cy={160} r={6} fill="#FFC531" {...s} strokeWidth={2.5} />
          <circle cx={130} cy={160} r={6} fill="#FFC531" {...s} strokeWidth={2.5} />
        </g>
      );
    case 'overalls':
      return (
        <g>
          <path d={TORSO} fill="#FF8A3D" {...s} />
          <path d="M66 224 L68 186 L132 186 L134 224 Z" fill="#3D6FD1" {...s} strokeWidth={3} />
          <path d="M70 186 L64 156 M130 186 L136 156" stroke="#3D6FD1" strokeWidth={9} strokeLinecap="round" />
          <circle cx={76} cy={192} r={4} fill="#FFC531" {...s} strokeWidth={2} />
          <circle cx={124} cy={192} r={4} fill="#FFC531" {...s} strokeWidth={2} />
          <rect x={88} y={198} width={24} height={14} rx={3} fill="#2E5BB5" {...s} strokeWidth={2.5} />
        </g>
      );
  }
}

// ───────────────────────── Очки ─────────────────────────

function heartPath(cx: number, cy: number, r: number): string {
  return `M${cx} ${cy + r * 0.9} C${cx - r * 1.6} ${cy - r * 0.2} ${cx - r * 0.8} ${cy - r * 1.3} ${cx} ${cy - r * 0.45} C${cx + r * 0.8} ${cy - r * 1.3} ${cx + r * 1.6} ${cy - r * 0.2} ${cx} ${cy + r * 0.9} Z`;
}

function starPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let k = 0; k < 10; k++) {
    const a = (Math.PI / 5) * k - Math.PI / 2;
    const rr = k % 2 === 0 ? r : r * 0.48;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
}

export function Glasses({ glasses, y = 92 }: { glasses: AvatarGlasses; y?: number }): ReactNode {
  const L = 80;
  const R = 120;
  switch (glasses) {
    case 'none':
      return null;
    case 'round':
      return (
        <g>
          <circle cx={L} cy={y} r={16} fill="rgba(255,255,255,0.25)" {...s} />
          <circle cx={R} cy={y} r={16} fill="rgba(255,255,255,0.25)" {...s} />
          <path d={`M96 ${y} Q100 ${y - 4} 104 ${y} M64 ${y - 2} L46 ${y - 6} M136 ${y - 2} L154 ${y - 6}`} fill="none" {...s} />
        </g>
      );
    case 'square':
      return (
        <g>
          <rect x={L - 18} y={y - 13} width={36} height={26} rx={6} fill="rgba(255,255,255,0.25)" {...s} />
          <rect x={R - 18} y={y - 13} width={36} height={26} rx={6} fill="rgba(255,255,255,0.25)" {...s} />
          <path d={`M98 ${y - 2} L102 ${y - 2} M62 ${y - 4} L46 ${y - 8} M138 ${y - 4} L154 ${y - 8}`} fill="none" {...s} />
        </g>
      );
    case 'sun':
      return (
        <g>
          <path d={`M60 ${y - 12} L98 ${y - 12} Q98 ${y + 16} 78 ${y + 15} Q60 ${y + 14} 60 ${y - 12} Z`} fill={OUTLINE} {...s} />
          <path d={`M102 ${y - 12} L140 ${y - 12} Q140 ${y + 14} 122 ${y + 15} Q102 ${y + 16} 102 ${y - 12} Z`} fill={OUTLINE} {...s} />
          <path d={`M66 ${y - 6} L76 ${y - 6} M108 ${y - 6} L118 ${y - 6}`} stroke="#6E6390" strokeWidth={4} strokeLinecap="round" />
          <path d={`M60 ${y - 10} L46 ${y - 14} M140 ${y - 10} L154 ${y - 14}`} {...s} />
        </g>
      );
    case 'stars':
      return (
        <g>
          <path d={starPath(L, y, 20)} fill="#FF7AC6" {...s} strokeWidth={3.5} />
          <path d={starPath(R, y, 20)} fill="#FF7AC6" {...s} strokeWidth={3.5} />
          <circle cx={L} cy={y + 1} r={7} fill="#FFD6EF" />
          <circle cx={R} cy={y + 1} r={7} fill="#FFD6EF" />
          <path d={`M97 ${y} L103 ${y}`} {...s} />
        </g>
      );
    case 'hearts':
      return (
        <g>
          <path d={heartPath(L, y, 16)} fill="#FF4D6D" {...s} strokeWidth={3.5} />
          <path d={heartPath(R, y, 16)} fill="#FF4D6D" {...s} strokeWidth={3.5} />
          <path d={`M96 ${y - 4} L104 ${y - 4}`} {...s} />
          <circle cx={L - 5} cy={y - 4} r={3} fill="#FFFFFF" opacity={0.8} />
          <circle cx={R - 5} cy={y - 4} r={3} fill="#FFFFFF" opacity={0.8} />
        </g>
      );
    case 'monocle':
      return (
        <g>
          <circle cx={R} cy={y} r={17} fill="rgba(255,255,255,0.3)" stroke="#D49B00" strokeWidth={5} />
          <path d={`M${R + 12} ${y + 12} Q${R + 22} ${y + 40} ${R + 6} ${y + 62}`} fill="none" stroke="#D49B00" strokeWidth={2.5} strokeDasharray="4 3" />
        </g>
      );
    case 'goggles':
      return (
        <g>
          <path d={`M40 ${y - 4} L160 ${y - 4}`} stroke="#E8434F" strokeWidth={10} strokeLinecap="round" />
          <rect x={56} y={y - 16} width={88} height={30} rx={14} fill="#7FD3F7" {...s} />
          <path d={`M100 ${y - 16} L100 ${y + 14}`} {...s} strokeWidth={3} />
          <path d={`M66 ${y - 8} L78 ${y - 8}`} stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" />
        </g>
      );
    case 'nerd':
      return (
        <g>
          <rect x={L - 19} y={y - 14} width={38} height={28} rx={4} fill="rgba(255,255,255,0.2)" stroke={OUTLINE} strokeWidth={7} />
          <rect x={R - 19} y={y - 14} width={38} height={28} rx={4} fill="rgba(255,255,255,0.2)" stroke={OUTLINE} strokeWidth={7} />
          <path d={`M99 ${y - 4} L101 ${y - 4}`} stroke={OUTLINE} strokeWidth={7} />
          <rect x={96} y={y - 6} width={8} height={5} fill="#FFFFFF" {...s} strokeWidth={2} />
        </g>
      );
  }
}

// ───────────────────────── Головные уборы ─────────────────────────

export function Hat({ hat }: { hat: AvatarHat }): ReactNode {
  switch (hat) {
    case 'none':
      return null;
    case 'cap':
      return (
        <g>
          <path d="M48 60 Q48 14 100 14 Q152 14 152 60 Z" fill="#E8434F" {...s} />
          <path d="M120 56 Q166 50 182 64 Q164 72 124 66 Z" fill="#C32A37" {...s} />
          <path d="M100 14 L100 58 M72 22 Q78 40 76 58" stroke="#C32A37" strokeWidth={3} fill="none" />
          <circle cx={100} cy={14} r={5} fill="#C32A37" {...s} strokeWidth={3} />
        </g>
      );
    case 'beanie':
      return (
        <g>
          <path d="M52 56 Q50 10 100 10 Q150 10 148 56 Z" fill="#7B61FF" {...s} />
          <rect x={46} y={44} width={108} height={22} rx={10} fill="#5B44D9" {...s} />
          <path d="M64 48 L64 62 M80 48 L80 62 M96 48 L96 62 M112 48 L112 62 M128 48 L128 62 M140 48 L140 62" stroke="#3E2DAA" strokeWidth={3} strokeLinecap="round" />
          <circle cx={100} cy={8} r={11} fill="#FFC531" {...s} />
        </g>
      );
    case 'tophat':
      return (
        <g>
          <rect x={66} y={-10} width={68} height={60} rx={6} fill="#2A2438" {...s} />
          <rect x={66} y={30} width={68} height={12} fill="#E8434F" {...s} strokeWidth={3} />
          <ellipse cx={100} cy={52} rx={56} ry={10} fill="#2A2438" {...s} />
        </g>
      );
    case 'crown':
      return (
        <g>
          <path d="M56 58 L52 18 L76 38 L100 8 L124 38 L148 18 L144 58 Z" fill="#FFC531" {...s} />
          <rect x={56} y={48} width={88} height={12} rx={3} fill="#E5A800" {...s} strokeWidth={3} />
          <circle cx={100} cy={34} r={6} fill="#E8434F" {...s} strokeWidth={2.5} />
          <circle cx={74} cy={46} r={4} fill="#3F8CFF" />
          <circle cx={126} cy={46} r={4} fill="#3FD07A" />
        </g>
      );
    case 'cowboy':
      return (
        <g>
          <path d="M20 52 Q30 70 100 66 Q170 70 180 52 Q160 60 100 58 Q40 60 20 52 Z" fill="#B0703C" {...s} />
          <path d="M60 58 Q56 20 76 16 Q100 28 124 16 Q144 20 140 58 Z" fill="#C4834A" {...s} />
          <path d="M62 48 Q100 56 138 48 L139 56 Q100 64 61 56 Z" fill="#6B3F1F" />
        </g>
      );
    case 'party':
      return (
        <g>
          <path d="M66 58 L104 -16 L134 58 Z" fill="#3FD07A" {...s} />
          <path d="M80 30 L120 30 M73 44 L127 44 M89 12 L113 12" stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" />
          <circle cx={104} cy={-16} r={10} fill="#FF7AC6" {...s} />
        </g>
      );
    case 'wizard':
      return (
        <g>
          <path d="M60 56 L96 -6 Q112 -26 138 -18 Q114 -10 116 6 L140 56 Z" fill="#4B3CC9" {...s} />
          <ellipse cx={100} cy={56} rx={60} ry={10} fill="#3A2DAA" {...s} />
          <path d={starPath(100, 30, 9)} fill="#FFC531" />
          <path d={starPath(122, 44, 5)} fill="#FFC531" />
          <circle cx={84} cy={44} r={3} fill="#FFFFFF" />
        </g>
      );
    case 'headphones':
      return (
        <g>
          <path d="M44 100 Q40 30 100 28 Q160 30 156 100" fill="none" stroke="#2A2438" strokeWidth={10} strokeLinecap="round" />
          <path d="M44 100 Q40 30 100 28 Q160 30 156 100" fill="none" stroke="#FF5E8A" strokeWidth={4} strokeLinecap="round" />
          <rect x={30} y={82} width={24} height={40} rx={10} fill="#FF5E8A" {...s} />
          <rect x={146} y={82} width={24} height={40} rx={10} fill="#FF5E8A" {...s} />
        </g>
      );
    case 'bow':
      return (
        <g>
          <path d="M130 46 L104 24 L106 66 Z" fill="#FF5E8A" {...s} />
          <path d="M130 46 L156 24 L154 66 Z" fill="#FF5E8A" {...s} />
          <circle cx={130} cy={46} r={9} fill="#E0386C" {...s} />
        </g>
      );
    case 'viking':
      return (
        <g>
          <path d="M60 52 Q40 40 34 10 Q50 22 66 30" fill="#F4EBD6" {...s} />
          <path d="M140 52 Q160 40 166 10 Q150 22 134 30" fill="#F4EBD6" {...s} />
          <path d="M52 60 Q52 14 100 14 Q148 14 148 60 Z" fill="#9AA3B5" {...s} />
          <rect x={48} y={52} width={104} height={14} rx={6} fill="#C08A3E" {...s} strokeWidth={3} />
          <path d="M100 14 L100 52" stroke="#7D8699" strokeWidth={5} />
          <circle cx={70} cy={59} r={3} fill="#6B4A1F" />
          <circle cx={100} cy={59} r={3} fill="#6B4A1F" />
          <circle cx={130} cy={59} r={3} fill="#6B4A1F" />
        </g>
      );
  }
}

/** Линия глаз для конкретного животного — к ней цепляются очки */
export function eyeLine(base: AvatarBase): number {
  switch (base) {
    case 'fox':
    case 'wolf':
      return 88;
    case 'frog':
      return 58;
    case 'hedgehog':
      return 100;
    case 'penguin':
      return 96;
    case 'bear':
      return 90;
    default:
      return 93;
  }
}
