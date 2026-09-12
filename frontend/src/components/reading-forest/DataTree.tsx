import { useCallback, useEffect, useRef } from "react";
import { useTick } from "@pixi/react";
import type { Container, Graphics, Ticker } from "pixi.js";
import type { ForestPeriod } from "./types";
import type { TreeAssetKey, TreeTextures } from "./treeAssets";

interface DataTreeProps {
  x: number;
  y: number;
  height: number;
  slotWidth: number;
  index: number;
  assetKey: TreeAssetKey;
  textures: TreeTextures;
  period: ForestPeriod;
  active: boolean;
  reducedMotion: boolean;
  strongest: boolean;
  dimmed: boolean;
  onHover: (index: number) => void;
  onLeave: () => void;
  onSelect: (index: number) => void;
}

const widthRatios: Record<TreeAssetKey, number> = {
  broad01: 0.52, broad02: 0.54, broad03: 0.5,
  slender01: 0.39, slender02: 0.4,
  pine01: 0.46, pine02: 0.43, young01: 0.42,
};

export function DataTree({
  x, y, height, slotWidth, index, assetKey, textures, period, active, reducedMotion, strongest, dimmed,
  onHover, onLeave, onSelect,
}: DataTreeProps) {
  const rootRef = useRef<Container>(null);
  const elapsed = useRef(0);
  const delay = 220 + index * 72;
  const displayWidth = Math.max(slotWidth * 0.58, height * widthRatios[assetKey]);

  useEffect(() => {
    if (!rootRef.current) return;
    rootRef.current.scale.set(reducedMotion ? 1 : 0.94, reducedMotion ? 1 : 0.05);
  }, [assetKey, height, reducedMotion]);

  const tick = useCallback((ticker: Ticker) => {
    const root = rootRef.current;
    if (!root) return;
    elapsed.current += ticker.deltaMS;
    const progress = Math.max(0, Math.min(1, (elapsed.current - delay) / 1100));
    const eased = 1 - Math.pow(1 - progress, 3);
    root.scale.set(reducedMotion ? 1 : 0.94 + eased * 0.06, reducedMotion ? 1 : 0.05 + eased * 0.95);
    const wind = assetKey.startsWith("slender") ? 0.009 : assetKey.startsWith("pine") ? 0.0035 : 0.0055;
    root.rotation = Math.sin(elapsed.current * 0.00048 + index * 0.83) * wind;
  }, [assetKey, delay, index, reducedMotion]);
  useTick({ callback: tick, isEnabled: active && !reducedMotion });

  const drawHitArea = useCallback((g: Graphics) => {
    g.clear().rect(-displayWidth / 2, -height, displayWidth, height).fill({ color: 0xffffff, alpha: 0.001 });
  }, [displayWidth, height]);

  const drawGlow = useCallback((g: Graphics) => {
    g.clear();
    if (!strongest) return;
    g.ellipse(0, -height * 0.56, displayWidth * 0.66, height * 0.43)
      .fill({ color: 0xf2d47c, alpha: period === "night" ? 0.12 : 0.075 });
    [-0.24, -0.08, 0.13, 0.29].forEach((offset, flowerIndex) => {
      g.circle(offset * displayWidth, -height * (0.48 + (flowerIndex % 2) * 0.18), 2.4)
        .fill({ color: 0xf2d47c, alpha: 0.96 });
    });
  }, [displayWidth, height, period, strongest]);

  return (
    <pixiContainer x={x} y={y} alpha={dimmed ? 0.32 : 1}>
      <pixiGraphics draw={drawGlow} />
      <pixiContainer ref={rootRef}>
        <pixiSprite
          texture={textures[assetKey]}
          anchor={{ x: 0.5, y: 1 }}
          width={displayWidth}
          height={height}
          tint={period === "night" ? 0xa9c1b5 : 0xffffff}
        />
        <pixiGraphics draw={drawHitArea} eventMode="static" cursor="pointer"
          onPointerOver={() => onHover(index)} onPointerOut={onLeave} onPointerTap={() => onSelect(index)} />
      </pixiContainer>
    </pixiContainer>
  );
}

