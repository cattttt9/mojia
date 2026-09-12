import { useCallback, useRef } from "react";
import { useTick } from "@pixi/react";
import type { Container, Graphics, Ticker } from "pixi.js";

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 91.73 + salt * 43.11) * 43758.5453;
  return value - Math.floor(value);
}

function Firefly({ index, width, height, active }: { index: number; width: number; height: number; active: boolean }) {
  const ref = useRef<Container>(null);
  const elapsed = useRef(seeded(index, 8) * 6000);
  const baseX = seeded(index, 1) * width;
  const baseY = height * (0.28 + seeded(index, 2) * 0.58);
  const draw = useCallback((g: Graphics) => {
    g.clear().circle(0, 0, 7).fill({ color: 0xf2d47c, alpha: 0.1 }).circle(0, 0, 1.7).fill({ color: 0xffe69a, alpha: 0.9 });
  }, []);
  const tick = useCallback((ticker: Ticker) => {
    if (!ref.current) return;
    elapsed.current += ticker.deltaMS;
    const t = elapsed.current * 0.001;
    ref.current.x = baseX + Math.sin(t * 0.7 + index) * 13;
    ref.current.y = baseY + Math.cos(t * 0.48 + index * 0.6) * 8;
    ref.current.alpha = 0.35 + (Math.sin(t * 1.7 + index) + 1) * 0.25;
  }, [baseX, baseY, index]);
  useTick({ callback: tick, isEnabled: active });
  return <pixiContainer ref={ref} x={baseX} y={baseY}><pixiGraphics draw={draw} /></pixiContainer>;
}

export function FireflyLayer({ width, height, active, count = 12 }: { width: number; height: number; active: boolean; count?: number }) {
  return <pixiContainer>{Array.from({ length: count }, (_, index) => <Firefly key={index} index={index} width={width} height={height} active={active} />)}</pixiContainer>;
}

function Leaf({ index, width, height, active }: { index: number; width: number; height: number; active: boolean }) {
  const ref = useRef<Container>(null);
  const elapsed = useRef(seeded(index, 5) * 9000);
  const speed = 0.012 + seeded(index, 6) * 0.014;
  const draw = useCallback((g: Graphics) => {
    g.clear().ellipse(0, 0, 4.8, 2.3).fill({ color: index % 3 === 0 ? 0xd0ad62 : 0x66806c, alpha: 0.72 });
  }, [index]);
  const tick = useCallback((ticker: Ticker) => {
    const leaf = ref.current;
    if (!leaf) return;
    elapsed.current += ticker.deltaMS;
    const cycle = (elapsed.current * speed) % (height + 100);
    const t = elapsed.current * 0.001;
    leaf.x = seeded(index, 7) * width + Math.sin(t * 0.65 + index) * 18;
    leaf.y = cycle - 70;
    leaf.rotation = t * (0.2 + seeded(index, 9) * 0.25);
    leaf.alpha = cycle > height - 35 ? Math.max(0, (height - cycle) / 35) : 0.72;
  }, [height, index, speed, width]);
  useTick({ callback: tick, isEnabled: active });
  return <pixiContainer ref={ref}><pixiGraphics draw={draw} /></pixiContainer>;
}

export function LeafLayer({ width, height, active, count = 8 }: { width: number; height: number; active: boolean; count?: number }) {
  return <pixiContainer>{Array.from({ length: count }, (_, index) => <Leaf key={index} index={index} width={width} height={height} active={active} />)}</pixiContainer>;
}

