-- Migration 132: Add scene_mappings column to continuity exports
-- Stores scene-to-page mappings for PDF navigation

ALTER TABLE backlot_continuity_exports
ADD COLUMN IF NOT EXISTS scene_mappings JSONB DEFAULT NULL;

COMMENT ON COLUMN backlot_continuity_exports.scene_mappings IS
'Scene-to-page mappings for navigation: {"scenes": [...], "addendums": {...}}';
