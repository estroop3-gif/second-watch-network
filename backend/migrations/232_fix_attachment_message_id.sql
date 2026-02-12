-- Migration 232: Allow NULL message_id on crm_email_attachments
-- Attachments are uploaded before a message exists (presigned S3 URL flow),
-- then linked to a message_id when the email is actually sent.

ALTER TABLE crm_email_attachments ALTER COLUMN message_id DROP NOT NULL;
