import { test } from '@playwright/test';

const SCREENSHOTS_DIR = '/home/estro/second-watch-network/frontend/screenshots';

test.setTimeout(180000); // 3 minutes total timeout

test('Manual Script View Comparison - PAGE VIEW vs Text Viewer', async ({ page }) => {
  console.log('\n=== Manual Script View Comparison Test ===\n');
  console.log('This test requires manual navigation. Follow these steps:\n');

  // Step 1: Open browser
  console.log('Step 1: Opening browser at http://localhost:8080');
  await page.goto('http://localhost:8080');
  await page.waitForTimeout(3000);

  console.log('\n--- MANUAL STEP REQUIRED ---');
  console.log('Please do the following:');
  console.log('1. Log in if needed');
  console.log('2. Navigate to the Backlot workspace');
  console.log('3. Open a script that has content');
  console.log('4. Go to the Edit tab');
  console.log('5. Switch to PAGE VIEW (not inline view)');
  console.log('\nWaiting 60 seconds for you to navigate...\n');

  await page.waitForTimeout(60000); // Wait 60 seconds

  // Take screenshot of PAGE VIEW
  console.log('\n=== Capturing PAGE VIEW screenshot ===');
  await page.screenshot({
    path: `${SCREENSHOTS_DIR}/PAGE-VIEW-editor.png`,
    fullPage: true
  });
  console.log('✓ Screenshot saved: PAGE-VIEW-editor.png');

  console.log('\n--- MANUAL STEP REQUIRED ---');
  console.log('Now please:');
  console.log('1. Click on the View tab');
  console.log('2. Switch to Text view');
  console.log('\nWaiting 30 seconds for you to navigate...\n');

  await page.waitForTimeout(30000); // Wait 30 seconds

  // Take screenshot of Text viewer
  console.log('\n=== Capturing Text Viewer screenshot ===');
  await page.screenshot({
    path: `${SCREENSHOTS_DIR}/TEXT-VIEW-viewer.png`,
    fullPage: true
  });
  console.log('✓ Screenshot saved: TEXT-VIEW-viewer.png');

  console.log('\n=== Screenshots captured! ===');
  console.log('Saved files:');
  console.log('  - PAGE-VIEW-editor.png: Script Editor in PAGE VIEW mode');
  console.log('  - TEXT-VIEW-viewer.png: View tab in Text mode');
  console.log('\nKeeping browser open for 10 seconds so you can verify...\n');

  await page.waitForTimeout(10000);

  console.log('✓ Test complete!');
});
