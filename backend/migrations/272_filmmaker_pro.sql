-- Migration 272: Filmmaker Pro subscription system
-- All tables for the $10/month Filmmaker Pro tier

-- ============================================================================
-- 1. Filmmaker Pro Subscriptions
-- ============================================================================
CREATE TABLE IF NOT EXISTS filmmaker_pro_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    status TEXT NOT NULL DEFAULT 'inactive'
        CHECK (status IN ('active','canceled','past_due','trialing','unpaid','inactive')),
    plan TEXT NOT NULL DEFAULT 'monthly' CHECK (plan IN ('monthly','annual')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    trial_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fmpro_subs_profile ON filmmaker_pro_subscriptions(profile_id);
CREATE INDEX IF NOT EXISTS idx_fmpro_subs_stripe_customer ON filmmaker_pro_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_fmpro_subs_status ON filmmaker_pro_subscriptions(status);

-- Add is_filmmaker_pro flag to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_filmmaker_pro BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- 2. Profile Analytics
-- ============================================================================
CREATE TABLE IF NOT EXISTS profile_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    viewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    viewer_ip_hash TEXT,
    source TEXT DEFAULT 'direct'
        CHECK (source IN ('direct','directory','collab','search','portfolio','external')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_views_profile ON profile_views(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_created ON profile_views(created_at);
CREATE INDEX IF NOT EXISTS idx_profile_views_profile_date ON profile_views(profile_id, created_at);

CREATE TABLE IF NOT EXISTS profile_search_appearances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    search_context TEXT NOT NULL
        CHECK (search_context IN ('directory','collab_board','project_search','gear_marketplace')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_search_profile ON profile_search_appearances(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_search_created ON profile_search_appearances(created_at);

CREATE TABLE IF NOT EXISTS profile_analytics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    views_count INTEGER DEFAULT 0,
    unique_viewers INTEGER DEFAULT 0,
    search_appearances INTEGER DEFAULT 0,
    collab_impressions INTEGER DEFAULT 0,
    UNIQUE(profile_id, date)
);

CREATE INDEX IF NOT EXISTS idx_profile_analytics_daily_profile ON profile_analytics_daily(profile_id, date);

-- ============================================================================
-- 3. Rate Cards
-- ============================================================================
CREATE TABLE IF NOT EXISTS filmmaker_rate_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role_name TEXT NOT NULL,
    day_rate_cents INTEGER,
    half_day_rate_cents INTEGER,
    weekly_rate_cents INTEGER,
    hourly_rate_cents INTEGER,
    currency TEXT DEFAULT 'USD',
    notes TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_cards_profile ON filmmaker_rate_cards(profile_id);

-- ============================================================================
-- 4. Standalone Invoices
-- ============================================================================
CREATE TABLE IF NOT EXISTS filmmaker_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    recipient_name TEXT NOT NULL,
    recipient_email TEXT,
    recipient_company TEXT,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','sent','viewed','paid','overdue','canceled')),
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    subtotal_cents INTEGER DEFAULT 0,
    tax_rate_percent NUMERIC(5,2) DEFAULT 0,
    tax_cents INTEGER DEFAULT 0,
    total_cents INTEGER DEFAULT 0,
    paid_at TIMESTAMPTZ,
    payment_method TEXT,
    payment_notes TEXT,
    project_name TEXT,
    notes TEXT,
    view_token TEXT UNIQUE DEFAULT encode(gen_random_uuid()::bytea, 'hex'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fm_invoices_sender ON filmmaker_invoices(sender_id);
CREATE INDEX IF NOT EXISTS idx_fm_invoices_status ON filmmaker_invoices(status);
CREATE INDEX IF NOT EXISTS idx_fm_invoices_view_token ON filmmaker_invoices(view_token);

CREATE TABLE IF NOT EXISTS filmmaker_invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES filmmaker_invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(10,2) DEFAULT 1,
    rate_type TEXT DEFAULT 'flat' CHECK (rate_type IN ('hourly','daily','weekly','flat')),
    unit_price_cents INTEGER NOT NULL,
    total_cents INTEGER NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fm_invoice_items_invoice ON filmmaker_invoice_line_items(invoice_id);

-- ============================================================================
-- 5. Advanced Availability Enhancements
-- ============================================================================
ALTER TABLE availability ADD COLUMN IF NOT EXISTS rate_cents INTEGER;
ALTER TABLE availability ADD COLUMN IF NOT EXISTS rate_type TEXT CHECK (rate_type IN ('day','half_day','weekly','hourly'));
ALTER TABLE availability ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE availability ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE availability ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS filmmaker_calendar_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    share_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_uuid()::bytea, 'hex'),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cal_shares_token ON filmmaker_calendar_shares(share_token);

-- ============================================================================
-- 6. Portfolio Site Generator
-- ============================================================================
CREATE TABLE IF NOT EXISTS filmmaker_portfolio_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    slug TEXT UNIQUE,
    is_published BOOLEAN DEFAULT FALSE,
    theme TEXT DEFAULT 'dark' CHECK (theme IN ('dark','light','minimal','cinematic')),
    accent_color TEXT DEFAULT '#FF3C3C',
    show_reel BOOLEAN DEFAULT TRUE,
    show_credits BOOLEAN DEFAULT TRUE,
    show_availability BOOLEAN DEFAULT TRUE,
    show_rate_card BOOLEAN DEFAULT TRUE,
    show_contact_form BOOLEAN DEFAULT TRUE,
    custom_headline TEXT,
    custom_intro TEXT,
    hero_image_url TEXT,
    seo_title TEXT,
    seo_description TEXT,
    custom_sections JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_slug ON filmmaker_portfolio_configs(slug);
CREATE INDEX IF NOT EXISTS idx_portfolio_profile ON filmmaker_portfolio_configs(profile_id);
