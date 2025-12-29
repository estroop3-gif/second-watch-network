-- Migration 045: Admin Audit Log and Content Moderation Tables
-- Created: 2024-12-28

-- =====================================================
-- ADMIN AUDIT LOG
-- Tracks all admin actions for security and compliance
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT,  -- 'user', 'submission', 'application', 'thread', etc.
    target_id UUID,
    details JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);

-- =====================================================
-- CONTENT REPORTS
-- User-submitted reports for content moderation
-- =====================================================

CREATE TABLE IF NOT EXISTS content_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    content_type TEXT NOT NULL,  -- 'message', 'thread', 'reply', 'submission', 'profile'
    content_id UUID NOT NULL,
    reason TEXT NOT NULL,  -- 'spam', 'harassment', 'inappropriate', 'copyright', 'other'
    details TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
    reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for content reports
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports(status);
CREATE INDEX IF NOT EXISTS idx_content_reports_content ON content_reports(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_reporter ON content_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_created_at ON content_reports(created_at DESC);

-- =====================================================
-- PLATFORM BROADCASTS
-- Admin announcements to all users
-- =====================================================

CREATE TABLE IF NOT EXISTS platform_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    broadcast_type TEXT DEFAULT 'info' CHECK (broadcast_type IN ('info', 'warning', 'urgent', 'maintenance')),
    target_audience TEXT DEFAULT 'all' CHECK (target_audience IN ('all', 'filmmakers', 'partners', 'order_members', 'premium')),
    is_active BOOLEAN DEFAULT true,
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_broadcasts_active ON platform_broadcasts(is_active, starts_at, expires_at);

-- =====================================================
-- FLAGGED CONTENT (Auto-moderation)
-- System-flagged content based on rules
-- =====================================================

CREATE TABLE IF NOT EXISTS flagged_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type TEXT NOT NULL,
    content_id UUID NOT NULL,
    flag_reason TEXT NOT NULL,  -- 'keyword', 'spam_pattern', 'rate_limit', 'new_user'
    flag_details JSONB DEFAULT '{}',
    severity TEXT DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'removed', 'false_positive')),
    reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flagged_content_status ON flagged_content(status);
CREATE INDEX IF NOT EXISTS idx_flagged_content_severity ON flagged_content(severity, status);
CREATE INDEX IF NOT EXISTS idx_flagged_content_created_at ON flagged_content(created_at DESC);

-- =====================================================
-- DONATION TRACKING (for admin visibility)
-- Tracks donations from Donorbox or other sources
-- =====================================================

CREATE TABLE IF NOT EXISTS donation_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_email TEXT,
    donor_name TEXT,
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    donation_type TEXT DEFAULT 'one_time' CHECK (donation_type IN ('one_time', 'recurring')),
    campaign TEXT,
    external_id TEXT,  -- ID from Donorbox or other platform
    source TEXT DEFAULT 'donorbox',
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
    donated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_donation_records_donated_at ON donation_records(donated_at DESC);
CREATE INDEX IF NOT EXISTS idx_donation_records_donor_email ON donation_records(donor_email);
CREATE INDEX IF NOT EXISTS idx_donation_records_campaign ON donation_records(campaign);
