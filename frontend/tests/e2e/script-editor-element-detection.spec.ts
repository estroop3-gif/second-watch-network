/**
 * Script Editor Element Type Detection Test
 *
 * Purpose: Test the reported issues with the script editor:
 * 1. When clicking on a line to edit it, the toolbar doesn't show the correct element type
 * 2. When editing a line, the text position jumps to the right instead of staying in place
 *
 * This test will navigate to a project with a script, click on different elements,
 * and verify that the toolbar correctly identifies the element type.
 */

import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create screenshots directory if it doesn't exist
const screenshotsDir = path.join(__dirname, '../screenshots/element-detection');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

test.describe('Script Editor Element Type Detection', () => {
  let consoleErrors: string[] = [];
  let consoleWarnings: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    consoleWarnings = [];

    // Capture console messages
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error') {
        consoleErrors.push(text);
        console.log('[CONSOLE ERROR]', text);
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(text);
      }
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      consoleErrors.push(`PAGE ERROR: ${error.message}`);
      console.log('[PAGE ERROR]', error.message);
    });
  });

  test('navigate to backlot and find a project with script', async ({ page }) => {
    console.log('\n=== Finding a Project with Script Content ===\n');

    // Step 1: Navigate to the app
    console.log('Step 1: Navigating to http://localhost:8080');
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(screenshotsDir, '00-home.png'),
      fullPage: true
    });

    // Step 2: Navigate to Backlot
    console.log('\nStep 2: Navigating to Backlot');
    await page.goto('http://localhost:8080/backlot', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(screenshotsDir, '01-backlot.png'),
      fullPage: true
    });

    // Step 3: Look for projects
    console.log('\nStep 3: Looking for projects');

    // Find project cards/links
    const projectLinks = await page.locator('a[href*="/backlot/projects/"]').all();
    console.log(`Found ${projectLinks.length} project links`);

    for (let i = 0; i < Math.min(5, projectLinks.length); i++) {
      const link = projectLinks[i];
      const href = await link.getAttribute('href');
      const text = await link.textContent();
      console.log(`  Project ${i + 1}: ${text?.trim()} - ${href}`);
    }

    // Click on the first project
    if (projectLinks.length > 0) {
      const firstProjectLink = projectLinks[0];
      const projectUrl = await firstProjectLink.getAttribute('href');
      console.log(`\nNavigating to first project: ${projectUrl}`);

      await firstProjectLink.click();
      await page.waitForTimeout(2000);

      await page.screenshot({
        path: path.join(screenshotsDir, '02-project.png'),
        fullPage: true
      });

      // Step 4: Look for Script tab
      console.log('\nStep 4: Looking for Script tab');

      const scriptTab = page.locator('button:has-text("Script"), [role="tab"]:has-text("Script")').first();
      if (await scriptTab.isVisible().catch(() => false)) {
        console.log('Found Script tab, clicking it');
        await scriptTab.click();
        await page.waitForTimeout(1500);

        await page.screenshot({
          path: path.join(screenshotsDir, '03-script-tab.png'),
          fullPage: true
        });

        // Step 5: Look for Edit button
        console.log('\nStep 5: Looking for Edit button');
        const editButton = page.locator('button:has-text("Edit Script"), button:has-text("Edit")').first();

        if (await editButton.isVisible().catch(() => false)) {
          console.log('Found Edit button, entering edit mode');
          await editButton.click();
          await page.waitForTimeout(1000);

          await page.screenshot({
            path: path.join(screenshotsDir, '04-edit-mode.png'),
            fullPage: true
          });

          // Step 6: Analyze the toolbar and element type indicators
          console.log('\nStep 6: Analyzing toolbar element type buttons');

          const elementButtons = await page.locator('button:has-text("Scene"), button:has-text("Action"), button:has-text("Character"), button:has-text("Dialogue")').all();
          console.log(`Found ${elementButtons.length} element type buttons in toolbar`);

          // Find the "Current:" indicator
          const currentLabel = page.locator('text=Current:');
          if (await currentLabel.isVisible().catch(() => false)) {
            console.log('Found "Current:" label in toolbar');
          }

          // Step 7: Click on different lines and check element detection
          console.log('\nStep 7: Testing element type detection');

          const scriptLines = await page.locator('.bg-white .cursor-text, .bg-white [class*="absolute"][style*="top"]').all();
          console.log(`Found ${scriptLines.length} potential script lines`);

          // Store initial button states
          const getActiveButton = async () => {
            const buttons = await page.locator('button').all();
            for (const btn of buttons) {
              const hasYellowBg = await btn.evaluate((el) => {
                const style = window.getComputedStyle(el);
                return style.backgroundColor.includes('252') || // accent-yellow
                       el.classList.contains('bg-accent-yellow');
              }).catch(() => false);

              if (hasYellowBg) {
                const text = await btn.textContent().catch(() => '');
                return text?.trim();
              }
            }
            return null;
          };

          // Click on each line and check element type
          const results: { lineNum: number; text: string; detectedType: string | null; xPosition: number }[] = [];

          for (let i = 0; i < Math.min(15, scriptLines.length); i++) {
            const line = scriptLines[i];
            const text = await line.textContent().catch(() => '');
            const bounds = await line.boundingBox();

            if (!text || !bounds) continue;

            // Click on the line
            await line.click();
            await page.waitForTimeout(200);

            // Check which element type is active
            const activeButton = await getActiveButton();

            // Get line position after click
            const boundsAfter = await line.boundingBox();

            results.push({
              lineNum: i + 1,
              text: text.trim().substring(0, 40),
              detectedType: activeButton,
              xPosition: boundsAfter?.x || bounds.x
            });

            console.log(`Line ${i + 1}: "${text.trim().substring(0, 30)}..."`);
            console.log(`  Active button: ${activeButton || 'none detected'}`);
            console.log(`  X position: ${bounds.x.toFixed(0)} -> ${boundsAfter?.x?.toFixed(0) || 'N/A'}`);
          }

          await page.screenshot({
            path: path.join(screenshotsDir, '05-after-clicking-lines.png'),
            fullPage: true
          });

          // Summary
          console.log('\n=== Summary ===');
          console.log(`Lines tested: ${results.length}`);
          console.log(`Console errors: ${consoleErrors.length}`);

          // Check for detection issues
          let detectionIssues = 0;
          for (const result of results) {
            if (!result.detectedType || result.detectedType === 'Action') {
              // Check if line should be detected as something else
              const trimmed = result.text.trim();
              if (/^(INT\.|EXT\.)/.test(trimmed)) {
                if (result.detectedType !== 'Scene Heading' && result.detectedType !== 'Scene') {
                  detectionIssues++;
                  console.log(`ISSUE: "${trimmed}" should be Scene Heading but got ${result.detectedType}`);
                }
              } else if (/^[A-Z][A-Z\s]+$/.test(trimmed) && trimmed.length < 30) {
                if (result.detectedType !== 'Character') {
                  detectionIssues++;
                  console.log(`ISSUE: "${trimmed}" should be Character but got ${result.detectedType}`);
                }
              }
            }
          }

          console.log(`\nPotential detection issues: ${detectionIssues}`);

        } else {
          console.log('Edit button not found - script may be locked or no script uploaded');

          // List available buttons
          const allButtons = await page.locator('button').all();
          console.log('\nVisible buttons:');
          for (const btn of allButtons.slice(0, 15)) {
            const text = await btn.textContent().catch(() => '');
            if (text && text.trim()) {
              console.log(`  - "${text.trim()}"`);
            }
          }
        }
      } else {
        console.log('Script tab not found');

        // List available tabs
        const allTabs = await page.locator('[role="tab"], button').all();
        console.log('Available tabs/buttons:');
        for (const tab of allTabs.slice(0, 10)) {
          const text = await tab.textContent().catch(() => '');
          if (text && text.trim()) {
            console.log(`  - "${text.trim()}"`);
          }
        }
      }
    } else {
      console.log('No projects found on Backlot page');
    }
  });

  test('test element detection with sample script text', async ({ page }) => {
    console.log('\n=== Testing Element Detection with Sample Script ===\n');

    // Create a sample script in memory and test the detection logic
    const sampleScript = `INT. COFFEE SHOP - DAY

The bustling morning rush fills the small cafe with the aroma of fresh coffee.

SARAH
(nervously)
Have you seen him today?

MIKE
Not since yesterday. Why?

SARAH
I need to talk to him about the project.

CUT TO:

EXT. STREET - CONTINUOUS

Sarah walks out, phone in hand.`;

    console.log('Sample script content:');
    console.log(sampleScript.split('\n').map((line, i) => `  ${i + 1}: "${line}"`).join('\n'));

    // Navigate to app first
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Now test the detection function by injecting it
    const detectionResults = await page.evaluate((script) => {
      // Simplified detection patterns (matching scriptFormatting.ts)
      const ELEMENT_PATTERNS = {
        scene_heading: /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)[\s\S]*/i,
        transition: /^(FADE IN:|FADE OUT:|FADE TO:|CUT TO:|DISSOLVE TO:|SMASH CUT TO:|MATCH CUT TO:|JUMP CUT TO:|TIME CUT:|IRIS IN:|IRIS OUT:|WIPE TO:|.+\s+TO:$|THE END\.?)[\s\S]*/i,
        parenthetical: /^\([\s\S]*\)$/,
        character: /^[A-Z][A-Z0-9\s\-'\.]+$/,
      };

      const lines = script.split('\n');
      const results: { lineNum: number; content: string; detectedType: string; prevType: string }[] = [];
      let prevType = 'action';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed) {
          results.push({ lineNum: i + 1, content: '', detectedType: 'general', prevType });
          continue;
        }

        let detectedType = 'action';

        if (ELEMENT_PATTERNS.scene_heading.test(trimmed)) {
          detectedType = 'scene_heading';
        } else if (ELEMENT_PATTERNS.transition.test(trimmed)) {
          detectedType = 'transition';
        } else if (ELEMENT_PATTERNS.parenthetical.test(trimmed) &&
                   (prevType === 'character' || prevType === 'dialogue' || prevType === 'parenthetical')) {
          detectedType = 'parenthetical';
        } else if (ELEMENT_PATTERNS.character.test(trimmed) && trimmed.length < 50) {
          detectedType = 'character';
        } else if (prevType === 'character' || prevType === 'parenthetical') {
          detectedType = 'dialogue';
        }

        results.push({ lineNum: i + 1, content: trimmed.substring(0, 40), detectedType, prevType });
        prevType = detectedType;
      }

      return results;
    }, sampleScript);

    console.log('\nDetection results:');
    for (const result of detectionResults) {
      if (result.content) {
        console.log(`Line ${result.lineNum}: [${result.detectedType}] "${result.content}" (prev: ${result.prevType})`);
      }
    }

    // Verify expected types
    const expected = [
      { lineNum: 1, content: 'INT. COFFEE SHOP - DAY', expectedType: 'scene_heading' },
      { lineNum: 3, content: 'The bustling', expectedType: 'action' },
      { lineNum: 5, content: 'SARAH', expectedType: 'character' },
      { lineNum: 6, content: '(nervously)', expectedType: 'parenthetical' },
      { lineNum: 7, content: 'Have you seen', expectedType: 'dialogue' },
      { lineNum: 9, content: 'MIKE', expectedType: 'character' },
      { lineNum: 10, content: 'Not since', expectedType: 'dialogue' },
      { lineNum: 14, content: 'CUT TO:', expectedType: 'transition' },
      { lineNum: 16, content: 'EXT. STREET', expectedType: 'scene_heading' },
    ];

    console.log('\n=== Verification ===');
    let mismatches = 0;
    for (const exp of expected) {
      const result = detectionResults.find(r => r.lineNum === exp.lineNum);
      if (result && result.detectedType !== exp.expectedType) {
        mismatches++;
        console.log(`MISMATCH line ${exp.lineNum}: expected ${exp.expectedType}, got ${result?.detectedType}`);
      } else {
        console.log(`OK line ${exp.lineNum}: ${exp.expectedType}`);
      }
    }

    console.log(`\nTotal mismatches: ${mismatches}`);

    if (mismatches > 0) {
      console.log('\n*** Detection logic has issues that need to be fixed ***');
    }
  });
});
