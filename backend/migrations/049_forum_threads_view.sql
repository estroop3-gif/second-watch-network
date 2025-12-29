-- Migration 049: Create forum_threads_with_details view
-- This view provides enriched thread data with author info and category details

-- Drop if exists to allow re-running
DROP VIEW IF EXISTS forum_threads_with_details;

-- Create the view joining threads with profiles and categories
CREATE VIEW forum_threads_with_details AS
SELECT
    ft.id,
    ft.title,
    ft.content,
    ft.category_id,
    ft.author_id,
    ft.is_anonymous,
    ft.is_pinned,
    ft.reply_count,
    ft.created_at,
    ft.updated_at,
    -- Author info (respect anonymous flag)
    CASE
        WHEN ft.is_anonymous THEN 'Anonymous'
        ELSE COALESCE(p.username, 'Unknown')
    END AS username,
    CASE
        WHEN ft.is_anonymous THEN 'Anonymous User'
        ELSE COALESCE(p.full_name, p.username, 'Unknown')
    END AS full_name,
    p.avatar_url AS author_avatar_url,
    -- Category info
    fc.name AS category_name,
    fc.slug AS category_slug,
    -- Computed fields
    COALESCE(
        (SELECT MAX(fr.created_at) FROM forum_replies fr WHERE fr.thread_id = ft.id),
        ft.created_at
    ) AS last_reply_at,
    (SELECT COUNT(*)::integer FROM forum_replies fr WHERE fr.thread_id = ft.id) AS replies_count
FROM forum_threads ft
LEFT JOIN profiles p ON ft.author_id = p.id
LEFT JOIN forum_categories fc ON ft.category_id = fc.id;

-- Note: On AWS RDS, the view is accessible via the swn_admin user
-- Supabase-specific roles (authenticated, anon) are not used
