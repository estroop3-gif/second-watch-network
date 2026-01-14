const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('Debugging script display issue...');
  console.log('Please log in and navigate to the script. You have 60 seconds.\n');

  const userDataDir = path.join(__dirname, '.playwright-session');
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1600, height: 1000 }
  });

  const page = context.pages()[0] || await context.newPage();

  // Capture console logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('ScriptPageView') || text.includes('ScriptTextViewer')) {
      console.log('[Browser Console]', text);
    }
  });

  await page.goto('http://localhost:8080');

  // Wait for user to navigate
  for (let i = 60; i > 0; i -= 15) {
    console.log(`${i} seconds to navigate to script...`);
    await page.waitForTimeout(15000);
  }

  console.log('\n=== ANALYZING DISPLAY ===\n');

  // Take screenshot
  await page.screenshot({ path: 'SCRIPT-DEBUG-1.png', fullPage: true });
  console.log('Screenshot saved: SCRIPT-DEBUG-1.png');

  // Try to scroll to the bottom of the script content
  const scrollAreas = await page.locator('[data-radix-scroll-area-viewport], .overflow-auto, .overflow-y-auto').all();
  console.log('Found', scrollAreas.length, 'scroll areas');

  for (let i = 0; i < scrollAreas.length; i++) {
    try {
      await scrollAreas[i].evaluate(el => el.scrollTop = el.scrollHeight);
      console.log('Scrolled area', i, 'to bottom');
    } catch (e) {
      // ignore
    }
  }

  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'SCRIPT-DEBUG-2.png', fullPage: true });
  console.log('Screenshot after scroll: SCRIPT-DEBUG-2.png');

  // Check what text is visible at the bottom
  const visibleText = await page.evaluate(() => {
    // Get all text content from the page
    const allText = document.body.innerText;

    // Check for specific phrases
    const hasIntroductions = allText.includes('introductions are out of the way');
    const hasPainting = allText.includes('painting there\'s a safe');
    const hasDirective = allText.includes('Directive 77');
    const hasWellThen = allText.includes('Well then');

    // Find the last visible script content
    const scriptElements = document.querySelectorAll('[class*="script"], [class*="dialogue"], [class*="action"]');
    let lastContent = '';
    scriptElements.forEach(el => {
      const text = el.innerText?.trim();
      if (text && text.length > 5) {
        lastContent = text.substring(0, 100);
      }
    });

    return {
      hasIntroductions,
      hasPainting,
      hasDirective,
      hasWellThen,
      lastContent,
      totalLength: allText.length
    };
  });

  console.log('\n=== VISIBILITY CHECK ===');
  console.log('Has "introductions are out of the way":', visibleText.hasIntroductions);
  console.log('Has "Directive 77":', visibleText.hasDirective);
  console.log('Has "painting there\'s a safe":', visibleText.hasPainting);
  console.log('Has "Well then":', visibleText.hasWellThen);
  console.log('Total page text length:', visibleText.totalLength);
  console.log('Last script element content:', visibleText.lastContent);

  // Check the actual rendered pages/content
  const pageInfo = await page.evaluate(() => {
    // Look for page indicators
    const pageIndicator = document.querySelector('[class*="page"]')?.innerText;

    // Look for any truncation or "load more" buttons
    const loadMore = document.querySelector('button:has-text("load"), button:has-text("more")');

    // Get scroll container info
    const scrollContainer = document.querySelector('[data-radix-scroll-area-viewport]');
    let scrollInfo = null;
    if (scrollContainer) {
      scrollInfo = {
        scrollHeight: scrollContainer.scrollHeight,
        clientHeight: scrollContainer.clientHeight,
        scrollTop: scrollContainer.scrollTop,
        atBottom: scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 10
      };
    }

    return { pageIndicator, hasLoadMore: !!loadMore, scrollInfo };
  });

  console.log('\n=== PAGE INFO ===');
  console.log('Page indicator:', pageInfo.pageIndicator);
  console.log('Has load more button:', pageInfo.hasLoadMore);
  console.log('Scroll info:', pageInfo.scrollInfo);

  // Press End key to try to get to the end
  await page.keyboard.press('End');
  await page.waitForTimeout(500);
  await page.keyboard.press('Control+End');
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'SCRIPT-DEBUG-3.png', fullPage: true });
  console.log('Screenshot after End key: SCRIPT-DEBUG-3.png');

  // Final check
  const finalCheck = await page.evaluate(() => {
    const allText = document.body.innerText;
    return {
      hasPainting: allText.includes('painting there\'s a safe'),
      hasDirective: allText.includes('Directive 77'),
      lastChars: allText.slice(-500).replace(/\s+/g, ' ').trim()
    };
  });

  console.log('\n=== FINAL CHECK ===');
  console.log('Has ending text:', finalCheck.hasPainting);
  console.log('Last 200 chars of page:', finalCheck.lastChars.slice(-200));

  console.log('\n\nKeeping browser open for 30 seconds for manual inspection...');
  await page.waitForTimeout(30000);

  await context.close();
})();
