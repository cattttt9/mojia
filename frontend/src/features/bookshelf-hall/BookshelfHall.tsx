import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import type { ShelfBook } from "../../types";
import { BookcaseStage } from "./BookcaseStage";
import {
  HALL_STAGE_HEIGHT,
  HALL_STAGE_WIDTH,
  createBookshelfHallLayout,
  type HallBookPlacement,
} from "./bookshelfHallLayout";
import type { ShelfStatusFilter } from "./LibraryControlRail";
import "./bookshelf-hall.css";

function readingStatus(book: ShelfBook): ShelfStatusFilter {
  if (book.finished) return "读完";
  if ((book.progress || 0) > 0 || book.lastRead) return "在读";
  return "未开始";
}

function matchesBook(
  book: ShelfBook,
  query: string,
  status: ShelfStatusFilter,
  category: string,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
  return (
    (!normalizedQuery ||
      `${book.title} ${book.author}`
        .toLocaleLowerCase("zh-CN")
        .includes(normalizedQuery)) &&
    (status === "全部" || readingStatus(book) === status) &&
    (category === "全部分类" || book.category === category)
  );
}

export function BookshelfHall({
  books,
  onOpenBook,
}: {
  books: ShelfBook[];
  onOpenBook: (book: ShelfBook) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: HALL_STAGE_WIDTH, height: HALL_STAGE_HEIGHT });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ShelfStatusFilter>("全部");
  const [category, setCategory] = useState("全部分类");
  const [activeBook, setActiveBook] = useState<HallBookPlacement | null>(null);
  const [mobileRow, setMobileRow] = useState<number | null>(null);
  const clearActiveTimerRef = useRef<number | null>(null);

  const cancelClearActive = useCallback(() => {
    if (clearActiveTimerRef.current !== null) {
      window.clearTimeout(clearActiveTimerRef.current);
      clearActiveTimerRef.current = null;
    }
  }, []);

  const activateBook = useCallback(
    (placement: HallBookPlacement) => {
      cancelClearActive();
      setActiveBook(placement);
    },
    [cancelClearActive],
  );

  const clearActiveBook = useCallback(() => {
    cancelClearActive();
    setActiveBook(null);
  }, [cancelClearActive]);

  const scheduleClearActive = useCallback(() => {
    cancelClearActive();
    clearActiveTimerRef.current = window.setTimeout(() => {
      setActiveBook(null);
      clearActiveTimerRef.current = null;
    }, 100);
  }, [cancelClearActive]);

  const layout = useMemo(() => createBookshelfHallLayout(books), [books]);
  const categories = useMemo(
    () => [
      "全部分类",
      ...Array.from(new Set(books.map((book) => book.category).filter(Boolean))).sort(
        (left, right) => left.localeCompare(right, "zh-CN"),
      ),
    ],
    [books],
  );
  const matchedIds = useMemo(
    () =>
      new Set(
        books
          .filter((book) => matchesBook(book, query, status, category))
          .map((book) => book.id),
      ),
    [books, category, query, status],
  );
  const filteredBooks = useMemo(
    () => books.filter((book) => matchedIds.has(book.id)),
    [books, matchedIds],
  );

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setViewport({ width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      cancelClearActive();
    },
    [cancelClearActive],
  );

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveBook(null);
        setMobileRow(null);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  useEffect(() => {
    if (category !== "全部分类" && !categories.includes(category)) {
      setCategory("全部分类");
    }
  }, [categories, category]);

  const scale = Math.min(
    viewport.width / HALL_STAGE_WIDTH,
    viewport.height / HALL_STAGE_HEIGHT,
  );
  const scaledWidth = HALL_STAGE_WIDTH * scale;
  const scaledHeight = HALL_STAGE_HEIGHT * scale;

  return (
    <section className="bookshelf-hall-page" aria-label={`我的书架，共 ${books.length} 本书`}>
      <div className="mobile-bookshelf">
        <header className="mobile-bookshelf__head">
          <div>
            <p>MY LIBRARY</p>
            <h1>我的书架</h1>
          </div>
          <span>{books.length} 本藏书</span>
        </header>
        <div className="mobile-bookshelf__tools">
          <label className="mobile-bookshelf__search">
            <Search />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索书名或作者"
              aria-label="搜索书名或作者"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="清除搜索">
                <X />
              </button>
            )}
          </label>
          <div className="mobile-bookshelf__filters">
            <div role="group" aria-label="阅读状态">
              {(["全部", "在读", "读完", "未开始"] as ShelfStatusFilter[]).map((item) => (
                <button
                  type="button"
                  key={item}
                  className={status === item ? "active" : ""}
                  onClick={() => setStatus(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              aria-label="按分类筛选"
            >
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mobile-bookshelf__summary">
          <span>{filteredBooks.length} 本符合条件</span>
          {(query || status !== "全部" || category !== "全部分类") && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setStatus("全部");
                setCategory("全部分类");
              }}
            >
              清除筛选
            </button>
          )}
        </div>
        {filteredBooks.length ? (
          <div className="mobile-bookshelf__grid">
            {filteredBooks.map((book) => (
              <button type="button" key={book.id} onClick={() => onOpenBook(book)}>
                <span className="mobile-bookshelf__cover">
                  {book.cover ? <img src={book.cover} alt="" /> : <i />}
                  {book.finished ? <em>读完</em> : (book.progress || 0) > 0 ? <em>{book.progress}%</em> : null}
                </span>
                <strong>{book.title}</strong>
                <small>{book.author || "未知作者"}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="mobile-bookshelf__empty">
            <strong>没有找到这本书</strong>
            <span>换个关键词或清除筛选试试。</span>
          </div>
        )}
      </div>
      <div className="bookshelf-hall-viewport" ref={viewportRef}>
        <div
          className="bookshelf-hall-stage-frame"
          style={{ width: scaledWidth, height: scaledHeight }}
        >
          <div
            className="bookshelf-hall-stage-transform"
            style={{ transform: `scale(${scale})` }}
          >
            <BookcaseStage
              books={books}
              layout={layout}
              matchedIds={matchedIds}
              activeBook={activeBook}
              onActiveBook={activateBook}
              onScheduleClearActive={scheduleClearActive}
              onKeepActive={cancelClearActive}
              onClearActive={clearActiveBook}
              onOpenBook={onOpenBook}
              query={query}
              onQuery={setQuery}
              status={status}
              onStatus={setStatus}
              category={category}
              onCategory={setCategory}
              categories={categories}
              matchCount={matchedIds.size}
              onSelectMobileRow={setMobileRow}
            />
          </div>
        </div>
      </div>

      {mobileRow !== null && (
        <MobileShelfNearView
          row={mobileRow}
          placements={layout.rows[mobileRow] || []}
          matchedIds={matchedIds}
          onClose={() => setMobileRow(null)}
          onOpenBook={onOpenBook}
        />
      )}
    </section>
  );
}

function MobileShelfNearView({
  row,
  placements,
  matchedIds,
  onClose,
  onOpenBook,
}: {
  row: number;
  placements: HallBookPlacement[];
  matchedIds: Set<string>;
  onClose: () => void;
  onOpenBook: (book: ShelfBook) => void;
}) {
  const firstMatchRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstMatchRef.current?.scrollIntoView({ behavior: "smooth", inline: "center" });
  }, [matchedIds]);

  let firstMatchAssigned = false;
  return (
    <aside className="hall-mobile-near-view" aria-label={`第 ${row + 1} 层藏书近景`}>
      <header>
        <div>
          <span>第 {row + 1} 层</span>
          <strong>{placements.length} 本藏书</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="关闭近景">
          <X />
        </button>
      </header>
      <div className="hall-mobile-near-view__track">
        {placements.map(({ book }) => {
          const matched = matchedIds.has(book.id);
          const assignRef = matched && !firstMatchAssigned;
          if (assignRef) firstMatchAssigned = true;
          return (
            <button
              ref={assignRef ? firstMatchRef : undefined}
              type="button"
              className={matched ? "is-match" : "is-filtered"}
              key={book.id}
              onClick={() => onOpenBook(book)}
            >
              <span className="hall-mobile-near-view__cover">
                {book.cover ? <img src={book.cover} alt="" /> : <i />}
              </span>
              <strong>{book.title}</strong>
              <small>{book.author}</small>
              <em>查看档案 <ArrowRight /></em>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
