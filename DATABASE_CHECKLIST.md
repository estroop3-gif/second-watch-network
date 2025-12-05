# Database Setup Checklist

## ✅ Verify Your Existing Supabase Database

Use this checklist to ensure your database has all required tables and columns.

### Core Tables

#### ✅ profiles
Required columns:
- `id` (UUID, primary key, references auth.users)
- `email` (TEXT, unique)
- `full_name` (TEXT)
- `username` (TEXT, unique)
- `bio` (TEXT)
- `avatar_url` (TEXT)
- `role` (TEXT)
- `status` (TEXT)
- `created_at`, `updated_at`

#### ✅ filmmaker_profiles  
Required columns:
- `id` (UUID, primary key)
- `user_id` (UUID, foreign key to profiles)
- `bio`, `skills`, `experience_level`, `department`
- `portfolio_url`, `reel_url`, `location`
- `accepting_work` (BOOLEAN)
- `status_message`
- `created_at`, `updated_at`

#### ✅ submissions
Required columns:
- `id`, `user_id`, `project_title`, `project_type`
- `logline`, `description`, `youtube_link`
- `status`, `admin_notes`
- `has_unread_user_messages`
- `created_at`, `updated_at`

#### ✅ content
Required columns:
- `id`, `title`, `description`, `content_type`
- `url`, `thumbnail_url`, `creator_id`
- `status`, `view_count`
- `created_at`, `updated_at`

### Forum Tables

#### ✅ forum_categories
- `id`, `name`, `description`, `slug`, `created_at`

#### ✅ forum_threads
- `id`, `author_id`, `title`, `content`
- `category_id`, `is_anonymous`, `is_pinned`
- `reply_count`
- `created_at`, `updated_at`

#### ✅ forum_replies
- `id`, `thread_id`, `author_id`, `content`
- `is_anonymous`, `created_at`

### Messaging Tables

#### ✅ conversations
- `id`, `participant_ids` (UUID[])
- `last_message`, `last_message_at`
- `created_at`

#### ✅ messages
- `id`, `conversation_id`, `sender_id`, `content`
- `is_read`, `submission_id`
- `created_at`

### Notification & Connection Tables

#### ✅ notifications
- `id`, `user_id`, `title`, `body`, `type`
- `status`, `related_id`, `payload`
- `created_at`

#### ✅ connections
- `id`, `requester_id`, `recipient_id`
- `status`, `message`
- `created_at`, `updated_at`

### Additional Tables

#### ✅ credits
- `id`, `user_id`, `position`, `production`
- `production_date`, `created_at`

#### ✅ availability
- `id`, `user_id`, `start_date`, `end_date`
- `is_available`, `notes`
- `created_at`, `updated_at`

#### ✅ filmmaker_applications
- `id`, `user_id`, `full_name`, `email`
- `experience_level`, `department`
- `portfolio_url`, `why_join`, `status`
- `created_at`, `updated_at`

#### ✅ partner_applications
- `id`, `company_name`, `contact_name`
- `email`, `website`, `partnership_type`
- `description`, `status`
- `created_at`, `updated_at`

---

## Required Supabase RPC Functions

If these don't exist, you can create them from the migration files:

1. **`get_user_conversations(user_id UUID)`** - Get user's conversations with metadata
2. **`get_or_create_conversation(user1_id UUID, user2_id UUID)`** - Find or create conversation
3. **`increment_thread_replies(thread_id UUID)`** - Increment forum thread replies
4. **`decrement_thread_replies(thread_id UUID)`** - Decrement forum thread replies

To check if these exist:
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_type = 'FUNCTION' 
AND routine_schema = 'public';
```

---

## When to Run Migrations

**Run the migration files IF:**
- ❌ You're setting up a brand new database
- ❌ Your tables are missing required columns
- ❌ You need to add RPC functions
- ❌ You want to set up development/staging environment

**DON'T run migrations IF:**
- ✅ Your existing database already has all these tables
- ✅ Your current setup is working fine
- ✅ You're using your production Supabase instance

---

## Migration Files Location

If you do need to run migrations:
```
~/second-watch-network/database/migrations/
├── 001_core_tables.sql          # Core tables
├── 002_forum_tables.sql         # Forum & categories
├── 003_messaging_tables.sql     # Conversations & messages
├── 004_notifications_connections.sql  # Notifications & connections
└── 005_row_level_security.sql   # RLS policies
```

Run them in Supabase SQL Editor in order (001 → 005).

---

## Quick Test

To verify your database works with the API, try these endpoints:

```bash
# Health check
curl http://localhost:8000/health

# List forum categories
curl http://localhost:8000/api/v1/forum/categories

# Get API documentation
open http://localhost:8000/docs
```

If these work, your database is properly configured! ✅
