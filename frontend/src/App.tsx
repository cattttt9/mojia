import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Bookmark,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Feather,
  Highlighter,
  History,
  KeyRound,
  Library,
  Lightbulb,
  LockKeyhole,
  MessageSquare,
  Menu,
  Orbit,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { demoData } from "./mockData";
import { rollingMonthLabels } from "./readingMonths";
import { BookshelfHall } from "./features/bookshelf-hall/BookshelfHall";
import { ReadingUniverseEntry } from "./components/reading-universe/ReadingUniverseEntry";
const StarForceGraph = lazy(() => import("./StarForceGraph").then((module) => ({ default: module.StarForceGraph })));
const ForestInsightCard = lazy(() => import("./components/reading-forest/ForestInsightCard"));
const ImmersiveHome = lazy(() => import("./features/immersive-home/ImmersiveHome"));
import {
  AUTH_EXPIRED_EVENT,
  ApiError,
  changeMePassword,
  clearPrivateSessionCache,
  connectDashboard,
  connectMeWeread,
  connectionStatus,
  createAdminInvitation,
  createSliderChallenge,
  deleteMeData,
  disableAdminInvitation,
  disableAdminUser,
  disconnectMeWeread,
  dismissCapsule,
  enableAdminUser,
  generateAiInsight,
  analyzeStarThemes,
  getAiInsightHistory,
  getBookNotes,
  getBookReading,
  getCurrentCapsule,
  getDailyQuote,
  getMe,
  getMeSyncStatus,
  getMeWereadStatus,
  getReadingReport,
  getReportHistory,
  getStarMap,
  hideStarRelation,
  listAdminInvitations,
  listAdminUsers,
  listMessages,
  loadPrivateDashboard,
  login,
  lookupBookMetadata,
  postMessage,
  regenerateReport,
  register,
  removeMessage,
  resetAdminUserPassword,
  saveCapsuleReflection,
  syncMeBookmarks,
  syncMeNotes,
  syncMeShelf,
  syncNotes,
  syncStarMap,
  verifySliderChallenge,
  type AdminUser,
  type AiInsightResponse,
  type AiInsightType,
  type BoardMessage,
  type DailyQuote,
  type BookNote,
  type InvitationCode,
  type MeProfile,
  type NoteSummary,
  type ReadingCapsule,
  type ReadingDetail,
  type ReadingReport,
  type Session,
  type SliderChallenge,
  type StarEdge,
  type StarMapData,
  type StarNode,
  type SyncStatus,
  type WereadConnection,
} from "./platformApi";
import type { DashboardData, ShelfBook } from "./types";

type View =
  | "home"
  | "overview"
  | "shelf"
  | "insights"
  | "star"
  | "memory"
  | "community"
  | "account"
  | "book";
type Filter = "全部" | "在读" | "已读" | "未开始";
type AiHistoryMap = Partial<Record<AiInsightType, AiInsightResponse[]>>;
type AiLabState = {
  loading: AiInsightType | null;
  active: AiInsightType | null;
  error: string;
  weekly: AiInsightResponse | null;
  diagnosis: AiInsightResponse | null;
  prescription: AiInsightResponse | null;
  history: AiHistoryMap;
  cooldownUntil: number;
  startedAt: number;
};
const initialAiLab: AiLabState = {
  loading: null,
  active: null,
  error: "",
  weekly: null,
  diagnosis: null,
  prescription: null,
  history: {},
  cooldownUntil: 0,
  startedAt: 0,
};
const palette = [
  "#24483f",
  "#9c4b3f",
  "#d1a15d",
  "#355b6c",
  "#75657d",
  "#667b51",
  "#6b4934",
  "#1f3035",
];

const SESSION_KEY = "inkshelf-session";
const REMEMBER_LOGIN_KEY = "inkshelf-remember-login";
const hasStoredSession = () => Boolean(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY));

// 只恢复结构完整的会话；勾选“记住我”时从 localStorage 恢复，否则只读取当前标签页。
const readStoredSession = (): Session | null => {
  try {
    const value = JSON.parse(
      localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || "null",
    );
    if (
      value &&
      typeof value.token === "string" &&
      value.token &&
      typeof value.username === "string"
    )
      return value;
  } catch {}
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  return null;
};

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600),
    minutes = Math.floor((seconds % 3600) / 60);
  return hours
    ? `${hours.toLocaleString()} 小时 ${minutes} 分`
    : `${minutes} 分钟`;
};

/** 应用根组件：统一协调会话、微信读书连接、页面导航和全局弹窗。 */
function App() {
  const [view, setView] = useState<View>("home");
  const [data, setData] = useState<DashboardData>(demoData);
  const [connected, setConnected] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<ShelfBook | null>(null);
  const [session, setSession] = useState<Session | null>(readStoredSession);
  const [sessionVerified, setSessionVerified] = useState(
    () => !hasStoredSession(),
  );
  const [dashboardLoading, setDashboardLoading] = useState(
    () => hasStoredSession(),
  );
  const [aiLab, setAiLab] = useState<AiLabState>(initialAiLab);
  const [starMap, setStarMap] = useState<StarMapData | null>(null);
  const [homeTransitionToken, setHomeTransitionToken] = useState(0);
  const playHomeIntro = useRef(true);
  const settleHomeCopy = useRef(false);
  const starSyncKey = useRef("");

  const clearSession = (showLogin = false) => {
    clearPrivateSessionCache(session?.token);
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setSessionVerified(true);
    setConnected(false);
    setData(demoData);
    setAiLab(initialAiLab);
    setStarMap(null);
    starSyncKey.current = "";
    setSelectedBook(null);
    setConnectOpen(false);
    setDashboardLoading(false);
    setLoading(false);
    setError("");
    setView("home");
    setAuthOpen(showLogin);
  };

  useEffect(() => {
    const expired = () => clearSession(true);
    window.addEventListener(AUTH_EXPIRED_EVENT, expired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, expired);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      setSessionVerified(true);
      setDashboardLoading(false);
      return;
    }
    setDashboardLoading(true);
    connectionStatus(session.token)
      .then(async (status) => {
        if (cancelled) return;
        setSessionVerified(true);
        if (!status.connected) {
          setConnected(false);
          setData(demoData);
          return;
        }
        const dashboard = await loadPrivateDashboard(session.token);
        if (!cancelled) {
          setData(dashboard);
          setConnected(true);
        }
      })
      .catch(() => {
        if (!cancelled) setConnected(false);
      })
      .finally(() => {
        if (!cancelled) setDashboardLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!session || !connected) return;
    const ids = data.books
      .filter(
        (book) => !book.id.startsWith("album-") && book.id !== "mp-collection",
      )
      .map((book) => book.id)
      .slice(0, 120);
    if (!ids.length) return;
    let cancelled = false,
      timer: number | undefined,
      attempt = 0;
    const buffered = new Map<
      string,
      { wordCount?: number; cover?: string }
    >();
    const poll = async () => {
      try {
        const result = await lookupBookMetadata(session.token, ids);
        if (cancelled) return;
        result.items.forEach((item) => buffered.set(item.bookId, item));
        attempt++;
        if (!result.complete && attempt < 20) {
          timer = window.setTimeout(poll, 3000);
          return;
        }
        if (buffered.size)
          setData((current) => ({
            ...current,
            books: current.books.map((book) => {
              const metadata = buffered.get(book.id);
              if (!metadata) return book;
              return {
                ...book,
                wordCount: metadata.wordCount ?? book.wordCount,
                cover: book.cover || metadata.cover,
              };
            }),
          }));
      } catch {}
    };
    poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [session, connected]);

  useEffect(() => {
    if (!session || !connected || !data.books.length) return;
    const key = `${session.username}:${data.books.length}:${Math.max(...data.books.map((book) => book.lastRead || 0))}`;
    if (starSyncKey.current === key) return;
    starSyncKey.current = key;
    syncStarMap(session.token, data.books)
      .then(setStarMap)
      .catch(() => getStarMap(session.token).then(setStarMap).catch(() => {}));
  }, [session, connected, data.books]);

  useEffect(() => {
    if (session && connected) syncNotes(session.token).catch(() => {});
  }, [session, connected]);

  const connect = async (key: string) => {
    setLoading(true);
    setError("");
    try {
      if (!session) {
        setConnectOpen(false);
        setAuthOpen(true);
        return;
      }
      setData(await connectDashboard(session.token, key));
      setConnected(true);
      setHomeTransitionToken((value) => value + 1);
      setConnectOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "连接失败");
    } finally {
      setLoading(false);
    }
  };
  const activeSession = sessionVerified ? session : null;
  const requestPrivateDataAccess = () => {
    if (activeSession) setConnectOpen(true);
    else setAuthOpen(true);
  };
  const openBook = (book: ShelfBook) => {
    if (!activeSession) {
      setAuthOpen(true);
      return;
    }
    if (!connected) {
      setConnectOpen(true);
      return;
    }
    setSelectedBook(book);
    setView("book");
  };
  const navigate = (next: View) => {
    if (next === "home" && view !== "home") {
      playHomeIntro.current = true;
      settleHomeCopy.current = true;
    }
    setView(next);
    if (window.matchMedia("(max-width: 760px)").matches) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  };

  return (
    <div className={`app-shell view-${view}${view === "home" ? " home-experience" : ""}`}>
      <Header
        view={view}
        onView={navigate}
        connected={connected}
        session={activeSession}
        onAccount={() =>
          activeSession ? setView("account") : setAuthOpen(true)
        }
        onConnect={() =>
          activeSession ? setConnectOpen(true) : setAuthOpen(true)
        }
        onLogout={() => clearSession()}
      />
      <main>
        {view !== "home" && !connected && !dashboardLoading && (
          <DemoRibbon
            onConnect={() =>
              activeSession ? setConnectOpen(true) : setAuthOpen(true)
            }
          />
        )}
        {view === "home" ? (
          <Suspense fallback={<div className="universe-loading" aria-hidden="true" />}>
            <ImmersiveHome
              books={data.books}
              session={activeSession}
              connected={connected}
              loading={dashboardLoading}
              playIntro={playHomeIntro.current}
              settleCopy={settleHomeCopy.current}
              personalTransitionToken={homeTransitionToken}
              onOpenBook={openBook}
              onLogin={() => setAuthOpen(true)}
              onConnect={() =>
                activeSession ? setConnectOpen(true) : setAuthOpen(true)
              }
              onOverview={() => setView("overview")}
            />
          </Suspense>
        ) : dashboardLoading ? (
          <LibraryLoading />
        ) : (
          <>
            {view === "overview" && (
              <ReadingOverview
                data={data}
                onView={setView}
                onOpenBook={openBook}
                session={activeSession}
                connected={connected}
                starMap={starMap}
              />
            )}{" "}
            {view === "shelf" && (
              <Shelf
                books={data.books}
                session={activeSession}
                connected={connected}
                onAccess={requestPrivateDataAccess}
                onOpenBook={openBook}
              />
            )}{" "}
            {view === "insights" && (
              <>
                <Insights data={data} />
                <AiInsightLab
                  data={data}
                  session={activeSession}
                  connected={connected}
                  onAccess={requestPrivateDataAccess}
                  aiLab={aiLab}
                  setAiLab={setAiLab}
                />
              </>
            )}{" "}
            {view === "star" && (
              <ReadingStarMap
                session={activeSession}
                connected={connected}
                graph={starMap}
                onGraph={setStarMap}
                onAccess={requestPrivateDataAccess}
                onOpenBook={(bookId) => {
                  const book = data.books.find((item) => item.id === bookId);
                  if (book) openBook(book);
                }}
              />
            )}{" "}
            {view === "memory" && (
              <ReadingMemory
                session={activeSession}
                connected={connected}
                onAccess={requestPrivateDataAccess}
              />
            )}{" "}
            {view === "community" && (
              <Community
                session={activeSession}
                onLogin={() => setAuthOpen(true)}
              />
            )}{" "}
            {view === "account" && activeSession && (
              <UserCenter
                session={activeSession}
                connected={connected}
                onLogin={() => setAuthOpen(true)}
                onConnect={() => setConnectOpen(true)}
                onLogout={() => clearSession()}
              />
            )}{" "}
            {view === "book" && selectedBook && activeSession && (
              <BookDetail
                book={selectedBook}
                token={activeSession.token}
                onBack={() => setView("shelf")}
              />
            )}
          </>
        )}
      </main>
      <AiGlobalStatus
        aiLab={aiLab}
        onOpen={() => setView("insights")}
        hidden={view === "insights" || view === "home"}
      />
      {view !== "star" && view !== "home" && <footer>
        <span>
          <Feather size={14} /> 墨架 InkShelf
        </span>
        <span>你的数据，只为你展开。</span>
      </footer>}

      {connectOpen && (
        <ConnectModal
          loading={loading}
          error={error}
          onClose={() => setConnectOpen(false)}
          onConnect={connect}
        />
      )}
      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onAuthenticated={(s, remember) => {
            const target = remember ? localStorage : sessionStorage;
            const other = remember ? sessionStorage : localStorage;
            target.setItem(SESSION_KEY, JSON.stringify(s));
            other.removeItem(SESSION_KEY);
            localStorage.setItem(REMEMBER_LOGIN_KEY, remember ? "true" : "false");
            setSessionVerified(true);
            setDashboardLoading(true);
            setHomeTransitionToken((value) => value + 1);
            setSession(s);
            setAuthOpen(false);
          }}
        />
      )}
    </div>
  );
}

function LibraryLoading() {
  return (
    <div className="library-loading wrap">
      <span>
        <BookOpen />
      </span>
      <p className="eyebrow">OPENING YOUR LIBRARY</p>
      <h2>正在展开你的书架…</h2>
      <div>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
      </div>
    </div>
  );
}

