-- Fix discovery profile defaults: max_results_per_query 2000 → 30
-- 30 results = 3 pages of 10 (3 API calls per keyword×location combo)
-- With 7 keywords × 4 locations = 84 queries, safely within Google free tier (100/day)
UPDATE crm_discovery_profiles
SET max_results_per_query = 30
WHERE max_results_per_query >= 100;
