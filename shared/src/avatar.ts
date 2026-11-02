import { z } from 'zod';

export const AVATAR_BASES = [
  'cat', 'fox', 'panda', 'rabbit', 'raccoon', 'gorilla',
  'bear', 'penguin', 'frog', 'owl', 'wolf', 'hedgehog',
] as const;
export type AvatarBase = (typeof AVATAR_BASES)[number];

export const AVATAR_BASE_LABELS: Record<AvatarBase, string> = {
  cat: 'Кот', fox: 'Лиса', panda: 'Панда', rabbit: 'Кролик', raccoon: 'Енот', gorilla: 'Горилла',
  bear: 'Медведь', penguin: 'Пингвин', frog: 'Лягушка', owl: 'Сова', wolf: 'Волк', hedgehog: 'Ёж',
};

/** 8 оттенков шерсти. Индекс 0 — «родной» цвет животного. */
export const AVATAR_COLORS = [
  { id: 0, label: 'Родной' },
  { id: 1, label: 'Рыжий', fur: '#F28C38' },
  { id: 2, label: 'Шоколад', fur: '#8A5A3B' },
  { id: 3, label: 'Серый', fur: '#9BA3AE' },
  { id: 4, label: 'Сливочный', fur: '#F1DDB8' },
  { id: 5, label: 'Небесный', fur: '#6FC3EA' },
  { id: 6, label: 'Розовый', fur: '#F49AC1' },
  { id: 7, label: 'Мятный', fur: '#86D49A' },
] as const;

export const AVATAR_HATS = [
  'none', 'cap', 'beanie', 'tophat', 'crown', 'cowboy', 'party', 'wizard', 'headphones', 'bow', 'viking',
] as const;
export type AvatarHat = (typeof AVATAR_HATS)[number];
export const AVATAR_HAT_LABELS: Record<AvatarHat, string> = {
  none: 'Без шапки', cap: 'Кепка', beanie: 'Шапка', tophat: 'Цилиндр', crown: 'Корона', cowboy: 'Ковбойская',
  party: 'Колпак', wizard: 'Волшебник', headphones: 'Наушники', bow: 'Бант', viking: 'Викинг',
};

export const AVATAR_GLASSES = [
  'none', 'round', 'square', 'sun', 'stars', 'hearts', 'monocle', 'goggles', 'nerd',
] as const;
export type AvatarGlasses = (typeof AVATAR_GLASSES)[number];
export const AVATAR_GLASSES_LABELS: Record<AvatarGlasses, string> = {
  none: 'Без очков', round: 'Круглые', square: 'Квадратные', sun: 'Тёмные', stars: 'Звёзды',
  hearts: 'Сердечки', monocle: 'Монокль', goggles: 'Маска', nerd: 'Оправа',
};

export const AVATAR_OUTFITS = [
  'tshirt', 'hoodie', 'stripes', 'suit', 'space', 'sport', 'cape', 'overalls',
] as const;
export type AvatarOutfit = (typeof AVATAR_OUTFITS)[number];
export const AVATAR_OUTFIT_LABELS: Record<AvatarOutfit, string> = {
  tshirt: 'Футболка', hoodie: 'Худи', stripes: 'Полоски', suit: 'Костюм', space: 'Скафандр',
  sport: 'Форма', cape: 'Плащ героя', overalls: 'Комбинезон',
};

export const avatarSchema = z.object({
  base: z.enum(AVATAR_BASES),
  color: z.number().int().min(0).max(AVATAR_COLORS.length - 1),
  hat: z.enum(AVATAR_HATS),
  glasses: z.enum(AVATAR_GLASSES),
  outfit: z.enum(AVATAR_OUTFITS),
});
export type Avatar = z.infer<typeof avatarSchema>;

export const DEFAULT_AVATAR: Avatar = { base: 'cat', color: 0, hat: 'none', glasses: 'none', outfit: 'tshirt' };

function pick<T>(list: readonly T[], rnd: () => number): T {
  return list[Math.floor(rnd() * list.length)]!;
}

export function randomAvatar(rnd: () => number = Math.random): Avatar {
  return {
    base: pick(AVATAR_BASES, rnd),
    color: rnd() < 0.5 ? 0 : Math.floor(rnd() * AVATAR_COLORS.length),
    hat: rnd() < 0.2 ? 'none' : pick(AVATAR_HATS, rnd),
    glasses: rnd() < 0.45 ? 'none' : pick(AVATAR_GLASSES, rnd),
    outfit: pick(AVATAR_OUTFITS, rnd),
  };
}
