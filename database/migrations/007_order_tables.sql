-- ============================================================
-- Second Watch Order Tables Migration
-- The Order is a professional, God-centered guild for filmmakers
-- ============================================================

-- ============ Lodges Table ============
-- City-based chapters of The Order

CREATE TABLE IF NOT EXISTS order_lodges (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    city VARCHAR(100) NOT NULL,
    region VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'forming' CHECK (status IN ('forming', 'active', 'inactive')),
    description TEXT,
    base_lodge_dues_cents INTEGER NOT NULL DEFAULT 2500,
    contact_email VARCHAR(255),
    contact_user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for lodges
CREATE INDEX IF NOT EXISTS idx_order_lodges_slug ON order_lodges(slug);
CREATE INDEX IF NOT EXISTS idx_order_lodges_city ON order_lodges(city);
CREATE INDEX IF NOT EXISTS idx_order_lodges_status ON order_lodges(status);


-- ============ Order Member Profiles Table ============
-- Professional details for Order members

CREATE TABLE IF NOT EXISTS order_member_profiles (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Professional info
    primary_track VARCHAR(50) NOT NULL CHECK (primary_track IN (
        'camera', 'post', 'audio', 'lighting', 'production', 'directing',
        'writing', 'church_media', 'vfx', 'motion_graphics', 'colorist',
        'producer', 'other'
    )),
    secondary_tracks TEXT, -- JSON array as string

    -- Location
    city VARCHAR(100),
    region VARCHAR(100),

    -- Portfolio links
    portfolio_url TEXT,
    imdb_url TEXT,
    youtube_url TEXT,
    vimeo_url TEXT,
    website_url TEXT,

    -- Professional details
    gear_summary TEXT,
    bio TEXT,
    years_experience INTEGER CHECK (years_experience >= 0 AND years_experience <= 50),
    availability_status VARCHAR(50) DEFAULT 'available',

    -- Lodge affiliation
    lodge_id INTEGER REFERENCES order_lodges(id) ON DELETE SET NULL,

    -- Membership status
    status VARCHAR(20) NOT NULL DEFAULT 'probationary' CHECK (status IN (
        'probationary', 'active', 'suspended', 'expelled'
    )),
    joined_at TIMESTAMPTZ,
    probation_ends_at TIMESTAMPTZ,

    -- Stripe subscription tracking
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    dues_status VARCHAR(50) DEFAULT 'pending',

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for member profiles
CREATE INDEX IF NOT EXISTS idx_order_profiles_user_id ON order_member_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_order_profiles_primary_track ON order_member_profiles(primary_track);
CREATE INDEX IF NOT EXISTS idx_order_profiles_city ON order_member_profiles(city);
CREATE INDEX IF NOT EXISTS idx_order_profiles_lodge_id ON order_member_profiles(lodge_id);
CREATE INDEX IF NOT EXISTS idx_order_profiles_status ON order_member_profiles(status);
CREATE INDEX IF NOT EXISTS idx_order_profiles_availability ON order_member_profiles(availability_status);


-- ============ Order Applications Table ============
-- Applications to join The Order

CREATE TABLE IF NOT EXISTS order_applications (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Application details
    primary_track VARCHAR(50) NOT NULL,
    city VARCHAR(100),
    region VARCHAR(100),
    portfolio_links TEXT, -- JSON array as string
    statement TEXT,
    years_experience INTEGER,
    applicant_current_role VARCHAR(200),

    -- Application status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by_id UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for applications
CREATE INDEX IF NOT EXISTS idx_order_applications_user_id ON order_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_order_applications_status ON order_applications(status);
CREATE INDEX IF NOT EXISTS idx_order_applications_created_at ON order_applications(created_at DESC);


-- ============ Lodge Memberships Table ============
-- Tracks user memberships in lodges

CREATE TABLE IF NOT EXISTS order_lodge_memberships (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lodge_id INTEGER NOT NULL REFERENCES order_lodges(id) ON DELETE CASCADE,

    -- Membership details
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'former')),
    is_officer BOOLEAN NOT NULL DEFAULT FALSE,
    officer_title VARCHAR(100),

    -- Dates
    joined_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,

    -- Stripe subscription for lodge dues
    stripe_subscription_id VARCHAR(255),
    dues_status VARCHAR(50) DEFAULT 'pending',

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One membership per user per lodge
    UNIQUE(user_id, lodge_id)
);

-- Indexes for lodge memberships
CREATE INDEX IF NOT EXISTS idx_lodge_memberships_user_id ON order_lodge_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_lodge_memberships_lodge_id ON order_lodge_memberships(lodge_id);
CREATE INDEX IF NOT EXISTS idx_lodge_memberships_status ON order_lodge_memberships(status);


-- ============ Order Jobs Table ============
-- Job/gig postings for Order members

CREATE TABLE IF NOT EXISTS order_jobs (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,

    -- Job details
    location VARCHAR(200),
    job_type VARCHAR(20) NOT NULL DEFAULT 'other' CHECK (job_type IN (
        'shoot', 'edit', 'remote', 'hybrid', 'other'
    )),
    roles_needed TEXT, -- JSON array of track values
    pay_info TEXT,
    is_paid BOOLEAN NOT NULL DEFAULT TRUE,

    -- Visibility
    visibility VARCHAR(20) NOT NULL DEFAULT 'order_only' CHECK (visibility IN (
        'order_only', 'order_priority', 'public'
    )),

    -- Associations
    created_by_id UUID NOT NULL REFERENCES auth.users(id),
    lodge_id INTEGER REFERENCES order_lodges(id) ON DELETE SET NULL,
    organization_name VARCHAR(200),

    -- Status and dates
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    application_deadline TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for jobs
CREATE INDEX IF NOT EXISTS idx_order_jobs_created_by ON order_jobs(created_by_id);
CREATE INDEX IF NOT EXISTS idx_order_jobs_lodge_id ON order_jobs(lodge_id);
CREATE INDEX IF NOT EXISTS idx_order_jobs_job_type ON order_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_order_jobs_visibility ON order_jobs(visibility);
CREATE INDEX IF NOT EXISTS idx_order_jobs_is_active ON order_jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_order_jobs_created_at ON order_jobs(created_at DESC);


-- ============ Order Job Applications Table ============
-- Applications from Order members to jobs

CREATE TABLE IF NOT EXISTS order_job_applications (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES order_jobs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Application details
    cover_note TEXT,
    portfolio_url TEXT,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'submitted' CHECK (status IN (
        'submitted', 'reviewed', 'accepted', 'rejected'
    )),
    reviewed_by_id UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    feedback TEXT,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One application per user per job
    UNIQUE(user_id, job_id)
);

-- Indexes for job applications
CREATE INDEX IF NOT EXISTS idx_job_applications_job_id ON order_job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_user_id ON order_job_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON order_job_applications(status);


-- ============ Order Booking Requests Table ============
-- External booking requests for Order members

CREATE TABLE IF NOT EXISTS order_booking_requests (
    id SERIAL PRIMARY KEY,
    target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Requester info (may not be a platform user)
    requester_user_id UUID REFERENCES auth.users(id),
    requester_name VARCHAR(200) NOT NULL,
    requester_email VARCHAR(255) NOT NULL,
    requester_phone VARCHAR(50),
    requester_org VARCHAR(200),

    -- Request details
    project_title VARCHAR(200),
    details TEXT NOT NULL,
    location VARCHAR(200),
    dates VARCHAR(200),
    budget_range VARCHAR(100),
    roles_needed TEXT, -- JSON array

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    response_notes TEXT,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for booking requests
CREATE INDEX IF NOT EXISTS idx_booking_requests_target ON order_booking_requests(target_user_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_status ON order_booking_requests(status);
CREATE INDEX IF NOT EXISTS idx_booking_requests_created_at ON order_booking_requests(created_at DESC);


-- ============ Triggers for updated_at ============

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_order_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for each table
DROP TRIGGER IF EXISTS order_lodges_updated_at ON order_lodges;
CREATE TRIGGER order_lodges_updated_at
    BEFORE UPDATE ON order_lodges
    FOR EACH ROW EXECUTE FUNCTION update_order_updated_at();

DROP TRIGGER IF EXISTS order_member_profiles_updated_at ON order_member_profiles;
CREATE TRIGGER order_member_profiles_updated_at
    BEFORE UPDATE ON order_member_profiles
    FOR EACH ROW EXECUTE FUNCTION update_order_updated_at();

DROP TRIGGER IF EXISTS order_applications_updated_at ON order_applications;
CREATE TRIGGER order_applications_updated_at
    BEFORE UPDATE ON order_applications
    FOR EACH ROW EXECUTE FUNCTION update_order_updated_at();

DROP TRIGGER IF EXISTS order_lodge_memberships_updated_at ON order_lodge_memberships;
CREATE TRIGGER order_lodge_memberships_updated_at
    BEFORE UPDATE ON order_lodge_memberships
    FOR EACH ROW EXECUTE FUNCTION update_order_updated_at();

DROP TRIGGER IF EXISTS order_jobs_updated_at ON order_jobs;
CREATE TRIGGER order_jobs_updated_at
    BEFORE UPDATE ON order_jobs
    FOR EACH ROW EXECUTE FUNCTION update_order_updated_at();

DROP TRIGGER IF EXISTS order_job_applications_updated_at ON order_job_applications;
CREATE TRIGGER order_job_applications_updated_at
    BEFORE UPDATE ON order_job_applications
    FOR EACH ROW EXECUTE FUNCTION update_order_updated_at();

DROP TRIGGER IF EXISTS order_booking_requests_updated_at ON order_booking_requests;
CREATE TRIGGER order_booking_requests_updated_at
    BEFORE UPDATE ON order_booking_requests
    FOR EACH ROW EXECUTE FUNCTION update_order_updated_at();


-- ============ Row Level Security Policies ============

-- Enable RLS on all tables
ALTER TABLE order_lodges ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_member_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_lodge_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_booking_requests ENABLE ROW LEVEL SECURITY;

-- ============ Lodge Policies ============

-- Public can view forming/active lodges
CREATE POLICY "Lodges are viewable by everyone"
    ON order_lodges FOR SELECT
    USING (status IN ('forming', 'active'));

-- Admins can manage lodges
CREATE POLICY "Admins can manage lodges"
    ON order_lodges FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin' OR profiles.is_moderator = true)
        )
    );

-- ============ Member Profile Policies ============

-- Order members can view other Order member profiles (active/probationary only)
CREATE POLICY "Order members can view profiles"
    ON order_member_profiles FOR SELECT
    USING (
        status IN ('active', 'probationary')
        AND EXISTS (
            SELECT 1 FROM order_member_profiles omp
            WHERE omp.user_id = auth.uid()
            AND omp.status IN ('active', 'probationary')
        )
    );

-- Users can view and update their own profile
CREATE POLICY "Users can manage own profile"
    ON order_member_profiles FOR ALL
    USING (user_id = auth.uid());

-- Admins can manage all profiles
CREATE POLICY "Admins can manage all profiles"
    ON order_member_profiles FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- ============ Application Policies ============

-- Users can view and create their own applications
CREATE POLICY "Users can manage own applications"
    ON order_applications FOR ALL
    USING (user_id = auth.uid());

-- Admins can view and manage all applications
CREATE POLICY "Admins can manage applications"
    ON order_applications FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin' OR profiles.is_moderator = true)
        )
    );

