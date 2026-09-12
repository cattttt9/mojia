import type { DashboardData, ShelfBook } from "./types";
import { rollingMonthlySeconds } from "./readingMonths";

export const AUTH_EXPIRED_EVENT = "inkshelf:auth-expired";

// 本地开发默认走 Vite 的同源代理；部署时可用 VITE_API_BASE_URL 指向 Java API。
const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
export type Session = {
  token: string;
  username: string;
  displayName: string;
  email?: string;
  role?: "USER" | "ADMIN";
  status?: string;
};
export type MeProfile = {
  id: number;
  username: string;
  email: string;
  displayName: string;
  role: "USER" | "ADMIN";
  status: string;
  lastLoginAt?: string;
  lastSeenAt?: string;
  createdAt?: string;
};
export type WereadConnection = {
  connected: boolean;
  apiKeyMasked?: string;
  connectedAt?: string;
  lastVerifiedAt?: string;
  lastSyncAt?: string;
  lastSyncStatus: string;
  lastSyncError?: string;
};
export type SyncItem = {
  status: string;
  lastSyncAt?: string;
  count: number;
  error?: string;
};
export type SyncStatus = {
  shelf: SyncItem;
  note: SyncItem;
  bookmark: SyncItem;
};
export type AdminUser = {
  id: number;
  username: string;
  email: string;
  displayName: string;
  role: "USER" | "ADMIN";
  status: string;
  online: boolean;
  lastLoginAt?: string;
  lastSeenAt?: string;
  createdAt?: string;
  updatedAt?: string;
  wereadConnected: boolean;
  wereadLastSyncAt?: string;
  wereadLastSyncStatus?: string;
};
export type InvitationCode = {
  id: number;
  code?: string;
  codeMasked: string;
  status: "UNUSED" | "USED" | "EXPIRED" | "DISABLED";
  createdAt: string;
  expiresAt?: string;
  createdBy?: string;
  usedAt?: string;
  usedBy?: string;
  registrationIp?: string;
  requestId?: string;
  disabledBy?: string;
};
export type BoardMessage = {
  id: number;
  content: string;
  author: string;
  username: string;
  createdAt: string;
};
export type NoteSyncView = {
  status: "IDLE" | "SYNCING" | "SUCCESS" | "FAILED";
  lastSuccessAt?: string;
  errorCode?: string;
};
export type NoteSummary = {
  bookId: string;
  reviewCount: number;
  highlightCount: number;
  bookmarkCount: number;
  readingProgress: number;
  markedStatus: number;
  cachedContentCount: number;
  sync: NoteSyncView;
};
export type BookNote = {
  id: number;
  type: "HIGHLIGHT" | "THOUGHT" | "CHAPTER_REVIEW" | "BOOK_REVIEW";
  chapterUid?: string;
  chapterTitle?: string;
  originalText?: string;
  content?: string;
  createdAt?: string;
};
export type ReadingDetail = {
  bookId: string;
  title: string;
  author: string;
  category: string;
  cover?: string;
  intro?: string;
  deepLink?: string;
  progress: number;
  readingTime: number;
  ttsTime?: number;
  updateTime: number;
};
export type ReportMemory = {
  id: number;
  bookId: string;
  bookTitle: string;
  author: string;
  chapter?: string;
  quote?: string;
  content?: string;
  createdAt?: string;
};
export type ReportBook = {
  bookId: string;
  title: string;
  author: string;
  cover: string;
  seconds: number;
  progress: number;
  noteCount: number;
  highlightCount: number;
};
export type ReadingReport = {
  id: number;
  periodType: "WEEKLY" | "MONTHLY";
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  snapshot: {
    snapshotVersion?: number;
    issueYear?: number;
    issueNumber?: number;
    totalReadTime: number;
    previousTotalReadTime?: number;
    readDays: number;
    dayAverageReadTime: number;
    compare: number;
    counts: Record<string, number>;
    categories: {
      name: string;
      seconds: number;
      books: number;
      weight: number;
    }[];
    timeline: {
      timestamp: string;
      date?: string;
      seconds: number;
      noteCount?: number;
      books?: string[];
    }[];
    preferTimeWord: string;
    topBook: ReportBook;
    books?: ReportBook[];
    highlights?: ReportMemory[];
    notes?: ReportMemory[];
    newNotes: number;
    summary: string;
  };
};
export type ReadingCapsule = {
  available: boolean;
  id?: number;
  sourceDate?: string;
  sourceType?: string;
  status?: string;
  content?: {
    title?: string;
    author?: string;
    cover?: string;
    chapter?: string;
    quote?: string;
    thought?: string;
    message?: string;
  };
  reflection?: string;
};
export type AiInsightType =
  | "weekly_themes"
  | "abandonment_diagnosis"
  | "prescription";
