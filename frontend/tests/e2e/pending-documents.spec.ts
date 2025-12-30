import { test, expect } from '@playwright/test';

/**
 * Test for debugging the pending documents error on My Profile page
 */
test.describe('Pending Documents Section', () => {
  // Store console errors and network failures
  const consoleErrors: string[] = [];
  const networkErrors: { url: string; status: number; body: string }[] = [];

  test.beforeEach(async ({ page }) => {
    // Clear arrays for each test
    consoleErrors.length = 0;
    networkErrors.length = 0;

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(`Console Error: ${msg.text()}`);
        console.log(`Console Error: ${msg.text()}`);
      }
    });

    // Capture page errors
    page.on('pageerror', error => {
      consoleErrors.push(`Page Error: ${error.message}`);
      console.log(`Page Error: ${error.message}`);
    });

    // Capture network responses including errors
    page.on('response', async response => {
      const url = response.url();
      const status = response.status();

      // Log all API requests
      if (url.includes('/api/')) {
        console.log(`API Response: ${status} ${url}`);

        if (status >= 400) {
          try {
            const body = await response.text();
            networkErrors.push({ url, status, body });
            console.log(`Network Error: ${status} ${url} - ${body}`);
          } catch (e) {
            networkErrors.push({ url, status, body: 'Could not read body' });
          }
        }

        // Specifically log the pending-documents endpoint
        if (url.includes('pending-documents')) {
          try {
            const body = await response.text();
            console.log(`Pending Documents Response (${status}): ${body}`);
          } catch (e) {
            console.log(`Pending Documents Response (${status}): Could not read body`);
          }
        }
      }
    });
  });

  test('should load pending documents without errors', async ({ page }) => {
    // Use the specified URL
    const baseUrl = 'http://localhost:8081';

    // Navigate to the login page
    console.log('Navigating to login page...');
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('networkidle');

    // Take a screenshot of the login page
    await page.screenshot({ path: 'test-results/01-login-page.png' });

    // Fill in login credentials
    console.log('Filling login credentials...');

    // Wait for and fill the email field
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill('poboy3tv@gmail.com');

    // Wait for and fill the password field
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
    await passwordInput.fill('Parkera1bc!');

    // Take a screenshot after filling credentials
    await page.screenshot({ path: 'test-results/02-credentials-filled.png' });

    // Click the login/submit button
    console.log('Clicking login button...');
    const loginButton = page.locator('button[type="submit"], button:has-text("Log In"), button:has-text("Sign In"), button:has-text("Login")').first();
    await loginButton.click();

    // Wait for navigation after login
    console.log('Waiting for login to complete...');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
    await page.waitForLoadState('networkidle');

    // Take a screenshot after login
    await page.screenshot({ path: 'test-results/03-after-login.png' });
    console.log(`Current URL after login: ${page.url()}`);

    // Navigate to My Profile page
    console.log('Navigating to My Profile page...');
    await page.goto(`${baseUrl}/my-profile`);
    await page.waitForLoadState('networkidle');

    // Wait for the page to load
    await page.waitForTimeout(3000); // Give extra time for API calls

    // Take a screenshot of the profile page
    await page.screenshot({ path: 'test-results/04-my-profile-page.png' });

    // Look for the pending documents section
    console.log('Looking for Pending Documents section...');

    // Check if the error message is displayed
    const errorMessage = page.locator('text=Failed to load pending documents');
    const isErrorVisible = await errorMessage.isVisible();

    if (isErrorVisible) {
      console.log('ERROR: "Failed to load pending documents" is displayed!');
      await page.screenshot({ path: 'test-results/05-error-visible.png' });
    }

    // Check for the success state (empty list or documents)
    const allCaughtUp = page.locator('text=All caught up');
    const pendingBadge = page.locator('text=/\\d+ pending/');

    const isAllCaughtUpVisible = await allCaughtUp.isVisible();
    const hasPendingDocuments = await pendingBadge.isVisible();

    console.log('=== TEST RESULTS ===');
    console.log(`Error visible: ${isErrorVisible}`);
    console.log(`All caught up visible: ${isAllCaughtUpVisible}`);
    console.log(`Has pending documents: ${hasPendingDocuments}`);
    console.log(`Console errors: ${consoleErrors.length}`);
    console.log(`Network errors: ${networkErrors.length}`);

    // Log all captured errors
    if (consoleErrors.length > 0) {
      console.log('\n=== CONSOLE ERRORS ===');
      consoleErrors.forEach(e => console.log(e));
    }

    if (networkErrors.length > 0) {
      console.log('\n=== NETWORK ERRORS ===');
      networkErrors.forEach(e => console.log(`${e.status} ${e.url}: ${e.body}`));
    }

    // The test passes if either:
    // 1. "All caught up" is visible (empty list)
    // 2. Pending documents badge is visible (has documents)
    // The test fails if the error message is visible
    expect(isErrorVisible, 'Error message should not be visible').toBe(false);
    expect(isAllCaughtUpVisible || hasPendingDocuments, 'Should show either empty state or documents').toBe(true);
  });

  test('should capture the actual API response from pending-documents endpoint', async ({ page }) => {
    const baseUrl = 'http://localhost:8081';
    let pendingDocsResponse: { status: number; body: any } | null = null;

    // Specifically intercept the pending-documents API call
    page.on('response', async response => {
      if (response.url().includes('pending-documents')) {
        try {
          pendingDocsResponse = {
            status: response.status(),
            body: await response.json().catch(() => response.text())
          };
          console.log('Captured pending-documents response:', JSON.stringify(pendingDocsResponse, null, 2));
        } catch (e) {
          console.log('Error capturing response:', e);
        }
      }
    });

    // Login
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill('poboy3tv@gmail.com');

    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
    await passwordInput.fill('Parkera1bc!');

    const loginButton = page.locator('button[type="submit"], button:has-text("Log In"), button:has-text("Sign In"), button:has-text("Login")').first();
    await loginButton.click();

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
    await page.waitForLoadState('networkidle');

    // Navigate to profile page
    await page.goto(`${baseUrl}/my-profile`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000); // Extra wait for API call

    // Report the captured response
    console.log('\n=== PENDING DOCUMENTS API RESPONSE ===');
    if (pendingDocsResponse) {
      console.log(`Status: ${pendingDocsResponse.status}`);
      console.log(`Body: ${JSON.stringify(pendingDocsResponse.body, null, 2)}`);
    } else {
      console.log('No response captured - the API call may not have been made');
    }

    // Take final screenshot
    await page.screenshot({ path: 'test-results/api-response-capture.png' });
  });
});
