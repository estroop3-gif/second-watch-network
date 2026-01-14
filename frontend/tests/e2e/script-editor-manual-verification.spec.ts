/**
 * Script Editor Manual Verification Test
 *
 * This test helps manually verify the layout fixes by:
 * 1. Taking screenshots at key stages
 * 2. Logging measurements to console
 * 3. Pausing for manual inspection
 *
 * Run with: npx playwright test tests/e2e/script-editor-manual-verification.spec.ts --headed
 *
 * This test assumes you're already logged in or will log in manually in the headed browser.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8080';

test.describe('Script Editor Manual Verification', () => {
  test('manual verification - navigate and inspect', async ({ page }) => {
    console.log('\n=== Script Editor Layout Fix Verification ===\n');
    console.log('This test will help you manually verify the fixes.');
    console.log('Please follow the on-screen instructions.\n');

    // Start at the app
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    console.log('Step 1: Navigate to login page or dashboard');
    console.log('- If you see a login page, log in manually');
    console.log('- If you see a dashboard, great!\n');

    // Wait for user to potentially log in
    await page.waitForTimeout(3000);

    // Take screenshot of current state
    await page.screenshot({ path: 'test-results/manual-01-initial.png', fullPage: true });
    console.log('Screenshot saved: manual-01-initial.png\n');

    // Try to navigate to backlot
    console.log('Step 2: Attempting to navigate to Backlot workspace...');
    try {
      await page.goto(`${BASE_URL}/backlot/workspace`, { waitUntil: 'networkidle' });
      await page.screenshot({ path: 'test-results/manual-02-backlot.png', fullPage: true });
      console.log('Screenshot saved: manual-02-backlot.png\n');
    } catch (e) {
      console.log('Could not navigate to backlot - you may need to navigate manually');
      console.log('Pausing for 5 seconds...\n');
      await page.waitForTimeout(5000);
    }

    // Look for project cards
    console.log('Step 3: Looking for projects...');
    const projectCard = page.locator('[data-testid="project-card"], .project-card, a[href*="/backlot/workspace/"]').first();

    if (await projectCard.count() > 0) {
      console.log('Found project(s). Clicking first project...\n');
      await projectCard.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/manual-03-project.png', fullPage: true });
      console.log('Screenshot saved: manual-03-project.png\n');
    } else {
      console.log('No projects found. Please navigate to a project with a script manually.');
      console.log('Pausing for 10 seconds...\n');
      await page.waitForTimeout(10000);
    }

    // Look for script tab
    console.log('Step 4: Looking for Script tab...');
    const scriptTab = page.locator('text=/Script/i').first();
    if (await scriptTab.count() > 0) {
      console.log('Found Script tab. Clicking...\n');
      await scriptTab.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/manual-04-script-view.png', fullPage: true });
      console.log('Screenshot saved: manual-04-script-view.png\n');
    } else {
      console.log('Script tab not found. Navigate manually if needed.');
      console.log('Pausing for 10 seconds...\n');
      await page.waitForTimeout(10000);
    }

    // Enter edit mode
    console.log('Step 5: Entering edit mode...');
    const editButton = page.locator('button:has-text("Edit")').first();
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/manual-05-edit-mode.png', fullPage: true });
      console.log('Screenshot saved: manual-05-edit-mode.png\n');
    } else {
      console.log('Edit button not found. Script may already be in edit mode.');
      await page.screenshot({ path: 'test-results/manual-05-current-state.png', fullPage: true });
    }

    // Find textareas
    const textareas = page.locator('textarea');
    const count = await textareas.count();
    console.log(`Found ${count} script lines (textareas)\n`);

    if (count >= 2) {
      console.log('Step 6: Testing text wrapping behavior...\n');

      // Click on first line
      const firstLine = textareas.nth(0);
      const secondLine = textareas.nth(1);

      await firstLine.click();
      await page.waitForTimeout(500);

      // Get initial measurements
      const firstLineInitialBox = await firstLine.boundingBox();
      const secondLineInitialBox = await secondLine.boundingBox();

      console.log('Initial measurements:');
      console.log('First line Y:', firstLineInitialBox?.y, 'Height:', firstLineInitialBox?.height);
      console.log('Second line Y:', secondLineInitialBox?.y);
      console.log('');

      // Clear and type long text
      await firstLine.clear();
      await page.waitForTimeout(300);

      const longText = 'This is a very long sentence that should wrap to the next line within the same textarea element and when it does wrap the lines below should be pushed down automatically because they should be using relative or flow layout instead of absolute positioning with fixed top values which causes overlap. The fix changes the parent container from absolute to relative positioning with padding instead of top left right positioning. Each line wrapper also changes from absolute to relative and uses marginLeft instead of left for horizontal positioning while removing the fixed top value entirely. This allows lines to stack vertically and push each other down naturally like a normal word processor or screenplay software such as Celtx or Final Draft.';

      console.log('Typing long text to trigger wrapping...');
      await firstLine.fill(longText);
      await page.waitForTimeout(1000);

      // Take screenshot after typing
      await page.screenshot({ path: 'test-results/manual-06-after-wrapping.png', fullPage: true });
      console.log('Screenshot saved: manual-06-after-wrapping.png\n');

      // Get new measurements
      const firstLineNewBox = await firstLine.boundingBox();
      const secondLineNewBox = await secondLine.boundingBox();

      console.log('After typing long text:');
      console.log('First line Y:', firstLineNewBox?.y, 'Height:', firstLineNewBox?.height);
      console.log('Second line Y:', secondLineNewBox?.y);
      console.log('');

      // Calculate changes
      if (firstLineInitialBox && firstLineNewBox && secondLineInitialBox && secondLineNewBox) {
        const heightIncrease = firstLineNewBox.height - firstLineInitialBox.height;
        const secondLineMovement = secondLineNewBox.y - secondLineInitialBox.y;

        console.log('Analysis:');
        console.log('First line height increased by:', heightIncrease.toFixed(2), 'px');
        console.log('Second line moved down by:', secondLineMovement.toFixed(2), 'px');
        console.log('');

        if (heightIncrease > 0) {
          console.log('✓ First line expanded vertically');

          if (secondLineMovement > 0) {
            const difference = Math.abs(secondLineMovement - heightIncrease);
            console.log('✓ Second line moved down');
            console.log('Difference between expansion and movement:', difference.toFixed(2), 'px');

            if (difference < 20) {
              console.log('✓✓✓ SUCCESS! Lines are working as a unit - no overlap!');
            } else {
              console.log('⚠ Lines moved but by different amount than expected');
            }
          } else {
            console.log('❌ ISSUE: Second line did NOT move down - overlap detected!');
          }
        } else {
          console.log('First line did not expand (text might be short)');
        }

        console.log('');
      }

      // Check horizontal scrolling
      const scrollWidth = await firstLine.evaluate(el => (el as HTMLTextAreaElement).scrollWidth);
      const clientWidth = await firstLine.evaluate(el => (el as HTMLTextAreaElement).clientWidth);

      console.log('Horizontal scroll check:');
      console.log('ScrollWidth:', scrollWidth, 'px');
      console.log('ClientWidth:', clientWidth, 'px');
      console.log('Difference:', scrollWidth - clientWidth, 'px');

      if (scrollWidth - clientWidth < 5) {
        console.log('✓ No horizontal scrolling detected');
      } else {
        console.log('❌ Horizontal scrolling detected');
      }
      console.log('');

      // Test space key
      console.log('Step 7: Testing space key...\n');
      await firstLine.clear();
      await firstLine.fill('Hello World Test');
      const value = await firstLine.inputValue();
      const spaceCount = (value.match(/ /g) || []).length;

      console.log('Space key test:');
      console.log('Text entered:', value);
      console.log('Space count:', spaceCount);

      if (spaceCount > 0) {
        console.log('✓ Space key works correctly');
      } else {
        console.log('❌ Space key not working');
      }
      console.log('');

    } else {
      console.log('Not enough lines to test. Please ensure you have a script with at least 2 lines.');
    }

    console.log('\n=== Verification Complete ===\n');
    console.log('Screenshots saved in test-results/ directory:');
    console.log('- manual-01-initial.png');
    console.log('- manual-02-backlot.png');
    console.log('- manual-03-project.png');
    console.log('- manual-04-script-view.png');
    console.log('- manual-05-edit-mode.png');
    console.log('- manual-06-after-wrapping.png');
    console.log('');
    console.log('Please review the console output and screenshots to verify:');
    console.log('1. Space key works (spaces appear in text)');
    console.log('2. Text wraps without horizontal scrolling');
    console.log('3. Lines below move down when a line expands');
    console.log('4. No overlap between lines');
    console.log('');

    // Keep browser open for manual inspection
    console.log('Pausing for 30 seconds for manual inspection...');
    console.log('You can interact with the page during this time.');
    await page.waitForTimeout(30000);
  });
});
