/** Пресет команд. Преподаватель может переименовать команды перед стартом. */
export type EmblemId = 'flame' | 'wave' | 'leaf' | 'star';

export interface TeamPreset {
  name: string;
  color: string;
  /** Более тёмный оттенок — для «подложки» кнопок и контуров */
  dark: string;
  emblem: EmblemId;
}

export const TEAM_PRESETS: TeamPreset[] = [
  { name: 'Огненные лисы', color: '#E8572A', dark: '#A8361A', emblem: 'flame' },
  { name: 'Морские волки', color: '#1E88E5', dark: '#135A9B', emblem: 'wave' },
  { name: 'Лесные совы', color: '#2E9E4F', dark: '#1C6A33', emblem: 'leaf' },
  { name: 'Звёздные ежи', color: '#E0A800', dark: '#9A7400', emblem: 'star' },
];

/** Цвета для режима «каждый сам за себя» — хорошо различимые оттенки */
export const SOLO_COLORS: string[] = [
  '#E8572A', '#1E88E5', '#2E9E4F', '#E0A800', '#C2185B', '#00897B', '#6D4C41', '#7E57C2',
  '#F06292', '#0097A7', '#7CB342', '#FB8C00', '#5C6BC0', '#8D6E63', '#26A69A', '#EC407A',
  '#43A047', '#3949AB', '#F4511E', '#00ACC1', '#9E9D24', '#AB47BC', '#546E7A', '#D81B60',
  '#039BE5', '#689F38', '#FF7043', '#5E35B1', '#00838F', '#C0CA33',
];

export function soloColor(index: number): string {
  return SOLO_COLORS[index % SOLO_COLORS.length]!;
}

/** Затемнить hex-цвет на долю (0..1) */
export function darken(hex: string, amount = 0.25): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amount)));
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amount)));
  const b = Math.max(0, Math.round((n & 255) * (1 - amount)));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/** Осветлить hex-цвет на долю (0..1) */
export function lighten(hex: string, amount = 0.25): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
