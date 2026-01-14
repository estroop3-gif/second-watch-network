const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    storageState: './playwright/.auth/user.json'
  });
  const page = await context.newPage();
  
  console.log('Navigating to backlot...');
  
  // Go directly to a backlot project script page
  await page.goto('http://localhost:8080/backlot/d837dec7-f17a-4f1c-b808-dc668ebec699/scripts');
  await page.waitForTimeout(3000);
  
  // Take screenshot
  await page.screenshot({ path: 'screenshot-scripts-page.png', fullPage: true });
  console.log('Saved: screenshot-scripts-page.png');
  
  // Click on View tab if visible
  const viewTab = page.locator('button:has-text("View"), [role="tab"]:has-text("View")');
  if (await viewTab.count() > 0) {
    await viewTab.first().click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshot-view-tab.png', fullPage: true });
    console.log('Saved: screenshot-view-tab.png');
  }
  
  // Look for title page data
  const titlePage = page.locator('.bg-white').first();
  if (await titlePage.count() > 0) {
    await titlePage.screenshot({ path: 'screenshot-title-page-element.png' });
    console.log('Saved: screenshot-title-page-element.png');
  }
  
  // Keep browser open for 30 seconds to inspect
  console.log('Browser will stay open for 30 seconds...');
  await page.waitForTimeout(30000);
  
  await browser.close();
})();
