import { test, expect } from '@playwright/test';

test('measure script page dimensions', async ({ page }) => {
  test.setTimeout(120000);
  
  // Navigate to backlot
  await page.goto('/backlot');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Click EIDCOM project
  const projectLink = page.locator('text=EIDCOM').first();
  await projectLink.waitFor({ timeout: 15000 });
  await projectLink.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Click Script tab
  const scriptTab = page.locator('button:has-text("Script"), a:has-text("Script")').first();
  await scriptTab.waitFor({ timeout: 10000 });
  await scriptTab.click();
  await page.waitForTimeout(3000);
  
  // Click View Script tab
  const viewTab = page.locator('button:has-text("View Script")').first();
  if (await viewTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await viewTab.click();
    await page.waitForTimeout(2000);
  }
  
  // Find the white page container
  const pageContainer = page.locator('.bg-white.shadow-lg').first();
  await pageContainer.waitFor({ timeout: 10000 });
  
  const box = await pageContainer.boundingBox();
  console.log('=== Page container dimensions ===');
  console.log(`Width: ${box?.width}px`);
  console.log(`Height: ${box?.height}px`);
  console.log(`Expected at 100% zoom: 612x792px`);
  
  // Count lines on the page
  const lines = await page.locator('.bg-white.shadow-lg .relative[data-char-offset]').count();
  console.log(`Lines on first page: ${lines}`);
  
  // Get styles from the page element itself
  const pageStyles = await pageContainer.evaluate((el) => {
    const computed = window.getComputedStyle(el);
    return {
      width: computed.width,
      minHeight: computed.minHeight,
      height: el.offsetHeight,
    };
  });
  console.log(`Computed: width=${pageStyles.width}, minHeight=${pageStyles.minHeight}, actual height=${pageStyles.height}px`);
  
  // Get line height info
  const firstLine = page.locator('.bg-white.shadow-lg .relative[data-char-offset]').first();
  if (await firstLine.count() > 0) {
    const lineInfo = await firstLine.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        fontSize: computed.fontSize,
        lineHeight: computed.lineHeight,
        height: el.offsetHeight,
      };
    });
    console.log(`First line: fontSize=${lineInfo.fontSize}, lineHeight=${lineInfo.lineHeight}, height=${lineInfo.height}px`);
  }
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/script-page-measure.png', fullPage: false });
  console.log('Screenshot saved');
});
