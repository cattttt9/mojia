import { useMemo, type CSSProperties } from "react";
import { formatForestMonth, type ForestPeriod, type MonthlyReadingStat } from "./types";

interface WatercolorForestSceneProps {
  months: MonthlyReadingStat[];
  period: ForestPeriod;
  strongestIndex: number;
  activeIndex: number;
  onActivate: (item: MonthlyReadingStat, index: number) => void;
  onDeactivate: () => void;
}

const treeKinds = ["broad-a", "pine-a", "slender", "broad-b", "pine-b", "young", "broad-a", "slender", "pine-a", "broad-b", "young", "pine-b"];
const xPositions = [58, 126, 195, 266, 339, 412, 488, 562, 636, 707, 776, 843];
const groundOffsets = [6, -2, 5, 0, -5, 4, -3, 3, -7, 4, -1, 5];

function treeHeight(value: number, min: number, max: number) {
  if (max <= min) return 218;
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return 158 + Math.sqrt(normalized) * 132;
}

export function WatercolorForestScene({ months, period, strongestIndex, activeIndex, onActivate, onDeactivate }: WatercolorForestSceneProps) {
  const range = useMemo(() => {
    const values = months.map((item) => item.readingMinutes);
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [months]);

  return (
    <svg className="watercolor-forest" viewBox="0 0 900 560" role="img" aria-label="过去十二个月的阅读森林">
      <defs>
        <linearGradient id="forest-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={period === "night" ? "#17352f" : "#eee6c8"} />
          <stop offset=".58" stopColor={period === "night" ? "#29473d" : "#dce0c4"} />
          <stop offset="1" stopColor={period === "night" ? "#16342d" : "#abbf98"} />
        </linearGradient>
        <linearGradient id="forest-ground" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor={period === "night" ? "#2d5847" : "#668466"} />
          <stop offset="1" stopColor={period === "night" ? "#15372e" : "#345f4c"} />
        </linearGradient>
        <linearGradient id="forest-trunk" x1="0" x2="1">
          <stop stopColor="#283f35" /><stop offset=".5" stopColor="#5d6a4e" /><stop offset="1" stopColor="#33493c" />
        </linearGradient>
        <linearGradient id="forest-leaf" x1="0" y1="1" x2=".7" y2="0">
          <stop stopColor={period === "night" ? "#153c32" : "#275b48"} />
          <stop offset=".55" stopColor={period === "night" ? "#426653" : "#66875f"} />
          <stop offset="1" stopColor={period === "night" ? "#73816a" : "#a5b984"} />
        </linearGradient>
        <linearGradient id="forest-leaf-light" x1="0" y1="1" x2="1" y2="0">
          <stop stopColor={period === "night" ? "#41624f" : "#698b61"} />
          <stop offset="1" stopColor={period === "night" ? "#87937a" : "#c1cb91"} />
        </linearGradient>
        <filter id="forest-watercolor" x="-35%" y="-25%" width="170%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency=".018 .04" numOctaves="2" seed="12" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.1" />
          <feGaussianBlur stdDeviation=".16" />
          <feDropShadow dx="0" dy="7" stdDeviation="7" floodColor="#173f36" floodOpacity=".16" />
        </filter>
        <filter id="forest-mist" x="-20%" y="-80%" width="140%" height="260%"><feGaussianBlur stdDeviation="17" /></filter>

        <g id="broad-a" filter="url(#forest-watercolor)">
          <path d="M-7 0C-5-54-9-91-4-137C-17-157-31-172-45-184M-3-116C17-141 32-154 46-166M-5-76C-22-94-34-105-49-113" fill="none" stroke="url(#forest-trunk)" strokeWidth="10" strokeLinecap="round" />
          <path d="M-9 0C-5-55-8-105-4-145H5C10-99 7-50 12 0Z" fill="url(#forest-trunk)" />
          <path d="M-54-139C-75-160-68-193-44-203C-55-232-27-253-3-241C9-272 48-266 54-238C82-238 94-207 78-188C96-167 82-137 57-132C43-108 9-109-5-124C-24-109-45-118-54-139Z" fill="url(#forest-leaf)" />
          <path d="M-50-170C-51-199-24-218 2-208C18-237 51-221 52-194C75-188 78-160 60-147C39-162 16-154 2-139C-13-160-31-163-50-170Z" fill="url(#forest-leaf-light)" opacity=".72" />
        </g>
        <g id="broad-b" filter="url(#forest-watercolor)">
          <path d="M-5 0C-2-48-6-91 0-139M-1-103C-24-129-36-147-50-167M1-123C23-151 38-166 54-184" fill="none" stroke="url(#forest-trunk)" strokeWidth="9" strokeLinecap="round" />
          <path d="M-9 0C-4-57-5-104-2-144H7C12-96 10-45 14 0Z" fill="url(#forest-trunk)" />
          <path d="M-68-155C-82-179-65-205-39-207C-43-236-13-250 8-235C27-257 58-240 57-214C84-208 88-176 68-159C76-133 47-115 24-127C4-108-26-119-29-141C-46-127-65-138-68-155Z" fill="url(#forest-leaf)" />
          <path d="M-48-190C-36-222-3-229 16-212C35-229 59-210 56-188C35-197 14-183 4-164C-12-181-30-185-48-190Z" fill="url(#forest-leaf-light)" opacity=".68" />
        </g>
        <g id="slender" filter="url(#forest-watercolor)">
          <path d="M-4 0C-2-76-3-145 0-207M0-145C-18-166-26-181-35-197M1-168C18-190 27-207 36-226" fill="none" stroke="url(#forest-trunk)" strokeWidth="8" strokeLinecap="round" />
          <path d="M-7 0C-3-78-4-151-1-215H6C10-145 9-72 11 0Z" fill="url(#forest-trunk)" />
          <path d="M-39-160C-52-185-37-208-20-216C-29-238-8-262 10-250C17-276 43-270 45-246C61-231 52-207 40-198C51-172 28-148 7-157C-8-143-28-146-39-160Z" fill="url(#forest-leaf)" />
          <path d="M-25-211C-18-239 7-250 25-233C39-217 28-197 18-188C5-205-8-211-25-211Z" fill="url(#forest-leaf-light)" opacity=".7" />
        </g>
        <g id="pine-a" filter="url(#forest-watercolor)">
          <path d="M-5 0L0-250L8 0Z" fill="url(#forest-trunk)" />
          <path d="M0-275L-24-224L-12-228L-43-176L-25-183L-58-124L-33-132L-68-68L-39-79L-57-31L0-48L58-31L40-79L69-68L34-132L59-124L25-183L44-176L13-228L25-224Z" fill="url(#forest-leaf)" />
          <path d="M0-261L-11-221L-1-224L-23-175L-10-181L-34-126L-13-136L-41-78L-15-91L0-67Z" fill="url(#forest-leaf-light)" opacity=".62" />
        </g>
        <g id="pine-b" filter="url(#forest-watercolor)">
          <path d="M-5 0L-1-233L8 0Z" fill="url(#forest-trunk)" />
          <path d="M-3-258L-31-207L-18-211L-50-160L-30-167L-62-112L-38-121L-70-68L-45-76L-61-34L-8-49L52-32L39-77L67-66L36-119L58-110L29-165L49-158L17-211L30-207Z" fill="url(#forest-leaf)" />
          <path d="M-4-240L-18-205L-7-208L-30-163L-15-168L-38-120L-18-127L-45-82L-18-94L-5-64Z" fill="url(#forest-leaf-light)" opacity=".56" />
        </g>
        <g id="young" filter="url(#forest-watercolor)">
          <path d="M-3 0C-1-43-3-77 0-112M0-79C-13-94-22-102-30-113M1-91C14-106 22-114 30-124" fill="none" stroke="url(#forest-trunk)" strokeWidth="7" strokeLinecap="round" />
          <path d="M-32-100C-43-119-29-139-10-139C-7-158 18-158 24-141C43-136 47-115 34-102C40-82 17-68 1-79C-14-68-30-80-32-100Z" fill="url(#forest-leaf)" />
          <path d="M-19-119C-8-140 14-141 25-123C11-126 1-118-5-106Z" fill="url(#forest-leaf-light)" opacity=".72" />
        </g>
      </defs>

      <rect width="900" height="560" fill="url(#forest-sky)" />
      <circle cx="688" cy="106" r="150" fill={period === "night" ? "#dbe0b8" : "#fff4bd"} opacity={period === "night" ? ".06" : ".24"} />
      <path d="M0 390C116 342 222 367 327 347C445 325 529 356 646 331C750 309 830 339 900 314V475H0Z" fill={period === "night" ? "#6c806d" : "#a9b79a"} opacity=".24" filter="url(#forest-mist)" />
      <g className="watercolor-forest__distance" opacity={period === "night" ? ".2" : ".24"}>
        {[35, 105, 180, 244, 315, 382, 458, 528, 601, 677, 746, 817, 875].map((x, index) => (
          <use key={x} href={`#${index % 3 === 0 ? "pine-a" : index % 3 === 1 ? "young" : "slender"}`} transform={`translate(${x} 475) scale(${.38 + (index % 4) * .035})`} />
        ))}
      </g>
      <path d="M0 466C118 441 209 465 319 447C438 427 552 461 666 438C760 420 841 438 900 423V560H0Z" fill="url(#forest-ground)" />
      <path d="M0 492C140 470 238 494 348 476C468 456 589 488 705 464C790 447 852 458 900 449" fill="none" stroke="#a9b781" strokeWidth="3" opacity=".32" />

      <g className="watercolor-forest__trees">
        {months.map((item, index) => {
          const height = treeHeight(item.readingMinutes, range.min, range.max);
          const scale = height / 280;
          const active = index === activeIndex;
          return (
            <g
              key={item.month}
              className={`watercolor-tree${active ? " is-active" : ""}${index === strongestIndex ? " is-strongest" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`${formatForestMonth(item)}，阅读 ${item.readingMinutes} 分钟`}
              transform={`translate(${xPositions[index]} ${474 + groundOffsets[index]})`}
              onMouseEnter={() => onActivate(item, index)}
              onMouseLeave={onDeactivate}
              onFocus={() => onActivate(item, index)}
              onBlur={onDeactivate}
            >
              <ellipse className="watercolor-tree__halo" cx="0" cy={-height * .54} rx={40 * scale} ry={52 * scale} />
              <g className="watercolor-tree__sway" style={{ "--sway-delay": `${-index * .38}s` } as CSSProperties}>
                <use href={`#${treeKinds[index]}`} transform={`scale(${scale})`} />
              </g>
              <circle className="watercolor-tree__dot" cx="0" cy="13" r={index === strongestIndex ? 6 : 4} />
              <text className="watercolor-tree__label" x="0" y="38" textAnchor="middle">{formatForestMonth(item)}</text>
            </g>
          );
        })}
      </g>

      <g className="watercolor-forest__grass" opacity=".78">
        <path d="M22 502l-10-29m11 29l5-34m-4 34l16-26M862 493l-8-34m8 34l12-38m-12 38l25-28M120 487l-3-22m4 22l11-18M720 474l-4-22m5 22l13-18" stroke="#294f3f" strokeWidth="4" strokeLinecap="round" />
      </g>
    </svg>
  );
}
