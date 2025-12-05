# Green Room Database Migration

## Overview
This migration creates the complete database schema for the Green Room voting arena feature.

## Tables Created

### 1. `greenroom_cycles`
Voting cycles where projects compete for development funding.

**Key Fields:**
- `name`, `description` - Cycle identification
- `status` - upcoming, active, closed
- `start_date`, `end_date` - Cycle timeline
- `voting_start_date`, `voting_end_date` - When voting is allowed
- `max_tickets_per_user` - Default: 100
- `ticket_price` - Default: $10.00

### 2. `greenroom_projects`
Project submissions from filmmakers.

**Key Fields:**
- `cycle_id` - Which cycle this project belongs to
- `filmmaker_id` - User who submitted
- `title`, `description`, `category` - Project details
- `video_url`, `image_url` - Media assets
- `status` - pending, approved, rejected
- `vote_count` - Denormalized count for performance

### 3. `greenroom_voting_tickets`
Purchased voting tickets for users.

**Key Fields:**
- `user_id`, `cycle_id` - Who bought tickets for which cycle
- `tickets_purchased`, `tickets_used`, `tickets_available` - Ticket tracking
- `amount_paid` - Total payment
- `payment_status` - pending, completed, failed, refunded
- `stripe_payment_intent_id`, `stripe_session_id` - Payment tracking

**Constraints:**
- One ticket purchase record per user per cycle
- `tickets_used + tickets_available = tickets_purchased`

### 4. `greenroom_votes`
Cast votes allocating tickets to projects.

**Key Fields:**
- `user_id`, `project_id`, `cycle_id` - Vote identification
- `tickets_allocated` - How many tickets voted

**Constraints:**
- One vote per user per project (votes are final!)
- UNIQUE constraint prevents duplicate votes

## Features Implemented

### 1. Automatic Vote Counting
When a vote is cast:
- Project's `vote_count` is automatically incremented
- No need to COUNT votes in queries - improves performance

### 2. Automatic Ticket Tracking
When a vote is cast:
- User's `tickets_available` is decremented
- User's `tickets_used` is incremented
- Ensures users can't overspend tickets

### 3. Row Level Security (RLS)

**Cycles:**
- Everyone can read
- Only admins can create/update/delete

**Projects:**
- Everyone can read approved projects
- Filmmakers can see their own pending projects
- Admins/moderators can see all
- Filmmakers can submit their own projects
- Admins can manage all projects

**Voting Tickets:**
- Users can only see their own tickets
- Users can purchase their own tickets
- Admins can manage all tickets

**Votes:**
- Users can see their own votes
- Admins/moderators can see all votes
- Anyone with voting permissions can cast votes
- **Votes are final** - no updates allowed (only admin delete)

### 4. Vote Finality
Once a vote is cast:
- Cannot be changed
- Cannot be deleted (except by admins)
- UNIQUE constraint prevents duplicate votes
- Tickets are permanently allocated

## Running the Migration

### Step 1: Access Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar

### Step 2: Run the Migration
1. Click **New Query**
2. Copy the entire contents of `migrations/006_greenroom_tables.sql`
3. Paste into the SQL Editor
4. Click **Run** button

### Step 3: Verify Tables Created
Run this query to confirm:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'greenroom_%'
ORDER BY table_name;
```

Expected result:
- `greenroom_cycles`
- `greenroom_projects`
- `greenroom_votes`
- `greenroom_voting_tickets`

### Step 4: Create Test Data (Optional)
Uncomment and modify the sample data at the bottom of the migration file, or run:

```sql
-- Create a test cycle
INSERT INTO greenroom_cycles (
    name,
    description,
    status,
    start_date,
    end_date,
    voting_start_date,
    voting_end_date
) VALUES (
    'Test Cycle - Jan 2025',
    'Test voting cycle for development',
    'active',
    NOW(),
    NOW() + INTERVAL '30 days',
    NOW(),
    NOW() + INTERVAL '30 days'
) RETURNING *;
```

## Testing the Schema

### 1. Check Permissions
```sql
-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'greenroom_%';

