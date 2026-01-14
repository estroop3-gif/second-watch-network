-- Episode Integrations Migration
-- Adds links between episodes and project-level data (locations, deliverables, assets)
-- Expands approval types

-- Episode Locations: Link to project locations
ALTER TABLE episode_locations
ADD COLUMN IF NOT EXISTS project_location_id UUID REFERENCES backlot_project_locations(id);

-- Production Days: Track milestone origin (for Key Dates -> Schedule integration)
ALTER TABLE backlot_production_days
ADD COLUMN IF NOT EXISTS source_milestone_id UUID REFERENCES episode_milestones(id);

-- Episode Deliverables: Link to project deliverables
ALTER TABLE episode_deliverables
ADD COLUMN IF NOT EXISTS project_deliverable_id UUID REFERENCES backlot_project_deliverables(id);

-- Episode Asset Links: Link to actual assets (not just URLs)
ALTER TABLE episode_asset_links
ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES backlot_assets(id);

-- Make URL optional when asset_id is set
ALTER TABLE episode_asset_links ALTER COLUMN url DROP NOT NULL;

-- Add constraint: either url or asset_id must be set
ALTER TABLE episode_asset_links DROP CONSTRAINT IF EXISTS episode_asset_links_url_or_asset;
ALTER TABLE episode_asset_links ADD CONSTRAINT episode_asset_links_url_or_asset
CHECK (url IS NOT NULL OR asset_id IS NOT NULL);

-- Expanded Approval Types
ALTER TABLE episode_approvals DROP CONSTRAINT IF EXISTS episode_approvals_approval_type_check;
ALTER TABLE episode_approvals ADD CONSTRAINT episode_approvals_approval_type_check
CHECK (approval_type IN (
  'EDIT_LOCK', 'DELIVERY_APPROVAL',
  'ROUGH_CUT', 'FINE_CUT', 'PICTURE_LOCK', 'COLOR', 'SOUND'
));

-- Episode Subjects: Link to project contacts
ALTER TABLE episode_subjects
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES backlot_project_contacts(id);

-- Indexes for new foreign keys
CREATE INDEX IF NOT EXISTS idx_episode_locations_project_location
ON episode_locations(project_location_id) WHERE project_location_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_production_days_source_milestone
ON backlot_production_days(source_milestone_id) WHERE source_milestone_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_episode_deliverables_project_deliverable
ON episode_deliverables(project_deliverable_id) WHERE project_deliverable_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_episode_asset_links_asset
ON episode_asset_links(asset_id) WHERE asset_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_episode_subjects_contact
ON episode_subjects(contact_id) WHERE contact_id IS NOT NULL;
