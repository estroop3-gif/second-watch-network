-- Check internal checkouts with dates
SELECT 
    a.name as asset_name,
    a.status,
    gt.transaction_type,
    gt.status as transaction_status,
    DATE(gt.scheduled_at) as checkout_date,
    DATE(gt.expected_return_at) as return_date,
    gt.returned_at
FROM gear_assets a
JOIN gear_transaction_items gti ON gti.asset_id = a.id
JOIN gear_transactions gt ON gt.id = gti.transaction_id
WHERE gt.transaction_type = 'internal_checkout'
  AND gt.status IN ('pending', 'in_progress')
  AND gt.returned_at IS NULL
  AND gt.scheduled_at IS NOT NULL
  AND gt.expected_return_at IS NOT NULL
ORDER BY gt.scheduled_at DESC
LIMIT 20;
