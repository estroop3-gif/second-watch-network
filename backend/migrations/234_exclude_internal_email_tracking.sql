-- Migration 234: Exclude internal emails from CRM tracking & reports
-- Backfills source_type = 'internal' on historical internal messages
-- and corrects inflated interaction counts

-- A) Tag existing internal OUTBOUND messages (sent to another @secondwatch.network account)
UPDATE crm_email_messages m
SET source_type = 'internal'
WHERE m.direction = 'outbound'
  AND m.source_type IS NULL
  AND EXISTS (
    SELECT 1 FROM crm_email_accounts ea
    WHERE ea.email_address = ANY(m.to_addresses)
  );

-- B) Tag existing internal INBOUND messages (received from another @secondwatch.network account)
UPDATE crm_email_messages m
SET source_type = 'internal'
WHERE m.direction = 'inbound'
  AND m.source_type IS NULL
  AND EXISTS (
    SELECT 1 FROM crm_email_accounts ea
    WHERE ea.email_address = m.from_address
  );

-- C) Correct historical crm_interaction_counts.emails by subtracting internal send counts
UPDATE crm_interaction_counts ic
SET emails = GREATEST(0, ic.emails - sub.internal_count)
FROM (
    SELECT a.profile_id as rep_id,
           DATE(m.created_at) as msg_date,
           COUNT(*) as internal_count
    FROM crm_email_messages m
    JOIN crm_email_threads t ON t.id = m.thread_id
    JOIN crm_email_accounts a ON a.id = t.account_id
    WHERE m.source_type = 'internal'
      AND m.direction = 'outbound'
    GROUP BY a.profile_id, DATE(m.created_at)
) sub
WHERE ic.rep_id = sub.rep_id AND ic.count_date = sub.msg_date;
