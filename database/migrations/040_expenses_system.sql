-- Migration 040: Expenses System
-- Adds mileage tracking, kit rentals, per diem, and enhanced receipt reimbursements

-- =============================================================================
-- MILEAGE ENTRIES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_mileage_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id),
    date DATE NOT NULL,
    description TEXT,
    start_location TEXT,
    end_location TEXT,
    miles NUMERIC(8,2) NOT NULL,
    rate_per_mile NUMERIC(5,3) DEFAULT 0.67,
    is_round_trip BOOLEAN DEFAULT FALSE,
    purpose TEXT CHECK (purpose IN ('location_scout', 'equipment_pickup', 'set_travel', 'meeting', 'other')),
    receipt_id UUID REFERENCES backlot_receipts(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'reimbursed')),
    approved_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMPTZ,
    rejected_by UUID REFERENCES profiles(id),
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    reimbursed_at TIMESTAMPTZ,
    reimbursed_via TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlot_mileage_project ON backlot_mileage_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_mileage_user ON backlot_mileage_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_backlot_mileage_date ON backlot_mileage_entries(date);
CREATE INDEX IF NOT EXISTS idx_backlot_mileage_status ON backlot_mileage_entries(project_id, status);

-- =============================================================================
-- KIT RENTALS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_kit_rentals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id),
    kit_name TEXT NOT NULL,
    kit_description TEXT,
    daily_rate NUMERIC(10,2) NOT NULL,
    weekly_rate NUMERIC(10,2),
    start_date DATE NOT NULL,
    end_date DATE,
    days_used INTEGER,
    total_amount NUMERIC(10,2),
    rental_type TEXT DEFAULT 'daily' CHECK (rental_type IN ('daily', 'weekly', 'flat')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'active', 'completed', 'reimbursed')),
    approved_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMPTZ,
    rejected_by UUID REFERENCES profiles(id),
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    completed_at TIMESTAMPTZ,
    reimbursed_at TIMESTAMPTZ,
    reimbursed_via TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlot_kit_rentals_project ON backlot_kit_rentals(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_kit_rentals_user ON backlot_kit_rentals(user_id);
CREATE INDEX IF NOT EXISTS idx_backlot_kit_rentals_status ON backlot_kit_rentals(project_id, status);

-- =============================================================================
-- PER DIEM TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_per_diem (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id),
    date DATE NOT NULL,
    meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'full_day')),
    amount NUMERIC(10,2) NOT NULL,
    location TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'reimbursed')),
    approved_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMPTZ,
    rejected_by UUID REFERENCES profiles(id),
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    reimbursed_at TIMESTAMPTZ,
    reimbursed_via TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, user_id, date, meal_type)
);

