-- Migration 165: Add Gear Budget Actuals Support
-- Adds 'gear_rental_order' and 'gear_item' source types to enable auto-syncing
-- gear items to budget actuals

-- Add new source types to backlot_budget_actuals constraint
ALTER TABLE backlot_budget_actuals
DROP CONSTRAINT IF EXISTS backlot_budget_actuals_source_type_check;

ALTER TABLE backlot_budget_actuals
ADD CONSTRAINT backlot_budget_actuals_source_type_check
CHECK (source_type IN (
    'receipt',
    'mileage',
    'kit_rental',
    'per_diem',
    'purchase_order',
    'invoice_line_item',
    'manual',
    'gear_rental_order',  -- NEW: Marketplace rentals tracked at order level
    'gear_item'           -- NEW: Manual gear entries tracked at item level
));

-- Optional: Add trigger to auto-record when gear items are created
-- This provides a safety net in case API hooks are missed
CREATE OR REPLACE FUNCTION record_gear_item_budget_actual()
RETURNS TRIGGER AS $$
DECLARE
    rental_days INTEGER;
    total_cost NUMERIC;
BEGIN
    -- Only process rental items (not owned)
    IF NEW.is_owned = FALSE AND NEW.rental_cost_per_day IS NOT NULL THEN
        -- Calculate rental days
        IF NEW.pickup_date IS NOT NULL AND NEW.return_date IS NOT NULL THEN
            rental_days := (NEW.return_date - NEW.pickup_date) + 1;
            total_cost := NEW.rental_cost_per_day * rental_days;

            -- Insert budget actual if not already recorded
            INSERT INTO backlot_budget_actuals (
                project_id,
                source_type,
                source_id,
                amount,
                description,
                expense_date,
                vendor_name,
                expense_category
            )
            VALUES (
                NEW.project_id,
                'gear_item',
                NEW.id,
                total_cost,
                'Gear Rental - ' || NEW.name,
                NEW.pickup_date,
                NEW.rental_house,
                'Equipment Rental'
            )
            ON CONFLICT (source_type, source_id) DO NOTHING;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger fires after gear item insert
DROP TRIGGER IF EXISTS trg_gear_item_budget_actual ON backlot_gear_items;
CREATE TRIGGER trg_gear_item_budget_actual
AFTER INSERT ON backlot_gear_items
FOR EACH ROW
EXECUTE FUNCTION record_gear_item_budget_actual();
