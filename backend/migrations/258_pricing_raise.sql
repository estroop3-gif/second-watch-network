-- Migration 258: Market-aligned pricing raise
-- Raises tier prices ~2x to align with competitor reality
-- Free $0 / Indie $69 / Pro $149 / Business $349 / Enterprise $799

-- Update tier prices and resource allocations
-- Storage/bandwidth in bytes; seats and projects use existing column names

UPDATE organization_tiers SET
    price_cents = 0,
    owner_seats = 1,
    collaborative_seats = 0,
    active_projects_limit = 1,
    freelancer_seats_per_project = 0,
    view_only_seats_per_project = 2,
    active_storage_bytes = 5368709120,          -- 5 GB
    archive_storage_bytes = 0,                  -- 0 GB
    monthly_bandwidth_bytes = 10737418240       -- 10 GB
WHERE name = 'free';

UPDATE organization_tiers SET
    price_cents = 6900,
    owner_seats = 1,
    collaborative_seats = 5,
    active_projects_limit = 5,
    freelancer_seats_per_project = 5,
    view_only_seats_per_project = 10,
    active_storage_bytes = 161061273600,        -- 150 GB
    archive_storage_bytes = 107374182400,       -- 100 GB
    monthly_bandwidth_bytes = 536870912000      -- 500 GB
WHERE name = 'indie';

UPDATE organization_tiers SET
    price_cents = 14900,
    owner_seats = 2,
    collaborative_seats = 15,
    active_projects_limit = 15,
    freelancer_seats_per_project = 10,
    view_only_seats_per_project = 15,
    active_storage_bytes = 1099511627776,       -- 1 TB (1024 GB)
    archive_storage_bytes = 1099511627776,      -- 1 TB (1024 GB)
    monthly_bandwidth_bytes = 3221225472000     -- 3 TB (3000 GB)
WHERE name = 'pro';

UPDATE organization_tiers SET
    price_cents = 34900,
    owner_seats = 3,
    collaborative_seats = 50,
    active_projects_limit = 50,
    freelancer_seats_per_project = 15,
    view_only_seats_per_project = 50,
    active_storage_bytes = 5497558138880,       -- 5 TB (5120 GB)
    archive_storage_bytes = 10995116277760,     -- 10 TB (10240 GB)
    monthly_bandwidth_bytes = 10737418240000    -- 10 TB (10000 GB)
WHERE name = 'business';

UPDATE organization_tiers SET
    price_cents = 79900,
    owner_seats = 10,
    collaborative_seats = -1,
    active_projects_limit = -1,
    freelancer_seats_per_project = 30,
    view_only_seats_per_project = -1,
    active_storage_bytes = 27487790694400,      -- 25 TB (25600 GB)
    archive_storage_bytes = 54975581388800,     -- 50 TB (51200 GB)
    monthly_bandwidth_bytes = 53687091200000    -- 50 TB (50000 GB)
WHERE name = 'enterprise';
