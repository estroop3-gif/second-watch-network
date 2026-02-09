-- Migration 220: CRM Email Features (20 Feature Pack)
-- Starred threads, snooze, soft delete, assignments, scheduled sends,
-- template tracking, attachment bucket, quick replies, labels, internal notes,
-- open tracking, sequences, AI usage tracking

-- === Starred Threads (Feature 4) ===
ALTER TABLE crm_email_threads ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_crm_email_threads_starred ON crm_email_threads(account_id, is_starred) WHERE is_starred = true;

-- === Snooze (Feature 5) ===
ALTER TABLE crm_email_threads ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_crm_email_threads_snoozed ON crm_email_threads(snoozed_until) WHERE snoozed_until IS NOT NULL;

-- === Soft Delete for Bulk Actions (Feature 7) ===
ALTER TABLE crm_email_threads ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- === Thread Assignment (Feature 14) ===
ALTER TABLE crm_email_threads ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id);
CREATE INDEX IF NOT EXISTS idx_crm_email_threads_assigned ON crm_email_threads(assigned_to);

-- === Scheduled Sends (Feature 2) ===
ALTER TABLE crm_email_messages ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_crm_email_messages_scheduled ON crm_email_messages(scheduled_at) WHERE scheduled_at IS NOT NULL AND status = 'scheduled';

-- === Template tracking (Feature 11) ===
ALTER TABLE crm_email_messages ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES crm_email_templates(id);

-- === Attachment bucket column (Feature 1) ===
ALTER TABLE crm_email_attachments ADD COLUMN IF NOT EXISTS s3_bucket TEXT DEFAULT 'swn-backlot-files-517220555400';
CREATE INDEX IF NOT EXISTS idx_crm_email_attachments_message ON crm_email_attachments(message_id);

-- === Quick Replies (Feature 9) ===
CREATE TABLE IF NOT EXISTS crm_email_quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT,
  sort_order INT DEFAULT 0,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_quick_replies_profile ON crm_email_quick_replies(profile_id, sort_order);
INSERT INTO crm_email_quick_replies (profile_id, title, body_text, body_html, is_system, sort_order) VALUES
  (NULL, 'Thanks, will follow up', 'Thanks for reaching out! I''ll review this and follow up shortly.', '<p>Thanks for reaching out! I''ll review this and follow up shortly.</p>', true, 1),
  (NULL, 'Scheduling a call', 'I''d love to set up a time to discuss this further. What does your availability look like this week?', '<p>I''d love to set up a time to discuss this further. What does your availability look like this week?</p>', true, 2),
  (NULL, 'Sending info', 'Great question! I''m putting together some information for you and will send it over shortly.', '<p>Great question! I''m putting together some information for you and will send it over shortly.</p>', true, 3)
ON CONFLICT DO NOTHING;

-- === Labels/Tags (Feature 10) ===
CREATE TABLE IF NOT EXISTS crm_email_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES crm_email_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6B7280',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, name)
);
CREATE TABLE IF NOT EXISTS crm_email_thread_labels (
  thread_id UUID NOT NULL REFERENCES crm_email_threads(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES crm_email_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (thread_id, label_id)
);
CREATE INDEX IF NOT EXISTS idx_crm_thread_labels_label ON crm_email_thread_labels(label_id);

-- === Internal Notes (Feature 14) ===
CREATE TABLE IF NOT EXISTS crm_email_internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES crm_email_threads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_email_notes_thread ON crm_email_internal_notes(thread_id, created_at);

-- === Open Tracking (Feature 15) ===
CREATE TABLE IF NOT EXISTS crm_email_opens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES crm_email_messages(id) ON DELETE CASCADE,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_crm_email_opens_message ON crm_email_opens(message_id, opened_at);

-- === Email Sequences (Feature 12) ===
CREATE TABLE IF NOT EXISTS crm_email_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS crm_email_sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES crm_email_sequences(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  delay_days INT NOT NULL DEFAULT 0,
  template_id UUID REFERENCES crm_email_templates(id),
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sequence_id, step_number)
);
CREATE INDEX IF NOT EXISTS idx_crm_seq_steps ON crm_email_sequence_steps(sequence_id, step_number);
CREATE TABLE IF NOT EXISTS crm_email_sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES crm_email_sequences(id),
  contact_id UUID NOT NULL REFERENCES crm_contacts(id),
  account_id UUID NOT NULL REFERENCES crm_email_accounts(id),
  current_step INT DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','replied','unsubscribed','error')),
  next_send_at TIMESTAMPTZ,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  enrolled_by UUID NOT NULL REFERENCES profiles(id),
  completed_at TIMESTAMPTZ,
  UNIQUE(sequence_id, contact_id)
);
CREATE INDEX IF NOT EXISTS idx_crm_seq_enrollments_next ON crm_email_sequence_enrollments(next_send_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_crm_seq_enrollments_contact ON crm_email_sequence_enrollments(contact_id);

-- === AI Usage Tracking (Feature 13) ===
CREATE TABLE IF NOT EXISTS crm_ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id),
  feature TEXT NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_ai_usage_daily ON crm_ai_usage(profile_id, used_at);
