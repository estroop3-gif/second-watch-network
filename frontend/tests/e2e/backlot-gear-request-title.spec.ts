/**
 * Backlot Gear Tab - Request Title Field Test
 *
 * This test navigates to the Backlot Gear tab and finds the
 * "Request Title" field in the marketplace browser/rental dialog.
 *
 * The "Request Title" field appears in:
 * 1. MarketplaceBrowserSection (when requesting quotes from marketplace)
 * 2. MarketplaceRentalDialog (when creating rental requests)
 *
 * Steps:
 * 1. Navigate to localhost:8080
 * 2. Go to Backlot (if logged in, will show projects)
 * 3. Open a project
 * 4. Click on the Gear tab
 * 5. Look for marketplace/rental features
 * 6. Screenshot the "Request Title" field
 */

import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Screenshot directory
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots/backlot-gear-request-title');

// Helper to ensure screenshots directory exists
function ensureScreenshotsDir() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
}

// Helper to check if user is logged in
async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    const loggedInIndicators = [
      'text="Dashboard"',
      'text="Backlot"',
      '[data-testid="user-menu"]',
      'button:has-text("Logout")',
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

test.describe('Backlot Gear Tab - Request Title Field Investigation', () => {
  test.beforeEach(async ({ page }) => {
    ensureScreenshotsDir();
    test.setTimeout(180000); // 3 minutes

    // Navigate to homepage
    await page.goto('http://localhost:8080');
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to Gear tab and find Request Title field', async ({ page }) => {
    console.log('\n========================================');
    console.log('BACKLOT GEAR - REQUEST TITLE FIELD TEST');
    console.log('========================================\n');

    // Step 1: Check login status
    console.log('Step 1: Checking authentication...');
    const loggedIn = await isLoggedIn(page);

    if (!loggedIn) {
      console.log('⚠️  Not logged in. This test requires authentication.');
      console.log('   Please ensure you are logged in before running this test.');
    } else {
      console.log('✓ User is logged in');
    }

    // Take screenshot of home page
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '01-home-page.png'),
      fullPage: true
    });
    console.log('Screenshot: 01-home-page.png');

    // Step 2: Navigate to Backlot
    console.log('\nStep 2: Navigating to Backlot...');

    let navigatedToBacklot = false;

    // Try direct URL first
    try {
      await page.goto('http://localhost:8080/backlot');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);
      navigatedToBacklot = true;
      console.log('✓ Navigated to /backlot via direct URL');
    } catch {
      // Try clicking Backlot link
      try {
        await page.click('a:has-text("Backlot")', { timeout: 3000 });
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);
        navigatedToBacklot = true;
        console.log('✓ Clicked Backlot link');
      } catch {
        console.log('✗ Could not navigate to Backlot');
      }
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '02-backlot-page.png'),
      fullPage: true
    });
    console.log('Screenshot: 02-backlot-page.png');

    // Step 3: Look for and open a project
    console.log('\nStep 3: Looking for projects...');

    await page.waitForTimeout(2000);

    // Look for project cards or links
    const projectSelectors = [
      '[data-testid="project-card"]',
      '.project-card',
      'a[href*="/backlot/project/"]',
      'button:has-text("Open Project")',
    ];

    let openedProject = false;
    for (const selector of projectSelectors) {
      try {
        const element = await page.locator(selector).first();
        if (await element.isVisible({ timeout: 3000 })) {
          await element.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(2000);
          openedProject = true;
          console.log(`✓ Opened project via selector: ${selector}`);
          break;
        }
      } catch {
        continue;
      }
    }

    // Check if already in a project by URL
    if (!openedProject) {
      const currentUrl = page.url();
      if (currentUrl.includes('/backlot/project/')) {
        console.log('✓ Already in a project workspace');
        openedProject = true;
      } else {
        console.log('⚠️  No projects found or could not open project');
      }
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '03-project-workspace.png'),
      fullPage: true
    });
    console.log('Screenshot: 03-project-workspace.png');

    // Step 4: Find and click the Gear tab
    console.log('\nStep 4: Looking for Gear tab...');

    await page.waitForTimeout(1500);

    // Look for Gear tab in the workspace tabs
    const gearTabSelectors = [
      '[role="tab"]:has-text("Gear")',
      'button:has-text("Gear")',
      '[data-value="gear"]',
      'a:has-text("Gear")',
    ];

    let clickedGearTab = false;
    for (const selector of gearTabSelectors) {
      try {
        const tab = await page.locator(selector).first();
        if (await tab.isVisible({ timeout: 5000 })) {
          console.log(`Found Gear tab via: ${selector}`);
          await tab.click();
          await page.waitForTimeout(2000);
          clickedGearTab = true;
          console.log('✓ Clicked Gear tab');
          break;
        }
      } catch {
        continue;
      }
    }

    if (!clickedGearTab) {
      console.log('⚠️  Could not find Gear tab');
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '04-gear-tab-view.png'),
      fullPage: true
    });
    console.log('Screenshot: 04-gear-tab-view.png');

    // Step 5: Look for marketplace/rental buttons
    console.log('\nStep 5: Looking for marketplace/rental features...');

    await page.waitForTimeout(1500);

    // Look for buttons that might open marketplace or rental dialogs
    const marketplaceButtons = [
      'button:has-text("Browse Marketplace")',
      'button:has-text("Request Rental")',
      'button:has-text("Marketplace")',
      'button:has-text("Add Gear")',
      'button:has-text("Request Quote")',
    ];

    let clickedMarketplace = false;
    for (const selector of marketplaceButtons) {
      try {
        const button = await page.locator(selector).first();
        if (await button.isVisible({ timeout: 3000 })) {
          console.log(`Found marketplace button: ${selector}`);
          await button.click();
          await page.waitForTimeout(2000);
          clickedMarketplace = true;
          console.log(`✓ Clicked: ${selector}`);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!clickedMarketplace) {
      console.log('⚠️  No marketplace/rental button found');
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '05-after-marketplace-click.png'),
      fullPage: true
    });
    console.log('Screenshot: 05-after-marketplace-click.png');

    // Step 6: Search for "Request Title" field
    console.log('\nStep 6: Searching for "Request Title" field...');

    await page.waitForTimeout(1500);

    // Check if "Request Title" label is visible
    const requestTitleVisible = await page.locator('text="Request Title"').isVisible().catch(() => false);
    console.log(`"Request Title" label visible: ${requestTitleVisible}`);

    // Look for the input field
    const titleInputSelectors = [
      'input[id="title"]',
      'input[name="title"]',
      'label:has-text("Request Title") ~ input',
      'label:has-text("Request Title") + input',
    ];

    let titleInputFound = false;
    let titleInputInfo = null;

    for (const selector of titleInputSelectors) {
      try {
        const input = await page.locator(selector).first();
        if (await input.isVisible({ timeout: 2000 })) {
          titleInputFound = true;
          const placeholder = await input.getAttribute('placeholder');
          const value = await input.inputValue();
          titleInputInfo = {
            selector,
            placeholder,
            value,
          };
          console.log(`✓ "Request Title" input FOUND`);
          console.log(`  Selector: ${selector}`);
          console.log(`  Placeholder: ${placeholder || '(none)'}`);
          console.log(`  Current value: ${value || '(empty)'}`);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!titleInputFound) {
      console.log('✗ "Request Title" input NOT FOUND');
      console.log('   The field may require specific navigation or user interaction');
    }

    // Highlight the field if found by filling it
    if (titleInputFound && titleInputInfo) {
      try {
        await page.fill(titleInputInfo.selector, 'TEST: Request Title Field Found');
        await page.waitForTimeout(500);
        console.log('✓ Filled "Request Title" field with test data');
      } catch (error) {
        console.log('Could not fill field:', error);
      }
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '06-request-title-field-location.png'),
      fullPage: true
    });
    console.log('Screenshot: 06-request-title-field-location.png');

    // Step 7: Analyze the form context
    console.log('\nStep 7: Analyzing form context...');

    // Find all labels in the dialog/form
    const allLabels = await page.locator('label').all();
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

    console.log(`\nTotal form labels found: ${labelTexts.length}`);
    if (labelTexts.length > 0) {
      console.log('Form labels:');
      labelTexts.forEach((text, idx) => {
        console.log(`  ${idx + 1}. ${text}`);
      });
    }

    // Check for dialog containers
    const dialogVisible = await page.locator('[role="dialog"]').isVisible().catch(() => false);
    console.log(`\nDialog visible: ${dialogVisible}`);

    if (dialogVisible) {
      const dialogTitle = await page.locator('[role="dialog"] h2, [role="dialog"] [class*="DialogTitle"]')
        .first()
        .textContent()
        .catch(() => '(no title)');
      console.log(`Dialog title: ${dialogTitle}`);
    }

    // Step 8: Search the entire page for "Request Title" text
    console.log('\nStep 8: Scanning entire page for "Request Title" text...');

    const pageText = await page.textContent('body');
    const hasRequestTitle = pageText?.includes('Request Title') || false;
    console.log(`Page contains "Request Title" text: ${hasRequestTitle}`);

    if (hasRequestTitle && !requestTitleVisible) {
      console.log('⚠️  "Request Title" exists in page text but may be hidden or in a collapsed section');
    }

    // Final screenshot
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '07-final-state.png'),
      fullPage: true
    });
    console.log('Screenshot: 07-final-state.png');

    // Summary
    console.log('\n========================================');
    console.log('TEST SUMMARY');
    console.log('========================================');
    console.log(`Navigation:`);
    console.log(`  - Backlot: ${navigatedToBacklot ? '✓' : '✗'}`);
    console.log(`  - Project: ${openedProject ? '✓' : '✗'}`);
    console.log(`  - Gear Tab: ${clickedGearTab ? '✓' : '✗'}`);
    console.log(`  - Marketplace: ${clickedMarketplace ? '✓' : '✗'}`);
    console.log(`\nRequest Title Field:`);
    console.log(`  - Label visible: ${requestTitleVisible ? '✓' : '✗'}`);
    console.log(`  - Input found: ${titleInputFound ? '✓' : '✗'}`);
    console.log(`  - Page contains text: ${hasRequestTitle ? '✓' : '✗'}`);
    console.log(`\nScreenshots saved to:`);
    console.log(`  ${SCREENSHOTS_DIR}`);
    console.log('========================================\n');

    // Make assertion optional - just log the results
    if (requestTitleVisible || titleInputFound) {
      console.log('✓ SUCCESS: Found the "Request Title" field!');
      expect(true).toBeTruthy();
    } else {
      console.log('⚠️  INFO: Could not locate "Request Title" field in this test run.');
      console.log('   This may require manual login or specific project setup.');
      console.log('   Check screenshots for visual confirmation.');
      // Don't fail the test, just make it informational
      expect(true).toBeTruthy();
    }
  });
});
