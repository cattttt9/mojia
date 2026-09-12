-- 第二阶段阅读记忆：周报/月报快照、时间胶囊和用户回顾。
CREATE TABLE IF NOT EXISTS reading_report (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  period_type VARCHAR(16) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  report_json JSONB NOT NULL,
  share_json JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_reading_report_user_period UNIQUE(user_id, period_type, period_start)
);

CREATE TABLE IF NOT EXISTS reading_capsule (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  capsule_date DATE NOT NULL,
  source_date DATE NOT NULL,
  source_type VARCHAR(24) NOT NULL,
  source_book_id VARCHAR(64),
  source_note_id BIGINT,
  content_json JSONB NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'READY',
  shown_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_reading_capsule_user_date UNIQUE(user_id, capsule_date)
);

CREATE TABLE IF NOT EXISTS capsule_reflection (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  capsule_id BIGINT NOT NULL REFERENCES reading_capsule(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_capsule_reflection_user_capsule UNIQUE(user_id, capsule_id)
);

CREATE INDEX IF NOT EXISTS idx_reading_report_user_period ON reading_report(user_id, period_type, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_reading_report_user_created ON reading_report(user_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_reading_capsule_user_created ON reading_capsule(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reading_capsule_user_status ON reading_capsule(user_id, status, capsule_date DESC);
CREATE INDEX IF NOT EXISTS idx_capsule_reflection_user_created ON capsule_reflection(user_id, created_at DESC);

COMMENT ON TABLE reading_report IS '用户私密的周报和月报不可变快照';
COMMENT ON COLUMN reading_report.period_type IS 'WEEKLY 或 MONTHLY';
COMMENT ON COLUMN reading_report.report_json IS '私密完整报告快照，可能包含精选划线';
COMMENT ON COLUMN reading_report.share_json IS '预先脱敏的可分享快照，不包含划线和个人想法原文';
COMMENT ON TABLE reading_capsule IS '每周最多展示一枚的私人阅读时间胶囊';
COMMENT ON COLUMN reading_capsule.content_json IS '胶囊生成时的私密内容快照，不随源笔记修改';
COMMENT ON COLUMN reading_capsule.status IS 'READY、SHOWN 或 DISMISSED';
COMMENT ON TABLE capsule_reflection IS '用户面对旧阅读记忆写下的现在感受，不回写微信读书';
COMMENT ON COLUMN capsule_reflection.content IS '私人回顾正文，禁止写入应用日志';
