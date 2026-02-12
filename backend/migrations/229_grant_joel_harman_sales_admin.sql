-- Grant Joel Harman the sales_admin role so he can access all CRM admin features
-- including Email Tools, Campaigns, Team management, etc.

UPDATE profiles
SET is_sales_admin = true,
    updated_at = NOW()
WHERE email = 'joelharman@verizon.net';
