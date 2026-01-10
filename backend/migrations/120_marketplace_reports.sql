-- Gear Marketplace Reports
-- For reporting problematic/fraudulent listings

CREATE TABLE IF NOT EXISTS gear_marketplace_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES gear_marketplace_listings(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES profiles(id),
    reason TEXT NOT NULL CHECK (reason IN ('spam', 'fraud', 'prohibited_item', 'misleading', 'other')),
    details TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    action_taken TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for finding pending reports
CREATE INDEX IF NOT EXISTS idx_marketplace_reports_status ON gear_marketplace_reports(status);

-- Index for finding reports by listing
CREATE INDEX IF NOT EXISTS idx_marketplace_reports_listing ON gear_marketplace_reports(listing_id);

-- Index for finding reports by reporter (to detect abuse)
CREATE INDEX IF NOT EXISTS idx_marketplace_reports_reporter ON gear_marketplace_reports(reporter_id);

-- Prevent duplicate reports from same user on same listing
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_reports_unique_reporter_listing
    ON gear_marketplace_reports(listing_id, reporter_id)
    WHERE status = 'pending';

-- Add visible_fields column to listings table for controlling what asset details are shown
ALTER TABLE gear_marketplace_listings
    ADD COLUMN IF NOT EXISTS visible_fields JSONB DEFAULT '{"description": true, "notes": false}'::jsonb;

COMMENT ON TABLE gear_marketplace_reports IS 'Reports of problematic marketplace listings for admin review';
COMMENT ON COLUMN gear_marketplace_reports.reason IS 'Reason for report: spam, fraud, prohibited_item, misleading, other';
COMMENT ON COLUMN gear_marketplace_reports.status IS 'pending=awaiting review, reviewed=seen, actioned=action taken, dismissed=invalid report';
COMMENT ON COLUMN gear_marketplace_listings.visible_fields IS 'JSON controlling which asset fields are publicly visible on the listing';
