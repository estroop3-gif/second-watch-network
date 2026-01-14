/**
 * Manual Inspection Test - Gear Request Title Field
 *
 * FOUND: The "Request Title" field is located in:
 * - File: src/components/backlot/workspace/gear/MarketplaceBrowserSection.tsx
 * - Line: 865
 * - Label: "Request Title *"
 * - Input ID: "title"
 * - Placeholder: "e.g., Camera Package for Main Unit"
 *
 * This field appears when:
 * 1. User is in a Backlot project workspace
 * 2. User navigates to the Gear tab
 * 3. User clicks to browse marketplace or request rental
 * 4. A form is displayed for submitting a rental request/quote
 *
 * This test opens the browser and waits for manual navigation.
 * Follow the steps below, then screenshots will be captured.
 */

import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots/gear-request-title-manual');

function ensureScreenshotsDir() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
}

test.describe('Manual Gear Request Title Field Inspection', () => {
  test('wait for manual navigation to Gear tab Request Title field', async ({ page }) => {
    ensureScreenshotsDir();
    test.setTimeout(600000); // 10 minutes for manual interaction

    console.log('\n========================================');
    console.log('MANUAL INSPECTION - REQUEST TITLE FIELD');
    console.log('========================================\n');
    console.log('This test will open a browser and wait for you to manually navigate.');
    console.log('\nSTEPS TO FOLLOW:');
    console.log('1. Log in if not already logged in');
    console.log('2. Navigate to Backlot');
    console.log('3. Open or create a project');
    console.log('4. Click on the Gear tab');
    console.log('5. Click "Browse Marketplace" or "Request Rental" button');
    console.log('6. Observe the "Request Title" field in the form');
    console.log('\nThe test will wait 2 minutes, then take screenshots automatically.');
    console.log('========================================\n');

    // Navigate to home
    await page.goto('http://localhost:8080');
    await page.waitForLoadState('networkidle');

    // Initial screenshot
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-01-initial-page.png'),
      fullPage: true
    });
    console.log('Screenshot: step-01-initial-page.png');

    // Wait 30 seconds for login
    console.log('\nWaiting 30 seconds for login...');
    await page.waitForTimeout(30000);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-02-after-30sec.png'),
      fullPage: true
    });
    console.log('Screenshot: step-02-after-30sec.png');

    // Wait another 30 seconds
    console.log('Waiting another 30 seconds for Backlot navigation...');
    await page.waitForTimeout(30000);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-03-after-60sec.png'),
      fullPage: true
    });
    console.log('Screenshot: step-03-after-60sec.png');

    // Wait another 30 seconds
    console.log('Waiting 30 more seconds for project + Gear tab...');
    await page.waitForTimeout(30000);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-04-after-90sec.png'),
      fullPage: true
    });
    console.log('Screenshot: step-04-after-90sec.png');

    // Wait final 30 seconds
    console.log('Final 30 seconds - navigate to Request Title field...');
    await page.waitForTimeout(30000);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'step-05-after-120sec-final.png'),
      fullPage: true
    });
    console.log('Screenshot: step-05-after-120sec-final.png');

    // Check if Request Title field is visible
    const requestTitleVisible = await page.locator('text="Request Title"').isVisible().catch(() => false);
    const titleInputVisible = await page.locator('input[id="title"]').isVisible().catch(() => false);

    console.log('\n========================================');
    console.log('INSPECTION RESULTS');
    console.log('========================================');
    console.log(`"Request Title" label visible: ${requestTitleVisible ? '✓ YES' : '✗ NO'}`);
    console.log(`"Request Title" input visible: ${titleInputVisible ? '✓ YES' : '✗ NO'}`);
    console.log(`\nScreenshots saved to:`);
    console.log(`  ${SCREENSHOTS_DIR}`);
    console.log('========================================\n');

    // If field is found, highlight it
    if (titleInputVisible) {
      console.log('\n✓ SUCCESS: Found the "Request Title" field!');
      console.log('Filling it with test data...\n');

      await page.fill('input[id="title"]', '>>> THIS IS THE REQUEST TITLE FIELD <<<');
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'FIELD-FOUND-highlighted.png'),
        fullPage: true
      });
      console.log('Screenshot: FIELD-FOUND-highlighted.png');

      // Get more info about the field
      const placeholder = await page.locator('input[id="title"]').getAttribute('placeholder');
      const parentForm = await page.locator('input[id="title"]').locator('..').locator('..').textContent();

      console.log('\nField Details:');
      console.log(`  Placeholder: ${placeholder}`);
      console.log(`  Form context: ${parentForm?.substring(0, 200)}...`);
    } else {
      console.log('\n⚠️  Request Title field not visible after 2 minutes.');
      console.log('You may need more time to navigate to the correct page.');
    }

    expect(true).toBeTruthy(); // Always pass
  });
});
