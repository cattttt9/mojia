import { forwardRef } from "react";
import type { CSSProperties, FocusEvent, PointerEvent } from "react";
import type { ShelfBook } from "../../types";
import type { HallBookPlacement, HallDensityMode } from "./bookshelfHallLayout";
import { stableBookHash } from "./bookshelfHallLayout";
import { getSpineTitle } from "./bookSpineTitle";

const fallbackPalette = [
  "#183c35",
  "#203346",
  "#71392c",
  "#aa8b62",
  "#ded3b7",
  "#4b3025",
  "#485440",
];

function accessibleState(book: ShelfBook) {
  if (book.finished) return "已读完";
  if ((book.progress || 0) > 0 || book.lastRead) return "正在阅读";
  return "尚未开始";
}

export const HallBookSpine = forwardRef<
  HTMLButtonElement,
  {
    placement: HallBookPlacement;
    mode: HallDensityMode;
    matched: boolean;
    nearbyDimmed: boolean;
    active: boolean;
    onOpenBook: (book: ShelfBook) => void;
    onActivate: (placement: HallBookPlacement) => void;
    onDeactivate: () => void;
  }
>(function HallBookSpine(
  {
    placement,
    mode,
    matched,
    nearbyDimmed,
    active,
    onOpenBook,
    onActivate,
    onDeactivate,
  },
  ref,
) {
  const { book } = placement;
  const hash = stableBookHash(book.id + book.title);
  const progress = book.finished ? 100 : Math.max(0, Math.min(100, book.progress || 0));
  const fallback = fallbackPalette[hash % fallbackPalette.length];
  const displayTitle = getSpineTitle(book.title);
  const seatStyle = {
    left: placement.x,
    top: placement.y,
    width: placement.width,
    height: placement.height,
    "--hall-book-fallback": fallback,
    "--hall-book-rotate-y": `${-placement.normalized * 3}deg`,
    "--hall-book-progress": progress + "%",
    zIndex: active ? 4 : 2,
  } as CSSProperties;
  const spineStyle = {
    backgroundColor: fallback,
    backgroundImage: book.cover
      ? `url("${book.cover.replace(/"/g, '\\"')}")`
      : undefined,
  } as CSSProperties;

  const activate = (
    _event: PointerEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>,
  ) => onActivate(placement);

  return (
    <span className="hall-book-seat" style={seatStyle}>
      <button
        ref={ref}
        type="button"
        className={[
          "hall-book-spine",
          book.cover ? "has-cover" : "is-cloth",
          matched ? "is-match" : "is-filtered",
          nearbyDimmed ? "is-nearby-dimmed" : "",
          active ? "is-active" : "",
          book.finished ? "is-finished" : progress > 0 ? "is-reading" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={spineStyle}
        aria-label={book.title + "，" + book.author + "，" + accessibleState(book)}
        title={book.title + " · " + book.author}
        onPointerEnter={activate}
        onPointerLeave={onDeactivate}
        onFocus={activate}
        onBlur={onDeactivate}
        onClick={() => onOpenBook(book)}
      >
        <span className="hall-book-spine__shade" aria-hidden="true" />
        <span className="hall-book-spine__title">{displayTitle}</span>
        {!book.cover && mode !== "panorama" && (
          <span className="hall-book-spine__author">{book.author}</span>
        )}
        {book.finished && <i className="hall-book-spine__finished" aria-hidden="true" />}
        {!book.finished && progress > 0 && (
          <i className="hall-book-spine__progress" aria-hidden="true" />
        )}
      </button>
    </span>
  );
});
