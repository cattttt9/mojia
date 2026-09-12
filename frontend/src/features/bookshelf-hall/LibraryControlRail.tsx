import { ListFilter, Search, X } from "lucide-react";

export type ShelfStatusFilter = "全部" | "在读" | "读完" | "未开始";

export function LibraryControlRail({
  query,
  onQuery,
  status,
  onStatus,
  category,
  onCategory,
  categories,
  matchCount,
}: {
  query: string;
  onQuery: (value: string) => void;
  status: ShelfStatusFilter;
  onStatus: (value: ShelfStatusFilter) => void;
  category: string;
  onCategory: (value: string) => void;
  categories: string[];
  matchCount: number;
}) {
  const filtered = query || status !== "全部" || category !== "全部分类";
  const clear = () => {
    onQuery("");
    onStatus("全部");
    onCategory("全部分类");
  };

  return (
    <section className="hall-control-rail" aria-label="藏书搜索与筛选">
      <div className="hall-control-group hall-control-group--search">
        <label className="hall-control-search">
          <Search aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="搜索一本书或作者"
            aria-label="搜索书名或作者"
          />
          {query && (
            <button type="button" onClick={() => onQuery("")} aria-label="清除搜索">
              <X />
            </button>
          )}
        </label>
        {filtered && <span className="hall-match-count">匹配 {matchCount} 本</span>}
      </div>
      <div className="hall-control-group hall-control-group--filters">
        <div className="hall-status-tabs" role="group" aria-label="阅读状态">
          {(["全部", "在读", "读完", "未开始"] as ShelfStatusFilter[]).map((item) => (
            <button
              type="button"
              key={item}
              className={status === item ? "active" : ""}
              onClick={() => onStatus(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="hall-category-select">
          <ListFilter aria-hidden="true" />
          <select
            value={category}
            onChange={(event) => onCategory(event.target.value)}
            aria-label="按分类筛选"
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        {filtered && (
          <button className="hall-clear-filters" type="button" onClick={clear}>
            重置
          </button>
        )}
      </div>
    </section>
  );
}
