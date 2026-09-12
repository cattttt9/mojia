import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import { scaleLinear, scalePoint } from "d3-scale";
import { area, curveMonotoneX, line } from "d3-shape";
import forestInkWashImage from "../../assets/reading-forest/reading-forest-inkwash.png";
import { ForestChartTooltip } from "./ForestChartTooltip";
import {
  formatForestMonth,
  type ForestCanopyChartProps,
  type MonthlyReadingStat,
} from "./types";

const DESKTOP_CHART_HEIGHT = 590;
const COMPACT_CHART_HEIGHT = 480;
const MOBILE_CHART_WIDTH = 720;
const TOOLTIP_HALF_WIDTH = 87;

type PlotPoint = { x: number; y: number };

function useChartWidth(ref: RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setWidth(element.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

function strongestMonth(data: MonthlyReadingStat[]) {
  return data.reduce<MonthlyReadingStat | undefined>(
    (best, item) => (!best || item.readingMinutes > best.readingMinutes ? item : best),
    undefined,
  );
}

export function ForestCanopyChart({
  data,
  activeMonth,
  onMonthChange,
}: ForestCanopyChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const width = useChartWidth(chartRef);
  const compact = width > 0 && width < 640;
  const chartHeight = compact ? COMPACT_CHART_HEIGHT : DESKTOP_CHART_HEIGHT;
  const stageWidth = Math.max(width || 760, compact ? MOBILE_CHART_WIDTH : 640);
  const [selectedMonth, setSelectedMonth] = useState<string>();
  const [hoveredMonth, setHoveredMonth] = useState<string>();
  const [tooltipPosition, setTooltipPosition] = useState({ left: TOOLTIP_HALF_WIDTH + 12, top: 26 });
  const [visible, setVisible] = useState(false);
  const id = useId().replace(/:/g, "");
  const strongest = useMemo(() => strongestMonth(data), [data]);

  useEffect(() => {
    if (!activeMonth && strongest?.month) setSelectedMonth(strongest.month);
  }, [activeMonth, strongest?.month]);

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisible(true),
      { threshold: 0.2 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const plot = useMemo(() => {
    const maximum = Math.max(0, ...data.map((item) => item.readingMinutes));
    const plotTop = chartHeight * 0.27;
    const plotBottom = chartHeight * 0.56;
    const axisY = chartHeight * 0.9 - 18;
    const xScale = scalePoint<string>()
      .domain(data.map((item) => item.month))
      .range([32, stageWidth - 32]);
    const firstX = data.length ? (xScale(data[0].month) ?? 0) : 0;
    const lastX = data.length ? (xScale(data[data.length - 1].month) ?? stageWidth) : stageWidth;
    const monthStep = xScale.step();
    const axisExtension = Math.min(monthStep / 2, 28);
    const yScale = scaleLinear()
      .domain([0, maximum > 0 ? maximum * 1.12 : 1])
      .range([plotBottom, plotTop]);
    const realPoints: PlotPoint[] = data.map((item) => ({
      x: xScale(item.month) ?? 0,
      y: yScale(item.readingMinutes),
    }));
    const visualPoints = realPoints.length
      ? [
          { x: -40, y: realPoints[0].y },
          ...realPoints,
          { x: stageWidth + 40, y: realPoints[realPoints.length - 1].y },
        ]
      : [];
    const canopyLine = line<PlotPoint>()
      .x((item) => item.x)
      .y((item) => item.y)
      .curve(curveMonotoneX);
    const canopyArea = area<PlotPoint>()
      .x((item) => item.x)
      .y0(chartHeight + 24)
      .y1((item) => item.y)
      .curve(curveMonotoneX);

    return {
      axisY,
      axisStartX: Math.max(0, firstX - axisExtension),
      axisEndX: Math.min(stageWidth, lastX + axisExtension),
      xScale,
      yScale,
      linePath: visualPoints.length ? canopyLine(visualPoints) || "" : "",
      areaPath: visualPoints.length ? canopyArea(visualPoints) || "" : "",
    };
  }, [chartHeight, data, stageWidth]);

  const resolvedMonth = hoveredMonth || activeMonth || selectedMonth || strongest?.month;
  const activeItem = data.find((item) => item.month === resolvedMonth);

  const clampTooltip = (left: number, top: number) => {
    const visibleWidth = chartRef.current?.clientWidth || width || stageWidth;
    return {
      left: Math.min(
        Math.max(left, TOOLTIP_HALF_WIDTH + 12),
        Math.max(TOOLTIP_HALF_WIDTH + 12, visibleWidth - TOOLTIP_HALF_WIDTH - 12),
      ),
      top: Math.max(16, Math.min(top, chartHeight - 108)),
    };
  };

  const positionAtNode = (item: MonthlyReadingStat) => {
    const scrollLeft = scrollRef.current?.scrollLeft || 0;
    const x = (plot.xScale(item.month) ?? 0) - scrollLeft;
    const y = plot.yScale(item.readingMinutes) - 112;
    setTooltipPosition(clampTooltip(x, y));
  };

  useEffect(() => {
    if (activeItem) positionAtNode(activeItem);
    // Plot scales and visible width are intentional positioning inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItem, chartHeight, stageWidth, width]);

  const showAtPointer = (item: MonthlyReadingStat, event: PointerEvent<SVGGElement>) => {
    setHoveredMonth(item.month);
    const bounds = chartRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setTooltipPosition(
      clampTooltip(event.clientX - bounds.left, event.clientY - bounds.top - 96),
    );
  };

  const selectMonth = (item: MonthlyReadingStat) => {
    if (!activeMonth) setSelectedMonth(item.month);
    positionAtNode(item);
    onMonthChange?.(item);
  };

  const onNodeKeyDown = (event: KeyboardEvent<SVGGElement>, item: MonthlyReadingStat) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    selectMonth(item);
  };

  if (!data.length) {
    return (
      <div ref={chartRef} className="forest-canopy-chart forest-canopy-chart--empty">
        <img src={forestInkWashImage} alt="" aria-hidden />
        <div><strong>森林还在等待第一场阅读</strong><span>有了阅读记录后，林冠线会从这里缓慢生长。</span></div>
      </div>
    );
  }

  return (
    <div ref={chartRef} className={`forest-canopy-chart${visible ? " is-visible" : ""}`}>
      <div
        ref={scrollRef}
        className="forest-canopy-chart__scroll"
        onScroll={() => activeItem && positionAtNode(activeItem)}
      >
        <div className="forest-canopy-chart__stage" style={{ width: stageWidth, height: chartHeight }}>
          <img className="forest-background" src={forestInkWashImage} alt="" aria-hidden />
          <svg
            className="forest-canopy-chart__svg"
            viewBox={`0 0 ${stageWidth} ${chartHeight}`}
            width={stageWidth}
            height={chartHeight}
            role="img"
            aria-labelledby={`${id}-title ${id}-description`}
          >
            <title id={`${id}-title`}>过去十二个月阅读时长林冠生长线</title>
            <desc id={`${id}-description`}>完整水墨森林上方，十二个月阅读时长以轻柔曲线连接。</desc>
            <defs>
              <linearGradient id={`${id}-soft-area`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#8cac78" stopOpacity=".08" />
                <stop offset=".38" stopColor="#3f8052" stopOpacity=".3" />
                <stop offset="1" stopColor="#0f5137" stopOpacity=".54" />
              </linearGradient>
              <filter id={`${id}-active-glow`} x="-140%" y="-140%" width="380%" height="380%">
                <feGaussianBlur stdDeviation="3.8" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            <g className="forest-canopy-chart__area-reveal">
              <path
                className="forest-canopy-chart__area"
                d={plot.areaPath}
                fill={`url(#${id}-soft-area)`}
              />
            </g>
            <path
              className="forest-canopy-chart__line"
              d={plot.linePath}
              pathLength="1"
            />

            {data.map((item, index) => {
              const x = plot.xScale(item.month) ?? 0;
              const y = plot.yScale(item.readingMinutes);
              const isStrongest = item.month === strongest?.month;
              const isActive = item.month === resolvedMonth;
              const radius = isStrongest ? 5 : isActive ? 4.5 : 3.75;
              return (
                <g
                  key={item.month}
                  className={`forest-canopy-chart__month${isStrongest ? " is-strongest" : ""}${isActive ? " is-active" : ""}`}
                  style={{ "--node-delay": `${index * 40}ms` } as CSSProperties}
                  role="button"
                  tabIndex={0}
                  aria-label={`${item.year}年${formatForestMonth(item)}，阅读 ${item.readingMinutes} 分钟，读完 ${item.finishedBooks} 本，记录 ${item.noteCount} 条`}
                  transform={`translate(${x} ${y})`}
                  onPointerEnter={(event) => showAtPointer(item, event)}
                  onPointerMove={(event) => showAtPointer(item, event)}
                  onPointerLeave={() => setHoveredMonth(undefined)}
                  onFocus={() => {
                    setHoveredMonth(item.month);
                    positionAtNode(item);
                  }}
                  onBlur={() => setHoveredMonth(undefined)}
                  onClick={() => selectMonth(item)}
                  onKeyDown={(event) => onNodeKeyDown(event, item)}
                >
                  <circle className="forest-canopy-chart__hit" r="17" />
                  {isStrongest && <circle className="forest-canopy-chart__glow" r="9" filter={`url(#${id}-active-glow)`} />}
                  <circle className="forest-canopy-chart__node" r={radius} />
                </g>
              );
            })}

            <g className="forest-canopy-chart__month-axis">
              <line
                className="forest-canopy-chart__month-axis-line"
                x1={plot.axisStartX}
                y1={plot.axisY}
                x2={plot.axisEndX}
                y2={plot.axisY}
              />
              {data.map((item) => {
                const isActive = item.month === resolvedMonth;
                const x = plot.xScale(item.month) ?? 0;
                return (
                  <g
                    key={`${item.year}-${item.month}-axis`}
                    className={`forest-canopy-chart__axis-month${isActive ? " is-active" : ""}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${item.year}年${formatForestMonth(item)}，阅读 ${item.readingMinutes} 分钟，读完 ${item.finishedBooks} 本，记录 ${item.noteCount} 条`}
                    onPointerEnter={(event) => showAtPointer(item, event)}
                    onPointerMove={(event) => showAtPointer(item, event)}
                    onPointerLeave={() => setHoveredMonth(undefined)}
                    onFocus={() => {
                      setHoveredMonth(item.month);
                      positionAtNode(item);
                    }}
                    onBlur={() => setHoveredMonth(undefined)}
                    onClick={() => selectMonth(item)}
                    onKeyDown={(event) => onNodeKeyDown(event, item)}
                  >
                    <circle className="forest-canopy-chart__month-axis-dot" cx={x} cy={plot.axisY} r={isActive ? 4.8 : 4} />
                    <text x={x} y={plot.axisY + 22} textAnchor="middle">
                      {formatForestMonth(item)}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      </div>
      {activeItem && (
        <ForestChartTooltip
          item={activeItem}
          strongest={activeItem.month === strongest?.month}
          left={tooltipPosition.left}
          top={tooltipPosition.top}
        />
      )}
    </div>
  );
}
