/**
 * Manual Investigation: Budget Actuals System
 *
 * This test opens a browser in headed mode and waits for manual navigation
 * so we can investigate the budget actuals system interactively.
 */

import { test } from '@playwright/test';

const BASE_URL = 'http://localhost:8080';

test.describe('Budget Actuals Manual Investigation', () => {
  test('interactive investigation with manual control', async ({ page }) => {
    console.log('\n========================================');
    console.log('MANUAL INVESTIGATION MODE');
    console.log('========================================\n');
    console.log('Instructions:');
    console.log('1. The browser will open');
    console.log('2. Manually log in if needed');
    console.log('3. Navigate to a Backlot project');
    console.log('4. Click the Budget tab');
    console.log('5. Look for the Actual toggle');
    console.log('6. Switch between Estimated and Actual views');
    console.log('7. Go to Approvals tab');
    console.log('8. Approve an expense if available');
    console.log('9. Return to Budget > Actual view');
    console.log('10. Press Ctrl+C in terminal when done\n');
    console.log('========================================\n');

    await page.setViewportSize({ width: 1920, height: 1080 });

    // Capture console logs
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error' || text.toLowerCase().includes('budget') || text.toLowerCase().includes('actual') || text.toLowerCase().includes('approval')) {
        console.log(`[Console ${type.toUpperCase()}]:`, text);
      }
    });

    // Capture page errors
    page.on('pageerror', error => {
      console.log(`[Page Error]:`, error.message);
    });

    // Capture network requests related to budget/actuals
    page.on('request', request => {
      const url = request.url();
      if (url.includes('budget') || url.includes('actual') || url.includes('approval')) {
        console.log(`[Request] ${request.method()} ${url}`);
      }
    });

    page.on('response', async response => {
      const url = response.url();
      if (url.includes('budget') || url.includes('actual') || url.includes('approval')) {
        const status = response.status();
        console.log(`[Response] ${status} ${url}`);
        if (status !== 200 && status !== 304) {
          try {
            const body = await response.text();
            console.log(`[Error Body]:`, body.substring(0, 300));
          } catch (e) {
            // Ignore
          }
        }
      }
    });

    // Navigate to home page
    await page.goto(BASE_URL, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('Browser opened at:', BASE_URL);
    console.log('Waiting indefinitely for manual investigation...');
    console.log('Press Ctrl+C when done.\n');

    // Take periodic screenshots
    let screenshotCount = 0;
    const screenshotInterval = setInterval(async () => {
      try {
        screenshotCount++;
        await page.screenshot({
          path: `test-results/manual-budget-investigation-${screenshotCount}.png`,
          fullPage: true
        });
        console.log(`[Screenshot ${screenshotCount}] Saved at ${new Date().toLocaleTimeString()}`);
      } catch (e) {
        // Ignore screenshot errors
      }
    }, 30000); // Every 30 seconds

    // Wait indefinitely (or until Ctrl+C)
    await page.waitForTimeout(3600000); // 1 hour max

    clearInterval(screenshotInterval);
  });
});
