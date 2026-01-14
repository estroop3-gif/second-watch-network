/**
 * E2E Test: Budget Actuals System Investigation
 *
 * PURPOSE:
 * Investigate the budget actuals system to verify that when expenses get approved,
 * they are properly added to the "Actual" budget view.
 *
 * EXPECTED BEHAVIOR:
 * 1. When an expense (receipt, mileage, kit rental, per diem) gets approved in Approvals tab,
 *    it should automatically create/update entries in the "Actual" budget
 * 2. The "Actual" budget should be visible when clicking the "Actual" toggle button
 * 3. Nothing should auto-create in the "Estimated" budget - that's manual only
 *
 * TEST STEPS:
 * 1. Log in to the application
 * 2. Navigate to the specified Backlot project
 * 3. Go to Budget tab and check for Actual toggle
 * 4. Check what's in the Actual budget view
 * 5. Go to Approvals tab and check for pending items
 * 6. If there are pending items, approve one
 * 7. Return to Budget tab and check if Actual budget was updated
 * 8. Monitor browser console and network requests for errors
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'poboy3tv@gmail.com';
const TEST_PASSWORD = 'Parkera1bc!';
const BASE_URL = 'http://localhost:8080';
const PROJECT_ID = 'a0bcd9a7-9fca-485f-95bd-fc77dda71563';

// Use Chromium in headless mode
test.use({ browserName: 'chromium' });

test.describe('Budget Actuals System Investigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Capture console messages
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error' || text.includes('budget') || text.includes('actual')) {
        console.log(`[Console ${type.toUpperCase()}]: ${text}`);
      }
    });

    // Capture page errors
    page.on('pageerror', error => {
      console.log(`[Page Error]: ${error.message}`);
    });

    // Capture failed requests
    page.on('requestfailed', request => {
      console.log(`[Failed Request]: ${request.method()} ${request.url()}`);
    });
  });

  test('should investigate budget actuals system end-to-end', async ({ page }) => {
    console.log('\n========================================');
    console.log('STEP 1: LOGIN');
    console.log('========================================\n');

    await page.goto(`${BASE_URL}/login`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForTimeout(1000);

    // Login
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill(TEST_EMAIL);

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill(TEST_PASSWORD);

    await page.screenshot({
      path: 'test-results/budget-actuals-01-login.png',
      fullPage: false
    });

    const submitButton = page.locator('button[type="submit"], button:has-text("Sign In")').first();
    await submitButton.click();

    await page.waitForURL('**/*', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('✓ Login successful');
    console.log('Current URL:', page.url());

    await page.screenshot({
      path: 'test-results/budget-actuals-02-after-login.png',
      fullPage: false
    });

    console.log('\n========================================');
    console.log('STEP 2: NAVIGATE TO BACKLOT PROJECT');
    console.log('========================================\n');

    // Navigate directly to the project
    await page.goto(`${BASE_URL}/backlot/project/${PROJECT_ID}`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForTimeout(2000);

    console.log('✓ Navigated to project:', PROJECT_ID);
    console.log('Current URL:', page.url());

    await page.screenshot({
      path: 'test-results/budget-actuals-03-project-page.png',
      fullPage: true
    });

    console.log('\n========================================');
    console.log('STEP 3: GO TO BUDGET TAB');
    console.log('========================================\n');

    // Look for Budget tab in the sidebar or tab navigation
    const budgetTab = page.locator('a:has-text("Budget"), button:has-text("Budget"), [role="tab"]:has-text("Budget")').first();
    const budgetTabVisible = await budgetTab.isVisible({ timeout: 5000 }).catch(() => false);

    console.log('Budget tab visible:', budgetTabVisible);

    if (budgetTabVisible) {
      await budgetTab.click();
      await page.waitForTimeout(2000);
      await page.waitForLoadState('networkidle');

      console.log('✓ Clicked Budget tab');
      console.log('Current URL:', page.url());

      await page.screenshot({
        path: 'test-results/budget-actuals-04-budget-tab.png',
        fullPage: true
      });

      console.log('\n========================================');
      console.log('STEP 4: CHECK FOR ACTUAL TOGGLE BUTTON');
      console.log('========================================\n');

      // Look for the Actual toggle button
      const actualToggle = page.locator('button:has-text("Actual")').first();
      const actualToggleVisible = await actualToggle.isVisible({ timeout: 5000 }).catch(() => false);

      console.log('Actual toggle button visible:', actualToggleVisible);

      if (actualToggleVisible) {
        // Check button state
        const buttonClasses = await actualToggle.getAttribute('class');
        console.log('Actual toggle classes:', buttonClasses);

        // Get the Estimated toggle too for comparison
        const estimatedToggle = page.locator('button:has-text("Estimated")').first();
        const estimatedToggleVisible = await estimatedToggle.isVisible({ timeout: 5000 }).catch(() => false);

        if (estimatedToggleVisible) {
          const estimatedClasses = await estimatedToggle.getAttribute('class');
          console.log('Estimated toggle classes:', estimatedClasses);
        }

        // Check the description text
        const descriptionText = page.locator('text=/Planned budget with line items|Actual expenses from approvals/').first();
        const currentMode = await descriptionText.textContent().catch(() => 'Not found');
        console.log('Current view mode description:', currentMode);

        await page.screenshot({
          path: 'test-results/budget-actuals-05-toggle-buttons.png',
          fullPage: true
        });

        // Click Actual toggle
        console.log('\n✓ Clicking Actual toggle...');
        await actualToggle.click();
        await page.waitForTimeout(1500);

        await page.screenshot({
          path: 'test-results/budget-actuals-06-actual-view-clicked.png',
          fullPage: true
        });

        // Check what's shown in Actual view
        const actualsContent = page.locator('.space-y-4, [class*="actual"]').first();
        const hasContent = await actualsContent.isVisible({ timeout: 3000 }).catch(() => false);

        console.log('Actuals content visible:', hasContent);

        // Look for actual budget items
        const actualItems = page.locator('text=/receipt|mileage|kit rental|per diem/i');
        const actualItemsCount = await actualItems.count();
        console.log('Found actual items:', actualItemsCount);

        // Look for "no actuals" message
        const emptyState = page.locator('text=/no.*actual|no.*expense|empty/i').first();
        const hasEmptyState = await emptyState.isVisible({ timeout: 2000 }).catch(() => false);
        console.log('Empty state message visible:', hasEmptyState);

        if (hasEmptyState) {
          const emptyMessage = await emptyState.textContent();
          console.log('Empty state message:', emptyMessage);
        }

        await page.screenshot({
          path: 'test-results/budget-actuals-07-actual-view-content.png',
          fullPage: true
        });

      } else {
        console.log('⚠ Actual toggle button NOT found!');

        // Try to find what IS visible
        const allButtons = page.locator('button');
        const buttonCount = await allButtons.count();
        console.log('Total buttons on page:', buttonCount);

        // Get text of first 20 buttons
        for (let i = 0; i < Math.min(buttonCount, 20); i++) {
          const btnText = await allButtons.nth(i).textContent();
          if (btnText && btnText.trim()) {
            console.log(`  Button ${i}: "${btnText.trim()}"`);
          }
        }
      }

    } else {
      console.log('⚠ Budget tab NOT found!');

      // Try to find available tabs
      const allLinks = page.locator('a, button, [role="tab"]');
      const linkCount = await allLinks.count();
      console.log('Total navigation elements:', linkCount);

      // Get text of visible navigation items
      for (let i = 0; i < Math.min(linkCount, 30); i++) {
        const item = allLinks.nth(i);
        const isVisible = await item.isVisible().catch(() => false);
        if (isVisible) {
          const text = await item.textContent();
          if (text && text.trim()) {
            console.log(`  Nav item ${i}: "${text.trim()}"`);
          }
        }
      }
    }

    console.log('\n========================================');
    console.log('STEP 5: GO TO APPROVALS TAB');
    console.log('========================================\n');

    // Navigate back to switch to Estimated view first
    const estimatedToggle = page.locator('button:has-text("Estimated")').first();
    if (await estimatedToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await estimatedToggle.click();
      await page.waitForTimeout(1000);
    }

    // Look for Approvals tab
    const approvalsTab = page.locator('a:has-text("Approvals"), button:has-text("Approvals"), [role="tab"]:has-text("Approvals")').first();
    const approvalsTabVisible = await approvalsTab.isVisible({ timeout: 5000 }).catch(() => false);

    console.log('Approvals tab visible:', approvalsTabVisible);

    if (approvalsTabVisible) {
      await approvalsTab.click();
      await page.waitForTimeout(2000);
      await page.waitForLoadState('networkidle');

      console.log('✓ Clicked Approvals tab');
      console.log('Current URL:', page.url());

      await page.screenshot({
        path: 'test-results/budget-actuals-08-approvals-tab.png',
        fullPage: true
      });

      // Check for pending items
      const pendingHeader = page.locator('text=/Needs Approval|Pending/i').first();
      const hasPendingSection = await pendingHeader.isVisible({ timeout: 3000 }).catch(() => false);

      console.log('Pending approvals section visible:', hasPendingSection);

      // Look for expense items (receipts, mileage, kit rental, per diem)
      const expenseItems = page.locator('[class*="hover:bg"], .cursor-pointer, button').filter({
        hasText: /receipt|mileage|kit.*rental|per.*diem/i
      });
      const expenseCount = await expenseItems.count();

      console.log('Found pending expense items:', expenseCount);

      if (expenseCount > 0) {
        console.log('\n✓ Found pending items to approve');

        // Get details of first few items
        for (let i = 0; i < Math.min(expenseCount, 5); i++) {
          const item = expenseItems.nth(i);
          const itemText = await item.textContent();
          console.log(`  Item ${i + 1}:`, itemText?.substring(0, 100));
        }

        // Click on the first expense item
        console.log('\n✓ Clicking first expense item...');
        await expenseItems.first().click();
        await page.waitForTimeout(2000);

        await page.screenshot({
          path: 'test-results/budget-actuals-09-approval-detail.png',
          fullPage: true
        });

        // Look for Approve button in the dialog
        const approveButton = page.locator('button:has-text("Approve")').first();
        const approveButtonVisible = await approveButton.isVisible({ timeout: 3000 }).catch(() => false);

        console.log('Approve button visible:', approveButtonVisible);

        if (approveButtonVisible) {
          console.log('\n✓ Clicking Approve button...');

          // Set up network monitoring for budget-actuals API calls
          const budgetActualsRequests: any[] = [];
          page.on('request', request => {
            const url = request.url();
            if (url.includes('budget-actuals') || url.includes('actuals')) {
              budgetActualsRequests.push({
                method: request.method(),
                url: url,
                timestamp: new Date().toISOString()
              });
              console.log(`[API Request] ${request.method()} ${url}`);
            }
          });

          page.on('response', async response => {
            const url = response.url();
            if (url.includes('budget-actuals') || url.includes('actuals')) {
              const status = response.status();
              console.log(`[API Response] ${status} ${url}`);
              if (status !== 200) {
                const body = await response.text().catch(() => 'Could not read body');
                console.log(`[Error Response Body]:`, body);
              }
            }
          });

          await approveButton.click();
          await page.waitForTimeout(3000);

          console.log('\n✓ Item approved!');
          console.log('Budget-actuals API calls made:', budgetActualsRequests.length);
          budgetActualsRequests.forEach(req => {
            console.log(`  - ${req.method} ${req.url}`);
          });

          await page.screenshot({
            path: 'test-results/budget-actuals-10-after-approval.png',
            fullPage: true
          });

          console.log('\n========================================');
          console.log('STEP 6: CHECK BUDGET ACTUALS AGAIN');
          console.log('========================================\n');

          // Go back to Budget tab
          const budgetTabAgain = page.locator('a:has-text("Budget"), button:has-text("Budget"), [role="tab"]:has-text("Budget")').first();
          const budgetTabAgainVisible = await budgetTabAgain.isVisible({ timeout: 5000 }).catch(() => false);

          if (budgetTabAgainVisible) {
            await budgetTabAgain.click();
            await page.waitForTimeout(2000);
            await page.waitForLoadState('networkidle');

            console.log('✓ Returned to Budget tab');

            await page.screenshot({
              path: 'test-results/budget-actuals-11-budget-tab-after-approval.png',
              fullPage: true
            });

            // Click Actual toggle again
            const actualToggleAgain = page.locator('button:has-text("Actual")').first();
            const actualToggleAgainVisible = await actualToggleAgain.isVisible({ timeout: 5000 }).catch(() => false);

            if (actualToggleAgainVisible) {
              await actualToggleAgain.click();
              await page.waitForTimeout(2000);

              console.log('✓ Switched to Actual view');

              await page.screenshot({
                path: 'test-results/budget-actuals-12-actual-view-after-approval.png',
                fullPage: true
              });

              // Check for actual items now
              const actualItemsAfter = page.locator('text=/receipt|mileage|kit rental|per diem/i');
              const actualItemsCountAfter = await actualItemsAfter.count();
              console.log('Actual items found after approval:', actualItemsCountAfter);

              // Look for the approved item
              const emptyStateAfter = page.locator('text=/no.*actual|no.*expense|empty/i').first();
              const hasEmptyStateAfter = await emptyStateAfter.isVisible({ timeout: 2000 }).catch(() => false);
              console.log('Empty state still visible:', hasEmptyStateAfter);

              if (!hasEmptyStateAfter && actualItemsCountAfter > 0) {
                console.log('\n✅ SUCCESS: Actual budget items are now visible!');

                // Get details of actual items
                for (let i = 0; i < Math.min(actualItemsCountAfter, 5); i++) {
                  const item = actualItemsAfter.nth(i);
                  const itemText = await item.textContent();
                  console.log(`  Actual item ${i + 1}:`, itemText?.substring(0, 100));
                }
              } else {
                console.log('\n❌ ISSUE: Actual budget is still empty after approval!');
              }

            } else {
              console.log('⚠ Could not find Actual toggle button');
            }

          } else {
            console.log('⚠ Could not return to Budget tab');
          }

        } else {
          console.log('⚠ Approve button not found in detail dialog');

          // Close any open dialogs
          const closeButton = page.locator('button[aria-label="Close"], button:has-text("Close"), button:has-text("Cancel")').first();
          if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await closeButton.click();
            await page.waitForTimeout(500);
          }
        }

      } else {
        console.log('\n⚠ No pending expense items found to approve');
        console.log('This may be expected if all items are already approved.');
      }

    } else {
      console.log('⚠ Approvals tab NOT found!');
    }

    console.log('\n========================================');
    console.log('INVESTIGATION COMPLETE');
    console.log('========================================\n');

    // Final comprehensive screenshot
    await page.screenshot({
      path: 'test-results/budget-actuals-13-final.png',
      fullPage: true
    });

  });

  test('should check network requests for budget-actuals endpoint', async ({ page }) => {
    console.log('\n========================================');
    console.log('NETWORK MONITORING TEST');
    console.log('========================================\n');

    const budgetActualsAPICalls: any[] = [];

    // Monitor all network requests
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/') && (url.includes('budget') || url.includes('actual') || url.includes('approval'))) {
        budgetActualsAPICalls.push({
          type: 'request',
          method: request.method(),
          url: url,
          headers: request.headers(),
          timestamp: new Date().toISOString()
        });
      }
    });

    page.on('response', async response => {
      const url = response.url();
      if (url.includes('/api/') && (url.includes('budget') || url.includes('actual') || url.includes('approval'))) {
        const status = response.status();
        const headers = response.headers();
        let body = null;

        try {
          body = await response.text();
        } catch (e) {
          body = 'Could not read response body';
        }

        budgetActualsAPICalls.push({
          type: 'response',
          status: status,
          url: url,
          headers: headers,
          body: body.substring(0, 500), // First 500 chars
          timestamp: new Date().toISOString()
        });
      }
    });

    // Login
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill(TEST_EMAIL);
    await page.locator('input[type="password"]').first().fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').first().click();

    await page.waitForURL('**/*', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Navigate to project
    await page.goto(`${BASE_URL}/backlot/project/${PROJECT_ID}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Go to Budget tab
    const budgetTab = page.locator('a:has-text("Budget"), button:has-text("Budget")').first();
    if (await budgetTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await budgetTab.click();
      await page.waitForTimeout(2000);
      await page.waitForLoadState('networkidle');

      // Click Actual toggle
      const actualToggle = page.locator('button:has-text("Actual")').first();
      if (await actualToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
        await actualToggle.click();
        await page.waitForTimeout(3000);
      }
    }

    console.log('\n========================================');
    console.log('API CALLS SUMMARY');
    console.log('========================================\n');

    console.log('Total budget/actual/approval API calls:', budgetActualsAPICalls.length);

    // Group by endpoint
    const endpointCounts: Record<string, number> = {};
    budgetActualsAPICalls.forEach(call => {
      const url = call.url;
      const endpoint = url.split('/api/')[1]?.split('?')[0] || url;
      endpointCounts[endpoint] = (endpointCounts[endpoint] || 0) + 1;
    });

    console.log('\nEndpoint call counts:');
    Object.entries(endpointCounts).forEach(([endpoint, count]) => {
      console.log(`  ${endpoint}: ${count} calls`);
    });

    console.log('\nDetailed API calls:');
    budgetActualsAPICalls.forEach((call, idx) => {
      console.log(`\n[${idx + 1}] ${call.type.toUpperCase()} - ${call.timestamp}`);
      console.log(`  URL: ${call.url}`);
      if (call.method) console.log(`  Method: ${call.method}`);
      if (call.status) console.log(`  Status: ${call.status}`);
      if (call.body && call.body !== 'Could not read response body') {
        console.log(`  Body preview: ${call.body.substring(0, 200)}...`);
      }
    });

  });
});
