-- Day Out of Days (DOOD) Tables
-- For tracking cast/crew availability across shoot schedules

-- Add day_type to backlot_production_days if not exists
-- Existing 'type' field may be used differently, so add new explicit day_type
ALTER TABLE backlot_production_days
    ADD COLUMN IF NOT EXISTS day_type TEXT DEFAULT 'SHOOT'
    CHECK (day_type IN ('SHOOT', 'TRAVEL', 'REHEARSAL', 'FITTING', 'TECH_SCOUT', 'PICKUP', 'HOLD', 'DARK'));

-- DOOD Subjects - Cast, crew, or other entities tracked in DOOD
CREATE TABLE IF NOT EXISTS dood_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    subject_type TEXT NOT NULL CHECK (subject_type IN ('CAST', 'BACKGROUND', 'CREW', 'OTHER')),
    department TEXT,
    notes TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dood_subjects_project ON dood_subjects(project_id);
CREATE INDEX IF NOT EXISTS idx_dood_subjects_project_order ON dood_subjects(project_id, sort_order);

-- DOOD Assignments - Individual cell entries (subject + day = code)
-- Codes: W=Work, H=Hold, T=Travel, R=Rehearsal, F=Fitting, S=Tech Scout, P=Pickup, O=Off, D=Drop
CREATE TABLE IF NOT EXISTS dood_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES dood_subjects(id) ON DELETE CASCADE,
    day_id UUID NOT NULL REFERENCES backlot_production_days(id) ON DELETE CASCADE,
    code TEXT NOT NULL CHECK (code IN ('W', 'H', 'T', 'R', 'F', 'S', 'P', 'O', 'D')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(subject_id, day_id)
);

CREATE INDEX IF NOT EXISTS idx_dood_assignments_project ON dood_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_dood_assignments_project_day ON dood_assignments(project_id, day_id);
CREATE INDEX IF NOT EXISTS idx_dood_assignments_subject ON dood_assignments(subject_id);

-- DOOD Versions - Immutable snapshots of published DOOD ranges
CREATE TABLE IF NOT EXISTS dood_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    range_start DATE NOT NULL,
    range_end DATE NOT NULL,
    version_number INT NOT NULL,
    snapshot_json JSONB NOT NULL,
    created_by_user_id UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_dood_versions_project ON dood_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_dood_versions_project_range ON dood_versions(project_id, range_start, range_end);

-- Comments for documentation
COMMENT ON TABLE dood_subjects IS 'Subjects (cast, crew, etc.) tracked in Day Out of Days reports';
COMMENT ON COLUMN dood_subjects.subject_type IS 'CAST, BACKGROUND, CREW, or OTHER';
COMMENT ON TABLE dood_assignments IS 'Cell assignments in DOOD grid - maps subject to day with a code';
COMMENT ON COLUMN dood_assignments.code IS 'W=Work, H=Hold, T=Travel, R=Rehearsal, F=Fitting, S=Scout, P=Pickup, O=Off, D=Drop';
COMMENT ON TABLE dood_versions IS 'Immutable published snapshots of DOOD for a date range';
COMMENT ON COLUMN dood_versions.snapshot_json IS 'JSON containing days, subjects, and assignments at time of publish';
