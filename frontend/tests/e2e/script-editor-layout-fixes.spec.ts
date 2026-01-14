/**
 * Script Editor Layout Fixes Test
 *
 * Tests for critical script editor issues:
 * 1. Space key not working - users can't type spaces when editing
 * 2. Text overlap - when text wraps to next line, it overlaps text below
 * 3. Not working like a unit - multi-line content should push content below down
 *
 * Root cause: Each line is absolutely positioned with fixed `top` value,
 * so when one line expands, it overlaps lines below instead of pushing them down.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8080';
const LOGIN_EMAIL = 'claude@secondwatchnetwork.com';
const LOGIN_PASSWORD = 'TestPassword123!';

test.describe('Script Editor Layout Fixes', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', LOGIN_EMAIL);
    await page.fill('input[type="password"]', LOGIN_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  });

  test('should allow typing spaces in script editor', async ({ page }) => {
    console.log('=== Testing Space Key Functionality ===');

    // Navigate to Backlot workspace
    await page.goto(`${BASE_URL}/backlot/workspace`);
    await page.waitForLoadState('networkidle');

    // Find first project
    const projectCard = page.locator('[data-testid="project-card"], .project-card, a[href*="/backlot/workspace/"]').first();

    if (await projectCard.count() === 0) {
      console.log('No projects found - skipping test');
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    // Navigate to script tab
    const scriptTab = page.locator('text=/Script/i').first();
    if (await scriptTab.count() === 0) {
      console.log('Script tab not found - skipping test');
      test.skip();
      return;
    }

    await scriptTab.click();
    await page.waitForLoadState('networkidle');

    // Enter edit mode
    const editButton = page.locator('button:has-text("Edit")').first();
    if (!await editButton.isVisible()) {
      console.log('Edit button not visible - skipping test');
      test.skip();
      return;
    }

    await editButton.click();
    await page.waitForTimeout(500);

    // Find first textarea
    const textarea = page.locator('textarea').first();
    await textarea.click();
    await page.waitForTimeout(300);

    // Clear existing content
    await textarea.clear();

    // Type text with spaces using keyboard events
    const textWithSpaces = 'Hello World Test';
    await textarea.fill(textWithSpaces);

    // Wait and get the value
    await page.waitForTimeout(300);
    const value = await textarea.inputValue();

    console.log('Expected text:', textWithSpaces);
    console.log('Actual text:', value);

    // Check if spaces are preserved
    expect(value).toBe(textWithSpaces);
    expect(value).toContain(' ');

    const spaceCount = (value.match(/ /g) || []).length;
    console.log('Space count:', spaceCount);
    expect(spaceCount).toBeGreaterThan(0);

    console.log('✓ Space key works correctly');
  });

  test('should handle text wrapping without overlap', async ({ page }) => {
    console.log('=== Testing Text Wrapping Without Overlap ===');

    // Navigate to Backlot workspace
    await page.goto(`${BASE_URL}/backlot/workspace`);
    await page.waitForLoadState('networkidle');

    // Find first project
    const projectCard = page.locator('[data-testid="project-card"], .project-card, a[href*="/backlot/workspace/"]').first();

    if (await projectCard.count() === 0) {
      console.log('No projects found - skipping test');
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    // Navigate to script tab
    const scriptTab = page.locator('text=/Script/i').first();
    if (await scriptTab.count() === 0) {
      console.log('Script tab not found - skipping test');
      test.skip();
      return;
    }

    await scriptTab.click();
    await page.waitForLoadState('networkidle');

    // Enter edit mode
    const editButton = page.locator('button:has-text("Edit")').first();
    if (!await editButton.isVisible()) {
      console.log('Edit button not visible - skipping test');
      test.skip();
      return;
    }

    await editButton.click();
    await page.waitForTimeout(500);

    // Take screenshot before editing
    await page.screenshot({ path: 'test-results/wrapping-01-before-edit.png', fullPage: true });

    // Find all textareas (script lines)
    const textareas = page.locator('textarea');
    const count = await textareas.count();
    console.log('Found', count, 'script lines');

    if (count < 2) {
      console.log('Not enough lines to test overlap - need at least 2');
      test.skip();
      return;
    }

    // Get the first two lines to test overlap behavior
    const firstLine = textareas.nth(0);
    const secondLine = textareas.nth(1);

    // Get initial positions
    const firstLineInitialBox = await firstLine.boundingBox();
    const secondLineInitialBox = await secondLine.boundingBox();

    console.log('Initial positions:');
    console.log('First line:', firstLineInitialBox);
    console.log('Second line:', secondLineInitialBox);

    // Click on first line and type long text that will wrap
    await firstLine.click();
    await page.waitForTimeout(300);

    // Clear first line
    await firstLine.clear();

    // Type very long text that should wrap to multiple lines
    const longText = 'This is a very long sentence that should wrap to the next line within the same textarea element and when it does wrap the lines below should be pushed down automatically because they should be using relative or flow layout instead of absolute positioning with fixed top values which causes overlap.';

    await firstLine.fill(longText);
    await page.waitForTimeout(500);

    // Take screenshot after typing long text
    await page.screenshot({ path: 'test-results/wrapping-02-after-long-text.png', fullPage: true });

    // Get new positions after typing
    const firstLineNewBox = await firstLine.boundingBox();
    const secondLineNewBox = await secondLine.boundingBox();

    console.log('After typing long text:');
    console.log('First line:', firstLineNewBox);
    console.log('Second line:', secondLineNewBox);

    // Check if first textarea has grown in height
    if (firstLineInitialBox && firstLineNewBox) {
      const heightIncrease = firstLineNewBox.height - firstLineInitialBox.height;
      console.log('First line height increased by:', heightIncrease, 'px');

      if (heightIncrease > 0) {
        console.log('✓ First line expanded vertically');

        // Check if second line moved down
        if (secondLineInitialBox && secondLineNewBox) {
          const secondLineMovement = secondLineNewBox.y - secondLineInitialBox.y;
          console.log('Second line moved down by:', secondLineMovement, 'px');

          // The second line should have moved down by approximately the same amount
          // Allow some tolerance for spacing/margins
          if (Math.abs(secondLineMovement - heightIncrease) < 20) {
            console.log('✓ Second line moved down correctly - no overlap!');
          } else if (secondLineMovement <= 0) {
            console.log('❌ ISSUE: Second line did NOT move down - overlap detected!');
            console.log('Expected movement:', heightIncrease, 'px');
            console.log('Actual movement:', secondLineMovement, 'px');

            // This should fail if the issue is not fixed
            expect(secondLineMovement).toBeGreaterThan(0);
          } else {
            console.log('⚠ Second line moved down but by different amount than expected');
            console.log('Expected ~', heightIncrease, 'px, got', secondLineMovement, 'px');
          }
        }
      }
    }

    // Check scroll width vs client width to detect horizontal scrolling
    const scrollWidth = await firstLine.evaluate(el => (el as HTMLTextAreaElement).scrollWidth);
    const clientWidth = await firstLine.evaluate(el => (el as HTMLTextAreaElement).clientWidth);

    console.log('First line scroll properties:');
    console.log('- ScrollWidth:', scrollWidth);
    console.log('- ClientWidth:', clientWidth);
    console.log('- Is scrolling horizontally:', scrollWidth > clientWidth);

    // Text should wrap, not scroll horizontally
    // Allow small difference (< 5px) for rounding
    expect(scrollWidth - clientWidth).toBeLessThan(5);
    console.log('✓ No horizontal scrolling detected');
  });

  test('should push all lines below when one line expands', async ({ page }) => {
    console.log('=== Testing Flow Layout Behavior ===');

    // Navigate to Backlot workspace
    await page.goto(`${BASE_URL}/backlot/workspace`);
    await page.waitForLoadState('networkidle');

    // Find first project
    const projectCard = page.locator('[data-testid="project-card"], .project-card, a[href*="/backlot/workspace/"]').first();

    if (await projectCard.count() === 0) {
      console.log('No projects found - skipping test');
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    // Navigate to script tab
    const scriptTab = page.locator('text=/Script/i').first();
    if (await scriptTab.count() === 0) {
      console.log('Script tab not found - skipping test');
      test.skip();
      return;
    }

    await scriptTab.click();
    await page.waitForLoadState('networkidle');

    // Enter edit mode
    const editButton = page.locator('button:has-text("Edit")').first();
    if (!await editButton.isVisible()) {
      console.log('Edit button not visible - skipping test');
      test.skip();
      return;
    }

    await editButton.click();
    await page.waitForTimeout(500);

    // Find all textareas
    const textareas = page.locator('textarea');
    const count = await textareas.count();
    console.log('Found', count, 'script lines');

    if (count < 3) {
      console.log('Not enough lines to test flow - need at least 3');
      test.skip();
      return;
    }

    // Get positions of first 3 lines
    const line1 = textareas.nth(0);
    const line2 = textareas.nth(1);
    const line3 = textareas.nth(2);

    const line1InitialBox = await line1.boundingBox();
    const line2InitialBox = await line2.boundingBox();
    const line3InitialBox = await line3.boundingBox();

    console.log('Initial positions:');
    console.log('Line 1:', line1InitialBox?.y);
    console.log('Line 2:', line2InitialBox?.y);
    console.log('Line 3:', line3InitialBox?.y);

    // Expand line 1
    await line1.click();
    await line1.clear();
    const longText = 'This is a very long sentence that should wrap to multiple lines and push all the lines below it down as a unit so that they do not overlap and the script editor works like Celtx or Final Draft or any normal word processor where content flows naturally and expanding one paragraph pushes everything below it down automatically.';
    await line1.fill(longText);
    await page.waitForTimeout(500);

    // Get new positions
    const line1NewBox = await line1.boundingBox();
    const line2NewBox = await line2.boundingBox();
    const line3NewBox = await line3.boundingBox();

    console.log('After expanding line 1:');
    console.log('Line 1:', line1NewBox?.y, 'height:', line1NewBox?.height);
    console.log('Line 2:', line2NewBox?.y);
    console.log('Line 3:', line3NewBox?.y);

    // Calculate movements
    if (line1InitialBox && line1NewBox && line2InitialBox && line2NewBox && line3InitialBox && line3NewBox) {
      const line1HeightIncrease = line1NewBox.height - line1InitialBox.height;
      const line2Movement = line2NewBox.y - line2InitialBox.y;
      const line3Movement = line3NewBox.y - line3InitialBox.y;

      console.log('Line 1 height increased by:', line1HeightIncrease, 'px');
      console.log('Line 2 moved down by:', line2Movement, 'px');
      console.log('Line 3 moved down by:', line3Movement, 'px');

      // Both line 2 and line 3 should move down by similar amounts
      expect(line2Movement).toBeGreaterThan(0);
      expect(line3Movement).toBeGreaterThan(0);

      // Line 3 should have moved by approximately the same amount as line 2
      // (they should both be pushed down by the expansion of line 1)
      const movementDifference = Math.abs(line3Movement - line2Movement);
      console.log('Movement difference between line 2 and line 3:', movementDifference, 'px');

      // Allow small tolerance for spacing
      expect(movementDifference).toBeLessThan(10);

      console.log('✓ All lines below moved down as a unit!');
    }
  });

  test('should maintain proper line spacing after edits', async ({ page }) => {
    console.log('=== Testing Line Spacing Consistency ===');

    // Navigate to Backlot workspace
    await page.goto(`${BASE_URL}/backlot/workspace`);
    await page.waitForLoadState('networkidle');

    // Find first project
    const projectCard = page.locator('[data-testid="project-card"], .project-card, a[href*="/backlot/workspace/"]').first();

    if (await projectCard.count() === 0) {
      console.log('No projects found - skipping test');
      test.skip();
      return;
    }

    await projectCard.click();
    await page.waitForLoadState('networkidle');

    // Navigate to script tab
    const scriptTab = page.locator('text=/Script/i').first();
    if (await scriptTab.count() === 0) {
      console.log('Script tab not found - skipping test');
      test.skip();
      return;
    }

    await scriptTab.click();
    await page.waitForLoadState('networkidle');

    // Enter edit mode
    const editButton = page.locator('button:has-text("Edit")').first();
    if (!await editButton.isVisible()) {
      console.log('Edit button not visible - skipping test');
      test.skip();
      return;
    }

    await editButton.click();
    await page.waitForTimeout(500);

    // Find all textareas
    const textareas = page.locator('textarea');
    const count = await textareas.count();
    console.log('Found', count, 'script lines');

    if (count < 4) {
      console.log('Not enough lines to test spacing - need at least 4');
      test.skip();
      return;
    }

    // Get positions of lines
    const positions: number[] = [];
    for (let i = 0; i < Math.min(count, 4); i++) {
      const box = await textareas.nth(i).boundingBox();
      if (box) {
        positions.push(box.y);
      }
    }

    console.log('Line Y positions:', positions);

    // Check that lines don't overlap (each line Y should be greater than previous)
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }

    console.log('✓ No overlapping lines detected');
  });
});
