import { test, expect } from '@playwright/test';

test('Debug collab edit form population', async ({ page }) => {
  // Navigate directly to the project page
  await page.goto('http://localhost:8080/backlot/projects/a0bcd9a7-9fca-485f-95bd-fc77dda71563');
  await page.waitForLoadState('networkidle');

  // Wait for the page to fully load
  await page.waitForSelector('text=CASTING & CREW', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // Click on Casting & Crew tab
  const castingTab = page.locator('button:has-text("Casting & Crew")').first();
  await castingTab.click();
  await page.waitForTimeout(2000);

  // Wait for collabs to load
  await page.waitForSelector('text=Role Postings', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // Click on the first collab card
  const collabCard = page.locator('text=Host / Presenter').first();
  await collabCard.click();
  await page.waitForTimeout(1000);

  // Click Edit button in the view dialog
  const viewDialog = page.locator('[role="dialog"]');
  await viewDialog.waitFor({ state: 'visible', timeout: 10000 });
  const editButton = viewDialog.locator('button:has-text("Edit")');
  await editButton.click({ force: true });

  // Wait for the edit dialog to load
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({ path: 'test-results/collab-edit-form.png', fullPage: true });

  // Press Page Down a few times to scroll through the form
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/collab-edit-form-scroll1.png', fullPage: true });

  await page.keyboard.press('PageDown');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/collab-edit-form-scroll2.png', fullPage: true });

  await page.keyboard.press('PageDown');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/collab-edit-form-scroll3.png', fullPage: true });

  console.log('\n========== END ==========\n');
});
