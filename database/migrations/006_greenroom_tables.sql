-- Second Watch Network - Green Room Tables Migration
-- Run this in Supabase SQL Editor

-- ============================================================================
-- GREEN ROOM CYCLES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS greenroom_cycles (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'closed')),
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    voting_start_date TIMESTAMP WITH TIME ZONE,
    voting_end_date TIMESTAMP WITH TIME ZONE,
    max_tickets_per_user INTEGER DEFAULT 100,
    ticket_price DECIMAL(10, 2) DEFAULT 10.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for cycles
CREATE INDEX IF NOT EXISTS idx_greenroom_cycles_status ON greenroom_cycles(status);
CREATE INDEX IF NOT EXISTS idx_greenroom_cycles_dates ON greenroom_cycles(start_date, end_date);

-- ============================================================================
-- GREEN ROOM PROJECTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS greenroom_projects (
    id SERIAL PRIMARY KEY,
    cycle_id INTEGER REFERENCES greenroom_cycles(id) ON DELETE CASCADE NOT NULL,
    filmmaker_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT,
    video_url TEXT,
    image_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    vote_count INTEGER DEFAULT 0,
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for projects
CREATE INDEX IF NOT EXISTS idx_greenroom_projects_cycle ON greenroom_projects(cycle_id);
CREATE INDEX IF NOT EXISTS idx_greenroom_projects_filmmaker ON greenroom_projects(filmmaker_id);
CREATE INDEX IF NOT EXISTS idx_greenroom_projects_status ON greenroom_projects(status);
CREATE INDEX IF NOT EXISTS idx_greenroom_projects_vote_count ON greenroom_projects(vote_count DESC);
CREATE INDEX IF NOT EXISTS idx_greenroom_projects_created_at ON greenroom_projects(created_at DESC);

-- ============================================================================
-- GREEN ROOM VOTING TICKETS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS greenroom_voting_tickets (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    cycle_id INTEGER REFERENCES greenroom_cycles(id) ON DELETE CASCADE NOT NULL,
    tickets_purchased INTEGER NOT NULL DEFAULT 1 CHECK (tickets_purchased > 0),
    tickets_used INTEGER NOT NULL DEFAULT 0,
    tickets_available INTEGER NOT NULL DEFAULT 1,
    amount_paid DECIMAL(10, 2) NOT NULL,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    stripe_payment_intent_id TEXT,
    stripe_session_id TEXT,
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraint to ensure tickets_used + tickets_available = tickets_purchased
    CHECK (tickets_used + tickets_available = tickets_purchased)
);

-- Create indexes for voting tickets
CREATE INDEX IF NOT EXISTS idx_greenroom_tickets_user ON greenroom_voting_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_greenroom_tickets_cycle ON greenroom_voting_tickets(cycle_id);
CREATE INDEX IF NOT EXISTS idx_greenroom_tickets_payment_status ON greenroom_voting_tickets(payment_status);
CREATE INDEX IF NOT EXISTS idx_greenroom_tickets_stripe_session ON greenroom_voting_tickets(stripe_session_id);

-- Create unique index to prevent duplicate pending/completed purchases
CREATE UNIQUE INDEX IF NOT EXISTS idx_greenroom_tickets_user_cycle
    ON greenroom_voting_tickets(user_id, cycle_id);

-- ============================================================================
-- GREEN ROOM VOTES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS greenroom_votes (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    project_id INTEGER REFERENCES greenroom_projects(id) ON DELETE CASCADE NOT NULL,
    cycle_id INTEGER REFERENCES greenroom_cycles(id) ON DELETE CASCADE NOT NULL,
    tickets_allocated INTEGER NOT NULL CHECK (tickets_allocated > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint: one vote per user per project (votes are final)
    UNIQUE(user_id, project_id)
);

-- Create indexes for votes
CREATE INDEX IF NOT EXISTS idx_greenroom_votes_user ON greenroom_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_greenroom_votes_project ON greenroom_votes(project_id);
CREATE INDEX IF NOT EXISTS idx_greenroom_votes_cycle ON greenroom_votes(cycle_id);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Cycles updated_at trigger
CREATE OR REPLACE FUNCTION update_greenroom_cycles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER greenroom_cycles_updated_at
    BEFORE UPDATE ON greenroom_cycles
    FOR EACH ROW
    EXECUTE FUNCTION update_greenroom_cycles_updated_at();

-- Projects updated_at trigger
CREATE OR REPLACE FUNCTION update_greenroom_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER greenroom_projects_updated_at
    BEFORE UPDATE ON greenroom_projects
    FOR EACH ROW
    EXECUTE FUNCTION update_greenroom_projects_updated_at();

-- ============================================================================
-- TRIGGER TO UPDATE PROJECT VOTE COUNTS (Denormalized for performance)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_project_vote_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment vote count
        UPDATE greenroom_projects
        SET vote_count = vote_count + NEW.tickets_allocated
        WHERE id = NEW.project_id;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement vote count (if vote deletion is ever allowed)
        UPDATE greenroom_projects
        SET vote_count = vote_count - OLD.tickets_allocated
        WHERE id = OLD.project_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER greenroom_votes_update_count
    AFTER INSERT OR DELETE ON greenroom_votes
    FOR EACH ROW
    EXECUTE FUNCTION update_project_vote_count();

-- ============================================================================
-- TRIGGER TO UPDATE TICKET AVAILABILITY
-- ============================================================================

CREATE OR REPLACE FUNCTION update_ticket_availability()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Reduce available tickets when a vote is cast
        UPDATE greenroom_voting_tickets
        SET
            tickets_used = tickets_used + NEW.tickets_allocated,
            tickets_available = tickets_available - NEW.tickets_allocated
        WHERE user_id = NEW.user_id
            AND cycle_id = NEW.cycle_id;
    ELSIF TG_OP = 'DELETE' THEN
        -- Restore tickets if vote is deleted (unlikely, but included for completeness)
        UPDATE greenroom_voting_tickets
        SET
            tickets_used = tickets_used - OLD.tickets_allocated,
            tickets_available = tickets_available + OLD.tickets_allocated
        WHERE user_id = OLD.user_id
            AND cycle_id = OLD.cycle_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER greenroom_votes_update_tickets
    AFTER INSERT OR DELETE ON greenroom_votes
    FOR EACH ROW
    EXECUTE FUNCTION update_ticket_availability();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all Green Room tables
ALTER TABLE greenroom_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE greenroom_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE greenroom_voting_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE greenroom_votes ENABLE ROW LEVEL SECURITY;

-- Cycles: Everyone can read, only admins can write
CREATE POLICY greenroom_cycles_select ON greenroom_cycles
    FOR SELECT USING (true);

CREATE POLICY greenroom_cycles_insert ON greenroom_cycles
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY greenroom_cycles_update ON greenroom_cycles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY greenroom_cycles_delete ON greenroom_cycles
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Projects: Everyone can read approved, filmmakers can submit, admins manage
CREATE POLICY greenroom_projects_select ON greenroom_projects
    FOR SELECT USING (
        status = 'approved' OR
        filmmaker_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );

CREATE POLICY greenroom_projects_insert ON greenroom_projects
    FOR INSERT WITH CHECK (
        filmmaker_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('filmmaker', 'admin')
        )
    );

CREATE POLICY greenroom_projects_update ON greenroom_projects
    FOR UPDATE USING (
        filmmaker_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );

CREATE POLICY greenroom_projects_delete ON greenroom_projects
    FOR DELETE USING (
        filmmaker_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Voting Tickets: Users can only see their own tickets
CREATE POLICY greenroom_tickets_select ON greenroom_voting_tickets
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY greenroom_tickets_insert ON greenroom_voting_tickets
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY greenroom_tickets_update ON greenroom_voting_tickets
    FOR UPDATE USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Votes: Users can see their own votes, vote counts are public via projects table
CREATE POLICY greenroom_votes_select ON greenroom_votes
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'moderator')
        )
    );

