-- Migration: Backlot Tasks System
-- Description: Full-featured task management for film productions
-- Tables: task_lists, task_list_members, tasks, task_assignees, task_watchers,
--         task_labels, task_label_links, task_comments, task_views

-- ============================================
-- TASK LABELS (create first, referenced by tasks)
-- ============================================
CREATE TABLE IF NOT EXISTS backlot_task_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, name)
);

CREATE INDEX idx_backlot_task_labels_project ON backlot_task_labels(project_id);

-- ============================================
-- TASK LISTS
-- ============================================
CREATE TABLE IF NOT EXISTS backlot_task_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    default_view_type TEXT NOT NULL DEFAULT 'board',
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    sharing_mode TEXT NOT NULL DEFAULT 'project_wide',
    created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_default_view_type CHECK (default_view_type IN ('board', 'list', 'calendar')),
    CONSTRAINT valid_sharing_mode CHECK (sharing_mode IN ('project_wide', 'selective'))
);

CREATE INDEX idx_backlot_task_lists_project ON backlot_task_lists(project_id);
CREATE INDEX idx_backlot_task_lists_creator ON backlot_task_lists(created_by_user_id);
CREATE INDEX idx_backlot_task_lists_archived ON backlot_task_lists(project_id, is_archived);

-- ============================================
-- TASK LIST MEMBERS (for selective sharing)
-- ============================================
CREATE TABLE IF NOT EXISTS backlot_task_list_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_list_id UUID NOT NULL REFERENCES backlot_task_lists(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    can_edit BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(task_list_id, user_id)
);

CREATE INDEX idx_backlot_task_list_members_list ON backlot_task_list_members(task_list_id);
CREATE INDEX idx_backlot_task_list_members_user ON backlot_task_list_members(user_id);

-- ============================================
-- TASKS
-- ============================================
CREATE TABLE IF NOT EXISTS backlot_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES backlot_projects(id) ON DELETE CASCADE,
    task_list_id UUID NOT NULL REFERENCES backlot_task_lists(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT,
    section TEXT,
    due_date DATE,
    start_date DATE,
    created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
    last_updated_by_user_id UUID REFERENCES auth.users(id),
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    estimate_hours NUMERIC(8,2),
    actual_hours NUMERIC(8,2),
    department TEXT,
    source_type TEXT,
    source_id UUID,
    sort_index NUMERIC(12,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_status CHECK (status IN ('todo', 'in_progress', 'review', 'blocked', 'done')),
    CONSTRAINT valid_priority CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high', 'urgent'))
);

CREATE INDEX idx_backlot_tasks_project ON backlot_tasks(project_id);
CREATE INDEX idx_backlot_tasks_list ON backlot_tasks(task_list_id);
CREATE INDEX idx_backlot_tasks_status ON backlot_tasks(task_list_id, status);
CREATE INDEX idx_backlot_tasks_due_date ON backlot_tasks(task_list_id, due_date);
CREATE INDEX idx_backlot_tasks_section ON backlot_tasks(task_list_id, section);
CREATE INDEX idx_backlot_tasks_department ON backlot_tasks(task_list_id, department);
CREATE INDEX idx_backlot_tasks_source ON backlot_tasks(source_type, source_id);
CREATE INDEX idx_backlot_tasks_sort ON backlot_tasks(task_list_id, sort_index);

-- ============================================
-- TASK ASSIGNEES
-- ============================================
CREATE TABLE IF NOT EXISTS backlot_task_assignees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES backlot_tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(task_id, user_id)
);

CREATE INDEX idx_backlot_task_assignees_task ON backlot_task_assignees(task_id);
CREATE INDEX idx_backlot_task_assignees_user ON backlot_task_assignees(user_id);

-- ============================================
-- TASK WATCHERS
-- ============================================
CREATE TABLE IF NOT EXISTS backlot_task_watchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES backlot_tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(task_id, user_id)
);

