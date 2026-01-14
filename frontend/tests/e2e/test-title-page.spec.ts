import { test, expect } from '@playwright/test';

test.describe('Script Title Page Formatting', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:8080');
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to Progressive Dental project and check title page formatting', async ({ page }) => {
    // Take screenshot of initial state
    await page.screenshot({ path: '/home/estro/second-watch-network/backend/screenshots/01-homepage.png', fullPage: true });

    // Look for Progressive Dental project or Backlot navigation
    console.log('Current URL:', page.url());
    console.log('Page title:', await page.title());

    // Try to find navigation to Backlot or Projects
    const backlotLink = page.locator('text=Backlot').or(page.locator('a[href*="backlot"]'));
    const projectsLink = page.locator('text=Projects').or(page.locator('a[href*="project"]'));

    if (await backlotLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Found Backlot link');
      await backlotLink.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: '/home/estro/second-watch-network/backend/screenshots/02-backlot.png', fullPage: true });
    } else if (await projectsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Found Projects link');
      await projectsLink.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: '/home/estro/second-watch-network/backend/screenshots/02-projects.png', fullPage: true });
    }

    // Look for Progressive Dental project
    const progressiveDentalLink = page.locator('text=/Progressive Dental/i').or(page.locator('a[href*="progressive-dental"]'));
    if (await progressiveDentalLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Found Progressive Dental project');
      await progressiveDentalLink.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: '/home/estro/second-watch-network/backend/screenshots/03-progressive-dental.png', fullPage: true });
    }

    // Look for Scripts tab or section
    const scriptsTab = page.locator('text=Scripts').or(page.locator('[role="tab"]:has-text("Scripts")'));
    if (await scriptsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Found Scripts tab');
      await scriptsTab.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: '/home/estro/second-watch-network/backend/screenshots/04-scripts-tab.png', fullPage: true });
    }

    // Look for "The Last Watch" script
    const lastWatchScript = page.locator('text=/The Last Watch/i');
    if (await lastWatchScript.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Found The Last Watch script');
      await lastWatchScript.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: '/home/estro/second-watch-network/backend/screenshots/05-script-editor-full.png', fullPage: true });

      // Also take a viewport screenshot to see the editor clearly
      await page.screenshot({ path: '/home/estro/second-watch-network/backend/screenshots/05-script-editor-viewport.png' });

      // Try to identify the script content area
      const scriptContent = page.locator('.script-content, .script-editor, [class*="script"]');
      if (await scriptContent.isVisible({ timeout: 5000 }).catch(() => false)) {
        await scriptContent.screenshot({ path: '/home/estro/second-watch-network/backend/screenshots/06-script-content.png' });
      }
    }

    // Log all visible text on the page to help diagnose
    const bodyText = await page.locator('body').textContent();
    console.log('Page contains Progressive Dental:', bodyText?.includes('Progressive Dental'));
    console.log('Page contains Scripts:', bodyText?.includes('Scripts'));
    console.log('Page contains The Last Watch:', bodyText?.includes('The Last Watch'));
  });
});
