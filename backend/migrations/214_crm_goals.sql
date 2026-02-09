-- Migration 214: CRM Sales Goals & KPI Tracking
-- Rep and team goals with period-based tracking

-- ============================================================================
-- Table: crm_sales_goals
-- Individual rep or team-wide sales goals
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_sales_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- NULL rep_id = team-wide goal
    rep_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

    -- Goal definition
    goal_type TEXT NOT NULL
        CHECK (goal_type IN (
            'revenue', 'deals_closed', 'calls_made', 'emails_sent',
            'meetings_held', 'demos_given', 'new_contacts'
        )),

    -- Period
    period_type TEXT NOT NULL DEFAULT 'monthly'
        CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Values
    target_value INTEGER NOT NULL DEFAULT 0,
    actual_value INTEGER NOT NULL DEFAULT 0,

    -- Audit
    set_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_sales_goals_rep ON crm_sales_goals(rep_id);
CREATE INDEX IF NOT EXISTS idx_crm_sales_goals_period ON crm_sales_goals(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_crm_sales_goals_type ON crm_sales_goals(goal_type);
CREATE INDEX IF NOT EXISTS idx_crm_sales_goals_rep_period
    ON crm_sales_goals(rep_id, period_start, period_end);
