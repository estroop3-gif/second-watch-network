-- Migration: Dashboard Widget Tables
-- Creates tables for Creator Updates, Watch Streaks, and Achievements widgets

-- ============================================================================
-- CREATOR UPDATES: World Announcements
-- ============================================================================

CREATE TABLE IF NOT EXISTS world_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    announcement_type TEXT NOT NULL DEFAULT 'announcement', -- 'bts', 'announcement', 'milestone', 'poll'
    image_url TEXT,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_published BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_world_announcements_world_id ON world_announcements(world_id);
CREATE INDEX IF NOT EXISTS idx_world_announcements_created_at ON world_announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_world_announcements_type ON world_announcements(announcement_type);

-- ============================================================================
-- WATCH STREAKS: User Watch Stats
-- ============================================================================

-- Daily/weekly watch statistics
CREATE TABLE IF NOT EXISTS user_watch_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    stat_date DATE NOT NULL,
    minutes_watched INT DEFAULT 0,
    episodes_watched INT DEFAULT 0,
    shorts_watched INT DEFAULT 0,
    worlds_started INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_user_watch_stats_user_date ON user_watch_stats(user_id, stat_date DESC);

-- Streak tracking
CREATE TABLE IF NOT EXISTS user_watch_streaks (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    current_streak INT DEFAULT 0,
    longest_streak INT DEFAULT 0,
    last_watch_date DATE,
    streak_started_at DATE,
    total_watch_days INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ACHIEVEMENTS & BADGES
-- ============================================================================

-- Achievement definitions
CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    icon_url TEXT,
    category TEXT NOT NULL DEFAULT 'general', -- 'watching', 'voting', 'community', 'creator', 'streak'
    points INT DEFAULT 10,
    requirements JSONB, -- e.g., {"type": "watch_count", "threshold": 10}
    is_secret BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);
CREATE INDEX IF NOT EXISTS idx_achievements_active ON achievements(is_active) WHERE is_active = TRUE;

-- User achievement progress
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    progress INT DEFAULT 0, -- Progress towards achievement (0-100 or count)
    earned_at TIMESTAMPTZ, -- NULL if not yet earned
    is_displayed BOOLEAN DEFAULT TRUE, -- Show on profile
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_earned ON user_achievements(user_id, earned_at) WHERE earned_at IS NOT NULL;

-- ============================================================================
-- SEED DATA: Default Achievements
-- ============================================================================

INSERT INTO achievements (id, name, description, category, points, requirements, icon_url, sort_order) VALUES
    -- Watching achievements
    (gen_random_uuid(), 'First Watch', 'Complete your first episode', 'watching', 10, '{"type": "episodes_watched", "threshold": 1}', '/achievements/first-watch.svg', 1),
    (gen_random_uuid(), 'Binge Watcher', 'Watch 10 episodes', 'watching', 25, '{"type": "episodes_watched", "threshold": 10}', '/achievements/binge-watcher.svg', 2),
    (gen_random_uuid(), 'Dedicated Viewer', 'Watch 50 episodes', 'watching', 50, '{"type": "episodes_watched", "threshold": 50}', '/achievements/dedicated-viewer.svg', 3),
    (gen_random_uuid(), 'World Explorer', 'Start watching 5 different worlds', 'watching', 25, '{"type": "worlds_started", "threshold": 5}', '/achievements/world-explorer.svg', 4),

    -- Streak achievements
    (gen_random_uuid(), 'Getting Started', '3 day watch streak', 'streak', 15, '{"type": "streak_days", "threshold": 3}', '/achievements/streak-3.svg', 10),
    (gen_random_uuid(), 'Week Warrior', '7 day watch streak', 'streak', 30, '{"type": "streak_days", "threshold": 7}', '/achievements/streak-7.svg', 11),
    (gen_random_uuid(), 'Committed', '30 day watch streak', 'streak', 100, '{"type": "streak_days", "threshold": 30}', '/achievements/streak-30.svg', 12),

    -- Community achievements
    (gen_random_uuid(), 'Voice Heard', 'Post your first discussion', 'community', 15, '{"type": "discussions_posted", "threshold": 1}', '/achievements/first-post.svg', 20),
    (gen_random_uuid(), 'Helpful', 'Reply to 10 discussions', 'community', 25, '{"type": "replies_posted", "threshold": 10}', '/achievements/helpful.svg', 21),

    -- Voting achievements
    (gen_random_uuid(), 'First Vote', 'Cast your first Green Room vote', 'voting', 10, '{"type": "votes_cast", "threshold": 1}', '/achievements/first-vote.svg', 30),
    (gen_random_uuid(), 'Talent Scout', 'Vote in 10 Green Room cycles', 'voting', 50, '{"type": "cycles_voted", "threshold": 10}', '/achievements/talent-scout.svg', 31)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE world_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_watch_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_watch_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- World announcements: public read, creators can manage their own
CREATE POLICY "Anyone can view published announcements" ON world_announcements
    FOR SELECT USING (is_published = TRUE);

CREATE POLICY "World owners can manage announcements" ON world_announcements
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM worlds w
            WHERE w.id = world_announcements.world_id
            AND w.creator_id = auth.uid()
        )
    );

-- Watch stats: users can only see their own
CREATE POLICY "Users can view own watch stats" ON user_watch_stats
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own watch stats" ON user_watch_stats
    FOR ALL USING (user_id = auth.uid());

-- Watch streaks: users can only see their own
CREATE POLICY "Users can view own streaks" ON user_watch_streaks
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own streaks" ON user_watch_streaks
    FOR ALL USING (user_id = auth.uid());

-- Achievements: anyone can view definitions
CREATE POLICY "Anyone can view achievements" ON achievements
    FOR SELECT USING (is_active = TRUE AND is_secret = FALSE);

-- User achievements: users can view own, others can see earned
CREATE POLICY "Users can view own achievements" ON user_achievements
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Anyone can view earned achievements" ON user_achievements
    FOR SELECT USING (earned_at IS NOT NULL AND is_displayed = TRUE);

CREATE POLICY "Users can update own achievements" ON user_achievements
    FOR ALL USING (user_id = auth.uid());
