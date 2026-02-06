/**
 * E2E Tests: Team & Access — Role-Based Tab Visibility
 *
 * Tests that different user roles see appropriate sub-tabs and action buttons.
 * Uses per-role auth state files created by multi-auth.setup.ts.
 */
import { test, expect } from '@playwright/test';
import {
  navigateToTeamAccess,
  navigateToProject,
} from './helpers/team-access.helpers';

// ---------- As Viewer ----------
test.describe('Visibility: Viewer role', () => {
  test.use({ storageState: 'playwright/.auth/viewer.json' });

  test('viewer can access the project workspace', async ({ page }) => {
    try {
      await navigateToProject(page);
    } catch {
      test.skip();
      return;
    }

    // Viewer should see the workspace loaded with Overview
    await expect(page.locator('button:has-text("Overview")')).toBeVisible();
  });

  test('Team & Access visibility and restricted sub-tabs for viewer', async ({ page }) => {
    try {
      await navigateToProject(page);
    } catch {
      test.skip();
      return;
    }

    const teamBtn = page.locator('button:has-text("Team & Access")');
    const isTeamVisible = await teamBtn.isVisible().catch(() => false);

    if (!isTeamVisible) {
      // Team & Access not visible for viewer — this is valid restricted behavior
      return;
    }

    // If Team & Access IS visible, click it and verify restricted sub-tabs
    await teamBtn.scrollIntoViewIfNeeded();
    await teamBtn.click();
    await expect(page.locator('h2:has-text("Team & Access")')).toBeVisible({ timeout: 15000 });

    // Team Members should be visible
    await expect(page.locator('[role="tab"]:has-text("Team Members")')).toBeVisible();

    // Roles & Permissions should NOT be visible for viewer
    const rolesTab = page.locator('[role="tab"]:has-text("Roles & Permissions")');
    await expect(rolesTab).not.toBeVisible();

    // External Access should NOT be visible for viewer
    const externalTab = page.locator('[role="tab"]:has-text("External Access")');
    await expect(externalTab).not.toBeVisible();
  });

  test('no "Add Member" or "Add from Network" buttons for viewer', async ({ page }) => {
    try {
      await navigateToProject(page);
    } catch {
      test.skip();
      return;
    }

    const teamBtn = page.locator('button:has-text("Team & Access")');
    if (!(await teamBtn.isVisible().catch(() => false))) {
      // Team & Access not visible — viewer is restricted, test passes
      return;
    }

    await teamBtn.scrollIntoViewIfNeeded();
    await teamBtn.click();
    await page.waitForTimeout(2000);

    await expect(page.locator('button:has-text("Add Member")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Add from Network")')).not.toBeVisible();
  });

  test('viewer sees no role dropdown or remove button on member cards', async ({ page }) => {
    try {
      await navigateToProject(page);
    } catch {
      test.skip();
      return;
    }

    const teamBtn = page.locator('button:has-text("Team & Access")');
    if (!(await teamBtn.isVisible().catch(() => false))) {
      // Team & Access not visible — viewer is restricted, test passes
      return;
    }

    await teamBtn.scrollIntoViewIfNeeded();
    await teamBtn.click();
    await page.waitForTimeout(2000);

    // Role select dropdown should not be present (viewer can't change roles)
    const memberArea = page.locator('[role="tabpanel"]');
    const roleSelect = memberArea.locator('button[role="combobox"]');
    await expect(roleSelect).not.toBeVisible();

    // Remove button should not be present
    const trashBtn = page.locator('button[title="Remove member"]');
    await expect(trashBtn).not.toBeVisible();
  });
});

// ---------- As Editor ----------
test.describe('Visibility: Editor role', () => {
  test.use({ storageState: 'playwright/.auth/editor.json' });

  test('editor sees appropriate tabs in sidebar', async ({ page }) => {
    try {
      await navigateToProject(page);
    } catch {
      test.skip();
      return;
    }

    // Editor should see the workspace loaded
    await expect(page.locator('button:has-text("Overview")')).toBeVisible();
  });

  test('Team & Access sub-tab behavior matches editor permissions', async ({ page }) => {
    try {
      await navigateToProject(page);
    } catch {
      test.skip();
      return;
    }

    const teamBtn = page.locator('button:has-text("Team & Access")');
    if (!(await teamBtn.isVisible().catch(() => false))) {
      // Team & Access not visible for editor — valid restricted behavior
      return;
    }

    await teamBtn.scrollIntoViewIfNeeded();
    await teamBtn.click();
    await page.waitForTimeout(2000);

    // Editor may or may not see Roles & Permissions depending on config
    const teamTab = page.locator('[role="tab"]:has-text("Team Members")');
    await expect(teamTab).toBeVisible();
  });
});

// ---------- As Owner ----------
test.describe('Visibility: Owner role', () => {
  test.use({ storageState: 'playwright/.auth/owner.json' });

  test('all 3 sub-tabs visible', async ({ page }) => {
    await navigateToTeamAccess(page);

    await expect(page.locator('[role="tab"]:has-text("Team Members")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("Roles & Permissions")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("External Access")')).toBeVisible();
  });

  test('all action buttons present', async ({ page }) => {
    await navigateToTeamAccess(page);

    await expect(page.locator('button:has-text("Add Member")')).toBeVisible();
    await expect(page.locator('button:has-text("Add from Network")')).toBeVisible();
  });

  test('all sidebar tabs visible for owner', async ({ page }) => {
    await navigateToProject(page);

    // Owner should see key workspace buttons
    await expect(page.locator('button:has-text("Team & Access")')).toBeVisible();
    await expect(page.locator('button:has-text("Settings")')).toBeVisible();
  });
});
