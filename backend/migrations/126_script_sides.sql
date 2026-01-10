-- Script Sides Auto Generator Tables
-- Script documents with Fountain parsing, sides packets for production days

-- Script Documents - holds raw script text
CREATE TABLE IF NOT EXISTS backlot_script_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'FOUNTAIN' CHECK (format IN ('FOUNTAIN', 'PLAIN')),
    raw_text TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by_user_id UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlot_script_documents_project ON backlot_script_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_script_documents_project_active ON backlot_script_documents(project_id, is_active);

-- Script Scenes - parsed from script document
CREATE TABLE IF NOT EXISTS backlot_script_scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_document_id UUID NOT NULL REFERENCES backlot_script_documents(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    scene_number INT NOT NULL,
    slugline TEXT NOT NULL,
    location TEXT,
    time_of_day TEXT,
    page_start FLOAT,
    page_end FLOAT,
    raw_scene_text TEXT NOT NULL,
    characters JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlot_script_scenes_project ON backlot_script_scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_script_scenes_document ON backlot_script_scenes(script_document_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_backlot_script_scenes_doc_number ON backlot_script_scenes(script_document_id, scene_number);

-- Schedule Day Scenes - links scenes to production days (for schedule integration)
CREATE TABLE IF NOT EXISTS backlot_schedule_day_scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    production_day_id UUID NOT NULL REFERENCES backlot_production_days(id) ON DELETE CASCADE,
    script_scene_id UUID NOT NULL REFERENCES backlot_script_scenes(id) ON DELETE CASCADE,
    sort_order INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlot_schedule_day_scenes_project ON backlot_schedule_day_scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_schedule_day_scenes_day ON backlot_schedule_day_scenes(production_day_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_backlot_schedule_day_scenes_day_order ON backlot_schedule_day_scenes(production_day_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_backlot_schedule_day_scenes_day_scene ON backlot_schedule_day_scenes(production_day_id, script_scene_id);

-- Sides Packets - printable packets for production days
CREATE TABLE IF NOT EXISTS backlot_sides_packets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    production_day_id UUID NOT NULL REFERENCES backlot_production_days(id) ON DELETE CASCADE,
    episode_id UUID,  -- Optional link to episode
    title TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
    created_by_user_id UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlot_sides_packets_project ON backlot_sides_packets(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_sides_packets_day ON backlot_sides_packets(production_day_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_backlot_sides_packets_project_day_title ON backlot_sides_packets(project_id, production_day_id, title);

-- Sides Packet Scenes - scenes included in a sides packet
CREATE TABLE IF NOT EXISTS backlot_sides_packet_scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sides_packet_id UUID NOT NULL REFERENCES backlot_sides_packets(id) ON DELETE CASCADE,
    script_scene_id UUID NOT NULL REFERENCES backlot_script_scenes(id) ON DELETE CASCADE,
    sort_order INT NOT NULL,
    scene_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlot_sides_packet_scenes_packet ON backlot_sides_packet_scenes(sides_packet_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_backlot_sides_packet_scenes_packet_order ON backlot_sides_packet_scenes(sides_packet_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_backlot_sides_packet_scenes_packet_scene ON backlot_sides_packet_scenes(sides_packet_id, script_scene_id);

-- Updated at triggers
CREATE OR REPLACE FUNCTION update_script_sides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_backlot_script_documents_updated_at ON backlot_script_documents;
CREATE TRIGGER trigger_backlot_script_documents_updated_at
    BEFORE UPDATE ON backlot_script_documents
    FOR EACH ROW EXECUTE FUNCTION update_script_sides_updated_at();

DROP TRIGGER IF EXISTS trigger_backlot_script_scenes_updated_at ON backlot_script_scenes;
CREATE TRIGGER trigger_backlot_script_scenes_updated_at
    BEFORE UPDATE ON backlot_script_scenes
    FOR EACH ROW EXECUTE FUNCTION update_script_sides_updated_at();

DROP TRIGGER IF EXISTS trigger_backlot_sides_packets_updated_at ON backlot_sides_packets;
CREATE TRIGGER trigger_backlot_sides_packets_updated_at
    BEFORE UPDATE ON backlot_sides_packets
    FOR EACH ROW EXECUTE FUNCTION update_script_sides_updated_at();

DROP TRIGGER IF EXISTS trigger_backlot_sides_packet_scenes_updated_at ON backlot_sides_packet_scenes;
CREATE TRIGGER trigger_backlot_sides_packet_scenes_updated_at
    BEFORE UPDATE ON backlot_sides_packet_scenes
    FOR EACH ROW EXECUTE FUNCTION update_script_sides_updated_at();

-- Comments for documentation
COMMENT ON TABLE backlot_script_documents IS 'Script documents with raw Fountain or plain text';
COMMENT ON COLUMN backlot_script_documents.format IS 'FOUNTAIN or PLAIN - determines parsing strategy';
COMMENT ON TABLE backlot_script_scenes IS 'Parsed scenes from a script document';
COMMENT ON COLUMN backlot_script_scenes.characters IS 'JSON array of character names derived from dialogue lines';
COMMENT ON TABLE backlot_schedule_day_scenes IS 'Links script scenes to production days for scheduling';
COMMENT ON TABLE backlot_sides_packets IS 'Printable sides packets for production days';
COMMENT ON COLUMN backlot_sides_packets.status IS 'DRAFT or PUBLISHED';
COMMENT ON TABLE backlot_sides_packet_scenes IS 'Scenes included in a sides packet with optional notes';