-- ============ Lodge Membership Policies ============

-- Users can view their own lodge memberships
CREATE POLICY "Users can view own memberships"
    ON order_lodge_memberships FOR SELECT
    USING (user_id = auth.uid());

-- Order members can view active lodge memberships
CREATE POLICY "Order members can view lodge members"
    ON order_lodge_memberships FOR SELECT
    USING (
        status = 'active'
        AND EXISTS (
            SELECT 1 FROM order_member_profiles omp
            WHERE omp.user_id = auth.uid()
            AND omp.status IN ('active', 'probationary')
        )
    );

-- Users can join lodges (insert)
CREATE POLICY "Users can join lodges"
    ON order_lodge_memberships FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM order_member_profiles omp
            WHERE omp.user_id = auth.uid()
            AND omp.status IN ('active', 'probationary')
        )
    );

-- ============ Job Policies ============

-- Public jobs are viewable by everyone
CREATE POLICY "Public jobs are viewable"
    ON order_jobs FOR SELECT
    USING (visibility = 'public' AND is_active = true);

-- Order members can view all jobs
CREATE POLICY "Order members can view all jobs"
    ON order_jobs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM order_member_profiles omp
            WHERE omp.user_id = auth.uid()
            AND omp.status IN ('active', 'probationary')
        )
    );

