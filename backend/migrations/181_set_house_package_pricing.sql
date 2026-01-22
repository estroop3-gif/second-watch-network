-- Add pricing fields to set_house_package_instances
-- This allows packages to have their own pricing separate from individual spaces

ALTER TABLE set_house_package_instances
  ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS half_day_rate DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS daily_rate DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS weekly_rate DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS monthly_rate DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5, 2) DEFAULT 0;

COMMENT ON COLUMN set_house_package_instances.hourly_rate IS 'Package hourly rental rate';
COMMENT ON COLUMN set_house_package_instances.half_day_rate IS 'Package half-day (4hr) rental rate';
COMMENT ON COLUMN set_house_package_instances.daily_rate IS 'Package daily rental rate';
COMMENT ON COLUMN set_house_package_instances.weekly_rate IS 'Package weekly rental rate';
COMMENT ON COLUMN set_house_package_instances.monthly_rate IS 'Package monthly rental rate';
COMMENT ON COLUMN set_house_package_instances.discount_percent IS 'Discount percentage off combined space rates';
