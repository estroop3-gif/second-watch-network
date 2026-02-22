-- Migration 258: Market-aligned pricing raise
-- Raises tier prices ~2x to align with competitor reality
-- Free $0 / Indie $69 / Pro $149 / Business $349 / Enterprise $799

-- Update tier prices and resource allocations
UPDATE organization_tiers SET
    price_cents = 0,
    owner_seats = 1,
    collaborative_seats = 0,
    active_projects = 1,
    non_collaborative_per_project = 0,
    view_only_per_project = 2,
    active_storage_gb = 5,
    archive_storage_gb = 0,
    bandwidth_gb = 10
WHERE tier_name = 'free';

UPDATE organization_tiers SET
    price_cents = 6900,
    owner_seats = 1,
    collaborative_seats = 5,
    active_projects = 5,
    non_collaborative_per_project = 5,
    view_only_per_project = 10,
    active_storage_gb = 150,
    archive_storage_gb = 100,
    bandwidth_gb = 500
WHERE tier_name = 'indie';

UPDATE organization_tiers SET
    price_cents = 14900,
    owner_seats = 2,
    collaborative_seats = 15,
    active_projects = 15,
    non_collaborative_per_project = 10,
    view_only_per_project = 15,
    active_storage_gb = 1024,
    archive_storage_gb = 1024,
    bandwidth_gb = 3000
WHERE tier_name = 'pro';

UPDATE organization_tiers SET
    price_cents = 34900,
    owner_seats = 3,
    collaborative_seats = 50,
    active_projects = 50,
    non_collaborative_per_project = 15,
    view_only_per_project = 50,
    active_storage_gb = 5120,
    archive_storage_gb = 10240,
    bandwidth_gb = 10000
WHERE tier_name = 'business';

UPDATE organization_tiers SET
    price_cents = 79900,
    owner_seats = 10,
    collaborative_seats = -1,
    active_projects = -1,
    non_collaborative_per_project = 30,
    view_only_per_project = -1,
    active_storage_gb = 25600,
    archive_storage_gb = 51200,
    bandwidth_gb = 50000
WHERE tier_name = 'enterprise';
