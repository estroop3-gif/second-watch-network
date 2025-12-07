-- ============================================================
-- CASTING & CREW HIRING PIPELINE TABLES
-- Migration 014: Enables role postings, applications, and availability tracking
-- ============================================================

-- ============ Project Roles Table ============
-- Roles (cast and crew) that producers post for their projects

CREATE TABLE IF NOT EXISTS backlot_project_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,

    -- Role type and details
    type VARCHAR(20) NOT NULL CHECK (type IN ('cast', 'crew')),
    title TEXT NOT NULL,  -- e.g., "1st AC", "Supporting: Elias' roommate"
    description TEXT,
    department TEXT,  -- For crew: camera, sound, grip, etc.

    -- Character details (for cast roles)
    character_name TEXT,
    character_description TEXT,
    age_range TEXT,  -- e.g., "25-35"
    gender_requirement TEXT,  -- e.g., "any", "male", "female"

    -- Location and schedule
    location TEXT,  -- e.g., "Tampa", "Atlanta"
    start_date DATE,
    end_date DATE,
    days_estimated NUMERIC(5,1),  -- e.g., 3.5 days

    -- Compensation
    paid BOOLEAN NOT NULL DEFAULT false,
    rate_description TEXT,  -- e.g., "$200/day", "Deferred", "Copy & Credit"
    rate_amount_cents INTEGER,  -- Optional fixed rate in cents
    rate_type VARCHAR(20) CHECK (rate_type IN ('flat', 'daily', 'weekly', 'hourly')),

    -- Visibility and access
    is_order_only BOOLEAN NOT NULL DEFAULT false,  -- Only Order members can see/apply
    is_featured BOOLEAN NOT NULL DEFAULT false,  -- Featured on public listings

    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'closed', 'booked', 'cancelled')),
    booked_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    booked_at TIMESTAMPTZ,

    -- Application settings
    requires_reel BOOLEAN DEFAULT false,
    requires_headshot BOOLEAN DEFAULT false,
    application_deadline DATE,
    max_applications INTEGER,  -- Optional cap on applications

    -- Audit
    created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for project roles
CREATE INDEX IF NOT EXISTS idx_backlot_project_roles_project_id ON backlot_project_roles(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_project_roles_type ON backlot_project_roles(type);
CREATE INDEX IF NOT EXISTS idx_backlot_project_roles_status ON backlot_project_roles(status);
CREATE INDEX IF NOT EXISTS idx_backlot_project_roles_is_order_only ON backlot_project_roles(is_order_only);
CREATE INDEX IF NOT EXISTS idx_backlot_project_roles_created_by ON backlot_project_roles(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_backlot_project_roles_booked_user ON backlot_project_roles(booked_user_id);
CREATE INDEX IF NOT EXISTS idx_backlot_project_roles_location ON backlot_project_roles(location);
CREATE INDEX IF NOT EXISTS idx_backlot_project_roles_start_date ON backlot_project_roles(start_date);


-- ============ Role Applications Table ============
-- Applications from users to project roles

CREATE TABLE IF NOT EXISTS backlot_project_role_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES backlot_project_roles(id) ON DELETE CASCADE,
    applicant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Cached applicant info at time of application (snapshot)
    applicant_profile_snapshot JSONB NOT NULL DEFAULT '{}',
    -- Schema: { name, avatar_url, primary_role, department, city, credits_summary, portfolio_url, reel_url }

    -- Application content
    cover_note TEXT,
    availability_notes TEXT,
    rate_expectation TEXT,

    -- Attachments
    reel_url TEXT,
    headshot_url TEXT,
    resume_url TEXT,

    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'applied' CHECK (status IN (
        'applied', 'viewed', 'shortlisted', 'interview', 'offered', 'booked', 'rejected', 'withdrawn'
    )),
    status_changed_at TIMESTAMPTZ,
    status_changed_by_user_id UUID REFERENCES auth.users(id),

    -- Producer notes (internal)
    internal_notes TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Prevent duplicate applications
    UNIQUE(role_id, applicant_user_id)
);

-- Indexes for role applications
CREATE INDEX IF NOT EXISTS idx_backlot_role_applications_role_id ON backlot_project_role_applications(role_id);
CREATE INDEX IF NOT EXISTS idx_backlot_role_applications_applicant ON backlot_project_role_applications(applicant_user_id);
CREATE INDEX IF NOT EXISTS idx_backlot_role_applications_status ON backlot_project_role_applications(status);
CREATE INDEX IF NOT EXISTS idx_backlot_role_applications_created_at ON backlot_project_role_applications(created_at DESC);


-- ============ User Availability Table ============
-- Per-date availability for users (used for scheduling)

CREATE TABLE IF NOT EXISTS backlot_user_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Date and status
    date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN (
        'available', 'unavailable', 'hold', 'booked', 'tentative'
    )),

    -- Context
    project_id UUID REFERENCES backlot_projects(id) ON DELETE SET NULL,  -- If booked/hold for specific project
    role_id UUID REFERENCES backlot_project_roles(id) ON DELETE SET NULL,  -- If booked for specific role
    notes TEXT,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One entry per user per date
    UNIQUE(user_id, date)
);

