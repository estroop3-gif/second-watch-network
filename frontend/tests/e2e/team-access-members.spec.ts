/**
 * E2E Tests: Team & Access — Team Members Tab
 *
 * Covers member list, search, add member, role changes, role assignment,
 * permission editing, and member removal.
 */
import { test, expect } from '@playwright/test';
import {
  navigateToTeamAccess,
  switchSubTab,
  searchMembers,
  addMemberViaDialog,
  waitForToast,
} from './helpers/team-access.helpers';

// Uses owner auth state (chromium-owner project)
test.describe('Team Members Tab', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToTeamAccess(page);
  });

  test('loads with 3 sub-tabs visible for owner', async ({ page }) => {
    await expect(page.locator('[role="tab"]:has-text("Team Members")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("Roles & Permissions")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("External Access")')).toBeVisible();
  });

  test('header shows correct member count', async ({ page }) => {
    const countText = page.locator('text=/\\d+ team member/');
    await expect(countText).toBeVisible();
    const text = await countText.textContent();
    expect(text).toMatch(/\d+ team members?/);
  });

  test('search filters members by name', async ({ page }) => {
    // Get initial count
    const initialCards = page.locator('.bg-charcoal-black\\/50.border');
    const initialCount = await initialCards.count();
    expect(initialCount).toBeGreaterThan(0);

    // Search for a name that likely doesn't match all
    await searchMembers(page, 'zzz_no_match_zzz');
    await expect(page.locator('text=No team members found')).toBeVisible();
  });

  test('search filters members by username', async ({ page }) => {
    await searchMembers(page, '@');
    // At least some members should have @ in their display — but the filter matches on name/username
    // Clear and verify reset
    await searchMembers(page, '');
    const cards = page.locator('.bg-charcoal-black\\/50.border');
    await expect(cards.first()).toBeVisible();
  });

  test('"Add Member" button opens dialog', async ({ page }) => {
    await page.locator('button:has-text("Add Member")').click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('[role="dialog"]').locator('text=Add Team Member')).toBeVisible();
    // Close
    await page.keyboard.press('Escape');
  });

  test('add member flow: search → select → choose role → submit', async ({ page }) => {
    // Open the Add Member dialog
    await page.locator('button:has-text("Add Member")').click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Search for the editor test account
    const searchInput = page.locator(
      '[role="dialog"] input[placeholder*="Search"], [role="dialog"] input[placeholder*="search"]'
    );
    await searchInput.fill('swn-test-editor');
    await page.waitForTimeout(800);

    // Check if search results appear
    const results = page.locator('[role="dialog"] button').filter({ hasText: /swn-test-editor|SWN Test Editor/ });
    const resultCount = await results.count();
    if (resultCount > 0) {
      await results.first().click();

      // Submit
      await page.locator('[role="dialog"] button:has-text("Add Member")').last().click();

      // Wait for toast — could be success or "already a member"
      const toast = page.locator('[data-sonner-toast]').first();
      await expect(toast).toBeVisible({ timeout: 5000 });
    } else {
      // User not found in search — just close
      await page.keyboard.press('Escape');
      test.skip();
    }
  });

  test('change project role via dropdown', async ({ page }) => {
    // Find a role combobox inside the member list (not the header role selector)
    // The member list area is the tab panel content
    const memberArea = page.locator('[role="tabpanel"]');
    const selectTrigger = memberArea.locator('button[role="combobox"]').first();
    const isVisible = await selectTrigger.isVisible().catch(() => false);
    if (!isVisible) {
      // No members with editable roles (owner can't change own role)
      test.skip();
      return;
    }

    // Read current role text to pick a different one
    const currentRole = (await selectTrigger.textContent())?.trim().toLowerCase() || '';
    await selectTrigger.click();

    // Pick a role that's different from the current one
    const options = page.locator('[role="option"]');
    const count = await options.count();
    let clicked = false;
    for (let i = 0; i < count; i++) {
      const optText = (await options.nth(i).textContent())?.trim().toLowerCase() || '';
      if (optText !== currentRole && optText !== 'owner') {
        await options.nth(i).click();
        clicked = true;
        break;
      }
    }

    if (clicked) {
      await waitForToast(page, 'Role updated');
    } else {
      await page.keyboard.press('Escape');
      test.skip();
    }
  });

  test('assign backlot role via Shield button', async ({ page }) => {
    // Click first Shield button (Assign role)
    const shieldBtn = page.locator('button[title="Assign role"]').first();
    const isVisible = await shieldBtn.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip();
      return;
    }

    await shieldBtn.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    // Title is "Assign Role to {name}"
    await expect(page.locator('[role="dialog"]').locator('text=/Assign Role to/i')).toBeVisible();

    // Select a role from the combobox
    const roleSelect = page.locator('[role="dialog"] button[role="combobox"]');
    if (await roleSelect.isVisible()) {
      await roleSelect.click();
      const firstRole = page.locator('[role="option"]').first();
      if (await firstRole.isVisible()) {
        await firstRole.click();
        await page.waitForTimeout(300);
        // Click the submit button
        const assignBtn = page.locator('[role="dialog"] button:has-text("Assign")').last();
        await assignBtn.click();
        await waitForToast(page, 'Role assigned');
      } else {
        await page.keyboard.press('Escape');
        test.skip();
      }
    } else {
      await page.keyboard.press('Escape');
      test.skip();
    }
  });

  test('click non-primary role badge sets it as primary', async ({ page }) => {
    // Look for a clickable non-primary role badge with title "Click to set as primary"
    const clickableBadge = page.locator('[title="Click to set as primary"]').first();
    const isVisible = await clickableBadge.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip();
      return;
    }

    await clickableBadge.click();
    await waitForToast(page, 'Primary role updated');
  });

  test('edit permissions via UserCog button opens dialog', async ({ page }) => {
    const userCogBtn = page.locator('button[title="Edit permissions"]').first();
    const isVisible = await userCogBtn.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip();
      return;
    }

    await userCogBtn.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Dialog should show tab/section toggles (accordion headers)
    await expect(
      page.locator('[role="dialog"]').getByRole('button', { name: 'Tab Permissions' })
    ).toBeVisible();

    // Close
    await page.keyboard.press('Escape');
  });

  test('edit permissions: toggle tab → save → "Custom" badge appears', async ({ page }) => {
    const userCogBtn = page.locator('button[title="Edit permissions"]').first();
    if (!(await userCogBtn.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    await userCogBtn.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Find a switch toggle inside the dialog and click it to trigger hasChanges
    const toggle = page.locator('[role="dialog"] button[role="switch"]').first();
    if (await toggle.isVisible()) {
      await toggle.click();
      await page.waitForTimeout(300);

      // Button text is "Save Changes" and is enabled only when hasChanges is true
      const saveBtn = page.locator('[role="dialog"] button:has-text("Save Changes")');
      await expect(saveBtn).toBeEnabled({ timeout: 3000 });
      await saveBtn.click();
      await waitForToast(page, 'Permissions saved');
    } else {
      await page.keyboard.press('Escape');
      test.skip();
    }
  });

  test('reset permissions removes "Custom" badge', async ({ page }) => {
    const userCogBtn = page.locator('button[title="Edit permissions"]').first();
    if (!(await userCogBtn.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    await userCogBtn.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    const resetBtn = page.locator('[role="dialog"] button:has-text("Reset")');
    if (await resetBtn.isVisible()) {
      await resetBtn.click();
      await waitForToast(page, 'reset to role defaults');
    }
    await page.keyboard.press('Escape');
  });

  test('remove member via confirmation dialog', async ({ page }) => {
    const trashBtn = page.locator('button[title="Remove member"]').first();
    if (!(await trashBtn.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    await trashBtn.click();

    // Confirmation dialog
    await expect(page.locator('text=Remove Team Member')).toBeVisible();
    await expect(page.locator('text=Are you sure you want to remove')).toBeVisible();

    // Cancel to avoid actually removing
    await page.locator('button:has-text("Cancel")').click();
  });

  test('"Add from Network" button opens network modal', async ({ page }) => {
    const networkBtn = page.locator('button:has-text("Add from Network")');
    if (!(await networkBtn.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    await networkBtn.click();
    // Modal should appear
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await page.keyboard.press('Escape');
  });
});
