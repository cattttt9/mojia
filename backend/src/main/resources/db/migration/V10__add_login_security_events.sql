CREATE TABLE IF NOT EXISTS login_security_event (
    id BIGSERIAL PRIMARY KEY,
    username_hash VARCHAR(64) NOT NULL,
    user_id BIGINT REFERENCES app_user(id) ON DELETE SET NULL,
    event_type VARCHAR(32) NOT NULL,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    ip_address VARCHAR(64),
    user_agent_summary VARCHAR(255),
    request_id VARCHAR(64),
    failure_reason VARCHAR(48),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_security_event_user_created
    ON login_security_event(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_security_event_hash_created
    ON login_security_event(username_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_security_event_type_created
    ON login_security_event(event_type, created_at DESC);

COMMENT ON TABLE login_security_event IS 'Authentication audit events; never stores passwords, CAPTCHA answers or raw usernames.';
COMMENT ON COLUMN login_security_event.username_hash IS 'SHA-256 of normalized username for unknown-account audit correlation.';
COMMENT ON COLUMN login_security_event.ip_address IS 'Security telemetry subject to privacy-policy retention and deletion rules.';
