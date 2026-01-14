/**
 * Script Formatting Debug Test
 *
 * Purpose: Debug the formatting issue with imported scripts where:
 * - Characters are all the way to the left (should be centered around 220px)
 * - Dialogue formatting is "wonky"
 *
 * This test navigates to a Backlot project with an imported script and captures
 * screenshots to analyze the positioning issue.
 */

import { test, expect } from '@playwright/test';

test.describe('Script Formatting Debug', () => {
  test.use({
    viewport: { width: 1920, height: 1080 }
  });

  test('Navigate to imported script and capture formatting', async ({ page }) => {
    console.log('[DEBUG] Starting script formatting debug test');

    // Step 1: Login
    console.log('[DEBUG] Navigating to login page');
    await page.goto('http://localhost:8080/login');
    await page.waitForLoadState('networkidle');

    console.log('[DEBUG] Logging in');
    await page.fill('input[type="email"]', 'claude@secondwatchnetwork.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForURL(/dashboard/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    console.log('[DEBUG] Login successful, on dashboard');

    // Take screenshot of dashboard
    await page.screenshot({
      path: '/home/estro/second-watch-network/frontend/tests/e2e/screenshots/script-format-01-dashboard.png',
      fullPage: true
    });

    // Step 2: Navigate to Backlot
    console.log('[DEBUG] Navigating to Backlot');
    await page.goto('http://localhost:8080/backlot');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: '/home/estro/second-watch-network/frontend/tests/e2e/screenshots/script-format-02-backlot.png',
      fullPage: true
    });

    // Step 3: Find and click on a project with scripts
    console.log('[DEBUG] Looking for projects');

    // Wait for projects to load
    await page.waitForSelector('[data-testid="project-card"], .project-card, [class*="project"]', { timeout: 10000 });

    // Get all project cards
    const projectCards = await page.locator('[data-testid="project-card"], .project-card, [class*="project"]').all();
    console.log(`[DEBUG] Found ${projectCards.length} project elements`);

    // Click the first project
    if (projectCards.length > 0) {
      await projectCards[0].click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      console.log('[DEBUG] Clicked first project');
    } else {
      console.log('[DEBUG] No projects found, trying alternative selector');
      // Try clicking any clickable element that might be a project
      const firstClickable = await page.locator('a[href*="/backlot/project/"], button:has-text("Open"), button:has-text("View")').first();
      await firstClickable.click();
      await page.waitForLoadState('networkidle');
    }

    await page.screenshot({
      path: '/home/estro/second-watch-network/frontend/tests/e2e/screenshots/script-format-03-project.png',
      fullPage: true
    });

    // Step 4: Navigate to Scripts tab
    console.log('[DEBUG] Looking for Scripts tab');

    // Try multiple selectors for the Scripts tab
    const scriptsTab = await page.locator(
      'button:has-text("Scripts"), a:has-text("Scripts"), [data-tab="scripts"], [role="tab"]:has-text("Scripts")'
    ).first();

    if (await scriptsTab.isVisible()) {
      console.log('[DEBUG] Clicking Scripts tab');
      await scriptsTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    } else {
      console.log('[DEBUG] Scripts tab not found, trying URL navigation');
      const currentUrl = page.url();
      const projectId = currentUrl.match(/project\/([^\/]+)/)?.[1];
      if (projectId) {
        await page.goto(`http://localhost:8080/backlot/project/${projectId}/scripts`);
        await page.waitForLoadState('networkidle');
      }
    }

    await page.screenshot({
      path: '/home/estro/second-watch-network/frontend/tests/e2e/screenshots/script-format-04-scripts-tab.png',
      fullPage: true
    });

    // Step 5: Click on a script to view it
    console.log('[DEBUG] Looking for scripts');

    // Wait for script list or cards
    await page.waitForSelector('[data-testid="script-item"], .script-card, [class*="script"]', { timeout: 10000 });

    const scriptElements = await page.locator('[data-testid="script-item"], .script-card, [class*="script"], button:has-text("View"), a:has-text("View")').all();
    console.log(`[DEBUG] Found ${scriptElements.length} script elements`);

    if (scriptElements.length > 0) {
      await scriptElements[0].click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000); // Wait for script to render
      console.log('[DEBUG] Clicked first script');
    }

    // Step 6: Capture the script view - this is where we'll see the formatting issue
    await page.screenshot({
      path: '/home/estro/second-watch-network/frontend/tests/e2e/screenshots/script-format-05-script-view-full.png',
      fullPage: true
    });

    // Capture just the script content area with higher resolution
    const scriptContent = await page.locator('[class*="page"], [class*="script-content"], .script-page').first();
    if (await scriptContent.isVisible()) {
      await scriptContent.screenshot({
        path: '/home/estro/second-watch-network/frontend/tests/e2e/screenshots/script-format-06-script-content.png'
      });
    }

    // Step 7: Inspect the DOM structure
    console.log('[DEBUG] Inspecting script element structure');

    // Find character elements (should be centered)
    const characterElements = await page.locator('[class*="character"], div:has-text("CHARACTER")').all();
    console.log(`[DEBUG] Found ${characterElements.length} potential character elements`);

    if (characterElements.length > 0) {
      for (let i = 0; i < Math.min(3, characterElements.length); i++) {
        const boundingBox = await characterElements[i].boundingBox();
        const styles = await characterElements[i].evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            left: computed.left,
            marginLeft: computed.marginLeft,
            paddingLeft: computed.paddingLeft,
            position: computed.position,
            textAlign: computed.textAlign,
            width: computed.width,
          };
        });
        console.log(`[DEBUG] Character element ${i}:`, { boundingBox, styles });
      }
    }

    // Find dialogue elements
    const dialogueElements = await page.locator('[class*="dialogue"]').all();
    console.log(`[DEBUG] Found ${dialogueElements.length} dialogue elements`);

    if (dialogueElements.length > 0) {
      for (let i = 0; i < Math.min(3, dialogueElements.length); i++) {
        const boundingBox = await dialogueElements[i].boundingBox();
        const styles = await dialogueElements[i].evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            left: computed.left,
            marginLeft: computed.marginLeft,
            paddingLeft: computed.paddingLeft,
            position: computed.position,
            textAlign: computed.textAlign,
            width: computed.width,
          };
        });
        console.log(`[DEBUG] Dialogue element ${i}:`, { boundingBox, styles });
      }
    }

    // Step 8: Check the console for any debug logs from ScriptPageView
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('[ScriptPageView]')) {
        consoleLogs.push(msg.text());
      }
    });

    // Wait a bit to collect console logs
    await page.waitForTimeout(1000);

    console.log('[DEBUG] Console logs from ScriptPageView:');
    consoleLogs.forEach(log => console.log(log));

    console.log('[DEBUG] Test complete - check screenshots in tests/e2e/screenshots/');
  });

  test('Inspect getElementPosition calculations', async ({ page }) => {
    console.log('[DEBUG] Testing getElementPosition calculations');

    // Navigate to a script
    await page.goto('http://localhost:8080/login');
    await page.fill('input[type="email"]', 'claude@secondwatchnetwork.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/, { timeout: 10000 });

    // Inject a script to test the getElementPosition function
    const positionTests = await page.evaluate(() => {
      // These constants should match ScriptPageView.tsx
      const MARGIN_LEFT = 108;
      const CONTENT_WIDTH = 432;
      const CHAR_LEFT = 266;
      const DIALOGUE_LEFT = 180;
      const DIALOGUE_RIGHT = 432;
      const PAREN_LEFT = 223;
      const PAREN_RIGHT = 403;

      function getElementPosition(type: string) {
        switch (type) {
          case 'scene_heading':
          case 'action':
          case 'general':
            return { left: 0, width: CONTENT_WIDTH };
          case 'character':
            return { left: CHAR_LEFT - MARGIN_LEFT, width: CONTENT_WIDTH - (CHAR_LEFT - MARGIN_LEFT) };
          case 'dialogue':
            return { left: DIALOGUE_LEFT - MARGIN_LEFT, width: DIALOGUE_RIGHT - DIALOGUE_LEFT };
          case 'parenthetical':
            return { left: PAREN_LEFT - MARGIN_LEFT, width: PAREN_RIGHT - PAREN_LEFT };
          case 'transition':
            return { left: 0, width: CONTENT_WIDTH, textAlign: 'right' };
          default:
            return { left: 0, width: CONTENT_WIDTH };
        }
      }

      return {
        action: getElementPosition('action'),
        character: getElementPosition('character'),
        dialogue: getElementPosition('dialogue'),
        parenthetical: getElementPosition('parenthetical'),
      };
    });

    console.log('[DEBUG] Position calculations:');
    console.log('  Action:', positionTests.action);
    console.log('  Character:', positionTests.character, '(should have left: 158px)');
    console.log('  Dialogue:', positionTests.dialogue, '(should have left: 72px, width: 252px)');
    console.log('  Parenthetical:', positionTests.parenthetical, '(should have left: 115px, width: 180px)');
  });
});
