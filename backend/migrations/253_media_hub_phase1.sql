-- Migration 253: Media/Marketing Hub - Phase 1
-- Content request pipeline, content calendar, platform management

-- 1a. Role flag on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_media_team BOOLEAN DEFAULT FALSE;

-- 1b. media_platforms — configurable social platform list
CREATE TABLE IF NOT EXISTS media_platforms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT,
    color TEXT,
    url_pattern TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default platforms
INSERT INTO media_platforms (name, slug, icon, color, url_pattern, sort_order) VALUES
    ('Instagram', 'instagram', 'Instagram', '#E4405F', 'https://instagram.com/{handle}', 1),
    ('TikTok', 'tiktok', 'Music', '#000000', 'https://tiktok.com/@{handle}', 2),
    ('YouTube', 'youtube', 'Youtube', '#FF0000', 'https://youtube.com/@{handle}', 3),
    ('X / Twitter', 'x-twitter', 'Twitter', '#1DA1F2', 'https://x.com/{handle}', 4),
    ('Facebook', 'facebook', 'Facebook', '#1877F2', 'https://facebook.com/{handle}', 5)
ON CONFLICT (slug) DO NOTHING;

-- 1c. media_content_requests — the core request table
CREATE TABLE IF NOT EXISTS media_content_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    content_type TEXT NOT NULL CHECK (content_type IN (
        'social_media_video', 'marketing_video', 'graphic',
        'social_post', 'blog_post', 'photo_shoot', 'animation', 'other'
    )),
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
        'submitted', 'in_review', 'approved', 'in_production',
        'ready_for_review', 'revision', 'approved_final',
        'scheduled', 'posted', 'cancelled'
    )),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN (
        'low', 'normal', 'high', 'urgent'
    )),
    due_date DATE,
    scheduled_date TIMESTAMPTZ,
    posted_at TIMESTAMPTZ,
    requested_by UUID NOT NULL REFERENCES profiles(id),
    assigned_to UUID REFERENCES profiles(id),
    assigned_at TIMESTAMPTZ,
    reference_links JSONB DEFAULT '[]',
    internal_notes TEXT,
    revision_notes TEXT,
    attachments JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_requests_requested_by ON media_content_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_media_requests_assigned_to ON media_content_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_media_requests_status ON media_content_requests(status);
CREATE INDEX IF NOT EXISTS idx_media_requests_due_date ON media_content_requests(due_date);
CREATE INDEX IF NOT EXISTS idx_media_requests_scheduled_date ON media_content_requests(scheduled_date);

-- 1d. media_request_platforms — junction table (request ↔ platforms)
CREATE TABLE IF NOT EXISTS media_request_platforms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES media_content_requests(id) ON DELETE CASCADE,
    platform_id UUID NOT NULL REFERENCES media_platforms(id) ON DELETE CASCADE,
    platform_url TEXT,
    UNIQUE(request_id, platform_id)
);

CREATE INDEX IF NOT EXISTS idx_media_req_platforms_request ON media_request_platforms(request_id);
CREATE INDEX IF NOT EXISTS idx_media_req_platforms_platform ON media_request_platforms(platform_id);

-- 1e. media_request_status_history — audit trail
CREATE TABLE IF NOT EXISTS media_request_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES media_content_requests(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_status_history_request ON media_request_status_history(request_id);

-- 1f. media_request_comments — threaded comments
CREATE TABLE IF NOT EXISTS media_request_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES media_content_requests(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_comments_request ON media_request_comments(request_id);

-- 1g. media_calendar_entries — standalone calendar items
CREATE TABLE IF NOT EXISTS media_calendar_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    content_type TEXT CHECK (content_type IN (
        'social_media_video', 'marketing_video', 'graphic',
        'social_post', 'blog_post', 'photo_shoot', 'animation', 'other'
    )),
    scheduled_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    request_id UUID REFERENCES media_content_requests(id) ON DELETE SET NULL,
    platform_id UUID REFERENCES media_platforms(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'scheduled' CHECK (status IN (
        'draft', 'scheduled', 'posted', 'cancelled'
    )),
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    color TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_calendar_scheduled ON media_calendar_entries(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_media_calendar_request ON media_calendar_entries(request_id);
CREATE INDEX IF NOT EXISTS idx_media_calendar_platform ON media_calendar_entries(platform_id);
