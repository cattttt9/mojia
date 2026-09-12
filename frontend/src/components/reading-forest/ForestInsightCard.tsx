import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { ForestCanopyChart } from "./ForestCanopyChart";
import { ReadingForestSummary } from "./ReadingForestSummary";
import { useResolvedForestPeriod } from "./forestHooks";
import { useReadingForestData } from "./useReadingForestData";
import type { ForestThemeMode, ReadingForestSource } from "./types";
import "./forest-insight.css";

export interface ForestInsightCardProps {
  source: ReadingForestSource;
  onOpenReport?: () => void;
}

export function ForestInsightCard({ source, onOpenReport }: ForestInsightCardProps) {
  const [themeMode, setThemeMode] = useState<ForestThemeMode>("auto");
  const period = useResolvedForestPeriod(themeMode);
  const data = useReadingForestData(source);
  const cycleTheme = () =>
    setThemeMode((mode) => (mode === "auto" ? "day" : mode === "day" ? "night" : "auto"));

  return (
    <section
      className={`wrap reading-forest-section reading-forest-section--${period}`}
      aria-label="过去十二个月阅读森林"
    >
      <div className="reading-forest-section__paper" aria-hidden="true" />
      <button
        className="reading-forest-section__mode"
        type="button"
        onClick={cycleTheme}
        title="切换阅读森林光线"
      >
        {period === "night" ? <Moon aria-hidden /> : <Sun aria-hidden />}
        <span>{themeMode === "auto" ? "随时间" : themeMode === "day" ? "白天模式" : "夜间模式"}</span>
      </button>
      <ReadingForestSummary data={data} onOpenReport={onOpenReport} />
      <div className="reading-forest-section__chart">
        <ForestCanopyChart data={data.months} />
      </div>
    </section>
  );
}

export default ForestInsightCard;
