import { ArrowRight, BookOpen, Clock3 } from "lucide-react";
import type { ShelfBook } from "../../types";
import type { HallBookPlacement } from "./bookshelfHallLayout";

function formatLastRead(value: number) {
  if (!value) return "尚未开始";
  const date = new Date(value < 10_000_000_000 ? value * 1000 : value);
  if (Number.isNaN(date.getTime())) return "已有阅读记录";
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function statusOf(book: ShelfBook) {
  if (book.finished) return "已读完";
  if ((book.progress || 0) > 0 || book.lastRead) return "正在阅读";
  return "尚未开始";
}

export function BookHoverCard({
  placement,
  onOpenBook,
  onPointerEnter,
  onPointerLeave,
}: {
  placement: HallBookPlacement;
  onOpenBook: (book: ShelfBook) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const { book } = placement;
  const placeLeft = placement.x > 1120;
  const left = placeLeft
    ? Math.max(28, placement.x - 342)
    : Math.min(1190, placement.x + placement.width + 24);
  const top = Math.max(184, Math.min(630, placement.y - 78));

  return (
    <aside
      className="hall-book-card"
      style={{ left, top }}
      aria-live="polite"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocusCapture={onPointerEnter}
      onBlurCapture={onPointerLeave}
    >
      <div className="hall-book-card__cover" aria-hidden="true">
        {book.cover ? <img src={book.cover} alt="" /> : <BookOpen />}
      </div>
      <div className="hall-book-card__copy">
        <span>{statusOf(book)}</span>
        <h3>{book.title}</h3>
        <p>{book.author || "作者未详"}</p>
        <dl>
          <div>
            <dt>阅读进度</dt>
            <dd>{book.finished ? "100%" : (book.progress || 0) + "%"}</dd>
          </div>
          <div>
            <dt>
              <Clock3 /> 最近阅读
            </dt>
            <dd>{formatLastRead(book.lastRead)}</dd>
          </div>
        </dl>
        <button type="button" onClick={() => onOpenBook(book)}>
          查看阅读档案 <ArrowRight />
        </button>
      </div>
    </aside>
  );
}
