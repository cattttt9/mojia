/**
 * 将微信读书年度统计归一化为“包含当前月在内的最近 12 个月”。
 * 上游 readTimes 的键可能是月份序号、yyyyMM、日期字符串或时间戳，
 * 因此先转换成 yyyy-MM，再按真实月份顺序取值。
 */
export function rollingMonthlySeconds(
  previousAnnual: any,
  currentAnnual: any,
  now = new Date(),
): number[] {
  const values = new Map<string, number>();
  collectAnnualMonths(values, previousAnnual?.readTimes, now.getFullYear() - 1);
  collectAnnualMonths(values, currentAnnual?.readTimes, now.getFullYear());
  return rollingMonthDates(now).map((date) => values.get(monthKey(date)) || 0);
}

/** 图表标签与滚动统计使用同一月份序列，避免跨年后标签错位。 */
export function rollingMonthLabels(now = new Date()): string[] {
  return rollingMonthDates(now).map((date) => `${date.getMonth() + 1}月`);
}

function rollingMonthDates(now: Date): Date[] {
  return Array.from(
    { length: 12 },
    (_, index) => new Date(now.getFullYear(), now.getMonth() - 11 + index, 1),
  );
}

function collectAnnualMonths(
  target: Map<string, number>,
  readTimes: unknown,
  fallbackYear: number,
) {
  if (!readTimes || typeof readTimes !== "object") return;
  const entries = Object.entries(readTimes as Record<string, unknown>);
  const zeroBased = entries.some(([key]) => key === "0");
  for (const [rawKey, rawValue] of entries) {
    const date = parseMonth(rawKey, fallbackYear, zeroBased);
    if (!date) continue;
    const key = monthKey(date);
    // 当前年度响应后写入，若上游本身已携带跨年月份则以较新的响应为准，避免重复累计。
    target.set(key, Number(rawValue) || 0);
  }
}

function parseMonth(rawKey: string, fallbackYear: number, zeroBased: boolean) {
  const key = rawKey.trim();
  const separated = key.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/);
  if (separated) return validMonth(Number(separated[1]), Number(separated[2]));
  const compact = key.match(/^(\d{4})(\d{2})$/);
  if (compact) return validMonth(Number(compact[1]), Number(compact[2]));

  const numeric = Number(key);
  if (Number.isFinite(numeric) && numeric >= 1_000_000_000) {
    const date = new Date(numeric < 1_000_000_000_000 ? numeric * 1000 : numeric);
    return Number.isNaN(date.getTime()) ? null : new Date(date.getFullYear(), date.getMonth(), 1);
  }
  if (Number.isInteger(numeric)) {
    const month = zeroBased ? numeric + 1 : numeric;
    return validMonth(fallbackYear, month);
  }
  const parsed = new Date(key);
  return Number.isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), 1);
}

function validMonth(year: number, month: number) {
  return month >= 1 && month <= 12 ? new Date(year, month - 1, 1) : null;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
