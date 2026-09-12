ALTER TABLE weread_book_metadata ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE weread_book_metadata ADD COLUMN IF NOT EXISTS cover_fetched_at TIMESTAMPTZ;
