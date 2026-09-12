CREATE TABLE IF NOT EXISTS weread_book_metadata (
  book_id VARCHAR(64) PRIMARY KEY,
  word_count BIGINT,
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  fetched_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE weread_book_metadata ADD COLUMN IF NOT EXISTS word_count BIGINT;
ALTER TABLE weread_book_metadata ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'PENDING';
ALTER TABLE weread_book_metadata ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ;
ALTER TABLE weread_book_metadata ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;
ALTER TABLE weread_book_metadata ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE weread_book_metadata ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_weread_book_metadata_status_retry
  ON weread_book_metadata(status, next_retry_at);
