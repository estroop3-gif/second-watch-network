-- Migration 280: Gear Marketplace — missing indexes + full-text search index
-- Eliminates sequential scans on common marketplace queries

-- ─── Listings ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_org_listed
    ON gear_marketplace_listings(organization_id, is_listed);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_asset
    ON gear_marketplace_listings(asset_id);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_type
    ON gear_marketplace_listings(listing_type)
    WHERE is_listed = TRUE;

-- ─── Settings ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_marketplace_settings_enabled
    ON gear_marketplace_settings(organization_id)
    WHERE is_marketplace_enabled = TRUE;

-- ─── Orders / quotes (used by blackout + availability subqueries) ─────────────
CREATE INDEX IF NOT EXISTS idx_rental_orders_asset_dates
    ON gear_rental_order_items(asset_id);

CREATE INDEX IF NOT EXISTS idx_rental_orders_status_dates
    ON gear_rental_orders(status, rental_start_date, rental_end_date);

-- ─── Full-text search on gear_assets ─────────────────────────────────────────
-- GIN index over a tsvector of name + make + model + description.
-- Used by the FTS condition added to the marketplace search query.
CREATE INDEX IF NOT EXISTS idx_gear_assets_fts
    ON gear_assets
    USING gin(
        to_tsvector(
            'english',
            COALESCE(name, '') || ' ' ||
            COALESCE(make, '') || ' ' ||
            COALESCE(model, '') || ' ' ||
            COALESCE(description, '')
        )
    );
