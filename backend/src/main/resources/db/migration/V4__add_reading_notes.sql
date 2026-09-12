-- 第一阶段阅读记忆：笔记本概览、单书笔记内容与同步状态。
CREATE TABLE IF NOT EXISTS weread_notebook (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  book_id VARCHAR(64) NOT NULL,
  title VARCHAR(300) NOT NULL,
  author VARCHAR(300),
  cover_url TEXT,
  review_count INTEGER NOT NULL DEFAULT 0,
  note_count INTEGER NOT NULL DEFAULT 0,
  bookmark_count INTEGER NOT NULL DEFAULT 0,
  reading_progress INTEGER NOT NULL DEFAULT 0,
  marked_status INTEGER NOT NULL DEFAULT 0,
  source_sort BIGINT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_weread_notebook_user_book UNIQUE(user_id, book_id)
);

CREATE TABLE IF NOT EXISTS weread_note (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  book_id VARCHAR(64) NOT NULL,
  source_id VARCHAR(128) NOT NULL,
  note_type VARCHAR(24) NOT NULL,
  chapter_uid VARCHAR(64),
  chapter_title VARCHAR(500),
  original_text TEXT,
  content TEXT,
  source_range VARCHAR(128),
  source_created_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_weread_note_user_source UNIQUE(user_id, source_id, note_type)
);

CREATE TABLE IF NOT EXISTS note_sync_state (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  scope VARCHAR(96) NOT NULL,
  cursor_value VARCHAR(128),
  status VARCHAR(16) NOT NULL DEFAULT 'IDLE',
  last_attempt_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  error_code VARCHAR(64),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_note_sync_state_user_scope UNIQUE(user_id, scope)
);

CREATE INDEX IF NOT EXISTS idx_weread_notebook_user_book ON weread_notebook(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_weread_notebook_user_synced ON weread_notebook(user_id, synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_weread_note_user_book ON weread_note(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_weread_note_user_created ON weread_note(user_id, source_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_note_sync_state_user_status ON note_sync_state(user_id, status);

COMMENT ON TABLE weread_notebook IS '用户微信读书笔记本概览，每本有笔记的书一条记录';
COMMENT ON COLUMN weread_notebook.user_id IS '数据所属用户，用于强制隔离';
COMMENT ON COLUMN weread_notebook.book_id IS '微信读书书籍 ID';
COMMENT ON COLUMN weread_notebook.review_count IS '想法和点评数量，已包含个人书评';
COMMENT ON COLUMN weread_notebook.note_count IS '划线原文数量，不等于总笔记数';
COMMENT ON COLUMN weread_notebook.bookmark_count IS '书签数量；微信读书当前不提供书签正文';
COMMENT ON COLUMN weread_notebook.source_sort IS '微信读书笔记本游标排序值';

COMMENT ON TABLE weread_note IS '用户私密的划线、想法、章节点评和整本书评内容';
COMMENT ON COLUMN weread_note.source_id IS '微信读书侧划线或点评唯一 ID';
COMMENT ON COLUMN weread_note.note_type IS 'HIGHLIGHT、THOUGHT、CHAPTER_REVIEW 或 BOOK_REVIEW';
COMMENT ON COLUMN weread_note.original_text IS '划线原文；禁止写入应用日志';
COMMENT ON COLUMN weread_note.content IS '用户想法或点评正文；禁止写入应用日志';

COMMENT ON TABLE note_sync_state IS '按用户和同步范围记录游标、状态与安全错误码';
COMMENT ON COLUMN note_sync_state.scope IS 'NOTEBOOKS 或 BOOK:{bookId}';
COMMENT ON COLUMN note_sync_state.cursor_value IS '微信读书分页游标，不包含正文';
COMMENT ON COLUMN note_sync_state.error_code IS '脱敏错误类别，不保存异常详情';