CREATE INDEX idx_backlot_task_watchers_task ON backlot_task_watchers(task_id);
CREATE INDEX idx_backlot_task_watchers_user ON backlot_task_watchers(user_id);

-- ============================================
-- TASK LABEL LINKS (many-to-many)
-- ============================================
CREATE TABLE IF NOT EXISTS backlot_task_label_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES backlot_tasks(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES backlot_task_labels(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(task_id, label_id)
);

CREATE INDEX idx_backlot_task_label_links_task ON backlot_task_label_links(task_id);
CREATE INDEX idx_backlot_task_label_links_label ON backlot_task_label_links(label_id);

-- ============================================
-- TASK COMMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS backlot_task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES backlot_tasks(id) ON DELETE CASCADE,
    author_user_id UUID NOT NULL REFERENCES auth.users(id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_backlot_task_comments_task ON backlot_task_comments(task_id);
CREATE INDEX idx_backlot_task_comments_author ON backlot_task_comments(author_user_id);

-- ============================================
-- TASK VIEWS (saved view configurations)
-- ============================================
CREATE TABLE IF NOT EXISTS backlot_task_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_list_id UUID NOT NULL REFERENCES backlot_task_lists(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    view_type TEXT NOT NULL DEFAULT 'board',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    config JSONB NOT NULL DEFAULT '{}',
    created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_view_type CHECK (view_type IN ('board', 'list', 'calendar'))
);

CREATE INDEX idx_backlot_task_views_list ON backlot_task_views(task_list_id);
CREATE INDEX idx_backlot_task_views_default ON backlot_task_views(task_list_id, is_default);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

ALTER TABLE backlot_task_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_task_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_task_list_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_task_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_task_label_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlot_task_views ENABLE ROW LEVEL SECURITY;

-- Task Labels: Project members can view, editors can manage
CREATE POLICY "task_labels_select" ON backlot_task_labels FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM backlot_project_members pm
        WHERE pm.project_id = backlot_task_labels.project_id
        AND pm.user_id = auth.uid()
    )
);

CREATE POLICY "task_labels_insert" ON backlot_task_labels FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM backlot_project_members pm
        WHERE pm.project_id = backlot_task_labels.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('admin', 'editor')
    )
);

CREATE POLICY "task_labels_update" ON backlot_task_labels FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM backlot_project_members pm
        WHERE pm.project_id = backlot_task_labels.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('admin', 'editor')
    )
);

CREATE POLICY "task_labels_delete" ON backlot_task_labels FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM backlot_project_members pm
        WHERE pm.project_id = backlot_task_labels.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'admin'
    )
);

-- Task Lists: Complex sharing logic
CREATE POLICY "task_lists_select" ON backlot_task_lists FOR SELECT USING (
    -- Project sharing mode: all project members can view
    (sharing_mode = 'project_wide' AND EXISTS (
        SELECT 1 FROM backlot_project_members pm
        WHERE pm.project_id = backlot_task_lists.project_id
        AND pm.user_id = auth.uid()
    ))
    OR
    -- Selective sharing mode: only list members can view
    (sharing_mode = 'selective' AND EXISTS (
        SELECT 1 FROM backlot_task_list_members tlm
        WHERE tlm.task_list_id = backlot_task_lists.id
        AND tlm.user_id = auth.uid()
    ))
    OR
    -- Project admins can always view
    EXISTS (
        SELECT 1 FROM backlot_project_members pm
        WHERE pm.project_id = backlot_task_lists.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'admin'
    )
);

CREATE POLICY "task_lists_insert" ON backlot_task_lists FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM backlot_project_members pm
        WHERE pm.project_id = backlot_task_lists.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('admin', 'editor')
    )
);

