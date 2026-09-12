import type { ShelfBook } from "../../types";

export const HALL_STAGE_WIDTH = 1536;
export const HALL_STAGE_HEIGHT = 864;

export type ShelfCurve = {
  leftX: number;
  rightX: number;
  leftY: number;
  rightY: number;
  centerDepth: number;
};

/** 四层物理层板的落书曲线，顺序从最上层到最下层。 */
export const SHELF_CURVES: ShelfCurve[] = [
  { leftX: 18, rightX: 1518, leftY: 312, rightY: 312, centerDepth: 12 },
  { leftX: 18, rightX: 1518, leftY: 486, rightY: 486, centerDepth: 0 },
  { leftX: 18, rightX: 1518, leftY: 658, rightY: 658, centerDepth: 0 },
  { leftX: 18, rightX: 1518, leftY: 811, rightY: 811, centerDepth: 0 },
];

export const HALL_SHELF_ROWS = [
  { top: 165, bottom: 312, left: 24, right: 1512 },
  { top: 340, bottom: 486, left: 24, right: 1512 },
  { top: 510, bottom: 658, left: 24, right: 1512 },
  { top: 682, bottom: 811, left: 24, right: 1512 },
] as const;

export type HallDensityMode = "standard" | "compact" | "panorama";

export type HallBookPlacement = {
  book: ShelfBook;
  rowIndex: number;
  x: number;
  y: number;
  seatY: number;
  width: number;
  height: number;
  normalized: number;
  order: number;
};

export type HallShelfLayout = {
  books: HallBookPlacement[];
  rows: HallBookPlacement[][];
  activeRowIndices: number[];
  densityScale: number;
  mode: HallDensityMode;
};

const BOOK_GAP = 4;
const ROW_SIDE_INSET = 18;

export function stableBookHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function naturalBookSize(book: ShelfBook) {
  const hash = stableBookHash(book.id + book.title);
  return {
    // 书脊始终保持偏窄的自然范围，不参与任何“铺满书架”计算。
    width: 28 + (hash % 9),
    height: 124 + (hash % 25),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** 使用书籍横向中心计算其在当前弧形层板上的独立落点。 */
export function getShelfSeatY(
  bookLeft: number,
  bookWidth: number,
  curve: ShelfCurve,
) {
  const bookCenterX = bookLeft + bookWidth / 2;
  const t = clamp(
    (bookCenterX - curve.leftX) / (curve.rightX - curve.leftX),
    0,
    1,
  );
  const edgeBaseY = curve.leftY + (curve.rightY - curve.leftY) * t;
  const centerBow = 4 * t * (1 - t) * curve.centerDepth;

  return edgeBaseY + centerBow;
}

export function createBookshelfHallLayout(books: ShelfBook[]): HallShelfLayout {
  if (!books.length) {
    return {
      books: [],
      rows: [[], [], [], []],
      activeRowIndices: [],
      densityScale: 1,
      mode: "standard",
    };
  }

  const availableWidth =
    HALL_SHELF_ROWS[0].right -
    HALL_SHELF_ROWS[0].left -
    ROW_SIDE_INSET * 2;
  const sizedBooks = books.map((book, order) => ({
    book,
    order,
    ...naturalBookSize(book),
  }));

  const distributed = HALL_SHELF_ROWS.map(() => [] as typeof sizedBooks);
  const rowNaturalWidths = HALL_SHELF_ROWS.map(() => 0);
  let targetRow = 0;

  // 从最上层开始，严格按原始顺序从左向右累计宽度；空间不足才进入下一层。
  // 最后一层会保留所有剩余书籍，绝不通过平均分配改变顺序或扩大书脊。
  sizedBooks.forEach((item) => {
    const currentRow = distributed[targetRow];
    const nextWidth =
      rowNaturalWidths[targetRow] +
      (currentRow.length ? BOOK_GAP : 0) +
      item.width;

    if (
      nextWidth > availableWidth &&
      targetRow < HALL_SHELF_ROWS.length - 1
    ) {
      targetRow += 1;
    }

    const row = distributed[targetRow];
    rowNaturalWidths[targetRow] += (row.length ? BOOK_GAP : 0) + item.width;
    row.push(item);
  });

  const activeRowIndices = distributed
    .map((rowBooks, rowIndex) => (rowBooks.length ? rowIndex : -1))
    .filter((rowIndex) => rowIndex >= 0);

  const densityScale = 1;
  const mode: HallDensityMode = "standard";
  const gap = BOOK_GAP;
  const rows = HALL_SHELF_ROWS.map(() => [] as HallBookPlacement[]);

  distributed.forEach((rowBooks, rowIndex) => {
    if (!rowBooks.length) return;
    const row = HALL_SHELF_ROWS[rowIndex];
    // 左对齐陈列，右侧允许自然留白。
    let cursor = row.left + ROW_SIDE_INSET;

    rowBooks.forEach((item) => {
      const width = item.width;
      const height = item.height;
      const curve = SHELF_CURVES[rowIndex];
      const center = cursor + width / 2;
      const t = clamp(
        (center - curve.leftX) / (curve.rightX - curve.leftX),
        0,
        1,
      );
      const normalized = t * 2 - 1;
      const seatY = getShelfSeatY(cursor, width, curve);
      const placement: HallBookPlacement = {
        book: item.book,
        rowIndex,
        x: cursor,
        y: seatY - height,
        seatY,
        width,
        height,
        normalized,
        order: item.order,
      };
      rows[rowIndex].push(placement);
      cursor += width + gap;
    });
  });

  return {
    books: rows.flat(),
    rows,
    activeRowIndices,
    densityScale,
    mode,
  };
}
