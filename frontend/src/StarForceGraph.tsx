import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import type { StarEdge, StarNode } from "./platformApi";

type Props = {
  nodes: StarNode[];
  edges: StarEdge[];
  selectedNode: StarNode | null;
  selectedEdge: StarEdge | null;
  showHighlights: boolean;
  onSelectNode: (node: StarNode) => void;
  onSelectEdge: (edge: StarEdge) => void;
  onClearSelection: () => void;
  onForceState?: (active: boolean, label?: string) => void;
};

type GraphDatum = {
  id: string;
  name: string;
  nodeKind: "BOOK" | "THEME" | "HIGHLIGHT";
  sourceNode?: StarNode;
  symbol?: string;
  symbolSize: number | [number, number];
  itemStyle: Record<string, unknown>;
  label?: Record<string, unknown>;
  emphasis?: Record<string, unknown>;
  blur?: Record<string, unknown>;
  draggable?: boolean;
  silent?: boolean;
  fixed?: boolean;
  cursor?: string;
};

const relationColors: Record<string, string> = {
  "同一作者": "#72c5a4",
  "同一分类": "#73b7c7",
  "同期阅读": "#d7b96d",
  "主题相近": "#9b8ddd",
  "AI主题": "#d6b96c",
  "分类主题": "#b99b62",
};

