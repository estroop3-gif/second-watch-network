-- Add client company and contact foreign keys to set_house_transactions
-- This links bookings to the organization's client database

ALTER TABLE set_house_transactions
  ADD COLUMN IF NOT EXISTS client_company_id UUID REFERENCES set_house_client_companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_contact_id UUID REFERENCES set_house_client_contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_set_house_transactions_client_company ON set_house_transactions(client_company_id) WHERE client_company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_set_house_transactions_client_contact ON set_house_transactions(client_contact_id) WHERE client_contact_id IS NOT NULL;

COMMENT ON COLUMN set_house_transactions.client_company_id IS 'Link to client company for this booking';
COMMENT ON COLUMN set_house_transactions.client_contact_id IS 'Link to client contact for this booking';
