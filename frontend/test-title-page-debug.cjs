const { chromium } = require('playwright');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  
  // Go to homepage
  await page.goto('http://localhost:8080');
  await page.waitForTimeout(3000);
  
  // Check if we need to log in
  const url = page.url();
  console.log('Current URL:', url);
  
  if (url.includes('landing') || url.includes('login')) {
    console.log('Not logged in. Please log in manually in the browser window...');
    console.log('Waiting 20 seconds for manual login...');
    await page.waitForTimeout(20000);
  }
  
  // Navigate to backlot
  console.log('Looking for Backlot link...');
  await page.screenshot({ path: 'debug-01-after-login.png' });
  
  // Try to find and click Backlot
  const backlotLink = page.locator('a:has-text("Backlot"), [href*="backlot"]').first();
  if (await backlotLink.count() > 0) {
    console.log('Found Backlot link, clicking...');
    await backlotLink.click();
    await page.waitForTimeout(3000);
  }
  
  await page.screenshot({ path: 'debug-02-backlot.png' });
  console.log('URL after backlot:', page.url());
  
  // Look for a project
  const projectCard = page.locator('[class*="project"], [class*="card"]').first();
  if (await projectCard.count() > 0) {
    console.log('Found project card, clicking...');
    await projectCard.click();
    await page.waitForTimeout(3000);
  }
  
  await page.screenshot({ path: 'debug-03-project.png' });
  
  // Look for Scripts tab/link
  const scriptsLink = page.locator('a:has-text("Scripts"), button:has-text("Scripts"), [href*="scripts"]').first();
  if (await scriptsLink.count() > 0) {
    console.log('Found Scripts link, clicking...');
    await scriptsLink.click();
    await page.waitForTimeout(3000);
  }
  
  await page.screenshot({ path: 'debug-04-scripts.png' });
  
  // Look for View tab
  const viewTab = page.locator('button:has-text("View"), [role="tab"]:has-text("View")').first();
  if (await viewTab.count() > 0) {
    console.log('Found View tab, clicking...');
    await viewTab.click();
    await page.waitForTimeout(3000);
  }
  
  await page.screenshot({ path: 'debug-05-view-tab.png', fullPage: true });
  
  // Check for title page element
  const titlePageEl = page.locator('.bg-white.shadow-lg').first();
  const titlePageCount = await titlePageEl.count();
  console.log('Title page elements found:', titlePageCount);
  
  if (titlePageCount > 0) {
    const box = await titlePageEl.boundingBox();
    console.log('Title page dimensions:', box);
    await titlePageEl.screenshot({ path: 'debug-06-title-page.png' });
    
    // Get computed styles
    const styles = await titlePageEl.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        width: computed.width,
        height: computed.height,
        fontSize: computed.fontSize,
        fontFamily: computed.fontFamily,
      };
    });
    console.log('Title page styles:', styles);
    
    // Check inner content
    const innerText = await titlePageEl.innerText();
    console.log('Title page text preview:', innerText.substring(0, 200));
  }
  
  // Also check what ScriptTitlePage rendered
  const scriptTitlePage = page.locator('[class*="flex-col"]').filter({ has: page.locator('p') }).first();
  
  // Log any console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Browser error:', msg.text());
    }
  });
  
  console.log('\n=== DONE ===');
  console.log('Screenshots saved as debug-01 through debug-06.png');
  console.log('Browser will close in 10 seconds...');
  await page.waitForTimeout(10000);
  
  await browser.close();
})();
