/**
 * E2E Tests: Team & Access — Error Handling
 *
 * Intercepts API calls and simulates failures to verify
 * that proper error toasts are shown to the user.
 */
import { test, expect } from '@playwright/test';
import {
  navigateToTeamAccess,
  switchSubTab,
  waitForToast,
} from './helpers/team-access.helpers';

test.describe('Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToTeamAccess(page);
  });

  test('add member with API failure → shows error toast', async ({ page }) => {
    // Intercept the add-member API call and force a failure
    // Use a broad pattern to catch both proxied and direct requests
    await page.route(/\/api\/v1\/backlot\/projects\/.*\/access\/members$/, (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal server error' }),
        });
      }
      return route.continue();
    });

    await page.locator('button:has-text("Add Member")').click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Fill in a search and select a user
    const searchInput = page.locator(
      '[role="dialog"] input[placeholder*="Search"], [role="dialog"] input[placeholder*="search"]'
    );
    await searchInput.fill('swn-test');
    await page.waitForTimeout(800);

    const result = page.locator('[role="dialog"] button').filter({ hasText: /swn-test|SWN Test/i }).first();
    if (await result.isVisible()) {
      await result.click();
      await page.locator('[role="dialog"] button:has-text("Add Member")').last().click();

      // Should show an error toast (either from intercepted 500 or "already a member")
      const toast = page.locator('[data-sonner-toast]').first();
      await expect(toast).toBeVisible({ timeout: 5000 });
    } else {
      await page.keyboard.press('Escape');
      test.skip();
    }
  });

  test('change role with API failure → shows error toast', async ({ page }) => {
    // Intercept member update (PATCH to /access/members/{id})
    await page.route('**/api/v1/backlot/projects/*/access/members/*', (route) => {
      if (route.request().method() === 'PATCH' || route.request().method() === 'PUT') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Failed to update' }),
        });
      }
      return route.continue();
    });

    // Find a role combobox inside the member list (not the header role selector)
    const memberArea = page.locator('[role="tabpanel"]');
    const selectTrigger = memberArea.locator('button[role="combobox"]').first();
    if (!(await selectTrigger.isVisible().catch(() => false))) {
      // No members with editable roles (owner can't change own role)
      test.skip();
      return;
    }

    // Read current role and pick a different one
    const currentRole = (await selectTrigger.textContent())?.trim().toLowerCase() || '';
    await selectTrigger.click();
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
      await waitForToast(page, 'Failed to update role');
    } else {
      await page.keyboard.press('Escape');
      test.skip();
    }
  });

  test('remove member with API failure → shows error toast', async ({ page }) => {
    await page.route('**/api/v1/backlot/projects/*/access/members/*', (route) => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Failed to delete' }),
        });
      }
      return route.continue();
    });

    const trashBtn = page.locator('button[title="Remove member"]').first();
    if (!(await trashBtn.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    await trashBtn.click();
    await expect(page.locator('text=Remove Team Member')).toBeVisible();
    await page.locator('button:has-text("Remove")').last().click();

    await waitForToast(page, 'Failed to remove team member');
  });

  test('save permissions with API failure → shows error toast', async ({ page }) => {
    await page.route('**/api/v1/backlot/projects/*/access/overrides*', (route) => {
      if (route.request().method() === 'POST' || route.request().method() === 'PUT') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Failed to save' }),
        });
      }
      return route.continue();
    });

    const userCogBtn = page.locator('button[title="Edit permissions"]').first();
    if (!(await userCogBtn.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    await userCogBtn.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    const toggle = page.locator('[role="dialog"] button[role="switch"]').first();
    if (await toggle.isVisible()) {
      await toggle.click();
      await page.waitForTimeout(300);
    }

    const saveBtn = page.locator('[role="dialog"] button:has-text("Save Changes")');
    if (await saveBtn.isVisible() && await saveBtn.isEnabled()) {
      await saveBtn.click();
      await waitForToast(page, 'Failed');
    } else {
      await page.keyboard.press('Escape');
      test.skip();
    }
  });

  test('save preset with API failure → shows error toast', async ({ page }) => {
    await switchSubTab(page, 'Roles & Permissions');

    // Intercept profile update (PUT to /access/profiles/{role})
    await page.route('**/api/v1/backlot/projects/*/access/profiles/*', (route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Failed to save preset' }),
        });
      }
      return route.continue();
    });

    // Select a role and try to save
    const selector = page.locator('button[role="combobox"]').first();
    if (await selector.isVisible()) {
      await selector.click();
      await page.locator('[role="option"]').first().click();
      await page.waitForTimeout(500);
    }

    const toggle = page.locator('button[role="switch"]').first();
    if (await toggle.isVisible()) {
      await toggle.click();
    }

    const saveBtn = page.locator('button:has-text("Save Preset"), button:has-text("Save")').first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await waitForToast(page, 'Failed');
    } else {
      test.skip();
    }
  });

  test('add external seat with API failure → shows error toast', async ({ page }) => {
    await switchSubTab(page, 'External Access');

    await page.route('**/projects/*/external-seats', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Failed to add seat' }),
        });
      }
      return route.continue();
    });

    const addBtn = page.locator('button:has-text("Add Freelancer")');
    if (!(await addBtn.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    await addBtn.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    const searchInput = page.locator(
      '[role="dialog"] input[placeholder*="Search"], [role="dialog"] input[placeholder*="search"]'
    );
    await searchInput.fill('test');
    await page.waitForTimeout(800);

    const result = page.locator('[role="dialog"] button').filter({ hasText: /test/i }).first();
    if (await result.isVisible()) {
      await result.click();
      await page.locator('[role="dialog"] button:has-text("Add Freelancer")').last().click();
      await waitForToast(page, 'Failed');
    } else {
      await page.keyboard.press('Escape');
      test.skip();
    }
  });

  test('save client tab permissions with API failure → shows error toast', async ({ page }) => {
    await switchSubTab(page, 'External Access');

    await page.route('**/projects/*/external-seats/*', (route) => {
      if (route.request().method() === 'PATCH' || route.request().method() === 'PUT') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Failed to save' }),
        });
      }
      return route.continue();
    });

    const clientSection = page.locator('text=Clients').locator('..').locator('..').locator('..');
    const editBtn = clientSection.locator('button').filter({ has: page.locator('svg.lucide-user-cog') }).first();

    if (!(await editBtn.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    await editBtn.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    const checkbox = page.locator('[role="dialog"] button[role="checkbox"], [role="dialog"] input[type="checkbox"]').first();
    if (await checkbox.isVisible()) {
      await checkbox.click();
    }

    const saveBtn = page.locator('[role="dialog"] button:has-text("Save")');
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await waitForToast(page, 'Failed');
    }
  });
});
