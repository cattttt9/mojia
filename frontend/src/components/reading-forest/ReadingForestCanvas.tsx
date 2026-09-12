import { Application, extend } from "@pixi/react";
import { Assets, Container, Graphics, Sprite } from "pixi.js";
import { useEffect, useRef, useState } from "react";
import { ForestScene } from "./ForestScene";
import { formatForestMonth, type ForestPeriod, type ReadingForestData } from "./types";
import { treeAssetKeys, treeAssetSources } from "./treeAssets";
import type { TreeTextures } from "./treeAssets";

extend({ Container, Graphics, Sprite });

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小时 ${rest} 分` : `${hours} 小时`;
}

export function ReadingForestCanvas({ data, period }: { data: ReadingForestData; period: ForestPeriod }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 760, height: 390 });
  const [inViewport, setInViewport] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => document.visibilityState === "visible");
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [treeTextures, setTreeTextures] = useState<TreeTextures | null>(null);

  useEffect(() => {
    let cancelled = false;
    Assets.load(treeAssetKeys.map((key) => ({ alias: key, src: treeAssetSources[key] })))
      .then((loaded) => { if (!cancelled) setTreeTextures(loaded as TreeTextures); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const resizeObserver = new ResizeObserver(([entry]) => {
      setSize({ width: Math.max(320, entry.contentRect.width), height: Math.max(320, entry.contentRect.height) });
    });
    const intersectionObserver = new IntersectionObserver(([entry]) => setInViewport(entry.isIntersecting), { threshold: 0.12 });
    resizeObserver.observe(element);
    intersectionObserver.observe(element);
    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = () => setReducedMotion(media.matches);
    const onVisibility = () => setPageVisible(document.visibilityState === "visible");
    media.addEventListener("change", onMotionChange);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      media.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const focusedIndex = selectedIndex ?? hoveredIndex;
  const focusedMonth = focusedIndex === null ? null : data.months[focusedIndex];

  if (!treeTextures) {
    return <div ref={containerRef} className="reading-forest-canvas reading-forest-canvas--loading"><span>森林正在生长…</span></div>;
  }

  return (
    <div ref={containerRef} className="reading-forest-canvas" aria-label="过去十二个月的阅读森林">
      <Application
        resizeTo={containerRef}
        backgroundAlpha={0}
        antialias
        autoDensity
        resolution={Math.min(window.devicePixelRatio || 1, 2)}
      >
        <ForestScene
          data={data}
          textures={treeTextures}
          width={size.width}
          height={size.height}
          period={period}
          active={inViewport && pageVisible}
          reducedMotion={reducedMotion}
          hoveredIndex={hoveredIndex}
          selectedIndex={selectedIndex}
          onHover={setHoveredIndex}
          onLeave={() => setHoveredIndex(null)}
          onSelect={(index) => setSelectedIndex((current) => current === index ? null : index)}
        />
      </Application>
      <div className="reading-forest-months" aria-hidden="true">
        {data.months.map((month) => <span key={month.month}>{formatForestMonth(month)}</span>)}
      </div>
      {focusedMonth && (
        <div
          className="reading-forest-tooltip"
          style={{ left: `${((focusedIndex ?? 0) + 0.5) / data.months.length * 100}%` }}
          role="status"
        >
          <b>{formatForestMonth(focusedMonth)}</b>
          <span>{formatMinutes(focusedMonth.readingMinutes)}</span>
          {focusedIndex === data.months.findIndex((month) => month.month === data.strongestMonth) && <small>这一年最繁茂的月份</small>}
        </div>
      )}
    </div>
  );
}
