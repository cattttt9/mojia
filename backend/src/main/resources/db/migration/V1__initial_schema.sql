CREATE TABLE app_user (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(32) NOT NULL UNIQUE,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  display_name VARCHAR(40) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'USER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE weread_credential (
  user_id BIGINT PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  encrypted_api_key TEXT NOT NULL,
  key_hint VARCHAR(12) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE board_message (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  content VARCHAR(1000) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'VISIBLE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_board_message_created_at ON board_message(created_at DESC);
CREATE INDEX idx_board_message_status ON board_message(status);
