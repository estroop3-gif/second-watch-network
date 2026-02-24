-- Migration 263: Slate Productions - enhance productions table for public detail pages
-- Adds metadata columns, reconciles name/title columns, generates slugs

-- Ensure productions table has all needed metadata columns
ALTER TABLE productions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS poster_url TEXT;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS genre TEXT[];
ALTER TABLE productions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'released';
ALTER TABLE productions ADD COLUMN IF NOT EXISTS logline TEXT;

-- Reconcile legacy columns: ensure both title/name exist and stay in sync
-- title is used by credits.py, name is used by productions.py
ALTER TABLE productions ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS slug TEXT;

-- Also ensure created_by exists (legacy) alongside created_by_user_id (newer)
ALTER TABLE productions ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS created_by_user_id TEXT;

-- Sync: copy name→title where title is null, and vice versa
UPDATE productions SET title = name WHERE title IS NULL AND name IS NOT NULL;
UPDATE productions SET name = title WHERE name IS NULL AND title IS NOT NULL;

-- Sync created_by fields
UPDATE productions SET created_by_user_id = created_by WHERE created_by_user_id IS NULL AND created_by IS NOT NULL;
UPDATE productions SET created_by = created_by_user_id WHERE created_by IS NULL AND created_by_user_id IS NOT NULL;

-- Slug generation function for productions
CREATE OR REPLACE FUNCTION generate_production_slug(prod_name TEXT, prod_id UUID)
RETURNS TEXT AS $$
DECLARE base_slug TEXT; final_slug TEXT; counter INTEGER := 0;
BEGIN
  base_slug := lower(regexp_replace(prod_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' OR base_slug IS NULL THEN
    base_slug := 'untitled';
  END IF;
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM productions WHERE slug = final_slug AND id != prod_id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Generate slugs for any productions missing them
UPDATE productions SET slug = generate_production_slug(COALESCE(name, title, 'untitled'), id) WHERE slug IS NULL OR slug = '';

-- Indexes for search and lookup
CREATE INDEX IF NOT EXISTS idx_productions_name_search ON productions USING gin(to_tsvector('english', COALESCE(name, '')));
CREATE INDEX IF NOT EXISTS idx_productions_slug ON productions(slug);
CREATE INDEX IF NOT EXISTS idx_productions_name_ilike ON productions(lower(COALESCE(name, '')));
