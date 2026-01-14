/**
 * Gear Marketplace Request Title Field Test
 *
 * This test navigates to the Gear House marketplace and captures
 * screenshots of the "Request Title" field that should be investigated.
 *
 * Steps:
 * 1. Navigate to localhost:8080
 * 2. Find and click on Gear House link
 * 3. Navigate to an organization's workspace
 * 4. Click on the Marketplace tab
 * 5. Try to submit a quote/request to reveal the "Request Title" field
 * 6. Take screenshots at each step
 */

import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Screenshot directory
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots/gear-request-title');

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
    console.log('⚠️  Not logged in. Please log in manually first, then re-run this test.');
    console.log('   This test requires authentication but cannot log in automatically.');
    console.log('   Navigation will continue but may fail if authentication is required.');

    // Try to continue anyway - some pages might be accessible
    try {
      await page.waitForTimeout(2000);
    } catch {
      // Continue
    }
  } else {
    console.log('✓ Already logged in');
  }
}

test.describe('Gear Marketplace Request Title Field Investigation', () => {
  test.beforeEach(async ({ page }) => {
    ensureScreenshotsDir();

    // Set longer timeout for navigation
    test.setTimeout(120000);

    // Navigate to homepage
    await page.goto('http://localhost:8080');

    // Wait for page to be ready
    await page.waitForLoadState('networkidle');
  });

  test('should find and screenshot the Request Title field in marketplace', async ({ page }) => {
    console.log('\n========================================');
    console.log('GEAR MARKETPLACE REQUEST TITLE FIELD TEST');
    console.log('========================================\n');

    // Step 1: Check login status
    console.log('Step 1: Checking authentication...');
    await loginIfNeeded(page);

    // Take screenshot of home page
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '01-home-page.png'),
      fullPage: true
    });
    console.log('Screenshot saved: 01-home-page.png');

    // Step 2: Navigate to Gear House
    console.log('\nStep 2: Navigating to Gear House...');

    let navigatedToGear = false;

    // Strategy 1: Direct URL navigation
    try {
      await page.goto('http://localhost:8080/gear');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      navigatedToGear = true;
      console.log('✓ Navigated to /gear via direct URL');
    } catch (error) {
      console.log('✗ Direct navigation to /gear failed, trying menu navigation');
    }

    // Strategy 2: Try to find and click Gear House link in navigation
    if (!navigatedToGear) {
      try {
        const gearLinks = [
          'a:has-text("Gear House")',
          'a:has-text("Gear")',
          '[href="/gear"]',
          'text=Gear House',
        ];

        for (const selector of gearLinks) {
          try {
            await page.click(selector, { timeout: 3000 });
            await page.waitForLoadState('networkidle');
            navigatedToGear = true;
            console.log(`✓ Navigated to Gear House via selector: ${selector}`);
            break;
          } catch {
            continue;
          }
        }
      } catch (error) {
        console.log('✗ Menu navigation failed');
      }
    }

    // Take screenshot of Gear House page
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '02-gear-house-landing.png'),
      fullPage: true
    });
    console.log('Screenshot saved: 02-gear-house-landing.png');

    // Step 3: Navigate to an organization workspace
    console.log('\nStep 3: Looking for organizations...');

    await page.waitForTimeout(2000);

    // Look for organization cards or direct links
    const orgSelectors = [
      '[data-testid="org-card"] button',
      '.organization-card',
      'button:has-text("Open")',
      'a[href*="/gear/"]',
    ];

    let foundOrg = false;
    for (const selector of orgSelectors) {
      try {
        const element = await page.waitForSelector(selector, { timeout: 3000 });
        if (element) {
          await element.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(1000);
          foundOrg = true;
          console.log(`✓ Clicked organization via selector: ${selector}`);
          break;
        }
      } catch {
        continue;
      }
    }

    // If no org found, check if we're already in a workspace
    if (!foundOrg) {
      console.log('No organization card found, checking current URL...');
      const currentUrl = page.url();
      if (currentUrl.includes('/gear/') && currentUrl.split('/gear/')[1]) {
        console.log('✓ Already in a gear workspace');
        foundOrg = true;
      }
    }

    // Take screenshot of workspace
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '03-gear-workspace.png'),
      fullPage: true
    });
    console.log('Screenshot saved: 03-gear-workspace.png');

    // Step 4: Click on Marketplace tab
    console.log('\nStep 4: Navigating to Marketplace tab...');

    await page.waitForTimeout(1000);

    // Look for Marketplace tab
    const marketplaceTabSelectors = [
      '[role="tab"]:has-text("Marketplace")',
      'button:has-text("Marketplace")',
      '[data-value="marketplace"]',
    ];

    let clickedMarketplace = false;
    for (const selector of marketplaceTabSelectors) {
      try {
        const tab = await page.waitForSelector(selector, { timeout: 5000 });
        if (tab) {
          await tab.click();
          await page.waitForTimeout(1500);
          clickedMarketplace = true;
          console.log(`✓ Clicked Marketplace tab via selector: ${selector}`);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!clickedMarketplace) {
      console.log('⚠️  Could not find Marketplace tab');
    }

    // Take screenshot of Marketplace view
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '04-marketplace-view.png'),
      fullPage: true
    });
    console.log('Screenshot saved: 04-marketplace-view.png');

    // Step 5: Look for listings and try to request a quote
    console.log('\nStep 5: Looking for listings to request quotes...');

    await page.waitForTimeout(2000);

    // Look for listing cards or "Request Quote" buttons
    const requestQuoteSelectors = [
      'button:has-text("Request Quote")',
      'button:has-text("Request Rental")',
      '[data-testid="request-quote-btn"]',
    ];

    let foundRequestButton = false;
    for (const selector of requestQuoteSelectors) {
      try {
        const button = await page.locator(selector).first();
        if (await button.isVisible({ timeout: 3000 })) {
          console.log(`✓ Found request button via selector: ${selector}`);
          await button.click();
          await page.waitForTimeout(1500);
          foundRequestButton = true;
          console.log('✓ Clicked request button');
          break;
        }
      } catch {
        continue;
      }
    }

    if (!foundRequestButton) {
      console.log('⚠️  No "Request Quote" button found');
      console.log('Checking for alternative ways to open request form...');

      // Try clicking on a listing card directly
      try {
        const listingCard = await page.locator('[data-testid="listing-card"]').first();
        if (await listingCard.isVisible({ timeout: 2000 })) {
          await listingCard.click();
          await page.waitForTimeout(1500);
          console.log('✓ Clicked listing card');
        }
      } catch {
        console.log('✗ No listing cards found');
      }
    }

    // Take screenshot after clicking request button
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '05-after-request-click.png'),
      fullPage: true
    });
    console.log('Screenshot saved: 05-after-request-click.png');

    // Step 6: Look for the "Request Title" field
    console.log('\nStep 6: Searching for "Request Title" field...');

    await page.waitForTimeout(1000);

    // Search for "Request Title" label
    const requestTitleVisible = await page.locator('text="Request Title"').isVisible().catch(() => false);
    console.log(`Request Title label visible: ${requestTitleVisible}`);

    // Look for the input field
    const titleInputSelectors = [
      'input[id="title"]',
      'input[name="title"]',
      'label:has-text("Request Title") ~ input',
      'label:has-text("Request Title") + input',
    ];

    let titleInputFound = false;
    let titleInputValue = '';
    let titleInputSelector = '';

    for (const selector of titleInputSelectors) {
      try {
        const input = await page.locator(selector).first();
        if (await input.isVisible({ timeout: 1000 })) {
          titleInputFound = true;
          titleInputValue = await input.inputValue();
          titleInputSelector = selector;
          console.log(`✓ "Request Title" input FOUND via selector: ${selector}`);
          console.log(`  Placeholder: ${await input.getAttribute('placeholder')}`);
          console.log(`  Current value: "${titleInputValue || '(empty)'}"`);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!titleInputFound) {
      console.log('✗ "Request Title" input field NOT FOUND');
    }

    // Take screenshot highlighting the Request Title field
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '06-request-title-field.png'),
      fullPage: true
    });
    console.log('Screenshot saved: 06-request-title-field.png');

    // Step 7: Try to fill in the form to see all fields
    if (titleInputFound) {
      console.log('\nStep 7: Filling in test data to see form validation...');

      try {
        // Fill in the Request Title field
        await page.fill(titleInputSelector, 'Test Camera Rental Request');
        console.log('✓ Filled Request Title field');

        // Fill in dates if available
        const startDateInput = await page.locator('input[id="startDate"], input[name="startDate"]').first();
        const endDateInput = await page.locator('input[id="endDate"], input[name="endDate"]').first();

        if (await startDateInput.isVisible({ timeout: 1000 })) {
          await startDateInput.fill('2026-02-01');
          console.log('✓ Filled start date');
        }

        if (await endDateInput.isVisible({ timeout: 1000 })) {
          await endDateInput.fill('2026-02-05');
          console.log('✓ Filled end date');
        }

        await page.waitForTimeout(500);

        // Take screenshot with filled form
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, '07-form-filled.png'),
          fullPage: true
        });
        console.log('Screenshot saved: 07-form-filled.png');

      } catch (error) {
        console.log('✗ Error filling form:', error);
      }
    }

    // Step 8: Check all form fields in the dialog/form
    console.log('\nStep 8: Analyzing all form fields present...');

    const allLabels = await page.locator('label').all();
    console.log(`\nTotal labels found: ${allLabels.length}`);

    const labelTexts = [];
    for (const label of allLabels) {
      try {
        const text = await label.textContent();
        if (text && text.trim()) {
          labelTexts.push(text.trim());
        }
      } catch {
        continue;
      }
    }

    console.log('\nForm field labels found:');
    labelTexts.forEach((text, index) => {
      console.log(`  ${index + 1}. ${text}`);
    });

    // Step 9: Look for any modal or dialog containers
    console.log('\nStep 9: Checking for dialog/modal containers...');

    const dialogSelectors = [
      '[role="dialog"]',
      '.modal',
      '[class*="Dialog"]',
      '[data-state="open"]',
    ];

    for (const selector of dialogSelectors) {
      try {
        const dialog = await page.locator(selector).first();
        if (await dialog.isVisible({ timeout: 1000 })) {
          console.log(`✓ Found dialog via selector: ${selector}`);
          const dialogText = await dialog.textContent();
          console.log(`Dialog contains "Request Title": ${dialogText?.includes('Request Title')}`);
        }
      } catch {
        continue;
      }
    }

    // Final screenshot
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '08-final-state.png'),
      fullPage: true
    });
    console.log('Screenshot saved: 08-final-state.png');

    // Generate summary report
    console.log('\n========================================');
    console.log('TEST SUMMARY');
    console.log('========================================');
    console.log(`✓ Navigated to Gear House: ${navigatedToGear}`);
    console.log(`✓ Found organization workspace: ${foundOrg}`);
    console.log(`✓ Clicked Marketplace tab: ${clickedMarketplace}`);
    console.log(`✓ Found Request Quote button: ${foundRequestButton}`);
    console.log(`✓ "Request Title" field visible: ${requestTitleVisible}`);
    console.log(`✓ "Request Title" input found: ${titleInputFound}`);
    console.log(`\nScreenshots saved to: ${SCREENSHOTS_DIR}`);
    console.log('========================================\n');

    // Make an assertion so the test passes/fails based on whether we found the field
    expect(requestTitleVisible || titleInputFound).toBeTruthy();
  });
});
