-- Add BCC addresses column to email messages
ALTER TABLE crm_email_messages
  ADD COLUMN IF NOT EXISTS bcc_addresses TEXT[] DEFAULT '{}';
