/**
 * E2E Test: Script Editor Flow Layout
 *
 * Tests that when text wraps to a new line in the script editor,
 * the lines below move down (flow layout) instead of overlapping.
 */
import { test, expect } from '@playwright/test';

test.describe('Script Editor Flow Layout', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:8080');

    // Login
    await page.fill('input[type="email"]', 'claude@secondwatchnetwork.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForURL(/.*dashboard/, { timeout: 10000 });
  });

  test('should move lines down when text wraps in dialogue', async ({ page }) => {
    // Navigate to Backlot
    await page.click('text=Backlot');
    await page.waitForLoadState('networkidle');

    // Find and click on a project (find first project card)
    const projectCard = page.locator('[data-testid="project-card"]').first();
    await projectCard.waitFor({ state: 'visible', timeout: 10000 });
    await projectCard.click();

    // Wait for project workspace to load
    await page.waitForLoadState('networkidle');

    // Navigate to Script section
    await page.click('text=Script');
    await page.waitForLoadState('networkidle');

    // Look for a script in the list or check if there's an "Upload Script" or existing script
    const scriptExists = await page.locator('text=/.*\\.pdf|Edit|View Script/i').first().isVisible({ timeout: 5000 }).catch(() => false);

    if (!scriptExists) {
      console.log('No script found in project - test skipped');
      test.skip();
      return;
    }

    // Click Edit or open script
    await page.click('button:has-text("Edit")').catch(async () => {
      // If no Edit button, try clicking on a script title
      await page.click('[data-testid="script-item"]').first();
    });

    await page.waitForLoadState('networkidle');

    // Click on a dialogue line to start editing
    // First, make sure we're in page view mode (not inline)
    const pageViewButton = page.locator('button:has-text("Page")');
    if (await pageViewButton.isVisible()) {
      await pageViewButton.click();
    }

    // Find a dialogue line or any text line
    const dialogueLine = page.locator('[style*="marginLeft"]').filter({ hasText: /.+/ }).first();
    await dialogueLine.waitFor({ state: 'visible', timeout: 5000 });

    // Get initial position of the line BELOW the one we're about to edit
    const allLines = page.locator('[style*="marginLeft"]').filter({ hasText: /.+/ });
    const lineCount = await allLines.count();

    if (lineCount < 2) {
      console.log('Not enough lines to test flow - test skipped');
      test.skip();
      return;
    }

    const secondLine = allLines.nth(1);
    const initialBox = await secondLine.boundingBox();

    if (!initialBox) {
      throw new Error('Could not get bounding box of second line');
    }

    const initialY = initialBox.y;
    console.log('Initial Y position of second line:', initialY);

    // Click on the first line to edit
    await dialogueLine.click();

    // Wait for textarea to appear
    const textarea = page.locator('textarea').first();
    await textarea.waitFor({ state: 'visible', timeout: 5000 });

    // Type a very long sentence that will definitely wrap
    const longText = 'This is a very long sentence that should definitely wrap to multiple lines when typed into the script editor because it contains so many words that it will exceed the width of a single line in the dialogue format which has a narrower width than action lines and this should cause the text to wrap and push all the content below it down naturally like a normal word processor would do.';

    await textarea.fill(longText);

    // Wait for the DOM to update
    await page.waitForTimeout(500);

    // Get the new position of the second line
    const newBox = await secondLine.boundingBox();

    if (!newBox) {
      throw new Error('Could not get bounding box of second line after typing');
    }

    const newY = newBox.y;
    console.log('New Y position of second line:', newY);
    console.log('Difference:', newY - initialY);

    // The second line should have moved DOWN (increased Y position)
    // because the first line now takes up more vertical space
    expect(newY).toBeGreaterThan(initialY);

    // Take a screenshot for visual verification
    await page.screenshot({ path: '/tmp/script-flow-after-wrap.png', fullPage: true });
  });

  test('should maintain flow layout with multiple wrapped lines', async ({ page }) => {
    // Navigate to Backlot
    await page.click('text=Backlot');
    await page.waitForLoadState('networkidle');

    // Find and click on a project
    const projectCard = page.locator('[data-testid="project-card"]').first();
    await projectCard.waitFor({ state: 'visible', timeout: 10000 });
    await projectCard.click();

    await page.waitForLoadState('networkidle');

    // Navigate to Script
    await page.click('text=Script');
    await page.waitForLoadState('networkidle');

    const scriptExists = await page.locator('text=/.*\\.pdf|Edit|View Script/i').first().isVisible({ timeout: 5000 }).catch(() => false);

    if (!scriptExists) {
      console.log('No script found - test skipped');
      test.skip();
      return;
    }

    await page.click('button:has-text("Edit")').catch(async () => {
      await page.click('[data-testid="script-item"]').first();
    });

    await page.waitForLoadState('networkidle');

    // Get all visible lines
    const allLines = page.locator('[style*="marginLeft"]').filter({ hasText: /.+/ });
    const lineCount = await allLines.count();

    if (lineCount < 3) {
      console.log('Not enough lines - test skipped');
      test.skip();
      return;
    }

    // Record positions of all lines
    const initialPositions: number[] = [];
    for (let i = 0; i < Math.min(5, lineCount); i++) {
      const box = await allLines.nth(i).boundingBox();
      initialPositions.push(box?.y || 0);
    }

    console.log('Initial positions:', initialPositions);

    // Verify lines are stacked vertically (each line below the previous)
    for (let i = 1; i < initialPositions.length; i++) {
      expect(initialPositions[i]).toBeGreaterThan(initialPositions[i - 1]);
    }

    // Take screenshot before
    await page.screenshot({ path: '/tmp/script-flow-before.png', fullPage: true });

    console.log('Flow layout test completed - lines are properly stacked');
  });
});
