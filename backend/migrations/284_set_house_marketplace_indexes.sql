-- Migration 284: Set House marketplace performance indexes
-- Fixes N+1 subquery replacement and search performance

-- Marketplace listings — primary lookup patterns
CREATE INDEX IF NOT EXISTS idx_shml_org_listed
    ON set_house_marketplace_listings (organization_id, is_listed);

CREATE INDEX IF NOT EXISTS idx_shml_daily_rate
    ON set_house_marketplace_listings (daily_rate)
    WHERE is_listed = TRUE;

-- Space type + org combo for type-filtered searches
CREATE INDEX IF NOT EXISTS idx_shs_org_type
    ON set_house_spaces (organization_id, space_type);

-- Marketplace settings — primary join target
CREATE INDEX IF NOT EXISTS idx_shms_enabled
    ON set_house_marketplace_settings (organization_id)
    WHERE is_marketplace_enabled = TRUE;

-- Transaction items — used in CTE subqueries for space status updates
CREATE INDEX IF NOT EXISTS idx_shti_transaction_space
    ON set_house_transaction_items (transaction_id, space_id)
    WHERE space_id IS NOT NULL;

-- Personal org lookup
CREATE INDEX IF NOT EXISTS idx_profiles_personal_set_house_org
    ON profiles (personal_set_house_org_id)
    WHERE personal_set_house_org_id IS NOT NULL;
