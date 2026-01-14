-- Migration 163: Backlot Gear Rental Order Integration
-- Creates linking between backlot_gear_items and gear_rental_orders for automated sync

-- ============================================================================
-- PART 1: Schema Changes - Foreign Keys and New Columns
-- ============================================================================

-- Add foreign key linking backlot_gear_items to rental order items
ALTER TABLE backlot_gear_items
ADD COLUMN IF NOT EXISTS gear_rental_order_item_id UUID REFERENCES gear_rental_order_items(id) ON DELETE SET NULL;

-- Add reverse link for performance (optional but recommended)
ALTER TABLE gear_rental_order_items
ADD COLUMN IF NOT EXISTS backlot_gear_item_id UUID REFERENCES backlot_gear_items(id) ON DELETE SET NULL;

-- Add metadata for sync tracking
ALTER TABLE backlot_gear_items
ADD COLUMN IF NOT EXISTS rental_sync_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Add rate type tracking to backlot_gear_items
ALTER TABLE backlot_gear_items
ADD COLUMN IF NOT EXISTS rental_rate_type TEXT CHECK (rental_rate_type IN ('daily', 'weekly', 'monthly', 'flat')),
ADD COLUMN IF NOT EXISTS rental_weekly_rate DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS rental_monthly_rate DECIMAL(10, 2);

-- Add link from rental orders to work orders
ALTER TABLE gear_work_orders
ADD COLUMN IF NOT EXISTS gear_rental_order_id UUID REFERENCES gear_rental_orders(id) ON DELETE SET NULL;

-- ============================================================================
-- PART 2: Indexes for Performance
-- ============================================================================

-- Index for finding backlot gear items by rental order item
CREATE INDEX IF NOT EXISTS idx_backlot_gear_items_rental_item
ON backlot_gear_items(gear_rental_order_item_id)
WHERE gear_rental_order_item_id IS NOT NULL;

-- Index for reverse lookup
CREATE INDEX IF NOT EXISTS idx_rental_items_backlot_gear
ON gear_rental_order_items(backlot_gear_item_id)
WHERE backlot_gear_item_id IS NOT NULL;

-- Composite index for project-level rental queries
CREATE INDEX IF NOT EXISTS idx_backlot_gear_items_project_rental
ON backlot_gear_items(project_id, gear_rental_order_item_id)
WHERE gear_rental_order_item_id IS NOT NULL;

-- Index for work orders linked to rental orders
CREATE INDEX IF NOT EXISTS idx_work_orders_rental
ON gear_work_orders(gear_rental_order_id)
WHERE gear_rental_order_id IS NOT NULL;

-- ============================================================================
-- PART 3: Database Triggers for Auto-Sync
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Trigger 1: Sync rental rates when order item rates change
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_rental_rates_to_backlot()
RETURNS TRIGGER AS $$
BEGIN
  -- Update all linked backlot gear items when rental rates change
  -- Assume quoted_rate is the daily rate and calculate weekly/monthly from it
  UPDATE backlot_gear_items
  SET
    rental_cost_per_day = NEW.quoted_rate,
    rental_rate_type = 'daily',
    rental_weekly_rate = NEW.quoted_rate * 7 * 0.85,  -- 15% weekly discount
    rental_monthly_rate = NEW.quoted_rate * 30 * 0.75,  -- 25% monthly discount
    last_synced_at = NOW()
  WHERE gear_rental_order_item_id = NEW.id
    AND rental_sync_enabled = TRUE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_rental_rates ON gear_rental_order_items;
CREATE TRIGGER trg_sync_rental_rates
AFTER UPDATE OF quoted_rate ON gear_rental_order_items
FOR EACH ROW
EXECUTE FUNCTION sync_rental_rates_to_backlot();

-- ----------------------------------------------------------------------------
-- Trigger 2: Sync rental dates when order dates change
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_rental_dates_to_backlot()
RETURNS TRIGGER AS $$
BEGIN
  -- Update pickup/return dates for all gear items linked to this order
  UPDATE backlot_gear_items bg
  SET
    pickup_date = NEW.rental_start_date,
    return_date = NEW.rental_end_date,
    last_synced_at = NOW()
  FROM gear_rental_order_items roi
  WHERE bg.gear_rental_order_item_id = roi.id
    AND roi.order_id = NEW.id
    AND bg.rental_sync_enabled = TRUE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_rental_dates ON gear_rental_orders;
CREATE TRIGGER trg_sync_rental_dates
AFTER UPDATE OF rental_start_date, rental_end_date ON gear_rental_orders
FOR EACH ROW
EXECUTE FUNCTION sync_rental_dates_to_backlot();

-- ----------------------------------------------------------------------------
-- Trigger 3: Update gear status when rental order status changes
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_rental_status_to_backlot()
RETURNS TRIGGER AS $$
BEGIN
  -- Map rental order status to backlot gear status
  UPDATE backlot_gear_items bg
  SET
    status = CASE NEW.status
      WHEN 'confirmed' THEN 'reserved'
      WHEN 'building' THEN 'reserved'
      WHEN 'ready_for_pickup' THEN 'reserved'
      WHEN 'picked_up' THEN 'in_use'
      WHEN 'in_use' THEN 'in_use'
      WHEN 'returned' THEN 'available'
      WHEN 'cancelled' THEN 'available'
      ELSE bg.status
    END,
    last_synced_at = NOW()
  FROM gear_rental_order_items roi
  WHERE bg.gear_rental_order_item_id = roi.id
    AND roi.order_id = NEW.id
    AND bg.rental_sync_enabled = TRUE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_rental_status ON gear_rental_orders;
CREATE TRIGGER trg_sync_rental_status
AFTER UPDATE OF status ON gear_rental_orders
FOR EACH ROW
EXECUTE FUNCTION sync_rental_status_to_backlot();

-- ============================================================================
-- PART 4: Comments for Documentation
-- ============================================================================

COMMENT ON COLUMN backlot_gear_items.gear_rental_order_item_id IS
'Links this gear item to a rental order item for automatic sync of rates, dates, and status';

COMMENT ON COLUMN backlot_gear_items.rental_sync_enabled IS
'When true, this gear item will automatically sync with linked rental order changes';

COMMENT ON COLUMN backlot_gear_items.rental_rate_type IS
'Type of rate: daily, weekly, monthly, or flat fee';

COMMENT ON COLUMN backlot_gear_items.rental_weekly_rate IS
'Weekly rental rate (calculated or quoted)';

COMMENT ON COLUMN backlot_gear_items.rental_monthly_rate IS
'Monthly rental rate (calculated or quoted)';

COMMENT ON COLUMN gear_rental_order_items.backlot_gear_item_id IS
'Reverse link to the backlot gear item created from this rental order item';

COMMENT ON COLUMN gear_work_orders.gear_rental_order_id IS
'Links this work order to a rental order for tracking equipment staging';