CREATE POLICY "task_lists_update" ON backlot_task_lists FOR UPDATE USING (
    -- Creator can update
    created_by_user_id = auth.uid()
    OR
    -- List members with edit rights can update
    EXISTS (
        SELECT 1 FROM backlot_task_list_members tlm
        WHERE tlm.task_list_id = backlot_task_lists.id
        AND tlm.user_id = auth.uid()
        AND tlm.can_edit = TRUE
    )
    OR
    -- Project admins can update
    EXISTS (
        SELECT 1 FROM backlot_project_members pm
        WHERE pm.project_id = backlot_task_lists.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'admin'
    )
);

CREATE POLICY "task_lists_delete" ON backlot_task_lists FOR DELETE USING (
    created_by_user_id = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM backlot_project_members pm
        WHERE pm.project_id = backlot_task_lists.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'admin'
    )
);

-- Task List Members
CREATE POLICY "task_list_members_select" ON backlot_task_list_members FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM backlot_task_lists tl
        WHERE tl.id = backlot_task_list_members.task_list_id
        AND (
            tl.created_by_user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM backlot_project_members pm
                WHERE pm.project_id = tl.project_id
                AND pm.user_id = auth.uid()
                AND pm.role = 'admin'
            )
            OR backlot_task_list_members.user_id = auth.uid()
        )
    )
);

CREATE POLICY "task_list_members_insert" ON backlot_task_list_members FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM backlot_task_lists tl
        WHERE tl.id = backlot_task_list_members.task_list_id
        AND (
            tl.created_by_user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM backlot_project_members pm
                WHERE pm.project_id = tl.project_id
                AND pm.user_id = auth.uid()
                AND pm.role = 'admin'
            )
        )
    )
);

CREATE POLICY "task_list_members_delete" ON backlot_task_list_members FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM backlot_task_lists tl
        WHERE tl.id = backlot_task_list_members.task_list_id
        AND (
            tl.created_by_user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM backlot_project_members pm
                WHERE pm.project_id = tl.project_id
                AND pm.user_id = auth.uid()
                AND pm.role = 'admin'
            )
        )
    )
);

-- Tasks: Inherit from task list permissions
CREATE POLICY "tasks_select" ON backlot_tasks FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM backlot_task_lists tl
        WHERE tl.id = backlot_tasks.task_list_id
        AND (
            (tl.sharing_mode = 'project_wide' AND EXISTS (
                SELECT 1 FROM backlot_project_members pm
                WHERE pm.project_id = tl.project_id
                AND pm.user_id = auth.uid()
            ))
            OR
            (tl.sharing_mode = 'selective' AND EXISTS (
                SELECT 1 FROM backlot_task_list_members tlm
                WHERE tlm.task_list_id = tl.id
                AND tlm.user_id = auth.uid()
            ))
            OR
            EXISTS (
                SELECT 1 FROM backlot_project_members pm
                WHERE pm.project_id = tl.project_id
                AND pm.user_id = auth.uid()
                AND pm.role = 'admin'
            )
        )
    )
);

CREATE POLICY "tasks_insert" ON backlot_tasks FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM backlot_task_lists tl
        WHERE tl.id = backlot_tasks.task_list_id
        AND (
            (tl.sharing_mode = 'project_wide' AND EXISTS (
                SELECT 1 FROM backlot_project_members pm
                WHERE pm.project_id = tl.project_id
                AND pm.user_id = auth.uid()
                AND pm.role IN ('admin', 'editor')
            ))
            OR
            (tl.sharing_mode = 'selective' AND EXISTS (
                SELECT 1 FROM backlot_task_list_members tlm
                WHERE tlm.task_list_id = tl.id
                AND tlm.user_id = auth.uid()
                AND tlm.can_edit = TRUE
            ))
            OR
            EXISTS (
                SELECT 1 FROM backlot_project_members pm
                WHERE pm.project_id = tl.project_id
                AND pm.user_id = auth.uid()
                AND pm.role = 'admin'
            )
        )
    )
);