-- Indexes for user availability
CREATE INDEX IF NOT EXISTS idx_backlot_user_availability_user_id ON backlot_user_availability(user_id);
CREATE INDEX IF NOT EXISTS idx_backlot_user_availability_date ON backlot_user_availability(date);
CREATE INDEX IF NOT EXISTS idx_backlot_user_availability_status ON backlot_user_availability(status);
CREATE INDEX IF NOT EXISTS idx_backlot_user_availability_project ON backlot_user_availability(project_id);
CREATE INDEX IF NOT EXISTS idx_backlot_user_availability_user_date ON backlot_user_availability(user_id, date);


-- ============ Booked Crew/Cast for Call Sheets ============
-- Links booked roles to call sheet people for easy integration

CREATE TABLE IF NOT EXISTS backlot_call_sheet_role_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_sheet_id UUID NOT NULL REFERENCES backlot_call_sheets(id) ON DELETE CASCADE,
    call_sheet_person_id UUID NOT NULL REFERENCES backlot_call_sheet_people(id) ON DELETE CASCADE,
    project_role_id UUID NOT NULL REFERENCES backlot_project_roles(id) ON DELETE CASCADE,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(call_sheet_id, call_sheet_person_id)
);

-- Indexes for call sheet role links
CREATE INDEX IF NOT EXISTS idx_backlot_cs_role_links_call_sheet ON backlot_call_sheet_role_links(call_sheet_id);
CREATE INDEX IF NOT EXISTS idx_backlot_cs_role_links_person ON backlot_call_sheet_role_links(call_sheet_person_id);
CREATE INDEX IF NOT EXISTS idx_backlot_cs_role_links_role ON backlot_call_sheet_role_links(project_role_id);


-- ============ Role Requirements Table (Optional) ============
-- Specific requirements/qualifications for roles

CREATE TABLE IF NOT EXISTS backlot_role_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES backlot_project_roles(id) ON DELETE CASCADE,

    requirement_type VARCHAR(50) NOT NULL,  -- 'skill', 'certification', 'equipment', 'physical', 'other'
    requirement_text TEXT NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT true,  -- Required vs preferred

    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for role requirements
CREATE INDEX IF NOT EXISTS idx_backlot_role_requirements_role_id ON backlot_role_requirements(role_id);


-- ============ Triggers for updated_at ============

CREATE TRIGGER update_backlot_project_roles_updated_at
    BEFORE UPDATE ON backlot_project_roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_backlot_role_applications_updated_at
    BEFORE UPDATE ON backlot_project_role_applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_backlot_user_availability_updated_at
    BEFORE UPDATE ON backlot_user_availability
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============ Helper Functions ============

