import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOTS_DIR = '/home/estro/second-watch-network/frontend/screenshots';
const SIGNAL_FILE = path.join(SCREENSHOTS_DIR, 'ready-signal.txt');

test.setTimeout(300000); // 5 minutes total timeout

test('Interactive Script View Comparison', async ({ page }) => {
  console.log('\n==============================================');
  console.log('Interactive Script View Comparison Test');
  console.log('==============================================\n');

  // Clear any existing signal file
  if (fs.existsSync(SIGNAL_FILE)) {
    fs.unlinkSync(SIGNAL_FILE);
  }

  console.log('Opening browser...');
  await page.goto('http://localhost:8080');
  await page.waitForTimeout(2000);

  console.log('\n--- STEP 1: Navigate to PAGE VIEW ---');
  console.log('Please do the following manually:');
  console.log('  1. Log in to the application');
  console.log('  2. Navigate to Backlot workspace');
  console.log('  3. Open a script with content');
  console.log('  4. Click on the "Edit" tab (or "Editor" tab)');
  console.log('  5. Switch to PAGE VIEW mode (NOT inline view)');
  console.log('  6. Make sure the script content is visible on screen');
  console.log('\nWhen ready, create a file to signal:');
  console.log(`  touch ${SIGNAL_FILE}`);
  console.log('\nWaiting for signal file...\n');

  // Wait for signal file
  let timeout = 0;
  while (!fs.existsSync(SIGNAL_FILE) && timeout < 240000) {
    await page.waitForTimeout(1000);
    timeout += 1000;
    if (timeout % 10000 === 0) {
      console.log(`Still waiting... (${timeout / 1000}s elapsed)`);
    }
  }

  if (!fs.existsSync(SIGNAL_FILE)) {
    console.log('⚠ Timeout waiting for signal file');
    return;
  }

  console.log('✓ Signal received! Capturing PAGE VIEW screenshot...');
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: `${SCREENSHOTS_DIR}/COMPARE-page-view.png`,
    fullPage: true
  });
  console.log('✓ Screenshot saved: COMPARE-page-view.png');

  // Delete signal file
  fs.unlinkSync(SIGNAL_FILE);

  console.log('\n--- STEP 2: Navigate to TEXT VIEW ---');
  console.log('Now please:');
  console.log('  1. Click on the "View" tab');
  console.log('  2. Switch to "Text" view mode');
  console.log('  3. Make sure the text viewer content is visible');
  console.log('\nWhen ready, create the signal file again:');
  console.log(`  touch ${SIGNAL_FILE}`);
  console.log('\nWaiting for signal file...\n');

  // Wait for signal file again
  timeout = 0;
  while (!fs.existsSync(SIGNAL_FILE) && timeout < 120000) {
    await page.waitForTimeout(1000);
    timeout += 1000;
    if (timeout % 10000 === 0) {
      console.log(`Still waiting... (${timeout / 1000}s elapsed)`);
    }
  }

  if (!fs.existsSync(SIGNAL_FILE)) {
    console.log('⚠ Timeout waiting for signal file');
    return;
  }

  console.log('✓ Signal received! Capturing TEXT VIEW screenshot...');
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: `${SCREENSHOTS_DIR}/COMPARE-text-view.png`,
    fullPage: true
  });
  console.log('✓ Screenshot saved: COMPARE-text-view.png');

  // Cleanup
  if (fs.existsSync(SIGNAL_FILE)) {
    fs.unlinkSync(SIGNAL_FILE);
  }

  console.log('\n==============================================');
  console.log('✓ Both screenshots captured successfully!');
  console.log('==============================================');
  console.log('\nScreenshots saved:');
  console.log('  - COMPARE-page-view.png');
  console.log('  - COMPARE-text-view.png');
  console.log('\nKeeping browser open for 10 seconds...\n');

  await page.waitForTimeout(10000);
});
