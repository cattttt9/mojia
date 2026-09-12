import type { ShelfBook } from "../../types";

export type ForestPeriod = "day" | "night";

export type ForestThemeMode = "auto" | ForestPeriod;

export interface MonthlyReadingStat {
  /** YYYY-MM */
  month: string;
  year: number;
  readingMinutes: number;
  finishedBooks: number;
  noteCount: number;
}

export interface ReadingForestSource {
  monthlySeconds: number[];
  books: ShelfBook[];
  totalBooks: number;
  totalNotes: number;
}

export interface ReadingForestData {
  year: number;
  totalReadingMinutes: number;
  totalBooks: number;
  totalNotes: number;
  strongestMonth?: string;
  months: MonthlyReadingStat[];
}

export interface ForestCanopyChartProps {
  data: MonthlyReadingStat[];
  activeMonth?: string;
  onMonthChange?: (item: MonthlyReadingStat) => void;
}

export function formatForestMonth(item: Pick<MonthlyReadingStat, "month">) {
  const value = Number(item.month.slice(5));
  return Number.isFinite(value) ? `${value}月` : item.month;
}

/** @deprecated 仅供已退出首页渲染链路的旧场景组件保持类型兼容。 */
export function mapTreeHeight(
  value: number,
  minValue: number,
  maxValue: number,
  minHeight = 72,
  maxHeight = 210,
) {
  if (maxValue === minValue) return (minHeight + maxHeight) / 2;
  const normalized = Math.max(0, Math.min(1, (value - minValue) / (maxValue - minValue)));
  return minHeight + Math.sqrt(normalized) * (maxHeight - minHeight);
}
