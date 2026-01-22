-- Permission system for collab application viewing
-- Allows collab owners to grant others access to view applications

CREATE TABLE IF NOT EXISTS collab_application_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collab_id UUID NOT NULL REFERENCES community_collabs(id) ON DELETE CASCADE,
    granted_to_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    granted_by_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    permission_level VARCHAR(50) DEFAULT 'view', -- 'view', 'manage', 'admin'
    can_update_status BOOLEAN DEFAULT false,
    can_message_applicants BOOLEAN DEFAULT false,
    can_book_applicants BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(collab_id, granted_to_user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_collab_app_perms_collab ON collab_application_permissions(collab_id);
CREATE INDEX IF NOT EXISTS idx_collab_app_perms_user ON collab_application_permissions(granted_to_user_id);
CREATE INDEX IF NOT EXISTS idx_collab_app_perms_granted_by ON collab_application_permissions(granted_by_user_id);

-- Comments
COMMENT ON TABLE collab_application_permissions IS 'Grants permission to view/manage applications for a collab';
COMMENT ON COLUMN collab_application_permissions.permission_level IS 'view=read only, manage=update status, admin=full control';
COMMENT ON COLUMN collab_application_permissions.can_update_status IS 'Can change application status (shortlist, reject, etc)';
COMMENT ON COLUMN collab_application_permissions.can_message_applicants IS 'Can send messages to applicants';
COMMENT ON COLUMN collab_application_permissions.can_book_applicants IS 'Can book applicants for the role';

-- Also add a production_id field to community_collabs if not exists
-- This links collabs to backlot productions for team integration
ALTER TABLE community_collabs
ADD COLUMN IF NOT EXISTS production_id UUID REFERENCES backlot_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_collabs_production ON community_collabs(production_id) WHERE production_id IS NOT NULL;

COMMENT ON COLUMN community_collabs.production_id IS 'Links collab to a backlot production for team access';
