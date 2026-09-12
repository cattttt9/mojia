-- 阅读星图 V1：缓存用户自己的书籍画像，以及用户明确隐藏的错误关联。
CREATE TABLE IF NOT EXISTS reading_star_book_profile (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  book_id VARCHAR(64) NOT NULL,
  title VARCHAR(300) NOT NULL,
  author VARCHAR(300),
  category VARCHAR(300),
  cover_url TEXT,
  finished BOOLEAN NOT NULL DEFAULT FALSE,
  last_read_at TIMESTAMPTZ,
  themes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  theme_source VARCHAR(16) NOT NULL DEFAULT 'SYSTEM',
  ai_summary TEXT,
  analyzed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_star_book_user_book UNIQUE (user_id, book_id),
  CONSTRAINT ck_star_book_theme_source CHECK (theme_source IN ('SYSTEM', 'AI', 'USER'))
);

CREATE INDEX IF NOT EXISTS idx_star_book_user_last_read
  ON reading_star_book_profile(user_id, last_read_at DESC);

CREATE TABLE IF NOT EXISTS reading_star_hidden_relation (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  source_book_id VARCHAR(64) NOT NULL,
  target_book_id VARCHAR(64) NOT NULL,
  hidden_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_star_hidden_user_pair UNIQUE (user_id, source_book_id, target_book_id),
  CONSTRAINT ck_star_hidden_order CHECK (source_book_id < target_book_id)
);

CREATE INDEX IF NOT EXISTS idx_star_hidden_user
  ON reading_star_hidden_relation(user_id, hidden_at DESC);

COMMENT ON TABLE reading_star_book_profile IS '用户私密阅读星图书籍画像；按 user_id 隔离并随账号删除';
COMMENT ON COLUMN reading_star_book_profile.themes_json IS 'AI 或系统提取的主题名称数组，不保存原始提示词';
COMMENT ON COLUMN reading_star_book_profile.theme_source IS '主题来源：SYSTEM、AI 或后续版本的 USER';
COMMENT ON TABLE reading_star_hidden_relation IS '用户主动隐藏的错误书籍关联，重新计算图谱时不得自动恢复';