export type AiInsightResponse = {
  id?: number;
  type: AiInsightType;
  title?: string;
  model?: string;
  generatedAt: string;
  message?: string;
  result?: any;
};
export type SliderChallenge = {
  challengeId: string;
  background: string;
  piece: string;
  pieceY: number;
  trackWidth: number;
  imageHeight: number;
  pieceSize: number;
};
export type StarNode = {
  id: string; kind: "BOOK" | "THEME"; label: string; bookId?: string;
  title?: string; author?: string; category?: string; cover?: string;
  finished?: boolean; lastRead?: string; themes?: string[];
  themeSource?: "SYSTEM" | "AI" | "USER"; summary?: string;
  noteCount?: number; highlightCount?: number; relatedCount?: number;
  progress?: number; top?: boolean; rankScore?: number; rankReason?: string; searchMatched?: boolean;
  source?: string; bookCount?: number;
};
export type StarEdge = {
  id: string; source: string; target: string; sourceBookId?: string;
  targetBookId?: string; kind: "BOOK_RELATION" | "BOOK_THEME";
  types: string[]; sharedThemes?: string[]; score: number; explanation: string;
};
export type StarMapData = {
  nodes: StarNode[]; edges: StarEdge[];
  stats: { bookCount: number; themeCount: number; relationCount: number; densestBook?: { bookId: string; title: string; connections: number } };
  smartStatus: string; aiEnhanced: boolean;
};

/**
 * 兼容旧缓存、升级中的接口响应和局部失败结果，避免页面在 stats 缺失时崩溃。
 * 统计值缺失时根据节点与连线现场重建，保证所有星图入口拿到完整结构。
 */
function normalizeStarMap(data: any): StarMapData {
  const nodes: StarNode[] = Array.isArray(data?.nodes) ? data.nodes : [];
  const edges: StarEdge[] = Array.isArray(data?.edges) ? data.edges : [];
  const stats = data?.stats && typeof data.stats === "object" ? data.stats : {};
  const numberOr = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };
  return {
    ...data,
    nodes,
    edges,
    stats: {
      ...stats,
      bookCount: numberOr(
        stats.bookCount,
        nodes.filter((node) => node.kind === "BOOK").length,
      ),
      themeCount: numberOr(
        stats.themeCount,
        nodes.filter((node) => node.kind === "THEME").length,
      ),
      relationCount: numberOr(stats.relationCount, edges.length),
    },
    smartStatus:
      typeof data?.smartStatus === "string" ? data.smartStatus : "",
    aiEnhanced: Boolean(data?.aiEnhanced),
  };
}

/** 保留后端错误码、重试时间和请求编号，方便页面给出可操作反馈。 */
export class ApiError extends Error {
  code?: string;
  retryAfter?: number;
  requestId?: string;
  constructor(message: string, data: any = {}) {
    super(message);
    this.name = "ApiError";
    this.code = data.code;
    this.retryAfter = Number(data.retryAfter) || undefined;
    this.requestId = data.requestId;
  }
}

export type DailyQuote = { id: string; text: string; author: string; work: string };

