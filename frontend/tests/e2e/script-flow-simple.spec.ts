/**
 * Simple Script Flow Test
 * Tests the basic flow layout issue in the script editor
 */
import { test, expect } from '@playwright/test';

test.describe('Script Flow Basic Test', () => {
  test('login and navigate to script editor', async ({ page }) => {
    // Go to app
    await page.goto('http://localhost:8080');

    // Take screenshot of login page
    await page.screenshot({ path: '/tmp/01-login.png' });

    // Login
    await page.fill('input[type="email"]', 'claude@secondwatchnetwork.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');

    // Wait for navigation
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/02-after-login.png' });

    // Click Backlot in navigation
    const backlotLink = page.locator('a:has-text("Backlot"), button:has-text("Backlot")').first();
    await backlotLink.click();

    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/03-backlot-page.png' });

    // Look for any project
    await page.waitForSelector('[data-testid="project-card"], .project-card, a[href*="project"]', { timeout: 10000 });

    // Click first project
    const project = page.locator('[data-testid="project-card"], .project-card').first();
    if (await project.isVisible({ timeout: 2000 }).catch(() => false)) {
      await project.click();
    } else {
      // Try finding a link with "project" in the href
      await page.click('a[href*="project"]');
    }

    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/04-project-workspace.png' });

    // Find Script link/button in the workspace
    await page.click('text=Script');

    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '/tmp/05-script-section.png' });

    // Debug: print what we see
    const pageContent = await page.content();
    console.log('Page contains "Edit":', pageContent.includes('Edit'));
    console.log('Page contains "Page":', pageContent.includes('Page'));

    // Look for Edit button or script content
    const editButton = page.locator('button:has-text("Edit Script"), button:has-text("Edit")');
    const editExists = await editButton.first().isVisible({ timeout: 5000 }).catch(() => false);

    console.log('Edit button exists:', editExists);

    if (editExists) {
      await editButton.first().click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: '/tmp/06-editing-mode.png' });
    }

    // Check for Page view button
    const pageViewButton = page.locator('button:has-text("Page")');
    const pageViewExists = await pageViewButton.isVisible({ timeout: 3000 }).catch(() => false);

    console.log('Page view button exists:', pageViewExists);

    if (pageViewExists) {
      await pageViewButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: '/tmp/07-page-view.png' });
    }

    // Find script lines
    const lines = page.locator('div[class*="relative cursor-text"]');
    const lineCount = await lines.count();
    console.log('Found', lineCount, 'script lines');

    if (lineCount > 0) {
      await page.screenshot({ path: '/tmp/08-found-lines.png' });

      // Click first line
      await lines.first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: '/tmp/09-clicked-line.png' });

      // Check for textarea
      const textarea = page.locator('textarea');
      const textareaExists = await textarea.first().isVisible({ timeout: 3000 }).catch(() => false);
      console.log('Textarea visible:', textareaExists);

      if (textareaExists) {
        await page.screenshot({ path: '/tmp/10-textarea-visible.png' });
      }
    }
  });
});