-- Should show rowsecurity = true for all tables
```

### 2. Test Vote Counting Trigger
```sql
-- Insert a test vote (replace with real IDs)
INSERT INTO greenroom_votes (user_id, project_id, cycle_id, tickets_allocated)
VALUES ('your-user-uuid', 1, 1, 5);

-- Check that project vote_count was updated
SELECT id, title, vote_count FROM greenroom_projects WHERE id = 1;
```

### 3. Test Ticket Tracking Trigger
```sql
-- Create test tickets
INSERT INTO greenroom_voting_tickets (
    user_id,
    cycle_id,
    tickets_purchased,
    tickets_available,
    amount_paid,
    payment_status
) VALUES (
    'your-user-uuid',
    1,
    10,
    10,
    100.00,
    'completed'
) RETURNING *;

-- Cast a vote (this should reduce available tickets)
INSERT INTO greenroom_votes (user_id, project_id, cycle_id, tickets_allocated)
VALUES ('your-user-uuid', 1, 1, 3);

-- Verify tickets were deducted
SELECT tickets_purchased, tickets_used, tickets_available
FROM greenroom_voting_tickets
WHERE user_id = 'your-user-uuid' AND cycle_id = 1;

-- Should show: purchased=10, used=3, available=7
```

## Rollback (If Needed)

To completely remove the Green Room tables:

```sql
-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS greenroom_votes CASCADE;
DROP TABLE IF EXISTS greenroom_voting_tickets CASCADE;
DROP TABLE IF EXISTS greenroom_projects CASCADE;
DROP TABLE IF EXISTS greenroom_cycles CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_greenroom_cycles_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_greenroom_projects_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_project_vote_count() CASCADE;
DROP FUNCTION IF EXISTS update_ticket_availability() CASCADE;
```

## Database Indexes

The migration includes optimized indexes for common queries:

**Cycles:**
- `idx_greenroom_cycles_status` - Filter by status
- `idx_greenroom_cycles_dates` - Date range queries

**Projects:**
- `idx_greenroom_projects_cycle` - Projects by cycle
- `idx_greenroom_projects_filmmaker` - User's projects
- `idx_greenroom_projects_status` - Filter approved/pending
- `idx_greenroom_projects_vote_count` - Sort by popularity
- `idx_greenroom_projects_created_at` - Sort by recency

**Votes:**
- `idx_greenroom_votes_user` - User's votes
- `idx_greenroom_votes_project` - Project votes
- `idx_greenroom_votes_cycle` - Cycle votes

**Tickets:**
- `idx_greenroom_tickets_user` - User's tickets
- `idx_greenroom_tickets_cycle` - Cycle tickets
- `idx_greenroom_tickets_payment_status` - Payment filtering

## Next Steps

After running the migration:

1. **Test the API endpoints** - Try creating a cycle via the backend API
2. **Test the frontend** - Navigate to `/greenroom` and verify it loads
3. **Configure Stripe** - Set up Stripe webhooks for ticket purchases
4. **Create initial cycle** - Use the admin panel to create the first cycle
5. **Test voting flow** - Submit a project, purchase tickets, cast votes

## Troubleshooting

### Error: "relation already exists"
The migration uses `CREATE TABLE IF NOT EXISTS`, so this shouldn't happen. If it does, the table already exists from a previous run.

### Error: "permission denied"
Make sure you're running the migration as a Supabase admin user, not as an authenticated app user.

### RLS blocking queries
If queries are being blocked by RLS policies, verify:
1. User has proper role (premium, filmmaker, partner for voting)
2. Projects are approved (pending projects only visible to filmmaker/admin)
3. JWT token is valid and includes user ID

---

**Migration Version:** 006
**Created:** December 5, 2025
**Compatible with:** Supabase, PostgreSQL 14+
