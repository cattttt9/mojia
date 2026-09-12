import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Moon, Sun } from "lucide-react";
import { ReadingForestCanvas } from "./ReadingForestCanvas";
import type { ForestPeriod, ForestThemeMode, ReadingForestData } from "./types";
import "./reading-forest.css";

function currentPeriod(): ForestPeriod {
  const hour = new Date().getHours();
  return hour >= 19 || hour < 4 ? "night" : "day";
}

function useDayNightMode(mode: ForestThemeMode) {
  const [automaticPeriod, setAutomaticPeriod] = useState<ForestPeriod>(currentPeriod);
  useEffect(() => {
    if (mode !== "auto") return;
    const timer = window.setInterval(() => setAutomaticPeriod(currentPeriod()), 60_000);
    return () => window.clearInterval(timer);
  }, [mode]);
  return mode === "auto" ? automaticPeriod : mode;
}

export function ReadingForestCard({ data, onOpenReport }: { data: ReadingForestData; onOpenReport?: () => void }) {
  const [themeMode, setThemeMode] = useState<ForestThemeMode>("auto");
  const period = useDayNightMode(themeMode);
  const total = useMemo(() => {
    const hours = Math.floor(data.totalReadingMinutes / 60);
    const minutes = data.totalReadingMinutes % 60;
    return minutes ? `${hours} 小时 ${minutes} 分` : `${hours} 小时`;
  }, [data.totalReadingMinutes]);

  const cycleTheme = () => setThemeMode((mode) => mode === "auto" ? "day" : mode === "day" ? "night" : "auto");

  return (
    <section className={`wrap reading-forest-card reading-forest-card--${period}`}>
      <div className="reading-forest-card__content">
        <div className="reading-forest-card__copy">
          <span className="reading-forest-card__eyebrow">A YEAR IN PAGES</span>
          <h2>过去十二个月，你的阅读<br />像一片缓慢生长的森林。</h2>
          <p>
            最繁茂的是 <b>{data.strongestMonth || "这个月"}</b>，一共留下了 <b>{data.totalNotes.toLocaleString()}</b> 条笔记与想法。
          </p>
          <div className="reading-forest-card__facts">
            <span><strong>{total}</strong>阅读时光</span>
            <span><strong>{data.totalBooks.toLocaleString()} 本</strong>读过的书</span>
          </div>
          <button type="button" className="reading-forest-card__action" onClick={onOpenReport}>
            展开阅读洞察 <ArrowRight aria-hidden />
          </button>
        </div>
        <div className="reading-forest-card__visual">
          <button type="button" className="reading-forest-theme" onClick={cycleTheme} title="切换森林光线">
            {period === "night" ? <Moon aria-hidden /> : <Sun aria-hidden />}
            <span>{themeMode === "auto" ? "随时间" : themeMode === "day" ? "白昼" : "夜色"}</span>
          </button>
          <ReadingForestCanvas data={data} period={period} />
        </div>
      </div>
    </section>
  );
}

export default ReadingForestCard;

