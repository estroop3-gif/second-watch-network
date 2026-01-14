-- Migration 162: Add work_order_reserves_dates setting to gear_marketplace_settings
-- This allows rental houses to configure whether work orders block marketplace availability

ALTER TABLE gear_marketplace_settings
ADD COLUMN IF NOT EXISTS work_order_reserves_dates BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN gear_marketplace_settings.work_order_reserves_dates IS
'If true, work orders with expected_return_date will block marketplace availability for those dates';

-- Performance indexes for date range queries

-- Index for work order reservation checks (only when enabled)
CREATE INDEX IF NOT EXISTS idx_gear_marketplace_settings_wo_reserves
ON gear_marketplace_settings(organization_id, work_order_reserves_dates)
WHERE work_order_reserves_dates = TRUE;

-- Index for rental order date overlap checks
CREATE INDEX IF NOT EXISTS idx_gear_rental_orders_dates_status
ON gear_rental_orders(rental_start_date, rental_end_date)
WHERE status IN ('confirmed', 'building', 'packed', 'ready_for_pickup', 'picked_up', 'in_use');

-- Index for work order date overlap checks
CREATE INDEX IF NOT EXISTS idx_gear_work_orders_dates_org
ON gear_work_orders(organization_id, pickup_date, expected_return_date)
WHERE status IN ('in_progress', 'ready', 'checked_out')
  AND expected_return_date IS NOT NULL;
