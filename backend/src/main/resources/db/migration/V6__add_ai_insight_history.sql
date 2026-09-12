-- AI 阅读洞察历史：保存用户主动生成的主题整理、弃读诊断和阅读处方。
CREATE TABLE IF NOT EXISTS ai_insight_history (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  insight_type VARCHAR(32) NOT NULL,
  title VARCHAR(200) NOT NULL,
  model VARCHAR(64) NOT NULL,
  input_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_insight_history_user_type_created
  ON ai_insight_history(user_id, insight_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_insight_history_user_created
  ON ai_insight_history(user_id, created_at DESC);

COMMENT ON TABLE ai_insight_history IS '用户私密 AI 阅读洞察历史，按 user_id 隔离并随账号级联删除';
COMMENT ON COLUMN ai_insight_history.insight_type IS 'weekly_themes、abandonment_diagnosis 或 prescription';
COMMENT ON COLUMN ai_insight_history.input_summary IS '用于回看生成上下文的脱敏摘要，不保存 API Key 或 Authorization';
COMMENT ON COLUMN ai_insight_history.result_json IS 'AI 返回的结构化结果 JSON';