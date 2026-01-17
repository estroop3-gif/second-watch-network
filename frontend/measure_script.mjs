import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
  const authPath = path.join(process.cwd(), 'playwright/.auth/user.json');
  
  const browser = await chromium.launch({ headless: false });
  
  // Load storage state directly
  const storageState = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
  
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();
  
  // Set viewport
  await page.setViewportSize({ width: 1920, height: 1080 });
  
  try {
    console.log('Navigating to backlot...');
    await page.goto('http://localhost:8080/backlot', { waitUntil: 'domcontentloaded' });
    
    // Wait for projects to appear
    console.log('Waiting for projects...');
    await page.waitForTimeout(3000);
    
    // Get page content to see what's there
    const pageText = await page.content();
    
    if (pageText.includes('EIDCOM')) {
      console.log('Found EIDCOM in page content');
      
      // Find and click EIDCOM link
      const links = await page.locator('a').all();
      for (const link of links) {
        const text = await link.textContent();
        if (text && text.includes('EIDCOM')) {
          console.log('Clicking EIDCOM project');
          await link.click();
          break;
        }
      }
    } else {
      console.log('EIDCOM not found, listing first few links:');
      const links = await page.locator('a').all();
      for (let i = 0; i < Math.min(5, links.length); i++) {
        const text = await links[i].textContent();
        console.log(`  Link ${i}: ${text}`);
      }
      throw new Error('EIDCOM project not found');
    }
    
    console.log('Waiting for project page...');
    await page.waitForTimeout(3000);
    
    // Click Script tab
    console.log('Looking for Script tab...');
    const tabs = await page.locator('button, [role="tab"]').all();
    for (const tab of tabs) {
      const text = await tab.textContent();
      if (text && text.trim() === 'Script') {
        console.log('Found Script tab, clicking...');
        await tab.click();
        break;
      }
    }
    
    await page.waitForTimeout(2000);
    
    // Take screenshot
    console.log('Taking screenshot...');
    await page.screenshot({ path: './script_page.png', fullPage: false });
    console.log('Screenshot saved!');
    
    // Get detailed measurements
    const measurements = await page.evaluate(() => {
      const m = {};
      
      // Find main content area
      const main = document.querySelector('main') || document.querySelector('[role="main"]');
      if (main) {
        const r = main.getBoundingClientRect();
        m.main = {
          height: Math.round(r.height),
          width: Math.round(r.width),
          top: Math.round(r.top),
          left: Math.round(r.left)
        };
      }
      
      // Find script container - look for various patterns
      let scriptContainer = null;
      
      // Pattern 1: Class containing "Script"
      scriptContainer = document.querySelector('[class*="Script"]');
      
      // Pattern 2: Text viewer
      if (!scriptContainer) {
        scriptContainer = document.querySelector('[class*="viewer"], [class*="Viewer"]');
      }
      
      // Pattern 3: Largest div
      if (!scriptContainer) {
        let largest = null;
        let maxArea = 0;
        document.querySelectorAll('div').forEach(div => {
          const r = div.getBoundingClientRect();
          const area = r.width * r.height;
          if (area > maxArea && r.height > 300 && r.width > 300) {
            maxArea = area;
            largest = div;
          }
        });
        scriptContainer = largest;
      }
      
      if (scriptContainer) {
        const r = scriptContainer.getBoundingClientRect();
        m.scriptContainer = {
          height: Math.round(r.height),
          width: Math.round(r.width),
          top: Math.round(r.top),
          left: Math.round(r.left)
        };
        
        // Count text lines
        const textContent = scriptContainer.innerText || scriptContainer.textContent;
        const lines = textContent.split('\n').filter(l => l.trim());
        m.visibleLines = lines.length;
        m.firstFewLines = lines.slice(0, 3);
      }
      
      // Look for page-like structures
      const pageElements = document.querySelectorAll('[class*="page"], [class*="Page"]');
      if (pageElements.length > 0) {
        const r = pageElements[0].getBoundingClientRect();
        m.firstPageElement = {
          height: Math.round(r.height),
          width: Math.round(r.width),
          className: pageElements[0].className
        };
      }
      
      return m;
    });
    
    console.log('\n=== MEASUREMENTS ===');
    console.log(JSON.stringify(measurements, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
