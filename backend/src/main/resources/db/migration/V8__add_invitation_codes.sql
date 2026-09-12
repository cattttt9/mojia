-- 邀请码只保存 SHA-256 摘要和脱敏展示值，完整邀请码仅在创建时返回一次。
CREATE TABLE IF NOT EXISTS invitation_code (
    id BIGSERIAL PRIMARY KEY,
    code_hash CHAR(64) NOT NULL UNIQUE,
    code_masked VARCHAR(20) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'UNUSED',
    created_by_user_id BIGINT REFERENCES app_user(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    used_by_user_id BIGINT REFERENCES app_user(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ,
    used_registration_ip VARCHAR(64),
    used_request_id VARCHAR(64),
    disabled_by_user_id BIGINT REFERENCES app_user(id) ON DELETE SET NULL,
    disabled_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_invitation_code_status
        CHECK (status IN ('UNUSED', 'USED', 'EXPIRED', 'DISABLED'))
);

CREATE INDEX IF NOT EXISTS idx_invitation_code_status_expires
    ON invitation_code(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_invitation_code_created_by
    ON invitation_code(created_by_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invitation_code_used_by
    ON invitation_code(used_by_user_id, used_at DESC);

COMMENT ON TABLE invitation_code IS 'One-time registration invitations created by administrators.';
COMMENT ON COLUMN invitation_code.code_hash IS 'SHA-256 digest of the normalized invitation; plaintext is never persisted.';
COMMENT ON COLUMN invitation_code.code_masked IS 'Safe display value such as K8F2-****-PQ73.';
COMMENT ON COLUMN invitation_code.status IS 'UNUSED, USED, EXPIRED or DISABLED.';
COMMENT ON COLUMN invitation_code.used_registration_ip IS 'Remote address observed by the application during successful registration.';
COMMENT ON COLUMN invitation_code.used_request_id IS 'Sanitized request ID for registration troubleshooting; contains no invitation plaintext.';
