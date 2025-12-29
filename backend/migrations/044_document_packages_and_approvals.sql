-- Migration 044: Document Packages, Approvals, and Batch Signing
-- Digital signature workflow for crew onboarding

-- ==========================================
-- 1. Document Packages (reusable bundles)
-- ==========================================
CREATE TABLE IF NOT EXISTS backlot_document_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES backlot_projects(id) ON DELETE CASCADE,
    owner_user_id UUID REFERENCES profiles(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    target_type VARCHAR(20) DEFAULT 'all' CHECK (target_type IN ('cast', 'crew', 'all')),
    is_active BOOLEAN DEFAULT true,
    use_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_packages_project ON backlot_document_packages(project_id);
CREATE INDEX IF NOT EXISTS idx_document_packages_owner ON backlot_document_packages(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_document_packages_active ON backlot_document_packages(is_active) WHERE is_active = true;

-- ==========================================
-- 2. Package Items (documents in a package)
-- ==========================================
CREATE TABLE IF NOT EXISTS backlot_document_package_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES backlot_document_packages(id) ON DELETE CASCADE,
    clearance_type VARCHAR(50) NOT NULL,
    template_id UUID REFERENCES backlot_clearance_templates(id),
    is_required BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    custom_title VARCHAR(255),
    custom_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_package_items_package ON backlot_document_package_items(package_id);

-- ==========================================
-- 3. Package Assignments (sent to people)
-- ==========================================
CREATE TABLE IF NOT EXISTS backlot_document_package_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES backlot_document_packages(id),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    assigned_to_user_id UUID REFERENCES profiles(id),
    assigned_by_user_id UUID REFERENCES profiles(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    due_date DATE,
    notes TEXT,
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_package_assignments_package ON backlot_document_package_assignments(package_id);
CREATE INDEX IF NOT EXISTS idx_package_assignments_project ON backlot_document_package_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_package_assignments_user ON backlot_document_package_assignments(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_package_assignments_status ON backlot_document_package_assignments(status);

-- ==========================================
-- 4. Assignment Items (links to created clearances)
-- ==========================================
CREATE TABLE IF NOT EXISTS backlot_document_package_assignment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES backlot_document_package_assignments(id) ON DELETE CASCADE,
    package_item_id UUID NOT NULL REFERENCES backlot_document_package_items(id),
    clearance_id UUID REFERENCES backlot_clearance_items(id) ON DELETE SET NULL,
    status VARCHAR(30) DEFAULT 'not_started',
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_items_assignment ON backlot_document_package_assignment_items(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_items_clearance ON backlot_document_package_assignment_items(clearance_id);

-- ==========================================
-- 5. Clearance Approvals (post-sign workflow)
-- ==========================================
CREATE TABLE IF NOT EXISTS backlot_clearance_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clearance_id UUID NOT NULL REFERENCES backlot_clearance_items(id) ON DELETE CASCADE,
    requires_approval BOOLEAN DEFAULT false,
    approver_user_id UUID REFERENCES profiles(id),
    approver_role VARCHAR(50),
    approval_status VARCHAR(30) DEFAULT 'not_required'
        CHECK (approval_status IN ('not_required', 'pending_approval', 'approved', 'changes_requested', 'rejected')),
    approved_at TIMESTAMPTZ,
    approved_by_user_id UUID REFERENCES profiles(id),
    approved_by_name VARCHAR(255),
    change_request_notes TEXT,
    change_requested_at TIMESTAMPTZ,
    change_requested_by_user_id UUID REFERENCES profiles(id),
    locked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_clearance_approval UNIQUE (clearance_id)
);

CREATE INDEX IF NOT EXISTS idx_clearance_approvals_clearance ON backlot_clearance_approvals(clearance_id);
CREATE INDEX IF NOT EXISTS idx_clearance_approvals_approver ON backlot_clearance_approvals(approver_user_id)
    WHERE approval_status = 'pending_approval';
CREATE INDEX IF NOT EXISTS idx_clearance_approvals_status ON backlot_clearance_approvals(approval_status);

-- ==========================================
-- 6. Batch Sign Sessions (audit trail)
-- ==========================================
CREATE TABLE IF NOT EXISTS backlot_batch_sign_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    signature_data TEXT NOT NULL,
    signature_ip VARCHAR(45),
    recipient_ids UUID[] NOT NULL,
    clearance_ids UUID[] NOT NULL,
    documents_signed INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_sign_user ON backlot_batch_sign_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_sign_created ON backlot_batch_sign_sessions(created_at);

-- ==========================================
-- 7. Modifications to existing tables
-- ==========================================

-- Add batch_sign_allowed to clearance items
ALTER TABLE backlot_clearance_items
ADD COLUMN IF NOT EXISTS batch_sign_allowed BOOLEAN DEFAULT true;

-- Add approval tracking columns to clearance items
ALTER TABLE backlot_clearance_items
ADD COLUMN IF NOT EXISTS pending_approval_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id);

-- Add package_assignment_item_id to clearance_items for linking
ALTER TABLE backlot_clearance_items
ADD COLUMN IF NOT EXISTS package_assignment_item_id UUID REFERENCES backlot_document_package_assignment_items(id);

CREATE INDEX IF NOT EXISTS idx_clearance_items_package_assignment
    ON backlot_clearance_items(package_assignment_item_id)
    WHERE package_assignment_item_id IS NOT NULL;

-- ==========================================
-- 8. Views for aggregated data
-- ==========================================

-- View: Crew document completion summary
CREATE OR REPLACE VIEW crew_document_summary AS
WITH person_clearances AS (
    SELECT
        ci.project_id,
        ci.related_person_id as person_id,
        ci.related_person_name as person_name,
        COUNT(*) as total_clearances,
        COUNT(*) FILTER (WHERE ci.status = 'signed' OR ci.status = 'approved') as signed_count,
        COUNT(*) FILTER (WHERE ci.status IN ('requested', 'pending')) as pending_count,
        COUNT(*) FILTER (WHERE ci.status = 'not_started') as not_started_count
    FROM backlot_clearance_items ci
    WHERE ci.related_person_id IS NOT NULL
    GROUP BY ci.project_id, ci.related_person_id, ci.related_person_name
)
SELECT
    pc.project_id,
    pc.person_id,
    pc.person_name,
    pc.total_clearances,
    pc.signed_count,
    pc.pending_count,
    pc.not_started_count,
    CASE
        WHEN pc.total_clearances = 0 THEN 0
        ELSE ROUND((pc.signed_count::numeric / pc.total_clearances) * 100)
    END as completion_percentage
FROM person_clearances pc;

-- View: Package assignment completion
CREATE OR REPLACE VIEW package_assignment_summary AS
SELECT
    pa.id as assignment_id,
    pa.package_id,
    pa.project_id,
    pa.assigned_to_user_id,
    pa.status as assignment_status,
    pa.due_date,
    dp.name as package_name,
    COUNT(pai.id) as total_items,
    COUNT(pai.id) FILTER (WHERE pai.status = 'signed' OR pai.status = 'approved') as signed_items,
    COUNT(pai.id) FILTER (WHERE pai.status IN ('requested', 'pending')) as pending_items,
    COUNT(pai.id) FILTER (WHERE pai.is_required = true) as required_items,
    COUNT(pai.id) FILTER (WHERE pai.is_required = true AND (pai.status = 'signed' OR pai.status = 'approved')) as required_signed,
    CASE
        WHEN COUNT(pai.id) FILTER (WHERE pai.is_required = true) = 0 THEN 100
        ELSE ROUND(
            (COUNT(pai.id) FILTER (WHERE pai.is_required = true AND (pai.status = 'signed' OR pai.status = 'approved'))::numeric
            / COUNT(pai.id) FILTER (WHERE pai.is_required = true)) * 100
        )
    END as completion_percentage
FROM backlot_document_package_assignments pa
JOIN backlot_document_packages dp ON dp.id = pa.package_id
LEFT JOIN backlot_document_package_assignment_items pai ON pai.assignment_id = pa.id
GROUP BY pa.id, pa.package_id, pa.project_id, pa.assigned_to_user_id, pa.status, pa.due_date, dp.name;

-- ==========================================
-- 9. Trigger to update assignment status
-- ==========================================

-- Function to update assignment status when items change
CREATE OR REPLACE FUNCTION update_package_assignment_status()
RETURNS TRIGGER AS $$
DECLARE
    v_assignment_id UUID;
    v_total_required INTEGER;
    v_completed_required INTEGER;
    v_any_in_progress INTEGER;
    v_new_status VARCHAR(30);
BEGIN
    -- Get the assignment ID
    IF TG_OP = 'DELETE' THEN
        v_assignment_id := OLD.assignment_id;
    ELSE
        v_assignment_id := NEW.assignment_id;
    END IF;

    -- Count items
    SELECT
        COUNT(*) FILTER (WHERE is_required = true),
        COUNT(*) FILTER (WHERE is_required = true AND (status = 'signed' OR status = 'approved')),
        COUNT(*) FILTER (WHERE status IN ('requested', 'pending', 'viewed'))
    INTO v_total_required, v_completed_required, v_any_in_progress
    FROM backlot_document_package_assignment_items
    WHERE assignment_id = v_assignment_id;

    -- Determine new status
    IF v_total_required > 0 AND v_completed_required = v_total_required THEN
        v_new_status := 'completed';
    ELSIF v_any_in_progress > 0 OR v_completed_required > 0 THEN
        v_new_status := 'in_progress';
    ELSE
        v_new_status := 'pending';
    END IF;

    -- Update the assignment
    UPDATE backlot_document_package_assignments
    SET
        status = v_new_status,
        completed_at = CASE WHEN v_new_status = 'completed' THEN NOW() ELSE NULL END,
        updated_at = NOW()
    WHERE id = v_assignment_id
    AND status != 'cancelled';

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_assignment_status ON backlot_document_package_assignment_items;
CREATE TRIGGER trigger_update_assignment_status
    AFTER INSERT OR UPDATE OF status OR DELETE
    ON backlot_document_package_assignment_items
    FOR EACH ROW
    EXECUTE FUNCTION update_package_assignment_status();

-- ==========================================
-- 10. Trigger to sync assignment item status from clearance
-- ==========================================

CREATE OR REPLACE FUNCTION sync_assignment_item_status()
RETURNS TRIGGER AS $$
BEGIN
    -- When clearance status changes, update the assignment item
    UPDATE backlot_document_package_assignment_items
    SET
        status = NEW.status,
        updated_at = NOW()
    WHERE clearance_id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_assignment_item_status ON backlot_clearance_items;
CREATE TRIGGER trigger_sync_assignment_item_status
    AFTER UPDATE OF status
    ON backlot_clearance_items
    FOR EACH ROW
    WHEN (NEW.package_assignment_item_id IS NOT NULL)
    EXECUTE FUNCTION sync_assignment_item_status();
