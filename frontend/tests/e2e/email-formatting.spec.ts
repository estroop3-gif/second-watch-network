/**
 * Email Formatting E2E Test
 *
 * Verifies that email formatting (paragraphs, bold) composed in the TipTap
 * editor is preserved when displayed in the CRM thread view after sending.
 */

import { test, expect } from '@playwright/test';

test.describe('Email Formatting Preservation', () => {
  test('composed formatting is preserved in thread view after sending', async ({ page }) => {
    test.setTimeout(120000);

    // Navigate to CRM Email
    await page.goto('/crm/email');
    await page.waitForTimeout(3000);

    // Click Compose button
    const composeBtn = page.locator('button:has-text("Compose")');
    await expect(composeBtn).toBeVisible({ timeout: 10000 });
    await composeBtn.click();
    await page.waitForTimeout(2000);

    // The compose modal is a fixed bottom-right panel
    const composeModal = page.locator('.fixed.bottom-0');
    await expect(composeModal).toBeVisible({ timeout: 5000 });

    // Screenshot: compose modal open
    await page.screenshot({ path: 'test-results/email-format-01-compose-open.png', fullPage: true });

    // Fill To field (placeholder: "recipient@example.com") inside compose modal
    const toInput = composeModal.locator('input[placeholder="recipient@example.com"]');
    await expect(toInput).toBeVisible({ timeout: 5000 });
    await toInput.fill('estroop3@gmail.com');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');

    // Fill Subject field
    const subjectInput = composeModal.locator('input[placeholder="Email subject"]');
    await expect(subjectInput).toBeVisible({ timeout: 5000 });
    const testSubject = `Format Test ${Date.now()}`;
    await subjectInput.fill(testSubject);

    // Focus the TipTap editor inside compose modal
    const editor = composeModal.locator('.ProseMirror').first();
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();

    // Type formatted content: multiple paragraphs with bold
    await page.keyboard.type('First paragraph of the email.');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second paragraph should be visually separated.');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Third line has ');
    await page.keyboard.press('Control+b');
    await page.keyboard.type('bold text here');
    await page.keyboard.press('Control+b');
    await page.keyboard.type(' in the middle.');

    await page.waitForTimeout(500);

    // Capture editor HTML
    const editorHtml = await editor.innerHTML();
    console.log('=== TipTap Editor innerHTML ===');
    console.log(editorHtml);

    // Screenshot: composed email with formatting
    await page.screenshot({ path: 'test-results/email-format-02-composed.png', fullPage: true });

    // Intercept the send API call to capture body_html
    let sentBodyHtml = '';
    await page.route('**/crm/email/send', async (route) => {
      const postData = route.request().postDataJSON();
      sentBodyHtml = postData.body_html;
      console.log('=== Sent body_html ===');
      console.log(sentBodyHtml);
      await route.continue();
    });

    // Click Send
    const sendBtn = composeModal.locator('button:has-text("Send")').first();
    await expect(sendBtn).toBeEnabled({ timeout: 5000 });
    await sendBtn.click();

    // Wait for send to complete (modal closes, toast appears)
    await page.waitForTimeout(4000);

    // Screenshot: after send
    await page.screenshot({ path: 'test-results/email-format-03-after-send.png', fullPage: true });

    // Verify the sent body_html has proper paragraph and bold tags
    console.log('sentBodyHtml length:', sentBodyHtml.length);
    expect(sentBodyHtml).toBeTruthy();
    expect(sentBodyHtml).toContain('<p>');
    expect(sentBodyHtml).toContain('<strong>');

    // Click on the thread we just sent (look for our subject)
    await page.waitForTimeout(2000);
    const threadItem = page.locator(`text="${testSubject}"`).first();
    if (await threadItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await threadItem.click();
    } else {
      // Fall back to first thread (most recent)
      const firstThread = page.locator('[class*="cursor-pointer"]').first();
      await firstThread.click();
    }
    await page.waitForTimeout(3000);

    // Screenshot: thread view
    await page.screenshot({ path: 'test-results/email-format-04-thread-view.png', fullPage: true });

    // Find rendered email content divs with prose classes (our fix moved prose onto content div)
    const proseContentDivs = page.locator('div.prose.prose-invert.prose-sm');
    const proseCount = await proseContentDivs.count();
    console.log(`Found ${proseCount} prose content divs`);

    // At least one prose div should exist (the email message)
    expect(proseCount).toBeGreaterThanOrEqual(1);

    // Get the last prose div (most recent message = our sent email)
    const messageDiv = proseContentDivs.last();
    const renderedHtml = await messageDiv.innerHTML();
    console.log('=== Rendered thread HTML ===');
    console.log(renderedHtml);

    // Verify paragraph and bold tags survived rendering
    expect(renderedHtml).toContain('<p>');
    expect(renderedHtml).toContain('<strong>');

    // Check that <p> tags have non-zero margins (prose class is working)
    const firstP = messageDiv.locator('p').first();
    if (await firstP.isVisible({ timeout: 3000 }).catch(() => false)) {
      const computedStyle = await firstP.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          marginTop: style.marginTop,
          marginBottom: style.marginBottom,
        };
      });
      console.log('=== <p> computed styles ===');
      console.log(computedStyle);

      const mTop = parseFloat(computedStyle.marginTop);
      const mBottom = parseFloat(computedStyle.marginBottom);
      console.log(`Margins: top=${mTop}px, bottom=${mBottom}px`);

      // With prose-sm, paragraphs should have margins > 0
      expect(mTop + mBottom).toBeGreaterThan(0);
    }

    // Screenshot: final state
    await page.screenshot({ path: 'test-results/email-format-05-final.png', fullPage: true });
    console.log('=== Test Complete ===');
  });
});
