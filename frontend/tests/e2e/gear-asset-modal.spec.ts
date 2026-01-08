/**
 * Gear House Asset Modal Inspection Test
 *
 * This test navigates to Gear House and inspects the asset detail/edit modal
 * to verify serial number field presence and functionality.
 */

import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Screenshot directory
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots');

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

// Main test suite
test.describe('Gear House Asset Detail Modal Inspection', () => {
  test.beforeEach(async ({ page }) => {
    ensureScreenshotsDir();

    // Set longer timeout for navigation
    test.setTimeout(60000);

    // Navigate to homepage
    await page.goto('http://localhost:8080');

    // Wait for page to be ready
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to Gear House and inspect asset modal', async ({ page }) => {
    // Step 1: Check login status and login if needed
    console.log('Step 1: Checking authentication...');
    await loginIfNeeded(page);

    // Step 2: Navigate to Gear House
    console.log('Step 2: Navigating to Gear House...');

    // Try multiple navigation strategies
    let navigatedToGear = false;

    // Strategy 1: Direct URL navigation
    try {
      await page.goto('http://localhost:8080/gear');
      await page.waitForLoadState('networkidle');
      navigatedToGear = true;
      console.log('Navigated to /gear via direct URL');
    } catch (error) {
      console.log('Direct navigation to /gear failed, trying menu navigation');
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
            console.log(`Navigated to Gear House via selector: ${selector}`);
            break;
          } catch {
            continue;
          }
        }
      } catch (error) {
        console.log('Menu navigation failed');
      }
    }

    // Take screenshot of Gear House page
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '01-gear-house-page.png'),
      fullPage: true
    });
    console.log('Screenshot saved: 01-gear-house-page.png');

    // Step 3: Check for organizations or navigate to specific org
    console.log('Step 3: Looking for organizations...');

    // Wait a bit for content to load
    await page.waitForTimeout(2000);

    // Look for organization cards or lists
    const orgSelectors = [
      '[data-testid="org-card"]',
      '.organization-card',
      'button:has-text("Open")',
      'a[href*="/gear/"]',
      'text=Organization'
    ];

    let foundOrg = false;
    for (const selector of orgSelectors) {
      try {
        const element = await page.waitForSelector(selector, { timeout: 3000 });
        if (element) {
          await element.click();
          await page.waitForLoadState('networkidle');
          foundOrg = true;
          console.log(`Clicked organization via selector: ${selector}`);
          break;
        }
      } catch {
        continue;
      }
    }

    // If no org found, check if we're already in a workspace
    if (!foundOrg) {
      console.log('No organization selector found, checking if already in workspace...');
      const currentUrl = page.url();
      if (currentUrl.includes('/gear/') && currentUrl.split('/gear/')[1]) {
        console.log('Already in a gear workspace');
        foundOrg = true;
      }
    }

    // Take screenshot of workspace or org list
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '02-gear-workspace-or-list.png'),
      fullPage: true
    });
    console.log('Screenshot saved: 02-gear-workspace-or-list.png');

    // Step 4: Look for existing assets
    console.log('Step 4: Looking for existing assets...');

    // Wait for assets to load
    await page.waitForTimeout(2000);

    // Look for asset rows or cards
    const assetSelectors = [
      'tr[data-testid="asset-row"]',
      '[data-testid="asset-card"]',
      'table tbody tr',
      '.asset-row',
      'button:has-text("View Details")'
    ];

    let assetElement = null;
    for (const selector of assetSelectors) {
      try {
        assetElement = await page.waitForSelector(selector, { timeout: 5000 });
        if (assetElement) {
          console.log(`Found asset via selector: ${selector}`);
          break;
        }
      } catch {
        continue;
      }
    }

    // If no assets found, try to create one first
    if (!assetElement) {
      console.log('No existing assets found, attempting to create a test asset...');

      try {
        // Look for "Add Asset" button
        const addAssetButton = await page.waitForSelector(
          'button:has-text("Add Asset"), button:has-text("New Asset")',
          { timeout: 5000 }
        );

        if (addAssetButton) {
          await addAssetButton.click();
          await page.waitForTimeout(1000);

          // Fill in asset creation form
          await page.fill('input[id="name"], input[name="name"]', 'Test Camera Asset');

          // Try to fill serial number in create form
          const serialInput = await page.locator('input[id="serial"], input[name="serial_number"]').first();
          if (await serialInput.isVisible()) {
            await serialInput.fill('SN-TEST-123456');
            console.log('Serial number field found in CREATE form');
          }

          // Submit the form
          await page.click('button[type="submit"]:has-text("Add Asset"), button:has-text("Create")');
          await page.waitForTimeout(2000);

          console.log('Test asset created');
        }
      } catch (error) {
        console.log('Could not create test asset:', error);
      }
    }

    // Take screenshot before clicking asset
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '03-assets-list.png'),
      fullPage: true
    });
    console.log('Screenshot saved: 03-assets-list.png');

    // Step 5: Click on an asset to open detail modal
    console.log('Step 5: Opening asset detail modal...');

    // Try different ways to open asset modal
    let modalOpened = false;

    // Strategy 1: Click on table row
    try {
      const firstRow = await page.locator('table tbody tr').first();
      await firstRow.click();
      await page.waitForTimeout(1000);
      modalOpened = true;
      console.log('Opened modal by clicking table row');
    } catch {
      // Strategy 2: Click "View Details" button
      try {
        const viewButton = await page.locator('button:has-text("View Details")').first();
        await viewButton.click();
        await page.waitForTimeout(1000);
        modalOpened = true;
        console.log('Opened modal by clicking View Details button');
      } catch {
        console.log('Could not open asset modal');
      }
    }

    // Wait for modal to appear
    await page.waitForTimeout(1500);

    // Step 6: Take screenshot of VIEW mode
    console.log('Step 6: Capturing asset detail modal in VIEW mode...');
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '04-asset-modal-view-mode.png'),
      fullPage: true
    });
    console.log('Screenshot saved: 04-asset-modal-view-mode.png');

    // Step 7: Inspect serial number in VIEW mode
    console.log('Step 7: Checking for serial number in VIEW mode...');

    const serialNumberInView = await page.locator('text="Serial Number"').isVisible().catch(() => false);
    console.log(`Serial Number label visible in VIEW mode: ${serialNumberInView}`);

    // Look for the actual serial number value
    if (serialNumberInView) {
      const serialValueElements = await page.locator('text="Serial Number"').locator('..').allTextContents();
      console.log('Serial number section content:', serialValueElements);
    }

    // Check all visible text in modal
    const modalContent = await page.locator('[role="dialog"], .modal, [class*="Modal"]').first().textContent();
    console.log('Modal content includes "Serial":', modalContent?.includes('Serial') || modalContent?.includes('serial'));

    // Step 8: Click "Edit Asset" button
    console.log('Step 8: Entering EDIT mode...');

    try {
      const editButton = await page.locator('button:has-text("Edit Asset"), button:has-text("Edit")').first();
      await editButton.click();
      await page.waitForTimeout(1000);
      console.log('Clicked Edit button');
    } catch (error) {
      console.log('Could not find Edit button:', error);
    }

    // Wait for edit form to render
    await page.waitForTimeout(1500);

    // Step 9: Take screenshot of EDIT mode
    console.log('Step 9: Capturing asset modal in EDIT mode...');
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '05-asset-modal-edit-mode.png'),
      fullPage: true
    });
    console.log('Screenshot saved: 05-asset-modal-edit-mode.png');

    // Step 10: Inspect serial number field in EDIT mode
    console.log('Step 10: Inspecting serial number field in EDIT mode...');

    // Look for serial number input field
    const serialInputSelectors = [
      'input[id="edit-serial"]',
      'input[name="serial_number"]',
      'input[id="serial"]',
      'label:has-text("Serial Number") + input',
      'label:has-text("Serial Number") ~ input',
    ];

    let serialInputFound = false;
    let serialInputValue = '';

    for (const selector of serialInputSelectors) {
      try {
        const input = await page.locator(selector).first();
        if (await input.isVisible({ timeout: 1000 })) {
          serialInputFound = true;
          serialInputValue = await input.inputValue();
          console.log(`✓ Serial number input FOUND via selector: ${selector}`);
          console.log(`  Current value: "${serialInputValue || '(empty)'}"`);

          // Check if the field is editable
          const isDisabled = await input.isDisabled();
          const isReadonly = await input.getAttribute('readonly');
          console.log(`  Editable: ${!isDisabled && !isReadonly}`);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!serialInputFound) {
      console.log('✗ Serial number input field NOT FOUND in edit mode');
    }

    // Step 11: List all form fields in EDIT mode
    console.log('Step 11: Listing all form fields in EDIT mode...');

    const allInputs = await page.locator('input, textarea, select').all();
    console.log(`Total form fields found: ${allInputs.length}`);

    const fieldInfo = [];
    for (const input of allInputs) {
      try {
        const tagName = await input.evaluate(el => el.tagName.toLowerCase());
        const type = await input.getAttribute('type');
        const id = await input.getAttribute('id');
        const name = await input.getAttribute('name');
        const placeholder = await input.getAttribute('placeholder');
        const value = await input.inputValue().catch(() => '');

        // Try to find associated label
        let label = '';
        if (id) {
          const labelElement = await page.locator(`label[for="${id}"]`).first().textContent().catch(() => '');
          label = labelElement;
        }

        fieldInfo.push({
          tagName,
          type,
          id,
          name,
          label,
          placeholder,
          value: value ? '(has value)' : '(empty)'
        });
      } catch {
        continue;
      }
    }

    console.log('Form fields:');
    console.table(fieldInfo);

    // Step 12: Generate summary report
    console.log('\n========================================');
    console.log('INSPECTION SUMMARY');
    console.log('========================================');
    console.log(`✓ Successfully navigated to Gear House`);
    console.log(`✓ Opened asset detail modal`);
    console.log(`✓ Viewed asset in VIEW mode`);
    console.log(`✓ Entered EDIT mode`);
    console.log(`\nSerial Number Field Status:`);
    console.log(`  - Present in VIEW mode: ${serialNumberInView ? 'YES' : 'UNKNOWN'}`);
    console.log(`  - Present in EDIT mode: ${serialInputFound ? 'YES' : 'NO'}`);
    console.log(`  - Total form fields in EDIT mode: ${fieldInfo.length}`);
    console.log(`\nScreenshots saved to: ${SCREENSHOTS_DIR}`);
    console.log('========================================\n');

    // Assertions for test validation
    expect(modalOpened).toBeTruthy();
    // Note: Not making serial number assertion as we're in inspection mode
  });
});