CREATE INDEX IF NOT EXISTS idx_backlot_per_diem_project ON backlot_per_diem(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_per_diem_user ON backlot_per_diem(user_id);
CREATE INDEX IF NOT EXISTS idx_backlot_per_diem_date ON backlot_per_diem(date);
CREATE INDEX IF NOT EXISTS idx_backlot_per_diem_status ON backlot_per_diem(project_id, status);

-- =============================================================================
-- PROJECT EXPENSE SETTINGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS backlot_project_expense_settings (
    project_id UUID PRIMARY KEY REFERENCES backlot_projects(id) ON DELETE CASCADE,
    mileage_rate NUMERIC(5,3) DEFAULT 0.67,
    per_diem_breakfast NUMERIC(10,2) DEFAULT 15.00,
    per_diem_lunch NUMERIC(10,2) DEFAULT 20.00,
    per_diem_dinner NUMERIC(10,2) DEFAULT 30.00,
    per_diem_full_day NUMERIC(10,2) DEFAULT 65.00,
    require_receipts_over NUMERIC(10,2) DEFAULT 25.00,
    auto_approve_under NUMERIC(10,2),
    allowed_categories TEXT[] DEFAULT ARRAY['production', 'equipment', 'props', 'wardrobe', 'food', 'travel', 'office', 'other'],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- ENHANCE RECEIPTS TABLE
-- =============================================================================

ALTER TABLE backlot_receipts ADD COLUMN IF NOT EXISTS expense_category TEXT;
ALTER TABLE backlot_receipts ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id);
ALTER TABLE backlot_receipts ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE backlot_receipts ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES profiles(id);
ALTER TABLE backlot_receipts ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE backlot_receipts ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE backlot_receipts ADD COLUMN IF NOT EXISTS reimbursed_at TIMESTAMPTZ;
ALTER TABLE backlot_receipts ADD COLUMN IF NOT EXISTS reimbursed_via TEXT;

CREATE INDEX IF NOT EXISTS idx_backlot_receipts_reimb_status ON backlot_receipts(project_id, reimbursement_status);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update timestamps for mileage
CREATE OR REPLACE FUNCTION update_backlot_mileage_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS backlot_mileage_updated_at ON backlot_mileage_entries;
CREATE TRIGGER backlot_mileage_updated_at
    BEFORE UPDATE ON backlot_mileage_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_backlot_mileage_timestamp();

-- Auto-update timestamps for kit rentals
CREATE OR REPLACE FUNCTION update_backlot_kit_rentals_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS backlot_kit_rentals_updated_at ON backlot_kit_rentals;
CREATE TRIGGER backlot_kit_rentals_updated_at
    BEFORE UPDATE ON backlot_kit_rentals
    FOR EACH ROW
    EXECUTE FUNCTION update_backlot_kit_rentals_timestamp();

-- Auto-update timestamps for per diem
CREATE OR REPLACE FUNCTION update_backlot_per_diem_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS backlot_per_diem_updated_at ON backlot_per_diem;
CREATE TRIGGER backlot_per_diem_updated_at
    BEFORE UPDATE ON backlot_per_diem
    FOR EACH ROW
    EXECUTE FUNCTION update_backlot_per_diem_timestamp();

-- Auto-update timestamps for expense settings
CREATE OR REPLACE FUNCTION update_backlot_expense_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS backlot_expense_settings_updated_at ON backlot_project_expense_settings;
CREATE TRIGGER backlot_expense_settings_updated_at
    BEFORE UPDATE ON backlot_project_expense_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_backlot_expense_settings_timestamp();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE backlot_mileage_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_kit_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_per_diem ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_project_expense_settings ENABLE ROW LEVEL SECURITY;

-- Mileage: Users can view their own, managers can view all
CREATE POLICY "backlot_mileage_select" ON backlot_mileage_entries
    FOR SELECT USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM backlot_projects p
            WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_roles r
            WHERE r.project_id = backlot_mileage_entries.project_id
            AND r.user_id = auth.uid()
            AND r.backlot_role IN ('showrunner', 'producer')
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_mileage_entries.project_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
    );

CREATE POLICY "backlot_mileage_insert" ON backlot_mileage_entries
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_mileage_entries.project_id
            AND m.user_id = auth.uid()
        )
    );

CREATE POLICY "backlot_mileage_update" ON backlot_mileage_entries
    FOR UPDATE USING (
        (user_id = auth.uid() AND status = 'pending')
        OR EXISTS (
            SELECT 1 FROM backlot_projects p
            WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_roles r
            WHERE r.project_id = backlot_mileage_entries.project_id
            AND r.user_id = auth.uid()
            AND r.backlot_role IN ('showrunner', 'producer')
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_mileage_entries.project_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
    );

CREATE POLICY "backlot_mileage_delete" ON backlot_mileage_entries
    FOR DELETE USING (
        (user_id = auth.uid() AND status = 'pending')
        OR EXISTS (
            SELECT 1 FROM backlot_projects p
            WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_mileage_entries.project_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
    );

-- Kit Rentals: Similar policies
CREATE POLICY "backlot_kit_rentals_select" ON backlot_kit_rentals
    FOR SELECT USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM backlot_projects p
            WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_roles r
            WHERE r.project_id = backlot_kit_rentals.project_id
            AND r.user_id = auth.uid()
            AND r.backlot_role IN ('showrunner', 'producer')
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_kit_rentals.project_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
    );

CREATE POLICY "backlot_kit_rentals_insert" ON backlot_kit_rentals
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_kit_rentals.project_id
            AND m.user_id = auth.uid()
        )
    );

