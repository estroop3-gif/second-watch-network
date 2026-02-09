-- Migration 215: CRM Customer Log & Rep Reviews
-- Post-sale relationship tracking and performance reviews

-- ============================================================================
-- Table: crm_customer_log
-- Track complaints, inquiries, support tickets, and general notes
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_customer_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
    rep_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,

    -- Log details
    log_type TEXT NOT NULL DEFAULT 'general'
        CHECK (log_type IN (
            'complaint', 'inquiry', 'support_ticket', 'feedback',
            'suggestion', 'escalation', 'general'
        )),
    subject TEXT NOT NULL,
    description TEXT,

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority TEXT NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

    -- Resolution
    resolution TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_customer_log_contact ON crm_customer_log(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_customer_log_rep ON crm_customer_log(rep_id);
CREATE INDEX IF NOT EXISTS idx_crm_customer_log_status ON crm_customer_log(status);
CREATE INDEX IF NOT EXISTS idx_crm_customer_log_priority ON crm_customer_log(priority);
CREATE INDEX IF NOT EXISTS idx_crm_customer_log_created ON crm_customer_log(created_at DESC);

-- ============================================================================
-- Table: crm_rep_reviews
-- Customer-facing reviews and admin notes about rep performance
-- ============================================================================
CREATE TABLE IF NOT EXISTS crm_rep_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rep_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Review type
    review_type TEXT NOT NULL DEFAULT 'admin_note'
        CHECK (review_type IN ('customer_review', 'admin_note')),

    -- Optional link to contact (for customer reviews)
    contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
    reviewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

    -- Review content
    rating INTEGER NOT NULL DEFAULT 5
        CHECK (rating >= 1 AND rating <= 5),
    title TEXT,
    body TEXT,

    -- Visibility
    is_visible_to_rep BOOLEAN DEFAULT TRUE,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_rep_reviews_rep ON crm_rep_reviews(rep_id);
CREATE INDEX IF NOT EXISTS idx_crm_rep_reviews_type ON crm_rep_reviews(review_type);
CREATE INDEX IF NOT EXISTS idx_crm_rep_reviews_created ON crm_rep_reviews(created_at DESC);
