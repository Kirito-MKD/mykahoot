export const MODES = ['classic', 'territory', 'tower', 'escape'] as const;
export type GameMode = (typeof MODES)[number];

export interface ModeInfo {
  id: GameMode;
  title: string;
  tagline: string;
  description: string;
}

export const MODE_INFO: Record<GameMode, ModeInfo> = {
  classic: {
    id: 'classic',
    title: 'Классика',
    tagline: 'Вопрос — ответ — таблица лидеров',
    description: 'Обычная викторина: очки за скорость и серии верных ответов, в конце пьедестал.',
  },
  territory: {
    id: 'territory',
    title: 'Захват территории',
    tagline: 'Флаги за верные ответы, гексы — за смелость',
    description:
      'За верные ответы дают флаги. После вопроса каждый расставляет их на карте рядом со своей территорией. Чужой гекс можно перебить за два флага.',
  },
  tower: {
    id: 'tower',
    title: 'Башня',
    tagline: 'Каждый верный ответ — ещё один блок',
    description:
      'Команды строят башни в космосе. Верный ответ кладёт блок. Время от времени у лидера появляется монстр и сносит верхушку.',
  },
  escape: {
    id: 'escape',
    title: 'Побег',
    tagline: 'Беги от робота к выходу со станции',
    description:
      'Три уровня. Верный ответ — шаг к двери, робот наступает по таймеру. Кого догнал — выбывает до конца уровня.',
  },
};
