import { useCallback } from "react";
import type { Graphics } from "pixi.js";
import { DataTree } from "./DataTree";
import { FireflyLayer, LeafLayer } from "./FireflyLayer";
import { mapTreeHeight } from "./types";
import type { ForestPeriod, ReadingForestData } from "./types";
import type { TreeAssetKey, TreeTextures } from "./treeAssets";

interface ForestSceneProps {
  data: ReadingForestData;
  textures: TreeTextures;
  width: number;
  height: number;
  period: ForestPeriod;
  active: boolean;
  reducedMotion: boolean;
  hoveredIndex: number | null;
  selectedIndex: number | null;
  onHover: (index: number) => void;
  onLeave: () => void;
  onSelect: (index: number) => void;
}

const groundOffsets = [2, -4, 3, -2, 5, 0, -3, 4, -1, 3, -4, 1];
const treeAssets: TreeAssetKey[] = ["young01", "pine01", "broad02", "slender01", "pine02", "broad01", "slender02", "broad03", "pine01", "broad02", "slender01", "pine02"];
const xOffsets = [0.06, -0.18, 0.12, -0.08, 0.2, -0.05, 0.13, -0.16, 0.18, -0.1, 0.1, -0.12];
const farForest: Array<[TreeAssetKey, number, number, number]> = [
  ["pine02", 0.03, 0.28, -8], ["slender02", 0.14, 0.34, -3], ["pine01", 0.26, 0.3, -10],
  ["broad03", 0.39, 0.37, -2], ["pine02", 0.51, 0.31, -9], ["slender01", 0.64, 0.36, -4],
  ["pine01", 0.76, 0.29, -11], ["broad01", 0.88, 0.34, -3], ["pine02", 0.98, 0.3, -8],
];
const middleForest: Array<[TreeAssetKey, number, number, number]> = [
  ["young01", 0.08, 0.3, 2], ["pine01", 0.31, 0.4, -2], ["broad02", 0.48, 0.43, 3],
  ["pine02", 0.69, 0.39, -3], ["young01", 0.93, 0.31, 2],
];

export function ForestScene(props: ForestSceneProps) {
  const { data, textures, width, height, period, active, reducedMotion, hoveredIndex, selectedIndex, onHover, onLeave, onSelect } = props;
  const values = data.months.map((month) => month.readingMinutes);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const strongest = max > 0 ? values.indexOf(max) : -1;
  const groundY = height - 46;
  const side = Math.max(18, width * 0.025);
  const usableWidth = Math.max(1, width - side * 2);
  const treeGap = usableWidth / Math.max(1, data.months.length);
  const maxTreeHeight = Math.min(230, height * 0.62);

  const drawBackground = useCallback((g: Graphics) => {
    g.clear();
    const light = period === "night" ? 0x46695e : 0xfff2c8;
    g.circle(width * 0.72, height * 0.2, Math.min(width, height) * 0.24).fill({ color: light, alpha: period === "night" ? 0.07 : 0.18 });
  }, [groundY, height, period, side, usableWidth, width]);

  const drawMist = useCallback((g: Graphics) => {
    g.clear();
    const color = period === "night" ? 0x6d8d80 : 0xf3eccf;
    g.ellipse(width * 0.52, groundY - height * 0.19, width * 0.52, height * 0.16).fill({ color, alpha: period === "night" ? 0.07 : 0.16 });
    g.ellipse(width * 0.72, groundY - height * 0.08, width * 0.42, height * 0.09).fill({ color, alpha: period === "night" ? 0.045 : 0.1 });
  }, [groundY, height, period, width]);

  const drawGround = useCallback((g: Graphics) => {
    g.clear();
    g.moveTo(0, groundY - 12)
      .bezierCurveTo(width * 0.22, groundY - 32, width * 0.42, groundY + 2, width * 0.62, groundY - 16)
      .bezierCurveTo(width * 0.78, groundY - 29, width * 0.9, groundY - 5, width, groundY - 19)
      .lineTo(width, height)
      .lineTo(0, height)
      .closePath()
      .fill({ color: period === "night" ? 0x173a32 : 0x78866c, alpha: 0.7 });
    g.moveTo(0, groundY + 4)
      .bezierCurveTo(width * 0.28, groundY - 9, width * 0.5, groundY + 21, width * 0.75, groundY + 2)
      .bezierCurveTo(width * 0.9, groundY - 3, width * 0.97, groundY + 10, width, groundY + 5)
      .lineTo(width, height).lineTo(0, height).closePath()
      .fill({ color: period === "night" ? 0x102e28 : 0x476b56, alpha: 0.9 });
  }, [groundY, height, period, width]);

  return (
    <pixiContainer>
      <pixiGraphics draw={drawBackground} />
      <pixiContainer alpha={period === "night" ? 0.16 : 0.2}>
        {farForest.map(([assetKey, xRatio, heightRatio, yOffset], index) => {
          const treeHeight = height * heightRatio;
          return <pixiSprite key={`far-${index}`} texture={textures[assetKey]} anchor={{ x: 0.5, y: 1 }}
            x={width * xRatio} y={groundY + yOffset} height={treeHeight} width={treeHeight * 0.46}
            tint={period === "night" ? 0x547267 : 0x9ca58b} />;
        })}
      </pixiContainer>
      <pixiGraphics draw={drawMist} />
      <pixiContainer alpha={period === "night" ? 0.25 : 0.32}>
        {middleForest.map(([assetKey, xRatio, heightRatio, yOffset], index) => {
          const treeHeight = height * heightRatio;
          return <pixiSprite key={`middle-${index}`} texture={textures[assetKey]} anchor={{ x: 0.5, y: 1 }}
            x={width * xRatio} y={groundY + yOffset} height={treeHeight} width={treeHeight * 0.47}
            tint={period === "night" ? 0x6f8b7e : 0x819076} />;
        })}
      </pixiContainer>
      {data.months.map((month, index) => {
        const x = side + treeGap * index + treeGap / 2 + treeGap * xOffsets[index % xOffsets.length];
        const y = groundY + groundOffsets[index % groundOffsets.length] * 1.8;
        const treeHeight = month.readingMinutes <= 0
          ? 88
          : mapTreeHeight(month.readingMinutes, min, max, 96, maxTreeHeight);
        const assetKey = treeAssets[index % treeAssets.length];
        const focus = selectedIndex ?? hoveredIndex;
        return (
          <DataTree
            key={month.month}
            x={x}
            y={y}
            height={treeHeight}
            slotWidth={treeGap}
            index={index}
            assetKey={assetKey}
            textures={textures}
            period={period}
            active={active}
            reducedMotion={reducedMotion}
            strongest={index === strongest}
            dimmed={focus !== null && focus !== index}
            onHover={onHover}
            onLeave={onLeave}
            onSelect={onSelect}
          />
        );
      })}
      <pixiGraphics draw={drawGround} />
      {!reducedMotion && <LeafLayer width={width} height={height} active={active} count={width < 620 ? 4 : 8} />}
      {period === "night" && !reducedMotion && <FireflyLayer width={width} height={height} active={active} count={width < 620 ? 6 : 12} />}
    </pixiContainer>
  );
}
