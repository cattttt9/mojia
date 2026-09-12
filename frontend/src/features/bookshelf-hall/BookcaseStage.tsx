import type { CSSProperties } from "react";
import type { ShelfBook } from "../../types";
import { BookHoverCard } from "./BookHoverCard";
import { CollectionPlaque } from "./CollectionPlaque";
import { HallBookSpine } from "./HallBookSpine";
import { LibraryControlRail, type ShelfStatusFilter } from "./LibraryControlRail";
import type {
  HallBookPlacement,
  HallShelfLayout,
  ShelfCurve,
} from "./bookshelfHallLayout";
import {
  HALL_SHELF_ROWS,
  SHELF_CURVES,
  getShelfSeatY,
} from "./bookshelfHallLayout";

function buildShelfLipClipPath(curve: ShelfCurve) {
  const sampleCount = 32;
  const topPoints: string[] = [];
  const bottomPoints: string[] = [];

  for (let index = 0; index <= sampleCount; index += 1) {
    const progress = index / sampleCount;
    const x = curve.leftX + (curve.rightX - curve.leftX) * progress;
    const seatY = getShelfSeatY(x, 0, curve);
    // The lip begins below the book seat. Starting above seatY clips the
    // lower corner of every rotated spine and creates a saw-tooth baseline.
    topPoints.push(`${x}px ${seatY + 1}px`);
    bottomPoints.unshift(`${x}px ${seatY + 8}px`);
  }

  return `polygon(${[...topPoints, ...bottomPoints].join(", ")})`;
}

function ShelfLipOverlay({ curve }: { curve: ShelfCurve }) {
  return (
    <div
      aria-hidden="true"
      className="shelf-lip-overlay"
      style={{ clipPath: buildShelfLipClipPath(curve) } as CSSProperties}
    />
  );
}

export function BookcaseStage({
  books,
  layout,
  matchedIds,
  activeBook,
  onActiveBook,
  onScheduleClearActive,
  onKeepActive,
  onClearActive,
  onOpenBook,
  query,
  onQuery,
  status,
  onStatus,
  category,
  onCategory,
  categories,
  matchCount,
  onSelectMobileRow,
}: {
  books: ShelfBook[];
  layout: HallShelfLayout;
  matchedIds: Set<string>;
  activeBook: HallBookPlacement | null;
  onActiveBook: (book: HallBookPlacement) => void;
  onScheduleClearActive: () => void;
  onKeepActive: () => void;
  onClearActive: () => void;
  onOpenBook: (book: ShelfBook) => void;
  query: string;
  onQuery: (value: string) => void;
  status: ShelfStatusFilter;
  onStatus: (value: ShelfStatusFilter) => void;
  category: string;
  onCategory: (value: string) => void;
  categories: string[];
  matchCount: number;
  onSelectMobileRow: (row: number) => void;
}) {
  return (
    <div
      className={"bookshelf-hall-stage mode-" + layout.mode}
      onPointerDown={(event) => {
        if (event.currentTarget === event.target) onClearActive();
      }}
    >
      <CollectionPlaque total={books.length} />
      <LibraryControlRail
        query={query}
        onQuery={onQuery}
        status={status}
        onStatus={onStatus}
        category={category}
        onCategory={onCategory}
        categories={categories}
        matchCount={matchCount}
      />
      <div className="hall-stage-vignette" aria-hidden="true" />
      {HALL_SHELF_ROWS.map((row, rowIndex) => (
        <section
          className={
            "curved-shelf-row" +
            (layout.activeRowIndices.includes(rowIndex) ? " is-active-row" : "")
          }
          style={{
            left: row.left,
            top: row.top,
            width: row.right - row.left,
            height: row.bottom - row.top,
          }}
          key={rowIndex}
          aria-label={"第 " + (rowIndex + 1) + " 层书架"}
        >
          <button
            type="button"
            className="hall-mobile-row-trigger"
            onClick={() => onSelectMobileRow(rowIndex)}
            aria-label={"查看第 " + (rowIndex + 1) + " 层藏书"}
          />
        </section>
      ))}
      <div className="hall-book-layer">
        {layout.books.map((placement) => (
          <HallBookSpine
            key={placement.book.id}
            placement={placement}
            mode={layout.mode}
            matched={matchedIds.has(placement.book.id)}
            nearbyDimmed={Boolean(activeBook && activeBook.book.id !== placement.book.id)}
            active={activeBook?.book.id === placement.book.id}
            onOpenBook={onOpenBook}
            onActivate={onActiveBook}
            onDeactivate={onScheduleClearActive}
          />
        ))}
        {SHELF_CURVES.map((curve, index) => (
          <ShelfLipOverlay curve={curve} key={`shelf-lip-${index}`} />
        ))}
      </div>
      {!books.length && (
        <div className="hall-empty-state">
          <strong>您的书架还没有书籍</strong>
          <span>在微信读书中添加书籍并同步后，它们会陈列在这里。</span>
        </div>
      )}
      {activeBook && (
        <BookHoverCard
          placement={activeBook}
          onOpenBook={onOpenBook}
          onPointerEnter={onKeepActive}
          onPointerLeave={onScheduleClearActive}
        />
      )}
    </div>
  );
}
