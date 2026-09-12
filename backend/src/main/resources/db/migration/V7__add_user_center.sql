ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'NORMAL',
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE app_user SET status = 'NORMAL' WHERE status IS NULL;
UPDATE app_user SET updated_at = created_at WHERE updated_at IS NULL;

ALTER TABLE weread_credential
    ADD COLUMN IF NOT EXISTS api_key_last4 VARCHAR(8),
    ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_sync_status VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
    ADD COLUMN IF NOT EXISTS last_sync_error VARCHAR(80);

UPDATE weread_credential
SET api_key_last4 = RIGHT(key_hint, 4)
WHERE api_key_last4 IS NULL AND key_hint IS NOT NULL;

UPDATE weread_credential
SET connected_at = updated_at
WHERE connected_at IS NULL;

CREATE TABLE IF NOT EXISTS user_sync_state (
    user_id BIGINT PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
    shelf_status VARCHAR(16) NOT NULL DEFAULT 'IDLE',
    shelf_last_sync_at TIMESTAMPTZ,
    shelf_count INTEGER NOT NULL DEFAULT 0,
    note_status VARCHAR(16) NOT NULL DEFAULT 'IDLE',
    note_last_sync_at TIMESTAMPTZ,
    note_count INTEGER NOT NULL DEFAULT 0,
    bookmark_status VARCHAR(16) NOT NULL DEFAULT 'IDLE',
    bookmark_last_sync_at TIMESTAMPTZ,
    bookmark_count INTEGER NOT NULL DEFAULT 0,
    last_error_code VARCHAR(80),
    last_error_message VARCHAR(255),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_user_status ON app_user(status);
CREATE INDEX IF NOT EXISTS idx_app_user_last_seen ON app_user(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_user_sync_state_status
    ON user_sync_state(shelf_status, note_status, bookmark_status);

COMMENT ON COLUMN app_user.role IS 'USER or ADMIN. ADMIN is reserved for operations metadata only.';
COMMENT ON COLUMN app_user.status IS 'NORMAL or DISABLED. Disabled users cannot log in.';
COMMENT ON COLUMN app_user.last_seen_at IS 'Updated by authenticated requests; within 5 minutes is treated as online.';
COMMENT ON COLUMN weread_credential.api_key_last4 IS 'Only the last 4 characters are exposed for masking; never expose encrypted_api_key.';
COMMENT ON COLUMN weread_credential.last_sync_error IS 'Sanitized user-facing sync error code/message, not raw upstream payload.';
COMMENT ON TABLE user_sync_state IS 'One-row per-user sync dashboard for shelf, notes and highlights/bookmarks.';
