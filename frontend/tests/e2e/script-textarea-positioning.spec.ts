/**
 * Script Editor Textarea Positioning Test
 *
 * Purpose: Investigate and fix the issue where the text content shifts to the right
 * and gets cut off when clicking to edit a line in the script editor.
 *
 * The issue is that the textarea that appears when editing has different positioning
 * than the static text display (span).
 */

import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create screenshots directory if it doesn't exist
const screenshotsDir = path.join(__dirname, '../screenshots/textarea-positioning');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

test.describe('Script Editor Textarea Positioning', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];

    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      consoleErrors.push(`PAGE ERROR: ${error.message}`);
    });
  });

  test('capture textarea vs static text positioning differences', async ({ page }) => {
    console.log('\n=== Testing Textarea Positioning ===\n');

    // Set a consistent viewport size
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Step 1: Navigate to the login page
    console.log('Step 1: Navigating to login page');
    await page.goto('http://localhost:8080/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(screenshotsDir, '00-login-page.png'),
      fullPage: true
    });

    // Fill in login credentials
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    const emailInputVisible = await emailInput.isVisible().catch(() => false);

    if (emailInputVisible) {
      console.log('Login form detected - attempting to log in');
      await emailInput.fill('dan.estrin@secondwatchnetwork.com');

      const passwordInput = page.locator('input[type="password"]').first();
      await passwordInput.fill('Jz!6969!ZJ');

      await page.screenshot({
        path: path.join(screenshotsDir, '01-credentials-entered.png'),
        fullPage: true
      });

      // Click login button
      const loginButton = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In"), button:has-text("Login")').first();
      await loginButton.click();

      // Wait for navigation after login
      await page.waitForTimeout(5000);
      console.log('Login submitted');

      await page.screenshot({
        path: path.join(screenshotsDir, '02-after-login.png'),
        fullPage: true
      });
    } else {
      console.log('No login form found on /login page');
      return;
    }

    // Step 2: Navigate to Backlot
    console.log('Step 2: Navigating to Backlot');
    await page.goto('http://localhost:8080/backlot', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: path.join(screenshotsDir, '03-backlot-page.png'),
      fullPage: true
    });

    // Step 3: Find and click on a project
    console.log('Step 3: Finding a project');

    // Look for project cards or links - be more specific about backlot project links
    const projectLink = page.locator('a[href*="/backlot/projects/"]').first();
    const projectLinkVisible = await projectLink.isVisible().catch(() => false);

    if (projectLinkVisible) {
      console.log('Found project link, clicking...');
      const href = await projectLink.getAttribute('href');
      console.log(`Project href: ${href}`);
      await projectLink.click();
      await page.waitForTimeout(3000);
    } else {
      // Try to find any clickable card or project element
      const projectCard = page.locator('[class*="project"], [class*="card"]').filter({ hasText: /project/i }).first();
      const projectCardVisible = await projectCard.isVisible().catch(() => false);

      if (projectCardVisible) {
        await projectCard.click();
        await page.waitForTimeout(3000);
      } else {
        console.log('No project links found');
        await page.screenshot({
          path: path.join(screenshotsDir, '04-no-projects.png'),
          fullPage: true
        });

        // List all links on the page for debugging
        const allLinks = await page.locator('a[href]').all();
        console.log(`Found ${allLinks.length} links on the page`);
        for (let i = 0; i < Math.min(20, allLinks.length); i++) {
          const href = await allLinks[i].getAttribute('href');
          const text = await allLinks[i].textContent();
          console.log(`  Link ${i}: ${href} - "${text?.trim().substring(0, 30)}"`);
        }
        return;
      }
    }

    await page.screenshot({
      path: path.join(screenshotsDir, '05-project-page.png'),
      fullPage: true
    });

    // Step 4: Find and click Script in the sidebar
    console.log('Step 4: Looking for Script in sidebar');

    const scriptLink = page.locator('a:has-text("Script"), button:has-text("Script")').first();
    const scriptLinkVisible = await scriptLink.isVisible().catch(() => false);

    if (scriptLinkVisible) {
      console.log('Found Script link, clicking...');
      await scriptLink.click();
      await page.waitForTimeout(2000);
    } else {
      console.log('Script link not found in sidebar');

      // List sidebar items for debugging
      const sidebarItems = await page.locator('nav a, aside a, [class*="sidebar"] a').all();
      console.log(`Found ${sidebarItems.length} sidebar items`);
      for (let i = 0; i < Math.min(15, sidebarItems.length); i++) {
        const text = await sidebarItems[i].textContent();
        console.log(`  Sidebar ${i}: "${text?.trim()}"`);
      }
    }

    await page.screenshot({
      path: path.join(screenshotsDir, '06-script-page.png'),
      fullPage: true
    });

    // Step 5: Click on Editor tab
    console.log('Step 5: Clicking on Editor tab');
    const editorTab = page.locator('button:has-text("Editor"), [role="tab"]:has-text("Editor")').first();
    const editorTabVisible = await editorTab.isVisible().catch(() => false);

    if (!editorTabVisible) {
      console.log('Editor tab not visible');

      // List all tabs for debugging
      const tabs = await page.locator('[role="tab"], button').all();
      console.log(`Found ${tabs.length} tab/button elements`);
      for (let i = 0; i < Math.min(20, tabs.length); i++) {
        const text = await tabs[i].textContent();
        if (text && text.trim()) {
          console.log(`  Tab ${i}: "${text.trim().substring(0, 30)}"`);
        }
      }

      await page.screenshot({
        path: path.join(screenshotsDir, '07-no-editor-tab.png'),
        fullPage: true
      });
      return;
    }

    await editorTab.click();
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(screenshotsDir, '08-editor-tab.png'),
      fullPage: true
    });

    // Step 6: Switch to Page view mode
    console.log('Step 6: Switching to Page view mode');
    const pageViewButton = page.locator('button:has-text("Page")').first();
    const pageViewExists = await pageViewButton.isVisible().catch(() => false);
    if (pageViewExists) {
      await pageViewButton.click();
      await page.waitForTimeout(1000);
    }

    // Step 7: Click Edit button to enter edit mode
    console.log('Step 7: Clicking Edit button');
    const editButton = page.locator('button:has-text("Edit")').first();
    const editButtonExists = await editButton.isVisible().catch(() => false);

    if (!editButtonExists) {
      console.log('Edit button not found');
      await page.screenshot({
        path: path.join(screenshotsDir, '09-no-edit-button.png'),
        fullPage: true
      });
      return;
    }

    await editButton.click();
    await page.waitForTimeout(1000);

    // Take screenshot of edit mode
    await page.screenshot({
      path: path.join(screenshotsDir, '10-edit-mode-enabled.png'),
      fullPage: true
    });
    console.log('Screenshot saved: 10-edit-mode-enabled.png');

    // Step 8: Find a dialogue or action line to test
    console.log('Step 8: Looking for script lines to test');

    // Find the script page content area - look for the white page background
    const pageContent = page.locator('.bg-white').first();
    const pageContentVisible = await pageContent.isVisible().catch(() => false);

    if (!pageContentVisible) {
      console.log('Page content not visible');
      await page.screenshot({
        path: path.join(screenshotsDir, '11-no-page-content.png'),
        fullPage: true
      });
      return;
    }

    // Look for lines with text content - these are the script lines
    // They are divs with absolute positioning that contain either a span (view) or textarea (edit)
    const scriptLines = page.locator('.bg-white .absolute.cursor-text');
    const lineCount = await scriptLines.count();
    console.log(`Found ${lineCount} script lines`);

    if (lineCount === 0) {
      console.log('No script lines found with .absolute.cursor-text selector');

      // Try alternative selector
      const altLines = page.locator('.bg-white div[style*="position: absolute"]');
      const altLineCount = await altLines.count();
      console.log(`Found ${altLineCount} lines with alternative selector`);

      await page.screenshot({
        path: path.join(screenshotsDir, '12-no-script-lines.png'),
        fullPage: true
      });
      return;
    }

    // Find a line with actual text content (not empty)
    let targetLineIndex = -1;
    for (let i = 0; i < Math.min(lineCount, 30); i++) {
      const line = scriptLines.nth(i);
      const text = await line.textContent();
      if (text && text.trim().length > 5) {
        targetLineIndex = i;
        console.log(`Found target line at index ${i}: "${text.trim().substring(0, 50)}"`);
        break;
      }
    }

    if (targetLineIndex === -1) {
      console.log('No suitable line found with text content');
      return;
    }

    const targetLine = scriptLines.nth(targetLineIndex);

    // Step 9: Capture BEFORE clicking (static text - span)
    console.log('Step 9: Capturing BEFORE state (static span)');

    // Get the bounding box of the line
    const beforeBox = await targetLine.boundingBox();
    console.log('Line bounding box BEFORE click:', beforeBox);

    // Get the span element and its computed styles
    const spanElement = targetLine.locator('span');
    const spanExists = await spanElement.isVisible().catch(() => false);

    let spanStylesBefore: any = null;
    if (spanExists) {
      spanStylesBefore = await spanElement.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          // Position
          offsetLeft: (el as HTMLElement).offsetLeft,
          offsetTop: (el as HTMLElement).offsetTop,
          // Computed styles
          paddingLeft: computed.paddingLeft,
          paddingRight: computed.paddingRight,
          marginLeft: computed.marginLeft,
          marginRight: computed.marginRight,
          textAlign: computed.textAlign,
          // Bounding rect
          rectLeft: rect.left,
          rectWidth: rect.width,
          textContent: el.textContent?.substring(0, 50)
        };
      });
      console.log('Span element styles BEFORE click:', spanStylesBefore);
    }

    // Take screenshot with the line highlighted
    await targetLine.evaluate((el) => {
      el.style.outline = '2px solid red';
    });

    await page.screenshot({
      path: path.join(screenshotsDir, '13-before-click-static-span.png'),
      fullPage: true
    });
    console.log('Screenshot saved: 13-before-click-static-span.png');

    // Take a close-up screenshot of just the line area
    await targetLine.screenshot({
      path: path.join(screenshotsDir, '14-before-click-line-closeup.png')
    });
    console.log('Screenshot saved: 14-before-click-line-closeup.png');

    // Remove highlight before clicking
    await targetLine.evaluate((el) => {
      el.style.outline = '';
    });

    // Step 10: Click on the line to switch to textarea
    console.log('Step 10: Clicking on line to switch to textarea');
    await targetLine.click();
    await page.waitForTimeout(500);

    // Step 11: Capture AFTER clicking (textarea)
    console.log('Step 11: Capturing AFTER state (textarea)');

    // Get the bounding box of the line after click
    const afterBox = await targetLine.boundingBox();
    console.log('Line bounding box AFTER click:', afterBox);

    // Get the textarea element and its computed styles
    const textareaElement = targetLine.locator('textarea');
    const textareaExists = await textareaElement.isVisible().catch(() => false);

    let textareaStylesAfter: any = null;
    if (textareaExists) {
      textareaStylesAfter = await textareaElement.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          // Position
          offsetLeft: (el as HTMLElement).offsetLeft,
          offsetTop: (el as HTMLElement).offsetTop,
          // Computed styles
          paddingLeft: computed.paddingLeft,
          paddingRight: computed.paddingRight,
          marginLeft: computed.marginLeft,
          marginRight: computed.marginRight,
          textAlign: computed.textAlign,
          width: computed.width,
          boxSizing: computed.boxSizing,
          // Bounding rect
          rectLeft: rect.left,
          rectWidth: rect.width,
          // Additional textarea specific
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          value: (el as HTMLTextAreaElement).value?.substring(0, 50)
        };
      });
      console.log('Textarea element styles AFTER click:', textareaStylesAfter);
    } else {
      console.log('Textarea not found after click!');
    }

    // Take screenshot with the line highlighted
    await targetLine.evaluate((el) => {
      el.style.outline = '2px solid blue';
    });

    await page.screenshot({
      path: path.join(screenshotsDir, '15-after-click-textarea.png'),
      fullPage: true
    });
    console.log('Screenshot saved: 15-after-click-textarea.png');

    // Take a close-up screenshot of just the line area
    await targetLine.screenshot({
      path: path.join(screenshotsDir, '16-after-click-line-closeup.png')
    });
    console.log('Screenshot saved: 16-after-click-line-closeup.png');

    // Step 12: Compare positions
    console.log('\n=== Position Comparison ===');
    if (beforeBox && afterBox) {
      console.log(`Before click: x=${beforeBox.x}, y=${beforeBox.y}, width=${beforeBox.width}`);
      console.log(`After click:  x=${afterBox.x}, y=${afterBox.y}, width=${afterBox.width}`);
      console.log(`Difference:   dx=${afterBox.x - beforeBox.x}, dwidth=${afterBox.width - beforeBox.width}`);
    }

    if (spanStylesBefore && textareaStylesAfter) {
      console.log('\n=== Style Comparison ===');
      console.log(`Span paddingLeft: ${spanStylesBefore.paddingLeft} vs Textarea paddingLeft: ${textareaStylesAfter.paddingLeft}`);
      console.log(`Span marginLeft:  ${spanStylesBefore.marginLeft} vs Textarea marginLeft:  ${textareaStylesAfter.marginLeft}`);
      console.log(`Span rectLeft:    ${spanStylesBefore.rectLeft} vs Textarea rectLeft:    ${textareaStylesAfter.rectLeft}`);
      console.log(`Span rectWidth:   ${spanStylesBefore.rectWidth} vs Textarea rectWidth:   ${textareaStylesAfter.rectWidth}`);

      const leftDiff = textareaStylesAfter.rectLeft - spanStylesBefore.rectLeft;
      console.log(`\nText position shift: ${leftDiff}px to the right`);

      if (Math.abs(leftDiff) > 1) {
        console.log('ISSUE DETECTED: Text position shifts when entering edit mode!');
      }
    }

    // Step 13: Log console errors
    if (consoleErrors.length > 0) {
      console.log('\nConsole Errors:');
      consoleErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    } else {
      console.log('\nNo console errors detected');
    }

    console.log('\n=== Test Complete ===');
  });
});
