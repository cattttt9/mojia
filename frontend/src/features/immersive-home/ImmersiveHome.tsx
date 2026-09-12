import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { ArrowRight, BookOpen, KeyRound, LogIn, X } from "lucide-react";
import type { Session } from "../../platformApi";
import type { ShelfBook } from "../../types";
import { curatedBooks } from "./curatedBooks";
import { useReducedMotion } from "./hooks/useReducedMotion";
import type { UniversePhase } from "./scene/BookUniverseCanvas";
import "./immersive-home.css";

const BookUniverseCanvas = lazy(() => import("./scene/BookUniverseCanvas"));

type HoveredBook = {
  book: ShelfBook;
  x: number;
  y: number;
} | null;

type AccessPrompt = "login" | "connect" | "featured" | null;

type Props = {
  books: ShelfBook[];
  session: Session | null;
  connected: boolean;
  loading: boolean;
  playIntro: boolean;
  settleCopy: boolean;
  personalTransitionToken: number;
  onOpenBook: (book: ShelfBook) => void;
  onLogin: () => void;
  onConnect: () => void;
  onOverview: () => void;
};

function readingStatus(book: ShelfBook) {
  if (book.finished) return "已读完";
  if (book.lastRead) return book.progress ? `在读 · ${book.progress}%` : "正在读";
  return "尚未开始";
}

function AccessDialog({
  mode,
  onClose,
  onLogin,
  onConnect,
}: {
  mode: Exclude<AccessPrompt, null>;
  onClose: () => void;
  onLogin: () => void;
  onConnect: () => void;
}) {
  const loginMode = mode === "login";
  const featuredMode = mode === "featured";
  return (
    <div
      className="immersive-access-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="immersive-access-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="immersive-access-title"
      >
        <button className="immersive-dialog-close" onClick={onClose} aria-label="关闭">
          <X />
        </button>
        <span className="immersive-dialog-icon">
          {loginMode ? <LogIn /> : featuredMode ? <BookOpen /> : <KeyRound />}
        </span>
        <p className="immersive-kicker">YOUR READING UNIVERSE</p>
        <h2 id="immersive-access-title">
          {loginMode
            ? "登录后，展开属于你的阅读宇宙"
            : featuredMode
              ? "这是墨架为你补充的一本精选书"
              : "让你的书架在这里生长"}
        </h2>
        <p>
          {loginMode
            ? "眼前暂时是墨架为你准备的精选书页。登录并连接微信读书后，你读过的书会自然散开、重新汇聚。"
            : featuredMode
              ? "当个人书架不足 44 本时，墨架会用精选书籍补齐星体轮廓。它只参与首页展示，不会写入你的个人书架。"
              : "你的墨架账户已经准备好。连接微信读书后，真实书籍会代替精选书单在这里重新成形。"}
        </p>
        <div>
          <button
            className="immersive-primary"
            onClick={() => {
              onClose();
              if (loginMode) onLogin();
              else if (!featuredMode) onConnect();
            }}
          >
            {loginMode ? "登录 / 注册" : featuredMode ? "知道了" : "连接微信读书"}
            {!featuredMode && <ArrowRight />}
          </button>
          <button className="immersive-quiet" onClick={onClose}>
            先继续看看
          </button>
        </div>
      </section>
    </div>
  );
}

export default function ImmersiveHome({
  books,
  session,
  connected,
  loading,
  playIntro,
  settleCopy,
  personalTransitionToken,
  onOpenBook,
  onLogin,
  onConnect,
  onOverview,
}: Props) {
  const reducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState<HoveredBook>(null);
  const [prompt, setPrompt] = useState<AccessPrompt>(null);
  const [phase, setPhase] = useState<UniversePhase>(reducedMotion ? "idle" : "intro");
  const [canvasReady, setCanvasReady] = useState(false);

  // 先绘制标题和操作入口，再加载体积较大的 Three.js 场景，缩短首屏可见时间。
  useEffect(() => {
    const timer = window.setTimeout(() => setCanvasReady(true), 600);
    return () => window.clearTimeout(timer);
  }, []);

  const selectBook = useCallback(
    (book: ShelfBook, source: "featured" | "personal") => {
      if (loading) return;
      if (source === "personal" && session && connected) {
        onOpenBook(book);
        return;
      }
      if (!session) {
        setPrompt("login");
        return;
      }
      if (!connected) setPrompt("connect");
      else setPrompt("featured");
    },
    [connected, loading, onOpenBook, session],
  );

  const primaryAction = () => {
    if (loading) return;
    if (!session) onLogin();
    else if (!connected) onConnect();
    else onOverview();
  };

  const primaryLabel = loading
    ? "正在打开你的书架"
    : !session
    ? "登录，展开我的宇宙"
    : connected
      ? "进入我的书房"
      : "连接我的微信读书";

  const statusText = loading
    ? "正在读取你的书架"
    : connected && (phase === "dispersing" || phase === "assembling")
      ? "你的阅读宇宙正在重新汇聚"
      : connected
        ? `${books.length} 本书，正在缓慢生长`
        : "当前展示墨架精选书单";

  return (
    <section
      className={`immersive-home${settleCopy ? " immersive-home-copy-settled" : ""}`}
    >
      <div className="immersive-backdrop" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      {canvasReady ? (
        <Suspense fallback={<div className="universe-loading" aria-hidden="true" />}>
          <BookUniverseCanvas
            featuredBooks={curatedBooks}
            personalBooks={books}
            personalReady={connected}
            playIntro={playIntro}
            personalTransitionToken={personalTransitionToken}
            reducedMotion={reducedMotion}
            onBookSelect={selectBook}
            onHover={setHovered}
            onPhaseChange={setPhase}
          />
        </Suspense>
      ) : (
        <div className="universe-loading" aria-hidden="true" />
      )}

      <div className="immersive-copy">
        <p className="immersive-kicker">INKSHELF · A LIVING READING ARCHIVE</p>
        <h1>
          <span>读过的每一页，</span>
          <span>都在形成你的宇宙。</span>
        </h1>
        <p className="immersive-lead">
          墨架把散落的阅读时光收拢起来，让书、划线与记忆彼此靠近，成为一座只属于你的知识星体。
        </p>
        <div className="immersive-actions">
          <button className="immersive-primary" onClick={primaryAction} disabled={loading}>
            {primaryLabel} <ArrowRight />
          </button>
          <button className="immersive-quiet" onClick={onOverview}>
            <BookOpen /> 看看书房概览
          </button>
        </div>
      </div>

      <div className="immersive-status" aria-live="polite">
        <i className={phase === "idle" ? "settled" : ""} />
        <span>{statusText}</span>
        {!reducedMotion && <small>移动鼠标探索 · 滚轮轻轻转动</small>}
      </div>

      {hovered && (
        <div
          className="immersive-tooltip"
          style={{
            left: Math.min(hovered.x + 18, window.innerWidth - 238),
            top: Math.min(hovered.y + 18, window.innerHeight - 104),
          }}
          role="status"
        >
          <b>{hovered.book.title}</b>
          <span>{hovered.book.author}</span>
          <small>
            {!connected || hovered.book.id.startsWith("curated-fill:")
              ? "墨架精选"
              : readingStatus(hovered.book)}
          </small>
        </div>
      )}

      {prompt && (
        <AccessDialog
          mode={prompt}
          onClose={() => setPrompt(null)}
          onLogin={onLogin}
          onConnect={onConnect}
        />
      )}
    </section>
  );
}
