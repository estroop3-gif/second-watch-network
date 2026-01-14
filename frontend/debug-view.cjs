const { chromium } = require('playwright');

(async () => {
  console.log('Opening browser at localhost:8080...');
  console.log('');
  console.log('=== INSTRUCTIONS ===');
  console.log('1. Log in to the app');
  console.log('2. Navigate to Backlot -> Your Project -> Scripts');
  console.log('3. Click on the VIEW tab');
  console.log('4. Make sure the title page is visible');
  console.log('5. Come back here and press ENTER to capture screenshots');
  console.log('');

  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.goto('http://localhost:8080');

  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  await new Promise(resolve => {
    rl.question('Press ENTER when you are on the View tab showing the title page...', resolve);
  });

  console.log('\nCapturing screenshots...');

  // Full page screenshot
  await page.screenshot({ path: 'VIEW-TAB-FULL.png', fullPage: true });
  console.log('Saved: VIEW-TAB-FULL.png');

  // Find white page elements (title page and script pages)
  const whitePages = page.locator('.bg-white');
  const count = await whitePages.count();
  console.log('Found ' + count + ' white elements');

  for (let i = 0; i < Math.min(count, 5); i++) {
    const el = whitePages.nth(i);
    const box = await el.boundingBox();
    if (box && box.width > 200 && box.height > 200) {
      await el.screenshot({ path: 'VIEW-TAB-PAGE-' + i + '.png' });
      console.log('Saved: VIEW-TAB-PAGE-' + i + '.png (' + Math.round(box.width) + 'x' + Math.round(box.height) + ')');

      // Get styles and content
      const info = await el.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          classes: el.className,
          fontSize: style.fontSize,
          fontFamily: style.fontFamily,
          color: style.color,
          padding: style.padding,
          innerHTML: el.innerHTML.substring(0, 500)
        };
      });
      console.log('  Classes: ' + info.classes);
      console.log('  Font: ' + info.fontSize + ' ' + info.fontFamily.substring(0, 50));
      console.log('  Padding: ' + info.padding);
      console.log('  Color: ' + info.color);
    }
  }

  // Check specifically for ScriptTitlePage content
  const titleContent = await page.evaluate(() => {
    // Look for elements with Courier font (screenplay format)
    const allEls = document.querySelectorAll('*');
    let courierEls = [];
    for (const el of allEls) {
      const font = window.getComputedStyle(el).fontFamily;
      if (font.includes('Courier')) {
        courierEls.push({
          tag: el.tagName,
          text: el.innerText.substring(0, 50),
          fontSize: window.getComputedStyle(el).fontSize
        });
      }
    }
    return courierEls.slice(0, 10);
  });
  console.log('\nCourier font elements:', JSON.stringify(titleContent, null, 2));

  console.log('\n=== DONE ===');
  console.log('Check the VIEW-TAB-*.png files');

  await new Promise(resolve => {
    rl.question('Press ENTER to close browser...', resolve);
  });

  rl.close();
  await browser.close();
})();
