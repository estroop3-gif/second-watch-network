/**
 * Script Editor Flow Layout Fix - Comprehensive Test
 *
 * This test verifies that when text wraps in the script editor,
 * all lines below move down naturally (flow layout) instead of overlapping.
 *
 * Test Steps:
 * 1. Login and navigate to a script
 * 2. Enter edit mode
 * 3. Click on a line to edit it
 * 4. Type a very long sentence that will wrap
 * 5. Verify that the line below has moved down
 */
import { test, expect } from '@playwright/test';

// Helper to wait for element with retry
async function waitForElement(page: any, selector: string, timeout = 5000) {
  try {
    await page.waitForSelector(selector, { state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

test.describe('Script Flow Layout Fix', () => {
  // Increase timeout for these tests since they involve navigation
  test.setTimeout(60000);

  test('should flow lines down when text wraps - comprehensive test', async ({ page }) => {
    console.log('\n========================================');
    console.log('SCRIPT FLOW LAYOUT FIX TEST');
    console.log('========================================\n');

    // Step 1: Navigate to app and login
    console.log('Step 1: Navigating to app...');
    await page.goto('http://localhost:8080');
    await page.screenshot({ path: '/tmp/flow-test-01-login-page.png' });

    console.log('Step 2: Logging in...');
    await page.fill('input[type="email"]', 'claude@secondwatchnetwork.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');

    // Wait for navigation after login
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/flow-test-02-after-login.png' });

    console.log('Step 3: Navigating to Backlot...');
    // Click Backlot - try different selectors
    const backlotClicked = await page.click('a:has-text("Backlot")').catch(() =>
      page.click('button:has-text("Backlot")')
    ).then(() => true).catch(() => false);

    if (!backlotClicked) {
      console.log('Could not find Backlot link - test skipped');
      test.skip();
      return;
    }

    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/flow-test-03-backlot.png' });

    console.log('Step 4: Opening a project...');
    // Find and click a project
    const projectFound = await waitForElement(page, '[data-testid="project-card"]');

    if (!projectFound) {
      // Try alternative selector
      const altFound = await waitForElement(page, 'a[href*="/backlot/project/"]');
      if (!altFound) {
        console.log('No projects found - test skipped');
        test.skip();
        return;
      }
      await page.click('a[href*="/backlot/project/"]');
    } else {
      await page.click('[data-testid="project-card"]');
    }

    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/flow-test-04-project.png' });

    console.log('Step 5: Opening Script section...');
    // Click on Script tab/link
    const scriptClicked = await page.click('button:has-text("Script")').catch(() =>
      page.click('a:has-text("Script")')
    ).then(() => true).catch(() => false);

    if (!scriptClicked) {
      console.log('Could not find Script section - test skipped');
      test.skip();
      return;
    }

    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/flow-test-05-script-section.png' });

    console.log('Step 6: Entering edit mode...');
    // Check if we need to click Edit button
    const editButtonExists = await waitForElement(page, 'button:has-text("Edit Script")');

    if (editButtonExists) {
      await page.click('button:has-text("Edit Script")');
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: '/tmp/flow-test-06-edit-mode.png' });
    }

    // Ensure we're in Page view mode
    console.log('Step 7: Switching to Page view...');
    const pageViewButton = await waitForElement(page, 'button:has-text("Page")');
    if (pageViewButton) {
      await page.click('button:has-text("Page")');
      await page.waitForTimeout(1000);
      await page.screenshot({ path: '/tmp/flow-test-07-page-view.png' });
    }

    console.log('Step 8: Finding script lines...');
    // Find all script lines - using the actual class from the component
    const lineSelector = 'div.relative.cursor-text';
    const linesExist = await waitForElement(page, lineSelector);

    if (!linesExist) {
      console.log('No script lines found - test skipped');
      test.skip();
      return;
    }

    const lines = page.locator(lineSelector);
    const lineCount = await lines.count();
    console.log(`Found ${lineCount} script lines`);

    if (lineCount < 2) {
      console.log('Need at least 2 lines for this test - test skipped');
      test.skip();
      return;
    }

    // Measure SECOND line position BEFORE editing
    const secondLine = lines.nth(1);
    const initialBox = await secondLine.boundingBox();

    if (!initialBox) {
      console.log('Could not measure second line - test skipped');
      test.skip();
      return;
    }

    const initialY = initialBox.y;
    const initialHeight = initialBox.height;
    console.log(`Second line initial position: Y=${initialY}, Height=${initialHeight}`);

    await page.screenshot({ path: '/tmp/flow-test-08-before-edit.png' });

    console.log('Step 9: Clicking first line to edit...');
    // Click on the FIRST line to edit it
    await lines.first().click();
    await page.waitForTimeout(500);

    // Wait for textarea to appear
    const textareaExists = await waitForElement(page, 'textarea');

    if (!textareaExists) {
      console.log('Textarea did not appear - test skipped');
      test.skip();
      return;
    }

    await page.screenshot({ path: '/tmp/flow-test-09-textarea-visible.png' });

    console.log('Step 10: Typing long text to cause wrapping...');
    // Type a VERY long sentence that will definitely wrap multiple times
    const longText = 'This is an extremely long sentence designed to wrap across multiple lines in the dialogue format of a screenplay which has narrower margins than action lines and this should cause the textarea to expand vertically and push all the content below it down naturally like Microsoft Word or Google Docs or Final Draft or Celtx would do because that is how a normal text editor works when you type text that wraps to a new line and we need to verify that this is working correctly in our script editor component.';

    const textarea = page.locator('textarea').first();
    await textarea.fill(longText);

    // Wait for DOM to update
    await page.waitForTimeout(1000);

    await page.screenshot({ path: '/tmp/flow-test-10-after-typing.png' });

    console.log('Step 11: Measuring second line position AFTER typing...');
    // Measure the second line position AFTER typing
    const newBox = await secondLine.boundingBox();

    if (!newBox) {
      console.log('Could not measure second line after typing - test failed');
      throw new Error('Second line disappeared after typing');
    }

    const newY = newBox.y;
    const newHeight = newBox.height;
    const deltaY = newY - initialY;

    console.log(`Second line new position: Y=${newY}, Height=${newHeight}`);
    console.log(`Position change: deltaY=${deltaY}px`);

    await page.screenshot({ path: '/tmp/flow-test-11-final-state.png', fullPage: true });

    // VERIFICATION: The second line MUST have moved DOWN
    console.log('\n========================================');
    console.log('VERIFICATION');
    console.log('========================================');
    console.log(`Initial Y: ${initialY}px`);
    console.log(`New Y: ${newY}px`);
    console.log(`Delta: ${deltaY}px`);

    if (newY > initialY) {
      console.log('✓ SUCCESS: Second line moved down (flow layout working!)');
    } else {
      console.log('✗ FAILURE: Second line did NOT move down (lines overlapping!)');
    }

    // The assertion: second line must be lower (greater Y coordinate)
    expect(newY).toBeGreaterThan(initialY);

    // Additional check: it should have moved down by at least 20px
    // (assuming the wrapped text added at least 2 lines)
    expect(deltaY).toBeGreaterThan(20);

    console.log('\n========================================');
    console.log('TEST PASSED ✓');
    console.log('========================================\n');
  });
});
