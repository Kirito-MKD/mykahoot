/** Четыре варианта ответа: цвет + фигура, чтобы различали дети с дальтонизмом */
export const ANSWER_STYLES = [
  { key: 'red', color: '#E21B3C', dark: '#A0122A', shape: 'triangle', label: 'треугольник' },
  { key: 'blue', color: '#1368CE', dark: '#0D4890', shape: 'diamond', label: 'ромб' },
  { key: 'yellow', color: '#D89E00', dark: '#976E00', shape: 'circle', label: 'круг' },
  { key: 'green', color: '#26890C', dark: '#1A5F08', shape: 'square', label: 'квадрат' },
] as const;

export type ShapeKind = (typeof ANSWER_STYLES)[number]['shape'];

export function Shape({ index, size = 36, color = '#fff' }: { index: number; size?: number; color?: string }) {
  const shape = ANSWER_STYLES[index % 4]!.shape;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" style={{ flex: 'none' }}>
      {shape === 'triangle' && <path d="M20 4 L37 34 L3 34 Z" fill={color} strokeLinejoin="round" stroke={color} strokeWidth={3} />}
      {shape === 'diamond' && <path d="M20 2 L38 20 L20 38 L2 20 Z" fill={color} strokeLinejoin="round" stroke={color} strokeWidth={2} />}
      {shape === 'circle' && <circle cx={20} cy={20} r={17} fill={color} />}
      {shape === 'square' && <rect x={4} y={4} width={32} height={32} rx={3} fill={color} />}
    </svg>
  );
}
