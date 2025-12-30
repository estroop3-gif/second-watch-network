-- Order Events System
-- Adds events and RSVP tracking for Order members

-- Order Events table
CREATE TABLE IF NOT EXISTS order_events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('meetup', 'workshop', 'online', 'screening', 'regional', 'conference')),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    location VARCHAR(200),
    is_online BOOLEAN DEFAULT FALSE,
    online_link VARCHAR(500),
    lodge_id INT REFERENCES order_lodges(id) ON DELETE SET NULL,
    craft_house_id INT REFERENCES order_craft_houses(id) ON DELETE SET NULL,
    fellowship_id INT REFERENCES order_fellowships(id) ON DELETE SET NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    max_attendees INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Event RSVPs table
CREATE TABLE IF NOT EXISTS order_event_rsvps (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL REFERENCES order_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'attending' CHECK (status IN ('attending', 'maybe', 'declined')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_order_events_start_date ON order_events(start_date);
CREATE INDEX IF NOT EXISTS idx_order_events_type ON order_events(event_type);
CREATE INDEX IF NOT EXISTS idx_order_events_lodge ON order_events(lodge_id) WHERE lodge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_events_craft_house ON order_events(craft_house_id) WHERE craft_house_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_events_active ON order_events(is_active, start_date);
CREATE INDEX IF NOT EXISTS idx_order_event_rsvps_event ON order_event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_order_event_rsvps_user ON order_event_rsvps(user_id);

-- Enable RLS
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_event_rsvps ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_events
CREATE POLICY "Order members can view active events"
    ON order_events FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins can manage all events"
    ON order_events FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.is_admin = true OR profiles.is_staff = true)
        )
    );

CREATE POLICY "Lodge officers can create lodge events"
    ON order_events FOR INSERT
    WITH CHECK (
        lodge_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM order_lodge_memberships
            WHERE order_lodge_memberships.lodge_id = order_events.lodge_id
            AND order_lodge_memberships.user_id = auth.uid()
            AND order_lodge_memberships.is_officer = true
        )
    );

-- RLS Policies for order_event_rsvps
CREATE POLICY "Users can view their own RSVPs"
    ON order_event_rsvps FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own RSVPs"
    ON order_event_rsvps FOR ALL
    USING (user_id = auth.uid());

CREATE POLICY "Event organizers can view RSVPs"
    ON order_event_rsvps FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM order_events
            WHERE order_events.id = order_event_rsvps.event_id
            AND order_events.created_by = auth.uid()
        )
    );

-- Updated_at trigger for order_events
CREATE OR REPLACE FUNCTION update_order_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_order_events_timestamp
    BEFORE UPDATE ON order_events
    FOR EACH ROW
    EXECUTE FUNCTION update_order_events_updated_at();

-- Updated_at trigger for order_event_rsvps
CREATE TRIGGER update_order_event_rsvps_timestamp
    BEFORE UPDATE ON order_event_rsvps
    FOR EACH ROW
    EXECUTE FUNCTION update_order_events_updated_at();