CREATE POLICY "backlot_kit_rentals_update" ON backlot_kit_rentals
    FOR UPDATE USING (
        (user_id = auth.uid() AND status IN ('pending', 'rejected'))
        OR EXISTS (
            SELECT 1 FROM backlot_projects p
            WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_roles r
            WHERE r.project_id = backlot_kit_rentals.project_id
            AND r.user_id = auth.uid()
            AND r.backlot_role IN ('showrunner', 'producer')
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_kit_rentals.project_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
    );

CREATE POLICY "backlot_kit_rentals_delete" ON backlot_kit_rentals
    FOR DELETE USING (
        (user_id = auth.uid() AND status IN ('pending', 'rejected'))
        OR EXISTS (
            SELECT 1 FROM backlot_projects p
            WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_kit_rentals.project_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
    );

-- Per Diem: Similar policies
CREATE POLICY "backlot_per_diem_select" ON backlot_per_diem
    FOR SELECT USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM backlot_projects p
            WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_roles r
            WHERE r.project_id = backlot_per_diem.project_id
            AND r.user_id = auth.uid()
            AND r.backlot_role IN ('showrunner', 'producer')
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_per_diem.project_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
    );

CREATE POLICY "backlot_per_diem_insert" ON backlot_per_diem
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_per_diem.project_id
            AND m.user_id = auth.uid()
        )
    );

CREATE POLICY "backlot_per_diem_update" ON backlot_per_diem
    FOR UPDATE USING (
        (user_id = auth.uid() AND status = 'pending')
        OR EXISTS (
            SELECT 1 FROM backlot_projects p
            WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_roles r
            WHERE r.project_id = backlot_per_diem.project_id
            AND r.user_id = auth.uid()
            AND r.backlot_role IN ('showrunner', 'producer')
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_per_diem.project_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
    );

CREATE POLICY "backlot_per_diem_delete" ON backlot_per_diem
    FOR DELETE USING (
        (user_id = auth.uid() AND status = 'pending')
        OR EXISTS (
            SELECT 1 FROM backlot_projects p
            WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_per_diem.project_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
    );

-- Expense Settings: Only admins can manage
CREATE POLICY "backlot_expense_settings_select" ON backlot_project_expense_settings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_project_expense_settings.project_id
            AND m.user_id = auth.uid()
        )
    );

CREATE POLICY "backlot_expense_settings_insert" ON backlot_project_expense_settings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM backlot_projects p
            WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_roles r
            WHERE r.project_id = backlot_project_expense_settings.project_id
            AND r.user_id = auth.uid()
            AND r.backlot_role IN ('showrunner', 'producer')
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_project_expense_settings.project_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
    );

CREATE POLICY "backlot_expense_settings_update" ON backlot_project_expense_settings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM backlot_projects p
            WHERE p.id = project_id AND p.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_roles r
            WHERE r.project_id = backlot_project_expense_settings.project_id
            AND r.user_id = auth.uid()
            AND r.backlot_role IN ('showrunner', 'producer')
        )
        OR EXISTS (
            SELECT 1 FROM backlot_project_members m
            WHERE m.project_id = backlot_project_expense_settings.project_id
            AND m.user_id = auth.uid()
            AND m.role = 'admin'
        )
    );

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Calculate mileage total
CREATE OR REPLACE FUNCTION calculate_mileage_total(
    p_miles NUMERIC,
    p_rate_per_mile NUMERIC,
    p_is_round_trip BOOLEAN
) RETURNS NUMERIC AS $$
BEGIN
    IF p_is_round_trip THEN
        RETURN ROUND(p_miles * 2 * p_rate_per_mile, 2);
    ELSE
        RETURN ROUND(p_miles * p_rate_per_mile, 2);
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate kit rental total
CREATE OR REPLACE FUNCTION calculate_kit_rental_total(
    p_daily_rate NUMERIC,
    p_weekly_rate NUMERIC,
    p_start_date DATE,
    p_end_date DATE,
    p_rental_type TEXT
) RETURNS NUMERIC AS $$
DECLARE
    v_days INTEGER;
    v_weeks INTEGER;
    v_remaining_days INTEGER;
BEGIN
    IF p_end_date IS NULL THEN
        RETURN NULL; -- Ongoing rental
    END IF;

    v_days := p_end_date - p_start_date + 1;

    IF p_rental_type = 'flat' THEN
        RETURN p_daily_rate; -- daily_rate is used as flat rate
    ELSIF p_rental_type = 'weekly' AND p_weekly_rate IS NOT NULL THEN
        v_weeks := v_days / 7;
        v_remaining_days := v_days % 7;
        RETURN (v_weeks * p_weekly_rate) + (v_remaining_days * p_daily_rate);
    ELSE
        RETURN v_days * p_daily_rate;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get expense summary for a project