CREATE POLICY greenroom_votes_insert ON greenroom_votes
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('premium', 'filmmaker', 'partner', 'admin')
        )
    );

-- Votes are final - no updates or deletes allowed (except by admins)
CREATE POLICY greenroom_votes_delete ON greenroom_votes
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant permissions to authenticated users
GRANT SELECT ON greenroom_cycles TO authenticated;
GRANT SELECT ON greenroom_projects TO authenticated;
GRANT SELECT, INSERT, UPDATE ON greenroom_voting_tickets TO authenticated;
GRANT SELECT, INSERT ON greenroom_votes TO authenticated;

-- Grant full permissions to service role
GRANT ALL ON greenroom_cycles TO service_role;
GRANT ALL ON greenroom_projects TO service_role;
GRANT ALL ON greenroom_voting_tickets TO service_role;
GRANT ALL ON greenroom_votes TO service_role;

-- Grant sequence permissions
GRANT USAGE, SELECT ON SEQUENCE greenroom_cycles_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE greenroom_projects_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE greenroom_voting_tickets_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE greenroom_votes_id_seq TO authenticated;

GRANT ALL ON SEQUENCE greenroom_cycles_id_seq TO service_role;
GRANT ALL ON SEQUENCE greenroom_projects_id_seq TO service_role;
GRANT ALL ON SEQUENCE greenroom_voting_tickets_id_seq TO service_role;
GRANT ALL ON SEQUENCE greenroom_votes_id_seq TO service_role;

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Insert a sample cycle (uncomment to use)
-- INSERT INTO greenroom_cycles (name, description, status, start_date, end_date, voting_start_date, voting_end_date)
-- VALUES (
--     'Q1 2025 Voting Cycle',
--     'First voting cycle of 2025 - Submit your best project ideas!',
--     'upcoming',
--     '2025-01-01 00:00:00+00',
--     '2025-03-31 23:59:59+00',
--     '2025-02-01 00:00:00+00',
--     '2025-03-31 23:59:59+00'
-- );

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Tables created:
--   - greenroom_cycles
--   - greenroom_projects
--   - greenroom_voting_tickets
--   - greenroom_votes
--
-- Features implemented:
--   - Automatic vote count updates (denormalized for performance)
--   - Automatic ticket availability tracking
--   - Row Level Security (RLS) policies
--   - Proper indexes for query performance
--   - Constraints to ensure data integrity
--   - Triggers for updated_at timestamps
-- ============================================================================
