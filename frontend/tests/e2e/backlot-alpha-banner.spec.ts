/**
 * E2E Test: Backlot Sidebar and Alpha Tester Banner Overlap Issue
 *
 * ISSUE: The backlot sidebar is clipping/overlapping the alpha tester banner at the bottom
 *
 * ROOT CAUSE:
 * - The sidebar has `h-[calc(100vh-8.5rem)]` which extends to the bottom of the viewport
 * - The AlphaTesterBanner is `fixed bottom-0` with ~56px height
 * - The sidebar doesn't account for the banner height
 *
 * EXPECTED BEHAVIOR:
 * 1. Sidebar should stop above the alpha tester banner
 * 2. Alpha banner should be fully visible without any clipping
 * 3. Sidebar navigation should still be scrollable if content overflows
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'poboy3tv@gmail.com';
const TEST_PASSWORD = 'Parkera1bc!';
const BASE_URL = 'http://localhost:8081';

// Use Firefox browser since Chromium has dependency issues
test.use({ browserName: 'firefox' });

test.describe('Backlot Sidebar - Alpha Banner Overlap Fix', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`Console Error: ${msg.text()}`);
      }
    });

    page.on('pageerror', error => {
      console.log(`Page Error: ${error.message}`);
    });
  });

  test('should log in and navigate to backlot to capture the issue', async ({ page }) => {
    // Navigate to login page directly
    console.log('Navigating to login page...');
    await page.goto(`${BASE_URL}/login`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForTimeout(1000);

    // Take screenshot of login page
    await page.screenshot({
      path: 'test-results/01-login-page.png',
      fullPage: false
    });

    // Look for email input field
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i], input#email').first();
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });

    console.log('Filling email...');
    await emailInput.fill(TEST_EMAIL);

    // Fill password
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill(TEST_PASSWORD);

    // Take screenshot before clicking login
    await page.screenshot({
      path: 'test-results/02-login-form-filled.png',
      fullPage: false
    });

    // Submit the form
    console.log('Clicking sign in...');
    const submitButton = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In")').first();
    await submitButton.click();

    // Wait for navigation after login
    await page.waitForURL('**/*', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Take screenshot after login
    await page.screenshot({
      path: 'test-results/03-after-login.png',
      fullPage: false
    });

    console.log('Current URL after login:', page.url());

    // Navigate to backlot
    console.log('Navigating to backlot...');
    await page.goto(`${BASE_URL}/backlot`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForTimeout(2000);

    // Take screenshot of backlot home
    await page.screenshot({
      path: 'test-results/04-backlot-home.png',
      fullPage: false
    });

    console.log('Current URL at backlot:', page.url());

    // Look for any project card/link to click
    const projectCards = page.locator('a[href*="/backlot/project/"], [data-testid="project-card"], .cursor-pointer');
    const projectCount = await projectCards.count();
    console.log('Found project cards:', projectCount);

    if (projectCount > 0) {
      const firstProject = projectCards.first();
      await firstProject.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    console.log('Current URL at project:', page.url());

    // Wait for the sidebar to load
    await page.waitForTimeout(3000);

    // Take screenshot to capture the sidebar and alpha banner issue
    await page.screenshot({
      path: 'test-results/05-backlot-project-BEFORE-FIX.png',
      fullPage: false
    });

    // Check for alpha tester banner (fixed at bottom with purple background)
    const alphaBanner = page.locator('div.fixed.bottom-0:has-text("Alpha")').first();
    const hasAlphaBanner = await alphaBanner.isVisible({ timeout: 5000 }).catch(() => false);

    console.log('Alpha banner visible:', hasAlphaBanner);

    if (hasAlphaBanner) {
      const bannerBox = await alphaBanner.boundingBox();
      console.log('Alpha banner bounding box:', bannerBox);
    }

    // Check for sidebar
    const sidebar = page.locator('aside').first();
    const hasSidebar = await sidebar.isVisible({ timeout: 5000 }).catch(() => false);

    console.log('Sidebar visible:', hasSidebar);

    if (hasSidebar) {
      const sidebarBox = await sidebar.boundingBox();
      console.log('Sidebar bounding box:', sidebarBox);

      const sidebarClasses = await sidebar.getAttribute('class');
      console.log('Sidebar classes:', sidebarClasses);

      // Check if sidebar extends to viewport bottom
      if (sidebarBox) {
        const sidebarBottom = sidebarBox.y + sidebarBox.height;
        console.log('Sidebar bottom position:', sidebarBottom);
        console.log('Viewport height:', 1080);

        if (hasAlphaBanner) {
          const bannerBox = await alphaBanner.boundingBox();
          if (bannerBox) {
            const overlap = sidebarBottom - bannerBox.y;
            console.log('OVERLAP with alpha banner (positive = overlapping):', overlap);
          }
        }
      }
    }
  });

  test('should verify sidebar does not overlap alpha banner after fix', async ({ page }) => {
    // Navigate to login page directly
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    // Login
    const emailInput = page.locator('input[type="email"], input[name="email"], input#email').first();
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill(TEST_EMAIL);
    await page.locator('input[type="password"]').first().fill(TEST_PASSWORD);
    await page.locator('button[type="submit"], button:has-text("Sign In")').first().click();

    await page.waitForURL('**/*', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Navigate to backlot
    await page.goto(`${BASE_URL}/backlot`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Click on first project
    const projectCards = page.locator('a[href*="/backlot/project/"], [data-testid="project-card"], .cursor-pointer');
    if (await projectCards.count() > 0) {
      await projectCards.first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    // Check sidebar and alpha banner positions
    const sidebar = page.locator('aside').first();
    const alphaBanner = page.locator('div.fixed.bottom-0:has-text("Alpha")').first();

    const sidebarVisible = await sidebar.isVisible().catch(() => false);
    const bannerVisible = await alphaBanner.isVisible().catch(() => false);

    console.log('Sidebar visible:', sidebarVisible);
    console.log('Banner visible:', bannerVisible);

    if (sidebarVisible && bannerVisible) {
      const sidebarBox = await sidebar.boundingBox();
      const bannerBox = await alphaBanner.boundingBox();

      console.log('Sidebar box:', sidebarBox);
      console.log('Banner box:', bannerBox);

      if (sidebarBox && bannerBox) {
        const sidebarBottom = sidebarBox.y + sidebarBox.height;
        const bannerTop = bannerBox.y;

        // The sidebar should end at or above the banner top
        const overlap = sidebarBottom - bannerTop;
        console.log('Overlap (positive = overlapping):', overlap);

        // After fix, there should be no overlap (overlap <= 0)
        expect(overlap).toBeLessThanOrEqual(0);
      }
    } else if (sidebarVisible) {
      // If only sidebar is visible (banner might be minimized), just check sidebar height
      const sidebarBox = await sidebar.boundingBox();
      console.log('Sidebar box (no banner):', sidebarBox);
    }

    // Take final screenshot
    await page.screenshot({
      path: 'test-results/06-backlot-project-AFTER-FIX.png',
      fullPage: false
    });
  });
});
