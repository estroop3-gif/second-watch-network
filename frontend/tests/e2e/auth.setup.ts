import { test as setup, expect } from '@playwright/test';

/**
 * Playwright Authentication Setup
 *
 * Set your test credentials via environment variables:
 *   PLAYWRIGHT_TEST_EMAIL=your-email@example.com
 *   PLAYWRIGHT_TEST_PASSWORD=your-password
 *
 * Or create a .env.playwright file in the frontend directory with these values.
 *
 * Example:
 *   export PLAYWRIGHT_TEST_EMAIL="myemail@gmail.com"
 *   export PLAYWRIGHT_TEST_PASSWORD="MyPassword123"
 *   npx playwright test
 */

const TEST_USER = {
  email: process.env.PLAYWRIGHT_TEST_EMAIL || 'estroop3@gmail.com',
  password: process.env.PLAYWRIGHT_TEST_PASSWORD || 'Parkera1bc!',
};

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  console.log('Authenticating with:', TEST_USER.email);

  // Navigate to login page
  await page.goto('/login');

  // Wait for the login form to be visible
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });

  // Fill in credentials
  await page.fill('input[type="email"], input[name="email"]', TEST_USER.email);
  await page.fill('input[type="password"], input[name="password"]', TEST_USER.password);

  // Click login button
  await page.click('button[type="submit"]');

  // Wait for successful login - should redirect to dashboard or home
  await page.waitForURL(/\/(dashboard|home|backlot|onboarding)/, { timeout: 15000 });

  // Verify we're logged in by checking for user-specific elements
  await expect(page.locator('body')).not.toContainText('Sign In');

  // Save the authentication state
  await page.context().storageState({ path: authFile });

  console.log('Authentication successful, state saved to:', authFile);
});

// Export credentials for use in other tests
export { TEST_USER };
