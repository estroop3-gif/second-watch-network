-- Equipment Package Verification Settings
-- Mirrors kit verification settings for equipment packages

-- Team checkout package verification
ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS team_checkout_package_verification TEXT DEFAULT 'package_only';

-- Client rental package verification
ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS client_checkout_package_verification TEXT DEFAULT 'package_only';

-- Check-in package verification
ALTER TABLE gear_organization_settings
ADD COLUMN IF NOT EXISTS checkin_package_verification TEXT DEFAULT 'package_only';

-- Values: 'package_only' | 'verify_contents'
COMMENT ON COLUMN gear_organization_settings.team_checkout_package_verification IS 'Equipment package verification mode for team checkouts: package_only or verify_contents';
COMMENT ON COLUMN gear_organization_settings.client_checkout_package_verification IS 'Equipment package verification mode for client rentals: package_only or verify_contents';
COMMENT ON COLUMN gear_organization_settings.checkin_package_verification IS 'Equipment package verification mode for check-ins: package_only or verify_contents';
