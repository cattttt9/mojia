-- 阅读星图入图权重所需字段。first_seen_at 从本版本开始记录，历史加入时间不做猜测。
ALTER TABLE reading_star_book_profile
  ADD COLUMN IF NOT EXISTS reading_progress INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_top BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE reading_star_book_profile
  DROP CONSTRAINT IF EXISTS ck_star_book_reading_progress;

ALTER TABLE reading_star_book_profile
  ADD CONSTRAINT ck_star_book_reading_progress CHECK (reading_progress BETWEEN 0 AND 100);

CREATE INDEX IF NOT EXISTS idx_star_book_user_ranking
  ON reading_star_book_profile(user_id, is_top DESC, last_read_at DESC, first_seen_at DESC);

COMMENT ON COLUMN reading_star_book_profile.reading_progress IS '0-100 阅读进度；优先使用笔记本或单书进度接口返回值';
COMMENT ON COLUMN reading_star_book_profile.is_top IS '微信读书书架置顶标记';
COMMENT ON COLUMN reading_star_book_profile.first_seen_at IS '书籍首次被墨架同步到星图的时间，不等同于微信读书历史加入时间';