CREATE POLICY "tasks_update" ON backlot_tasks FOR UPDATE USING (
    created_by_user_id = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM backlot_task_lists tl
        WHERE tl.id = backlot_tasks.task_list_id
        AND (
            (tl.sharing_mode = 'project_wide' AND EXISTS (
                SELECT 1 FROM backlot_project_members pm
                WHERE pm.project_id = tl.project_id
                AND pm.user_id = auth.uid()
                AND pm.role IN ('admin', 'editor')
            ))
            OR
            (tl.sharing_mode = 'selective' AND EXISTS (
                SELECT 1 FROM backlot_task_list_members tlm
                WHERE tlm.task_list_id = tl.id
                AND tlm.user_id = auth.uid()
                AND tlm.can_edit = TRUE
            ))
        )
    )
);

CREATE POLICY "tasks_delete" ON backlot_tasks FOR DELETE USING (
    created_by_user_id = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM backlot_task_lists tl
        WHERE tl.id = backlot_tasks.task_list_id
        AND (
            tl.created_by_user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM backlot_project_members pm
                WHERE pm.project_id = tl.project_id
                AND pm.user_id = auth.uid()
                AND pm.role = 'admin'
            )
        )
    )
);

-- Task Assignees: Same as tasks
CREATE POLICY "task_assignees_select" ON backlot_task_assignees FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM backlot_tasks t
        JOIN backlot_task_lists tl ON tl.id = t.task_list_id
        WHERE t.id = backlot_task_assignees.task_id
        AND (
            (tl.sharing_mode = 'project_wide' AND EXISTS (
                SELECT 1 FROM backlot_project_members pm
                WHERE pm.project_id = tl.project_id AND pm.user_id = auth.uid()
            ))
            OR
            (tl.sharing_mode = 'selective' AND EXISTS (
                SELECT 1 FROM backlot_task_list_members tlm
                WHERE tlm.task_list_id = tl.id AND tlm.user_id = auth.uid()
            ))
            OR EXISTS (
                SELECT 1 FROM backlot_project_members pm
                WHERE pm.project_id = tl.project_id AND pm.user_id = auth.uid() AND pm.role = 'admin'
            )
        )
    )
);

CREATE POLICY "task_assignees_insert" ON backlot_task_assignees FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM backlot_tasks t
        JOIN backlot_task_lists tl ON tl.id = t.task_list_id
        WHERE t.id = backlot_task_assignees.task_id
        AND (
            t.created_by_user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM backlot_project_members pm
                WHERE pm.project_id = tl.project_id AND pm.user_id = auth.uid() AND pm.role IN ('admin', 'editor')
            )
        )
    )
);

CREATE POLICY "task_assignees_delete" ON backlot_task_assignees FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM backlot_tasks t
        JOIN backlot_task_lists tl ON tl.id = t.task_list_id
        WHERE t.id = backlot_task_assignees.task_id
        AND (
            t.created_by_user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM backlot_project_members pm
                WHERE pm.project_id = tl.project_id AND pm.user_id = auth.uid() AND pm.role IN ('admin', 'editor')
            )
        )
    )
);

-- Task Watchers: Similar to assignees
CREATE POLICY "task_watchers_select" ON backlot_task_watchers FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM backlot_tasks t
        JOIN backlot_task_lists tl ON tl.id = t.task_list_id
        WHERE t.id = backlot_task_watchers.task_id
        AND (
            (tl.sharing_mode = 'project_wide' AND EXISTS (
                SELECT 1 FROM backlot_project_members pm
                WHERE pm.project_id = tl.project_id AND pm.user_id = auth.uid()
            ))
            OR
            (tl.sharing_mode = 'selective' AND EXISTS (
                SELECT 1 FROM backlot_task_list_members tlm
                WHERE tlm.task_list_id = tl.id AND tlm.user_id = auth.uid()
            ))
            OR EXISTS (
                SELECT 1 FROM backlot_project_members pm
                WHERE pm.project_id = tl.project_id AND pm.user_id = auth.uid() AND pm.role = 'admin'
            )
        )
    )
);

