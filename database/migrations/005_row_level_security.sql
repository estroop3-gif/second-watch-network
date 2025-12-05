-- Second Watch Network - Row Level Security Policies
-- Run this in Supabase SQL Editor

-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE filmmaker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE filmmaker_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================

-- Anyone can view profiles
CREATE POLICY "Profiles are viewable by everyone"
    ON profiles FOR SELECT
    USING (true);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- ============================================================================
-- FILMMAKER PROFILES POLICIES
-- ============================================================================

-- Anyone can view filmmaker profiles
CREATE POLICY "Filmmaker profiles are viewable by everyone"
    ON filmmaker_profiles FOR SELECT
    USING (true);

-- Users can insert their own filmmaker profile
CREATE POLICY "Users can insert their own filmmaker profile"
    ON filmmaker_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own filmmaker profile
CREATE POLICY "Users can update their own filmmaker profile"
    ON filmmaker_profiles FOR UPDATE
    USING (auth.uid() = user_id);

-- ============================================================================
-- SUBMISSIONS POLICIES
-- ============================================================================

-- Users can view their own submissions
CREATE POLICY "Users can view their own submissions"
    ON submissions FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can view all submissions
CREATE POLICY "Admins can view all submissions"
    ON submissions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Users can insert their own submissions
CREATE POLICY "Users can insert their own submissions"
    ON submissions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own submissions (only if pending)
CREATE POLICY "Users can update their own pending submissions"
    ON submissions FOR UPDATE
    USING (auth.uid() = user_id AND status = 'pending');

-- Admins can update any submission
CREATE POLICY "Admins can update any submission"
    ON submissions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- ============================================================================
-- FORUM POLICIES
-- ============================================================================

-- Anyone can view categories
CREATE POLICY "Categories are viewable by everyone"
    ON forum_categories FOR SELECT
    USING (true);

-- Admins can manage categories
CREATE POLICY "Admins can manage categories"
    ON forum_categories FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Anyone can view threads
CREATE POLICY "Threads are viewable by everyone"
    ON forum_threads FOR SELECT
    USING (true);

-- Authenticated users can create threads
CREATE POLICY "Authenticated users can create threads"
    ON forum_threads FOR INSERT
    WITH CHECK (auth.uid() = author_id);

-- Users can update their own threads
CREATE POLICY "Users can update their own threads"
    ON forum_threads FOR UPDATE
    USING (auth.uid() = author_id);

-- Admins can delete threads
CREATE POLICY "Admins can delete threads"
    ON forum_threads FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Anyone can view replies
CREATE POLICY "Replies are viewable by everyone"
    ON forum_replies FOR SELECT
    USING (true);

-- Authenticated users can create replies
CREATE POLICY "Authenticated users can create replies"
    ON forum_replies FOR INSERT
    WITH CHECK (auth.uid() = author_id);

-- Admins can delete replies
CREATE POLICY "Admins can delete replies"
    ON forum_replies FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- ============================================================================
-- MESSAGING POLICIES
-- ============================================================================

-- Users can view conversations they're part of
CREATE POLICY "Users can view their conversations"
    ON conversations FOR SELECT
    USING (auth.uid() = ANY(participant_ids));

-- Users can create conversations
CREATE POLICY "Users can create conversations"
    ON conversations FOR INSERT
    WITH CHECK (auth.uid() = ANY(participant_ids));

-- Users can view messages in their conversations
CREATE POLICY "Users can view their messages"
    ON messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND auth.uid() = ANY(conversations.participant_ids)
        )
    );

-- Users can send messages to their conversations
CREATE POLICY "Users can send messages"
    ON messages FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id
        AND EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND auth.uid() = ANY(conversations.participant_ids)
        )
    );

-- Users can update their own messages (mark as read)
CREATE POLICY "Users can update messages in their conversations"
    ON messages FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND auth.uid() = ANY(conversations.participant_ids)
        )
    );

-- ============================================================================
-- NOTIFICATIONS POLICIES
-- ============================================================================

-- Users can only view their own notifications
CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- System can insert notifications
CREATE POLICY "System can insert notifications"
    ON notifications FOR INSERT
    WITH CHECK (true);

-- ============================================================================
-- CONNECTIONS POLICIES
-- ============================================================================

-- Users can view connections they're involved in
CREATE POLICY "Users can view their connections"
    ON connections FOR SELECT
    USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

-- Users can create connection requests
CREATE POLICY "Users can create connection requests"
    ON connections FOR INSERT
    WITH CHECK (auth.uid() = requester_id);

-- Recipients can update connection status
CREATE POLICY "Recipients can update connection status"
    ON connections FOR UPDATE
    USING (auth.uid() = recipient_id);

-- ============================================================================
-- CONTENT POLICIES
-- ============================================================================

-- Published content is viewable by everyone
CREATE POLICY "Published content is viewable by everyone"
    ON content FOR SELECT
    USING (status = 'published' OR auth.uid() = creator_id);

-- Admins can manage all content
CREATE POLICY "Admins can manage content"
    ON content FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- ============================================================================
-- CREDITS & AVAILABILITY POLICIES
-- ============================================================================

-- Anyone can view credits
CREATE POLICY "Credits are viewable by everyone"
    ON credits FOR SELECT
    USING (true);

-- Users can manage their own credits
CREATE POLICY "Users can manage their own credits"
    ON credits FOR ALL
    USING (auth.uid() = user_id);

-- Anyone can view availability
CREATE POLICY "Availability is viewable by everyone"
    ON availability FOR SELECT
    USING (true);

-- Users can manage their own availability
CREATE POLICY "Users can manage their own availability"
    ON availability FOR ALL
    USING (auth.uid() = user_id);
