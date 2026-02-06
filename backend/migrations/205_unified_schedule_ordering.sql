-- 205_unified_schedule_ordering.sql
-- Add unified schedule position for reordering scenes and schedule blocks together

-- Add unified schedule position to scene logs
ALTER TABLE backlot_hot_set_scene_logs
ADD COLUMN IF NOT EXISTS schedule_position INTEGER;

-- Add unified schedule position to schedule blocks
ALTER TABLE backlot_hot_set_schedule_blocks
ADD COLUMN IF NOT EXISTS schedule_position INTEGER;

-- Indexes for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_scene_logs_schedule_pos
ON backlot_hot_set_scene_logs(session_id, schedule_position);

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_schedule_pos
ON backlot_hot_set_schedule_blocks(session_id, schedule_position);

-- Backfill existing data: assign schedule_position based on expected_start_time and sort_order
-- Space by 10 to allow for future insertions without reordering

-- Backfill scene logs
UPDATE backlot_hot_set_scene_logs s
SET schedule_position = sub.pos
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY session_id
      ORDER BY expected_start_time NULLS LAST, sort_order NULLS LAST, created_at
    ) * 10 as pos
  FROM backlot_hot_set_scene_logs
) sub
WHERE s.id = sub.id AND s.schedule_position IS NULL;

-- Backfill schedule blocks
UPDATE backlot_hot_set_schedule_blocks b
SET schedule_position = sub.pos
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY session_id
      ORDER BY expected_start_time NULLS LAST, sort_order NULLS LAST, created_at
    ) * 10 as pos
  FROM backlot_hot_set_schedule_blocks
) sub
WHERE b.id = sub.id AND b.schedule_position IS NULL;
