/**
 * Quick Visual Check - Storyboard Panel Image Uploader
 *
 * This is a simplified test for quick visual verification of the fixes.
 * It takes screenshots so you can manually verify button alignment.
 */
import { test, expect } from '@playwright/test';

test.describe('Quick Visual Check - Storyboard Uploader', () => {
  test('Take screenshots of storyboard panels for visual inspection', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:8080');
    await page.waitForLoadState('networkidle');

    console.log('[Test] App loaded');

    // Take initial screenshot
    await page.screenshot({
      path: 'tests/e2e/screenshots/quick-check-01-landing.png',
      fullPage: true
    });

    // Check if we're logged in
    const isLoggedIn = await page.locator('[data-testid="user-menu"], .avatar, button:has-text("Dashboard")').count() > 0;

    if (!isLoggedIn) {
      console.log('[Test] Not logged in - manual login required');
      console.log('[Test] Please log in manually, then the test will continue');

      // Wait for navigation to dashboard (indicating login)
      await page.waitForURL(/dashboard|backlot|profile/, { timeout: 120000 })
        .catch(() => {
          console.log('[Test] Login timeout - test will skip navigation');
        });
    }

    // Try to navigate to backlot
    console.log('[Test] Attempting to navigate to backlot...');

    // Look for backlot link/button
    const backlotLink = page.locator('a[href*="backlot"], button:has-text("Backlot")').first();

    if (await backlotLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await backlotLink.click();
      await page.waitForLoadState('networkidle');

      await page.screenshot({
        path: 'tests/e2e/screenshots/quick-check-02-backlot.png',
        fullPage: true
      });

      console.log('[Test] Navigated to backlot');

      // Look for a project
      const projectCard = page.locator('[class*="project"], [data-testid="project"]').first();

      if (await projectCard.isVisible({ timeout: 5000 }).catch(() => false)) {
        await projectCard.click();
        await page.waitForLoadState('networkidle');

        await page.screenshot({
          path: 'tests/e2e/screenshots/quick-check-03-project.png',
          fullPage: true
        });

        console.log('[Test] Opened project');

        // Look for storyboard tab/link
        const storyboardTab = page.locator('button:has-text("Storyboard"), a:has-text("Storyboard"), [data-testid="storyboard"]').first();

        if (await storyboardTab.isVisible({ timeout: 5000 }).catch(() => false)) {
          await storyboardTab.click();
          await page.waitForLoadState('networkidle');

          await page.screenshot({
            path: 'tests/e2e/screenshots/quick-check-04-storyboard-list.png',
            fullPage: true
          });

          console.log('[Test] Opened storyboard view');

          // Look for a storyboard
          const storyboard = page.locator('[class*="storyboard"], [data-testid="storyboard"]').first();

          if (await storyboard.isVisible({ timeout: 5000 }).catch(() => false)) {
            await storyboard.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1000);

            await page.screenshot({
              path: 'tests/e2e/screenshots/quick-check-05-storyboard-detail.png',
              fullPage: true
            });

            console.log('[Test] Opened storyboard detail');

            // Look for panels with images
            const panelsWithImages = page.locator('img[alt="Panel reference"]');
            const imageCount = await panelsWithImages.count();

            console.log(`[Test] Found ${imageCount} panel image(s)`);

            if (imageCount > 0) {
              // Take screenshot of first panel
              const firstPanel = panelsWithImages.first().locator('xpath=ancestor::div[contains(@class, "group")]');

              if (await firstPanel.isVisible().catch(() => false)) {
                // Normal state
                await firstPanel.screenshot({
                  path: 'tests/e2e/screenshots/quick-check-06-panel-normal.png'
                });

                console.log('[Test] Screenshot: Panel normal state');

                // Hover state
                await firstPanel.hover();
                await page.waitForTimeout(500);

                await firstPanel.screenshot({
                  path: 'tests/e2e/screenshots/quick-check-07-panel-hover.png'
                });

                console.log('[Test] Screenshot: Panel hover state');
                console.log('[Test] ✅ CHECK THIS IMAGE for button alignment!');
                console.log('[Test] Buttons should be on the RIGHT side of the panel');

                // Check for buttons
                const replaceButton = firstPanel.locator('button:has-text("Replace")');
                const removeButton = firstPanel.locator('button:has-text("Remove")');

                const replaceVisible = await replaceButton.isVisible();
                const removeVisible = await removeButton.isVisible();

                console.log(`[Test] Replace button visible: ${replaceVisible}`);
                console.log(`[Test] Remove button visible: ${removeVisible}`);

                if (replaceVisible && removeVisible) {
                  // Get positions
                  const panelBox = await firstPanel.boundingBox();
                  const replaceBox = await replaceButton.boundingBox();
                  const removeBox = await removeButton.boundingBox();

                  if (panelBox && replaceBox && removeBox) {
                    const panelRight = panelBox.x + panelBox.width;
                    const replaceRight = replaceBox.x + replaceBox.width;
                    const removeRight = removeBox.x + removeBox.width;

                    const replaceDistanceFromRight = Math.abs(panelRight - replaceRight);
                    const removeDistanceFromRight = Math.abs(panelRight - removeRight);

                    console.log(`[Test] Panel right edge: ${panelRight}px`);
                    console.log(`[Test] Replace button right edge: ${replaceRight}px`);
                    console.log(`[Test] Remove button right edge: ${removeRight}px`);
                    console.log(`[Test] Replace distance from right: ${replaceDistanceFromRight}px`);
                    console.log(`[Test] Remove distance from right: ${removeDistanceFromRight}px`);

                    // Verify alignment
                    if (replaceDistanceFromRight < 50 && removeDistanceFromRight < 50) {
                      console.log('[Test] ✅ PASS: Buttons are aligned to the RIGHT');
                    } else {
                      console.log('[Test] ❌ FAIL: Buttons are NOT aligned to the right');
                      console.log('[Test] Expected buttons within 50px of right edge');
                    }

                    // Verify order (Remove should be to the right of Replace)
                    if (removeBox.x > replaceBox.x) {
                      console.log('[Test] ✅ PASS: Remove button is to the right of Replace button');
                    } else {
                      console.log('[Test] ❌ FAIL: Button order is incorrect');
                    }
                  }
                }

                // Take full page screenshot with overlay visible
                await page.screenshot({
                  path: 'tests/e2e/screenshots/quick-check-08-full-page-hover.png',
                  fullPage: true
                });
              }
            } else {
              console.log('[Test] No panels with images found');
              console.log('[Test] You may need to upload an image first to test button alignment');
            }
          } else {
            console.log('[Test] No storyboards found');
          }
        } else {
          console.log('[Test] Storyboard tab not found');
        }
      } else {
        console.log('[Test] No projects found');
      }
    } else {
      console.log('[Test] Backlot link not found');
    }

    console.log('[Test] ===================================');
    console.log('[Test] Visual check complete!');
    console.log('[Test] Check screenshots in: tests/e2e/screenshots/');
    console.log('[Test] Key screenshot: quick-check-07-panel-hover.png');
    console.log('[Test] Verify buttons appear on RIGHT side');
    console.log('[Test] ===================================');
  });
});
