/**
 * Script Formatting Visual Inspection
 *
 * This test uses the stored authentication session to navigate directly
 * to a script and capture screenshots of the formatting issue.
 */

import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Script Formatting Visual Inspection', () => {
  test.use({
    viewport: { width: 1920, height: 1080 },
    storageState: path.join(__dirname, '../../.playwright-session/state.json')
  });

  test('Capture script formatting with stored session', async ({ page }) => {
    console.log('[DEBUG] Using stored session to access Backlot');

    // Navigate directly to Backlot
    await page.goto('http://localhost:8080/backlot');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('[DEBUG] Current URL:', page.url());

    // Take screenshot of Backlot
    await page.screenshot({
      path: '/home/estro/second-watch-network/frontend/tests/screenshots/format-debug-01-backlot.png',
      fullPage: true
    });

    // Click first project card
    const projectCard = await page.locator('[class*="project"], a[href*="/backlot/project/"]').first();
    if (await projectCard.isVisible({ timeout: 5000 })) {
      console.log('[DEBUG] Clicking project card');
      await projectCard.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    } else {
      console.log('[DEBUG] No project card found, checking current page');
    }

    console.log('[DEBUG] After project click, URL:', page.url());

    // Screenshot of project page
    await page.screenshot({
      path: '/home/estro/second-watch-network/frontend/tests/screenshots/format-debug-02-project.png',
      fullPage: true
    });

    // Try to navigate to scripts - look for the Scripts tab or link
    const scriptsLink = await page.locator('a[href*="/scripts"], button:has-text("Scripts"), [role="tab"]:has-text("Scripts")').first();
    if (await scriptsLink.isVisible({ timeout: 5000 })) {
      console.log('[DEBUG] Clicking Scripts tab/link');
      await scriptsLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    } else {
      // Try URL navigation
      const url = page.url();
      console.log('[DEBUG] Current URL:', url);
      if (url.includes('/project/')) {
        const newUrl = url.replace(/\/backlot\/project\/[^\/]+.*/, match => match.split('/').slice(0, 4).join('/') + '/scripts');
        console.log('[DEBUG] Navigating to:', newUrl);
        await page.goto(newUrl);
        await page.waitForLoadState('networkidle');
      }
    }

    console.log('[DEBUG] Scripts page URL:', page.url());

    // Screenshot of scripts list
    await page.screenshot({
      path: '/home/estro/second-watch-network/frontend/tests/screenshots/format-debug-03-scripts-list.png',
      fullPage: true
    });

    // Look for a script with "View" button or clickable script item
    const viewButton = await page.locator('button:has-text("View"), a:has-text("View"), [data-testid="view-script"]').first();
    if (await viewButton.isVisible({ timeout: 5000 })) {
      console.log('[DEBUG] Clicking View button');
      await viewButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    } else {
      // Try clicking any script item
      const scriptItem = await page.locator('[class*="script"], tr').first();
      if (await scriptItem.isVisible({ timeout: 5000 })) {
        console.log('[DEBUG] Clicking script item');
        await scriptItem.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
      }
    }

    console.log('[DEBUG] Script view URL:', page.url());

    // Capture full page screenshot
    await page.screenshot({
      path: '/home/estro/second-watch-network/frontend/tests/screenshots/format-debug-04-script-view.png',
      fullPage: true
    });

    // Wait for script content to render
    await page.waitForTimeout(1000);

    // Try to find the script page/content area
    const scriptPage = await page.locator('[style*="width"][style*="612"], .script-page, [class*="page"]').first();
    if (await scriptPage.isVisible({ timeout: 3000 })) {
      console.log('[DEBUG] Found script page element');
      await scriptPage.screenshot({
        path: '/home/estro/second-watch-network/frontend/tests/screenshots/format-debug-05-script-page.png'
      });

      // Get bounding box to see actual dimensions
      const box = await scriptPage.boundingBox();
      console.log('[DEBUG] Script page bounding box:', box);
    }

    // Inspect the actual rendered elements
    const allElements = await page.locator('[class*="absolute"]').all();
    console.log(`[DEBUG] Found ${allElements.length} absolute positioned elements`);

    // Look for elements that look like character names (uppercase text)
    const textElements = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('div[class*="absolute"], span'));
      const results = elements.slice(0, 20).map(el => {
        const rect = el.getBoundingClientRect();
        const styles = window.getComputedStyle(el);
        const text = el.textContent?.trim().substring(0, 50) || '';

        return {
          text,
          left: rect.left,
          top: rect.top,
          width: rect.width,
          computedLeft: styles.left,
          computedMarginLeft: styles.marginLeft,
          textTransform: styles.textTransform,
          fontWeight: styles.fontWeight,
        };
      });
      return results;
    });

    console.log('[DEBUG] First 20 text elements:');
    textElements.forEach((el, i) => {
      if (el.text) {
        console.log(`  ${i}: "${el.text}" - left: ${el.left}px, computedLeft: ${el.computedLeft}, marginLeft: ${el.computedMarginLeft}, transform: ${el.textTransform}`);
      }
    });

    console.log('[DEBUG] Screenshots saved to tests/screenshots/format-debug-*.png');
  });

  test('Direct navigation to script URL if known', async ({ page }) => {
    // If you know a specific script URL, you can navigate directly
    // For example: await page.goto('http://localhost:8080/backlot/project/<PROJECT_ID>/scripts/<SCRIPT_ID>');

    // For now, let's just try to find any script through Backlot
    await page.goto('http://localhost:8080/backlot');
    await page.waitForLoadState('networkidle');

    // Get all links that might lead to scripts
    const links = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a[href]'));
      return allLinks
        .map(a => (a as HTMLAnchorElement).href)
        .filter(href => href.includes('/scripts') || href.includes('/script/'))
        .slice(0, 10);
    });

    console.log('[DEBUG] Found script-related URLs:', links);

    if (links.length > 0) {
      console.log('[DEBUG] Navigating to first script URL:', links[0]);
      await page.goto(links[0]);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      await page.screenshot({
        path: '/home/estro/second-watch-network/frontend/tests/screenshots/format-debug-direct-script.png',
        fullPage: true
      });
    }
  });
});