/** 统一处理鉴权、JSON 解码、会话失效通知和标准化 API 错误。 */
async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && token) {
    clearPrivateCache(token, "");
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    throw new Error(
      "\u767b\u5f55\u72b6\u6001\u5df2\u5931\u6548\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55",
    );
  }
  if (!data.retryAfter)
    data.retryAfter = Number(response.headers.get("Retry-After")) || undefined;
  if (!response.ok) throw new ApiError(data.message || "服务暂时不可用", data);
  return data;
}

// 合并 React 开发模式下的重复读取，并避免用户短时间往返页面反复消耗服务端额度。
const privateReadCache = new Map<
  string,
  { expires: number; promise: Promise<unknown> }
>();
function cachedPrivateGet<T>(
  path: string,
  token: string,
  ttl = 30000,
): Promise<T> {
  const key = `${token}:${path}`,
    now = Date.now(),
    cached = privateReadCache.get(key);
  if (cached && cached.expires > now) return cached.promise as Promise<T>;
  const promise = request<T>(path, {}, token).catch((error) => {
    privateReadCache.delete(key);
    throw error;
  });
  privateReadCache.set(key, { expires: now + ttl, promise });
  return promise;
}
function clearPrivateCache(token: string, prefix: string) {
  for (const key of privateReadCache.keys())
    if (key.startsWith(`${token}:${prefix}`)) privateReadCache.delete(key);
}
export const clearPrivateSessionCache = (token?: string) => {
  if (token) clearPrivateCache(token, "");
};

