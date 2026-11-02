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

interface Props {
  avatar: AvatarData;
  size?: number;
  idle?: boolean;
  className?: string;
  title?: string;
}

/** Аватар ученика. Передаётся по сети только описание {base,color,hat,glasses,outfit} — рисуют клиенты. */
export const Avatar = memo(function Avatar({ avatar, size = 96, idle = false, className, title }: Props) {
  return (
    <svg
      className={`avatar ${idle ? 'avatar-idle' : ''} ${className ?? ''}`}
      width={size}
      height={size * 1.27}
      viewBox="0 -30 200 254"
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
