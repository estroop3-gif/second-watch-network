-- Story Character to Contact Linking
-- Links story characters to project contacts (similar to how subjects work)

-- Add contact_id to story characters
ALTER TABLE backlot_story_characters
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES backlot_project_contacts(id) ON DELETE SET NULL;

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_story_characters_contact ON backlot_story_characters(contact_id);

-- When a character is linked to a contact, we can display contact info
-- The contact's name, email, phone can be shown alongside the character
