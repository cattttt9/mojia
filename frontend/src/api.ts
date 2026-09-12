import type { DashboardData, ShelfBook } from "./types";
import { rollingMonthlySeconds } from "./readingMonths";

// 该模块仅用于 Netlify 直连模式；Java 后端模式统一走 platformApi.ts。
type GatewayResponse = Record<string, any>;

/** 调用同源 Netlify Function，避免浏览器直接暴露微信读书上游地址。 */
async function callGateway(
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<GatewayResponse> {
  const response = await fetch("/.netlify/functions/weread", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.errcode)
    throw new Error(data.message || data.errmsg || "微信读书数据暂时没拉到");
  if (data.upgrade_info)
    throw new Error(data.upgrade_info.message || "微信读书 Skill 需要升级");
  return data;
}

const statCount = (stats: any[], label: string) => {
  const text = stats?.find((x) => x.stat === label)?.counts || "0";
  return Number(String(text).replace(/[^0-9]/g, "")) || 0;
};

/** 并行加载书架、累计统计和年度数据，再归一化为前端仪表盘模型。 */
export async function loadDashboard(apiKey: string): Promise<DashboardData> {
  const now = new Date();
  const yearStart = (year: number) => Math.floor(new Date(year, 0, 1).getTime() / 1000);
  const [shelf, overall, annual, annualPrevious] = await Promise.all([
    callGateway(apiKey, { api_name: "/shelf/sync" }),
    callGateway(apiKey, {
      api_name: "/readdata/detail",
      mode: "overall",
      baseTime: 0,
    }),
    callGateway(apiKey, {
      api_name: "/readdata/detail",
      mode: "annually",
      baseTime: yearStart(now.getFullYear()),
    }),
    callGateway(apiKey, {
      api_name: "/readdata/detail",
      mode: "annually",
      baseTime: yearStart(now.getFullYear() - 1),
    }),
  ]);
  const books: ShelfBook[] = (shelf.books || []).map((book: any) => ({
    id: String(book.bookId),
    title: book.title || "未命名",
    author: book.author || "佚名",
    category: book.category || "未分类",
    cover: book.cover,
    wordCount: Number(book.wordCount) || undefined,
    finished: Number(book.finishReading) === 1,
    lastRead: Number(book.readUpdateTime || 0) * 1000,
    progress: Number(book.readingProgress ?? book.progress) || undefined,
    top: Number(book.isTop) === 1,
    secret: Number(book.secret) === 1,
  }));
  const albums: ShelfBook[] = (shelf.albums || []).map((item: any) => {
    const album = item.albumInfo || {};
    const extra = item.albumInfoExtra || {};
    return {
      id: `album-${album.albumId}`,
      title: album.name || "未命名有声书",
      author: album.authorName || "佚名",
      category: "有声书",
      cover: album.cover,
      finished: Number(album.finish) === 1,
      lastRead: Number(extra.lectureReadUpdateTime || 0) * 1000,
      top: Number(extra.isTop) === 1,
      secret: Number(extra.secret) === 1,
    };
  });
  if (shelf.mp && Object.keys(shelf.mp).length)
    books.push({
      id: "mp-collection",
      title: "文章收藏",
      author: "微信读书",
      category: "文章收藏",
      finished: false,
      lastRead: 0,
      secret: true,
    });
  books.push(...albums);
  const monthly = rollingMonthlySeconds(annualPrevious, annual, now);
  const top = overall.readLongest?.[0];
  const topBook = top?.book || top?.albumInfo;
  return {
    books,
    ownerName: "我的",
    syncedAt: new Date(),
    stats: {
      totalReadTime: Number(overall.totalReadTime || 0),
      readDays: Number(overall.readDays || 0),
      readBooks: statCount(overall.readStat, "读过"),
      finishedBooks: statCount(overall.readStat, "读完"),
      notes: statCount(overall.readStat, "笔记"),
      monthlySeconds: monthly,
      favoriteCategory: overall.preferCategory?.[0]?.categoryTitle || "未分类",
      longest: topBook
        ? {
            title: topBook.title || topBook.name,
            author: topBook.author || topBook.authorName || "",
            cover: topBook.cover,
            seconds: Number(top.readTime || 0),
          }
        : undefined,
    },
  };
}
