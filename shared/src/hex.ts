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

/** Расстояние между гексами (в шагах) для раскладки «нечётные строки сдвинуты вправо» */
export function hexDistance(a: number, b: number, cols = HEX_COLS): number {
  const cube = (i: number) => {
    const { col, row } = hexCoords(i, cols);
    const x = col - (row - (row & 1)) / 2;
    const z = row;
    return { x, z, y: -x - z };
  };
  const p = cube(a);
  const q = cube(b);
  return Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y), Math.abs(p.z - q.z));
}

/**
 * Размер карты зависит от числа игроков: при 3 детях огромное поле никогда не встретится,
 * а на маленьком соседи быстро упираются друг в друга и могут захватить чужую башню.
 */
export function territorySize(players: number, teamMode: boolean): { cols: number; rows: number } {
  const target = teamMode ? 18 + players * 5 : players * 8;
  const cells = Math.max(30, Math.min(HEX_COLS * HEX_ROWS, target));
  const rows = Math.max(5, Math.min(HEX_ROWS, Math.round(Math.sqrt(cells / 1.45))));
  const cols = Math.max(6, Math.min(HEX_COLS, Math.round(cells / rows)));
  return { cols, rows };
}

/** Башни-базы как можно дальше друг от друга: углы, потом самые удалённые клетки */
export function spreadBases(count: number, cols: number, rows: number): number[] {
  const all = Array.from({ length: cols * rows }, (_, i) => i);
  const picks: number[] = [];
  const corners = cornerCells(cols, rows);
  for (const c of corners) if (picks.length < count && !picks.includes(c)) picks.push(c);
  while (picks.length < count && picks.length < all.length) {
    let best = -1;
    let bestD = -1;
    for (const i of all) {
      if (picks.includes(i)) continue;
      const d = Math.min(...picks.map((p) => hexDistance(i, p, cols)));
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    picks.push(best);
  }
  return picks;
}
