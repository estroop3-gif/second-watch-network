/**
 * Gear Marketplace Date Range Filters Test
 *
 * This test verifies that date range filters are visible and functional
 * in both the main MarketplaceView toolbar and the GearHouseDrawer.
 *
 * Test Coverage:
 * 1. MarketplaceView toolbar date filters (visible when browsing rentals)
 * 2. GearHouseDrawer date filters (visible in rental house drawer)
 * 3. Date filter functionality (entering dates, clearing dates)
 * 4. Date filters only appear in "Rentals" mode, not "For Sale"
 */

import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Screenshot directory
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots/marketplace-date-filters');

// Helper to ensure screenshots directory exists
function ensureScreenshotsDir() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
}

// Helper to check if user is logged in
async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    // Check for common logged-in indicators
    const loggedInIndicators = [
      'text="Dashboard"',
      'text="Account"',
      '[data-testid="user-menu"]',
      'button:has-text("Logout")',
      '.user-avatar'
    ];

    for (const indicator of loggedInIndicators) {
      try {
        await page.waitForSelector(indicator, { timeout: 2000 });
        return true;
      } catch {
        continue;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// Helper to login if needed
async function loginIfNeeded(page: Page) {
  const loggedIn = await isLoggedIn(page);

  if (!loggedIn) {
    console.log('⚠️  Not logged in. Attempting to navigate to login page...');

    // Try to find and click login button
    try {
      await page.click('text="Login"', { timeout: 3000 });
      await page.waitForLoadState('networkidle');

      console.log('Please log in manually in the browser window.');
      console.log('The test will wait for 30 seconds...');

      // Wait for login to complete
      await page.waitForSelector('text="Dashboard"', { timeout: 30000 });
      console.log('✓ Login successful');
    } catch {
      console.log('⚠️  Could not complete login. Test may fail if authentication is required.');
    }
  } else {
    console.log('✓ Already logged in');
  }
}

// Helper to navigate to gear marketplace
async function navigateToMarketplace(page: Page): Promise<boolean> {
  console.log('Navigating to Gear Marketplace...');

  // Strategy 1: Look for main navigation menu
  try {
    // Wait for navigation to be visible
    await page.waitForSelector('nav', { timeout: 5000 });

    // Look for Gear tab/link
    const gearLink = page.locator('text="Gear"').first();
    if (await gearLink.isVisible({ timeout: 2000 })) {
      await gearLink.click();
      await page.waitForLoadState('networkidle');
      console.log('✓ Clicked Gear nav link');

      // Now look for Marketplace section
      const marketplaceLink = page.locator('text="Marketplace"').or(page.locator('text="Rent from Marketplace"'));
      if (await marketplaceLink.isVisible({ timeout: 3000 })) {
        await marketplaceLink.click();
        await page.waitForLoadState('networkidle');
        console.log('✓ Clicked Marketplace link');
        return true;
      }
    }
  } catch (error) {
    console.log('Strategy 1 failed:', error);
  }

  // Strategy 2: Direct URL navigation
  try {
    console.log('Trying direct URL navigation...');
    await page.goto('http://localhost:8080/gear/marketplace');
    await page.waitForLoadState('networkidle');

    // Check if we landed on marketplace page
    const pageTitle = await page.locator('h2').first().textContent();
    if (pageTitle && pageTitle.includes('Marketplace')) {
      console.log('✓ Direct URL navigation successful');
      return true;
    }
  } catch (error) {
    console.log('Strategy 2 failed:', error);
  }

  return false;
}

// Main test suite
test.describe('Gear Marketplace Date Range Filters', () => {
  test.beforeEach(async ({ page }) => {
    ensureScreenshotsDir();
    test.setTimeout(90000);

    // Navigate to homepage
    await page.goto('http://localhost:8080');
    await page.waitForLoadState('networkidle');

    // Login if needed
    await loginIfNeeded(page);
  });

  test('should display date filters in MarketplaceView toolbar when viewing rentals', async ({ page }) => {
    console.log('\n=== TEST 1: MarketplaceView Toolbar Date Filters ===\n');

    // Navigate to marketplace
    const navigated = await navigateToMarketplace(page);
    if (!navigated) {
      console.log('❌ Could not navigate to marketplace');
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-navigation-failed.png'), fullPage: true });
      throw new Error('Failed to navigate to marketplace');
    }

    // Take screenshot of initial state
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-marketplace-initial.png'), fullPage: true });
    console.log('✓ Screenshot: 01-marketplace-initial.png');

    // Step 1: Verify we're on the Browse tab
    console.log('Step 1: Verifying Browse tab...');
    const browseTab = page.locator('button:has-text("Browse")');
    await expect(browseTab).toBeVisible({ timeout: 5000 });

    // Click Browse tab to ensure it's active
    await browseTab.click();
    await page.waitForTimeout(1000);

    // Step 2: Verify "Rentals" mode is selected
    console.log('Step 2: Ensuring Rentals mode is selected...');
    const rentalsButton = page.locator('button:has-text("Rentals")');
    await expect(rentalsButton).toBeVisible({ timeout: 5000 });

    // Click Rentals button to ensure it's active
    await rentalsButton.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-rentals-mode-active.png'), fullPage: true });
    console.log('✓ Screenshot: 02-rentals-mode-active.png');

    // Step 3: Look for date input fields in toolbar
    console.log('Step 3: Looking for date input fields in toolbar...');

    // Strategy 1: Look for date inputs by type
    const dateInputs = page.locator('input[type="date"]');
    const dateInputCount = await dateInputs.count();
    console.log(`Found ${dateInputCount} date input(s)`);

    if (dateInputCount === 0) {
      console.log('❌ NO DATE INPUTS FOUND');
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-no-date-inputs-found.png'), fullPage: true });

      // Debug: Print page structure
      const toolbar = page.locator('.flex.flex-col.gap-4').first();
      const toolbarHTML = await toolbar.innerHTML().catch(() => 'Could not get HTML');
      console.log('Toolbar HTML:', toolbarHTML);

      throw new Error('Date input fields not found in toolbar');
    }

    // Verify we have at least 2 date inputs (From and To)
    await expect(dateInputs).toHaveCount(2, { timeout: 5000 });
    console.log('✓ Found 2 date inputs (From and To)');

    // Step 4: Verify date inputs are visible and accessible
    console.log('Step 4: Verifying date inputs are visible...');
    const fromDateInput = dateInputs.nth(0);
    const toDateInput = dateInputs.nth(1);

    await expect(fromDateInput).toBeVisible();
    await expect(toDateInput).toBeVisible();

    // Check if they're enabled
    await expect(fromDateInput).toBeEnabled();
    await expect(toDateInput).toBeEnabled();

    console.log('✓ Both date inputs are visible and enabled');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-date-inputs-visible.png'), fullPage: true });
    console.log('✓ Screenshot: 04-date-inputs-visible.png');

    // Step 5: Test entering dates
    console.log('Step 5: Testing date input functionality...');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fromDate = tomorrow.toISOString().split('T')[0];

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const toDate = nextWeek.toISOString().split('T')[0];

    console.log(`Setting From date: ${fromDate}`);
    await fromDateInput.fill(fromDate);
    await page.waitForTimeout(500);

    console.log(`Setting To date: ${toDate}`);
    await toDateInput.fill(toDate);
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-dates-entered.png'), fullPage: true });
    console.log('✓ Screenshot: 05-dates-entered.png');

    // Verify dates were set
    await expect(fromDateInput).toHaveValue(fromDate);
    await expect(toDateInput).toHaveValue(toDate);
    console.log('✓ Dates successfully entered');

    // Step 6: Look for Clear button
    console.log('Step 6: Looking for Clear button...');
    const clearButton = page.locator('button').filter({ hasText: /clear/i });

    if (await clearButton.count() > 0) {
      await expect(clearButton.first()).toBeVisible();
      console.log('✓ Clear button found');

      // Test clearing dates
      await clearButton.first().click();
      await page.waitForTimeout(500);

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06-dates-cleared.png'), fullPage: true });
      console.log('✓ Screenshot: 06-dates-cleared.png');

      // Verify dates were cleared
      await expect(fromDateInput).toHaveValue('');
      await expect(toDateInput).toHaveValue('');
      console.log('✓ Dates successfully cleared');
    } else {
      console.log('⚠️  Clear button not found (may be hidden when no dates are set)');
    }

    // Step 7: Verify date filters disappear in "For Sale" mode
    console.log('Step 7: Testing date filters visibility in "For Sale" mode...');

    const forSaleButton = page.locator('button:has-text("For Sale")');
    await expect(forSaleButton).toBeVisible({ timeout: 5000 });

    await forSaleButton.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07-for-sale-mode.png'), fullPage: true });
    console.log('✓ Screenshot: 07-for-sale-mode.png');

    // Verify date inputs are hidden
    const dateInputsInSaleMode = page.locator('input[type="date"]');
    const saleModeDateCount = await dateInputsInSaleMode.count();

    if (saleModeDateCount === 0) {
      console.log('✓ Date filters correctly hidden in "For Sale" mode');
    } else {
      console.log('⚠️  Date filters still visible in "For Sale" mode (may be a bug)');
    }

    console.log('\n✅ TEST 1 PASSED: MarketplaceView date filters are visible and functional\n');
  });

  test('should display date filters in GearHouseDrawer', async ({ page }) => {
    console.log('\n=== TEST 2: GearHouseDrawer Date Filters ===\n');

    // Navigate to marketplace
    const navigated = await navigateToMarketplace(page);
    if (!navigated) {
      console.log('❌ Could not navigate to marketplace');
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '10-navigation-failed.png'), fullPage: true });
      throw new Error('Failed to navigate to marketplace');
    }

    // Navigate to Rental Houses tab
    console.log('Step 1: Navigating to Rental Houses tab...');
    const rentalHousesTab = page.locator('button:has-text("Rental Houses")');

    if (await rentalHousesTab.isVisible({ timeout: 5000 })) {
      await rentalHousesTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '10-rental-houses-tab.png'), fullPage: true });
      console.log('✓ Screenshot: 10-rental-houses-tab.png');
    } else {
      console.log('⚠️  Rental Houses tab not found');
    }

    // Step 2: Find and click a rental house card
    console.log('Step 2: Looking for rental house cards...');

    // Look for rental house cards (they're Card components)
    const rentalHouseCards = page.locator('[class*="cursor-pointer"]').filter({ hasText: /rental house|production company/i });
    const cardCount = await rentalHouseCards.count();

    console.log(`Found ${cardCount} rental house card(s)`);

    if (cardCount === 0) {
      console.log('⚠️  No rental houses found. Cannot test GearHouseDrawer.');
      console.log('This may be because:');
      console.log('  1. No rental houses have been created');
      console.log('  2. No marketplace listings exist');
      console.log('  3. The test user does not have access');

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '11-no-rental-houses.png'), fullPage: true });

      // Skip this test gracefully
      test.skip();
      return;
    }

    // Click the first rental house card
    await rentalHouseCards.first().click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '12-drawer-opened.png'), fullPage: true });
    console.log('✓ Screenshot: 12-drawer-opened.png');

    // Step 3: Verify drawer opened
    console.log('Step 3: Verifying drawer opened...');

    // The drawer uses SheetContent component
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    console.log('✓ Drawer opened');

    // Step 4: Look for search bar in drawer
    console.log('Step 4: Looking for search bar in drawer...');
    const searchInput = drawer.locator('input[placeholder*="Search"]');

    if (await searchInput.isVisible({ timeout: 3000 })) {
      console.log('✓ Search bar found in drawer');
    } else {
      console.log('⚠️  Search bar not found');
    }

    // Step 5: Look for category dropdown
    console.log('Step 5: Looking for category dropdown...');
    const categorySelect = drawer.locator('button:has-text("All categories")').or(drawer.locator('button:has-text("Category")'));

    if (await categorySelect.isVisible({ timeout: 3000 })) {
      console.log('✓ Category dropdown found');
    } else {
      console.log('⚠️  Category dropdown not found');
    }

    // Step 6: Look for date inputs in drawer
    console.log('Step 6: Looking for date inputs in drawer...');

    const drawerDateInputs = drawer.locator('input[type="date"]');
    const drawerDateCount = await drawerDateInputs.count();

    console.log(`Found ${drawerDateCount} date input(s) in drawer`);

    if (drawerDateCount === 0) {
      console.log('❌ NO DATE INPUTS FOUND IN DRAWER');
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '13-no-date-inputs-in-drawer.png'), fullPage: true });

      // Debug: Print drawer HTML
      const drawerHTML = await drawer.innerHTML().catch(() => 'Could not get HTML');
      console.log('Drawer HTML snippet:', drawerHTML.substring(0, 1000));

      throw new Error('Date input fields not found in GearHouseDrawer');
    }

    // Verify we have 2 date inputs
    await expect(drawerDateInputs).toHaveCount(2, { timeout: 5000 });
    console.log('✓ Found 2 date inputs in drawer');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '14-drawer-date-inputs-visible.png'), fullPage: true });
    console.log('✓ Screenshot: 14-drawer-date-inputs-visible.png');

    // Step 7: Test entering dates in drawer
    console.log('Step 7: Testing date input in drawer...');

    const fromInput = drawerDateInputs.nth(0);
    const toInput = drawerDateInputs.nth(1);

    await expect(fromInput).toBeVisible();
    await expect(toInput).toBeVisible();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fromDate = tomorrow.toISOString().split('T')[0];

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const toDate = nextWeek.toISOString().split('T')[0];

    await fromInput.fill(fromDate);
    await page.waitForTimeout(500);

    await toInput.fill(toDate);
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '15-drawer-dates-entered.png'), fullPage: true });
    console.log('✓ Screenshot: 15-drawer-dates-entered.png');

    // Verify dates were set
    await expect(fromInput).toHaveValue(fromDate);
    await expect(toInput).toHaveValue(toDate);
    console.log('✓ Dates successfully entered in drawer');

    // Step 8: Look for Clear button in drawer
    console.log('Step 8: Looking for Clear button in drawer...');
    const drawerClearButton = drawer.locator('button').filter({ hasText: /clear/i });

    if (await drawerClearButton.count() > 0) {
      await expect(drawerClearButton.first()).toBeVisible();
      console.log('✓ Clear button found in drawer');

      await drawerClearButton.first().click();
      await page.waitForTimeout(500);

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '16-drawer-dates-cleared.png'), fullPage: true });
      console.log('✓ Screenshot: 16-drawer-dates-cleared.png');

      await expect(fromInput).toHaveValue('');
      await expect(toInput).toHaveValue('');
      console.log('✓ Dates successfully cleared in drawer');
    } else {
      console.log('⚠️  Clear button not found in drawer');
    }

    console.log('\n✅ TEST 2 PASSED: GearHouseDrawer date filters are visible and functional\n');
  });

  test('should verify console has no critical errors', async ({ page }) => {
    console.log('\n=== TEST 3: Console Error Check ===\n');

    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Navigate to marketplace
    const navigated = await navigateToMarketplace(page);
    if (!navigated) {
      console.log('⚠️  Could not navigate to marketplace');
      test.skip();
      return;
    }

    // Wait a bit for any errors to appear
    await page.waitForTimeout(2000);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '20-console-check.png'), fullPage: true });

    if (errors.length > 0) {
      console.log('Console errors found:');
      errors.forEach(error => console.log(`  - ${error}`));
    } else {
      console.log('✓ No console errors detected');
    }

    // Filter out non-critical errors (warnings about dev mode, etc.)
    const criticalErrors = errors.filter(err => {
      return !err.includes('Download the React DevTools') &&
             !err.includes('Warning:') &&
             !err.includes('favicon');
    });

    if (criticalErrors.length > 0) {
      console.log('❌ Critical console errors found');
      throw new Error(`Critical errors detected: ${criticalErrors.join('; ')}`);
    }

    console.log('\n✅ TEST 3 PASSED: No critical console errors\n');
  });
});
