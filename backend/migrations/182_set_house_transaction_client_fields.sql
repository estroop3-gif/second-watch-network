-- Add client contact fields to set_house_transactions
-- This allows tracking client information directly on transactions/bookings

ALTER TABLE set_house_transactions
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS client_email TEXT,
  ADD COLUMN IF NOT EXISTS client_phone TEXT;

COMMENT ON COLUMN set_house_transactions.client_name IS 'Client/renter name for this booking';
COMMENT ON COLUMN set_house_transactions.client_email IS 'Client/renter email for this booking';
COMMENT ON COLUMN set_house_transactions.client_phone IS 'Client/renter phone for this booking';
