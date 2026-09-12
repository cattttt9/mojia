import type { CSSProperties, PointerEvent } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import type { StarMapData, StarNode } from "../../platformApi";
import "./reading-universe-entry.css";

type PreviewStyle = CSSProperties & {
  "--pointer-x": number;
  "--pointer-y": number;
};

function nodeTitle(node?: StarNode) {
  return node?.title || node?.label || "一本书";
}

function recentConnection(graph: StarMapData) {
  const edge = graph.edges.find((item) => item.kind === "BOOK_RELATION");
  if (!edge) return graph.smartStatus || "你的阅读主题正在形成新的连接";
  const source = graph.nodes.find((node) => node.id === edge.source);
  const target = graph.nodes.find((node) => node.id === edge.target);
  return `最近新增：《${nodeTitle(source)}》与《${nodeTitle(target)}》建立连接`;
}

function updateParallax(event: PointerEvent<HTMLDivElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width - 0.5;
  const y = (event.clientY - rect.top) / rect.height - 0.5;
  event.currentTarget.style.setProperty("--pointer-x", x.toFixed(3));
  event.currentTarget.style.setProperty("--pointer-y", y.toFixed(3));
}

function resetParallax(event: PointerEvent<HTMLDivElement>) {
  event.currentTarget.style.setProperty("--pointer-x", "0");
  event.currentTarget.style.setProperty("--pointer-y", "0");
}

function ReadingUniversePreview() {
  return (
    <div
      className="reading-universe-preview"
      aria-label="书页与思想流动形成的阅读宇宙概念画面"
      onPointerMove={updateParallax}
      onPointerLeave={resetParallax}
      style={{ "--pointer-x": 0, "--pointer-y": 0 } as PreviewStyle}
    >
      <img
        className="reading-universe-artwork"
        src="/assets/reading-universe/reading-universe-installation-v1.webp"
        alt=""
        loading="lazy"
      />
      <div className="reading-universe-artwork-blend" aria-hidden="true" />
      <div className="reading-universe-artwork-glow" aria-hidden="true" />
    </div>
  );
}

function ReadingUniverseStats({ graph }: { graph: StarMapData }) {
  const stats = graph.stats || {
    bookCount: graph.nodes.filter((node) => node.kind === "BOOK").length,
    themeCount: graph.nodes.filter((node) => node.kind === "THEME").length,
    relationCount: graph.edges.length,
  };
  return (
    <p className="reading-universe-stats">
      <b>{stats.themeCount}</b> 个主题锚点
      <i />
      <b>{stats.relationCount}</b> 条思想连接
    </p>
  );
}

export function ReadingUniverseEntry({
  graph,
  onOpen,
}: {
  graph: StarMapData | null;
  onOpen: () => void;
}) {
  if (
    !graph ||
    (graph.stats?.bookCount ??
      graph.nodes.filter((node) => node.kind === "BOOK").length) < 3
  )
    return null;

  return (
    <section className="wrap reading-universe-entry">
      <div className="reading-universe-entry__grain" aria-hidden="true" />
      <div className="reading-universe-copy">
        <p className="eyebrow">MY READING UNIVERSE</p>
        <h2>我的阅读星图</h2>
        <p className="reading-universe-lead">
          你读过的书，正在形成一张
          <br />
          只属于你的思想地图。
        </p>
        <ReadingUniverseStats graph={graph} />
        <p className="reading-universe-recent">
          <Sparkles />
          <span>{recentConnection(graph)}</span>
        </p>
        <button className="reading-universe-cta" onClick={onOpen}>
          <Sparkles className="reading-universe-cta__spark" />
          <span>进入我的阅读宇宙</span>
          <ArrowRight className="reading-universe-cta__arrow" />
        </button>
      </div>
      <ReadingUniversePreview />
    </section>
  );
}
