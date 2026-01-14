const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  const page = await context.newPage();
  
  console.log('Navigating to backlot scripts page...');
  
  // Go directly to a backlot project script page
  await page.goto('http://localhost:8080/backlot/d837dec7-f17a-4f1c-b808-dc668ebec699/scripts');
  
  // Wait for page to load
  await page.waitForTimeout(5000);
  
  // Check current URL
  const url = page.url();
  console.log('Current URL:', url);
  
  // Take screenshot
  await page.screenshot({ path: 'screenshot-1-initial.png', fullPage: true });
  console.log('Saved: screenshot-1-initial.png');
  
  // If redirected to login, wait for user to log in
  if (url.includes('login') || url.includes('landing')) {
    console.log('Need to log in - waiting 15 seconds for manual login...');
    await page.waitForTimeout(15000);
    
    // Try navigating again
    await page.goto('http://localhost:8080/backlot/d837dec7-f17a-4f1c-b808-dc668ebec699/scripts');
    await page.waitForTimeout(5000);
  }
  
  await page.screenshot({ path: 'screenshot-2-after-nav.png', fullPage: true });
  console.log('Saved: screenshot-2-after-nav.png');
  
  // Look for View tab
  const viewTab = page.getByRole('tab', { name: /view/i });
  if (await viewTab.count() > 0) {
    console.log('Found View tab, clicking...');
    await viewTab.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshot-3-view-tab.png', fullPage: true });
    console.log('Saved: screenshot-3-view-tab.png');
  }
  
  // Look for white page elements
  const whitePage = page.locator('.bg-white');
  const count = await whitePage.count();
  console.log(`Found ${count} white elements`);
  
  if (count > 0) {
    for (let i = 0; i < Math.min(count, 3); i++) {
      const el = whitePage.nth(i);
      const box = await el.boundingBox();
      if (box && box.width > 300 && box.height > 400) {
        await el.screenshot({ path: `screenshot-4-page-${i}.png` });
        console.log(`Saved: screenshot-4-page-${i}.png`);
      }
    }
  }
  
  console.log('Done!');
  await browser.close();
})();
