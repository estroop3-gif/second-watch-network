/**
 * Gear Marketplace Date Range Filters - Manual Inspection Test
 *
 * This test captures screenshots at key points for manual inspection.
 * It's designed to work even if automated navigation fails.
 *
 * MANUAL TESTING INSTRUCTIONS:
 * ============================
 *
 * 1. Start the frontend: npm run dev
 * 2. Open http://localhost:8080 in a browser
 * 3. Log in with a valid account
 * 4. Navigate to: Gear House → Select an organization → Marketplace tab
 * 5. Verify date filters are visible in the toolbar (when "Rentals" mode is active)
 * 6. Test entering dates and clearing dates
 * 7. Switch to "For Sale" mode and verify date filters disappear
 * 8. Go to "Rental Houses" tab
 * 9. Click on a rental house card
 * 10. Verify date filters appear in the drawer below the search bar
 *
 * This automated test will attempt to capture screenshots at each step.
 */

import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots/marketplace-manual');

function ensureScreenshotsDir() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
}

async function capturePageState(page: Page, filename: string, description: string) {
  const filepath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`✓ Screenshot: ${filename} - ${description}`);
}

test.describe('Gear Marketplace Date Filters - Manual Inspection', () => {
  test('should capture current state for manual inspection', async ({ page }) => {
    ensureScreenshotsDir();
    test.setTimeout(120000);

    console.log('\n' + '='.repeat(70));
    console.log('GEAR MARKETPLACE DATE FILTERS - MANUAL INSPECTION TEST');
    console.log('='.repeat(70) + '\n');

    console.log('This test will capture screenshots for manual inspection.');
    console.log('Please follow along and verify the date filters visually.\n');

    // Step 1: Load homepage
    console.log('Step 1: Loading homepage...');
    await page.goto('http://localhost:8080');
    await page.waitForLoadState('networkidle');
    await capturePageState(page, '01-homepage.png', 'Homepage loaded');

    // Step 2: Check if logged in
    console.log('\nStep 2: Checking authentication status...');
    const isLoggedIn = await page.locator('text="Dashboard"').isVisible({ timeout: 2000 }).catch(() => false);

    if (!isLoggedIn) {
      console.log('⚠️  NOT LOGGED IN');
      console.log('\nMANUAL STEPS REQUIRED:');
      console.log('1. The browser window should be open now');
      console.log('2. Click "Login" and log in with your credentials');
      console.log('3. After logging in, press ENTER in this terminal to continue...\n');

      // Keep the browser open and wait
      await page.pause();
    } else {
      console.log('✓ Already logged in');
    }

    await capturePageState(page, '02-after-login.png', 'After login');

    // Step 3: Navigate to Gear
    console.log('\nStep 3: Navigating to Gear section...');
    console.log('Manual step: Click on "Gear" in the navigation menu');

    const gearLink = page.locator('a[href="/gear"]').or(page.locator('text="Gear"').first());
    const foundGearLink = await gearLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (foundGearLink) {
      await gearLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      console.log('✓ Clicked Gear link');
    } else {
      console.log('⚠️  Could not find Gear link automatically');
      console.log('Manual step: Navigate to Gear section manually, then press ENTER');
      await page.pause();
    }

    await capturePageState(page, '03-gear-page.png', 'Gear House page');

    // Step 4: Select an organization
    console.log('\nStep 4: Selecting an organization...');
    console.log('Manual step: Click on an organization card');

    // Look for organization cards
    const orgCards = page.locator('[class*="cursor-pointer"]').filter({ has: page.locator('text=/gear house/i') });
    const orgCount = await orgCards.count().catch(() => 0);

    if (orgCount > 0) {
      await orgCards.first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      console.log('✓ Clicked organization card');
    } else {
      console.log('⚠️  No organization cards found');
      console.log('Manual step: Click on an organization, then press ENTER');
      await page.pause();
    }

    await capturePageState(page, '04-gear-workspace.png', 'Gear workspace');

    // Step 5: Navigate to Marketplace tab
    console.log('\nStep 5: Navigating to Marketplace tab...');

    const marketplaceTab = page.locator('button:has-text("Marketplace")');
    const foundMarketplace = await marketplaceTab.isVisible({ timeout: 5000 }).catch(() => false);

    if (foundMarketplace) {
      await marketplaceTab.click();
      await page.waitForTimeout(1500);
      console.log('✓ Clicked Marketplace tab');
    } else {
      console.log('⚠️  Marketplace tab not found');
      console.log('Manual step: Click Marketplace tab, then press ENTER');
      await page.pause();
    }

    await capturePageState(page, '05-marketplace-initial.png', 'Marketplace view - initial state');

    // Step 6: Check for Browse tab and Rentals mode
    console.log('\nStep 6: Verifying Browse tab and Rentals mode...');

    const browseTab = page.locator('button:has-text("Browse")');
    if (await browseTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await browseTab.click();
      await page.waitForTimeout(500);
      console.log('✓ Clicked Browse tab');
    }

    const rentalsButton = page.locator('button:has-text("Rentals")');
    if (await rentalsButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rentalsButton.click();
      await page.waitForTimeout(500);
      console.log('✓ Clicked Rentals button');
    }

    await capturePageState(page, '06-rentals-mode-active.png', 'Rentals mode active');

    // Step 7: Analyze date filter visibility
    console.log('\n' + '='.repeat(70));
    console.log('ANALYZING DATE FILTER VISIBILITY IN TOOLBAR');
    console.log('='.repeat(70) + '\n');

    const dateInputs = page.locator('input[type="date"]');
    const dateCount = await dateInputs.count();

    console.log(`Date inputs found: ${dateCount}`);

    if (dateCount >= 2) {
      console.log('✅ SUCCESS: Found date input fields in toolbar!');
      console.log('Location: Should be visible in the toolbar area');
      console.log('Expected: 2 date inputs (From and To) with a Clear button');

      // Test entering dates
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const fromDate = tomorrow.toISOString().split('T')[0];

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const toDate = nextWeek.toISOString().split('T')[0];

      await dateInputs.nth(0).fill(fromDate);
      await dateInputs.nth(1).fill(toDate);
      await page.waitForTimeout(500);

      await capturePageState(page, '07-dates-entered.png', 'Date range entered');
      console.log(`✓ Entered date range: ${fromDate} to ${toDate}`);

      // Look for clear button
      const clearButton = page.locator('button').filter({ hasText: /clear/i });
      if (await clearButton.count() > 0) {
        console.log('✓ Clear button found');
      }
    } else {
      console.log('❌ ISSUE DETECTED: Date inputs NOT FOUND or incomplete');
      console.log(`   Expected: 2 date inputs`);
      console.log(`   Found: ${dateCount} date inputs`);
    }

    // Step 8: Test For Sale mode
    console.log('\nStep 7: Testing "For Sale" mode...');

    const forSaleButton = page.locator('button:has-text("For Sale")');
    if (await forSaleButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await forSaleButton.click();
      await page.waitForTimeout(1000);
      console.log('✓ Switched to "For Sale" mode');

      await capturePageState(page, '08-for-sale-mode.png', 'For Sale mode - dates should be hidden');

      const saleModeInputs = await page.locator('input[type="date"]').count();
      if (saleModeInputs === 0) {
        console.log('✅ Correct: Date filters hidden in "For Sale" mode');
      } else {
        console.log('⚠️  Issue: Date filters still visible in "For Sale" mode');
      }
    }

    // Step 9: Test GearHouseDrawer
    console.log('\n' + '='.repeat(70));
    console.log('TESTING GEARHOUSEDRAWER DATE FILTERS');
    console.log('='.repeat(70) + '\n');

    console.log('Step 8: Navigating to Rental Houses tab...');

    const rentalHousesTab = page.locator('button:has-text("Rental Houses")');
    if (await rentalHousesTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rentalHousesTab.click();
      await page.waitForTimeout(1000);
      console.log('✓ Clicked Rental Houses tab');

      await capturePageState(page, '09-rental-houses-tab.png', 'Rental Houses tab');

      // Find and click a rental house card
      const houseCards = page.locator('[class*="cursor-pointer"]');
      const houseCount = await houseCards.count();

      if (houseCount > 0) {
        console.log(`Found ${houseCount} rental house card(s)`);
        await houseCards.first().click();
        await page.waitForTimeout(1500);
        console.log('✓ Opened rental house drawer');

        await capturePageState(page, '10-drawer-opened.png', 'Gear House drawer opened');

        // Check for date inputs in drawer
        const drawer = page.locator('[role="dialog"]');
        const drawerDateInputs = drawer.locator('input[type="date"]');
        const drawerDateCount = await drawerDateInputs.count();

        console.log(`\nDate inputs in drawer: ${drawerDateCount}`);

        if (drawerDateCount >= 2) {
          console.log('✅ SUCCESS: Found date filters in GearHouseDrawer!');
          console.log('Location: Below search bar and category dropdown');

          // Test entering dates in drawer
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 2);
          const fromDate = tomorrow.toISOString().split('T')[0];

          const nextWeek = new Date();
          nextWeek.setDate(nextWeek.getDate() + 10);
          const toDate = nextWeek.toISOString().split('T')[0];

          await drawerDateInputs.nth(0).fill(fromDate);
          await drawerDateInputs.nth(1).fill(toDate);
          await page.waitForTimeout(500);

          await capturePageState(page, '11-drawer-dates-entered.png', 'Dates entered in drawer');
          console.log(`✓ Entered dates in drawer: ${fromDate} to ${toDate}`);
        } else {
          console.log('❌ ISSUE: Date filters NOT FOUND in GearHouseDrawer');
          console.log(`   Expected: 2 date inputs`);
          console.log(`   Found: ${drawerDateCount}`);
        }
      } else {
        console.log('⚠️  No rental house cards found');
      }
    }

    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('TEST SUMMARY');
    console.log('='.repeat(70) + '\n');

    const toolbarDateInputs = await page.locator('body').locator('input[type="date"]').count();

    console.log('Screenshots saved to:');
    console.log(`  ${SCREENSHOTS_DIR}\n`);

    console.log('VERIFICATION CHECKLIST:');
    console.log('[ ] Date filters visible in MarketplaceView toolbar (Rentals mode)');
    console.log('[ ] Date filters have "From" and "To" inputs');
    console.log('[ ] Clear button appears after entering dates');
    console.log('[ ] Date filters hidden in "For Sale" mode');
    console.log('[ ] Date filters visible in GearHouseDrawer');
    console.log('[ ] Dates can be entered and cleared successfully');
    console.log('[ ] No JavaScript console errors\n');

    console.log('Review the screenshots to verify all features are working correctly.');
    console.log('='.repeat(70) + '\n');
  });
});
