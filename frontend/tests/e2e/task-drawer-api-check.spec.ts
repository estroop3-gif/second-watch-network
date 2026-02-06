/**
 * E2E Test: Check Task Drawer API Responses
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8080';

// Use the stored auth state
test.use({ storageState: 'playwright/.auth/user.json' });

test.describe('Task Drawer API Check', () => {
  test('check members API response', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Capture API responses
    const membersResponses: any[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/access/members')) {
        try {
          const body = await response.json();
          membersResponses.push({ url, status: response.status(), body });
          console.log('\n=== MEMBERS API RESPONSE ===');
          console.log('URL:', url);
          console.log('Status:', response.status());
          if (Array.isArray(body)) {
            body.forEach((m: any, i: number) => {
              console.log(`Member ${i}: user_name="${m.user_name}", user_username="${m.user_username}", email="${m.email}"`);
            });
          }
        } catch (e) {
          // ignore
        }
      }
    });

    // Capture console logs from the page
    page.on('console', msg => {
      if (msg.text().includes('useProjectMembers')) {
        console.log('[PAGE CONSOLE]', msg.text());
      }
    });

    // Go to Progressive Dental project
    console.log('Navigating to project...');
    await page.goto(`${BASE_URL}/backlot/projects/d837dec7-f17a-4f1c-b808-dc668ebec699`, {
      waitUntil: 'networkidle',
      timeout: 60000
    });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'test-results/task-api-01-project.png' });

    // Click on the Tasks card on the overview page
    const tasksCard = page.locator('text=Tasks').first();
    if (await tasksCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Clicking Tasks card...');
      await tasksCard.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    console.log('Current URL:', page.url());
    await page.screenshot({ path: 'test-results/task-api-02-tasks.png' });

    // Look for task table rows
    const taskRows = page.locator('table tbody tr');
    const rowCount = await taskRows.count();
    console.log('Task rows found:', rowCount);

    if (rowCount > 0) {
      console.log('Clicking first task row...');
      await taskRows.first().click();
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: 'test-results/task-api-03-drawer.png' });

    // Check for drawer
    const drawer = page.locator('[data-state="open"]');
    const drawerVisible = await drawer.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('Drawer visible:', drawerVisible);

    // Look for Add buttons
    const addButtons = page.locator('button:has-text("Add")');
    const addCount = await addButtons.count();
    console.log('Add buttons found:', addCount);

    if (addCount > 0) {
      console.log('Clicking first Add button...');
      await addButtons.first().click();
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'test-results/task-api-04-popover.png' });

      // Check popover content
      const popover = page.locator('[data-radix-popper-content-wrapper]');
      if (await popover.isVisible({ timeout: 2000 }).catch(() => false)) {
        const text = await popover.textContent();
        console.log('Popover text:', text?.substring(0, 200));
      }
    }

    // Wait a bit for any delayed API calls
    await page.waitForTimeout(2000);

    // Summary
    console.log('\n=== FINAL SUMMARY ===');
    console.log('Members API calls captured:', membersResponses.length);
    membersResponses.forEach((resp, i) => {
      console.log(`\nResponse ${i}:`);
      if (Array.isArray(resp.body)) {
        resp.body.slice(0, 5).forEach((m: any, j: number) => {
          console.log(`  Member ${j}: user_name="${m.user_name}", email="${m.email}"`);
        });
      }
    });
  });
});