/** ECharts 原生力导向图：拖动任何节点都会重新参与整张图的弹力平衡。 */
export function StarForceGraph({ nodes, edges, selectedNode, selectedEdge, showHighlights, onSelectNode, onSelectEdge, onClearSelection, onForceState }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [chartReady, setChartReady] = useState(false);
  const [coverRatios, setCoverRatios] = useState<Record<string, number>>({});
  const callbacksRef = useRef({ onSelectNode, onSelectEdge, onClearSelection, onForceState });
  const dataRef = useRef({ nodes: new Map<string, StarNode>(), edges: new Map<string, StarEdge>() });
  const pressedNodeRef = useRef<string | null>(null);
  callbacksRef.current = { onSelectNode, onSelectEdge, onClearSelection, onForceState };

  dataRef.current = {
    nodes: new Map(nodes.map((node) => [node.id, node])),
    edges: new Map(edges.map((edge) => [edge.id, edge])),
  };

  // 选中状态变化不会改变此签名，因此不会重新提交 force 数据或打乱已经稳定的布局。
  const graphKey = `${showHighlights}|${nodes.map((node) => `${node.id}:${node.cover || ""}:${node.highlightCount || 0}`).join("|")}|${edges.map((edge) => `${edge.id}:${edge.score}:${edge.types.join(",")}`).join("|")}`;
  const ratioKey = nodes.map((node) => `${node.id}:${coverRatios[node.id] || .7}`).join("|");

  useEffect(() => {
    let cancelled = false;
    const books = nodes.filter((node) => node.kind === "BOOK" && node.cover);
    Promise.all(books.map((node) => new Promise<[string, number]>((resolve) => {
      const image = new Image();
      image.onload = () => resolve([node.id, Math.max(.5, Math.min(1, image.naturalWidth / Math.max(1, image.naturalHeight)))]);
      image.onerror = () => resolve([node.id, .7]);
      image.src = node.cover!;
    }))).then((entries) => {
      if (!cancelled) setCoverRatios(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [graphKey]);

  const graphPayload = useMemo(() => {
    const data: GraphDatum[] = nodes.map((node) => {
      const isTheme = node.kind === "THEME";
      const height = 50 + Math.min(12, (node.rankScore || 0) / 90);
      const size: number | [number, number] = isTheme
        ? 27 + Math.min(9, (node.bookCount || 0) * .55)
        : [Math.round(height * (coverRatios[node.id] || .7)), Math.round(height)];
      return {
        id: node.id,
        name: node.label,
        nodeKind: node.kind,
        sourceNode: node,
        symbol: isTheme ? "circle" : node.cover ? `image://${node.cover}` : "circle",
        symbolSize: size,
        // 主题是系统生成的语义锚点：可查看，但不允许用户拖动或编辑其位置。
        draggable: !isTheme,
        cursor: isTheme ? "default" : "grab",
        itemStyle: isTheme
          ? { color: "#d4bc76", borderColor: "rgba(244,229,177,.88)", borderWidth: 2, shadowBlur: 22, shadowColor: "rgba(214,185,102,.38)" }
          : { color: "#315d50", borderColor: node.searchMatched ? "#efb56f" : "#d9ca93", borderWidth: node.searchMatched ? 4 : 2, shadowBlur: 17, shadowColor: "rgba(0,0,0,.55)", borderRadius: 999 },
        label: isTheme ? { show: true, position: "inside", formatter: node.label.slice(0, 5), color: "#18372f", fontSize: 9, fontWeight: 700 } : undefined,
        // 邻接边被强调时，书籍不批量弹出标签；主题文字始终保留，避免黄色空心点。
        emphasis: {
          disabled: true,
          scale: false,
          itemStyle: isTheme
            ? { opacity: 1, borderColor: "#fff0b5", borderWidth: 3, shadowBlur: 26, shadowColor: "rgba(241,211,119,.72)" }
            : { opacity: 1, borderColor: "#f3c96f", borderWidth: 4, shadowBlur: 28, shadowColor: "rgba(243,201,111,.78)" },
          label: isTheme
            ? { show: true, position: "inside", formatter: node.label.slice(0, 5), color: "#18372f", fontSize: 9, fontWeight: 700 }
            : { show: true, position: "bottom", distance: 8, formatter: node.label, color: "#fff8df", fontSize: 11, fontWeight: 700, backgroundColor: "rgba(13,46,37,.96)", borderColor: "#d9ba69", borderWidth: 1, borderRadius: 10, padding: [5, 9] },
        },
        blur: isTheme ? { itemStyle: { opacity: .28 }, label: { show: true, position: "inside", formatter: node.label.slice(0, 5), color: "rgba(63,62,39,.68)", fontSize: 9 } } : { itemStyle: { opacity: .14 }, label: { show: false } },
      };
    });

    const links: any[] = edges.map((edge) => ({
      ...edge,
      relationEdge: edge,
      lineStyle: {
        color: relationColors[edge.types[0]] || (edge.kind === "BOOK_THEME" ? "#cbb16b" : "#77a994"),
        opacity: Math.max(.12, Math.min(.66, edge.score * .62)),
        width: Math.max(.7, edge.score * 2.2),
        type: edge.kind === "BOOK_THEME" ? "dashed" : "solid",
        curveness: edge.kind === "BOOK_THEME" ? .08 : .025,
      },
      emphasis: { disabled: true, lineStyle: { opacity: 1, width: Math.max(2.4, edge.score * 3.2), shadowBlur: 7, shadowColor: relationColors[edge.types[0]] || "#79c7a8" } },
      blur: { lineStyle: { opacity: .018 } },
    }));

    if (showHighlights) {
      nodes.filter((node) => node.kind === "BOOK" && (node.highlightCount || 0) > 0).forEach((node, index) => {
        const count = Math.min(2, Math.max(1, Math.ceil((node.highlightCount || 0) / 12)));
        for (let i = 0; i < count; i += 1) {
          const id = `highlight:${node.id}:${i}`;
          data.push({ id, name: `${node.highlightCount} 处划线`, nodeKind: "HIGHLIGHT", symbol: "diamond", symbolSize: 5 + Math.min(4, (node.highlightCount || 0) / 15), draggable: true, silent: true, itemStyle: { color: "#ead790", shadowBlur: 12, shadowColor: "#ead790" } });
          links.push({ id: `highlight-link:${node.id}:${i}`, source: node.id, target: id, lineStyle: { color: "#d8ca91", opacity: .18, width: .6, curveness: index % 2 ? .12 : -.12 } });
        }
      });
    }
    return { data, links };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphKey, ratioKey]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let frame = 0;

    const initialize = () => {
      if (disposed || chartRef.current) return;
      const { width, height } = host.getBoundingClientRect();
      if (width < 2 || height < 2) {
        frame = window.requestAnimationFrame(initialize);
        return;
      }

      const chart = echarts.init(host, undefined, {
        renderer: "canvas",
        useDirtyRect: true,
        width: Math.round(width),
        height: Math.round(height),
      });
      chartRef.current = chart;
      setChartReady(true);
      chart.on("click", (params: any) => {
        const node = params.dataType === "node" ? dataRef.current.nodes.get(String(params.data?.id || "")) : undefined;
        const edge = params.dataType === "edge" ? dataRef.current.edges.get(String(params.data?.id || "")) : undefined;
        if (node) callbacksRef.current.onSelectNode(node);
        if (edge) callbacksRef.current.onSelectEdge(edge);
      });
      chart.on("mousedown", (params: any) => {
        if (params.dataType === "node" && params.data?.nodeKind !== "HIGHLIGHT") {
          pressedNodeRef.current = String(params.data.id);
          callbacksRef.current.onForceState?.(true, params.data.name);
        }
      });
      chart.on("mouseup", () => {
        pressedNodeRef.current = null;
        window.setTimeout(() => callbacksRef.current.onForceState?.(false), 420);
      });
      chart.on("globalout", () => {
        window.setTimeout(() => callbacksRef.current.onForceState?.(false), 420);
      });
      chart.getZr().on("click", (event) => {
        if (!event.target) callbacksRef.current.onClearSelection();
      });
    };

    const resize = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width < 2 || rect.height < 2) return;
      if (!chartRef.current) initialize();
      else chartRef.current.resize({ width: Math.round(rect.width), height: Math.round(rect.height) });
    });
    resize.observe(host);
    frame = window.requestAnimationFrame(initialize);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      resize.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item", confine: true, backgroundColor: "rgba(246,242,229,.97)", borderColor: "rgba(226,211,166,.8)", borderWidth: 1,
        textStyle: { color: "#26483e", fontSize: 11 }, extraCssText: "box-shadow:0 16px 42px rgba(0,0,0,.35);border-radius:10px;",
        formatter: (params: any) => params.dataType === "edge" ? (params.data?.relationEdge?.explanation || "划线与书籍的连接") : params.data?.nodeKind === "BOOK" ? `${params.data.name}<br/><span style=\"color:#70847b\">拖动节点，观察整张星图重新平衡</span>` : params.data?.name,
      },
      series: [{
        id: "reading-force-graph", type: "graph", layout: "force", animation: false, roam: true, roamTrigger: "global", scaleLimit: { min: .42, max: 5.5 }, draggable: true, selectedMode: false,
        data: graphPayload.data, links: graphPayload.links,
        // 初始图群更靠近中心；拖动后仍由弹力、引力与斥力共同重新平衡。
        force: { edgeLength: [42, 112], repulsion: [85, 290], gravity: .17, friction: .5, layoutAnimation: true },
        lineStyle: { color: "source", opacity: .18, width: 1, curveness: .025 },
        label: { show: false, color: "#f6f0df", fontFamily: "Noto Serif SC, Songti SC, serif" },
        // 悬停不再启用 adjacency focus，密集区域不会反复让整张图明暗闪烁。
        // 禁用 ECharts 原生 hover emphasis；聚焦状态由下方点击锁定逻辑直接控制。
        emphasis: { disabled: true, focus: "none", scale: false, itemStyle: { opacity: 1, shadowBlur: 15, shadowColor: "rgba(231,210,142,.4)" }, label: { show: false } },
        select: { itemStyle: { opacity: 1, borderColor: "#f3c96f", borderWidth: 5, shadowBlur: 34, shadowColor: "rgba(243,201,111,.9)" }, label: { show: true, position: "bottom", distance: 10, color: "#fff8df", fontSize: 12, fontWeight: 700, backgroundColor: "rgba(13,46,37,.96)", borderColor: "#d9ba69", borderWidth: 1, borderRadius: 12, padding: [6, 11] } },
        blur: { itemStyle: { opacity: .14 }, lineStyle: { opacity: .025 }, label: { show: false } },
      }],
    }, { notMerge: true, lazyUpdate: false });
  }, [graphPayload, chartReady]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.dispatchAction({ type: "hideTip" });
    const seriesModel = (chart as any).getModel().getSeriesByIndex(0);
    const nodeData = seriesModel?.getData();
    const edgeData = seriesModel?.getEdgeData();
    const stateApi = (chart as any)._api;

    // 先清除上一次点击留下的状态。悬停强调已在 option 中禁用，因此这里只会响应点击选择。
    graphPayload.data.forEach((_item, dataIndex) => {
      const graphic = nodeData?.getItemGraphicEl(dataIndex);
      if (!graphic) return;
      stateApi.leaveEmphasis(graphic);
      stateApi.leaveBlur(graphic);
    });
    graphPayload.links.forEach((_link, edgeIndex) => {
      const graphic = edgeData?.getItemGraphicEl(edgeIndex);
      if (!graphic) return;
      stateApi.leaveEmphasis(graphic);
      stateApi.leaveBlur(graphic);
    });

    const id = selectedNode?.id;
    if (id) {
      const index = graphPayload.data.findIndex((item) => item.id === id);
      if (index >= 0) {
        const adjacentIds = new Set<string>([id]);
        const adjacentEdges = new Set<number>();
        graphPayload.links.forEach((link, edgeIndex) => {
          if (String(link.source) === id) { adjacentIds.add(String(link.target)); adjacentEdges.add(edgeIndex); }
          if (String(link.target) === id) { adjacentIds.add(String(link.source)); adjacentEdges.add(edgeIndex); }
        });
        graphPayload.data.forEach((item, dataIndex) => {
          const graphic = nodeData?.getItemGraphicEl(dataIndex);
          if (!graphic) return;
          if (adjacentIds.has(item.id)) stateApi.leaveBlur(graphic);
          else stateApi.enterBlur(graphic);
        });
        graphPayload.links.forEach((_link, edgeIndex) => {
          const graphic = edgeData?.getItemGraphicEl(edgeIndex);
          if (!graphic) return;
          if (adjacentEdges.has(edgeIndex)) {
            stateApi.leaveBlur(graphic);
            stateApi.enterEmphasis(graphic);
          } else stateApi.enterBlur(graphic);
        });
        const selectedGraphic = nodeData?.getItemGraphicEl(index);
        if (selectedGraphic) stateApi.enterEmphasis(selectedGraphic);
        chart.dispatchAction({ type: "showTip", seriesIndex: 0, dataIndex: index });
      }
    } else if (selectedEdge) {
      const index = graphPayload.links.findIndex((item) => item.id === selectedEdge.id);
      if (index >= 0) {
        const link = graphPayload.links[index];
        const endpointIds = new Set([String(link.source), String(link.target)]);
        graphPayload.data.forEach((item, dataIndex) => {
          const graphic = nodeData?.getItemGraphicEl(dataIndex);
          if (!graphic) return;
          if (endpointIds.has(item.id)) stateApi.leaveBlur(graphic);
          else stateApi.enterBlur(graphic);
        });
        graphPayload.links.forEach((_item, edgeIndex) => {
          const graphic = edgeData?.getItemGraphicEl(edgeIndex);
          if (!graphic) return;
          if (edgeIndex === index) stateApi.enterEmphasis(graphic);
          else stateApi.enterBlur(graphic);
        });
      }
    }
  }, [selectedNode, selectedEdge, graphPayload, chartReady]);

  return <div ref={hostRef} className="star-force-chart" role="img" aria-label="可拖动力导向阅读星图" />;
}
