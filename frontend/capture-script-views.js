#!/usr/bin/env node

/**
 * Standalone Script View Comparison Tool
 *
 * This script helps capture screenshots of the Script Editor PAGE VIEW
 * and View tab Text viewer for comparison.
 *
 * Usage:
 *   node capture-script-views.js
 *
 * Then follow the on-screen prompts to capture screenshots.
 */

const { chromium } = require('@playwright/test');
const readline = require('readline');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('\n========================================');
  console.log('Script View Comparison Tool');
  console.log('========================================\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Opening http://localhost:8080...\n');
  await page.goto('http://localhost:8080');

  console.log('STEP 1: Navigate to PAGE VIEW');
  console.log('------------------------------');
  console.log('Please manually:');
  console.log('  1. Log in to the application');
  console.log('  2. Navigate to Backlot workspace');
  console.log('  3. Open a script with content');
  console.log('  4. Go to the Edit tab');
  console.log('  5. Switch to PAGE VIEW (not inline view)');
  console.log('  6. Make sure the content is visible\n');

  await question('Press ENTER when you are ready to capture PAGE VIEW... ');

  console.log('\nCapturing PAGE VIEW screenshot...');
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'FINAL-page-view-editor.png'),
    fullPage: true
  });
  console.log('✓ Saved: FINAL-page-view-editor.png\n');

  console.log('STEP 2: Navigate to TEXT VIEW');
  console.log('------------------------------');
  console.log('Please manually:');
  console.log('  1. Click on the View tab');
  console.log('  2. Switch to Text view');
  console.log('  3. Make sure the content is visible\n');

  await question('Press ENTER when you are ready to capture TEXT VIEW... ');

  console.log('\nCapturing TEXT VIEW screenshot...');
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'FINAL-text-viewer.png'),
    fullPage: true
  });
  console.log('✓ Saved: FINAL-text-viewer.png\n');

  console.log('========================================');
  console.log('✓ Screenshots captured successfully!');
  console.log('========================================');
  console.log('\nFiles saved in:', SCREENSHOTS_DIR);
  console.log('  - FINAL-page-view-editor.png');
  console.log('  - FINAL-text-viewer.png\n');

  console.log('Closing browser in 5 seconds...');
  await page.waitForTimeout(5000);

  await browser.close();
  rl.close();

  console.log('\nDone! You can now compare the two screenshots.\n');
}

main().catch(error => {
  console.error('Error:', error);
  rl.close();
  process.exit(1);
});
