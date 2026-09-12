-- 阅读地图 V1：所有地点、证据、关系和纠错记录均按 user_id 隔离。
CREATE TABLE IF NOT EXISTS reading_place (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  normalized_name VARCHAR(240) NOT NULL,
  display_name VARCHAR(240) NOT NULL,
  place_kind VARCHAR(20) NOT NULL,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  literary_x NUMERIC(8,3),
  literary_y NUMERIC(8,3),
  description TEXT,
  themes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_type VARCHAR(16) NOT NULL DEFAULT 'AI',
  confirmation_status VARCHAR(20) NOT NULL DEFAULT 'AI_SUGGESTED',
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  merged_into_id BIGINT REFERENCES reading_place(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_reading_place_user_name_kind UNIQUE(user_id, normalized_name, place_kind),
  CONSTRAINT ck_reading_place_kind CHECK(place_kind IN ('REAL','REGION','HISTORICAL','FICTIONAL')),
  CONSTRAINT ck_reading_place_source CHECK(source_type IN ('AI','SYSTEM','USER')),
  CONSTRAINT ck_reading_place_confirmation CHECK(confirmation_status IN ('AI_SUGGESTED','CONFIRMED','REJECTED')),
  CONSTRAINT ck_reading_place_confidence CHECK(confidence BETWEEN 0 AND 1)
);

CREATE TABLE IF NOT EXISTS book_place_mention (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  place_id BIGINT NOT NULL REFERENCES reading_place(id) ON DELETE CASCADE,
  book_id VARCHAR(64) NOT NULL,
  book_title VARCHAR(300) NOT NULL,
  chapter_title VARCHAR(500),
  mention_key VARCHAR(160) NOT NULL,
  importance NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  ai_confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_book_place_mention_user_key UNIQUE(user_id, mention_key),
  CONSTRAINT ck_book_place_importance CHECK(importance BETWEEN 0 AND 1),
  CONSTRAINT ck_book_place_confidence CHECK(ai_confidence BETWEEN 0 AND 1)
);

CREATE TABLE IF NOT EXISTS place_evidence (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  place_id BIGINT NOT NULL REFERENCES reading_place(id) ON DELETE CASCADE,
  mention_id BIGINT REFERENCES book_place_mention(id) ON DELETE CASCADE,
  evidence_type VARCHAR(20) NOT NULL,
  source_ref VARCHAR(500),
  excerpt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_place_evidence_type CHECK(evidence_type IN ('INTRO','CHAPTER','HIGHLIGHT','THOUGHT'))
);

CREATE TABLE IF NOT EXISTS place_relation (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  source_place_id BIGINT NOT NULL REFERENCES reading_place(id) ON DELETE CASCADE,
  target_place_id BIGINT NOT NULL REFERENCES reading_place(id) ON DELETE CASCADE,
  relation_type VARCHAR(32) NOT NULL,
  explanation TEXT,
  source_type VARCHAR(16) NOT NULL DEFAULT 'AI',
  confirmation_status VARCHAR(20) NOT NULL DEFAULT 'AI_SUGGESTED',
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_place_relation_user_pair_type UNIQUE(user_id, source_place_id, target_place_id, relation_type),
  CONSTRAINT ck_place_relation_type CHECK(relation_type IN ('LITERARY_MAPPING','REAL_WORLD_PROTOTYPE','REGIONAL_CONTEXT','NARRATIVE_ENTRANCE')),
  CONSTRAINT ck_place_relation_source CHECK(source_type IN ('AI','SYSTEM','USER')),
  CONSTRAINT ck_place_relation_confirmation CHECK(confirmation_status IN ('AI_SUGGESTED','CONFIRMED','REJECTED')),
  CONSTRAINT ck_place_relation_confidence CHECK(confidence BETWEEN 0 AND 1),
  CONSTRAINT ck_place_relation_distinct CHECK(source_place_id <> target_place_id)
);

CREATE TABLE IF NOT EXISTS place_user_feedback (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  place_id BIGINT REFERENCES reading_place(id) ON DELETE CASCADE,
  relation_id BIGINT REFERENCES place_relation(id) ON DELETE CASCADE,
  action_type VARCHAR(20) NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_place_feedback_action CHECK(action_type IN ('CONFIRM','EDIT','HIDE','MERGE','RESTORE'))
);

CREATE TABLE IF NOT EXISTS reading_map_analysis_job (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  scope_book_id VARCHAR(64),
  data_scope_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  place_count INTEGER NOT NULL DEFAULT 0,
  mention_count INTEGER NOT NULL DEFAULT 0,
  error_code VARCHAR(40),
  request_id VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  CONSTRAINT ck_reading_map_job_status CHECK(status IN ('PENDING','RUNNING','SUCCESS','FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_reading_place_user_visible ON reading_place(user_id, hidden, place_kind);
CREATE INDEX IF NOT EXISTS idx_book_place_user_book ON book_place_mention(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_book_place_user_place ON book_place_mention(user_id, place_id);
CREATE INDEX IF NOT EXISTS idx_place_evidence_user_place ON place_evidence(user_id, place_id);
CREATE INDEX IF NOT EXISTS idx_place_relation_user_source ON place_relation(user_id, source_place_id, hidden);
CREATE INDEX IF NOT EXISTS idx_place_feedback_user_created ON place_user_feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reading_map_job_user_created ON reading_map_analysis_job(user_id, created_at DESC);

COMMENT ON TABLE reading_place IS '用户私密阅读地图的规范化地点；真实坐标与文学相对坐标分开保存';
COMMENT ON TABLE book_place_mention IS '书籍与规范化地点之间的提及关系，同一地点可关联多本书';
COMMENT ON TABLE place_evidence IS '地点识别依据，仅允许简介、目录、用户划线和用户想法；正文禁止写入日志';
COMMENT ON TABLE place_relation IS '现实地点与文学空间之间可解释的映射或原型关系';
COMMENT ON TABLE place_user_feedback IS '用户对 AI 地点与关系的确认、修改、隐藏和合并记录';
COMMENT ON TABLE reading_map_analysis_job IS '异步地点分析任务，仅保存范围、计数和错误码，不保存私密提示词';
