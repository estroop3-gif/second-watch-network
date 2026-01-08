/**
 * Gear House Create Asset Modal - Containment Test
 *
 * This test investigates a reported issue where the Create Asset modal
 * is not properly contained when the inline "Add Location" form is expanded.
 *
 * Steps:
 * 1. Navigate to Gear House page
 * 2. Click "Add Asset" button to open the modal
 * 3. Take screenshot of initial state
 * 4. Click "Add" button next to "Home Location" to expand inline form
 * 5. Take screenshot to see if modal overflows or has containment issues
 * 6. Measure and verify modal dimensions
 */

import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Screenshot directory
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots/gear-modal-containment');

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

// Main test suite
test.describe('Gear House Create Asset Modal - Containment Issue', () => {
  test.beforeEach(async ({ page }) => {
    ensureScreenshotsDir();
    test.setTimeout(120000); // 2 minutes timeout
  });

  test('should investigate modal containment when inline location form is expanded', async ({ page }) => {
    console.log('\n========================================');
    console.log('GEAR HOUSE CREATE ASSET MODAL TEST');
    console.log('========================================\n');

    // Step 1: Navigate to the app
    console.log('Step 1: Navigating to application...');
    await page.goto('http://localhost:8080');
    await page.waitForLoadState('networkidle');

    // Check if logged in
    const loggedIn = await isLoggedIn(page);
    if (!loggedIn) {
      console.log('⚠️  Not logged in. This test requires authentication.');
      console.log('   Please log in manually, then re-run the test.');
      throw new Error('Authentication required - please log in first');
    }
    console.log('✓ Authenticated');

    // Step 2: Navigate to Gear House
    console.log('\nStep 2: Navigating to Gear House...');
    await page.goto('http://localhost:8080/gear');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Let the page settle

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '01-gear-house-page.png'),
      fullPage: true,
    });
    console.log('✓ Screenshot: 01-gear-house-page.png');

    // Step 3: Look for and navigate to an organization
    console.log('\nStep 3: Looking for gear organization...');

    // Try to find an org card or link to click
    const orgClickable = await page.locator('button:has-text("Open"), a[href*="/gear/"]').first().isVisible({ timeout: 5000 }).catch(() => false);

    if (orgClickable) {
      await page.locator('button:has-text("Open"), a[href*="/gear/"]').first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);
      console.log('✓ Clicked into gear organization');
    } else {
      // Check if we're already in a gear workspace
      const currentUrl = page.url();
      if (!currentUrl.includes('/gear/')) {
        console.log('⚠️  No organization found. Current URL:', currentUrl);
        throw new Error('Could not find gear organization - please create one first');
      }
      console.log('✓ Already in gear workspace');
    }

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '02-gear-workspace.png'),
      fullPage: true,
    });
    console.log('✓ Screenshot: 02-gear-workspace.png');

    // Step 4: Click "Add Asset" button to open the modal
    console.log('\nStep 4: Opening Create Asset modal...');

    const addAssetButton = page.locator('button:has-text("Add Asset")');
    await expect(addAssetButton).toBeVisible({ timeout: 10000 });
    await addAssetButton.click();

    // Wait for modal to appear
    await page.waitForTimeout(1000);
    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible();
    console.log('✓ Create Asset modal opened');

    // Step 5: Take screenshot of modal in initial state
    console.log('\nStep 5: Capturing modal initial state...');
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '03-modal-initial.png'),
      fullPage: true,
    });
    console.log('✓ Screenshot: 03-modal-initial.png');

    // Measure modal dimensions before expansion
    const modalBoxBefore = await modal.boundingBox();
    console.log('\nModal dimensions BEFORE expansion:');
    console.log(`  Width: ${modalBoxBefore?.width}px`);
    console.log(`  Height: ${modalBoxBefore?.height}px`);
    console.log(`  X: ${modalBoxBefore?.x}px`);
    console.log(`  Y: ${modalBoxBefore?.y}px`);

    // Check modal's max-height and overflow settings
    const modalContent = modal.locator('.sm\\:max-w-xl').first();
    const modalStyles = await modalContent.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        maxHeight: computed.maxHeight,
        overflowY: computed.overflowY,
        height: computed.height,
        display: computed.display,
        position: computed.position,
      };
    });
    console.log('\nModal computed styles BEFORE:');
    console.log(`  max-height: ${modalStyles.maxHeight}`);
    console.log(`  overflow-y: ${modalStyles.overflowY}`);
    console.log(`  height: ${modalStyles.height}`);
    console.log(`  display: ${modalStyles.display}`);
    console.log(`  position: ${modalStyles.position}`);

    // Step 6: Find and click the "Add" button next to "Home Location"
    console.log('\nStep 6: Expanding inline "Add Location" form...');

    // Look for the "Add" button next to "Home Location" label
    const addLocationButton = page.locator('label:has-text("Home Location")').locator('..').locator('button:has-text("Add")');
    await expect(addLocationButton).toBeVisible();

    await addLocationButton.click();
    await page.waitForTimeout(500); // Wait for animation

    console.log('✓ Clicked "Add" button for location');

    // Verify the inline form appeared
    const inlineForm = page.locator('input[placeholder="Location name"]');
    await expect(inlineForm).toBeVisible();
    console.log('✓ Inline location form is now visible');

    // Step 7: Take screenshot after expansion
    console.log('\nStep 7: Capturing modal after expansion...');
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '04-modal-expanded.png'),
      fullPage: true,
    });
    console.log('✓ Screenshot: 04-modal-expanded.png');

    // Measure modal dimensions after expansion
    const modalBoxAfter = await modal.boundingBox();
    console.log('\nModal dimensions AFTER expansion:');
    console.log(`  Width: ${modalBoxAfter?.width}px`);
    console.log(`  Height: ${modalBoxAfter?.height}px`);
    console.log(`  X: ${modalBoxAfter?.x}px`);
    console.log(`  Y: ${modalBoxAfter?.y}px`);

    // Check if modal grew
    if (modalBoxBefore && modalBoxAfter) {
      const heightDiff = modalBoxAfter.height - modalBoxBefore.height;
      console.log(`\nHeight change: ${heightDiff > 0 ? '+' : ''}${heightDiff}px`);
    }

    // Check modal's max-height and overflow settings after expansion
    const modalStylesAfter = await modalContent.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        maxHeight: computed.maxHeight,
        overflowY: computed.overflowY,
        height: computed.height,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      };
    });
    console.log('\nModal computed styles AFTER:');
    console.log(`  max-height: ${modalStylesAfter.maxHeight}`);
    console.log(`  overflow-y: ${modalStylesAfter.overflowY}`);
    console.log(`  height: ${modalStylesAfter.height}`);
    console.log(`  scrollHeight: ${modalStylesAfter.scrollHeight}px`);
    console.log(`  clientHeight: ${modalStylesAfter.clientHeight}px`);

    const isOverflowing = modalStylesAfter.scrollHeight > modalStylesAfter.clientHeight;
    console.log(`  Content overflow: ${isOverflowing ? 'YES' : 'NO'}`);

    // Step 8: Check if modal extends beyond viewport
    console.log('\nStep 8: Checking viewport containment...');
    const viewportSize = page.viewportSize();
    console.log(`Viewport: ${viewportSize?.width}x${viewportSize?.height}`);

    if (modalBoxAfter && viewportSize) {
      const modalBottom = modalBoxAfter.y + modalBoxAfter.height;
      const modalRight = modalBoxAfter.x + modalBoxAfter.width;

      const exceedsBottom = modalBottom > viewportSize.height;
      const exceedsRight = modalRight > viewportSize.width;
      const exceedsTop = modalBoxAfter.y < 0;
      const exceedsLeft = modalBoxAfter.x < 0;

      console.log('\nViewport containment check:');
      console.log(`  Exceeds bottom: ${exceedsBottom ? 'YES ⚠️' : 'NO ✓'}`);
      console.log(`  Exceeds right: ${exceedsRight ? 'YES ⚠️' : 'NO ✓'}`);
      console.log(`  Exceeds top: ${exceedsTop ? 'YES ⚠️' : 'NO ✓'}`);
      console.log(`  Exceeds left: ${exceedsLeft ? 'YES ⚠️' : 'NO ✓'}`);

      if (exceedsBottom) {
        console.log(`\n  Modal bottom (${modalBottom}px) exceeds viewport height (${viewportSize.height}px)`);
        console.log(`  Overflow: ${modalBottom - viewportSize.height}px`);
      }
    }

    // Step 9: Check the DialogContent component's class attributes
    console.log('\nStep 9: Analyzing modal structure...');
    const dialogContentClasses = await modalContent.getAttribute('class');
    console.log(`DialogContent classes: ${dialogContentClasses}`);

    // Check if overflow-y-auto is present
    const hasOverflowAuto = dialogContentClasses?.includes('overflow-y-auto') ||
                           dialogContentClasses?.includes('overflow-auto');
    console.log(`Has overflow-auto class: ${hasOverflowAuto ? 'YES ✓' : 'NO ⚠️'}`);

    const hasMaxHeight = dialogContentClasses?.includes('max-h-');
    console.log(`Has max-h- class: ${hasMaxHeight ? 'YES ✓' : 'NO ⚠️'}`);

    // Step 10: Check the form content container
    console.log('\nStep 10: Analyzing form structure...');
    const formElement = modal.locator('form').first();
    const formBox = await formElement.boundingBox();
    const formStyles = await formElement.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        height: computed.height,
        maxHeight: computed.maxHeight,
        overflowY: computed.overflowY,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      };
    });

    console.log('Form element:');
    console.log(`  Height: ${formBox?.height}px`);
    console.log(`  Computed height: ${formStyles.height}`);
    console.log(`  Max height: ${formStyles.maxHeight}`);
    console.log(`  Overflow-y: ${formStyles.overflowY}`);
    console.log(`  ScrollHeight: ${formStyles.scrollHeight}px`);
    console.log(`  ClientHeight: ${formStyles.clientHeight}px`);

    // Step 11: Generate diagnosis
    console.log('\n========================================');
    console.log('DIAGNOSIS');
    console.log('========================================\n');

    const issues: string[] = [];

    if (modalBoxAfter && viewportSize && (modalBoxAfter.y + modalBoxAfter.height) > viewportSize.height) {
      issues.push('Modal extends beyond viewport bottom');
    }

    if (!hasOverflowAuto) {
      issues.push('DialogContent missing overflow-auto class');
    }

    if (modalStylesAfter.overflowY !== 'auto' && modalStylesAfter.overflowY !== 'scroll') {
      issues.push(`DialogContent overflow-y is "${modalStylesAfter.overflowY}" instead of "auto"`);
    }

    if (modalStylesAfter.maxHeight === 'none') {
      issues.push('DialogContent has no max-height constraint');
    }

    if (issues.length > 0) {
      console.log('ISSUES FOUND:');
      issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue}`);
      });

      console.log('\nRECOMMENDED FIXES:');
      console.log('  1. Add "overflow-y-auto" class to DialogContent (line 539 in AssetsView.tsx)');
      console.log('  2. Current: <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">');
      console.log('  3. The max-h-[90vh] is present but may need overflow-y-auto to be effective');
      console.log('  4. Also ensure the form container doesn\'t have fixed height that prevents scrolling');
    } else {
      console.log('No containment issues detected.');
      console.log('Modal appears to be properly contained within viewport.');
    }

    console.log('\n========================================');
    console.log('Screenshots saved to:');
    console.log(SCREENSHOTS_DIR);
    console.log('========================================\n');
  });
});