CREATE POLICY "task_watchers_insert" ON backlot_task_watchers FOR INSERT WITH CHECK (
    backlot_task_watchers.user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM backlot_tasks t
        JOIN backlot_task_lists tl ON tl.id = t.task_list_id
        WHERE t.id = backlot_task_watchers.task_id
        AND EXISTS (
            SELECT 1 FROM backlot_project_members pm
            WHERE pm.project_id = tl.project_id AND pm.user_id = auth.uid() AND pm.role IN ('admin', 'editor')
        )
    )
);

CREATE POLICY "task_watchers_delete" ON backlot_task_watchers FOR DELETE USING (
    backlot_task_watchers.user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM backlot_tasks t
        JOIN backlot_task_lists tl ON tl.id = t.task_list_id
        WHERE t.id = backlot_task_watchers.task_id
        AND EXISTS (
            SELECT 1 FROM backlot_project_members pm
            WHERE pm.project_id = tl.project_id AND pm.user_id = auth.uid() AND pm.role = 'admin'
        )
    )
);

-- Task Label Links
CREATE POLICY "task_label_links_select" ON backlot_task_label_links FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM backlot_tasks t
        JOIN backlot_task_lists tl ON tl.id = t.task_list_id
        WHERE t.id = backlot_task_label_links.task_id
        AND (
            (tl.sharing_mode = 'project_wide' AND EXISTS (
                SELECT 1 FROM backlot_project_members pm
                WHERE pm.project_id = tl.project_id AND pm.user_id = auth.uid()
            ))
            OR
            (tl.sharing_mode = 'selective' AND EXISTS (
                SELECT 1 FROM backlot_task_list_members tlm
                WHERE tlm.task_list_id = tl.id AND tlm.user_id = auth.uid()
            ))
            OR EXISTS (
                SELECT 1 FROM backlot_project_members pm
                WHERE pm.project_id = tl.project_id AND pm.user_id = auth.uid() AND pm.role = 'admin'
            )
        )
    )
);

CREATE POLICY "task_label_links_insert" ON backlot_task_label_links FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM backlot_tasks t
        JOIN backlot_task_lists tl ON tl.id = t.task_list_id
        WHERE t.id = backlot_task_label_links.task_id
        AND EXISTS (
            SELECT 1 FROM backlot_project_members pm
            WHERE pm.project_id = tl.project_id AND pm.user_id = auth.uid() AND pm.role IN ('admin', 'editor')
        )
    )
);

CREATE POLICY "task_label_links_delete" ON backlot_task_label_links FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM backlot_tasks t
        JOIN backlot_task_lists tl ON tl.id = t.task_list_id
        WHERE t.id = backlot_task_label_links.task_id
        AND EXISTS (
            SELECT 1 FROM backlot_project_members pm
            WHERE pm.project_id = tl.project_id AND pm.user_id = auth.uid() AND pm.role IN ('admin', 'editor')
        )
    )
);

-- Task Comments
CREATE POLICY "task_comments_select" ON backlot_task_comments FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM backlot_tasks t
        JOIN backlot_task_lists tl ON tl.id = t.task_list_id
        WHERE t.id = backlot_task_comments.task_id
        AND (
            (tl.sharing_mode = 'project_wide' AND EXISTS (
                SELECT 1 FROM backlot_project_members pm
                WHERE pm.project_id = tl.project_id AND pm.user_id = auth.uid()
            ))
            OR
            (tl.sharing_mode = 'selective' AND EXISTS (
                SELECT 1 FROM backlot_task_list_members tlm
                WHERE tlm.task_list_id = tl.id AND tlm.user_id = auth.uid()
            ))
            OR EXISTS (
                SELECT 1 FROM backlot_project_members pm
                WHERE pm.project_id = tl.project_id AND pm.user_id = auth.uid() AND pm.role = 'admin'
            )
        )
    )
);

