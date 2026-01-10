-- Episode Management Tables
-- For managing episodes within projects (supports docu-series and scripted)

-- Note: seasons table was created in initial run, drop to recreate with proper constraints
DROP TABLE IF EXISTS episode_shoot_days CASCADE;
DROP TABLE IF EXISTS episode_approvals CASCADE;
DROP TABLE IF EXISTS episode_asset_links CASCADE;
DROP TABLE IF EXISTS episode_deliverables CASCADE;
DROP TABLE IF EXISTS episode_milestones CASCADE;
DROP TABLE IF EXISTS episode_list_items CASCADE;
DROP TABLE IF EXISTS episode_locations CASCADE;
DROP TABLE IF EXISTS episode_subjects CASCADE;
DROP TABLE IF EXISTS project_deliverable_templates CASCADE;
DROP TABLE IF EXISTS project_episode_settings CASCADE;
DROP TABLE IF EXISTS episodes CASCADE;
DROP TABLE IF EXISTS seasons CASCADE;

-- Seasons table
CREATE TABLE seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    season_number INT NOT NULL,
    title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT seasons_project_season_unique UNIQUE(project_id, season_number)
);

CREATE INDEX idx_seasons_project ON seasons(project_id);

-- Episodes table
CREATE TABLE episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    season_id UUID REFERENCES seasons(id) ON DELETE SET NULL,
    episode_number INT NOT NULL,
    episode_code TEXT NOT NULL,
    title TEXT NOT NULL,
    logline TEXT,
    synopsis TEXT,
    outline TEXT,
    beat_sheet TEXT,
    notes TEXT,

    -- Status fields
    pipeline_stage TEXT NOT NULL DEFAULT 'DEVELOPMENT'
        CHECK (pipeline_stage IN ('DEVELOPMENT', 'PRE_PRO', 'PRODUCTION', 'POST', 'DELIVERED', 'RELEASED')),
    edit_status TEXT NOT NULL DEFAULT 'NOT_STARTED'
        CHECK (edit_status IN ('NOT_STARTED', 'INGEST', 'ASSEMBLY', 'ROUGH_CUT', 'FINE_CUT', 'PICTURE_LOCK', 'SOUND', 'COLOR', 'MASTERING')),
    delivery_status TEXT NOT NULL DEFAULT 'NOT_STARTED'
        CHECK (delivery_status IN ('NOT_STARTED', 'QC', 'CAPTIONS', 'ARTWORK', 'EXPORTS', 'DELIVERED', 'RELEASED')),

    -- Edit lock
    is_edit_locked BOOLEAN NOT NULL DEFAULT FALSE,

    -- Team assignments
    editor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ae_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    post_supervisor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

    -- Runtime
    planned_runtime_minutes INT,
    actual_runtime_minutes INT,

    -- Audit
    created_by_user_id UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT episodes_project_code_unique UNIQUE(project_id, episode_code),
    CONSTRAINT episodes_project_season_number_unique UNIQUE(project_id, season_id, episode_number)
);

CREATE INDEX idx_episodes_project ON episodes(project_id);
CREATE INDEX idx_episodes_season ON episodes(season_id);
CREATE INDEX idx_episodes_pipeline_stage ON episodes(project_id, pipeline_stage);

-- Episode subjects (cast, crew, contributors for this episode)
CREATE TABLE episode_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    subject_type TEXT NOT NULL CHECK (subject_type IN ('CAST', 'CREW', 'CONTRIBUTOR', 'OTHER')),
    name TEXT NOT NULL,
    role TEXT,
    contact_info TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_episode_subjects_episode ON episode_subjects(episode_id);

-- Episode locations
CREATE TABLE episode_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_episode_locations_episode ON episode_locations(episode_id);

-- Episode list items (interviews, scenes, segments)
CREATE TABLE episode_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('INTERVIEW', 'SCENE', 'SEGMENT')),
    sort_order INT NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT episode_list_items_unique_order UNIQUE(episode_id, kind, sort_order)
);

CREATE INDEX idx_episode_list_items_episode ON episode_list_items(episode_id);