CREATE OR REPLACE FUNCTION get_project_expense_summary(p_project_id UUID)
RETURNS TABLE (
    pending_mileage NUMERIC,
    pending_kit_rentals NUMERIC,
    pending_per_diem NUMERIC,
    pending_receipts NUMERIC,
    total_pending NUMERIC,
    approved_mileage NUMERIC,
    approved_kit_rentals NUMERIC,
    approved_per_diem NUMERIC,
    approved_receipts NUMERIC,
    total_approved NUMERIC,
    reimbursed_total NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE((
            SELECT SUM(calculate_mileage_total(miles, rate_per_mile, is_round_trip))
            FROM backlot_mileage_entries WHERE project_id = p_project_id AND status = 'pending'
        ), 0) AS pending_mileage,
        COALESCE((
            SELECT SUM(total_amount)
            FROM backlot_kit_rentals WHERE project_id = p_project_id AND status = 'pending'
        ), 0) AS pending_kit_rentals,
        COALESCE((
            SELECT SUM(amount)
            FROM backlot_per_diem WHERE project_id = p_project_id AND status = 'pending'
        ), 0) AS pending_per_diem,
        COALESCE((
            SELECT SUM(amount)
            FROM backlot_receipts WHERE project_id = p_project_id AND reimbursement_status = 'pending'
        ), 0) AS pending_receipts,
        0::NUMERIC AS total_pending, -- Will be calculated in application
        COALESCE((
            SELECT SUM(calculate_mileage_total(miles, rate_per_mile, is_round_trip))
            FROM backlot_mileage_entries WHERE project_id = p_project_id AND status = 'approved'
        ), 0) AS approved_mileage,
        COALESCE((
            SELECT SUM(total_amount)
            FROM backlot_kit_rentals WHERE project_id = p_project_id AND status = 'approved'
        ), 0) AS approved_kit_rentals,
        COALESCE((
            SELECT SUM(amount)
            FROM backlot_per_diem WHERE project_id = p_project_id AND status = 'approved'
        ), 0) AS approved_per_diem,
        COALESCE((
            SELECT SUM(amount)
            FROM backlot_receipts WHERE project_id = p_project_id AND reimbursement_status = 'approved'
        ), 0) AS approved_receipts,
        0::NUMERIC AS total_approved,
        COALESCE((
            SELECT SUM(calculate_mileage_total(miles, rate_per_mile, is_round_trip))
            FROM backlot_mileage_entries WHERE project_id = p_project_id AND status = 'reimbursed'
        ), 0) +
        COALESCE((
            SELECT SUM(total_amount)
            FROM backlot_kit_rentals WHERE project_id = p_project_id AND status = 'reimbursed'
        ), 0) +
        COALESCE((
            SELECT SUM(amount)
            FROM backlot_per_diem WHERE project_id = p_project_id AND status = 'reimbursed'
        ), 0) +
        COALESCE((
            SELECT SUM(amount)
            FROM backlot_receipts WHERE project_id = p_project_id AND reimbursement_status = 'reimbursed'
        ), 0) AS reimbursed_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE backlot_mileage_entries IS 'Mileage reimbursement entries for crew travel';
COMMENT ON TABLE backlot_kit_rentals IS 'Equipment kit rental declarations from crew';
COMMENT ON TABLE backlot_per_diem IS 'Per diem meal allowance claims';
COMMENT ON TABLE backlot_project_expense_settings IS 'Project-level expense policy settings';
COMMENT ON COLUMN backlot_mileage_entries.rate_per_mile IS 'IRS 2024 standard rate is 0.67';
COMMENT ON COLUMN backlot_mileage_entries.purpose IS 'Reason for travel: location_scout, equipment_pickup, set_travel, meeting, other';
COMMENT ON COLUMN backlot_kit_rentals.rental_type IS 'How the rental is charged: daily, weekly, or flat';
COMMENT ON COLUMN backlot_per_diem.meal_type IS 'Which meal: breakfast, lunch, dinner, or full_day';
