/**
 * Script Editor Investigation Test
 *
 * Purpose: Investigate reported issues with the script editor:
 * 1. First page formatting is wrong - everything is centered instead of properly formatted
 * 2. The "Edit Title Page" CTA button is covering other buttons and should be in the toolbar
 *
 * This test will navigate to the Progressive Dental project's script editor,
 * capture screenshots of different views, and document console errors.
 */

import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

// Progressive Dental project ID
const PROJECT_ID = 'd837dec7-f17a-4f1c-b808-dc668ebec699';
const SCRIPT_EDITOR_URL = `/backlot/projects/${PROJECT_ID}/scripts`;

test.describe('Script Editor Investigation', () => {
  let consoleMessages: string[] = [];
  let consoleErrors: string[] = [];
  let consoleWarnings: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Capture console messages
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push(`[${msg.type()}] ${text}`);

      if (msg.type() === 'error') {
        consoleErrors.push(text);
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(text);
      }
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      consoleErrors.push(`PAGE ERROR: ${error.message}\n${error.stack}`);
    });
  });

  test('investigate script editor UI and capture screenshots', async ({ page }) => {
    console.log('\n=== Starting Script Editor Investigation ===\n');

    // Step 1: Navigate to the app
    console.log('Step 1: Navigating to http://localhost:8080');
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });

    // Take screenshot of landing page
    await page.screenshot({
      path: path.join(__dirname, '../screenshots/01-landing-page.png'),
      fullPage: true
    });
    console.log('✓ Screenshot saved: 01-landing-page.png');

    // Step 2: Check if we're already logged in or need to login
    console.log('\nStep 2: Checking authentication status');
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    // Check if login form is present
    const loginFormVisible = await page.locator('input[type="email"], input[name="email"]').isVisible()
      .catch(() => false);

    if (loginFormVisible) {
      console.log('⚠ Login required - authentication blocks access');
      await page.screenshot({
        path: path.join(__dirname, '../screenshots/02-login-required.png'),
        fullPage: true
      });
      console.log('✓ Screenshot saved: 02-login-required.png');

      // Document what we can see from the code instead
      console.log('\n=== Code Analysis (Authentication Required) ===');
      console.log('The script editor requires authentication to access.');
      console.log('From code analysis:');
      console.log('- ScriptEditorPanel has three view modes: title, page, inline');
      console.log('- "Edit Title Page" button is positioned absolutely in page and inline views');
      console.log('- Button location: lines 1118-1130 and 1151-1163 in ScriptEditorPanel.tsx');
      console.log('- Issue: Floating button uses absolute positioning which may overlap toolbar');

      return;
    }

    console.log('✓ Already authenticated or no login required');

    // Step 3: Navigate to the script editor
    console.log(`\nStep 3: Navigating to script editor: ${SCRIPT_EDITOR_URL}`);
    await page.goto(`http://localhost:8080${SCRIPT_EDITOR_URL}`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForTimeout(2000);

    // Take screenshot of the initial script view
    await page.screenshot({
      path: path.join(__dirname, '../screenshots/03-script-view-initial.png'),
      fullPage: true
    });
    console.log('✓ Screenshot saved: 03-script-view-initial.png');

    // Step 4: Look for the Editor tab
    console.log('\nStep 4: Looking for Editor tab');
    const editorTab = page.locator('button', { hasText: 'Editor' }).or(
      page.locator('[role="tab"]', { hasText: 'Editor' })
    );

    const editorTabVisible = await editorTab.isVisible().catch(() => false);

    if (!editorTabVisible) {
      console.log('⚠ Editor tab not found - may need to import a script first');
      await page.screenshot({
        path: path.join(__dirname, '../screenshots/04-no-editor-tab.png'),
        fullPage: true
      });
      console.log('✓ Screenshot saved: 04-no-editor-tab.png');
    } else {
      console.log('✓ Editor tab found, clicking it');
      await editorTab.click();
      await page.waitForTimeout(1500);

      // Step 5: Capture Page View (default view)
      console.log('\nStep 5: Capturing Page View');

      // Look for the view mode buttons
      const pageViewButton = page.locator('button', { hasText: 'Page' }).or(
        page.locator('button:has-text("Page")')
      );

      const pageViewExists = await pageViewButton.isVisible().catch(() => false);
      if (pageViewExists) {
        await pageViewButton.click();
        await page.waitForTimeout(1000);
      }

      await page.screenshot({
        path: path.join(__dirname, '../screenshots/05-editor-page-view.png'),
        fullPage: true
      });
      console.log('✓ Screenshot saved: 05-editor-page-view.png');

      // Capture close-up of the first page area
      const firstPage = page.locator('.bg-white').first();
      if (await firstPage.isVisible().catch(() => false)) {
        await firstPage.screenshot({
          path: path.join(__dirname, '../screenshots/06-first-page-closeup.png')
        });
        console.log('✓ Screenshot saved: 06-first-page-closeup.png');
      }

      // Step 6: Look for the "Edit Title Page" button
      console.log('\nStep 6: Searching for "Edit Title Page" button');
      const editTitlePageButton = page.locator('button:has-text("Edit Title Page")');
      const editButtonExists = await editTitlePageButton.isVisible().catch(() => false);

      if (editButtonExists) {
        console.log('✓ "Edit Title Page" button found');

        // Get button position
        const buttonBox = await editTitlePageButton.boundingBox();
        if (buttonBox) {
          console.log(`  Position: x=${buttonBox.x}, y=${buttonBox.y}`);
          console.log(`  Size: width=${buttonBox.width}, height=${buttonBox.height}`);
        }

        // Check if it's overlapping with toolbar
        const toolbar = page.locator('.border-b.border-muted-gray\\/20').first();
        const toolbarBox = await toolbar.boundingBox().catch(() => null);

        if (toolbarBox && buttonBox) {
          const overlapping = buttonBox.y < (toolbarBox.y + toolbarBox.height);
          if (overlapping) {
            console.log('  ⚠ WARNING: Button may be overlapping with toolbar!');
          }
        }

        // Highlight the button area
        await editTitlePageButton.evaluate((el) => {
          el.style.border = '3px solid red';
          el.style.boxShadow = '0 0 10px red';
        });

        await page.screenshot({
          path: path.join(__dirname, '../screenshots/07-edit-button-highlighted.png'),
          fullPage: true
        });
        console.log('✓ Screenshot saved: 07-edit-button-highlighted.png (button highlighted in red)');
      } else {
        console.log('⚠ "Edit Title Page" button not found');
      }

      // Step 7: Check Title View
      console.log('\nStep 7: Switching to Title View');
      const titleViewButton = page.locator('button', { hasText: 'Title' }).or(
        page.locator('button:has-text("Title")')
      );

      const titleViewExists = await titleViewButton.isVisible().catch(() => false);
      if (titleViewExists) {
        await titleViewButton.click();
        await page.waitForTimeout(1000);

        await page.screenshot({
          path: path.join(__dirname, '../screenshots/08-editor-title-view.png'),
          fullPage: true
        });
        console.log('✓ Screenshot saved: 08-editor-title-view.png');

        // Capture the title page content specifically
        const titlePageContent = page.locator('.bg-white').first();
        if (await titlePageContent.isVisible().catch(() => false)) {
          await titlePageContent.screenshot({
            path: path.join(__dirname, '../screenshots/09-title-page-content.png')
          });
          console.log('✓ Screenshot saved: 09-title-page-content.png');
        }
      }

      // Step 8: Check Inline View
      console.log('\nStep 8: Switching to Inline View');
      const inlineViewButton = page.locator('button', { hasText: 'Inline' }).or(
        page.locator('button:has-text("Inline")')
      );

      const inlineViewExists = await inlineViewButton.isVisible().catch(() => false);
      if (inlineViewExists) {
        await inlineViewButton.click();
        await page.waitForTimeout(1000);

        await page.screenshot({
          path: path.join(__dirname, '../screenshots/10-editor-inline-view.png'),
          fullPage: true
        });
        console.log('✓ Screenshot saved: 10-editor-inline-view.png');

        // Check if Edit Title Page button is visible in inline view too
        const editButtonInInline = await editTitlePageButton.isVisible().catch(() => false);
        if (editButtonInInline) {
          await editTitlePageButton.evaluate((el) => {
            el.style.border = '3px solid red';
            el.style.boxShadow = '0 0 10px red';
          });

          await page.screenshot({
            path: path.join(__dirname, '../screenshots/11-inline-edit-button-highlighted.png'),
            fullPage: true
          });
          console.log('✓ Screenshot saved: 11-inline-edit-button-highlighted.png');
        }
      }

      // Step 9: Analyze the DOM structure
      console.log('\nStep 9: Analyzing DOM structure');

      // Check for formatting elements
      const scriptElements = await page.locator('[style*="textAlign"]').count();
      console.log(`Found ${scriptElements} elements with textAlign styling`);

      const centeredElements = await page.locator('[style*="center"]').count();
      console.log(`Found ${centeredElements} elements with center alignment`);
    }

    // Step 10: Log all console messages
    console.log('\n=== Console Messages ===');
    if (consoleErrors.length > 0) {
      console.log('\n🔴 ERRORS:');
      consoleErrors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err}`);
      });
    } else {
      console.log('✓ No console errors detected');
    }

    if (consoleWarnings.length > 0) {
      console.log('\n⚠ WARNINGS:');
      consoleWarnings.forEach((warn, i) => {
        console.log(`  ${i + 1}. ${warn}`);
      });
    } else {
      console.log('✓ No console warnings detected');
    }

    console.log('\n=== Investigation Complete ===');
  });

  test('analyze ScriptPageView first page formatting', async ({ page }) => {
    console.log('\n=== Analyzing First Page Formatting ===\n');

    // Navigate to the script editor
    await page.goto(`http://localhost:8080${SCRIPT_EDITOR_URL}`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForTimeout(2000);

    // Click Editor tab if visible
    const editorTab = page.locator('button:has-text("Editor")');
    const editorTabVisible = await editorTab.isVisible().catch(() => false);

    if (editorTabVisible) {
      await editorTab.click();
      await page.waitForTimeout(1500);

      // Switch to Page view
      const pageViewButton = page.locator('button:has-text("Page")');
      const pageViewExists = await pageViewButton.isVisible().catch(() => false);
      if (pageViewExists) {
        await pageViewButton.click();
        await page.waitForTimeout(1000);
      }

      // Analyze the first page's content
      console.log('Analyzing first page content...');

      // Look for elements with specific formatting
      const allTextElements = await page.locator('.bg-white .text-black, .bg-white [style*="text"]').all();

      console.log(`Found ${allTextElements.length} text elements on the page`);

      for (let i = 0; i < Math.min(10, allTextElements.length); i++) {
        const el = allTextElements[i];
        const text = await el.textContent();
        const styles = await el.evaluate((node) => {
          const computed = window.getComputedStyle(node);
          return {
            textAlign: computed.textAlign,
            marginLeft: computed.marginLeft,
            paddingLeft: computed.paddingLeft,
            display: computed.display,
          };
        });

        if (text && text.trim()) {
          console.log(`\nElement ${i + 1}:`);
          console.log(`  Text: "${text.trim().substring(0, 50)}${text.trim().length > 50 ? '...' : ''}"`);
          console.log(`  Styles:`, styles);
        }
      }

      // Check if title page formatting is being applied incorrectly
      const centeredElements = await page.locator('[style*="center"]').all();
      console.log(`\nFound ${centeredElements.length} centered elements`);

      if (centeredElements.length > 0) {
        console.log('⚠ Warning: Multiple centered elements detected on first page');
        console.log('This may indicate title page formatting is being applied to script content');
      }
    }
  });

  test.afterEach(async ({ page }) => {
    // Generate summary
    console.log('\n=== Test Summary ===');
    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`Console errors: ${consoleErrors.length}`);
    console.log(`Console warnings: ${consoleWarnings.length}`);
  });
});