-- Episode milestones (key dates)
CREATE TABLE episode_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    milestone_type TEXT NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_episode_milestones_episode ON episode_milestones(episode_id);

-- Episode deliverables
CREATE TABLE episode_deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    deliverable_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'NOT_STARTED'
        CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'APPROVED', 'DELIVERED')),
    due_date DATE,
    owner_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_episode_deliverables_episode ON episode_deliverables(episode_id);

-- Project deliverable templates
CREATE TABLE project_deliverable_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_deliverable_templates_project ON project_deliverable_templates(project_id);

-- Episode asset links
CREATE TABLE episode_asset_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_episode_asset_links_episode ON episode_asset_links(episode_id);

-- Episode shoot days (linking episodes to production days from DOOD)
CREATE TABLE episode_shoot_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    production_day_id UUID NOT NULL REFERENCES backlot_production_days(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT episode_shoot_days_unique UNIQUE(episode_id, production_day_id)
);

CREATE INDEX idx_episode_shoot_days_episode ON episode_shoot_days(episode_id);
CREATE INDEX idx_episode_shoot_days_production_day ON episode_shoot_days(production_day_id);

-- Episode approvals (edit lock and delivery approval workflow)
CREATE TABLE episode_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    approval_type TEXT NOT NULL CHECK (approval_type IN ('EDIT_LOCK', 'DELIVERY_APPROVAL')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    requested_by_user_id UUID NOT NULL REFERENCES profiles(id),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_by_user_id UUID REFERENCES profiles(id),
    decided_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_episode_approvals_episode ON episode_approvals(episode_id);
CREATE INDEX idx_episode_approvals_status ON episode_approvals(episode_id, status);

-- Project episode settings (configurable permissions)
CREATE TABLE project_episode_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE REFERENCES backlot_projects(id) ON DELETE CASCADE,
    settings_json JSONB NOT NULL DEFAULT '{
        "canCreate": ["OWNER", "ADMIN", "PRODUCER"],
        "canEdit": ["OWNER", "ADMIN", "PRODUCER", "COORDINATOR"],
        "canDelete": ["OWNER", "ADMIN"],
        "canApproveEditLock": ["OWNER", "ADMIN", "SHOWRUNNER"],
        "canApproveDelivery": ["OWNER", "ADMIN", "DISTRIBUTION"],
        "defaultAssignees": {"editorUserId": null, "postSupervisorUserId": null}
    }',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add episode_id to storyboards for linking
ALTER TABLE storyboards ADD COLUMN IF NOT EXISTS episode_id UUID REFERENCES episodes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_storyboards_episode ON storyboards(episode_id);

-- Comments
COMMENT ON TABLE seasons IS 'Seasons within a project for organizing episodes';
COMMENT ON TABLE episodes IS 'Individual episodes within a project';
COMMENT ON COLUMN episodes.pipeline_stage IS 'DEVELOPMENT, PRE_PRO, PRODUCTION, POST, DELIVERED, RELEASED';
COMMENT ON COLUMN episodes.edit_status IS 'Post-production editorial status';
COMMENT ON COLUMN episodes.delivery_status IS 'Packaging and delivery status';
COMMENT ON COLUMN episodes.is_edit_locked IS 'True when episode is locked via approved EDIT_LOCK approval';
COMMENT ON TABLE episode_subjects IS 'Cast, crew, and contributors specific to an episode';
COMMENT ON TABLE episode_list_items IS 'Interviews, scenes, and segments within an episode';
COMMENT ON TABLE episode_milestones IS 'Key dates and deadlines for an episode';
COMMENT ON TABLE episode_deliverables IS 'Deliverables required for an episode';
COMMENT ON TABLE project_deliverable_templates IS 'Reusable deliverable templates at project level';
COMMENT ON TABLE episode_asset_links IS 'Links to external assets for an episode';
COMMENT ON TABLE episode_shoot_days IS 'Links episodes to production days from DOOD';
COMMENT ON TABLE episode_approvals IS 'Approval workflow for edit locks and delivery approvals';
COMMENT ON TABLE project_episode_settings IS 'Per-project configurable episode permissions';
COMMENT ON COLUMN storyboards.episode_id IS 'Optional link to an episode for episode-specific storyboards';
