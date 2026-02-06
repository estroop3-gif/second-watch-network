/**
 * E2E Test: Debug Task Drawer Assignees and Comments
 *
 * ISSUES:
 * 1. Assignees showing as "Unknown" even with display_name fix
 * 2. Comments showing poster as "Unknown"
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'poboy3tv@gmail.com';
const TEST_PASSWORD = 'Parkera1bc!';
const BASE_URL = 'http://localhost:8080';

test.use({ browserName: 'firefox' });

test.describe('Task Drawer Debug', () => {
  test('debug assignees and comments API responses', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Capture all API responses
    const apiResponses: { url: string; status: number; body: any }[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/') && (
        url.includes('members') ||
        url.includes('comments') ||
        url.includes('tasks') ||
        url.includes('access')
      )) {
        try {
          const body = await response.json().catch(() => null);
          apiResponses.push({
            url: url,
            status: response.status(),
            body: body
          });
          console.log(`\n=== API Response ===`);
          console.log(`URL: ${url}`);
          console.log(`Status: ${response.status()}`);
          console.log(`Body:`, JSON.stringify(body, null, 2).substring(0, 2000));
        } catch (e) {
          // Ignore non-JSON responses
        }
      }
    });

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`Console Error: ${msg.text()}`);
      }
    });

    // Login
    console.log('Navigating to login page...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    const emailInput = page.locator('input[type="email"], input[name="email"], input#email').first();
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill(TEST_EMAIL);
    await page.locator('input[type="password"]').first().fill(TEST_PASSWORD);
    await page.locator('button[type="submit"], button:has-text("Sign In")').first().click();

    await page.waitForURL('**/*', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    console.log('Logged in, current URL:', page.url());

    // Navigate to backlot
    await page.goto(`${BASE_URL}/backlot`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Click on first project
    const projectCards = page.locator('a[href*="/backlot/project/"]');
    const projectCount = await projectCards.count();
    console.log('Found project cards:', projectCount);

    if (projectCount > 0) {
      await projectCards.first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
    }

    console.log('At project, current URL:', page.url());

    await page.screenshot({ path: 'test-results/task-debug-01-project.png' });

    // Navigate to Tasks tab
    const tasksTab = page.locator('a[href*="tasks"], button:has-text("Tasks"), [data-tab="tasks"]').first();
    const tasksTabVisible = await tasksTab.isVisible().catch(() => false);
    console.log('Tasks tab visible:', tasksTabVisible);

    if (tasksTabVisible) {
      await tasksTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    } else {
      // Try clicking on sidebar link
      const sidebarTasksLink = page.locator('aside a:has-text("Tasks")').first();
      if (await sidebarTasksLink.isVisible().catch(() => false)) {
        await sidebarTasksLink.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
      }
    }

    await page.screenshot({ path: 'test-results/task-debug-02-tasks-tab.png' });
    console.log('At tasks tab, current URL:', page.url());

    // Look for any task to click
    const taskItems = page.locator('[data-testid="task-item"], .task-item, tr[data-task-id], [role="row"]:has(td)').first();
    const taskItemVisible = await taskItems.isVisible().catch(() => false);
    console.log('Task item visible:', taskItemVisible);

    if (taskItemVisible) {
      await taskItems.click();
      await page.waitForTimeout(2000);
    } else {
      // Try to find any clickable task element
      const anyTask = page.locator('text=/todo|in.progress|completed/i').first();
      if (await anyTask.isVisible().catch(() => false)) {
        await anyTask.click();
        await page.waitForTimeout(2000);
      }
    }

    await page.screenshot({ path: 'test-results/task-debug-03-task-clicked.png' });

    // Check if task drawer is open
    const drawer = page.locator('[role="dialog"], [data-state="open"], .sheet-content').first();
    const drawerVisible = await drawer.isVisible().catch(() => false);
    console.log('Task drawer visible:', drawerVisible);

    // Look for assignee section
    const assigneeSection = page.locator('text=Assignees').first();
    const assigneeSectionVisible = await assigneeSection.isVisible().catch(() => false);
    console.log('Assignee section visible:', assigneeSectionVisible);

    // Check for "Add" button in assignees
    const addAssigneeButton = page.locator('button:has-text("Add")').first();
    if (await addAssigneeButton.isVisible().catch(() => false)) {
      console.log('Clicking Add button for assignees...');
      await addAssigneeButton.click();
      await page.waitForTimeout(1000);

      await page.screenshot({ path: 'test-results/task-debug-04-assignee-popover.png' });

      // Check what's in the popover
      const popoverContent = page.locator('[role="dialog"] [data-radix-popper-content-wrapper], [data-state="open"]').first();
      const popoverText = await popoverContent.textContent().catch(() => '');
      console.log('Popover content:', popoverText);
    }

    // Print all captured API responses
    console.log('\n\n========== ALL CAPTURED API RESPONSES ==========');
    for (const resp of apiResponses) {
      console.log(`\nURL: ${resp.url}`);
      console.log(`Status: ${resp.status}`);
      if (resp.body) {
        // Check for members data
        if (resp.url.includes('members') || resp.url.includes('access')) {
          console.log('MEMBERS DATA:');
          if (Array.isArray(resp.body)) {
            resp.body.forEach((member: any, i: number) => {
              console.log(`  Member ${i}: user_name="${member.user_name}", user_avatar="${member.user_avatar}", user_username="${member.user_username}", email="${member.email}"`);
            });
          } else if (resp.body.members) {
            resp.body.members.forEach((member: any, i: number) => {
              console.log(`  Member ${i}: user_name="${member.user_name}", user_avatar="${member.user_avatar}", user_username="${member.user_username}", email="${member.email}"`);
            });
          }
        }
        // Check for comments data
        if (resp.url.includes('comments')) {
          console.log('COMMENTS DATA:');
          if (Array.isArray(resp.body)) {
            resp.body.forEach((comment: any, i: number) => {
              console.log(`  Comment ${i}: user_profile.display_name="${comment.user_profile?.display_name}", user_profile.full_name="${comment.user_profile?.full_name}"`);
            });
          } else if (resp.body.comments) {
            resp.body.comments.forEach((comment: any, i: number) => {
              console.log(`  Comment ${i}: user_profile.display_name="${comment.user_profile?.display_name}", user_profile.full_name="${comment.user_profile?.full_name}"`);
            });
          }
        }
      }
    }

    await page.screenshot({ path: 'test-results/task-debug-05-final.png' });
  });
});
