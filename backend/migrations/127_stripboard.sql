-- Stripboard Tables for Production Schedule Planning
-- A stripboard is where scenes become "strips" assigned to production days

-- Stripboard - one active stripboard per project
CREATE TABLE IF NOT EXISTS backlot_stripboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by_user_id UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlot_stripboards_project ON backlot_stripboards(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_backlot_stripboards_project_active ON backlot_stripboards(project_id) WHERE is_active = true;

-- Strips - individual cards/rows on the stripboard
-- Can be derived from ScriptScene or custom entries
CREATE TABLE IF NOT EXISTS backlot_strips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    stripboard_id UUID NOT NULL REFERENCES backlot_stripboards(id) ON DELETE CASCADE,
    script_scene_id UUID REFERENCES backlot_script_scenes(id) ON DELETE SET NULL,
    custom_title TEXT,
    unit TEXT NOT NULL DEFAULT 'A' CHECK (unit IN ('A', 'B', 'OTHER')),
    assigned_day_id UUID REFERENCES backlot_production_days(id) ON DELETE SET NULL,
    sort_order INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'SCHEDULED', 'SHOT', 'DROPPED')),
    notes TEXT,
    estimated_duration_minutes INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Ensure either script_scene_id or custom_title is provided
    CONSTRAINT strip_needs_scene_or_title CHECK (script_scene_id IS NOT NULL OR custom_title IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_backlot_strips_project ON backlot_strips(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_strips_stripboard ON backlot_strips(stripboard_id);
CREATE INDEX IF NOT EXISTS idx_backlot_strips_day ON backlot_strips(assigned_day_id);
CREATE INDEX IF NOT EXISTS idx_backlot_strips_scene ON backlot_strips(script_scene_id);
-- For ordering within a day: strips for a specific day ordered by sort_order
CREATE INDEX IF NOT EXISTS idx_backlot_strips_day_order ON backlot_strips(stripboard_id, assigned_day_id, sort_order);
-- For bank strips (unscheduled) ordering
CREATE INDEX IF NOT EXISTS idx_backlot_strips_bank_order ON backlot_strips(stripboard_id, sort_order) WHERE assigned_day_id IS NULL;
-- Unique sort order within a bucket (day or bank) - using partial unique indexes
-- Note: These are enforced at application level to allow reordering transactions

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_stripboard_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_backlot_stripboards_updated_at ON backlot_stripboards;
CREATE TRIGGER trigger_backlot_stripboards_updated_at
    BEFORE UPDATE ON backlot_stripboards
    FOR EACH ROW EXECUTE FUNCTION update_stripboard_updated_at();

DROP TRIGGER IF EXISTS trigger_backlot_strips_updated_at ON backlot_strips;
CREATE TRIGGER trigger_backlot_strips_updated_at
    BEFORE UPDATE ON backlot_strips
    FOR EACH ROW EXECUTE FUNCTION update_stripboard_updated_at();

-- Comments for documentation
COMMENT ON TABLE backlot_stripboards IS 'Stripboards for production schedule planning - one active per project';
COMMENT ON COLUMN backlot_stripboards.is_active IS 'Only one stripboard can be active per project';
COMMENT ON TABLE backlot_strips IS 'Individual strips/cards on a stripboard representing scenes or custom entries';
COMMENT ON COLUMN backlot_strips.script_scene_id IS 'Link to ScriptScene if derived from script, NULL for custom strips';
COMMENT ON COLUMN backlot_strips.custom_title IS 'Custom title for non-scene strips like company moves, meals, etc.';
COMMENT ON COLUMN backlot_strips.unit IS 'Production unit: A (main), B (second unit), or OTHER';
COMMENT ON COLUMN backlot_strips.assigned_day_id IS 'NULL means strip is in the bank (unscheduled)';
COMMENT ON COLUMN backlot_strips.sort_order IS 'Order within assigned day or bank';
COMMENT ON COLUMN backlot_strips.status IS 'PLANNED, SCHEDULED, SHOT, or DROPPED';