function Header({
  view,
  onView,
  connected,
  session,
  onConnect,
  onAccount,
  onLogout,
}: {
  view: View;
  onView: (v: View) => void;
  connected: boolean;
  session: Session | null;
  onConnect: () => void;
  onAccount: () => void;
  onLogout: () => void;
}) {
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const navigation = [
    ["home", "首页"],
    ["overview", "书房"],
    ["shelf", "书架"],
    ["insights", "洞察"],
    ["star", "星图"],
    ["memory", "记忆"],
    ["community", "留言"],
    ["account", "用户中心"],
  ] as const;
  const mobileNavigation = [
    ["home", "首页", <Feather key="home" />],
    ["overview", "书房", <BookOpen key="overview" />],
    ["shelf", "书架", <Library key="shelf" />],
    ["insights", "洞察", <Sparkles key="insights" />],
    ["star", "星图", <Orbit key="star" />],
  ] as const;
  const secondaryNavigation = [
    ["memory", "阅读记忆", <History key="memory" />],
    ["community", "留言板", <MessageSquare key="community" />],
    ["account", "用户中心", <UserRound key="account" />],
  ] as const;
  const secondaryActive = ["memory", "community", "account"].includes(view);
  const openSecondary = (id: "memory" | "community" | "account") => {
    setMobileMoreOpen(false);
    if (id === "account") onAccount();
    else onView(id);
  };
  return (
    <>
      <header className="topbar">
        <button className="brand" onClick={() => onView("home")}>
          <span className="brand-mark">
            <Feather />
          </span>
          <span>
            <b>墨架</b>
            <small>INKSHELF</small>
          </span>
        </button>
        <nav>
          {navigation.map(([id, label]) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => (id === "account" ? onAccount() : onView(id))}
            >
              {label === "书架"
                ? "我的书架"
                : label === "书房"
                  ? "书房概览"
                : label === "洞察"
                  ? "阅读洞察"
                  : label === "星图"
                    ? "阅读星图"
                  : label === "记忆"
                    ? "阅读记忆"
                    : label === "留言"
                      ? "留言板"
                      : label}
            </button>
          ))}
        </nav>
        {!session ? (
          <button className="status" onClick={onAccount}>
            <UserRound size={15} /> 登录 / 注册
          </button>
        ) : (
          <div className="header-actions">
            <button
              className={connected ? "status connected" : "status"}
              onClick={connected ? onAccount : onConnect}
            >
              {connected ? (
                <>
                  <Check size={15} /> {session.displayName}
                </>
              ) : (
                <>
                  <KeyRound size={15} /> 导入我的数据
                </>
              )}
            </button>
            <button className="logout" onClick={onLogout}>
              退出
            </button>
          </div>
        )}
      </header>
      <nav className="mobile-nav" aria-label="移动端导航">
        {mobileNavigation.map(([id, label, icon]) => (
          <button
            key={id}
            className={view === id ? "active" : ""}
            onClick={() => onView(id)}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
        <button
          type="button"
          className={secondaryActive || mobileMoreOpen ? "active" : ""}
          aria-expanded={mobileMoreOpen}
          aria-controls="mobile-more-menu"
          onClick={() => setMobileMoreOpen((value) => !value)}
        >
          <Menu />
          <span>更多</span>
        </button>
      </nav>
      {mobileMoreOpen && (
        <>
          <button
            type="button"
            className="mobile-more-backdrop"
            aria-label="关闭更多导航"
            onClick={() => setMobileMoreOpen(false)}
          />
          <aside id="mobile-more-menu" className="mobile-more-sheet" aria-label="更多页面">
            <header>
              <div>
                <p className="eyebrow">MORE FROM INKSHELF</p>
                <h2>继续探索</h2>
              </div>
              <button type="button" onClick={() => setMobileMoreOpen(false)} aria-label="关闭">
                <X />
              </button>
            </header>
            <div>
              {secondaryNavigation.map(([id, label, icon]) => (
                <button
                  type="button"
                  key={id}
                  className={view === id ? "active" : ""}
                  onClick={() => openSecondary(id)}
                >
                  <span>{icon}</span>
                  <b>{label}</b>
                  <ChevronRight />
                </button>
              ))}
            </div>
          </aside>
        </>
      )}
    </>
  );
}

function DemoRibbon({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="demo-ribbon">
      <span>
        <Sparkles size={15} /> 当前为故事样本
      </span>
      <button onClick={onConnect}>
        连接我的微信读书 <ArrowRight size={14} />
      </button>
    </div>
  );
}

/** 用户中心集中承载账号安全、数据同步、连接管理和管理员入口。 */
function UserCenter({
  session,
  connected,
  onLogin,
  onConnect,
  onLogout,
}: {
  session: Session | null;
  connected: boolean;
  onLogin: () => void;
  onConnect: () => void;
  onLogout: () => void;
}) {
  const [profile, setProfile] = useState<MeProfile | null>(null),
    [weread, setWeread] = useState<WereadConnection | null>(null),
    [sync, setSync] = useState<SyncStatus | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]),
    [loading, setLoading] = useState(false),
    [notice, setNotice] = useState(""),
    [apiKey, setApiKey] = useState(""),
    [currentPassword, setCurrentPassword] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [deletePassword, setDeletePassword] = useState(""),
    [temporaryPassword, setTemporaryPassword] = useState(""),
    [confirmDialog, setConfirmDialog] = useState<{
      title: string;
      message: string;
      danger?: boolean;
      confirmText?: string;
      onConfirm: () => void;
    } | null>(null);
  const token = session?.token;
  const load = async () => {
    if (!token) return;
    setLoading(true);
    setNotice("");
    try {
      const [me, w, s] = await Promise.all([
        getMe(token),
        getMeWereadStatus(token),
        getMeSyncStatus(token),
      ]);
      setProfile(me);
      setWeread(w);
      setSync(s);
      if (me.role === "ADMIN")
        setAdminUsers((await listAdminUsers(token)).items);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "用户中心暂时不可用");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [token]);
  if (!session)
    return (
      <div className="wrap page account-page account-locked">
        <span>
          <UserRound />
        </span>
        <p className="eyebrow">USER CENTER</p>
        <h1>登录后管理你的账号</h1>
        <p>用户中心会展示微信读书连接、安全设置和同步状态。</p>
        <button className="primary" onClick={onLogin}>
          登录 / 注册 <ArrowRight />
        </button>
      </div>
    );
  const syncRun = async (action: "shelf" | "note" | "bookmark") => {
    if (!token) return;
    setLoading(true);
    setNotice("");
    try {
      const next =
        action === "shelf"
          ? await syncMeShelf(token)
          : action === "note"
            ? await syncMeNotes(token)
            : await syncMeBookmarks(token);
      setSync(next);
      setNotice("同步任务已完成");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "同步失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };
  const connectKey = async () => {
    if (!token || !apiKey.trim()) return;
    setLoading(true);
    setNotice("");
    try {
      setWeread(await connectMeWeread(token, apiKey.trim()));
      setApiKey("");
      setNotice("API Key 已安全保存");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "连接失败，请检查 API Key");
    } finally {
      setLoading(false);
    }
  };
  const disconnect = async () => {
    if (!token || !confirm("确定解除微信读书绑定吗？")) return;
    await disconnectMeWeread(token);
    await load();
    setNotice("已解除绑定");
  };
  const changePassword = async () => {
    if (!token) return;
    if (newPassword !== confirmPassword) {
      setNotice("两次输入的新密码不一致");
      return;
    }
    setLoading(true);
    try {
      await changeMePassword(token, currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice("密码修改成功");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "密码修改失败");
    } finally {
      setLoading(false);
    }
  };
  const deleteData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await deleteMeData(token, deletePassword);
      onLogout();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "数据删除失败");
    } finally {
      setLoading(false);
    }
  };
  const adminAction = async (
    kind: "disable" | "enable" | "reset",
    user: AdminUser,
  ) => {
    if (!token) return;
    setLoading(true);
    setTemporaryPassword("");
    try {
      if (kind === "reset") {
        const r = await resetAdminUserPassword(token, user.id);
        setTemporaryPassword(`${user.username} 临时密码：${r.temporaryPassword}`);
      } else
        await (kind === "disable" ? disableAdminUser : enableAdminUser)(
          token,
          user.id,
        );
      setAdminUsers((await listAdminUsers(token)).items);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "管理员操作失败");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="wrap page account-page">
      <div className="page-title split">
        <div>
          <p className="eyebrow">USER CENTER</p>
          <h1>用户中心</h1>
          <p>账号、微信读书连接、同步状态和隐私设置都集中在这里。</p>
        </div>
        <div className="private-stamp">
          <LockKeyhole /> 你的数据，只为你展开
        </div>
      </div>
      {notice && <div className="board-notice">{notice}</div>}
      {temporaryPassword && (
        <div className="board-notice">{temporaryPassword}</div>
      )}
      <section className="account-grid">
        <article className="account-card">
          <p className="eyebrow">ACCOUNT</p>
          <h2>{profile?.displayName || session.displayName}</h2>
          <p>当前账号：{profile?.email || session.email || session.username}</p>
          <p>
            角色：{profile?.role || session.role || "USER"} · 状态：
            {profile?.status || session.status || "NORMAL"}
          </p>
          <p>最近登录：{dateText(profile?.lastLoginAt)}</p>
          <p>注册时间：{dateText(profile?.createdAt)}</p>
        </article>
        <article className="account-card">
          <p className="eyebrow">WEREAD CONNECTION</p>
          <h2>{weread?.connected ? "微信读书已连接" : "尚未连接微信读书"}</h2>
          <p>
            API Key：
            {weread?.connected
              ? `已安全保存，末尾 ${weread.apiKeyMasked}`
              : "未保存"}
          </p>
          <p>上次同步：{dateText(weread?.lastSyncAt)}</p>
          <p>
            最近结果：{statusText(weread?.lastSyncStatus)}
            {weread?.lastSyncError ? ` · ${weread.lastSyncError}` : ""}
          </p>
          <div className="key-mini">
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type="password"
              placeholder="重新导入 API Key：wrk-..."
            />
            <button
              className="primary"
              disabled={loading || !apiKey.startsWith("wrk-")}
              onClick={connectKey}
            >
              安全保存
            </button>
          </div>
          <div className="account-actions">
            <button onClick={onConnect}>打开导入弹窗</button>
            <button onClick={disconnect} disabled={!weread?.connected}>
              解除绑定
            </button>
          </div>
        </article>
        <article className="account-card help-card">
          <p className="eyebrow">API KEY GUIDE</p>
          <h2>API Key 使用说明</h2>
          <ol>
            <li>请在微信读书相关设置中获取 API Key。</li>
            <li>API Key 只用于同步你的个人书架、阅读统计、笔记和划线。</li>
            <li>服务端会加密保存，不会明文存储。</li>
            <li>你可以随时解除绑定并删除相关数据。</li>
            <li>系统日志不会记录 API Key 或 Authorization Header。</li>
          </ol>
        </article>
      </section>
      <section className="account-card sync-center">
        <div className="split">
          <div>
            <p className="eyebrow">DATA SYNC</p>
            <h2>数据同步</h2>
          </div>
          {loading && (
            <span className="syncing">
              <RefreshCw className="spin" /> 正在处理
            </span>
          )}
        </div>
        <div className="sync-items">
          <SyncRow
            title="书架"
            item={sync?.shelf}
            action="重新同步书架"
            onClick={() => syncRun("shelf")}
          />
          <SyncRow
            title="笔记"
            item={sync?.note}
            action="重新同步笔记"
            onClick={() => syncRun("note")}
          />
          <SyncRow
            title="划线 / 书签"
            item={sync?.bookmark}
            action="重新同步划线"
            onClick={() => syncRun("bookmark")}
          />
        </div>
      </section>
      <section className="account-grid">
        <article className="account-card">
          <p className="eyebrow">SECURITY</p>
          <h2>{"\u4fee\u6539\u5bc6\u7801"}</h2>
          <label className="form-field">
            <span>{"\u5f53\u524d\u5bc6\u7801"}</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>{"\u65b0\u5bc6\u7801"}</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="\u81f3\u5c11 8 \u4f4d"
            />
          </label>
          <label className="form-field">
            <span>{"\u786e\u8ba4\u65b0\u5bc6\u7801"}</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="\u518d\u6b21\u8f93\u5165\u65b0\u5bc6\u7801"
            />
          </label>
          {newPassword &&
            confirmPassword &&
            newPassword !== confirmPassword && (
              <small className="field-warning">
                {
                  "\u4e24\u6b21\u8f93\u5165\u7684\u65b0\u5bc6\u7801\u4e0d\u4e00\u81f4"
                }
              </small>
            )}
          <button
            className="primary"
            disabled={
              loading ||
              !currentPassword ||
              newPassword.length < 8 ||
              newPassword !== confirmPassword
            }
            onClick={changePassword}
          >
            {"\u66f4\u65b0\u5bc6\u7801"}
          </button>
        </article>
        <article className="account-card danger-card">
          <p className="eyebrow">PRIVACY</p>
          <h2>{"\u5b89\u5168\u4e0e\u9690\u79c1"}</h2>
          <p>
            {
              "\u5220\u9664\u5168\u90e8\u6570\u636e\u4f1a\u79fb\u9664\u8d26\u53f7\u8d44\u6599\u3001\u5fae\u4fe1\u8bfb\u4e66 API Key\u3001\u4e66\u67b6\u3001\u7b14\u8bb0\u4e0e\u5212\u7ebf\u3001\u5468\u62a5/\u6708\u62a5\u3001AI \u751f\u6210\u5185\u5bb9\u548c\u9605\u8bfb\u5904\u65b9\u8bb0\u5f55\u3002"
            }
          </p>
          <input
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder="\u8f93\u5165\u5bc6\u7801\u786e\u8ba4\u5220\u9664"
          />
          <div className="account-actions">
            <button onClick={onLogout}>{"\u9000\u51fa\u767b\u5f55"}</button>
            <button
              className="danger"
              disabled={loading || !deletePassword}
              onClick={() =>
                setConfirmDialog({
                  title: "\u5220\u9664\u6211\u7684\u5168\u90e8\u6570\u636e",
                  message:
                    "\u8fd9\u4f1a\u5220\u9664\u8d26\u53f7\u8d44\u6599\u3001\u5fae\u4fe1\u8bfb\u4e66\u51ed\u636e\u3001\u4e66\u67b6\u3001\u7b14\u8bb0\u4e0e\u5212\u7ebf\u3001\u62a5\u544a\u548c AI \u8bb0\u5f55\u3002\u6b64\u64cd\u4f5c\u4e0d\u53ef\u6062\u590d\u3002",
                  danger: true,
                  confirmText: "\u786e\u8ba4\u5220\u9664",
                  onConfirm: deleteData,
                })
              }
            >
              {"\u5220\u9664\u6211\u7684\u5168\u90e8\u6570\u636e"}
            </button>
          </div>
        </article>
      </section>
      {profile?.role === "ADMIN" && (
        <section className="account-card admin-panel">
          <p className="eyebrow">ADMIN</p>
          <h2>{"\u7ba1\u7406\u5458\u540e\u53f0"}</h2>
          <div className="admin-table">
            {adminUsers.map((user) => {
              const isSelf = user.username === session.username;
              return (
                <article key={user.id}>
                  <div>
                    <b>{user.displayName}</b>
                    <span>
                      @{user.username} ? {user.email}
                    </span>
                    <small>
                      {user.online ? "\u5728\u7ebf" : "\u79bb\u7ebf"} ?{" "}
                      {user.status} ? {"\u5fae\u4fe1\u8bfb\u4e66"}
                      {user.wereadConnected
                        ? "\u5df2\u7ed1\u5b9a"
                        : "\u672a\u7ed1\u5b9a"}{" "}
                      ? {"\u4e0a\u6b21\u540c\u6b65"}{" "}
                      {dateText(user.wereadLastSyncAt)}
                    </small>
                  </div>
                  <div>
                    <button
                      disabled={isSelf}
                      title={
                        isSelf
                          ? "\u7ba1\u7406\u5458\u4e0d\u80fd\u91cd\u7f6e\u81ea\u5df1\u7684\u5bc6\u7801\uff0c\u8bf7\u4f7f\u7528\u4fee\u6539\u5bc6\u7801"
                          : "\u91cd\u7f6e\u4e3a\u4e00\u6b21\u6027\u4e34\u65f6\u5bc6\u7801"
                      }
                      onClick={() =>
                        setConfirmDialog({
                          title: "\u91cd\u7f6e\u7528\u6237\u5bc6\u7801",
                          message: `\u786e\u5b9a\u8981\u4e3a ${user.displayName}\uff08@${user.username}\uff09\u751f\u6210\u4e34\u65f6\u5bc6\u7801\u5417\uff1f\u65e7\u5bc6\u7801\u4f1a\u7acb\u5373\u5931\u6548\u3002`,
                          confirmText: "\u786e\u8ba4\u91cd\u7f6e",
                          onConfirm: () => adminAction("reset", user),
                        })
                      }
                    >
                      {"\u91cd\u7f6e\u5bc6\u7801"}
                    </button>
                    {user.status === "DISABLED" ? (
                      <button onClick={() => adminAction("enable", user)}>
                        {"\u542f\u7528"}
                      </button>
                    ) : (
                      <button onClick={() => adminAction("disable", user)}>
                        {"\u7981\u7528"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
      {profile?.role === "ADMIN" && token && <InvitationAdmin token={token} />}
      {confirmDialog && (
        <ConfirmDialog
          {...confirmDialog}
          loading={loading}
          onClose={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
/** 管理员邀请码面板；邀请码明文只在创建成功后的当前响应中展示。 */
function InvitationAdmin({ token }: { token: string }) {
  const [items, setItems] = useState<InvitationCode[]>([]),
    [validDays, setValidDays] = useState("30"),
    [generated, setGenerated] = useState<InvitationCode | null>(null),
    [loading, setLoading] = useState(false),
    [notice, setNotice] = useState("");
  const load = async () => {
    try {
      setItems((await listAdminInvitations(token)).items);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "邀请码列表暂时无法读取");
    }
  };
  useEffect(() => {
    load();
  }, [token]);
  const create = async () => {
    setLoading(true);
    setNotice("");
    try {
      const value = await createAdminInvitation(
        token,
        validDays === "permanent" ? null : Number(validDays),
      );
      setGenerated(value);
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "邀请码生成失败");
    } finally {
      setLoading(false);
    }
  };
  const disable = async (item: InvitationCode) => {
    if (!confirm(`确定禁用邀请码 ${item.codeMasked} 吗？`)) return;
    setLoading(true);
    try {
      await disableAdminInvitation(token, item.id);
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "邀请码禁用失败");
    } finally {
      setLoading(false);
    }
  };
  return (
    <section className="account-card invitation-panel">
      <div className="split">
        <div>
          <p className="eyebrow">INVITATION ACCESS</p>
          <h2>注册邀请码</h2>
          <p>完整邀请码只在生成后显示一次。平台仅保存摘要，无法恢复原文。</p>
        </div>
        <div className="invitation-create">
          <select
            value={validDays}
            onChange={(e) => setValidDays(e.target.value)}
          >
            <option value="7">有效 7 天</option>
            <option value="30">有效 30 天</option>
            <option value="90">有效 90 天</option>
            <option value="permanent">永久有效</option>
          </select>
          <button className="primary" disabled={loading} onClick={create}>
            {loading ? "正在生成…" : "生成邀请码"}
          </button>
        </div>
      </div>
      {notice && <div className="board-notice">{notice}</div>}
      {generated?.code && (
        <div className="invitation-reveal">
          <span>请立即线下保存并发送给目标用户</span>
          <strong>{generated.code}</strong>
          <small>关闭或刷新页面后，只能看到脱敏值 {generated.codeMasked}</small>
        </div>
      )}
      <div className="invitation-list">
        {items.length ? (
          items.map((item) => (
            <article key={item.id}>
              <div>
                <b>{item.codeMasked}</b>
                <span className={`invite-status ${item.status.toLowerCase()}`}>
                  {invitationStatus(item.status)}
                </span>
              </div>
              <p>
                创建：{dateText(item.createdAt)} · 创建人：
                {item.createdBy || "已删除账号"}
              </p>
              <p>
                有效期：{item.expiresAt ? dateText(item.expiresAt) : "永久"}
                {item.usedBy ? ` · 使用人：@${item.usedBy}` : ""}
                {item.disabledBy ? ` · 禁用人：@${item.disabledBy}` : ""}
              </p>
              {item.usedAt && (
                <small>
                  注册时间：{dateText(item.usedAt)} · 注册 IP：
                  {item.registrationIp || "未记录"} · Request ID：
                  {item.requestId || "未记录"}
                </small>
              )}
              {item.status === "UNUSED" && (
                <button disabled={loading} onClick={() => disable(item)}>
                  禁用
                </button>
              )}
            </article>
          ))
        ) : (
          <p className="empty-invitations">尚未生成邀请码。</p>
        )}
      </div>
    </section>
  );
}
function invitationStatus(status: InvitationCode["status"]) {
  return status === "UNUSED"
    ? "未使用"
    : status === "USED"
      ? "已使用"
      : status === "EXPIRED"
        ? "已过期"
        : "已禁用";
}
function SyncRow({
  title,
  item,
  action,
  onClick,
}: {
  title: string;
  item?: { status: string; lastSyncAt?: string; count: number; error?: string };
  action: string;
  onClick: () => void;
}) {
  return (
    <article>
      <div>
        <b>{title}</b>
        <span>
          {statusText(item?.status)} · 已同步 {item?.count || 0} 条/本
        </span>
        <small>
          上次同步：{dateText(item?.lastSyncAt)}
          {item?.error ? ` · ${item.error}` : ""}
        </small>
      </div>
      <button onClick={onClick}>{action}</button>
    </article>
  );
}
function ConfirmDialog({
  title,
  message,
  danger,
  confirmText,
  loading,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  danger?: boolean;
  confirmText?: string;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const confirm = async () => {
    await onConfirm();
    onClose();
  };
  return (
    <div
      className="modal-backdrop confirm-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="confirm-dialog">
        <button className="modal-x" onClick={onClose}>
          <X />
        </button>
        <span className={danger ? "modal-icon danger" : "modal-icon"}>
          {danger ? <Trash2 /> : <KeyRound />}
        </span>
        <p className="eyebrow">
          {danger ? "DANGER CONFIRM" : "CONFIRM ACTION"}
        </p>
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="confirm-actions">
          <button onClick={onClose}>取消</button>
          <button
            className={danger ? "danger" : "primary"}
            disabled={loading}
            onClick={confirm}
          >
            {loading ? "处理中..." : confirmText || "确认"}
          </button>
        </div>
      </div>
    </div>
  );
}
function statusText(status?: string) {
  return status === "SUCCESS"
    ? "同步成功"
    : status === "SYNCING" || status === "RUNNING"
      ? "同步中"
      : status === "FAILED"
        ? "同步失败"
        : status === "WAITING"
          ? "等待重试"
          : "未同步";
}
function dateText(value?: string) {
  return value ? new Date(value).toLocaleString("zh-CN") : "暂无记录";
}

/** 书房概览将统计数据、最近阅读和记忆入口组合成故事化档案视图。 */
function ReadingOverview({
  data,
  onView,
  onOpenBook,
  session,
  connected,
  starMap,
}: {
  data: DashboardData;
  onView: (v: View) => void;
  onOpenBook: (book: ShelfBook) => void;
  session: Session | null;
  connected: boolean;
  starMap: StarMapData | null;
}) {
  const recent = [...data.books]
    .filter((b) => b.lastRead)
    .sort((a, b) => b.lastRead - a.lastRead)
    .slice(0, 10);
  return (
    <>
      <section className="hero wrap">
        <div className="hero-copy">
          <p className="eyebrow">YOUR READING, BEAUTIFULLY KEPT</p>
          <h1>
            每一本读过的书，
            <br />
            <em>都在这里留下纹理。</em>
          </h1>
          <p className="lead">
            把散落在微信读书里的时光，收拢成一座可以漫步的私人书房。
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={() => onView("shelf")}>
              走进我的书架 <ArrowRight />
            </button>
            <button className="text-btn" onClick={() => onView("insights")}>
              看看阅读足迹
            </button>
          </div>
        </div>
        <div className="hero-still">
          <div className="reading-card">
            <span>正在读</span>
            <b>{recent[0]?.title || "尚未开始"}</b>
            <small>{recent[0]?.author}</small>
            <div>
              <i style={{ width: "68%" }}></i>
            </div>
            <small>在文字里，慢一点也没关系。</small>
          </div>
        </div>
      </section>
      <section className="stats-band">
        <div className="wrap stat-grid">
          <Metric
            value={data.books.length}
            label="书架藏书"
            icon={<Library />}
          />
          <Metric
            value={data.stats.finishedBooks}
            label="已经读完"
            icon={<BookOpen />}
          />
          <Metric
            value={formatDuration(data.stats.totalReadTime)}
            label="共读时光"
            icon={<Clock3 />}
          />
          <Metric
            value={data.stats.readDays}
            label="阅读日子"
            icon={<BarChart3 />}
          />
        </div>
      </section>
      <HomeMemory
        session={session}
        connected={connected}
        onOpen={() => onView("memory")}
      />
      <ReadingUniverseEntry graph={starMap} onOpen={() => onView("star")} />
      <section className="wrap section">
        <SectionHead
          kicker="RECENTLY READ"
          title="最近翻开的几页"
          action="查看整面书墙"
          onClick={() => onView("shelf")}
        />
        <RecentMasonry
          books={recent}
          onOpenBook={onOpenBook}
          emptyText={
            data.books.length === 0
              ? "当前书架还没有书哦～快去阅读吧。"
              : "最近还没有翻开过书，去书架挑一本开始吧。"
          }
        />
      </section>
      <Suspense fallback={<section className="wrap reading-forest-skeleton" aria-label="阅读森林加载中" />}>
        <ForestInsightCard
          source={{
            monthlySeconds: data.stats.monthlySeconds,
            books: data.books,
            totalBooks: data.stats.readBooks,
            totalNotes: data.stats.notes,
          }}
          onOpenReport={() => onView("insights")}
        />
      </Suspense>
    </>
  );
}

function Metric({
  value,
  label,
  icon,
}: {
  value: string | number;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="metric">
      <span>{icon}</span>
      <strong>
        {typeof value === "number" ? value.toLocaleString() : value}
      </strong>
      <small>{label}</small>
    </div>
  );
}
function SectionHead({
  kicker,
  title,
  action,
  onClick,
}: {
  kicker: string;
  title: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="section-head">
      <div>
        <p className="eyebrow">{kicker}</p>
        <h2>{title}</h2>
      </div>
      <button className="text-btn" onClick={onClick}>
        {action} <ArrowRight />
      </button>
    </div>
  );
}
function RecentMasonry({
  books,
  onOpenBook,
  emptyText,
}: {
  books: ShelfBook[];
  onOpenBook: (book: ShelfBook) => void;
  emptyText: string;
}) {
  if (books.length === 0) {
    return (
      <div className="recent-empty" data-testid="recent-books-empty">
        <span><BookOpen /></span>
        <p>{emptyText}</p>
        <small>等下一本书来到这里，它会留下第一道阅读的纹理。</small>
      </div>
    );
  }
  return (
    <div className="recent-masonry" data-testid="recent-books">
      {books.map((book, index) => (
        <RecentBook
          key={book.id}
          book={book}
          index={index}
          onOpen={() => onOpenBook(book)}
        />
      ))}
    </div>
  );
}
function RecentBook({
  book,
  index,
  onOpen,
}: {
  book: ShelfBook;
  index: number;
  onOpen: () => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <article
      className="recent-book"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen();
      }}
    >
      <div
        className="cover"
        style={{ background: palette[index % palette.length] }}
      >
        {book.cover && !failed ? (
          <img
            src={book.cover}
            alt={`${book.title}封面`}
            loading="lazy"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="cover-fallback">
            <small>{book.author}</small>
            <b>{book.title}</b>
            <i>墨架藏书</i>
          </div>
        )}
      </div>
      <div>
        <span>{book.category}</span>
        <h3 title={book.title}>{book.title}</h3>
        <p>{book.author}</p>
      </div>
    </article>
  );
}

function HomeMemory({
  session,
  connected,
  onOpen,
}: {
  session: Session | null;
  connected: boolean;
  onOpen: () => void;
}) {
  const [capsule, setCapsule] = useState<ReadingCapsule | null>(null);
  useEffect(() => {
    if (session && connected)
      getCurrentCapsule(session.token)
        .then(setCapsule)
        .catch(() => {});
  }, [session, connected]);
  if (!session || !connected || !capsule?.available) return null;
  return (
    <section className="wrap home-memory">
      <div>
        <span>
          <History />
        </span>
        <p className="eyebrow">ONE MONTH AGO</p>
        <h2>一个月前的今天</h2>
        <p>
          {capsule.content?.message}{" "}
          {capsule.content?.title && <b>《{capsule.content.title}》</b>}
        </p>
      </div>
      <button className="text-btn" onClick={onOpen}>
        打开时间胶囊 <ArrowRight />
      </button>
    </section>
  );
}

function ReadingStarMap({ session, connected, graph, onGraph, onAccess, onOpenBook }: { session: Session | null; connected: boolean; graph: StarMapData | null; onGraph: (graph: StarMapData) => void; onAccess: () => void; onOpenBook: (bookId: string) => void }) {
  const [selectedNode, setSelectedNode] = useState<StarNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<StarEdge | null>(null);
  const [enabled, setEnabled] = useState(() => new Set(["同一作者", "同一分类", "同期阅读", "主题相近", "AI主题", "分类主题"]));
  const [smartLoading, setSmartLoading] = useState(false), [notice, setNotice] = useState("");
  const [starCooldownUntil, setStarCooldownUntil] = useState(0), [starClock, setStarClock] = useState(Date.now());
  const [searchInput,setSearchInput]=useState(""),[searching,setSearching]=useState(false);
  const [filterOpen,setFilterOpen]=useState(
    () => !window.matchMedia("(max-width: 720px)").matches,
  ),[detailOpen,setDetailOpen]=useState(false),[showHighlights,setShowHighlights]=useState(true);
  const [forceActive,setForceActive]=useState(false),[draggedLabel,setDraggedLabel]=useState("");
  const searchInputRef=useRef("");
  const starCooldownLeft = Math.max(0, Math.ceil((starCooldownUntil - starClock) / 1000));
  useEffect(()=>{searchInputRef.current=searchInput},[searchInput]);
  useEffect(() => {
    if (!starCooldownLeft) return;
    const timer = window.setInterval(() => setStarClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [starCooldownLeft]);
  const token = session?.token;
  useEffect(() => { if (token && connected && !graph) getStarMap(token).then(onGraph).catch(() => {}); }, [token, connected]);
  if (!session || !connected) {
    const needsLogin = !session;
    return <div className="wrap page star-locked"><span><Orbit/></span><p className="eyebrow">PRIVATE READING UNIVERSE</p><h1>{needsLogin ? "登录后展开你的阅读星图" : "导入数据后展开你的阅读星图"}</h1><p>{needsLogin ? "星图只使用你自己的书架、分类和阅读记录，不会公开给其他用户。" : "你的账号已登录。导入微信读书数据后，墨架会用你的书架、分类和阅读记录生成私人星图。"}</p><button className="primary" onClick={onAccess}>{needsLogin ? "登录 / 注册" : "导入我的数据"} <ArrowRight/></button></div>;
  }
  if (!graph) return <LibraryLoading/>;
  const graphStats = graph.stats || {
    bookCount: graph.nodes.filter(node => node.kind === "BOOK").length,
    themeCount: graph.nodes.filter(node => node.kind === "THEME").length,
    relationCount: graph.edges.length,
  };
  const relationEdges = graph.edges.filter(edge => edge.types.some(type => enabled.has(type)));
  const visibleIds = new Set<string>(); relationEdges.forEach(edge => { visibleIds.add(edge.source); visibleIds.add(edge.target); });
  const nodes = graph.nodes.filter(node => visibleIds.has(node.id));
  const toggle=(type:string)=>setEnabled(current=>{const next=new Set(current);next.has(type)?next.delete(type):next.add(type);return next});
  const analyze=async()=>{if(!token||smartLoading||starCooldownLeft>0)return;setSmartLoading(true);setNotice("");try{const result=await analyzeStarThemes(token);onGraph(result);setNotice(result.smartStatus)}catch(e){if(e instanceof ApiError&&e.retryAfter){const until=Date.now()+e.retryAfter*1000;setStarClock(Date.now());setStarCooldownUntil(until)}setNotice(e instanceof Error?e.message:"智能主题暂不可用，规则图谱仍可使用")}finally{setSmartLoading(false)}};
  const searchBook=async()=>{if(!token||searching)return;const term=searchInputRef.current;setSearching(true);setNotice("");try{const result=await getStarMap(token,term);onGraph(result);const match=result.nodes.find(node=>node.kind==='BOOK'&&node.searchMatched);setSelectedNode(match||null);setSelectedEdge(null);setNotice(match?`已在星图中选中《${match.title}》`:term.trim()?"没有找到匹配的书名或作者":"已恢复默认星图") }catch(e){setNotice(e instanceof Error?e.message:"搜索暂时不可用")}finally{setSearching(false)}};
  const hide=async()=>{if(!token||!selectedEdge?.sourceBookId||!selectedEdge.targetBookId)return;try{const result=await hideStarRelation(token,selectedEdge.sourceBookId,selectedEdge.targetBookId);onGraph(result);setSelectedEdge(null);setNotice("这条关联已从你的星图中隐藏") }catch(e){setNotice(e instanceof Error?e.message:"隐藏失败")}};
  const selectNode=(node:StarNode)=>{if(selectedNode?.id===node.id){setSelectedNode(null);setSelectedEdge(null);return}setSelectedNode(node);setSelectedEdge(null);setDetailOpen(true)};
  const selectEdge=(edge:StarEdge)=>{setSelectedEdge(edge);setSelectedNode(null);setDetailOpen(true)};
  const clearStarSelection=()=>{setSelectedNode(null);setSelectedEdge(null)};
  return <div className="star-universe-page">
    <section className="star-universe-stage">
      <div className="star-nebula star-nebula-one"/><div className="star-nebula star-nebula-two"/><div className="star-nebula star-nebula-three"/>
      <header className="star-glass star-universe-head">
        <div><p className="eyebrow">MY READING UNIVERSE</p><h1>我的阅读星图 <span>· 总览</span></h1></div>
        <div className="star-head-stats"><span><b>{graphStats.bookCount}</b><small>书架图书</small></span><i/><span><b>{graphStats.themeCount}</b><small>主题节点</small></span><i/><span><b>{graphStats.relationCount}</b><small>思想连接</small></span></div>
        <div className="star-head-tools"><div className="star-head-search"><Search/><input value={searchInput} onChange={event=>setSearchInput(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')searchBook()}} placeholder="搜索一本书"/>{searchInput&&<button onClick={()=>{searchInputRef.current="";setSearchInput("");window.setTimeout(searchBook,0)}}><X/></button>}</div><button className="star-ai-button" disabled={smartLoading||starCooldownLeft>0} onClick={analyze}><Sparkles/>{smartLoading?"整理中":starCooldownLeft>0?`${starCooldownLeft}秒后重试`:"AI 主题"}</button></div>
      </header>
      {(notice||graph.smartStatus)&&<div className="star-stage-notice">{notice||graph.smartStatus}</div>}
      <aside className={`star-glass star-drawer star-filter-drawer ${filterOpen?"open":"closed"}`}><p className="eyebrow">RELATION FILTER</p><h2>关系筛选</h2>{["同一作者","同一分类","同期阅读","主题相近","AI主题","分类主题"].map(type=><label key={type}><span className={`star-relation-dot type-${type}`}/><span>{type}</span><input type="checkbox" checked={enabled.has(type)} onChange={()=>toggle(type)}/><i/></label>)}<div className="star-filter-divider"/><label className="star-mini-toggle"><input type="checkbox" checked={showHighlights} onChange={event=>setShowHighlights(event.target.checked)}/><i/>显示划线星点</label><div className="star-explore-help"><b>探索提示</b><p>拖动任意节点，关系线会像弹簧一样拉伸，整张星图会自动避让并重新平衡。</p></div></aside>
      <button className={`star-edge-toggle left ${filterOpen?"open":"closed"}`} onClick={()=>setFilterOpen(value=>!value)} title={filterOpen?"隐藏关系筛选":"展开关系筛选"}><ChevronLeft/></button>
      <Suspense fallback={<div className="star-force-loading"><Orbit/><span>正在展开阅读宇宙…</span></div>}><StarForceGraph nodes={nodes} edges={relationEdges} selectedNode={selectedNode} selectedEdge={selectedEdge} showHighlights={showHighlights} onSelectNode={selectNode} onSelectEdge={selectEdge} onClearSelection={clearStarSelection} onForceState={(active,label)=>{setForceActive(active);setDraggedLabel(label||"")}}/></Suspense>
      {(selectedNode||selectedEdge)&&<div className="star-glass-chip star-selection-pill"><span className="star-selection-mark"><Sparkles/></span><div>{selectedNode?<><b>已选中《{selectedNode.label}》</b><small>{relationEdges.filter(edge=>edge.source===selectedNode.id||edge.target===selectedNode.id).length} 条一度关系已突出显示</small></>:<><b>已选中一条思想连接</b><small>{selectedEdge?.explanation}</small></>}</div></div>}
      <aside className={`star-glass star-drawer star-detail-drawer ${detailOpen?"open":"closed"}`}><button className="star-detail-close" onClick={()=>setDetailOpen(false)}><X/></button>{selectedNode?.kind==='BOOK'?<BookStarDetail node={selectedNode} edges={relationEdges} nodes={graph.nodes} onOpenBook={onOpenBook}/>:selectedNode?.kind==='THEME'?<><p className="eyebrow">THEME NODE · {selectedNode.source}</p><h2>{selectedNode.label}</h2><p>共有 {selectedNode.bookCount} 本书与这个主题相连。</p><div className="star-related">{relationEdges.filter(edge=>edge.target===selectedNode.id||edge.source===selectedNode.id).slice(0,8).map(edge=>{const id=edge.source===selectedNode.id?edge.target:edge.source;const book=graph.nodes.find(node=>node.id===id);return book?<button key={id} onClick={()=>selectNode(book)}>{book.label}</button>:null})}</div></>:selectedEdge?<><p className="eyebrow">RELATION EVIDENCE</p><h2>关系说明</h2><div className="relation-strength"><b>{selectedEdge.score>=.8?"强关联":selectedEdge.score>=.65?"普通关联":"弱关联"}</b><span>{Math.round(selectedEdge.score*100)}%</span></div><p>{selectedEdge.explanation}</p><div className="theme-tags">{selectedEdge.types.map(type=><span key={type}>{type}</span>)}</div>{selectedEdge.kind==='BOOK_RELATION'&&<button className="danger-link" onClick={hide}>隐藏错误关联</button>}</>:<><p className="eyebrow">NODE DETAILS</p><h2>选择一个节点</h2><p>点击书籍突出一度关系；点击连线查看关系依据。</p></>}</aside>
      <button className={`star-edge-toggle right ${detailOpen?"open":"closed"}`} onClick={()=>setDetailOpen(value=>!value)} title={detailOpen?"隐藏书籍详情":"展开书籍详情"}><ChevronRight/></button>
      <div className={`star-glass-chip star-force-hint ${forceActive?"active":""}`}><Sparkles/><div><b>{forceActive?`正在拖动 · ${draggedLabel}`:"力导向布局已开启"}</b><span>{forceActive?"关联节点被牵引，其余节点同步避让并重新平衡。":"拖动任意节点，整张星图都会自然响应。"}</span></div></div>
      <div className="star-glass-chip star-dark-legend"><span><i className="book"/>书籍</span><span><i className="theme"/>主题</span><span><i className="highlight"/>划线</span><span>滚轮缩放 · 空白处拖动平移</span></div>
      <div className="star-private-note">你的数据，只为你展开。</div>
    </section>
  </div>;
}

function BookStarDetail({node,edges,nodes,onOpenBook}:{node:StarNode;edges:StarEdge[];nodes:StarNode[];onOpenBook:(id:string)=>void}){
  const related=edges.filter(edge=>edge.kind==='BOOK_RELATION'&&(edge.source===node.id||edge.target===node.id)).sort((a,b)=>b.score-a.score).slice(0,5);
  const status=node.finished?"已读完":node.progress?`阅读到 ${node.progress}%`:"阅读中";
  const themeTitle=node.themeSource==='AI'?"AI 提取主题":"分类主题";
  const themeHint=node.themeSource==='AI'?"基于书籍信息、划线与想法生成":"基于书籍分类与入图规则生成";
  const metaItems=[
    {label:"阅读状态",value:status},
    {label:"划线 / 书签",value:String(node.highlightCount||0)},
    {label:"笔记 / 想法",value:String(node.noteCount||0)},
    {label:"关联书籍",value:String(node.relatedCount||0)}
  ];
  return <>
    <p className="eyebrow">BOOK NODE · {node.themeSource}</p>
    {node.cover&&<img className="star-detail-cover" src={node.cover} alt=""/>}
    <h2>{node.title}</h2><p className="star-author">{node.author} · {node.category}</p>
    <section className="star-primary-relations"><h3>关联最强</h3><small>点击关联书可进入完整书籍详情</small><div className="star-related">{related.map(edge=>{const id=edge.source===node.id?edge.target:edge.source;const book=nodes.find(item=>item.id===id);return book?<button key={edge.id} onClick={()=>book.bookId&&onOpenBook(book.bookId)}><span>{book.label}<small>{edge.types.join(" · ")}</small></span><b>{Math.round(edge.score*100)}%</b></button>:null})}</div></section>
    <section className={`star-theme-panel ${node.themeSource==='AI'?"ai":"rule"}`}>
      <div className="star-panel-heading"><h3>{themeTitle}</h3><small>{themeHint}</small></div>
      <div className="theme-tags">{node.themes?.map(theme=><span key={theme}>{theme}</span>)}</div>
      {node.summary&&<p className="star-ai-summary">{node.summary}</p>}
    </section>
    <section className="star-secondary-meta"><div className="star-panel-heading"><h3>阅读与入图信息</h3><small>这本书为什么进入当前星图</small></div><div className="star-meta-reason"><span>入图依据</span><b>{node.rankReason||"综合阅读权重"}</b></div><div className="star-meta-grid">{metaItems.map(item=><div key={item.label} className="star-meta-item"><span>{item.label}</span><b>{item.value}</b></div>)}</div></section>
    {node.bookId&&<button className="text-btn" onClick={()=>onOpenBook(node.bookId!)}>查看书籍详情 <ArrowRight/></button>}
  </>;
}

/** 阅读记忆页负责周报、月报、历史快照和时间胶囊的状态编排。 */
function ReadingMemory({
  session,
  connected,
  onAccess,
}: {
  session: Session | null;
  connected: boolean;
  onAccess: () => void;
}) {
  const [tab, setTab] = useState<"weekly" | "monthly">("weekly"),
    [weekly, setWeekly] = useState<ReadingReport | null>(null),
    [monthly, setMonthly] = useState<ReadingReport | null>(null),
    [history, setHistory] = useState<ReadingReport[]>([]),
    [capsule, setCapsule] = useState<ReadingCapsule | null>(null);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [reflection, setReflection] = useState(""),
    [saving, setSaving] = useState(false),
    [highlightPage, setHighlightPage] = useState(0),
    [shareOpen, setShareOpen] = useState(false);
  const token = session?.token,
    report = tab === "weekly" ? weekly : monthly;
  const load = async () => {
    if (!token || !connected) return;
    setLoading(true);
    setError("");
    try {
      const [w, m, c] = await Promise.all([
        getReadingReport(token, "weekly"),
        getReadingReport(token, "monthly"),
        getCurrentCapsule(token),
      ]);
      setWeekly(w);
      setMonthly(m);
      setCapsule(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "阅读记忆暂时无法展开");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [token, connected]);
  useEffect(() => {
    if (token && connected)
      getReportHistory(token, tab)
        .then(setHistory)
        .catch(() => setHistory([]));
  }, [token, connected, tab]);
  const regenerate = async () => {
    if (!token || !report) return;
    setSaving(true);
    try {
      const next = await regenerateReport(token, report.id);
      tab === "weekly" ? setWeekly(next) : setMonthly(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "重新生成失败");
    } finally {
      setSaving(false);
    }
  };
  const saveReflection = async () => {
    if (!token || !capsule?.id || !reflection.trim()) return;
    setSaving(true);
    try {
      setCapsule(await saveCapsuleReflection(token, capsule.id, reflection));
      setReflection("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };
  const dismiss = async () => {
    if (!token || !capsule?.id) return;
    await dismissCapsule(token, capsule.id);
    setCapsule({ available: false });
  };
  if (!session || !connected) {
    const needsLogin = !session;
    return (
      <div className="wrap page memory-locked">
        <span>
          <LockKeyhole />
        </span>
        <p className="eyebrow">PRIVATE READING MEMORY</p>
        <h1>{needsLogin ? "阅读记忆只向你展开" : "导入数据后生成你的阅读记忆"}</h1>
        <p>{needsLogin ? "登录并连接微信读书后，墨架会为你保存稳定的周报、月报和时间胶囊。" : "你的账号已登录。导入微信读书数据后，墨架会开始整理周报、月报和时间胶囊。"}</p>
        <button className="primary" onClick={onAccess}>
          {needsLogin ? "登录 / 注册" : "导入我的数据"} <ArrowRight />
        </button>
      </div>
    );
  }
  const snapshot = report?.snapshot;
  return (
    <div className="wrap page memory-page">
      <div className="page-title split">
        <div>
          <p className="eyebrow">YOUR READING MEMORY</p>
          <h1>阅读记忆</h1>
          <p>报告在生成时冻结；过去，不会被今天悄悄改写。</p>
        </div>
        <div className="private-stamp">
          <LockKeyhole /> 默认私密
        </div>
      </div>
      {error && <div className="board-notice">{error}</div>}
      <section className="capsule-panel">
        <div className="capsule-orbit">
          <History />
        </div>
        <div>
          <p className="eyebrow">
            TIME CAPSULE · {capsule?.sourceDate || "一个月前"}
          </p>
          <h2>
            {capsule?.available
              ? capsule.content?.title || "一个月前的今天"
              : "这周的胶囊已经合上"}
          </h2>
          {capsule?.available ? (
            <>
              <p>{capsule.content?.message}</p>
              {capsule.content?.quote && (
                <blockquote>{capsule.content.quote}</blockquote>
              )}
              {capsule.content?.thought && (
                <p className="old-thought">
                  过去的我：{capsule.content.thought}
                </p>
              )}
              {capsule.reflection ? (
                <p className="now-thought">现在的我：{capsule.reflection}</p>
              ) : (
                <div className="reflection-box">
                  <textarea
                    value={reflection}
                    onChange={(e) =>
                      setReflection(e.target.value.slice(0, 2000))
                    }
                    placeholder="写下现在的感受…"
                  />
                  <button
                    className="primary"
                    disabled={saving || !reflection.trim()}
                    onClick={saveReflection}
                  >
                    保存回顾
                  </button>
                </div>
              )}
              <button className="capsule-dismiss" onClick={dismiss}>
                暂不提醒这枚记忆
              </button>
            </>
          ) : (
            <p>下一周，墨架会再替你拾起一枚旧时光。</p>
          )}
        </div>
      </section>
      <div className="report-switch">
        <button
          className={tab === "weekly" ? "active" : ""}
          onClick={() => setTab("weekly")}
        >
          周报
        </button>
        <button
          className={tab === "monthly" ? "active" : ""}
          onClick={() => setTab("monthly")}
        >
          月报
        </button>
      </div>
      {report && snapshot && <DailyReadingLedger report={report} />}
      {loading && !report ? (
        <div className="notes-empty">
          <RefreshCw className="spin" /> 正在生成私密快照…
        </div>
      ) : (
        snapshot && (
          <ReportMagazine
            report={report}
            saving={saving}
            onRefresh={regenerate}
            onShare={() => setShareOpen(true)}
            highlightPage={highlightPage}
            onHighlightPage={setHighlightPage}
          />
        )
      )}
      {history.length > 1 && (
        <section className="report-history">
          <h3>历史快照</h3>
          <div>
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  item.periodType === "WEEKLY"
                    ? setWeekly(item)
                    : setMonthly(item);
                }}
              >
                <CalendarDays />
                <span>
                  {item.periodStart}
                  <small>
                    {item.periodType === "WEEKLY" ? "周报" : "月报"}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      {shareOpen && report && (
        <ShareReportModal
          report={report}
          displayName={session.displayName}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}

function DailyReadingLedger({ report }: { report: ReadingReport }) {
  const days = report.snapshot.timeline || [],
    max = Math.max(...days.map((day) => day.seconds), 1),
    total = days.reduce((sum, day) => sum + day.seconds, 0),
    active = days.filter((day) => day.seconds > 0).length;
  return (
    <section className="daily-ledger">
      <div>
        <p className="eyebrow">DAILY READING TIME</p>
        <h2>
          {report.periodType === "WEEKLY" ? "每日阅读时长" : "本月每日阅读时长"}
        </h2>
        <span>
          {active} 天有记录 · 合计 {formatDuration(total)}
        </span>
      </div>
      <div>
        {days.map((day) => (
          <article key={day.date || day.timestamp}>
            <b>{shortDate(day.date || day.timestamp)}</b>
            <i>
              <em
                style={{
                  width: `${day.seconds ? Math.max(4, (day.seconds / max) * 100) : 0}%`,
                }}
              />
            </i>
            <span>{day.seconds ? formatDuration(day.seconds) : "未记录"}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

/** 把不可变的报告快照渲染成连续杂志长页，不在前端重新推测统计数据。 */
function ReportMagazine({
  report,
  saving,
  onRefresh,
  onShare,
  highlightPage,
  onHighlightPage,
}: {
  report: ReadingReport;
  saving: boolean;
  onRefresh: () => void;
  onShare: () => void;
  highlightPage: number;
  onHighlightPage: (value: number) => void;
}) {
  const s = report.snapshot,
    isWeek = report.periodType === "WEEKLY",
    days = s.timeline || [],
    books = s.books || [],
    highlights = s.highlights || [],
    written = s.notes || [],
    memoryBookCount = new Set(
      [...highlights, ...written].map((item) => item.bookId),
    ).size,
    maxDay = Math.max(...days.map((day) => day.seconds), 1),
    pageCount = Math.max(1, Math.ceil(highlights.length / 3)),
    safePage = highlightPage % pageCount,
    shownHighlights = highlights.slice(safePage * 3, safePage * 3 + 3),
    longestDay = [...days].sort((a, b) => b.seconds - a.seconds)[0];
  const diff = s.totalReadTime - (s.previousTotalReadTime || 0),
    periodLabel = isWeek ? "本周" : "本月",
    issue = isWeek
      ? `${s.issueYear || new Date(report.periodStart).getFullYear()} · WEEK ${s.issueNumber || ""}`
      : `${report.periodStart.slice(0, 7).replace("-", " · ")}`;
  const metrics = [
    {
      value: formatDuration(s.totalReadTime),
      label: "阅读时光",
      note:
        diff === 0
          ? "与上期时长相同"
          : `比上期${diff > 0 ? "多" : "少"} ${formatDuration(Math.abs(diff))}`,
    },
    {
      value: `${s.readDays} 天`,
      label: "阅读天数",
      note:
        isWeek && s.readDays === 7
          ? "本周每天都有阅读"
          : `${periodLabel}记录了 ${s.readDays} 天阅读`,
    },
    {
      value: formatDuration(s.dayAverageReadTime),
      label: "日均阅读",
      note: longestDay
        ? `${shortDate(longestDay.date || longestDay.timestamp)} 阅读最久`
        : "",
    },
    {
      value: `${s.newNotes} 条`,
      label: "新增笔记",
      note: memoryBookCount
        ? `来自 ${memoryBookCount} 本书`
        : "本期没有新增笔记",
    },
  ];
  return (
    <article className="journal-page">
      <header className="journal-header">
        <div>
          <p className="eyebrow">
            {report.periodType} JOURNAL · NO.
            {String(
              s.issueNumber || new Date(report.periodStart).getMonth() + 1,
            ).padStart(2, "0")}
          </p>
          <span>{issue}</span>
          <h2>{isWeek ? "这一周的阅读" : "这个月的阅读"}</h2>
          <strong>
            {magazineDate(report.periodStart)} —{" "}
            {magazineDate(report.periodEnd)}
          </strong>
        </div>
        <div className="journal-actions">
          <button className="journal-refresh" onClick={onShare}>
            <Share2 /> 分享长图
          </button>
          <button
            className="journal-refresh"
            disabled={saving}
            onClick={onRefresh}
          >
            <RefreshCw className={saving ? "spin" : ""} />{" "}
            {saving ? "正在统计" : isWeek ? "刷新周报" : "刷新月报"}
          </button>
        </div>
      </header>
      <section className="journal-section journal-overview">
        <JournalHeading
          no="01"
          en="AT A GLANCE"
          title={`${periodLabel}阅读概览`}
        />
        <div className="journal-metrics">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <b>{metric.value}</b>
              <span>{metric.label}</span>
              <small>{metric.note}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="journal-section">
        <JournalHeading
          no="02"
          en="READING LOG"
          title={isWeek ? "一周阅读轨迹" : "本月阅读轨迹"}
        />
        <div className="daily-reading-log">
          {days.map((day, index) => (
            <div className="reading-day" key={`${day.timestamp}-${index}`}>
              <div className="reading-day-date">
                <b>{shortDate(day.date || day.timestamp)}</b>
                <span>{weekday(day.date || day.timestamp)}</span>
              </div>
              <div className="reading-day-body">
                <div className="reading-day-time">
                  <i
                    style={{
                      width: `${day.seconds ? Math.max(3, (day.seconds / maxDay) * 100) : 0}%`,
                    }}
                  />
                  <b>
                    {day.seconds ? formatDuration(day.seconds) : "未记录阅读"}
                  </b>
                </div>
                {day.books && day.books.length > 0 && (
                  <p>
                    {day.books.length === 1
                      ? `《${day.books[0]}》`
                      : `《${day.books[0]}》等 ${day.books.length} 本`}
                  </p>
                )}
                {(day.noteCount || 0) > 0 && (
                  <small>新增 {day.noteCount} 条笔记</small>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
      {books.length > 0 && (
        <section className="journal-section">
          <JournalHeading
            no="03"
            en="WEREAD BOOK RANKING"
            title={`${periodLabel}书籍排行`}
          />
          <p className="journal-source-note">
            来自微信读书本期阅读时长排行，按阅读时间从高到低排列。
          </p>
          <div className="journal-book-list">
            {books.map((book, index) => (
              <div className="journal-book" key={book.bookId || index}>
                <span className="journal-book-no">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="journal-book-cover">
                  {book.cover ? <img src={book.cover} alt="" /> : <BookOpen />}
                </div>
                <div className="journal-book-copy">
                  <h3>{book.title}</h3>
                  <p>{book.author}</p>
                  <b>
                    {periodLabel}阅读 {formatDuration(book.seconds)}
                  </b>
                  <div className="journal-progress">
                    <i
                      style={{
                        width: `${Math.max(0, Math.min(100, book.progress || 0))}%`,
                      }}
                    />
                    <span>{book.progress || 0}%</span>
                  </div>
                  <small>
                    {[
                      book.noteCount ? `${book.noteCount} 条笔记` : "",
                      book.highlightCount
                        ? `${book.highlightCount} 处划线`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {s.topBook?.title && s.topBook.title !== "暂无" && (
        <section className="journal-section companion">
          <JournalHeading
            no="04"
            en="MOST TIME WITH"
            title={`${periodLabel}常伴`}
          />
          <div>
            {s.topBook.cover && <img src={s.topBook.cover} alt="" />}
            <div>
              <h3>{s.topBook.title}</h3>
              <p>{s.topBook.author}</p>
              <b>{formatDuration(s.topBook.seconds)}</b>
              <span>{periodLabel}阅读时间最长</span>
            </div>
          </div>
        </section>
      )}
      <section className="journal-section">
        <JournalHeading
          no="05"
          en="SELECTED HIGHLIGHTS"
          title={`${periodLabel}划线`}
        />
        {shownHighlights.length ? (
          <>
            <div className="literary-quotes">
              {shownHighlights.map((item, index) => (
                <blockquote key={item.id || index}>
                  <span>
                    {String(safePage * 3 + index + 1).padStart(2, "0")}
                  </span>
                  <p>{item.quote}</p>
                  <footer>
                    <b>《{item.bookTitle}》</b>
                    {item.author && <i>{item.author}</i>}
                    <time>{memoryDate(item.createdAt)}</time>
                  </footer>
                </blockquote>
              ))}
            </div>
            <div className="journal-more">
              <span>本期共 {highlights.length} 处划线</span>
              {pageCount > 1 && (
                <button
                  onClick={() => onHighlightPage((safePage + 1) % pageCount)}
                >
                  换一组 <RefreshCw />
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="journal-empty">
            本期排行书籍中没有同步到本期新增划线；点击“刷新周报”会重新拉取排行书籍的划线。
          </p>
        )}
      </section>
      <section className="journal-section">
        <JournalHeading
          no="06"
          en="NOTES LEFT BEHIND"
          title={`${periodLabel}留下的笔记`}
        />
        {written.length ? (
          <div className="written-notes">
            {written.slice(0, 3).map((item, index) => (
              <article key={item.id || index}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {item.quote && <blockquote>“{item.quote}”</blockquote>}
                <p>{item.content}</p>
                <footer>
                  <b>《{item.bookTitle}》</b>
                  <time>{memoryDate(item.createdAt)}</time>
                </footer>
              </article>
            ))}
          </div>
        ) : (
          <p className="journal-empty">本期没有同步到新增文字笔记。</p>
        )}
      </section>
      <footer className="journal-footer">
        <span>INKSHELF · PRIVATE READING JOURNAL</span>
        <p>这份周报只记录时间、书籍，以及你真实留下的文字。</p>
        <small>
          生成于 {new Date(report.generatedAt).toLocaleString("zh-CN")}
        </small>
      </footer>
    </article>
  );
}
function JournalHeading({
  no,
  en,
  title,
}: {
  no: string;
  en: string;
  title: string;
}) {
  return (
    <header className="journal-heading">
      <span>{no}</span>
      <div>
        <p>{en}</p>
        <h3>{title}</h3>
      </div>
    </header>
  );
}
function reportDate(value: string) {
  return /^\d+$/.test(value)
    ? new Date(Number(value) * 1000)
    : new Date(`${value}T00:00:00`);
}
function shortDate(value: string) {
  return reportDate(value)
    .toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })
    .replace("/", ".")
    .replace(/\.$/, "");
}
function weekday(value: string) {
  return reportDate(value).toLocaleDateString("zh-CN", { weekday: "short" });
}
function magazineDate(value: string) {
  const date = reportDate(value);
  return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}
function memoryDate(value?: string) {
  return value
    ? new Date(value)
        .toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })
        .replace("/", ".")
    : "";
}

function ShareReportModal({
  report,
  displayName,
  onClose,
}: {
  report: ReadingReport;
  displayName: string;
  onClose: () => void;
}) {
  const [showHighlights, setShowHighlights] = useState(false),
    [showNotes, setShowNotes] = useState(false),
    [showName, setShowName] = useState(false),
    [exporting, setExporting] = useState(false),
    [error, setError] = useState("");
  const cardRef = useRef<HTMLDivElement | null>(null);
  const isWeek = report.periodType === "WEEKLY";
  const download = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    setError("");
    try {
      await exportReportSharePng(
        report,
        { showHighlights, showNotes, showName, displayName },
        `inkshelf-${isWeek ? "weekly" : "monthly"}-${report.periodStart}.png`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "长图生成失败，请稍后重试");
    } finally {
      setExporting(false);
    }
  };
  return (
    <div
      className="modal-backdrop share-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal share-modal">
        <button className="modal-x" onClick={onClose}>
          <X />
        </button>
        <div className="share-layout">
          <aside className="share-options">
            <span className="modal-icon">
              <Share2 />
            </span>
            <p className="eyebrow">SHARE IMAGE</p>
            <h2>{isWeek ? "周报长图" : "月报长图"}</h2>
            <p>
              默认只分享统计与书籍排行；划线和想法属于私人内容，需要你主动打开。
            </p>
            <label>
              <input
                type="checkbox"
                checked={showHighlights}
                onChange={(e) => setShowHighlights(e.target.checked)}
              />{" "}
              分享划线，最多 3 条
            </label>
            <label>
              <input
                type="checkbox"
                checked={showNotes}
                onChange={(e) => setShowNotes(e.target.checked)}
              />{" "}
              分享想法，最多 3 条
            </label>
            <label>
              <input
                type="checkbox"
                checked={showName}
                onChange={(e) => setShowName(e.target.checked)}
              />{" "}
              显示“{displayName} 的阅读记录”署名
            </label>
            <button
              className="primary full"
              disabled={exporting}
              onClick={download}
            >
              {exporting ? "正在生成 PNG…" : "下载 PNG 长图"} <Download />
            </button>
            {error && <p className="error">{error}</p>}
            <small className="privacy">
              长图在你的浏览器本地生成，不会额外上传划线或想法。
            </small>
          </aside>
          <div className="share-preview">
            <ReportShareCard
              refEl={cardRef}
              report={report}
              displayName={displayName}
              showHighlights={showHighlights}
              showNotes={showNotes}
              showName={showName}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportShareCard({
  refEl,
  report,
  displayName,
  showHighlights,
  showNotes,
  showName,
}: {
  refEl: RefObject<HTMLDivElement | null>;
  report: ReadingReport;
  displayName: string;
  showHighlights: boolean;
  showNotes: boolean;
  showName: boolean;
}) {
  const s = report.snapshot,
    isWeek = report.periodType === "WEEKLY",
    periodLabel = isWeek ? "本周" : "本月",
    books = s.books || [],
    highlights = (s.highlights || []).slice(0, 3),
    notes = (s.notes || []).slice(0, 3),
    days = s.timeline || [],
    maxDay = Math.max(...days.map((day) => day.seconds), 1),
    activeDays = days.filter((day) => day.seconds > 0).length;
  const top = s.topBook;
  return (
    <div className="share-card" ref={refEl}>
      <header>
        <p>{report.periodType} JOURNAL</p>
        <h1>{isWeek ? "这一周的阅读" : "这个月的阅读"}</h1>
        <span>
          {magazineDate(report.periodStart)} — {magazineDate(report.periodEnd)}
        </span>
        {showName && <em>{displayName} 的阅读记录</em>}
      </header>
      <section className="share-stats">
        <div>
          <b>{formatDuration(s.totalReadTime)}</b>
          <span>阅读时光</span>
        </div>
        <div>
          <b>{s.readDays} 天</b>
          <span>阅读天数</span>
        </div>
        <div>
          <b>{formatDuration(s.dayAverageReadTime)}</b>
          <span>日均阅读</span>
        </div>
        <div>
          <b>{s.newNotes} 条</b>
          <span>新增笔记</span>
        </div>
      </section>
      <section className="share-daily">
        <div className="share-section-title">
          <span>DAILY READING TIME</span>
          <h2>每日阅读时长</h2>
          <p>
            {activeDays} 天有记录 · 合计 {formatDuration(s.totalReadTime)}
          </p>
        </div>
        <div>
          {days.map((day) => (
            <article key={day.date || day.timestamp}>
              <b>{shortDate(day.date || day.timestamp)}</b>
              <i>
                <em
                  style={{
                    width: `${day.seconds ? Math.max(4, (day.seconds / maxDay) * 100) : 0}%`,
                  }}
                />
              </i>
              <span>
                {day.seconds ? formatDuration(day.seconds) : "未记录"}
              </span>
            </article>
          ))}
        </div>
      </section>
      {top?.title && top.title !== "暂无" && (
        <section className="share-companion">
          <p>MOST TIME WITH</p>
          <h2>{top.title}</h2>
          <span>{top.author}</span>
          <b>
            {periodLabel}阅读 {formatDuration(top.seconds)}
          </b>
        </section>
      )}
      <section>
        <div className="share-section-title">
          <span>BOOK RANKING</span>
          <h2>{periodLabel}阅读的全部书籍</h2>
        </div>
        <ol className="share-books">
          {books.map((book, index) => (
            <li key={book.bookId || index}>
              <i>{String(index + 1).padStart(2, "0")}</i>
              <div>
                <b>{book.title}</b>
                <span>{book.author}</span>
              </div>
              <em>{formatDuration(book.seconds)}</em>
            </li>
          ))}
        </ol>
      </section>
      {showHighlights && highlights.length > 0 && (
        <section>
          <div className="share-section-title">
            <span>SELECTED HIGHLIGHTS</span>
            <h2>{periodLabel}划线</h2>
          </div>
          <div className="share-quotes">
            {highlights.map((item, index) => (
              <blockquote key={item.id || index}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{item.quote}</p>
                <footer>
                  《{item.bookTitle}》 · {memoryDate(item.createdAt)}
                </footer>
              </blockquote>
            ))}
          </div>
        </section>
      )}
      {showNotes && notes.length > 0 && (
        <section>
          <div className="share-section-title">
            <span>NOTES LEFT BEHIND</span>
            <h2>{periodLabel}想法</h2>
          </div>
          <div className="share-quotes share-notes">
            {notes.map((item, index) => (
              <blockquote key={item.id || index}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {item.quote && <small>“{item.quote}”</small>}
                <p>{item.content}</p>
                <footer>
                  《{item.bookTitle}》 · {memoryDate(item.createdAt)}
                </footer>
              </blockquote>
            ))}
          </div>
        </section>
      )}
      <footer>
        <b>INKSHELF 墨架</b>
        <span>数据来自微信读书 · 私密内容由用户选择分享</span>
      </footer>
    </div>
  );
}

type ShareImageOptions = {
  showHighlights: boolean;
  showNotes: boolean;
  showName: boolean;
  displayName: string;
};
/**
 * 使用浏览器 Canvas 生成脱敏分享图；导出内容仅来自后端允许公开的报告字段。
 */
async function exportReportSharePng(
  report: ReadingReport,
  options: ShareImageOptions,
  filename: string,
) {
  const s = report.snapshot,
    isWeek = report.periodType === "WEEKLY",
    periodLabel = isWeek ? "本周" : "本月",
    books = s.books || [],
    highlights = options.showHighlights ? (s.highlights || []).slice(0, 3) : [],
    notes = options.showNotes ? (s.notes || []).slice(0, 3) : [],
    days = s.timeline || [],
    maxDay = Math.max(...(s.timeline || []).map((day) => day.seconds), 1),
    activeDays = days.filter((day) => day.seconds > 0).length;
  const width = 1080,
    pad = 86,
    content = width - pad * 2,
    scale = 2;
  const estimate =
    770 +
    days.length * 46 +
    books.length * 86 +
    highlights.length * 230 +
    notes.length * 260 +
    (s.topBook?.title && s.topBook.title !== "暂无" ? 190 : 0) +
    150;
  const canvas = document.createElement("canvas"),
    ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("浏览器不支持图片导出");
  canvas.width = width * scale;
  canvas.height = estimate * scale;
  ctx.scale(scale, scale);
  let y = 0;
  const serif = `"Noto Serif SC","Microsoft YaHei",serif`,
    sans = `"DM Sans","Microsoft YaHei",sans-serif`;
  const line = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color = "#d8d0c2",
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  const text = (
    value: string,
    x: number,
    y0: number,
    font: string,
    color = "#1f2e29",
    align: CanvasTextAlign = "left",
  ) => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(value, x, y0);
  };
  const wrap = (value: string, max: number, font: string) => {
    ctx.font = font;
    const chars = Array.from(value || ""),
      lines: string[] = [];
    let row = "";
    for (const ch of chars) {
      const next = row + ch;
      if (ctx.measureText(next).width > max && row) {
        lines.push(row);
        row = ch;
      } else row = next;
    }
    if (row) lines.push(row);
    return lines;
  };
  const wrapped = (
    value: string,
    x: number,
    y0: number,
    max: number,
    font: string,
    color = "#1f2e29",
    lineHeight = 30,
    limit = 0,
  ) => {
    const lines = wrap(value, max, font).slice(0, limit || undefined);
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    lines.forEach((row, i) => ctx.fillText(row, x, y0 + i * lineHeight));
    return y0 + lines.length * lineHeight;
  };
  ctx.fillStyle = "#f8f4e9";
  ctx.fillRect(0, 0, width, estimate);
  y = 72;
  text(`${report.periodType} JOURNAL`, pad, y, `700 18px ${sans}`, "#748079");
  y += 62;
  text(
    isWeek ? "这一周的阅读" : "这个月的阅读",
    pad,
    y,
    `600 64px ${serif}`,
    "#214b40",
  );
  y += 56;
  text(
    `${magazineDate(report.periodStart)} — ${magazineDate(report.periodEnd)}`,
    pad,
    y,
    `500 25px ${sans}`,
    "#6f7c75",
  );
  if (options.showName)
    text(
      `${options.displayName} 的阅读记录`,
      width - pad,
      y,
      `500 20px ${serif}`,
      "#7d857f",
      "right",
    );
  y += 58;
  line(pad, y, width - pad, y);
  y += 52;
  ctx.fillStyle = "#ede7da";
  ctx.fillRect(pad, y, content, 140);
  const metrics = [
    [formatDuration(s.totalReadTime), "阅读时光"],
    [`${s.readDays} 天`, "阅读天数"],
    [formatDuration(s.dayAverageReadTime), "日均阅读"],
    [`${s.newNotes} 条`, "新增笔记"],
  ];
  metrics.forEach((m, i) => {
    const x = pad + (i * content) / 4 + 26;
    if (i > 0)
      line(pad + (i * content) / 4, y + 24, pad + (i * content) / 4, y + 116);
    text(m[0], x, y + 60, `600 31px ${serif}`, "#214b40");
    text(m[1], x, y + 93, `400 15px ${sans}`, "#727c75");
  });
  y += 185;
  text("DAILY READING TIME", pad, y, `700 15px ${sans}`, "#839087");
  y += 38;
  text("每日阅读时长", pad, y, `600 34px ${serif}`, "#1f2e29");
  text(
    `${activeDays} 天有记录 · 合计 ${formatDuration(s.totalReadTime)}`,
    pad,
    y + 34,
    `400 16px ${sans}`,
    "#7a827b",
  );
  y += 72;
  days.forEach((day) => {
    const ratio = day.seconds ? Math.max(0.04, day.seconds / maxDay) : 0;
    const barX = pad + 120,
      barW = content - 250;
    text(
      shortDate(day.date || day.timestamp),
      pad,
      y + 4,
      `500 18px ${sans}`,
      "#68746e",
    );
    ctx.fillStyle = "#e1d9ca";
    ctx.fillRect(barX, y - 5, barW, 7);
    ctx.fillStyle = "#214b40";
    ctx.fillRect(barX, y - 5, barW * ratio, 7);
    text(
      day.seconds ? formatDuration(day.seconds) : "未记录",
      width - pad,
      y + 4,
      `500 16px ${sans}`,
      "#59665f",
      "right",
    );
    y += 42;
  });
  y += 24;
  line(pad, y, width - pad, y);
  y += 48;
  if (s.topBook?.title && s.topBook.title !== "暂无") {
    text("MOST TIME WITH", pad, y, `700 15px ${sans}`, "#839087");
    y += 42;
    y = wrapped(
      s.topBook.title,
      pad,
      y,
      content,
      `600 36px ${serif}`,
      "#1f2e29",
      44,
      2,
    );
    text(s.topBook.author || "", pad, y + 4, `400 17px ${sans}`, "#7b837d");
    text(
      `${periodLabel}阅读 ${formatDuration(s.topBook.seconds)}`,
      pad,
      y + 46,
      `600 21px ${serif}`,
      "#214b40",
    );
    y += 88;
    line(pad, y, width - pad, y);
    y += 48;
  }
  text("BOOK RANKING", pad, y, `700 15px ${sans}`, "#839087");
  y += 38;
  text(`${periodLabel}阅读的全部书籍`, pad, y, `600 34px ${serif}`, "#1f2e29");
  y += 42;
  books.forEach((book, index) => {
    line(pad, y, width - pad, y, "#e0d8ca");
    y += 28;
    text(
      String(index + 1).padStart(2, "0"),
      pad,
      y,
      `500 15px ${sans}`,
      "#9b825c",
    );
    const titleY = wrapped(
      book.title,
      pad + 70,
      y,
      content - 250,
      `600 22px ${serif}`,
      "#1f2e29",
      28,
      2,
    );
    text(
      book.author || "",
      pad + 70,
      titleY + 4,
      `400 15px ${sans}`,
      "#7e867f",
    );
    text(
      formatDuration(book.seconds),
      width - pad,
      y,
      `500 16px ${sans}`,
      "#53655f",
      "right",
    );
    y = Math.max(titleY + 34, y + 58);
  });
  y += 28;
  line(pad, y, width - pad, y);
  y += 48;
  if (highlights.length) {
    text("SELECTED HIGHLIGHTS", pad, y, `700 15px ${sans}`, "#839087");
    y += 38;
    text(`${periodLabel}划线`, pad, y, `600 34px ${serif}`);
    y += 18;
    highlights.forEach((item, index) => {
      line(pad, y, width - pad, y, "#e0d8ca");
      y += 38;
      text(
        String(index + 1).padStart(2, "0"),
        pad,
        y,
        `500 15px ${sans}`,
        "#9b825c",
      );
      y = wrapped(
        item.quote || "",
        pad + 70,
        y,
        content - 70,
        `500 23px ${serif}`,
        "#1f2e29",
        39,
        5,
      );
      text(
        `《${item.bookTitle}》 · ${memoryDate(item.createdAt)}`,
        pad + 70,
        y + 6,
        `400 15px ${sans}`,
        "#78817a",
      );
      y += 45;
    });
    y += 16;
  }
  if (notes.length) {
    text("NOTES LEFT BEHIND", pad, y, `700 15px ${sans}`, "#839087");
    y += 38;
    text(`${periodLabel}想法`, pad, y, `600 34px ${serif}`);
    y += 18;
    notes.forEach((item, index) => {
      line(pad, y, width - pad, y, "#e0d8ca");
      y += 38;
      text(
        String(index + 1).padStart(2, "0"),
        pad,
        y,
        `500 15px ${sans}`,
        "#9b825c",
      );
      if (item.quote)
        y =
          wrapped(
            `“${item.quote}”`,
            pad + 70,
            y,
            content - 70,
            `400 18px ${serif}`,
            "#77776f",
            31,
            3,
          ) + 10;
      y = wrapped(
        item.content || "",
        pad + 70,
        y,
        content - 70,
        `500 23px ${serif}`,
        "#1f2e29",
        39,
        5,
      );
      text(
        `《${item.bookTitle}》 · ${memoryDate(item.createdAt)}`,
        pad + 70,
        y + 6,
        `400 15px ${sans}`,
        "#78817a",
      );
      y += 45;
    });
  }
  y += 34;
  line(pad, y, width - pad, y);
  y += 42;
  text("INKSHELF 墨架", pad, y, `700 16px ${sans}`, "#214b40");
  text(
    "数据来自微信读书 · 私密内容由用户选择分享",
    width - pad,
    y,
    `400 15px ${sans}`,
    "#7b837d",
    "right",
  );
  y += 50;
  const output = document.createElement("canvas"),
    out = output.getContext("2d");
  if (!out) throw new Error("浏览器不支持图片导出");
  output.width = width * scale;
  output.height = y * scale;
  out.drawImage(
    canvas,
    0,
    0,
    output.width,
    output.height,
    0,
    0,
    output.width,
    output.height,
  );
  const blob = await new Promise<Blob>((resolve, reject) =>
    output.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("PNG 生成失败"))),
      "image/png",
    ),
  );
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

/** 书架页使用独立的藏书殿堂场景，保留现有数据与书籍详情跳转。 */
function Shelf({
  books,
  session,
  connected,
  onAccess,
  onOpenBook,
}: {
  books: ShelfBook[];
  session: Session | null;
  connected: boolean;
  onAccess: () => void;
  onOpenBook: (book: ShelfBook) => void;
}) {
  if (!session || !connected) {
    const needsLogin = !session;
    return (
      <div className="wrap page star-locked shelf-locked">
        <span>
          <Library />
        </span>
        <p className="eyebrow">PRIVATE BOOKSHELF</p>
        <h1>{needsLogin ? "登录后打开你的书架" : "导入数据后打开你的书架"}</h1>
        <p>
          {needsLogin
            ? "登录并导入微信读书数据后，这里会展示你自己的藏书。"
            : "你的账号已登录。导入微信读书数据后，这里只会展示你自己的书籍。"}
        </p>
        <button className="primary" onClick={onAccess}>
          {needsLogin ? "登录 / 注册" : "导入我的数据"} <ArrowRight />
        </button>
      </div>
    );
  }
  return <BookshelfHall books={books} onOpenBook={onOpenBook} />;
}

function bookHash(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++)
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}
function formatWordCount(value: number) {
  return value >= 10000
    ? `约 ${(value / 10000).toFixed(value >= 100000 ? 0 : 1)} 万字`
    : `${value.toLocaleString()} 字`;
}
function chunkShelfRows(books: ShelfBook[], size: number) {
  const rows: Array<ShelfBook[]> = [];
  for (let i = 0; i < books.length; i += size)
    rows.push(books.slice(i, i + size));
  return rows;
}

type NoteTab = "ALL" | "HIGHLIGHT" | "THOUGHT" | "REVIEW";
/** 单书档案按需加载阅读进度和笔记，避免首页一次性传输私密正文。 */
function BookDetail({
  book,
  token,
  onBack,
}: {
  book: ShelfBook;
  token: string;
  onBack: () => void;
}) {
  const [reading, setReading] = useState<ReadingDetail | null>(null),
    [notes, setNotes] = useState<BookNote[]>([]),
    [summary, setSummary] = useState<NoteSummary | null>(null);
  const [tab, setTab] = useState<NoteTab>("ALL"),
    [query, setQuery] = useState(""),
    [order, setOrder] = useState<"desc" | "asc">("desc");
  const [loading, setLoading] = useState(true),
    [syncing, setSyncing] = useState(false),
    [error, setError] = useState("");
  const loadingBookRef = useRef<string | null>(null);
  const unsupported =
    book.id.startsWith("album-") || book.id === "mp-collection";
  const load = async (force = false) => {
    if (unsupported) {
      setLoading(false);
      setError("有声书与文章收藏暂不提供逐条笔记同步。");
      return;
    }
    if (!force && loadingBookRef.current === book.id) return;
    loadingBookRef.current = book.id;
    force ? setSyncing(true) : setLoading(true);
    setError("");
    try {
      await syncNotes(token, book.id, force);
      const [detail, noteData] = await Promise.all([
        getBookReading(token, book.id),
        getBookNotes(token, book.id),
      ]);
      setReading(detail);
      setNotes(noteData.items || []);
      setSummary(noteData.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "笔记读取失败，请稍后重试。");
    } finally {
      if (loadingBookRef.current === book.id) loadingBookRef.current = null;
      setLoading(false);
      setSyncing(false);
    }
  };
  useEffect(() => {
    load(false);
  }, [book.id, token]);
  const filtered = useMemo(
    () =>
      notes
        .filter((note) => {
          const typeMatches =
            tab === "ALL" ||
            note.type === tab ||
            (tab === "REVIEW" &&
              (note.type === "CHAPTER_REVIEW" || note.type === "BOOK_REVIEW"));
          const text =
            `${note.chapterTitle || ""} ${note.originalText || ""} ${note.content || ""}`.toLowerCase();
          return typeMatches && text.includes(query.trim().toLowerCase());
        })
        .sort((a, b) => {
          const diff =
            new Date(a.createdAt || 0).getTime() -
            new Date(b.createdAt || 0).getTime();
          return order === "asc" ? diff : -diff;
        }),
    [notes, tab, query, order],
  );
  const groups = useMemo(() => {
    const result: Array<{ key: string; title: string; items: BookNote[] }> = [],
      index = new Map<string, number>();
    filtered.forEach((note) => {
      const key = note.chapterUid || note.chapterTitle || "whole-book";
      if (!index.has(key)) {
        index.set(key, result.length);
        result.push({
          key,
          title: note.chapterTitle || "全书与未分章",
          items: [],
        });
      }
      result[index.get(key)!].items.push(note);
    });
    return result;
  }, [filtered]);
  const progress = reading?.progress ?? summary?.readingProgress ?? 0,
    lastRead = reading?.updateTime
      ? new Date(reading.updateTime * 1000)
      : book.lastRead
        ? new Date(book.lastRead)
        : null;
  const count = (types: BookNote["type"][]) =>
    notes.filter((note) => types.includes(note.type)).length;
  return (
    <div className="wrap page book-detail-page">
      <button className="book-back" onClick={onBack}>
        <ArrowLeft /> 返回书架
      </button>
      <section className="book-detail-hero">
        <div className="book-detail-cover">
          {reading?.cover || book.cover ? (
            <img src={reading?.cover || book.cover} alt={`${book.title}封面`} />
          ) : (
            <BookOpen />
          )}
        </div>
        <div className="book-detail-copy">
          <p className="eyebrow">YOUR READING ARCHIVE</p>
          <h1>{reading?.title || book.title}</h1>
          <p className="book-byline">
            {reading?.author || book.author} ·{" "}
            {reading?.category || book.category}
          </p>
          {reading?.intro && <p className="book-intro">{reading.intro}</p>}
          <div className="reading-progress">
            <span>
              <b>阅读进度</b>
              <em>{progress}%</em>
            </span>
            <div>
              <i
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </div>
          <div className="book-detail-actions">
            <button
              className="primary"
              disabled={syncing || unsupported}
              onClick={() => load(true)}
            >
              <RefreshCw className={syncing ? "spin" : ""} />
              {syncing ? "同步中…" : "立即同步"}
            </button>
            {reading?.deepLink && (
              <a
                className="text-btn"
                href={reading.deepLink}
                target="_blank"
                rel="noreferrer"
              >
                跳回微信读书 <ExternalLink />
              </a>
            )}
          </div>
          <small className="sync-caption">
            {summary?.sync.lastSuccessAt
              ? `上次同步：${formatNoteDate(summary.sync.lastSuccessAt)}`
              : "打开书籍时按需同步，不会一次拉取整座书架。"}
          </small>
        </div>
      </section>
      <section className="book-detail-metrics">
        <DetailMetric
          icon={<Clock3 />}
          value={formatDuration(reading?.readingTime || 0)}
          label="阅读时长"
        />
        <DetailMetric
          icon={<Highlighter />}
          value={summary?.highlightCount ?? count(["HIGHLIGHT"])}
          label="划线"
        />
        <DetailMetric
          icon={<Lightbulb />}
          value={
            summary?.reviewCount ??
            count(["THOUGHT", "CHAPTER_REVIEW", "BOOK_REVIEW"])
          }
          label="想法与书评"
        />
        <DetailMetric
          icon={<Bookmark />}
          value={summary?.bookmarkCount ?? 0}
          label="书签（仅数量）"
        />
        <DetailMetric
          icon={<BookOpen />}
          value={lastRead ? lastRead.toLocaleDateString("zh-CN") : "暂无"}
          label="最近阅读"
        />
      </section>
      <section className="notes-workspace">
        <header>
          <div>
            <p className="eyebrow">NOTES & HIGHLIGHTS</p>
            <h2>划线与想法</h2>
          </div>
          <span>{filtered.length} 条内容</span>
        </header>
        <div className="notes-toolbar">
          <div className="note-tabs">
            {(
              [
                ["ALL", "全部"],
                ["HIGHLIGHT", "划线"],
                ["THOUGHT", "我的想法"],
                ["REVIEW", "书评"],
              ] as [NoteTab, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                className={tab === value ? "active" : ""}
                onClick={() => setTab(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <label>
            <Search />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索划线、想法或章节"
            />
          </label>
          <button
            className="note-order"
            onClick={() => setOrder(order === "desc" ? "asc" : "desc")}
          >
            {order === "desc" ? "时间从新到旧" : "时间从旧到新"}
          </button>
        </div>
        {loading ? (
          <div className="notes-empty">
            <RefreshCw className="spin" /> 正在整理这本书的阅读记忆…
          </div>
        ) : error ? (
          <div className="notes-empty error">{error}</div>
        ) : groups.length ? (
          groups.map((group) => (
            <details className="note-chapter" key={group.key} open>
              <summary>
                <b>{group.title}</b>
                <span>{group.items.length} 条</span>
              </summary>
              <div>
                {group.items.map((note) => (
                  <NoteCard key={`${note.type}-${note.id}`} note={note} />
                ))}
              </div>
            </details>
          ))
        ) : (
          <div className="notes-empty">这里还没有可展示的划线或想法。</div>
        )}
        <p className="copyright-note">
          书签内容无法由微信读书接口导出；划线与想法默认私密，分享功能不会默认包含原文。
        </p>
      </section>
    </div>
  );
}
function DetailMetric({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
}) {
  return (
    <div>
      {icon}
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}
function NoteCard({ note }: { note: BookNote }) {
  const label =
    note.type === "HIGHLIGHT"
      ? "划线"
      : note.type === "THOUGHT"
        ? "我的想法"
        : note.type === "CHAPTER_REVIEW"
          ? "章节点评"
          : "书评";
  return (
    <article className={`note-card note-${note.type.toLowerCase()}`}>
      <header>
        <span>{label}</span>
        <time>{formatNoteDate(note.createdAt)}</time>
      </header>
      {note.originalText && <blockquote>{note.originalText}</blockquote>}
      {note.content && <p>{note.content}</p>}
    </article>
  );
}
function formatNoteDate(value?: string) {
  if (!value) return "时间未知";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "时间未知"
    : date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

/** 阅读洞察展示确定性统计；AI 生成内容由独立实验区负责。 */
function Insights({ data }: { data: DashboardData }) {
  const max = Math.max(...data.stats.monthlySeconds, 1);
  const monthLabels = rollingMonthLabels();
  const cats = Object.entries(
    data.books.reduce<Record<string, number>>(
      (a, b) => ((a[b.category] = (a[b.category] || 0) + 1), a),
      {},
    ),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const total = Math.max(data.books.length, 1);
  return (
    <div className="wrap page">
      <div className="page-title split">
        <div>
          <p className="eyebrow">READING ANALYTICS</p>
          <h1>阅读洞察</h1>
          <p>数字不是成绩单，它只是另一种回望。</p>
        </div>
        <div className="stamp">
          更新于
          <br />
          <b>{data.syncedAt.toLocaleDateString("zh-CN")}</b>
        </div>
      </div>
      <div className="analytics-metrics">
        <Metric value={data.stats.readBooks} label="读过" icon={<Eye />} />
        <Metric
          value={data.stats.finishedBooks}
          label="读完"
          icon={<Check />}
        />
        <Metric
          value={formatDuration(data.stats.totalReadTime)}
          label="总阅读时长"
          icon={<Clock3 />}
        />
        <Metric
          value={data.stats.notes}
          label="笔记与想法"
          icon={<Feather />}
        />
      </div>
      <div className="insights-grid">
        <section className="panel wide">
          <PanelTitle en="READING TIMELINE" title="一年阅读时间线" />
          <div className="year-chart">
            {data.stats.monthlySeconds.map((v, i) => (
              <div key={i}>
                <span>{Math.round(v / 3600)}h</span>
                <i style={{ height: `${Math.max(5, (v / max) * 100)}%` }}></i>
                <small>{monthLabels[i]}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <PanelTitle en="CATEGORY" title="书架的构成" />
          <div className="cat-list">
            {cats.map(([c, n], i) => (
              <div key={c}>
                <p>
                  <span>
                    <i style={{ background: palette[i] }}></i>
                    {c}
                  </span>
                  <b>{n} 本</b>
                </p>
                <div>
                  <i
                    style={{
                      width: `${(n / total) * 100}%`,
                      background: palette[i],
                    }}
                  ></i>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="panel favorite">
          <PanelTitle en="MOST TIME WITH" title="相伴最久" />
          {data.stats.longest ? (
            <>
              <div className="fav-cover">
                {data.stats.longest.cover ? (
                  <img src={data.stats.longest.cover} />
                ) : (
                  <BookOpen />
                )}
              </div>
              <h3>{data.stats.longest.title}</h3>
              <p>{data.stats.longest.author}</p>
              <b>{formatDuration(data.stats.longest.seconds)}</b>
            </>
          ) : (
            <p>再读一会儿，这里就会出现答案。</p>
          )}
        </section>
      </div>
    </div>
  );
}
/** AI 洞察实验区管理生成任务、冷却时间、历史结果和登录态约束。 */
function AiInsightLab({
  data,
  session,
  connected,
  onAccess,
  aiLab,
  setAiLab,
}: {
  data: DashboardData;
  session: Session | null;
  connected: boolean;
  onAccess: () => void;
  aiLab: AiLabState;
  setAiLab: Dispatch<SetStateAction<AiLabState>>;
}) {
  const [mood, setMood] = useState("平静"),
    [freeTime, setFreeTime] = useState("30分钟"),
    [intensity, setIntensity] = useState("适中"),
    [continueReading, setContinueReading] = useState(true);
  const {
    loading,
    active,
    error,
    weekly,
    diagnosis,
    prescription,
    history,
    cooldownUntil,
    startedAt,
  } = aiLab;
  const [now, setNow] = useState(Date.now()),
    [historyOpen, setHistoryOpen] = useState<AiInsightType | null>(null),
    [historyLoading, setHistoryLoading] = useState<AiInsightType | null>(null),
    [mobileTool, setMobileTool] = useState<AiInsightType>(
      active || "weekly_themes",
    );
  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000)),
    elapsed = loading && startedAt ? Math.floor((now - startedAt) / 1000) : 0,
    busy = !!loading || cooldownLeft > 0;
  useEffect(() => {
    if (!cooldownLeft && !loading) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [cooldownLeft, loading]);
  const responseKey = (type: AiInsightType) =>
    type === "weekly_themes"
      ? "weekly"
      : type === "abandonment_diagnosis"
        ? "diagnosis"
        : "prescription";
  const activeResult =
    active === "weekly_themes"
      ? weekly
      : active === "abandonment_diagnosis"
        ? diagnosis
        : active === "prescription"
          ? prescription
          : null;
  const activeKind =
    active === "weekly_themes"
      ? "themes"
      : active === "abandonment_diagnosis"
        ? "diagnosis"
        : "prescription";
  const ready = () => {
    if (!session || !connected) {
      onAccess();
      return false;
    }
    return true;
  };
  async function loadHistory(type: AiInsightType) {
    if (!session || !connected) return;
    setHistoryOpen((current) => (current === type ? null : type));
    if (history[type]?.length) return;
    setHistoryLoading(type);
    try {
      const items = await getAiInsightHistory(session.token, type);
      setAiLab((current) => ({
        ...current,
        history: { ...current.history, [type]: items },
      }));
    } catch {
    } finally {
      setHistoryLoading((current) => (current === type ? null : current));
    }
  }
  const run = async (type: AiInsightType, payload: any) => {
    if (busy || !ready() || !session) return;
    const start = Date.now();
    setNow(start);
    setHistoryOpen(null);
    setAiLab((current) => ({
      ...current,
      active: type,
      startedAt: start,
      loading: type,
      error: "",
    }));
    try {
      const response = await generateAiInsight(session.token, type, payload);
      setAiLab((current) => ({
        ...current,
        active: type,
        [responseKey(type)]: response,
        history: {
          ...current.history,
          [type]: [
            response,
            ...(current.history[type] || []).filter(
              (item) => item.id !== response.id,
            ),
          ].slice(0, 10),
        },
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : "AI 洞察暂时不可用";
      const retryAfter = e instanceof ApiError ? e.retryAfter || 0 : 0;
      setAiLab((current) => ({
        ...current,
        active: type,
        error: message,
        cooldownUntil:
          retryAfter > 0
            ? Date.now() + retryAfter * 1000
            : message.includes("过于频繁") || message.includes("限流")
              ? Date.now() + 65000
            : current.cooldownUntil,
      }));
    } finally {
      setAiLab((current) => ({ ...current, loading: null, startedAt: 0 }));
    }
  };
  const buildWeeklyPayload = async () => {
    if (!session) return null;
    const report = await getReadingReport(session.token, "weekly"),
      s = report.snapshot;
    return {
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      stats: {
        totalReadTime: s.totalReadTime,
        readDays: s.readDays,
        newNotes: s.newNotes,
      },
      books: (s.books || []).slice(0, 12),
      highlights: (s.highlights || []).slice(0, 5),
      notes: (s.notes || []).slice(0, 5),
    };
  };
  const abandoned = () => {
    const now = Date.now();
    return data.books
      .filter((b) => !b.finished && b.id !== "mp-collection")
      .map((b) => ({
        bookId: b.id,
        title: b.title,
        author: b.author,
        category: b.category,
        wordCount: b.wordCount,
        lastRead: b.lastRead ? new Date(b.lastRead).toISOString() : null,
        daysSinceRead: b.lastRead
          ? Math.max(0, Math.round((now - b.lastRead) / 86400000))
          : null,
      }))
      .sort((a, b) => (b.daysSinceRead ?? 9999) - (a.daysSinceRead ?? 9999))
      .slice(0, 35);
  };
  const candidates = () =>
    data.books
      .filter((b) => b.id !== "mp-collection")
      .sort((a, b) => (b.lastRead || 0) - (a.lastRead || 0))
      .slice(0, 45)
      .map((b) => ({
        bookId: b.id,
        title: b.title,
        author: b.author,
        category: b.category,
        finished: b.finished,
        wordCount: b.wordCount,
        lastRead: b.lastRead ? new Date(b.lastRead).toISOString() : null,
      }));
  const pickHistory = (type: AiInsightType, item: AiInsightResponse) => {
    setMobileTool(type);
    setHistoryOpen(null);
    setAiLab((current) => ({
      ...current,
      active: type,
      [responseKey(type)]: item,
    }));
  };
  const runMobileTool = async () => {
    setHistoryOpen(null);
    if (mobileTool === "weekly_themes") {
      const payload = await buildWeeklyPayload();
      if (payload) await run(mobileTool, payload);
      return;
    }
    if (mobileTool === "abandonment_diagnosis") {
      await run(mobileTool, {
        generatedAt: new Date().toISOString(),
        candidates: abandoned(),
      });
      return;
    }
    await run(mobileTool, {
      mood,
      freeTime,
      intensity,
      continueReading,
      candidates: candidates(),
    });
  };
  const disabled = (type: AiInsightType) => busy && loading !== type;
  const showingActiveMobileResult =
    (Boolean(activeResult) && mobileTool === active) || loading === mobileTool;
  const mobileMatchesActive = mobileTool === active;
  const mobileHistory = history[mobileTool] || [];
  const lastWeekRange = getLastCompletedWeekMeta();
  const recentWeeklyBooks = data.books.filter(
    (book) =>
      book.lastRead &&
      book.lastRead >= lastWeekRange.start &&
      book.lastRead <= lastWeekRange.end,
  );
  const generatedThemeCount = Array.isArray(weekly?.result?.themes)
    ? weekly.result.themes.length
    : null;
  const diagnosisCandidateCount = abandoned().length;
  const mobileActionLabel =
    loading === mobileTool
      ? {
          weekly_themes: "正在生成主题…",
          abandonment_diagnosis: "正在分析阅读状态…",
          prescription: "正在生成阅读处方…",
        }[mobileTool]
      : showingActiveMobileResult
        ? {
            weekly_themes: "重新生成上周主题",
            abandonment_diagnosis: "重新生成阅读诊断",
            prescription: "重新生成阅读处方",
          }[mobileTool]
        : {
            weekly_themes: "生成上周主题",
            abandonment_diagnosis: "开始阅读诊断",
            prescription: "生成阅读处方",
          }[mobileTool];
  return (
    <section
      className={`wrap ai-insight-lab ai-insight-lab-v2${showingActiveMobileResult ? " has-current-insight" : ""}`}
    >
      <div className="ai-lab-head">
        <div>
          <p className="eyebrow">READING ASSISTANT</p>
          <h2>
            <span className="desktop-copy">阅读洞察实验室</span>
            <span className="mobile-copy">阅读洞察</span>
          </h2>
          <p className="desktop-copy">
            放在阅读洞察页里的三枚小工具：整理上周主题、诊断读不下去的书、从自己的书架开一张阅读处方。结果会在下方单独展开，原文依据与
            AI 内容明确分开。
          </p>
          <p className="mobile-copy">
            从你的书架与阅读中提炼线索，生成更适合手机阅读的个人洞察。
          </p>
        </div>
        <span>
          <Sparkles /> AI 模型：GLM-4.7
        </span>
      </div>
      {error && (
        <div className="board-notice">
          {cooldownLeft > 0 ? `${error} ${cooldownLeft} 秒后可重试。` : error}
          </div>
      )}
      <div className="ai-mobile-tool-tabs" role="tablist" aria-label="选择洞察工具">
        {[
          ["weekly_themes", "上周主题", <CalendarDays key="weekly" />],
          ["abandonment_diagnosis", "阅读诊断", <Search key="diagnosis" />],
          ["prescription", "阅读处方", <Lightbulb key="prescription" />],
        ].map(([type, label, icon]) => (
          <button
            key={String(type)}
            type="button"
            role="tab"
            aria-selected={mobileTool === type}
            className={mobileTool === type ? "active" : ""}
            onClick={() => {
              setMobileTool(type as AiInsightType);
              setHistoryOpen(null);
            }}
          >
            {icon as React.ReactNode}
            <span>{label as string}</span>
          </button>
        ))}
      </div>
      <div className="ai-mobile-panel-stack">
        {mobileTool === "weekly_themes" && (
          <MobileWeeklyThemePanel
            issue={lastWeekRange.issue}
            range={lastWeekRange.range}
            bookCount={recentWeeklyBooks.length}
            themeCount={generatedThemeCount}
            summary={weekly?.result?.summary}
          />
        )}
        {mobileTool === "abandonment_diagnosis" && (
          <MobileReadingDiagnosisPanel candidateCount={diagnosisCandidateCount} />
        )}
        {mobileTool === "prescription" && (
          <MobileReadingPrescriptionPanel
            mood={mood}
            freeTime={freeTime}
            intensity={intensity}
            continueReading={continueReading}
            onMoodChange={setMood}
            onFreeTimeChange={setFreeTime}
            onIntensityChange={setIntensity}
            onContinueReadingChange={setContinueReading}
          />
        )}
      </div>
      <div className="ai-card-grid">
        <div className={`ai-tool-mobile-pane ${mobileTool === "weekly_themes" ? "is-active" : ""}`}>
        <AiToolCard
          icon={<CalendarDays />}
          en="WEEKLY THEMES"
          title="上周阅读主题"
          description="整理上周书籍的核心话题和看点，梳理出主线，不在社交分享场景里夸张。"
          disabled={disabled("weekly_themes")}
          loading={loading === "weekly_themes"}
          button={
            cooldownLeft > 0 ? `${cooldownLeft} 秒后重试` : "生成上周主题"
          }
          onRun={async () => {
            const payload = await buildWeeklyPayload();
            payload && run("weekly_themes", payload);
          }}
          onHistory={() => loadHistory("weekly_themes")}
          historyOpen={historyOpen === "weekly_themes"}
          historyLoading={historyLoading === "weekly_themes"}
          history={history.weekly_themes || []}
          onPick={(item) =>
            setAiLab((current) => ({
              ...current,
              active: "weekly_themes",
              weekly: item,
            }))
          }
        />
        </div>
        <div className={`ai-tool-mobile-pane ${mobileTool === "abandonment_diagnosis" ? "is-active" : ""}`}>
        <AiToolCard
          icon={<Search />}
          en="ABANDONMENT"
          title="弃读诊断"
          description="只从读不动、没兴趣翻开的书里寻找线索，识别困难结，不会帮你正确读懂。"
          disabled={disabled("abandonment_diagnosis")}
          loading={loading === "abandonment_diagnosis"}
          button={
            cooldownLeft > 0 ? `${cooldownLeft} 秒后重试` : "分析读不下去的书"
          }
          onRun={() =>
            run("abandonment_diagnosis", {
              generatedAt: new Date().toISOString(),
              candidates: abandoned(),
            })
          }
          onHistory={() => loadHistory("abandonment_diagnosis")}
          historyOpen={historyOpen === "abandonment_diagnosis"}
          historyLoading={historyLoading === "abandonment_diagnosis"}
          history={history.abandonment_diagnosis || []}
          onPick={(item) =>
            setAiLab((current) => ({
              ...current,
              active: "abandonment_diagnosis",
              diagnosis: item,
            }))
          }
        />
        </div>
        <div className={`ai-tool-mobile-pane ${mobileTool === "prescription" ? "is-active" : ""}`}>
        <AiToolCard
          icon={<Lightbulb />}
          en="PRESCRIPTION"
          title="阅读处方"
          description="根据心情、兴趣和时间匹配，从自己的书架里筛选一本，给开始阅读建议，不推荐新书。"
          disabled={disabled("prescription")}
          loading={loading === "prescription"}
          button={
            cooldownLeft > 0 ? `${cooldownLeft} 秒后重试` : "生成一本书的处方"
          }
          onRun={() =>
            run("prescription", {
              mood,
              freeTime,
              intensity,
              continueReading,
              candidates: candidates(),
            })
          }
          onHistory={() => loadHistory("prescription")}
          historyOpen={historyOpen === "prescription"}
          historyLoading={historyLoading === "prescription"}
          history={history.prescription || []}
          onPick={(item) =>
            setAiLab((current) => ({
              ...current,
              active: "prescription",
              prescription: item,
            }))
          }
        >
          <div className="ai-form">
            <label>
              心情
              <select value={mood} onChange={(e) => setMood(e.target.value)}>
                {["平静", "焦虑", "疲惫", "低落", "好奇", "兴奋"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              时间
              <select
                value={freeTime}
                onChange={(e) => setFreeTime(e.target.value)}
              >
                {["10分钟", "30分钟", "1小时", "今晚", "长期阅读"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              类型
              <select
                value={intensity}
                onChange={(e) => setIntensity(e.target.value)}
              >
                {["轻松", "适中", "需要专注"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="checkline">
              <input
                type="checkbox"
                checked={continueReading}
                onChange={(e) => setContinueReading(e.target.checked)}
              />
              优先考虑未读书籍
            </label>
          </div>
        </AiToolCard>
        </div>
      </div>
      <div className="ai-mobile-result-controls" aria-label={`${aiShortTitle(mobileTool)}操作`}>
        <button type="button" className="primary" disabled={busy} onClick={runMobileTool}>
          <RefreshCw /> {mobileActionLabel}
        </button>
        <button
          type="button"
          className={historyOpen === mobileTool ? "active" : ""}
          aria-expanded={historyOpen === mobileTool}
          onClick={() => loadHistory(mobileTool)}
        >
          <History /> 历史记录
        </button>
      </div>
      {historyOpen === mobileTool && (
        <section className="ai-mobile-history-panel" aria-label={`${aiShortTitle(mobileTool)}历史记录`}>
          <header>
            <div>
              <p className="eyebrow">INSIGHT HISTORY</p>
              <h3>{aiShortTitle(mobileTool)}历史</h3>
            </div>
            <button type="button" onClick={() => setHistoryOpen(null)} aria-label="关闭历史记录">
              <X />
            </button>
          </header>
          {historyLoading === mobileTool ? (
            <p>正在读取历史…</p>
          ) : mobileHistory.length ? (
            <div>
              {mobileHistory.slice(0, 8).map((item) => (
                <button
                  type="button"
                  key={item.id || item.generatedAt}
                  onClick={() => pickHistory(mobileTool, item)}
                >
                  <span>
                    <b>{item.title || aiShortTitle(item.type)}</b>
                    <small>{new Date(item.generatedAt).toLocaleString("zh-CN")}</small>
                  </span>
                  <ChevronRight />
                </button>
              ))}
            </div>
          ) : (
            <p>还没有历史洞察。</p>
          )}
        </section>
      )}
      {(loading || activeResult) && (
        <section className={`ai-current-insight${mobileMatchesActive ? "" : " mobile-result-mismatch"}`}>
          <div className="ai-current-head">
            <div>
              <p className="eyebrow">CURRENT INSIGHT</p>
              <h3>
                {loading
                  ? "本次洞察正在生成"
                  : `${aiShortTitle(active || "prescription")} · 本次洞察`}
              </h3>
            </div>
            {activeResult?.generatedAt && (
              <time>
                {new Date(activeResult.generatedAt).toLocaleString("zh-CN")}
              </time>
            )}
          </div>
          {loading ? (
            <AiWorking title={aiJobTitle(loading)} elapsed={elapsed} />
          ) : (
            <AiResult response={activeResult} kind={activeKind} />
          )}
        </section>
      )}
    </section>
  );
}

function getLastCompletedWeekMeta() {
  const today = new Date();
  const dayFromMonday = (today.getDay() + 6) % 7;
  const currentMonday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - dayFromMonday,
  );
  const end = new Date(currentMonday);
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  const isoAnchor = new Date(
    Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()),
  );
  const isoDay = isoAnchor.getUTCDay() || 7;
  isoAnchor.setUTCDate(isoAnchor.getUTCDate() + 4 - isoDay);
  const yearStart = new Date(Date.UTC(isoAnchor.getUTCFullYear(), 0, 1));
  const issue = Math.ceil(
    ((isoAnchor.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return {
    issue,
    range: `${start.getMonth() + 1}.${start.getDate()} – ${end.getMonth() + 1}.${end.getDate()}`,
    start: start.getTime(),
    end: end.getTime() + 86400000 - 1,
  };
}

function MobileWeeklyThemePanel({
  issue,
  range,
  bookCount,
  themeCount,
  summary,
}: {
  issue: number;
  range: string;
  bookCount: number;
  themeCount: number | null;
  summary?: string;
}) {
  return (
    <article className="insight-mobile-panel weekly-panel">
      <header className="insight-panel-header">
        <div>
          <span className="insight-panel-icon">
            <CalendarDays />
          </span>
          <p className="eyebrow">WEEKLY THEME</p>
          <h3>上周阅读主题</h3>
        </div>
        <aside aria-label={`第 ${issue} 期，${range}`}>
          <b>第{issue}期</b>
          <span>{range}</span>
        </aside>
      </header>
      <p className="insight-panel-description">
        整理上周书籍的核心话题和看点，梳理出主线，不在社交分享场景里夸张。
      </p>
      <div className="weekly-metrics">
        <InsightMetric icon={<BookOpen />} label="关联书籍" value={`${bookCount} 本`} />
        <InsightMetric
          icon={<Feather />}
          label="核心主题"
          value={themeCount === null ? "待生成" : `${themeCount} 个`}
        />
      </div>
      <blockquote className="weekly-summary">
        <span>“</span>
        <p>
          {summary ||
            "生成后，会在这里汇总上周阅读中最清晰的一条主题线索。"}
        </p>
        <img
          src="/assets/insights/weekly-ink-landscape.webp"
          alt=""
          aria-hidden="true"
        />
      </blockquote>
    </article>
  );
}

function InsightMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="insight-metric">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <b>{value}</b>
      </div>
    </div>
  );
}

function MobileReadingDiagnosisPanel({
  candidateCount,
}: {
  candidateCount: number;
}) {
  const diagnosisItems = [
    {
      icon: <Search />,
      title: "内容匹配度",
      description: "检查主题与你当前兴趣和阅读需求的契合程度。",
    },
    {
      icon: <Clock3 />,
      title: "节奏与负担感",
      description: "结合停读时间、篇幅与阅读进度寻找阻力。",
    },
    {
      icon: <Bookmark />,
      title: "预期与现实差异",
      description: "辨认开始阅读前的期待与实际体验是否错位。",
    },
  ];
  return (
    <article className="insight-mobile-panel diagnosis-panel">
      <header className="diagnosis-hero">
        <div>
          <p className="eyebrow">DIAGNOSIS</p>
          <h3>弃读诊断</h3>
          <p>
            只从读不动、没兴趣翻开的书里寻找线索，识别困难结，不会帮你正确读懂。
          </p>
        </div>
        <img
          src="/assets/insights/diagnosis-leaf-pages.webp"
          alt=""
          aria-hidden="true"
        />
      </header>
      <div className="diagnosis-summary-head">
        <b>诊断摘要</b>
        <span>
          {candidateCount
            ? `基于近期停读的 ${candidateCount} 本书`
            : "暂时没有可分析的停读书籍"}
        </span>
      </div>
      <div className="diagnosis-items">
        {diagnosisItems.map((item) => (
          <div className="diagnosis-item" key={item.title}>
            <span className="diagnosis-item-icon">{item.icon}</span>
            <div>
              <b>{item.title}</b>
              <small>{item.description}</small>
            </div>
            <em>{candidateCount ? "待分析" : "暂无"}</em>
            <ChevronRight aria-hidden="true" />
          </div>
        ))}
      </div>
    </article>
  );
}

function MobileReadingPrescriptionPanel({
  mood,
  freeTime,
  intensity,
  continueReading,
  onMoodChange,
  onFreeTimeChange,
  onIntensityChange,
  onContinueReadingChange,
}: {
  mood: string;
  freeTime: string;
  intensity: string;
  continueReading: boolean;
  onMoodChange: (value: string) => void;
  onFreeTimeChange: (value: string) => void;
  onIntensityChange: (value: string) => void;
  onContinueReadingChange: (value: boolean) => void;
}) {
  return (
    <article className="insight-mobile-panel prescription-panel">
      <header className="prescription-hero">
        <div>
          <p className="eyebrow">PRESCRIPTION</p>
          <h3>阅读处方</h3>
          <p>
            根据心情、兴趣和时间匹配，从自己的书架里筛选一本，给开始阅读建议，不推荐新书。
          </p>
        </div>
        <img
          src="/assets/insights/prescription-pen-paper.webp"
          alt=""
          aria-hidden="true"
        />
      </header>
      <div className="prescription-fields">
        <PrescriptionSelectItem
          icon={<Lightbulb />}
          label="心情状态"
          value={mood}
          options={["平静", "焦虑", "疲惫", "低落", "好奇", "兴奋"]}
          onChange={onMoodChange}
        />
        <PrescriptionSelectItem
          icon={<Clock3 />}
          label="可用时间"
          value={freeTime}
          options={["10分钟", "30分钟", "1小时", "今晚", "长期阅读"]}
          onChange={onFreeTimeChange}
        />
        <PrescriptionSelectItem
          icon={<Feather />}
          label="阅读强度"
          value={intensity}
          options={["轻松", "适中", "需要专注"]}
          onChange={onIntensityChange}
        />
        <label className="prescription-check-item">
          <BookOpen />
          <span>
            <small>选书范围</small>
            <b>{continueReading ? "优先考虑未读书籍" : "包含已读书籍"}</b>
          </span>
          <input
            type="checkbox"
            checked={continueReading}
            onChange={(event) => onContinueReadingChange(event.target.checked)}
          />
          <i aria-hidden="true" />
        </label>
      </div>
    </article>
  );
}

function PrescriptionSelectItem({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="prescription-select-item">
      {icon}
      <span>
        <small>{label}</small>
        <b>{value}</b>
      </span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" />
    </label>
  );
}

function AiToolCard({
  icon,
  en,
  title,
  description,
  button,
  disabled,
  loading,
  onRun,
  onHistory,
  historyOpen,
  historyLoading,
  history,
  onPick,
  children,
}: {
  icon: React.ReactNode;
  en: string;
  title: string;
  description: string;
  button: string;
  disabled: boolean;
  loading: boolean;
  onRun: () => void;
  onHistory: () => void;
  historyOpen: boolean;
  historyLoading: boolean;
  history: AiInsightResponse[];
  onPick: (item: AiInsightResponse) => void;
  children?: React.ReactNode;
}) {
  return (
    <article className="ai-tool-card">
      <div>
        <span className="ai-tool-icon">{icon}</span>
        <p className="eyebrow">{en}</p>
        <h3>{title}</h3>
        <p>{description}</p>
        {children}
        <button
          className="primary"
          disabled={disabled || loading}
          onClick={onRun}
        >
          {loading ? "生成中…" : button} <ArrowRight />
        </button>
      </div>
      <div className="ai-history-box">
        <button className="ai-history-toggle" onClick={onHistory}>
          <History size={15} /> 查看历史消息 <ChevronRight size={15} />
        </button>
        {historyOpen && (
          <div className="ai-history-list">
            {historyLoading ? (
              <span>正在读取历史…</span>
            ) : history.length ? (
              history.slice(0, 4).map((item) => (
                <button
                  key={item.id || item.generatedAt}
                  onClick={() => onPick(item)}
                >
                  <i></i>
                  <span>
                    {item.title || aiShortTitle(item.type)}
                    <small>
                      {new Date(item.generatedAt).toLocaleString("zh-CN")}
                    </small>
                  </span>
                  <b className="more-dots">•••</b>
                </button>
              ))
            ) : (
              <span>还没有历史洞察。</span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
function aiShortTitle(type: AiInsightType) {
  return type === "weekly_themes"
    ? "上周阅读主题"
    : type === "abandonment_diagnosis"
      ? "弃读诊断"
      : "阅读处方";
}
function aiJobTitle(type: AiInsightType) {
  return type === "weekly_themes"
    ? "正在整理上周阅读主题"
    : type === "abandonment_diagnosis"
      ? "正在分析读不下去的书"
      : "正在从你的书架开方";
}
function AiGlobalStatus({
  aiLab,
  onOpen,
  hidden,
}: {
  aiLab: AiLabState;
  onOpen: () => void;
  hidden: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!aiLab.loading) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [aiLab.loading]);
  if (!aiLab.loading || hidden) return null;
  const elapsed = aiLab.startedAt
    ? Math.floor((now - aiLab.startedAt) / 1000)
    : 0;
  return (
    <button className="ai-global-status" onClick={onOpen}>
      <RefreshCw className="spin" />
      <span>
        <b>{aiJobTitle(aiLab.loading)}</b>
        <small>已等待 {elapsed} 秒，完成后会自动回填结果</small>
      </span>
      <ArrowRight />
    </button>
  );
}
function AiWorking({ title, elapsed }: { title: string; elapsed: number }) {
  const step =
    elapsed < 12
      ? "正在整理输入数据"
      : elapsed < 45
        ? "模型正在阅读你的书架"
        : elapsed < 90
          ? "正在生成结果"
          : "仍在等待智谱返回结果";
  return (
    <div className="ai-working">
      <div>
        <RefreshCw className="spin" />
        <b>{title}</b>
        <span>已等待 {elapsed} 秒 · 通常需要 1～2 分钟</span>
      </div>
      <i>
        <em style={{ width: `${Math.min(92, 18 + elapsed * 1.4)}%` }} />
      </i>
      <p>{step}，页面没有卡住，可以先停在这里。</p>
      <div className="ai-skeleton">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
}
function AiResult({
  response,
  kind,
}: {
  response: AiInsightResponse | null;
  kind: "themes" | "diagnosis" | "prescription";
}) {
  if (!response) return null;
  if (response.message)
    return <div className="ai-result muted">{response.message}</div>;
  const result = response.result || {};
  if (result.text)
    return (
      <div className={`ai-result ai-result-${kind}`}>
        <p>{result.text}</p>
      </div>
    );
  if (kind === "themes")
    return (
      <div className="ai-result ai-result-themes">
        <div className="ai-result-head">
          <span>THEME NOTES</span>
          <b>{result.summary || "上周主题整理"}</b>
        </div>
        {(result.themes || []).map((t: any, i: number) => (
          <section key={i}>
            <h4>
              <i>{String(i + 1).padStart(2, "0")}</i>
              {t.title}
            </h4>
            <p>{t.analysis}</p>
            {t.evidence?.length > 0 && (
              <blockquote>
                <b>原文依据</b>
                {t.evidence.map((e: string, j: number) => (
                  <span key={j}>{e}</span>
                ))}
              </blockquote>
            )}
          </section>
        ))}
        <small>{result.boundary}</small>
      </div>
    );
  if (kind === "diagnosis")
    return (
      <div className="ai-result ai-result-diagnosis">
        <div className="ai-result-head">
          <span>READING PAUSE</span>
          <b>{result.summary || "可能卡住的书"}</b>
        </div>
        {(result.items || []).map((item: any, i: number) => (
          <section key={i}>
            <h4>
              <i>{String(i + 1).padStart(2, "0")}</i>
              {item.title}
            </h4>
            <p>{item.reason}</p>
            <em>{item.suggestion}</em>
          </section>
        ))}
        <small>{result.boundary}</small>
      </div>
    );
  return (
    <div className="ai-result ai-result-prescription">
      <header>
        <div className="ai-rx-mark">Rx</div>
        <div>
          <span>READING PRESCRIPTION</span>
          <h4>{result.title}</h4>
          <p>从你的书架里挑出的一本当前可读之书。</p>
        </div>
      </header>
      <div className="rx-prescription-grid">
        <section>
          <span>推荐原因</span>
          <p>{result.reason}</p>
        </section>
        <section>
          <span>开始方式</span>
          <p>{result.howToRead}</p>
        </section>
      </div>
      <small>
        {result.avoidClaim || "此建议仅供阅读参考，不构成心理或医疗建议。"}
      </small>
    </div>
  );
}
function PanelTitle({ en, title }: { en: string; title: string }) {
  return (
    <div className="panel-title">
      <p>{en}</p>
      <h2>{title}</h2>
    </div>
  );
}

/** 留言板允许游客浏览，但发布和删除操作必须携带登录会话。 */
function Community({
  session,
  onLogin,
}: {
  session: Session | null;
  onLogin: () => void;
}) {
  const [messages, setMessages] = useState<BoardMessage[]>([]),
    [content, setContent] = useState(""),
    [notice, setNotice] = useState(""),
    [sending, setSending] = useState(false);
  const refresh = () =>
    listMessages()
      .then((r) => {
        setMessages(r.content);
        setNotice("");
      })
      .catch(() => setNotice("留言板将在 Java 后端启动后开放。"));
  useEffect(() => {
    refresh();
  }, []);
  const submit = async () => {
    if (!session) {
      onLogin();
      return;
    }
    if (!content.trim()) return;
    setSending(true);
    try {
      const item = await postMessage(session.token, content.trim());
      setMessages((x) => [item, ...x]);
      setContent("");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "发布失败");
    } finally {
      setSending(false);
    }
  };
  const remove = async (id: number) => {
    if (!session) return;
    try {
      await removeMessage(session.token, id);
      setMessages((x) => x.filter((m) => m.id !== id));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "删除失败");
    }
  };
  return (
    <div className="wrap page community-page">
      <div className="page-title split">
        <div>
          <p className="eyebrow">READERS' COMMON ROOM</p>
          <h1>读者留言板</h1>
          <p>聊聊刚读完的书，也交换下一次出发的方向。</p>
        </div>
        <MessageSquare size={48} />
      </div>
      <section className="composer">
        <div className="avatar">
          {session?.displayName?.slice(0, 1) || "游"}
        </div>
        <div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, 1000))}
            placeholder={
              session
                ? "写下此刻想和大家分享的阅读片段…"
                : "登录后，和这里的读者打个招呼…"
            }
            onFocus={() => !session && onLogin()}
          />
          <div>
            <small>
              {content.length}/1000 · 请勿发布 API Key、密码或其他隐私信息
            </small>
            <button
              className="primary"
              disabled={sending || !content.trim()}
              onClick={submit}
            >
              {sending ? "正在发布" : "发布留言"} <ArrowRight />
            </button>
          </div>
        </div>
      </section>
      {notice && <div className="board-notice">{notice}</div>}
      <div className="message-list">
        {messages.map((m) => (
          <article className="message-card" key={m.id}>
            <div className="avatar">{m.author.slice(0, 1)}</div>
            <div>
              <header>
                <b>{m.author}</b>
                <span>
                  @{m.username} ·{" "}
                  {new Date(m.createdAt).toLocaleString("zh-CN")}
                </span>
              </header>
              <p>{m.content}</p>
            </div>
            {session?.username === m.username && (
              <button
                className="delete-message"
                onClick={() => remove(m.id)}
                title="删除自己的留言"
              >
                <Trash2 />
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

/** 登录注册弹窗串联密码校验、邀请码和高风险登录时的滑块验证。 */
function AuthModal({
  onClose,
  onAuthenticated,
}: {
  onClose: () => void;
  onAuthenticated: (s: Session, remember: boolean) => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login"),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [email, setEmail] = useState(""),
    [displayName, setDisplayName] = useState(""),
    [invitationCode, setInvitationCode] = useState(""),
    [captchaRequired, setCaptchaRequired] = useState(false),
    [captchaToken, setCaptchaToken] = useState(""),
    [captchaRevision, setCaptchaRevision] = useState(0),
    [retrySeconds, setRetrySeconds] = useState(0),
    [rememberLogin, setRememberLogin] = useState(() => localStorage.getItem(REMEMBER_LOGIN_KEY) === "true"),
    [quote, setQuote] = useState<DailyQuote | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const previous = sessionStorage.getItem("inkshelf-last-login-quote") || "";
    getDailyQuote(previous).then((item) => {
      if (cancelled) return;
      setQuote(item);
      sessionStorage.setItem("inkshelf-last-login-quote", item.id);
    }).catch(() => {
      if (!cancelled) setQuote({ id: "fallback", text: "读书不觉已春深，一寸光阴一寸金。", author: "王贞白", work: "《白鹿洞二首》" });
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (retrySeconds <= 0) return;
    const timer = window.setInterval(
      () => setRetrySeconds((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [retrySeconds > 0]);
  const changeMode = (next: "login" | "register") => {
    setMode(next);
    setCaptchaRequired(false);
    setCaptchaToken("");
    setCaptchaRevision((value) => value + 1);
    setError("");
  };
  const refreshCaptcha = () => {
    setCaptchaToken("");
    setCaptchaRevision((value) => value + 1);
  };
  const submit = async () => {
    if (retrySeconds > 0) return;
    if (mode === "login" && captchaRequired && !captchaToken) {
      setError("请先完成滑块验证");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const s =
        mode === "login"
          ? await login({
              username,
              password,
              captchaToken: captchaToken || undefined,
            })
          : await register({
              username,
              password,
              email,
              displayName,
              invitationCode: invitationCode.trim().toUpperCase(),
            });
      onAuthenticated(s, rememberLogin);
    } catch (e) {
      if (mode === "login" && captchaRequired) refreshCaptcha();
      if (e instanceof ApiError) {
        if (e.code === "CAPTCHA_REQUIRED") {
          setCaptchaRequired(true);
          setCaptchaToken("");
        }
        if (e.retryAfter) setRetrySeconds(Math.ceil(e.retryAfter));
      }
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form className="modal auth-modal" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <button type="button" className="modal-x" onClick={onClose}>
          <X />
        </button>
        <span className="modal-icon">
          <UserRound />
        </span>
        <p className="eyebrow">YOUR PRIVATE LIBRARY</p>
        <h2>{mode === "login" ? "欢迎回来" : "创建墨架账户"}</h2>
        <p>
          {mode === "login"
            ? "登录后导入自己的微信读书数据，并参与读者交流。"
            : "你的书架默认私密；只有主动发布的留言会出现在公共区域。"}
        </p>
        <figure className="auth-quote" aria-live="polite">
          <blockquote>{quote ? `“${quote.text}”` : "正在翻开今日的一页……"}</blockquote>
          <figcaption>{quote ? `${quote.author} · ${quote.work}` : "墨架"}</figcaption>
        </figure>
        <div className="auth-switch">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => changeMode("login")}
          >
            登录
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => changeMode("register")}
          >
            注册
          </button>
        </div>
        {mode === "register" && (
          <>
            <label className="form-field">
              <span>昵称</span>
              <input
                id="register-display-name"
                name="nickname"
                autoComplete="nickname"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={40}
                placeholder="大家会看到的名字"
              />
            </label>
            <label className="form-field">
              <span>邮箱</span>
              <input
                id="register-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </label>
            <label className="form-field">
              <span>邀请码</span>
              <input
                id="register-invitation-code"
                name="invitationCode"
                value={invitationCode}
                onChange={(e) =>
                  setInvitationCode(e.target.value.toUpperCase().slice(0, 14))
                }
                maxLength={14}
                placeholder="K8F2-X91M-PQ73"
                autoComplete="off"
              />
              <small>注册目前仅向持有管理员邀请码的用户开放。</small>
            </label>
          </>
        )}
        <label className="form-field">
          <span>用户名</span>
          <input
            id="auth-username"
            name="username"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setCaptchaToken("");
            }}
            placeholder="3–32 位字母、数字或下划线"
          />
        </label>
        <label className="form-field">
          <span>密码</span>
          <input
            id="auth-password"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (captchaToken) refreshCaptcha();
            }}
            placeholder="至少 8 位"
          />
        </label>
        {mode === "login" && <div className="auth-remember-row">
          <label><input type="checkbox" checked={rememberLogin} onChange={(event) => setRememberLogin(event.target.checked)}/><span><Check size={12}/></span><b>记住我</b></label>
          <small>密码由浏览器安全保存，墨架不保存明文</small>
        </div>}
        {mode === "login" && captchaRequired && (
          <SliderCaptcha
            key={`${username}:${captchaRevision}`}
            username={username}
            onVerified={(token) => {
              setCaptchaToken(token);
              setError("");
            }}
          />
        )}
        {error && <p className="error">{error}</p>}
        <button
          type="submit"
          className="primary full"
          disabled={
            busy ||
            retrySeconds > 0 ||
            !username ||
            password.length < 8 ||
            (mode === "login" && captchaRequired && !captchaToken) ||
            (mode === "register" &&
              (!email ||
                !displayName ||
                !/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(invitationCode)))
          }
        >
          {busy
            ? "请稍候…"
            : retrySeconds > 0
              ? `${retrySeconds} 秒后重试`
              : mode === "login"
                ? "登录"
                : "使用邀请码注册并登录"}{" "}
          {!busy && retrySeconds === 0 && <ArrowRight />}
        </button>
        <small className="privacy">
          继续即表示你已阅读并同意隐私政策与 API Key 使用说明。
        </small>
      </form>
    </div>
  );
}

/** 滑块组件采集位移、耗时和移动次数，交由服务端完成最终验证。 */
function SliderCaptcha({
  username,
  onVerified,
}: {
  username: string;
  onVerified: (token: string) => void;
}) {
  const [challenge, setChallenge] = useState<SliderChallenge | null>(null),
    [offset, setOffset] = useState(0),
    [status, setStatus] = useState("正在准备滑块…"),
    [loading, setLoading] = useState(false);
  const startedAt = useRef(0),
    movements = useRef(0);
  const load = async () => {
    if (!username.trim()) return;
    setLoading(true);
    setOffset(0);
    onVerified("");
    try {
      setChallenge(await createSliderChallenge(username));
      setStatus("拖动滑块，让拼图对准缺口");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "滑块暂时不可用");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [username]);
  const verify = async () => {
    if (!challenge || !startedAt.current || loading) return;
    setLoading(true);
    try {
      const result = await verifySliderChallenge({
        challengeId: challenge.challengeId,
        username,
        offset,
        durationMs: Date.now() - startedAt.current,
        movementCount: movements.current,
      });
      onVerified(result.verificationToken);
      setStatus("验证通过，可以继续登录");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "验证失败，请重试");
      setChallenge(null);
      window.setTimeout(load, 500);
    } finally {
      setLoading(false);
    }
  };
  const verified = status.startsWith("验证通过");
  return (
    <div
      className={`slider-captcha ${challenge && verified ? "verified" : ""}`}
    >
      <div className="captcha-title">
        <span>
          <LockKeyhole size={14} /> 人机验证
        </span>
        <button onClick={load} disabled={loading}>
          换一张
        </button>
      </div>
      {challenge && (
        <>
          <div
            className="captcha-stage"
            aria-label="拼图预览区域"
            style={{
              aspectRatio: `${challenge.trackWidth}/${challenge.imageHeight}`,
            }}
          >
            <img src={challenge.background} alt="滑块验证背景" />
            <img
              className="captcha-piece"
              src={challenge.piece}
              alt="移动的拼图块"
              style={{
                left: `${(offset / challenge.trackWidth) * 100}%`,
                top: `${(challenge.pieceY / challenge.imageHeight) * 100}%`,
                width: `${(challenge.pieceSize / challenge.trackWidth) * 100}%`,
              }}
            />
            <span className="captcha-preview-hint">
              下方拖动滑块，使拼图对准缺口
            </span>
          </div>
          <div
            className={`captcha-slider-control ${verified ? "is-verified" : ""}`}
          >
            <span className="captcha-slider-copy">
              {verified ? "验证完成" : "按住滑块向右拖动"}
            </span>
            <input
              aria-label="按住下方滑块向右拖动，使拼图对准缺口"
              type="range"
              min="0"
              max={challenge.trackWidth - challenge.pieceSize}
              value={offset}
              disabled={loading || verified}
              onFocus={() => {
                if (!startedAt.current) startedAt.current = Date.now();
              }}
              onPointerDown={() => {
                startedAt.current = Date.now();
                movements.current = 0;
              }}
              onChange={(e) => {
                setOffset(Number(e.target.value));
                movements.current++;
              }}
              onPointerUp={verify}
            />
          </div>
          <button
            className="captcha-confirm"
            disabled={loading || offset === 0 || verified}
            onClick={verify}
          >
            确认位置
          </button>
        </>
      )}
      <small>{status}</small>
    </div>
  );
}

/** 微信读书连接弹窗只在提交时短暂持有 API Key，不写入浏览器存储。 */
function ConnectModal({
  loading,
  error,
  onClose,
  onConnect,
}: {
  loading: boolean;
  error: string;
  onClose: () => void;
  onConnect: (k: string) => void;
}) {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal">
        <button className="modal-x" onClick={onClose}>
          <X />
        </button>
        <span className="modal-icon">
          <KeyRound />
        </span>
        <p className="eyebrow">CONNECT YOUR LIBRARY</p>
        <h2>连接微信读书</h2>
        <p>
          输入在微信读书设置中获取的 API Key。服务端会验证后使用 AES-256-GCM
          加密保存，供你下次同步使用。
        </p>
        <label className="key-input">
          <LockKeyhole />
          <input
            autoFocus
            type={show ? "text" : "password"}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="wrk-••••••••••••••••"
          />
          <button onClick={() => setShow(!show)}>
            {show ? <EyeOff /> : <Eye />}
          </button>
        </label>
        {error && <p className="error">{error}</p>}
        <button
          className="primary full"
          disabled={loading || !/^wrk-/.test(key)}
          onClick={() => onConnect(key)}
        >
          {loading ? "正在整理你的书架…" : "安全保存并导入数据"}{" "}
          {!loading && <ArrowRight />}
        </button>
        <small className="privacy">
          Key 不会公开展示或写入日志，你可以随时解除绑定。
        </small>
      </div>
    </div>
  );
}

export default App;
