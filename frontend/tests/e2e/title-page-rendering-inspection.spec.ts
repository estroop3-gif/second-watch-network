/**
 * Title Page Rendering Inspection Test
 *
 * This interactive test allows manual navigation to capture screenshots
 * of the title page in both Edit and View tabs to diagnose rendering issues.
 *
 * User reported issues:
 * - Title page not centered vertically
 * - Font size incorrect (should be 12pt Courier)
 * - Contact info positioning issues
 * - Page rendering problems (white pages with black text expected)
 */

import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCREENSHOTS_DIR = path.join(__dirname, 'title-page-screenshots');
const SIGNAL_FILE = path.join(SCREENSHOTS_DIR, 'ready-signal.txt');

test.setTimeout(600000); // 10 minutes total timeout for manual interaction

test('Title Page Rendering Inspection - Interactive', async ({ page }) => {
  console.log('\n==============================================');
  console.log('Title Page Rendering Inspection');
  console.log('==============================================\n');

  // Create screenshots directory
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  // Clear any existing signal file
  if (fs.existsSync(SIGNAL_FILE)) {
    fs.unlinkSync(SIGNAL_FILE);
  }

  // Set viewport for consistency
  await page.setViewportSize({ width: 1920, height: 1080 });

  console.log('Opening browser at http://localhost:8080...');
  await page.goto('http://localhost:8080');
  await page.waitForTimeout(2000);

  console.log('\n==============================================');
  console.log('STEP 1: Navigate to Script View Tab - Title Page');
  console.log('==============================================');
  console.log('Please do the following manually:');
  console.log('  1. Log in to the application');
  console.log('  2. Navigate to Backlot section');
  console.log('  3. Open a project with a script that has a title page');
  console.log('  4. Go to the Script section');
  console.log('  5. Click on the "View" tab');
  console.log('  6. Make sure the title page is visible on screen');
  console.log('');
  console.log('What to observe:');
  console.log('  - Is the title centered vertically on the page?');
  console.log('  - Is the font Courier and 12pt?');
  console.log('  - Is contact info at bottom left?');
  console.log('  - Are pages white with black text?');
  console.log('');
  console.log('When you are viewing the title page in VIEW tab, create signal file:');
  console.log(`  touch ${SIGNAL_FILE}`);
  console.log('\nWaiting for signal file...\n');

  // Wait for signal file
  let timeout = 0;
  while (!fs.existsSync(SIGNAL_FILE) && timeout < 480000) {
    await page.waitForTimeout(1000);
    timeout += 1000;
    if (timeout % 15000 === 0) {
      console.log(`Still waiting... (${timeout / 1000}s elapsed)`);
    }
  }

  if (!fs.existsSync(SIGNAL_FILE)) {
    console.log('⚠ Timeout waiting for signal file');
    return;
  }

  console.log('✓ Signal received! Capturing screenshots...');
  await page.waitForTimeout(1000);

  // Capture full page screenshot
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, '01-view-tab-title-page-full.png'),
    fullPage: true
  });
  console.log('✓ Screenshot saved: 01-view-tab-title-page-full.png');

  // Capture viewport screenshot
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, '02-view-tab-title-page-viewport.png'),
    fullPage: false
  });
  console.log('✓ Screenshot saved: 02-view-tab-title-page-viewport.png');

  // Try to capture just the title page element if we can find it
  const titlePageSelectors = [
    '.bg-white',
    '[class*="title-page"]',
    '[class*="script-page"]',
    '[style*="612px"]',
    '[data-testid*="title"]'
  ];

  for (const selector of titlePageSelectors) {
    const element = page.locator(selector).first();
    if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
      await element.screenshot({
        path: path.join(SCREENSHOTS_DIR, `03-isolated-title-page-${selector.replace(/[^a-z0-9]/gi, '-')}.png`)
      });
      console.log(`✓ Captured isolated element with selector: ${selector}`);
      break;
    }
  }

  // Capture computed styles
  const viewTabStyles = await page.evaluate(() => {
    const results: any = {
      url: window.location.href,
      timestamp: new Date().toISOString()
    };

    // Find title page container
    const containers = document.querySelectorAll('.bg-white, [class*="title-page"], [class*="script-page"]');
    if (containers.length > 0) {
      const container = containers[0] as HTMLElement;
      const styles = window.getComputedStyle(container);

      results.container = {
        selector: container.className || container.tagName,
        width: styles.width,
        height: styles.height,
        backgroundColor: styles.backgroundColor,
        color: styles.color,
        fontFamily: styles.fontFamily,
        fontSize: styles.fontSize,
        display: styles.display,
        alignItems: styles.alignItems,
        justifyContent: styles.justifyContent,
        textAlign: styles.textAlign,
        padding: styles.padding,
        margin: styles.margin,
      };

      // Get all text elements
      const textElements = container.querySelectorAll('*');
      results.textElements = Array.from(textElements).slice(0, 20).map(el => {
        const elStyles = window.getComputedStyle(el as HTMLElement);
        return {
          tagName: el.tagName,
          className: (el as HTMLElement).className,
          textContent: (el.textContent || '').trim().substring(0, 100),
          fontSize: elStyles.fontSize,
          fontFamily: elStyles.fontFamily,
          fontWeight: elStyles.fontWeight,
          textAlign: elStyles.textAlign,
          color: elStyles.color,
          position: elStyles.position,
          top: elStyles.top,
          left: elStyles.left,
          bottom: elStyles.bottom,
        };
      });
    }

    return results;
  });

  // Save style info
  fs.writeFileSync(
    path.join(SCREENSHOTS_DIR, 'view-tab-styles.json'),
    JSON.stringify(viewTabStyles, null, 2)
  );
  console.log('✓ Style information saved: view-tab-styles.json');

  // Delete signal file
  fs.unlinkSync(SIGNAL_FILE);

  console.log('\n==============================================');
  console.log('STEP 2: Navigate to Edit Tab - Title View');
  console.log('==============================================');
  console.log('Now please:');
  console.log('  1. Click on the "Edit" tab');
  console.log('  2. Click on "Title" button (if there are mode buttons)');
  console.log('  3. Make sure you are viewing the title page in edit mode');
  console.log('  4. Make sure the title page form/editor is visible');
  console.log('');
  console.log('When ready, create the signal file again:');
  console.log(`  touch ${SIGNAL_FILE}`);
  console.log('\nWaiting for signal file...\n');

  // Wait for signal file again
  timeout = 0;
  while (!fs.existsSync(SIGNAL_FILE) && timeout < 480000) {
    await page.waitForTimeout(1000);
    timeout += 1000;
    if (timeout % 15000 === 0) {
      console.log(`Still waiting... (${timeout / 1000}s elapsed)`);
    }
  }

  if (!fs.existsSync(SIGNAL_FILE)) {
    console.log('⚠ Timeout waiting for signal file');
    return;
  }

  console.log('✓ Signal received! Capturing Edit tab screenshots...');
  await page.waitForTimeout(1000);

  // Capture full page screenshot
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, '04-edit-tab-title-view-full.png'),
    fullPage: true
  });
  console.log('✓ Screenshot saved: 04-edit-tab-title-view-full.png');

  // Capture viewport screenshot
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, '05-edit-tab-title-view-viewport.png'),
    fullPage: false
  });
  console.log('✓ Screenshot saved: 05-edit-tab-title-view-viewport.png');

  // Try to capture the title page preview in edit mode
  const previewSelectors = [
    '.bg-white',
    '[class*="preview"]',
    '[class*="title-page"]',
    '[style*="612px"]'
  ];

  for (const selector of previewSelectors) {
    const element = page.locator(selector).first();
    if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
      await element.screenshot({
        path: path.join(SCREENSHOTS_DIR, `06-edit-preview-${selector.replace(/[^a-z0-9]/gi, '-')}.png`)
      });
      console.log(`✓ Captured edit preview with selector: ${selector}`);
      break;
    }
  }

  // Capture computed styles in edit mode
  const editTabStyles = await page.evaluate(() => {
    const results: any = {
      url: window.location.href,
      timestamp: new Date().toISOString()
    };

    // Find title page container or preview
    const containers = document.querySelectorAll('.bg-white, [class*="title-page"], [class*="preview"], [class*="script-page"]');
    if (containers.length > 0) {
      const container = containers[0] as HTMLElement;
      const styles = window.getComputedStyle(container);

      results.container = {
        selector: container.className || container.tagName,
        width: styles.width,
        height: styles.height,
        backgroundColor: styles.backgroundColor,
        color: styles.color,
        fontFamily: styles.fontFamily,
        fontSize: styles.fontSize,
        display: styles.display,
        alignItems: styles.alignItems,
        justifyContent: styles.justifyContent,
        textAlign: styles.textAlign,
        padding: styles.padding,
        margin: styles.margin,
      };

      // Get all text elements
      const textElements = container.querySelectorAll('*');
      results.textElements = Array.from(textElements).slice(0, 20).map(el => {
        const elStyles = window.getComputedStyle(el as HTMLElement);
        return {
          tagName: el.tagName,
          className: (el as HTMLElement).className,
          textContent: (el.textContent || '').trim().substring(0, 100),
          fontSize: elStyles.fontSize,
          fontFamily: elStyles.fontFamily,
          fontWeight: elStyles.fontWeight,
          textAlign: elStyles.textAlign,
          color: elStyles.color,
          position: elStyles.position,
          top: elStyles.top,
          left: elStyles.left,
          bottom: elStyles.bottom,
        };
      });
    }

    // Also look for form inputs
    const formInputs = document.querySelectorAll('input, textarea, select');
    results.formElements = Array.from(formInputs).slice(0, 10).map(el => {
      return {
        tagName: el.tagName,
        type: (el as HTMLInputElement).type,
        name: (el as HTMLInputElement).name,
        placeholder: (el as HTMLInputElement).placeholder,
        value: (el as HTMLInputElement).value?.substring(0, 50),
      };
    });

    return results;
  });

  // Save edit tab style info
  fs.writeFileSync(
    path.join(SCREENSHOTS_DIR, 'edit-tab-styles.json'),
    JSON.stringify(editTabStyles, null, 2)
  );
  console.log('✓ Edit tab style information saved: edit-tab-styles.json');

  // Cleanup
  if (fs.existsSync(SIGNAL_FILE)) {
    fs.unlinkSync(SIGNAL_FILE);
  }

  // Capture console logs
  const consoleLogs: string[] = [];
  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  // Capture any console errors
  page.on('pageerror', error => {
    consoleLogs.push(`[ERROR] ${error.message}`);
  });

  // Save console logs
  fs.writeFileSync(
    path.join(SCREENSHOTS_DIR, 'console-logs.txt'),
    consoleLogs.join('\n')
  );

  // Create summary report
  const report = {
    timestamp: new Date().toISOString(),
    viewTabStyles,
    editTabStyles,
    consoleLogs,
    screenshots: [
      '01-view-tab-title-page-full.png',
      '02-view-tab-title-page-viewport.png',
      '03-isolated-title-page-*.png',
      '04-edit-tab-title-view-full.png',
      '05-edit-tab-title-view-viewport.png',
      '06-edit-preview-*.png'
    ],
    issues_to_check: {
      vertical_centering: 'Check if title is centered vertically on page',
      font_size: 'Should be 12pt Courier font',
      contact_info_position: 'Should be at bottom left',
      page_colors: 'Should be white pages with black text'
    }
  };

  fs.writeFileSync(
    path.join(SCREENSHOTS_DIR, 'inspection-report.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('\n==============================================');
  console.log('INSPECTION COMPLETE');
  console.log('==============================================');
  console.log('Screenshots and data saved to:');
  console.log(SCREENSHOTS_DIR);
  console.log('');
  console.log('Files created:');
  console.log('  - 01-view-tab-title-page-full.png');
  console.log('  - 02-view-tab-title-page-viewport.png');
  console.log('  - 03-isolated-title-page-*.png (if found)');
  console.log('  - 04-edit-tab-title-view-full.png');
  console.log('  - 05-edit-tab-title-view-viewport.png');
  console.log('  - 06-edit-preview-*.png (if found)');
  console.log('  - view-tab-styles.json');
  console.log('  - edit-tab-styles.json');
  console.log('  - console-logs.txt');
  console.log('  - inspection-report.json');
  console.log('');
  console.log('Review the screenshots and JSON files to diagnose:');
  console.log('  1. Vertical centering of title');
  console.log('  2. Font family and size (should be Courier 12pt)');
  console.log('  3. Contact info positioning (bottom left)');
  console.log('  4. Page colors (white background, black text)');
  console.log('==============================================\n');
});