-- Function to check if a user is an Order member
CREATE OR REPLACE FUNCTION is_order_member(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM order_member_profiles
        WHERE user_id = user_uuid
        AND status IN ('active', 'probationary')
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get user profile snapshot for applications
CREATE OR REPLACE FUNCTION get_applicant_profile_snapshot(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    snapshot JSONB;
BEGIN
    SELECT jsonb_build_object(
        'name', COALESCE(p.full_name, p.username, 'Unknown'),
        'avatar_url', p.avatar_url,
        'primary_role', COALESCE(fp.department, omp.primary_track, 'Unknown'),
        'department', COALESCE(fp.department, omp.primary_track),
        'city', COALESCE(fp.location, omp.city),
        'portfolio_url', COALESCE(fp.portfolio_url, omp.portfolio_url),
        'reel_url', fp.reel_url,
        'years_experience', omp.years_experience,
        'is_order_member', (omp.id IS NOT NULL AND omp.status IN ('active', 'probationary'))
    ) INTO snapshot
    FROM profiles p
    LEFT JOIN filmmaker_profiles fp ON fp.user_id = p.id
    LEFT JOIN order_member_profiles omp ON omp.user_id = p.id
    WHERE p.id = user_uuid;

    RETURN COALESCE(snapshot, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Function to auto-populate availability when role is booked
CREATE OR REPLACE FUNCTION auto_set_availability_on_booking()
RETURNS TRIGGER AS $$
BEGIN
    -- When a role is booked, mark the user's dates as booked
    IF NEW.status = 'booked' AND NEW.booked_user_id IS NOT NULL
       AND NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL THEN
        INSERT INTO backlot_user_availability (user_id, date, status, project_id, role_id, notes)
        SELECT
            NEW.booked_user_id,
            d::date,
            'booked',
            NEW.project_id,
            NEW.id,
            'Auto-booked for: ' || NEW.title
        FROM generate_series(NEW.start_date, NEW.end_date, '1 day'::interval) d
        ON CONFLICT (user_id, date)
        DO UPDATE SET
            status = 'booked',
            project_id = EXCLUDED.project_id,
            role_id = EXCLUDED.role_id,
            notes = EXCLUDED.notes,
            updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_availability_on_role_booking
    AFTER UPDATE OF status, booked_user_id ON backlot_project_roles
    FOR EACH ROW
    WHEN (NEW.status = 'booked')
    EXECUTE FUNCTION auto_set_availability_on_booking();


-- ============ Views for Common Queries ============

-- View: Open roles with project info
CREATE OR REPLACE VIEW v_open_project_roles AS
SELECT
    r.*,
    p.title AS project_title,
    p.slug AS project_slug,
    p.cover_image_url AS project_image,
    p.status AS project_status,
    p.owner_id AS project_owner_id,
    (SELECT COUNT(*) FROM backlot_project_role_applications WHERE role_id = r.id) AS application_count,
    (SELECT COUNT(*) FROM backlot_project_role_applications WHERE role_id = r.id AND status = 'shortlisted') AS shortlisted_count
FROM backlot_project_roles r
JOIN backlot_projects p ON p.id = r.project_id
WHERE r.status = 'open';

-- View: User's applications with role details
CREATE OR REPLACE VIEW v_user_role_applications AS
SELECT
    a.*,
    r.title AS role_title,
    r.type AS role_type,
    r.department,
    r.location,
    r.start_date,
    r.end_date,
    r.paid,
    r.rate_description,
    r.status AS role_status,
    p.id AS project_id,
    p.title AS project_title,
    p.slug AS project_slug
FROM backlot_project_role_applications a
JOIN backlot_project_roles r ON r.id = a.role_id
JOIN backlot_projects p ON p.id = r.project_id;


-- ============ Row Level Security ============

ALTER TABLE backlot_project_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_project_role_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_user_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_call_sheet_role_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_role_requirements ENABLE ROW LEVEL SECURITY;

-- Project Roles: Anyone can see open public roles, members can see project roles
CREATE POLICY "Public can view open non-order roles"
ON backlot_project_roles FOR SELECT
USING (status = 'open' AND is_order_only = false);

CREATE POLICY "Order members can view order-only roles"
ON backlot_project_roles FOR SELECT
USING (status = 'open' AND is_order_only = true AND is_order_member(auth.uid()));

CREATE POLICY "Project members can view all project roles"
ON backlot_project_roles FOR SELECT
USING (
    project_id IN (
        SELECT id FROM backlot_projects WHERE owner_id = auth.uid()
        UNION
        SELECT project_id FROM backlot_project_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Project admins can manage roles"
ON backlot_project_roles FOR ALL
USING (
    project_id IN (
        SELECT id FROM backlot_projects WHERE owner_id = auth.uid()
        UNION
        SELECT project_id FROM backlot_project_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'editor')
    )
);

-- Applications: Users see their own, project admins see all for their roles
CREATE POLICY "Users can view own applications"
ON backlot_project_role_applications FOR SELECT
USING (applicant_user_id = auth.uid());

CREATE POLICY "Project admins can view role applications"
ON backlot_project_role_applications FOR SELECT
USING (
    role_id IN (
        SELECT r.id FROM backlot_project_roles r
        JOIN backlot_projects p ON p.id = r.project_id
        WHERE p.owner_id = auth.uid()
        UNION
        SELECT r.id FROM backlot_project_roles r
        JOIN backlot_project_members m ON m.project_id = r.project_id
        WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin', 'editor')
    )
);

CREATE POLICY "Users can create own applications"
ON backlot_project_role_applications FOR INSERT
WITH CHECK (applicant_user_id = auth.uid());

CREATE POLICY "Users can update own applications"
ON backlot_project_role_applications FOR UPDATE
USING (applicant_user_id = auth.uid());

CREATE POLICY "Project admins can manage applications"
ON backlot_project_role_applications FOR ALL
USING (
    role_id IN (
        SELECT r.id FROM backlot_project_roles r
        JOIN backlot_projects p ON p.id = r.project_id
        WHERE p.owner_id = auth.uid()
        UNION
        SELECT r.id FROM backlot_project_roles r
        JOIN backlot_project_members m ON m.project_id = r.project_id
        WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
);

-- Availability: Users manage their own
CREATE POLICY "Users can view own availability"
ON backlot_user_availability FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Project members can view booked availability"
ON backlot_user_availability FOR SELECT
USING (
    project_id IN (
        SELECT id FROM backlot_projects WHERE owner_id = auth.uid()
        UNION
        SELECT project_id FROM backlot_project_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage own availability"
ON backlot_user_availability FOR ALL
USING (user_id = auth.uid());
