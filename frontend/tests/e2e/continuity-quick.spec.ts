import { test, expect } from '@playwright/test';

test.describe('Continuity PDF Annotations', () => {
  test('should show annotation tools on continuity tab', async ({ page }) => {
    // Go to local dev
    await page.goto('http://localhost:8080');
    await page.waitForTimeout(2000);

    // Check if we see the app
    console.log('Page title:', await page.title());
    await page.screenshot({ path: 'test-results/continuity-1-initial.png' });

    // Look for backlot in navigation
    const backlotLinks = await page.locator('text=Backlot').all();
    console.log('Found Backlot links:', backlotLinks.length);

    // If we need to login, pause
    const needsLogin = await page.locator('text=Sign In, text=Login, text=Log in').first().isVisible({ timeout: 2000 }).catch(() => false);
    if (needsLogin) {
      console.log('Needs login - pausing for manual login');
      await page.pause();
    }

    // Try to find and click Backlot
    await page.locator('text=Backlot').first().click({ timeout: 10000 }).catch(() => console.log('No Backlot link found'));
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/continuity-2-backlot.png' });

    // Find the first project
    const projectLinks = await page.locator('a[href*="workspace"]').all();
    console.log('Found project links:', projectLinks.length);
    if (projectLinks.length > 0) {
      await projectLinks[0].click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: 'test-results/continuity-3-project.png' });

    // Find Continuity tab
    await page.locator('text=Continuity').first().click({ timeout: 5000 }).catch(() => console.log('No Continuity tab'));
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/continuity-4-tab.png' });

    // Check for annotation toolbar
    const toolbar = page.locator('[class*="bg-[#323232]"]');
    const toolbarVisible = await toolbar.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('Toolbar visible:', toolbarVisible);

    // Check for specific tools
    const tools = [
      { name: 'Select', selector: 'button:has(svg[class*="lucide-mouse-pointer"])' },
      { name: 'Note', selector: 'button:has(svg[class*="lucide-message-square"])' },
      { name: 'Highlight', selector: 'button:has(svg[class*="lucide-highlighter"])' },
      { name: 'Pen', selector: 'button:has(svg[class*="lucide-pencil"])' },
      { name: 'Undo', selector: 'button:has(svg[class*="lucide-undo"])' },
      { name: 'Redo', selector: 'button:has(svg[class*="lucide-redo"])' },
    ];

    for (const tool of tools) {
      const visible = await page.locator(tool.selector).first().isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`${tool.name} tool visible:`, visible);
    }

    await page.screenshot({ path: 'test-results/continuity-5-final.png' });

    // Interactive testing
    console.log('\n--- Entering interactive mode. Press Ctrl+C when done ---');
    await page.pause();
  });
});
