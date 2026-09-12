import { ArrowRight } from "lucide-react";
import { formatForestMonth, type ReadingForestData } from "./types";

interface ReadingForestSummaryProps {
  data: ReadingForestData;
  onOpenReport?: () => void;
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小时 ${rest} 分` : `${hours} 小时`;
}

export function ReadingForestSummary({ data, onOpenReport }: ReadingForestSummaryProps) {
  const strongest = data.months.find((item) => item.month === data.strongestMonth);
  return (
    <div className="reading-forest-summary">
      <span className="reading-forest-summary__eyebrow">A YEAR IN PAGES</span>
      <h2>
        <span>过去十二个月，</span>
        <span>阅读缓慢生长</span>
        <span>成一片森林。</span>
      </h2>
      <p>
        {strongest && strongest.readingMinutes > 0 ? (
          <>
            最沉浸的是 <strong>{formatForestMonth(strongest)}</strong>，这一年的阅读与思考，沿着时间长成了自己的林冠。
          </>
        ) : (
          <>阅读的痕迹会在这里慢慢显现，不必催促每一片新叶。</>
        )}
      </p>
      <div className="reading-forest-summary__stats" aria-label="过去十二个月阅读摘要">
        <div>
          <strong>{formatMinutes(data.totalReadingMinutes)}</strong>
          <span>阅读时光</span>
        </div>
        <div>
          <strong>{data.totalBooks.toLocaleString()} 本</strong>
          <span>读过的书</span>
        </div>
        <div>
          <strong>{data.totalNotes.toLocaleString()} 条</strong>
          <span>笔记与想法</span>
        </div>
      </div>
      <button className="reading-forest-summary__action" type="button" onClick={onOpenReport}>
        展开阅读洞察 <ArrowRight aria-hidden />
      </button>
    </div>
  );
}
