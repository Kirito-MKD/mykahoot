import { memo } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Avatar as AvatarData } from '@viktorina/shared';
import { BaseParts, Glasses, Hat, Outfit, eyeLine, paletteFor } from './parts';
import './avatar.css';

function AvatarArt({ avatar }: { avatar: AvatarData }) {
  const p = paletteFor(avatar.base, avatar.color);
  const parts = BaseParts({ base: avatar.base, p });
  const ey = eyeLine(avatar.base);
  const frog = avatar.base === 'frog';
  return (
    <g>
      <Outfit outfit={avatar.outfit} />
      {parts.back}
      {parts.head}
      <g transform={frog ? `translate(100 ${ey}) scale(1.55 1) translate(-100 ${-ey})` : undefined}>
        <Glasses glasses={avatar.glasses} y={ey} />
      </g>
      <g transform={frog ? 'translate(0 -26)' : avatar.base === 'hedgehog' ? 'translate(0 10)' : undefined}>
        <Hat hat={avatar.hat} />
      </g>
    </g>
  );
}

/** Кадрирование миниатюр: целиком, только голова (очки, шапки) или только туловище (одежда) */
export type AvatarCrop = 'full' | 'head' | 'body';
const VIEWBOX: Record<AvatarCrop, string> = {
  full: '0 -30 200 254',
  head: '22 -26 156 156',
  body: '14 120 172 106',
};

interface Props {
  avatar: AvatarData;
  crop?: AvatarCrop;
  size?: number;
  idle?: boolean;
  className?: string;
  title?: string;
}

/** Аватар ученика. Передаётся по сети только описание {base,color,hat,glasses,outfit} — рисуют клиенты. */
export const Avatar = memo(function Avatar({ avatar, crop = 'full', size = 96, idle = false, className, title }: Props) {
  const vb = VIEWBOX[crop];
  const [, , vw, vh] = vb.split(' ').map(Number);
  return (
    <svg
      className={`avatar ${crop !== 'full' ? 'avatar-crop' : ''} ${idle ? 'avatar-idle' : ''} ${className ?? ''}`}
      width={size}
      height={(size * vh!) / vw!}
      viewBox={vb}
      role="img"
      aria-label={title}
    >
      <g className="avatar-body">
        <AvatarArt avatar={avatar} />
      </g>
    </svg>
  );
});

const svgCache = new Map<string, string>();

/** SVG-строка для PixiJS-текстур */
export function avatarSvgString(avatar: AvatarData, px = 160): string {
  const key = `${JSON.stringify(avatar)}@${px}`;
  const hit = svgCache.get(key);
  if (hit) return hit;
  const markup = renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" width={px} height={Math.round(px * 1.27)} viewBox="0 -30 200 254">
      <AvatarArt avatar={avatar} />
    </svg>,
  );
  svgCache.set(key, markup);
  return markup;
}
