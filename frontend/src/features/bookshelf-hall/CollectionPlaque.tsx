export function CollectionPlaque({ total }: { total: number }) {
  return (
    <header className="hall-collection-plaque" aria-label={"共收藏 " + total + " 本书"}>
      <strong>{total.toLocaleString("zh-CN")}</strong>
      <span>这些年，我读过的世界</span>
    </header>
  );
}