CREATE POLICY "task_comments_insert" ON backlot_task_comments FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM backlot_tasks t
        JOIN backlot_task_lists tl ON tl.id = t.task_list_id
        WHERE t.id = backlot_task_comments.task_id
        AND (
            (tl.sharing_mode = 'project_wide' AND EXISTS (
                SELECT 1 FROM backlot_project_members pm
                WHERE pm.project_id = tl.project_id AND pm.user_id = auth.uid()
            ))
            OR
            (tl.sharing_mode = 'selective' AND EXISTS (
                SELECT 1 FROM backlot_task_list_members tlm
                WHERE tlm.task_list_id = tl.id AND tlm.user_id = auth.uid()
            ))
            OR EXISTS (
                SELECT 1 FROM backlot_project_members pm
                WHERE pm.project_id = tl.project_id AND pm.user_id = auth.uid() AND pm.role = 'admin'
            )
        )
    )
);

CREATE POLICY "task_comments_update" ON backlot_task_comments FOR UPDATE USING (
    author_user_id = auth.uid()
);

CREATE POLICY "task_comments_delete" ON backlot_task_comments FOR DELETE USING (
    author_user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM backlot_tasks t
        JOIN backlot_task_lists tl ON tl.id = t.task_list_id
        WHERE t.id = backlot_task_comments.task_id
        AND EXISTS (
            SELECT 1 FROM backlot_project_members pm
            WHERE pm.project_id = tl.project_id AND pm.user_id = auth.uid() AND pm.role = 'admin'
        )
    )
);

-- Task Views
CREATE POLICY "task_views_select" ON backlot_task_views FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM backlot_task_lists tl
        WHERE tl.id = backlot_task_views.task_list_id
        AND (
            (tl.sharing_mode = 'project_wide' AND EXISTS (
                SELECT 1 FROM backlot_project_members pm
                WHERE pm.project_id = tl.project_id AND pm.user_id = auth.uid()
            ))
            OR
            (tl.sharing_mode = 'selective' AND EXISTS (
                SELECT 1 FROM backlot_task_list_members tlm
                WHERE tlm.task_list_id = tl.id AND tlm.user_id = auth.uid()
            ))
            OR EXISTS (
                SELECT 1 FROM backlot_project_members pm
                WHERE pm.project_id = tl.project_id AND pm.user_id = auth.uid() AND pm.role = 'admin'
            )
        )
    )
);

CREATE POLICY "task_views_insert" ON backlot_task_views FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM backlot_task_lists tl
        WHERE tl.id = backlot_task_views.task_list_id
        AND EXISTS (
            SELECT 1 FROM backlot_project_members pm
            WHERE pm.project_id = tl.project_id AND pm.user_id = auth.uid() AND pm.role IN ('admin', 'editor')
        )
    )
);

CREATE POLICY "task_views_update" ON backlot_task_views FOR UPDATE USING (
    created_by_user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM backlot_task_lists tl
        WHERE tl.id = backlot_task_views.task_list_id
        AND EXISTS (
            SELECT 1 FROM backlot_project_members pm
            WHERE pm.project_id = tl.project_id AND pm.user_id = auth.uid() AND pm.role = 'admin'
        )
    )
);

CREATE POLICY "task_views_delete" ON backlot_task_views FOR DELETE USING (
    created_by_user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM backlot_task_lists tl
        WHERE tl.id = backlot_task_views.task_list_id
        AND EXISTS (
            SELECT 1 FROM backlot_project_members pm
            WHERE pm.project_id = tl.project_id AND pm.user_id = auth.uid() AND pm.role = 'admin'
        )
    )
);

-- ============================================
-- TRIGGERS FOR updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_backlot_task_lists_updated_at
    BEFORE UPDATE ON backlot_task_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_backlot_tasks_updated_at
    BEFORE UPDATE ON backlot_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_backlot_task_comments_updated_at
    BEFORE UPDATE ON backlot_task_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_backlot_task_views_updated_at
    BEFORE UPDATE ON backlot_task_views
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
