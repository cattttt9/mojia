import type { Texture } from "pixi.js";

export const treeAssetKeys = [
  "broad01", "broad02", "broad03", "slender01", "slender02", "pine01", "pine02", "young01",
] as const;

export type TreeAssetKey = typeof treeAssetKeys[number];
export type TreeTextures = Record<TreeAssetKey, Texture>;

export const treeAssetSources: Record<TreeAssetKey, string> = {
  broad01: "/assets/forest/tree-broad-01.svg",
  broad02: "/assets/forest/tree-broad-02.svg",
  broad03: "/assets/forest/tree-broad-03.svg",
  slender01: "/assets/forest/tree-slender-01.svg",
  slender02: "/assets/forest/tree-slender-02.svg",
  pine01: "/assets/forest/tree-pine-01.svg",
  pine02: "/assets/forest/tree-pine-02.svg",
  young01: "/assets/forest/tree-young-01.svg",
};

