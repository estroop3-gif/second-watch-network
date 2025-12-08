-- Migration: 021_script_breakdown_extension.sql
-- Description: Extend scene breakdown items with department and stripboard_day fields
-- Date: 2025-12-07

-- ============================================================================
-- PHASE 1: Add new columns to backlot_scene_breakdown_items
-- ============================================================================

-- Add department field for organizing breakdown items by production department
ALTER TABLE backlot_scene_breakdown_items
ADD COLUMN IF NOT EXISTS department TEXT;

-- Add stripboard_day for optional mapping to schedule day
ALTER TABLE backlot_scene_breakdown_items
ADD COLUMN IF NOT EXISTS stripboard_day INTEGER;

-- ============================================================================
-- PHASE 2: Create index for department filtering
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_breakdown_items_department
ON backlot_scene_breakdown_items(scene_id, department);

CREATE INDEX IF NOT EXISTS idx_breakdown_items_stripboard_day
ON backlot_scene_breakdown_items(stripboard_day)
WHERE stripboard_day IS NOT NULL;

-- ============================================================================
-- PHASE 3: Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN backlot_scene_breakdown_items.department IS
  'Production department responsible for this item (cast, locations, props, wardrobe, makeup, sfx, vfx, background, stunts, camera, sound)';

COMMENT ON COLUMN backlot_scene_breakdown_items.stripboard_day IS
  'Optional stripboard day number for mapping to production schedule';
