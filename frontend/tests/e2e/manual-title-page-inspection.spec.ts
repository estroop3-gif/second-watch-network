import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test.describe('Manual Title Page Inspection', () => {
  test.setTimeout(120000); // 2 minutes for manual interaction if needed

  test('Navigate to Script View and inspect title page rendering', async ({ page }) => {
    const screenshotsDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    // Navigate to the application
    console.log('Navigating to http://localhost:8080...');
    await page.goto('http://localhost:8080');
    await page.waitForLoadState('networkidle');

    // Take initial screenshot
    await page.screenshot({ path: path.join(screenshotsDir, '01-initial-page.png'), fullPage: true });
    console.log('Screenshot saved: 01-initial-page.png');

    // Check for login
    const hasLoginForm = await page.locator('input[type="email"], input[type="password"]').count() > 0;
    if (hasLoginForm) {
      console.log('Login form detected');
      await page.screenshot({ path: path.join(screenshotsDir, '02-login-form.png'), fullPage: true });

      // Try to find and fill login form
      const emailInput = page.locator('input[type="email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();

      if (await emailInput.isVisible()) {
        // Use test credentials or look for saved session
        console.log('Attempting to log in...');
        await emailInput.fill('test@example.com');
        await passwordInput.fill('password');

        const submitButton = page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")').first();
        await submitButton.click();
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: path.join(screenshotsDir, '03-after-login.png'), fullPage: true });
      }
    }

    // Look for Backlot section/link
    console.log('Looking for Backlot section...');
    const backlotLink = page.locator('a:has-text("Backlot"), button:has-text("Backlot"), [data-testid="backlot"]').first();

    if (await backlotLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Backlot link found, clicking...');
      await backlotLink.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: path.join(screenshotsDir, '04-backlot-section.png'), fullPage: true });
    } else {
      console.log('Backlot link not immediately visible, checking page structure...');
      await page.screenshot({ path: path.join(screenshotsDir, '04-page-structure.png'), fullPage: true });
    }

    // Look for projects with scripts
    console.log('Looking for projects...');
    const projectCards = page.locator('[data-testid*="project"], .project-card, .project-item');
    const projectCount = await projectCards.count();
    console.log(`Found ${projectCount} potential project elements`);

    if (projectCount > 0) {
      // Click the first project
      await projectCards.first().click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: path.join(screenshotsDir, '05-project-opened.png'), fullPage: true });
    }

    // Look for Script section/tab
    console.log('Looking for Script section...');
    const scriptLink = page.locator('a:has-text("Script"), button:has-text("Script"), [data-testid="script"]').first();

    if (await scriptLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Script link found, clicking...');
      await scriptLink.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: path.join(screenshotsDir, '06-script-section.png'), fullPage: true });
    }

    // Look for View tab
    console.log('Looking for View tab...');
    const viewTab = page.locator('[role="tab"]:has-text("View"), button:has-text("View"), a:has-text("View")').first();

    if (await viewTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('View tab found, clicking...');
      await viewTab.click();
      await page.waitForTimeout(2000); // Wait for rendering
      await page.screenshot({ path: path.join(screenshotsDir, '07-view-tab.png'), fullPage: true });
    }

    // Capture the title page specifically
    console.log('Capturing title page view...');
    await page.waitForTimeout(1000);

    // Look for title page elements
    const titlePageContainer = page.locator('[data-testid*="title-page"], .title-page, .script-page').first();
    if (await titlePageContainer.isVisible({ timeout: 5000 }).catch(() => false)) {
      await titlePageContainer.screenshot({ path: path.join(screenshotsDir, '08-title-page-detail.png') });
      console.log('Title page screenshot captured');
    }

    // Take full page screenshot of View tab
    await page.screenshot({ path: path.join(screenshotsDir, '09-view-tab-full.png'), fullPage: true });

    // Switch to Edit tab -> Title view
    console.log('Looking for Edit tab...');
    const editTab = page.locator('[role="tab"]:has-text("Edit"), button:has-text("Edit"), a:has-text("Edit")').first();

    if (await editTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Edit tab found, clicking...');
      await editTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(screenshotsDir, '10-edit-tab.png'), fullPage: true });

      // Look for Title view within Edit tab
      const titleView = page.locator('button:has-text("Title"), a:has-text("Title"), [data-testid*="title"]').first();
      if (await titleView.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('Title view found, clicking...');
        await titleView.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(screenshotsDir, '11-edit-title-view.png'), fullPage: true });
      }
    }

    // Capture console logs and errors
    const logs: string[] = [];
    page.on('console', msg => {
      logs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Check computed styles of title page elements
    const styleInfo = await page.evaluate(() => {
      const results: any = {};

      // Look for title page container
      const containers = document.querySelectorAll('[data-testid*="title"], .title-page, .script-page');
      if (containers.length > 0) {
        const container = containers[0] as HTMLElement;
        const styles = window.getComputedStyle(container);

        results.container = {
          display: styles.display,
          alignItems: styles.alignItems,
          justifyContent: styles.justifyContent,
          textAlign: styles.textAlign,
          backgroundColor: styles.backgroundColor,
          color: styles.color,
          fontFamily: styles.fontFamily,
          fontSize: styles.fontSize,
        };
      }

      // Look for text elements
      const textElements = document.querySelectorAll('.title-page *, .script-page *');
      results.textElements = Array.from(textElements).slice(0, 5).map(el => {
        const styles = window.getComputedStyle(el as HTMLElement);
        return {
          tagName: el.tagName,
          textContent: (el.textContent || '').substring(0, 50),
          fontSize: styles.fontSize,
          fontFamily: styles.fontFamily,
          textAlign: styles.textAlign,
          color: styles.color,
        };
      });

      return results;
    });

    console.log('Style information:', JSON.stringify(styleInfo, null, 2));

    // Save inspection report
    const report = {
      timestamp: new Date().toISOString(),
      url: page.url(),
      styleInfo,
      logs,
      screenshots: [
        '01-initial-page.png',
        '02-login-form.png',
        '03-after-login.png',
        '04-backlot-section.png',
        '05-project-opened.png',
        '06-script-section.png',
        '07-view-tab.png',
        '08-title-page-detail.png',
        '09-view-tab-full.png',
        '10-edit-tab.png',
        '11-edit-title-view.png',
      ]
    };

    fs.writeFileSync(
      path.join(screenshotsDir, 'inspection-report.json'),
      JSON.stringify(report, null, 2)
    );

    console.log('\n=== INSPECTION COMPLETE ===');
    console.log('Screenshots saved to:', screenshotsDir);
    console.log('Report saved to: inspection-report.json');
  });
});
