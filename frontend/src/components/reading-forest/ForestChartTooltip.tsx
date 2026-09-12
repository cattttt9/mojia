import type { CSSProperties } from "react";
import { formatForestMonth, type MonthlyReadingStat } from "./types";

interface ForestChartTooltipProps {
  item: MonthlyReadingStat;
  strongest: boolean;
  left: number;
  top: number;
}

function formatReadingTime(minutes: number) {
  if (minutes <= 0) return "暂无阅读记录";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}分钟`;
  return rest ? `${hours}小时${rest}分` : `${hours}小时`;
}

export function ForestChartTooltip({ item, strongest, left, top }: ForestChartTooltipProps) {
  return (
    <aside
      className="forest-chart-tooltip"
      style={{ "--tooltip-left": `${left}px`, "--tooltip-top": `${top}px` } as CSSProperties}
      aria-live="polite"
    >
      <strong>
        {formatForestMonth(item)}
        {strongest ? " · 最沉浸的月份" : ""}
      </strong>
      <time>{item.year} 年</time>
      {item.readingMinutes > 0 ? (
        <>
          <span>阅读时长　{formatReadingTime(item.readingMinutes)}</span>
          <small>读完 {item.finishedBooks} 本 · 记录 {item.noteCount.toLocaleString()} 条</small>
        </>
      ) : (
        <span>暂无阅读记录</span>
      )}
    </aside>
  );
}
