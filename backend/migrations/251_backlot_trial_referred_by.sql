ALTER TABLE backlot_trial_requests
ADD COLUMN IF NOT EXISTS referred_by_rep_id UUID REFERENCES profiles(id);
