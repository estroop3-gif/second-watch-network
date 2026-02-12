-- Migration 229: Contact Assignment Log
-- Audit trail for contact assignments and transfers between reps

CREATE TABLE IF NOT EXISTS crm_contact_assignment_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
    from_rep_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    to_rep_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    viewed_at TIMESTAMPTZ,
    notes TEXT,
    assignment_type VARCHAR(20) NOT NULL DEFAULT 'assign'
        CHECK (assignment_type IN ('assign', 'transfer', 'unassign'))
);

CREATE INDEX IF NOT EXISTS idx_cal_contact ON crm_contact_assignment_log(contact_id);
CREATE INDEX IF NOT EXISTS idx_cal_to_rep ON crm_contact_assignment_log(to_rep_id);
CREATE INDEX IF NOT EXISTS idx_cal_assigned_at ON crm_contact_assignment_log(assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_cal_unviewed ON crm_contact_assignment_log(to_rep_id, viewed_at) WHERE viewed_at IS NULL;
