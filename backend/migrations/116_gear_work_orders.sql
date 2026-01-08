-- Migration 116: Gear Work Orders
-- Pre-checkout staging system for equipment preparation

-- Organization settings for work order statuses
ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS work_order_statuses JSONB DEFAULT '[
    {"id": "draft", "label": "Draft", "color": "gray", "sort_order": 1},
    {"id": "in_progress", "label": "In Progress", "color": "blue", "sort_order": 2},
    {"id": "ready", "label": "Ready", "color": "green", "sort_order": 3},
    {"id": "checked_out", "label": "Checked Out", "color": "purple", "sort_order": 4}
]',
ADD COLUMN IF NOT EXISTS work_order_reference_prefix TEXT DEFAULT 'WO-';

-- Main work orders table
CREATE TABLE IF NOT EXISTS gear_work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    reference_number TEXT,
    title TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'draft',

    -- Assignment
    created_by UUID NOT NULL REFERENCES profiles(id),
    assigned_to UUID REFERENCES profiles(id),

    -- Custodian (who gets equipment)
    custodian_user_id UUID REFERENCES profiles(id),
    custodian_contact_id UUID REFERENCES gear_organization_contacts(id),
    backlot_project_id UUID REFERENCES backlot_projects(id),

    -- Dates
    due_date DATE,
    pickup_date DATE,
    expected_return_date DATE,
    destination_location_id UUID REFERENCES gear_locations(id),

    -- Checkout link
    checkout_transaction_id UUID REFERENCES gear_transactions(id),
    checked_out_at TIMESTAMPTZ,
    checked_out_by UUID REFERENCES profiles(id),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(organization_id, reference_number)
);

-- Work order items
CREATE TABLE IF NOT EXISTS gear_work_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_id UUID NOT NULL REFERENCES gear_work_orders(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES gear_assets(id),
    kit_instance_id UUID REFERENCES gear_kit_instances(id),
    quantity INTEGER DEFAULT 1,
    is_staged BOOLEAN DEFAULT FALSE,
    staged_at TIMESTAMPTZ,
    staged_by UUID REFERENCES profiles(id),
    notes TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure either asset or kit, not both
    CONSTRAINT chk_work_order_item_type CHECK (
        (asset_id IS NOT NULL AND kit_instance_id IS NULL) OR
        (asset_id IS NULL AND kit_instance_id IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gear_work_orders_org_status ON gear_work_orders(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_gear_work_orders_assigned ON gear_work_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_gear_work_orders_due ON gear_work_orders(organization_id, due_date) WHERE status NOT IN ('checked_out', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_gear_work_order_items_order ON gear_work_order_items(work_order_id);
CREATE INDEX IF NOT EXISTS idx_gear_work_order_items_asset ON gear_work_order_items(asset_id) WHERE asset_id IS NOT NULL;

-- Auto-generate reference numbers trigger
CREATE OR REPLACE FUNCTION generate_work_order_reference() RETURNS TRIGGER AS $$
DECLARE
    prefix TEXT;
    next_num INTEGER;
BEGIN
    -- Get prefix from org settings
    SELECT COALESCE(work_order_reference_prefix, 'WO-') INTO prefix
    FROM gear_organization_settings
    WHERE organization_id = NEW.organization_id;

    IF prefix IS NULL THEN
        prefix := 'WO-';
    END IF;

    -- Get next number
    SELECT COALESCE(MAX(
        CASE
            WHEN reference_number ~ ('^' || regexp_replace(prefix, '([.*+?^${}()|[\]\\])', '\\\1', 'g') || '[0-9]+$')
            THEN CAST(SUBSTRING(reference_number FROM LENGTH(prefix) + 1) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1 INTO next_num
    FROM gear_work_orders
    WHERE organization_id = NEW.organization_id;

    NEW.reference_number := prefix || LPAD(next_num::TEXT, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gear_work_orders_reference ON gear_work_orders;
CREATE TRIGGER trg_gear_work_orders_reference
    BEFORE INSERT ON gear_work_orders
    FOR EACH ROW
    WHEN (NEW.reference_number IS NULL OR NEW.reference_number = '')
    EXECUTE FUNCTION generate_work_order_reference();

-- Updated_at trigger (reuse existing function)
DROP TRIGGER IF EXISTS trg_gear_work_orders_updated_at ON gear_work_orders;
CREATE TRIGGER trg_gear_work_orders_updated_at
    BEFORE UPDATE ON gear_work_orders
    FOR EACH ROW
    EXECUTE FUNCTION gear_update_timestamp();

-- Comments
COMMENT ON TABLE gear_work_orders IS 'Pre-checkout work orders for staging equipment';
COMMENT ON TABLE gear_work_order_items IS 'Items included in a work order';
COMMENT ON COLUMN gear_work_orders.status IS 'Work order status: draft, in_progress, ready, checked_out, cancelled';
COMMENT ON COLUMN gear_work_orders.assigned_to IS 'User assigned to prepare this work order';
COMMENT ON COLUMN gear_work_order_items.is_staged IS 'Whether item has been physically staged/prepared';
