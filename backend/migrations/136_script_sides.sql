-- Migration 136: Script Sides Integration
-- Extends continuity_exports to support script sides packets linked to production days and call sheets

-- Add columns for sides packet linking
ALTER TABLE backlot_continuity_exports
ADD COLUMN IF NOT EXISTS production_day_id UUID REFERENCES backlot_production_days(id) ON DELETE SET NULL;

ALTER TABLE backlot_continuity_exports
ADD COLUMN IF NOT EXISTS call_sheet_id UUID REFERENCES backlot_call_sheets(id) ON DELETE SET NULL;

ALTER TABLE backlot_continuity_exports
ADD COLUMN IF NOT EXISTS source_export_id UUID REFERENCES backlot_continuity_exports(id) ON DELETE SET NULL;

ALTER TABLE backlot_continuity_exports
ADD COLUMN IF NOT EXISTS extracted_scene_ids JSONB DEFAULT NULL;

ALTER TABLE backlot_continuity_exports
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';

-- Add comments for documentation
COMMENT ON COLUMN backlot_continuity_exports.production_day_id IS
'Links sides packet to a specific production/shoot day';

COMMENT ON COLUMN backlot_continuity_exports.call_sheet_id IS
'Links sides packet to a specific call sheet';

COMMENT ON COLUMN backlot_continuity_exports.source_export_id IS
'For extracted sides, references the master script export they were extracted from';

COMMENT ON COLUMN backlot_continuity_exports.extracted_scene_ids IS
'Array of scene IDs included in this sides packet: ["scene-uuid-1", "scene-uuid-2", ...]';

COMMENT ON COLUMN backlot_continuity_exports.status IS
'Status of the sides packet: draft, published, sent';

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_continuity_exports_production_day
ON backlot_continuity_exports(production_day_id) WHERE production_day_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_continuity_exports_call_sheet
ON backlot_continuity_exports(call_sheet_id) WHERE call_sheet_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_continuity_exports_type
ON backlot_continuity_exports(export_type);

CREATE INDEX IF NOT EXISTS idx_continuity_exports_source
ON backlot_continuity_exports(source_export_id) WHERE source_export_id IS NOT NULL;

-- Composite index for finding sides by project + type
CREATE INDEX IF NOT EXISTS idx_continuity_exports_project_type
ON backlot_continuity_exports(project_id, export_type);