-- Admins and partners can create/manage jobs
CREATE POLICY "Admins and partners can manage jobs"
    ON order_jobs FOR ALL
    USING (
        created_by_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role IN ('admin', 'partner') OR profiles.is_moderator = true)
        )
    );

-- ============ Job Application Policies ============

-- Users can view their own applications
CREATE POLICY "Users can view own job applications"
    ON order_job_applications FOR SELECT
    USING (user_id = auth.uid());

-- Order members can apply to jobs
CREATE POLICY "Order members can apply to jobs"
    ON order_job_applications FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM order_member_profiles omp
            WHERE omp.user_id = auth.uid()
            AND omp.status IN ('active', 'probationary')
        )
    );

-- Job creators can view applications
CREATE POLICY "Job creators can view applications"
    ON order_job_applications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM order_jobs oj
            WHERE oj.id = job_id
            AND oj.created_by_id = auth.uid()
        )
    );

-- Admins can manage all applications
CREATE POLICY "Admins can manage job applications"
    ON order_job_applications FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- ============ Booking Request Policies ============

-- Anyone can create booking requests
CREATE POLICY "Anyone can create booking requests"
    ON order_booking_requests FOR INSERT
    WITH CHECK (true);

-- Target users can view their booking requests
CREATE POLICY "Target users can view requests"
    ON order_booking_requests FOR SELECT
    USING (target_user_id = auth.uid());

-- Target users can update their booking requests
CREATE POLICY "Target users can update requests"
    ON order_booking_requests FOR UPDATE
    USING (target_user_id = auth.uid());

-- Admins can view all booking requests
CREATE POLICY "Admins can view all requests"
    ON order_booking_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );


-- ============ Success Message ============
DO $$
BEGIN
    RAISE NOTICE 'Order tables migration completed successfully!';
    RAISE NOTICE 'Tables created: order_lodges, order_member_profiles, order_applications, order_lodge_memberships, order_jobs, order_job_applications, order_booking_requests';
END $$;
