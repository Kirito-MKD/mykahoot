/**
 * Гексагональная сетка «Захвата территории»: «pointy-top», смещение нечётных строк вправо.
 * Индекс ячейки = row * cols + col.
 */
export const HEX_COLS = 14;
export const HEX_ROWS = 10;

export function hexIndex(col: number, row: number, cols = HEX_COLS): number {
  return row * cols + col;
}

export function hexCoords(i: number, cols = HEX_COLS): { col: number; row: number } {
  return { col: i % cols, row: Math.floor(i / cols) };
}

export function hexNeighbors(i: number, cols = HEX_COLS, rows = HEX_ROWS): number[] {
  const { col, row } = hexCoords(i, cols);
  const odd = row % 2 === 1;
  const deltas = odd
    ? [[1, 0], [-1, 0], [0, -1], [1, -1], [0, 1], [1, 1]]
    : [[1, 0], [-1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]];
  const out: number[] = [];
  for (const [dc, dr] of deltas) {
    const c = col + dc!;
    const r = row + dr!;
    if (c >= 0 && c < cols && r >= 0 && r < rows) out.push(hexIndex(c, r, cols));
  }
  return out;
}

/** Угловые ячейки для баз команд: ↖ ↘ ↗ ↙ */
export function cornerCells(cols = HEX_COLS, rows = HEX_ROWS): number[] {
  return [
    hexIndex(0, 0, cols),
    hexIndex(cols - 1, rows - 1, cols),
    hexIndex(cols - 1, 0, cols),
    hexIndex(0, rows - 1, cols),
  ];
}

/** Координаты центра гекса в «единицах радиуса» */
export function hexCenter(i: number, size: number, cols = HEX_COLS): { x: number; y: number } {
  const { col, row } = hexCoords(i, cols);
  const w = Math.sqrt(3) * size;
  const h = 1.5 * size;
  return { x: w * (col + 0.5 + (row % 2 === 1 ? 0.5 : 0)), y: size + h * row };
}

export function hexPolygon(cx: number, cy: number, size: number): string {
  const pts: string[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 180) * (60 * k - 30);
    pts.push(`${(cx + size * Math.cos(a)).toFixed(2)},${(cy + size * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}
