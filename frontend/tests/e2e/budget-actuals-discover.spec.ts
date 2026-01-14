/**
 * E2E Test: Discover Backlot Projects and Budget Actuals
 *
 * This test discovers available Backlot projects and investigates
 * the budget actuals system for the first available project.
 */

import { test } from '@playwright/test';

const BASE_URL = 'http://localhost:8080';

test.use({ browserName: 'chromium' });

test.describe('Discover and Investigate Budget Actuals', () => {
  test('discover projects and investigate budget actuals', async ({ page }) => {
    console.log('\n========================================');
    console.log('PROJECT DISCOVERY AND INVESTIGATION');
    console.log('========================================\n');

    await page.setViewportSize({ width: 1920, height: 1080 });

    // Capture relevant console logs
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error' || text.toLowerCase().includes('budget') || text.toLowerCase().includes('actual')) {
        console.log(`[Console ${type}]:`, text);
      }
    });

    // Monitor budget/actuals API calls
    const apiCalls: any[] = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('budget') || url.includes('actual') || url.includes('approval')) {
        apiCalls.push({
          type: 'request',
          method: request.method(),
          url: url.replace(BASE_URL, '')
        });
        console.log(`[→] ${request.method()} ${url.replace(BASE_URL, '')}`);
      }
    });

    page.on('response', async response => {
      const url = response.url();
      if (url.includes('budget') || url.includes('actual') || url.includes('approval')) {
        const status = response.status();
        apiCalls.push({
          type: 'response',
          status: status,
          url: url.replace(BASE_URL, '')
        });
        console.log(`[←] ${status} ${url.replace(BASE_URL, '')}`);
      }
    });

    // Navigate to home
    console.log('Step 1: Navigating to home page...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'test-results/discover-01-home.png',
      fullPage: false
    });

    console.log('Current URL:', page.url());

    // Check if logged in by looking for user avatar or login button
    const loginButton = page.locator('button:has-text("LOG IN"), a:has-text("LOG IN")').first();
    const isLoginVisible = await loginButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (isLoginVisible) {
      console.log('\nNot logged in. Please log in manually and run test again.');
      console.log('Or the test will attempt to continue without auth...\n');
    } else {
      console.log('\nAppears to be logged in (no login button visible)');
    }

    // Navigate to Backlot
    console.log('\nStep 2: Navigating to Backlot...');
    await page.goto(`${BASE_URL}/backlot`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'test-results/discover-02-backlot.png',
      fullPage: true
    });

    console.log('Current URL:', page.url());

    // Look for project cards/links
    console.log('\nStep 3: Looking for Backlot projects...');

    const projectLinks = page.locator('a[href*="/backlot/project/"]');
    const projectCount = await projectLinks.count();

    console.log(`Found ${projectCount} project links`);

    if (projectCount === 0) {
      console.log('\n⚠ No Backlot projects found!');
      console.log('Possible reasons:');
      console.log('- User is not logged in');
      console.log('- User has no Backlot projects');
      console.log('- Projects are loaded dynamically and not visible yet');

      // Try waiting a bit more
      await page.waitForTimeout(3000);
      const projectCountAgain = await projectLinks.count();
      console.log(`After waiting 3s, found ${projectCountAgain} projects`);

      // Check what IS on the page
      const bodyText = await page.locator('body').textContent();
      if (bodyText) {
        console.log('\nPage content preview:');
        console.log(bodyText.substring(0, 500));
      }

      return;
    }

    // Get project IDs and names
    console.log('\nProjects found:');
    const projects: Array<{id: string; name: string; href: string}> = [];

    for (let i = 0; i < Math.min(projectCount, 10); i++) {
      const link = projectLinks.nth(i);
      const href = await link.getAttribute('href') || '';
      const id = href.split('/backlot/project/')[1] || '';
      const name = await link.textContent() || '';

      if (id) {
        projects.push({ id, name: name.trim(), href });
        console.log(`  ${i + 1}. ${name.trim()} (${id})`);
      }
    }

    if (projects.length === 0) {
      console.log('\n⚠ No valid project IDs found');
      return;
    }

    // Click on first project
    const firstProject = projects[0];
    console.log(`\nStep 4: Opening project "${firstProject.name}"...`);

    await projectLinks.first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'test-results/discover-03-project-page.png',
      fullPage: true
    });

    console.log('Current URL:', page.url());

    // Look for Budget tab in navigation
    console.log('\nStep 5: Looking for Budget tab...');

    const budgetTabSelectors = [
      'a:has-text("Budget")',
      'button:has-text("Budget")',
      '[role="tab"]:has-text("Budget")',
      '[href*="budget"]'
    ];

    let budgetTab = null;
    let foundSelector = '';

    for (const selector of budgetTabSelectors) {
      const element = page.locator(selector).first();
      const isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);
      if (isVisible) {
        budgetTab = element;
        foundSelector = selector;
        break;
      }
    }

    if (!budgetTab) {
      console.log('⚠ Budget tab not found!');

      // List all visible navigation elements
      const navElements = page.locator('a, button, [role="tab"]');
      const navCount = await navElements.count();
      console.log(`\nFound ${navCount} navigation elements. First 20:`);

      for (let i = 0; i < Math.min(navCount, 20); i++) {
        const elem = navElements.nth(i);
        const isVisible = await elem.isVisible().catch(() => false);
        if (isVisible) {
          const text = await elem.textContent();
          const href = await elem.getAttribute('href');
          if (text && text.trim()) {
            console.log(`  ${i + 1}. "${text.trim()}" ${href ? `(${href})` : ''}`);
          }
        }
      }
      return;
    }

    console.log(`✓ Found Budget tab using selector: ${foundSelector}`);

    // Click Budget tab
    await budgetTab.click();
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: 'test-results/discover-04-budget-tab.png',
      fullPage: true
    });

    console.log('Current URL:', page.url());

    // Look for Actual/Estimated toggle
    console.log('\nStep 6: Looking for Actual toggle...');

    const actualToggle = page.locator('button:has-text("Actual")').first();
    const actualToggleVisible = await actualToggle.isVisible({ timeout: 3000 }).catch(() => false);

    const estimatedToggle = page.locator('button:has-text("Estimated")').first();
    const estimatedToggleVisible = await estimatedToggle.isVisible({ timeout: 3000 }).catch(() => false);

    console.log('Actual toggle visible:', actualToggleVisible);
    console.log('Estimated toggle visible:', estimatedToggleVisible);

    if (!actualToggleVisible || !estimatedToggleVisible) {
      console.log('\n⚠ Toggle buttons not found! Looking for alternative selectors...');

      // Look for text that might indicate the view mode
      const viewModeText = page.locator('text=/estimated|actual/i');
      const viewModeCount = await viewModeText.count();
      console.log(`Found ${viewModeCount} elements with "estimated" or "actual" text`);

      for (let i = 0; i < Math.min(viewModeCount, 5); i++) {
        const text = await viewModeText.nth(i).textContent();
        console.log(`  ${i + 1}. "${text}"`);
      }
    }

    if (actualToggleVisible) {
      console.log('\n✓ Found Actual toggle! Clicking it...');
      await actualToggle.click();
      await page.waitForTimeout(2000);

      await page.screenshot({
        path: 'test-results/discover-05-actual-view.png',
        fullPage: true
      });

      // Check for actual budget items
      const actualItemsArea = page.locator('[class*="actual"], .space-y-4').first();
      const hasContent = await actualItemsArea.isVisible({ timeout: 2000 }).catch(() => false);

      console.log('Actual view content visible:', hasContent);

      // Look for source type indicators
      const sourceTypes = ['receipt', 'mileage', 'kit rental', 'per diem', 'invoice', 'purchase order'];
      const foundItems: string[] = [];

      for (const sourceType of sourceTypes) {
        const items = page.locator(`text=/${sourceType}/i`);
        const count = await items.count();
        if (count > 0) {
          foundItems.push(`${sourceType} (${count})`);
        }
      }

      if (foundItems.length > 0) {
        console.log('\n✓ Found actual budget items:', foundItems.join(', '));
      } else {
        console.log('\n⚠ No actual budget items found');

        // Check for empty state
        const emptyState = page.locator('text=/no.*actual|no.*expense|empty/i').first();
        const hasEmptyState = await emptyState.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasEmptyState) {
          const emptyText = await emptyState.textContent();
          console.log('Empty state message:', emptyText);
        }
      }
    }

    // Now check Approvals tab
    console.log('\nStep 7: Looking for Approvals tab...');

    const approvalsTabSelectors = [
      'a:has-text("Approvals")',
      'button:has-text("Approvals")',
      '[role="tab"]:has-text("Approvals")',
      '[href*="approvals"]'
    ];

    let approvalsTab = null;

    for (const selector of approvalsTabSelectors) {
      const element = page.locator(selector).first();
      const isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);
      if (isVisible) {
        approvalsTab = element;
        break;
      }
    }

    if (!approvalsTab) {
      console.log('⚠ Approvals tab not found!');
    } else {
      console.log('✓ Found Approvals tab! Clicking it...');

      await approvalsTab.click();
      await page.waitForTimeout(2000);
      await page.waitForLoadState('networkidle');

      await page.screenshot({
        path: 'test-results/discover-06-approvals-tab.png',
        fullPage: true
      });

      // Look for pending items
      const pendingItems = page.locator('[class*="hover"], .cursor-pointer, button').filter({
        hasText: /receipt|mileage|kit.*rental|per.*diem|pending/i
      });
      const pendingCount = await pendingItems.count();

      console.log(`Found ${pendingCount} potential approval items`);

      if (pendingCount > 0) {
        console.log('\nFirst 5 approval items:');
        for (let i = 0; i < Math.min(pendingCount, 5); i++) {
          const item = pendingItems.nth(i);
          const text = await item.textContent();
          if (text) {
            console.log(`  ${i + 1}. ${text.substring(0, 80).trim()}...`);
          }
        }
      }
    }

    // Summary
    console.log('\n========================================');
    console.log('INVESTIGATION SUMMARY');
    console.log('========================================');
    console.log(`Projects found: ${projects.length}`);
    console.log(`Budget tab found: ${budgetTab ? 'YES' : 'NO'}`);
    console.log(`Actual toggle found: ${actualToggleVisible ? 'YES' : 'NO'}`);
    console.log(`Approvals tab found: ${approvalsTab ? 'YES' : 'NO'}`);
    console.log(`\nAPI calls made: ${apiCalls.length}`);

    if (apiCalls.length > 0) {
      console.log('\nAPI endpoints called:');
      const endpoints = new Set(apiCalls.filter(c => c.type === 'request').map(c => c.url));
      endpoints.forEach(endpoint => console.log(`  - ${endpoint}`));
    }

    console.log('\n========================================\n');

    await page.screenshot({
      path: 'test-results/discover-07-final.png',
      fullPage: true
    });
  });
});
