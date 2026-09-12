import { useMemo, useRef } from "react";
import type {
  MonthlyReadingStat,
  ReadingForestData,
  ReadingForestSource,
} from "./types";

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

function allocateByWeight(total: number, weights: number[]) {
  const safeTotal = Math.max(0, Math.round(total));
  const weightTotal = weights.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (!safeTotal || !weightTotal) return weights.map(() => 0);

  const exact = weights.map((value) => (Math.max(0, value) / weightTotal) * safeTotal);
  const allocated = exact.map(Math.floor);
  let remainder = safeTotal - allocated.reduce((sum, value) => sum + value, 0);
  const priority = exact
    .map((value, index) => ({ index, fraction: value - allocated[index] }))
    .sort((left, right) => right.fraction - left.fraction);
  for (let index = 0; index < remainder; index += 1) {
    allocated[priority[index % priority.length].index] += 1;
  }
  return allocated;
}

/**
 * 把首页已有的滚动年度统计适配为统一的十二个月数据。
 * 上游暂未提供笔记的月度拆分，因此用真实月度阅读时长分配现有笔记总数；
 * 读完数量则使用书架中的完成状态和最后阅读月份统计。
 */
export function useReadingForestData(source: ReadingForestSource): ReadingForestData {
  const anchor = useRef(new Date()).current;
  return useMemo(() => {
    if (!source.monthlySeconds.length) {
      return {
        year: anchor.getFullYear(),
        totalReadingMinutes: 0,
        totalBooks: source.totalBooks,
        totalNotes: source.totalNotes,
        months: [],
      };
    }

    const recentSeconds = source.monthlySeconds.slice(-12);
    const seconds = [
      ...Array(Math.max(0, 12 - recentSeconds.length)).fill(0),
      ...recentSeconds,
    ];
    const monthDates = seconds.map((_, index) =>
      new Date(anchor.getFullYear(), anchor.getMonth() - 11 + index, 1),
    );
    const finishedByMonth = new Map<string, number>();
    source.books.forEach((book) => {
      if (!book.finished || !book.lastRead) return;
      const key = monthKey(new Date(book.lastRead));
      finishedByMonth.set(key, (finishedByMonth.get(key) || 0) + 1);
    });

    const readingMinutes = seconds.map((value) =>
      Math.max(0, Math.round(Number(value || 0) / 60)),
    );
    const notes = allocateByWeight(source.totalNotes, readingMinutes);
    const months: MonthlyReadingStat[] = monthDates.map((date, index) => {
      const month = monthKey(date);
      return {
        month,
        year: date.getFullYear(),
        readingMinutes: readingMinutes[index],
        finishedBooks: finishedByMonth.get(month) || 0,
        noteCount: notes[index],
      };
    });
    const strongest = months.reduce<MonthlyReadingStat | undefined>(
      (best, item) => (!best || item.readingMinutes > best.readingMinutes ? item : best),
      undefined,
    );

    return {
      year: anchor.getFullYear(),
      totalReadingMinutes: months.reduce((sum, item) => sum + item.readingMinutes, 0),
      totalBooks: Math.max(0, Math.round(source.totalBooks)),
      totalNotes: months.reduce((sum, item) => sum + item.noteCount, 0),
      strongestMonth: strongest?.month,
      months,
    };
  }, [anchor, source.books, source.monthlySeconds, source.totalBooks, source.totalNotes]);
}
