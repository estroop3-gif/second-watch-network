-- Migration 285: Add missing composite indexes for gear marketplace performance
-- Fixes availability filtering query performance and sale listing filters

-- Index for work order item → asset lookups (used in availability checks)
CREATE INDEX IF NOT EXISTS idx_gear_work_order_items_asset
    ON gear_work_order_items(asset_id);

-- Index for transaction item → asset lookups
CREATE INDEX IF NOT EXISTS idx_gear_transaction_items_asset
    ON gear_transaction_items(asset_id);

-- Composite index for work order availability checks (status + date range)
CREATE INDEX IF NOT EXISTS idx_gear_work_orders_org_status_dates
    ON gear_work_orders(organization_id, status, expected_return_date)
    WHERE status IN ('pending', 'in_progress', 'pre_checkout');

-- Sale-specific listing filter index
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_sale_price
    ON gear_marketplace_listings(organization_id, is_listed, sale_price)
    WHERE listing_type IN ('sale', 'both') AND is_listed = TRUE;
