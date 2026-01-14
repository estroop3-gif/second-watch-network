/**
 * Script to compare PDF view vs Editor view in the script editor
 * Takes screenshots of both views for formatting comparison
 */

import { chromium } from 'playwright';

async function compareScriptViews() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to localhost:8080...');
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });

    // Wait for login page
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    console.log('Login page loaded');

    // Login (using test credentials)
    console.log('Logging in...');
    await page.fill('input[type="email"]', 'ian@secondwatch.network');
    await page.fill('input[type="password"]', 'Password1!');
    await page.click('button[type="submit"]');

    // Wait for navigation after login
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    console.log('Logged in successfully');

    // Navigate to Backlot
    console.log('Navigating to Backlot...');
    await page.click('text=Backlot');
    await page.waitForURL('**/backlot', { timeout: 10000 });

    // Look for Progressive Dental project
    console.log('Looking for Progressive Dental project...');
    const projectCard = page.locator('text=Progressive Dental').first();
    await projectCard.waitFor({ timeout: 10000 });
    await projectCard.click();

    // Wait for project workspace to load
    await page.waitForTimeout(2000);

    // Look for Scripts in the sidebar or navigation
    console.log('Opening Scripts section...');
    const scriptsLink = page.locator('text=Scripts').first();
    await scriptsLink.waitFor({ timeout: 10000 });
    await scriptsLink.click();

    await page.waitForTimeout(2000);

    // Look for "The Last Watch" script
    console.log('Looking for "The Last Watch" script...');
    const scriptCard = page.locator('text=The Last Watch').first();
    await scriptCard.waitFor({ timeout: 10000 });
    await scriptCard.click();

    await page.waitForTimeout(2000);

    // Take screenshot of the initial view (likely PDF view)
    console.log('Taking screenshot of PDF view...');
    await page.screenshot({
      path: '/home/estro/second-watch-network/frontend/pdf-view-screenshot.png',
      fullPage: true
    });

    // Look for "Page" and "Inline" view mode buttons
    console.log('Checking for view mode buttons...');
    const pageButton = page.locator('button:has-text("Page")').first();
    const inlineButton = page.locator('button:has-text("Inline")').first();

    if (await pageButton.isVisible()) {
      console.log('Found Page/Inline view toggle. Taking screenshot of Page view...');

      // Ensure Page view is selected
      await pageButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: '/home/estro/second-watch-network/frontend/page-view-screenshot.png',
        fullPage: true
      });

      // Switch to Inline view
      console.log('Switching to Inline view...');
      await inlineButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: '/home/estro/second-watch-network/frontend/inline-view-screenshot.png',
        fullPage: true
      });
    }

    // Try to find Edit button and enter edit mode
    console.log('Looking for Edit button...');
    const editButton = page.locator('button:has-text("Edit")').first();
    if (await editButton.isVisible({ timeout: 5000 })) {
      console.log('Clicking Edit button...');
      await editButton.click();
      await page.waitForTimeout(2000);

      // Take screenshot in edit mode (Page view)
      await page.screenshot({
        path: '/home/estro/second-watch-network/frontend/edit-page-view-screenshot.png',
        fullPage: true
      });

      // Check if we can switch to inline edit mode
      const inlineButtonEdit = page.locator('button:has-text("Inline")').first();
      if (await inlineButtonEdit.isVisible()) {
        await inlineButtonEdit.click();
        await page.waitForTimeout(1000);
        await page.screenshot({
          path: '/home/estro/second-watch-network/frontend/edit-inline-view-screenshot.png',
          fullPage: true
        });
      }
    }

    console.log('Screenshots captured successfully!');
    console.log('Files saved:');
    console.log('  - /home/estro/second-watch-network/frontend/pdf-view-screenshot.png');
    console.log('  - /home/estro/second-watch-network/frontend/page-view-screenshot.png');
    console.log('  - /home/estro/second-watch-network/frontend/inline-view-screenshot.png');
    console.log('  - /home/estro/second-watch-network/frontend/edit-page-view-screenshot.png');
    console.log('  - /home/estro/second-watch-network/frontend/edit-inline-view-screenshot.png');

  } catch (error) {
    console.error('Error during script execution:', error);
    await page.screenshot({
      path: '/home/estro/second-watch-network/frontend/error-screenshot.png',
      fullPage: true
    });
  } finally {
    await browser.close();
  }
}

compareScriptViews();
