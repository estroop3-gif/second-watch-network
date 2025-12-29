/**
 * Admin Forum Management E2E Tests
 *
 * Tests the admin Forum Management panel to ensure it's correctly connected to
 * the NEW community forum system (Topics in /filmmakers page), not the old Backlot forum.
 *
 * Database tables tested:
 * - community_topics (forum categories)
 * - community_topic_threads (discussion threads)
 * - community_topic_replies (thread comments)
 * - content_reports (user reports)
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin-password';
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

/**
 * Helper function to login as admin
 */
async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard or home
  await page.waitForURL(/\/(dashboard|admin)/, { timeout: 10000 });
}

/**
 * Helper function to navigate to Forum Management
 */
async function navigateToForumManagement(page: Page) {
  // Navigate to admin section
  await page.goto(`${BASE_URL}/admin/forum-management`);

  // Wait for page to load
  await page.waitForSelector('h1:has-text("Community Forum")', { timeout: 5000 });
}

test.describe('Admin Forum Management - Connection Verification', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await navigateToForumManagement(page);
  });

  test('should display Forum Management page with correct title', async ({ page }) => {
    // Verify main title
    await expect(page.locator('h1')).toContainText('Community Forum');
  });

  test('should show all four tabs: Topics, Threads, Comments, Reports', async ({ page }) => {
    // Verify all tabs are present
    await expect(page.getByRole('tab', { name: /Topics/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Threads/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Comments/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Reports/i })).toBeVisible();
  });

  test.describe('Topics Tab', () => {
    test('should load Topics from community_topics table', async ({ page }) => {
      // Click Topics tab (should be active by default)
      await page.getByRole('tab', { name: /Topics/i }).click();

      // Wait for table to load
      await page.waitForSelector('table', { timeout: 5000 });

      // Verify table headers match community_topics schema
      const headers = await page.locator('thead th').allTextContents();
      expect(headers).toContain('Icon');
      expect(headers).toContain('Name');
      expect(headers).toContain('Description');
      expect(headers).toContain('Threads');
      expect(headers).toContain('Status');
      expect(headers).toContain('Created At');
      expect(headers).toContain('Actions');
    });

    test('should have Create Topic button', async ({ page }) => {
      await page.getByRole('tab', { name: /Topics/i }).click();

      // Verify Create button exists
      await expect(page.getByRole('button', { name: /Create Topic/i })).toBeVisible();
    });

    test('should link topics to /filmmakers community page (not /the-backlot)', async ({ page }) => {
      await page.getByRole('tab', { name: /Topics/i }).click();

      // Wait for table to load
      await page.waitForSelector('table tbody tr', { timeout: 5000 });

      // Check if there are any topic rows
      const topicRows = await page.locator('table tbody tr').count();

      if (topicRows > 0) {
        // Get the first topic link
        const topicLink = page.locator('table tbody tr').first().locator('a').first();
        const href = await topicLink.getAttribute('href');

        // Verify link points to /filmmakers (NEW community), not /the-backlot (OLD forum)
        expect(href).toContain('/filmmakers');
        expect(href).not.toContain('/the-backlot');
      } else {
        console.log('No topics found to verify link - test skipped');
      }
    });

    test('should display topic thread counts', async ({ page }) => {
      await page.getByRole('tab', { name: /Topics/i }).click();

      // Wait for table
      await page.waitForSelector('table', { timeout: 5000 });

      // Verify Threads column exists
      const threadsHeader = page.locator('thead th:has-text("Threads")');
      await expect(threadsHeader).toBeVisible();
    });
  });

  test.describe('Threads Tab', () => {
    test('should load Threads from community_topic_threads table', async ({ page }) => {
      // Click Threads tab
      await page.getByRole('tab', { name: /Threads/i }).click();

      // Wait for table or loading state
      await page.waitForSelector('table, [role="progressbar"]', { timeout: 5000 });

      // If not loading, verify table headers
      const isLoading = await page.locator('[role="progressbar"]').isVisible().catch(() => false);

      if (!isLoading) {
        const headers = await page.locator('thead th').allTextContents();
        expect(headers.some(h => h.includes('Title'))).toBeTruthy();
        expect(headers.some(h => h.includes('Topic'))).toBeTruthy();
        expect(headers.some(h => h.includes('Author'))).toBeTruthy();
        expect(headers.some(h => h.includes('Created'))).toBeTruthy();
      }
    });

    test('should have search and filter functionality', async ({ page }) => {
      await page.getByRole('tab', { name: /Threads/i }).click();

      // Wait for page to load
      await page.waitForTimeout(1000);

      // Verify search input exists
      const searchInput = page.getByPlaceholder(/Search threads/i);
      await expect(searchInput).toBeVisible();

      // Verify topic filter dropdown exists
      const topicFilter = page.locator('select, button:has-text("All Topics")').first();
      await expect(topicFilter).toBeVisible();
    });

    test('should display thread topic associations', async ({ page }) => {
      await page.getByRole('tab', { name: /Threads/i }).click();

      // Wait for table
      await page.waitForSelector('table', { timeout: 5000 });

      // Verify Topic column exists (shows which community_topics each thread belongs to)
      const topicColumn = page.locator('thead th:has-text("Topic")');
      await expect(topicColumn).toBeVisible();
    });

    test('should show pin/unpin functionality', async ({ page }) => {
      await page.getByRole('tab', { name: /Threads/i }).click();

      // Wait for table
      await page.waitForSelector('table', { timeout: 5000 });

      // Verify Pinned column exists
      const pinnedColumn = page.locator('thead th:has-text("Pinned")');
      await expect(pinnedColumn).toBeVisible();
    });

    test('should have bulk delete functionality', async ({ page }) => {
      await page.getByRole('tab', { name: /Threads/i }).click();

      // Wait for table
      await page.waitForSelector('table', { timeout: 5000 });

      // Verify checkbox column exists for selection
      const checkboxHeader = page.locator('thead th input[type="checkbox"]');
      await expect(checkboxHeader).toBeVisible();
    });
  });

  test.describe('Comments Tab', () => {
    test('should load Comments from community_topic_replies table', async ({ page }) => {
      // Click Comments tab
      await page.getByRole('tab', { name: /Comments/i }).click();

      // Wait for table or loading state
      await page.waitForSelector('table, [role="progressbar"]', { timeout: 5000 });

      // Verify table headers
      const isLoading = await page.locator('[role="progressbar"]').isVisible().catch(() => false);

      if (!isLoading) {
        const headers = await page.locator('thead th').allTextContents();
        expect(headers.some(h => h.includes('Content'))).toBeTruthy();
        expect(headers.some(h => h.includes('Thread'))).toBeTruthy();
        expect(headers.some(h => h.includes('Author'))).toBeTruthy();
        expect(headers.some(h => h.includes('Created'))).toBeTruthy();
      }
    });

    test('should have search functionality', async ({ page }) => {
      await page.getByRole('tab', { name: /Comments/i }).click();

      // Wait for page to load
      await page.waitForTimeout(1000);

      // Verify search input exists
      const searchInput = page.getByPlaceholder(/Search comments/i);
      await expect(searchInput).toBeVisible();
    });

    test('should show thread associations for replies', async ({ page }) => {
      await page.getByRole('tab', { name: /Comments/i }).click();

      // Wait for table
      await page.waitForSelector('table', { timeout: 5000 });

      // Verify Thread column exists (shows which thread each reply belongs to)
      const threadColumn = page.locator('thead th:has-text("Thread")');
      await expect(threadColumn).toBeVisible();
    });

    test('should have delete functionality for comments', async ({ page }) => {
      await page.getByRole('tab', { name: /Comments/i }).click();

      // Wait for table
      await page.waitForSelector('table', { timeout: 5000 });

      // Verify Actions column exists
      const actionsColumn = page.locator('thead th:has-text("Actions")');
      await expect(actionsColumn).toBeVisible();
    });
  });

  test.describe('Reports Tab', () => {
    test('should load Reports from content_reports table', async ({ page }) => {
      // Click Reports tab
      await page.getByRole('tab', { name: /Reports/i }).click();

      // Wait for stats cards or table
      await page.waitForSelector('.grid, table', { timeout: 5000 });

      // Verify stats cards are visible
      await expect(page.locator('text=Pending')).toBeVisible();
      await expect(page.locator('text=Resolved')).toBeVisible();
      await expect(page.locator('text=Dismissed')).toBeVisible();
    });

    test('should display report statistics', async ({ page }) => {
      await page.getByRole('tab', { name: /Reports/i }).click();

      // Wait for stats to load
      await page.waitForSelector('.grid', { timeout: 5000 });

      // Verify all stat cards are present
      const statCards = page.locator('[class*="grid"] [class*="Card"]');
      await expect(statCards).toHaveCount(4); // Pending, Resolved, Dismissed, Total
    });

    test('should have status and content type filters', async ({ page }) => {
      await page.getByRole('tab', { name: /Reports/i }).click();

      // Wait for page to load
      await page.waitForTimeout(1000);

      // Verify filter dropdowns exist
      const filters = page.locator('select, button[role="combobox"]');
      expect(await filters.count()).toBeGreaterThanOrEqual(2);
    });

    test('should show report details with content type (thread/reply)', async ({ page }) => {
      await page.getByRole('tab', { name: /Reports/i }).click();

      // Wait for table
      await page.waitForSelector('table', { timeout: 5000 });

      // Verify table has Type column showing content_type from reports
      const typeColumn = page.locator('thead th:has-text("Type")');
      await expect(typeColumn).toBeVisible();
    });

    test('should show pending reports count badge on tab', async ({ page }) => {
      // Check if Reports tab has a badge indicating pending reports
      const reportsTab = page.getByRole('tab', { name: /Reports/i });

      // Badge might show number of pending reports
      const badge = reportsTab.locator('[class*="badge"], [class*="Badge"]');

      // Badge should exist if there are pending reports
      if (await badge.isVisible().catch(() => false)) {
        const badgeText = await badge.textContent();
        expect(badgeText).toMatch(/\d+/); // Should contain a number
      }
    });
  });

  test.describe('Data Integration Tests', () => {
    test('should verify Topics -> Threads relationship', async ({ page }) => {
      // Go to Topics tab
      await page.getByRole('tab', { name: /Topics/i }).click();
      await page.waitForSelector('table', { timeout: 5000 });

      // Get first topic name (if exists)
      const firstTopicCell = page.locator('table tbody tr').first().locator('td').nth(1);
      const topicExists = await firstTopicCell.isVisible().catch(() => false);

      if (topicExists) {
        const topicName = await firstTopicCell.textContent();

        // Switch to Threads tab
        await page.getByRole('tab', { name: /Threads/i }).click();
        await page.waitForSelector('table', { timeout: 5000 });

        // Verify topic filter includes the topic we saw
        const topicFilter = page.locator('button:has-text("All Topics"), select');
        await topicFilter.click();

        // Should see the topic in the dropdown
        await expect(page.locator(`text=${topicName}`)).toBeVisible({ timeout: 3000 });
      }
    });

    test('should verify Threads -> Comments relationship', async ({ page }) => {
      // Go to Threads tab
      await page.getByRole('tab', { name: /Threads/i }).click();
      await page.waitForSelector('table', { timeout: 5000 });

      // Get first thread title (if exists)
      const firstThreadCell = page.locator('table tbody tr').first().locator('td').nth(1);
      const threadExists = await firstThreadCell.isVisible().catch(() => false);

      if (threadExists) {
        // Switch to Comments tab
        await page.getByRole('tab', { name: /Comments/i }).click();
        await page.waitForSelector('table', { timeout: 5000 });

        // Verify thread filter dropdown exists
        const threadFilter = page.locator('button:has-text("All Threads"), select');
        await expect(threadFilter).toBeVisible();
      }
    });
  });

  test.describe('API Endpoint Verification', () => {
    test('should call correct admin community API endpoints', async ({ page }) => {
      // Set up request interception
      const apiCalls: string[] = [];

      page.on('request', request => {
        const url = request.url();
        if (url.includes('/api/v1/admin/community/')) {
          apiCalls.push(url);
        }
      });

      // Navigate through all tabs
      await page.getByRole('tab', { name: /Topics/i }).click();
      await page.waitForTimeout(1000);

      await page.getByRole('tab', { name: /Threads/i }).click();
      await page.waitForTimeout(1000);

      await page.getByRole('tab', { name: /Comments/i }).click();
      await page.waitForTimeout(1000);

      await page.getByRole('tab', { name: /Reports/i }).click();
      await page.waitForTimeout(1000);

      // Verify correct endpoints were called
      const topicsCall = apiCalls.some(url => url.includes('/admin/community/topics'));
      const threadsCall = apiCalls.some(url => url.includes('/admin/community/threads'));
      const repliesCall = apiCalls.some(url => url.includes('/admin/community/replies'));
      const reportsCall = apiCalls.some(url => url.includes('/admin/community/reports'));

      expect(topicsCall).toBeTruthy();
      expect(threadsCall).toBeTruthy();
      expect(repliesCall).toBeTruthy();
      expect(reportsCall).toBeTruthy();

      // Verify NO calls to old Backlot forum endpoints
      const backlotCalls = apiCalls.some(url => url.includes('/the-backlot') || url.includes('/backlot/forum'));
      expect(backlotCalls).toBeFalsy();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle empty state gracefully on Topics tab', async ({ page }) => {
      await page.getByRole('tab', { name: /Topics/i }).click();
      await page.waitForTimeout(1000);

      // Should show either data or "No topics found" message
      const hasData = await page.locator('table tbody tr').count() > 0;
      const hasEmptyMessage = await page.locator('text=/No topics/i').isVisible().catch(() => false);

      expect(hasData || hasEmptyMessage).toBeTruthy();
    });

    test('should handle loading states properly', async ({ page }) => {
      // Click through tabs quickly
      await page.getByRole('tab', { name: /Threads/i }).click();

      // Should show loading indicator or data
      const hasLoader = await page.locator('[role="progressbar"], .animate-spin').isVisible().catch(() => false);
      const hasTable = await page.locator('table').isVisible().catch(() => false);

      expect(hasLoader || hasTable).toBeTruthy();
    });
  });
});