export const register = (body: {
  username: string;
  email: string;
  password: string;
  displayName: string;
  invitationCode: string;
}) =>
  request<Session>("/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const login = (body: {
  username: string;
  password: string;
  captchaToken?: string;
}) =>
  request<Session>("/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const createSliderChallenge = (username: string) =>
  request<SliderChallenge>("/auth/captcha/challenge", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
export const verifySliderChallenge = (body: {
  challengeId: string;
  username: string;
  offset: number;
  durationMs: number;
  movementCount: number;
}) =>
  request<{ verificationToken: string; expiresIn: number }>(
    "/auth/captcha/verify",
    { method: "POST", body: JSON.stringify(body) },
  );
export const getDailyQuote = (exclude = "") =>
  request<DailyQuote>(`/public/daily-quote${exclude ? `?exclude=${encodeURIComponent(exclude)}` : ""}`, { cache: "no-store" });
export const getStarMap = async (token: string, query = "") =>
  normalizeStarMap(
    await request<any>(
      `/star-map${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`,
      {},
      token,
    ),
  );
export const syncStarMap = (token: string, books: Array<{ id: string; title: string; author: string; category: string; cover?: string; finished: boolean; lastRead: number; progress?:number; top?:boolean }>) =>
  request<any>("/star-map/sync", { method: "POST", body: JSON.stringify({ books }) }, token).then(normalizeStarMap);
export const analyzeStarThemes = async (token: string) =>
  normalizeStarMap(
    await request<any>("/star-map/analyze-themes", { method: "POST" }, token),
  );
export const hideStarRelation = (token: string, sourceBookId: string, targetBookId: string) =>
  request<any>("/star-map/relations/hide", { method: "POST", body: JSON.stringify({ sourceBookId, targetBookId }) }, token).then(normalizeStarMap);
export const getMe = (token: string) => request<MeProfile>("/me", {}, token);
export const getMeWereadStatus = (token: string) =>
  request<WereadConnection>("/me/weread/status", {}, token);
export const connectMeWeread = (token: string, apiKey: string) =>
  request<WereadConnection>(
    "/me/weread/connect",
    { method: "POST", body: JSON.stringify({ apiKey }) },
    token,
  );
export const disconnectMeWeread = (token: string) =>
  request<void>("/me/weread/connection", { method: "DELETE" }, token);
export const getMeSyncStatus = (token: string) =>
  request<SyncStatus>("/me/sync/status", {}, token);
export const syncMeShelf = (token: string) =>
  request<SyncStatus>("/me/sync/shelf", { method: "POST" }, token);
export const syncMeNotes = (token: string) =>
  request<SyncStatus>("/me/sync/notes", { method: "POST" }, token);
export const syncMeBookmarks = (token: string) =>
  request<SyncStatus>("/me/sync/bookmarks", { method: "POST" }, token);
export const changeMePassword = (
  token: string,
  currentPassword: string,
  newPassword: string,
) =>
  request<{ message: string }>(
    "/me/password",
    { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) },
    token,
  );
export const deleteMeData = (token: string, password: string) =>
  request<void>(
    "/me/data",
    { method: "DELETE", body: JSON.stringify({ password }) },
    token,
  );
export const listAdminUsers = (token: string) =>
  request<{ items: AdminUser[] }>("/admin/users", {}, token);
export const resetAdminUserPassword = (token: string, id: number) =>
  request<{ temporaryPassword: string; message: string }>(
    `/admin/users/${id}/reset-password`,
    { method: "POST" },
    token,
  );
export const disableAdminUser = (token: string, id: number) =>
  request<AdminUser>(`/admin/users/${id}/disable`, { method: "POST" }, token);
export const enableAdminUser = (token: string, id: number) =>
  request<AdminUser>(`/admin/users/${id}/enable`, { method: "POST" }, token);
export const listAdminInvitations = (token: string) =>
  request<{ items: InvitationCode[] }>("/admin/invitations", {}, token);
export const createAdminInvitation = (
  token: string,
  validDays: number | null,
) =>
  request<InvitationCode>(
    "/admin/invitations",
    { method: "POST", body: JSON.stringify({ validDays }) },
    token,
  );
export const disableAdminInvitation = (token: string, id: number) =>
  request<InvitationCode>(
    `/admin/invitations/${id}/disable`,
    { method: "POST" },
    token,
  );
export const connectionStatus = (token: string) =>
  request<{ connected: boolean; keyHint?: string }>(
    "/weread/status",
    {},
    token,
  );
export const connectDashboard = async (token: string, apiKey: string) =>
  mapDashboard(
    await request<any>(
      "/weread/connect",
      { method: "POST", body: JSON.stringify({ apiKey }) },
      token,
    ),
  );
export const loadPrivateDashboard = async (token: string) =>
  mapDashboard(await request<any>("/weread/dashboard", {}, token));
export const lookupBookMetadata = (token: string, bookIds: string[]) =>
  request<{
    items: { bookId: string; wordCount?: number; cover?: string }[];
    pending: number;
    failed: number;
    complete: boolean;
  }>(
    "/weread/book-metadata/lookup",
    { method: "POST", body: JSON.stringify({ bookIds }) },
    token,
  );
export const syncNotes = (token: string, bookId?: string, force = false) =>
  request<any>(
    "/weread/notes/sync",
    { method: "POST", body: JSON.stringify({ bookId, force }) },
    token,
  );
export const getBookNotes = (token: string, bookId: string) =>
  request<{ items: BookNote[]; summary: NoteSummary }>(
    `/books/${encodeURIComponent(bookId)}/notes`,
    {},
    token,
  );
export const getBookNoteSummary = (token: string, bookId: string) =>
  request<NoteSummary>(
    `/books/${encodeURIComponent(bookId)}/note-summary`,
    {},
    token,
  );
export const getBookReading = (token: string, bookId: string) =>
  request<ReadingDetail>(
    `/books/${encodeURIComponent(bookId)}/reading`,
    {},
    token,
  );
export const getReadingReport = (token: string, type: "weekly" | "monthly") =>
  cachedPrivateGet<ReadingReport>(`/reports/${type}`, token);
export const getReportHistory = (token: string, type: "weekly" | "monthly") =>
  cachedPrivateGet<ReadingReport[]>(`/reports/${type}/history`, token);
export const regenerateReport = async (token: string, id: number) => {
  const value = await request<ReadingReport>(
    `/reports/${id}/regenerate`,
    { method: "POST" },
    token,
  );
  clearPrivateCache(token, "/reports/");
  return value;
};
export const getCurrentCapsule = (token: string) =>
  cachedPrivateGet<ReadingCapsule>("/capsules/current", token);
export const saveCapsuleReflection = async (
  token: string,
  id: number,
  content: string,
) => {
  const value = await request<ReadingCapsule>(
    `/capsules/${id}/reflection`,
    { method: "POST", body: JSON.stringify({ content }) },
    token,
  );
  clearPrivateCache(token, "/capsules/");
  return value;
};
export const dismissCapsule = async (token: string, id: number) => {
  const value = await request<void>(
    `/capsules/${id}/dismiss`,
    { method: "POST" },
    token,
  );
  clearPrivateCache(token, "/capsules/");
  return value;
};
export const generateAiInsight = (
  token: string,
  type: AiInsightType,
  payload: any,
) =>
  request<AiInsightResponse>(
    "/ai/reading-insights",
    { method: "POST", body: JSON.stringify({ type, payload }) },
    token,
  );
export const getAiInsightHistory = (token: string, type: AiInsightType) =>
  request<AiInsightResponse[]>(
    `/ai/reading-insights/${type}/history`,
    {},
    token,
  );
export const listMessages = () =>
  request<{ content: BoardMessage[] }>("/messages?size=30");
export const postMessage = (token: string, content: string) =>
  request<BoardMessage>(
    "/messages",
    { method: "POST", body: JSON.stringify({ content }) },
    token,
  );
export const removeMessage = (token: string, id: number) =>
  request<void>(`/messages/${id}`, { method: "DELETE" }, token);

const statCount = (stats: any[], label: string) =>
  Number(
    String(stats?.find((x) => x.stat === label)?.counts || "0").replace(
      /[^0-9]/g,
      "",
    ),
  ) || 0;
const normalizeCoverUrl = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const cover = value.trim();
  if (!cover) return undefined;
  if (cover.startsWith("/api/")) {
    const apiRoot = API_BASE.replace(/\/api\/?$/, "");
    return `${apiRoot}${cover}`;
  }
  return cover.startsWith("//") ? `https:${cover}` : cover;
};
/** 将微信读书网关的松散响应转换为页面使用的稳定领域模型。 */
function mapDashboard(raw: any): DashboardData {
  const shelf = raw.shelf || {},
    overall = raw.overall || {},
    annual = raw.annual || {},
    annualPrevious = raw.annualPrevious || {};
  const books: ShelfBook[] = (shelf.books || []).map((book: any) => ({
    id: String(book.bookId),
    title: book.title || "未命名",
    author: book.author || "佚名",
    category: book.category || "未分类",
    cover: normalizeCoverUrl(book.cover),
    wordCount: Number(book.wordCount) || undefined,
    finished: Number(book.finishReading) === 1,
    lastRead: Number(book.readUpdateTime || 0) * 1000,
    progress: Number(book.readingProgress ?? book.progress) || undefined,
    top: Number(book.isTop) === 1,
    secret: Number(book.secret) === 1,
  }));
  books.push(
    ...(shelf.albums || []).map((item: any) => ({
      id: `album-${item.albumInfo?.albumId}`,
      title: item.albumInfo?.name || "未命名有声书",
      author: item.albumInfo?.authorName || "佚名",
      category: "有声书",
      cover: normalizeCoverUrl(item.albumInfo?.cover),
      finished: Number(item.albumInfo?.finish) === 1,
      lastRead: Number(item.albumInfoExtra?.lectureReadUpdateTime || 0) * 1000,
      top: Number(item.albumInfoExtra?.isTop) === 1,
      secret: Number(item.albumInfoExtra?.secret) === 1,
    })),
  );
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
  const monthly = rollingMonthlySeconds(annualPrevious, annual);
  const top = overall.readLongest?.[0],
    topBook = top?.book || top?.albumInfo;
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
