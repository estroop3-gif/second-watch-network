/**
 * Script Editor Text Wrapping Test
 *
 * Tests for text wrapping issue where typing long text in the script editor
 * causes horizontal scrolling instead of wrapping to the next line.
 *
 * Issue: When typing dialogue or action, reaching the end of the line should wrap
 * the text to the next line (like a normal word processor), not scroll horizontally.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8080';
const LOGIN_EMAIL = 'claude@secondwatchnetwork.com';
const LOGIN_PASSWORD = 'TestPassword123!';

test.describe('Script Editor Text Wrapping', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', LOGIN_EMAIL);
    await page.fill('input[type="password"]', LOGIN_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  });

  test('should reproduce horizontal scrolling issue when typing long text', async ({ page }) => {
    // Navigate to Backlot workspace
    await page.goto(`${BASE_URL}/backlot/workspace`);

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Look for a project with an imported script
    // First, let's see what's on the page
    await page.screenshot({ path: 'test-results/01-backlot-workspace.png', fullPage: true });

    // Try to find and click on a project
    const projectCards = page.locator('[data-testid="project-card"], .project-card, a[href*="/backlot/workspace/"]').first();

    if (await projectCards.count() > 0) {
      await projectCards.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/02-project-view.png', fullPage: true });

      // Look for the script tab or script view
      const scriptTab = page.locator('text=/Script/i').first();
      if (await scriptTab.count() > 0) {
        await scriptTab.click();
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'test-results/03-script-view.png', fullPage: true });

        // Click the Edit button to enter edit mode
        const editButton = page.locator('button:has-text("Edit")').first();
        if (await editButton.isVisible()) {
          await editButton.click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: 'test-results/04-edit-mode.png', fullPage: true });

          // Look for any line (dialogue or action) to click on
          const scriptLine = page.locator('textarea').first();

          if (await scriptLine.count() > 0) {
            // Click on the first line to focus it
            await scriptLine.click();
            await page.waitForTimeout(300);

            // Clear any existing content
            await scriptLine.clear();

            // Take screenshot before typing
            await page.screenshot({ path: 'test-results/05-before-typing.png', fullPage: true });

            // Type a very long sentence that should wrap
            const longText = 'This is a very long sentence that should wrap to the next line when it reaches the edge of the textarea element instead of scrolling horizontally out of view which is the current problematic behavior.';

            await scriptLine.fill(longText);
            await page.waitForTimeout(500);

            // Take screenshot after typing
            await page.screenshot({ path: 'test-results/06-after-typing-long-text.png', fullPage: true });

            // Get the textarea element details
            const textareaBox = await scriptLine.boundingBox();
            const scrollWidth = await scriptLine.evaluate(el => (el as HTMLTextAreaElement).scrollWidth);
            const clientWidth = await scriptLine.evaluate(el => (el as HTMLTextAreaElement).clientWidth);
            const value = await scriptLine.inputValue();

            console.log('Textarea Details:');
            console.log('- Bounding box:', textareaBox);
            console.log('- ScrollWidth:', scrollWidth);
            console.log('- ClientWidth:', clientWidth);
            console.log('- Is scrolling horizontally:', scrollWidth > clientWidth);
            console.log('- Text value length:', value.length);
            console.log('- Text:', value.substring(0, 100) + '...');

            // Document the issue: scrollWidth > clientWidth means horizontal scrolling is occurring
            if (scrollWidth > clientWidth) {
              console.log('❌ ISSUE CONFIRMED: Text is scrolling horizontally (scrollWidth > clientWidth)');
            } else {
              console.log('✓ Text is wrapping properly');
            }
          } else {
            console.log('No script lines found');
          }
        } else {
          console.log('Edit button not found');
        }
      } else {
        console.log('Script tab not found');
      }
    } else {
      console.log('No projects found - creating a test scenario manually');
    }
  });

  test('should test element type maintenance while typing', async ({ page }) => {
    // Navigate to Backlot workspace
    await page.goto(`${BASE_URL}/backlot/workspace`);
    await page.waitForLoadState('networkidle');

    // Find a project with a script
    const projectCards = page.locator('[data-testid="project-card"], .project-card, a[href*="/backlot/workspace/"]').first();

    if (await projectCards.count() > 0) {
      await projectCards.click();
      await page.waitForLoadState('networkidle');

      // Look for the script tab or script view
      const scriptTab = page.locator('text=/Script/i').first();
      if (await scriptTab.count() > 0) {
        await scriptTab.click();
        await page.waitForLoadState('networkidle');

        // Click the Edit button
        const editButton = page.locator('button:has-text("Edit")').first();
        if (await editButton.isVisible()) {
          await editButton.click();
          await page.waitForTimeout(500);

          // Get the element type indicator buttons
          const dialogueButton = page.locator('button:has([data-icon="message-square"])');
          const actionButton = page.locator('button:has([data-icon="align-left"])');

          // Click on a line
          const scriptLine = page.locator('textarea').first();
          if (await scriptLine.count() > 0) {
            await scriptLine.click();

            // Take screenshot of initial state
            await page.screenshot({ path: 'test-results/07-element-type-initial.png', fullPage: true });

            // Note which element type is active
            const initialActiveButton = page.locator('button.bg-accent-yellow').first();
            const initialType = await initialActiveButton.textContent();
            console.log('Initial element type:', initialType);

            // Type some text
            await scriptLine.fill('Testing element type maintenance');
            await page.waitForTimeout(300);

            // Take screenshot after typing
            await page.screenshot({ path: 'test-results/08-element-type-after-typing.png', fullPage: true });

            // Check if element type is still the same
            const finalActiveButton = page.locator('button.bg-accent-yellow').first();
            const finalType = await finalActiveButton.textContent();
            console.log('Final element type:', finalType);

            if (initialType === finalType) {
              console.log('✓ Element type maintained correctly');
            } else {
              console.log('❌ ISSUE: Element type changed from', initialType, 'to', finalType);
            }
          }
        }
      }
    }
  });
});