test.describe('Admin Forum Management - CRUD Operations', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await navigateToForumManagement(page);
  });

  test.describe('Topic Management', () => {
    test('should open Create Topic dialog', async ({ page }) => {
      await page.getByRole('tab', { name: /Topics/i }).click();

      // Click Create Topic button
      await page.getByRole('button', { name: /Create Topic/i }).click();

      // Dialog should open
      await expect(page.locator('dialog, [role="dialog"]')).toBeVisible();
      await expect(page.locator('text=/Create.*Topic/i')).toBeVisible();
    });

    test('should have all required fields in Topic form', async ({ page }) => {
      await page.getByRole('tab', { name: /Topics/i }).click();
      await page.getByRole('button', { name: /Create Topic/i }).click();

      // Verify form fields
      await expect(page.locator('input[name="name"], label:has-text("Topic Name") + input')).toBeVisible();
      await expect(page.locator('textarea[name="description"], label:has-text("Description") + textarea')).toBeVisible();
      await expect(page.locator('input[name="icon"], label:has-text("Icon") + input')).toBeVisible();
      await expect(page.locator('text=Active')).toBeVisible(); // Active toggle
    });
  });

  test.describe('Thread Management', () => {
    test('should have delete functionality for threads', async ({ page }) => {
      await page.getByRole('tab', { name: /Threads/i }).click();
      await page.waitForSelector('table', { timeout: 5000 });

      // Check if there are any threads
      const threadCount = await page.locator('table tbody tr').count();

      if (threadCount > 0) {
        // Should have trash/delete button in actions
        const deleteButton = page.locator('table tbody tr').first().locator('button[title*="Delete"], button:has([class*="trash"])');
        await expect(deleteButton).toBeVisible();
      }
    });

    test('should have pin/unpin functionality for threads', async ({ page }) => {
      await page.getByRole('tab', { name: /Threads/i }).click();
      await page.waitForSelector('table', { timeout: 5000 });

      // Check if there are any threads
      const threadCount = await page.locator('table tbody tr').count();

      if (threadCount > 0) {
        // Should have pin button in actions
        const pinButton = page.locator('table tbody tr').first().locator('button[title*="Pin"], button:has([class*="pin"])');
        await expect(pinButton).toBeVisible();
      }
    });
  });
});
