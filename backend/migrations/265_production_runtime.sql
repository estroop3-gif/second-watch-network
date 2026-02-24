-- Migration 265: Add IMDB-style metadata columns to productions
-- runtime_minutes, tagline, backdrop_url — all optional, null for existing rows

ALTER TABLE productions ADD COLUMN IF NOT EXISTS runtime_minutes INTEGER;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS tagline TEXT;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS backdrop_url TEXT;
