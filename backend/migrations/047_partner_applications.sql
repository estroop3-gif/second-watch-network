-- Migration 047: Partner Applications Table
-- Creates table for tracking partner/brand application requests
-- Run against AWS RDS PostgreSQL database

CREATE TABLE IF NOT EXISTS partner_applications (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    brand_name TEXT,
    contact_name TEXT,
    contact_email TEXT,
    full_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraint for valid statuses
    CONSTRAINT partner_applications_status_check
        CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_partner_applications_user_id ON partner_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_applications_status ON partner_applications(status);
CREATE INDEX IF NOT EXISTS idx_partner_applications_created_at ON partner_applications(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE partner_applications IS 'Applications from users wanting to become partners/brands';
COMMENT ON COLUMN partner_applications.company_name IS 'Legal company name';
COMMENT ON COLUMN partner_applications.brand_name IS 'Brand/display name if different from company';
COMMENT ON COLUMN partner_applications.status IS 'Application status: pending, approved, rejected';
