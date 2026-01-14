/**
 * E2E Test: Script Dialogue Editing - Line Position Shift Bug
 *
 * Tests the reported bug where editing a dialogue line causes lines below
 * it to shift position to the left incorrectly.
 *
 * Bug description:
 * - When typing in a dialogue field in the script editor
 * - Lines below shift position to the left
 * - This is a dynamic rendering bug caused by incorrect re-parsing or re-detection
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';

// Test credentials
const TEST_EMAIL = 'claude@secondwatchnetwork.com';
const TEST_PASSWORD = 'TestPassword123!';

// Helper to take a screenshot with a meaningful name
async function takeScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const screenshotPath = path.join(__dirname, `screenshots/${timestamp}-${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Screenshot saved: ${screenshotPath}`);
  return screenshotPath;
}

test.describe('Script Dialogue Editing Bug', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:8080');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should reproduce dialogue line editing causing lines below to shift left', async ({ page }) => {
    // Step 1: Log in
    console.log('Step 1: Logging in...');

    // Look for email input - could be on login page or dashboard
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.waitFor({ timeout: 10000 });
    await emailInput.fill(TEST_EMAIL);

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill(TEST_PASSWORD);

    // Click sign in button
    const signInButton = page.getByRole('button', { name: /sign in|log in/i });
    await signInButton.click();

    // Wait for navigation after login
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('Logged in successfully');
    await takeScreenshot(page, 'after-login');

    // Step 2: Navigate to Backlot
    console.log('Step 2: Navigating to Backlot...');

    // Look for Backlot navigation link
    const backlotLink = page.getByRole('link', { name: /backlot/i }).first();
    await backlotLink.waitFor({ timeout: 10000 });
    await backlotLink.click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    console.log('Navigated to Backlot');
    await takeScreenshot(page, 'backlot-page');

    // Step 3: Look for a project with a script
    console.log('Step 3: Looking for a project with a script...');

    // Find all project cards
    const projectCards = page.locator('[data-testid="project-card"], .project-card, [class*="project"]').first();

    // If no projects, try to find any clickable element that looks like a project
    if (await projectCards.count() === 0) {
      console.log('No project cards found with standard selectors, looking for any project links...');
      // Try to find any link or button that might lead to a project
      const projectLinks = page.locator('a, button').filter({ hasText: /project|script/i });
      if (await projectLinks.count() > 0) {
        await projectLinks.first().click();
      }
    } else {
      await projectCards.first().click();
    }

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    console.log('Opened a project');
    await takeScreenshot(page, 'project-opened');

    // Step 4: Navigate to Script view
    console.log('Step 4: Navigating to Script view...');

    // Look for Script tab or link
    const scriptTab = page.getByRole('link', { name: /script/i }).or(
      page.getByRole('tab', { name: /script/i })
    ).or(
      page.getByRole('button', { name: /script/i })
    ).first();

    await scriptTab.waitFor({ timeout: 10000 });
    await scriptTab.click();

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('Opened Script view');
    await takeScreenshot(page, 'script-view-initial');

    // Step 5: Start editing mode
    console.log('Step 5: Starting edit mode...');

    // Look for Edit button
    const editButton = page.getByRole('button', { name: /edit/i }).first();

    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForTimeout(1000);
      console.log('Clicked Edit button');
      await takeScreenshot(page, 'edit-mode-activated');
    } else {
      console.log('Edit button not found or already in edit mode');
    }

    // Step 6: Find and measure dialogue lines before editing
    console.log('Step 6: Finding dialogue lines...');

    // Wait for script content to be visible
    await page.waitForTimeout(1000);

    // Take screenshot of script before editing
    await takeScreenshot(page, 'before-editing');

    // Find all lines in the script - they should be in divs with specific positioning
    const allLines = page.locator('[class*="absolute"]').filter({ hasText: /.+/ });
    const lineCount = await allLines.count();
    console.log(`Found ${lineCount} lines in the script`);

    // Find dialogue lines specifically (they should have dialogue positioning)
    // We'll click on any line to start editing
    let dialogueLine = null;
    let dialogueLineIndex = -1;

    for (let i = 0; i < Math.min(lineCount, 20); i++) {
      const line = allLines.nth(i);
      const text = await line.textContent();

      // Skip empty lines and scene headings (they're usually all caps starting with INT/EXT)
      if (text && text.trim() && !text.trim().match(/^(INT\.|EXT\.)/i)) {
        // Check if this line has dialogue-like positioning (should be indented)
        const boundingBox = await line.boundingBox();
        if (boundingBox && boundingBox.x > 200) { // Dialogue should be indented from left
          dialogueLine = line;
          dialogueLineIndex = i;
          console.log(`Found potential dialogue line at index ${i}: "${text.substring(0, 50)}..."`);
          break;
        }
      }
    }

    if (!dialogueLine) {
      // Fallback: just use the 5th line if we can't find dialogue
      dialogueLine = allLines.nth(5);
      dialogueLineIndex = 5;
      console.log('Could not identify dialogue line, using line at index 5');
    }

    // Measure positions of lines BEFORE editing
    const linesBeforeEdit = [];
    for (let i = dialogueLineIndex; i < Math.min(dialogueLineIndex + 10, lineCount); i++) {
      const line = allLines.nth(i);
      const boundingBox = await line.boundingBox();
      const text = await line.textContent();
      if (boundingBox && text) {
        linesBeforeEdit.push({
          index: i,
          x: boundingBox.x,
          y: boundingBox.y,
          text: text.trim().substring(0, 30),
        });
      }
    }

    console.log('Lines before editing:');
    linesBeforeEdit.forEach(line => {
      console.log(`  Line ${line.index}: x=${line.x.toFixed(2)}, y=${line.y.toFixed(2)}, text="${line.text}"`);
    });

    // Step 7: Click on the dialogue line to start editing
    console.log('Step 7: Clicking on dialogue line to edit...');

    await dialogueLine.click();
    await page.waitForTimeout(500);

    await takeScreenshot(page, 'line-clicked-for-editing');

    // Step 8: Type in the textarea
    console.log('Step 8: Typing in the dialogue field...');

    // Find the textarea that should now be active
    const textarea = page.locator('textarea').first();
    await textarea.waitFor({ timeout: 5000 });

    // Type some text
    await textarea.fill('This is new dialogue text that I am typing');
    await page.waitForTimeout(500);

    await takeScreenshot(page, 'during-editing');

    // Step 9: Measure positions of lines AFTER editing (while still in edit mode)
    console.log('Step 9: Measuring line positions after typing...');

    // Re-query all lines
    const allLinesAfter = page.locator('[class*="absolute"]').filter({ hasText: /.+/ });
    const lineCountAfter = await allLinesAfter.count();
    console.log(`Found ${lineCountAfter} lines after editing`);

    const linesAfterEdit = [];
    for (let i = dialogueLineIndex + 1; i < Math.min(dialogueLineIndex + 10, lineCountAfter); i++) {
      const line = allLinesAfter.nth(i);
      const boundingBox = await line.boundingBox();
      const text = await line.textContent();
      if (boundingBox && text) {
        linesAfterEdit.push({
          index: i,
          x: boundingBox.x,
          y: boundingBox.y,
          text: text.trim().substring(0, 30),
        });
      }
    }

    console.log('Lines after editing:');
    linesAfterEdit.forEach(line => {
      console.log(`  Line ${line.index}: x=${line.x.toFixed(2)}, y=${line.y.toFixed(2)}, text="${line.text}"`);
    });

    // Step 10: Compare positions
    console.log('Step 10: Comparing line positions...');

    const positionChanges = [];
    for (let i = 0; i < Math.min(linesBeforeEdit.length - 1, linesAfterEdit.length); i++) {
      const before = linesBeforeEdit[i + 1]; // Skip the edited line itself
      const after = linesAfterEdit[i];

      if (before && after) {
        const xDiff = after.x - before.x;
        const yDiff = after.y - before.y;

        positionChanges.push({
          index: before.index,
          xDiff,
          yDiff,
          text: before.text,
        });

        console.log(`  Line ${before.index} ("${before.text}"): x shift = ${xDiff.toFixed(2)}px, y shift = ${yDiff.toFixed(2)}px`);
      }
    }

    // Step 11: Check for the bug - lines should NOT shift left
    console.log('Step 11: Checking for position shifts...');

    const significantXShifts = positionChanges.filter(change => Math.abs(change.xDiff) > 5);

    if (significantXShifts.length > 0) {
      console.error('BUG DETECTED: Lines shifted horizontally during editing!');
      significantXShifts.forEach(change => {
        console.error(`  Line ${change.index}: shifted ${change.xDiff.toFixed(2)}px (text: "${change.text}")`);
      });

      await takeScreenshot(page, 'bug-detected-lines-shifted');

      // This assertion will fail, documenting the bug
      expect(significantXShifts.length).toBe(0);
    } else {
      console.log('No significant horizontal shifts detected - lines maintained their positions correctly');
    }

    await takeScreenshot(page, 'final-state');
  });
});
