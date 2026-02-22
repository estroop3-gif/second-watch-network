-- Migration 259: Final pricing raise v2
-- Free $0 / Indie $129 / Pro $299 / Business $599 / Enterprise $1,299
-- Business: 25 collab seats (down from 50)
-- Enterprise: truly unlimited everything

UPDATE organization_tiers SET
    price_cents = 12900,
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
    price_cents = 29900,
    owner_seats = 2,
    collaborative_seats = 15,
    active_projects_limit = 15,
    freelancer_seats_per_project = 10,
    view_only_seats_per_project = 15,
    active_storage_bytes = 1099511627776,       -- 1 TB
    archive_storage_bytes = 1099511627776,      -- 1 TB
    monthly_bandwidth_bytes = 3221225472000     -- 3 TB
WHERE name = 'pro';

UPDATE organization_tiers SET
    price_cents = 59900,
    owner_seats = 3,
    collaborative_seats = 25,
    active_projects_limit = 50,
    freelancer_seats_per_project = 15,
    view_only_seats_per_project = 50,
    active_storage_bytes = 5497558138880,       -- 5 TB
    archive_storage_bytes = 10995116277760,     -- 10 TB
    monthly_bandwidth_bytes = 10737418240000    -- 10 TB
WHERE name = 'business';

UPDATE organization_tiers SET
    price_cents = 129900,
    owner_seats = -1,
    collaborative_seats = -1,
    active_projects_limit = -1,
    freelancer_seats_per_project = -1,
    view_only_seats_per_project = -1,
    active_storage_bytes = -1,
    archive_storage_bytes = -1,
    monthly_bandwidth_bytes = -1
WHERE name = 'enterprise';
