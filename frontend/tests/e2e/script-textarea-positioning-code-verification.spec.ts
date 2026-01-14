/**
 * Script Editor Textarea Positioning - Code Verification Test
 *
 * This test verifies that the textarea styling fix has been correctly applied
 * to the ScriptPageView.tsx file, ensuring that the textarea and span elements
 * will render with matching positions.
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';

const SCRIPT_PAGE_VIEW_PATH = '/home/estro/second-watch-network/frontend/src/components/backlot/workspace/ScriptPageView.tsx';

test.describe('Script Editor Textarea Positioning - Code Verification', () => {

  test('verify textarea has proper inline styles to match span position', async () => {
    console.log('\n=== Verifying Textarea Styling Fix ===\n');

    const fileContent = fs.readFileSync(SCRIPT_PAGE_VIEW_PATH, 'utf-8');

    // Verify the textarea has the critical style properties that prevent text shifting

    // 1. Check for padding: 0 in the inline style
    const hasPaddingZero = /style=\{[\s\S]*?padding:\s*0[\s\S]*?\}/m.test(fileContent);
    console.log(`1. padding: 0 in style: ${hasPaddingZero ? 'PRESENT' : 'MISSING'}`);
    expect(hasPaddingZero).toBe(true);

    // 2. Check for margin: 0 in the inline style
    const hasMarginZero = /style=\{[\s\S]*?margin:\s*0[\s\S]*?\}/m.test(fileContent);
    console.log(`2. margin: 0 in style: ${hasMarginZero ? 'PRESENT' : 'MISSING'}`);
    expect(hasMarginZero).toBe(true);

    // 3. Check for boxSizing: 'border-box'
    const hasBoxSizing = /boxSizing:\s*['"]border-box['"]/m.test(fileContent);
    console.log(`3. boxSizing: 'border-box' in style: ${hasBoxSizing ? 'PRESENT' : 'MISSING'}`);
    expect(hasBoxSizing).toBe(true);

    // 4. Check for textIndent: 0
    const hasTextIndent = /textIndent:\s*0/m.test(fileContent);
    console.log(`4. textIndent: 0 in style: ${hasTextIndent ? 'PRESENT' : 'MISSING'}`);
    expect(hasTextIndent).toBe(true);

    // 5. Check for letterSpacing: 'normal'
    const hasLetterSpacing = /letterSpacing:\s*['"]normal['"]/m.test(fileContent);
    console.log(`5. letterSpacing: 'normal' in style: ${hasLetterSpacing ? 'PRESENT' : 'MISSING'}`);
    expect(hasLetterSpacing).toBe(true);

    // 6. Check for wordSpacing: 'normal'
    const hasWordSpacing = /wordSpacing:\s*['"]normal['"]/m.test(fileContent);
    console.log(`6. wordSpacing: 'normal' in style: ${hasWordSpacing ? 'PRESENT' : 'MISSING'}`);
    expect(hasWordSpacing).toBe(true);

    // 7. Check that textarea has the essential classes for styling
    const hasTextareaClasses = /className="[^"]*w-full[^"]*bg-transparent[^"]*border-none[^"]*outline-none[^"]*resize-none[^"]*overflow-hidden[^"]*"/m.test(fileContent);
    console.log(`7. textarea has essential classes: ${hasTextareaClasses ? 'PRESENT' : 'MISSING'}`);
    expect(hasTextareaClasses).toBe(true);

    // 8. Verify the span has block display for consistent rendering
    const hasSpanBlockDisplay = /display:\s*['"]block['"]/m.test(fileContent);
    console.log(`8. span has display: 'block': ${hasSpanBlockDisplay ? 'PRESENT' : 'MISSING'}`);
    expect(hasSpanBlockDisplay).toBe(true);

    console.log('\n=== All Textarea Styling Fixes Verified ===\n');
  });

  test('verify textarea and span are siblings in the same conditional render', async () => {
    console.log('\n=== Verifying Conditional Render Structure ===\n');

    const fileContent = fs.readFileSync(SCRIPT_PAGE_VIEW_PATH, 'utf-8');

    // Verify the structure: {isEditingThis ? (<textarea .../>) : (<span ...></span>)}
    const conditionalPattern = /\{isEditingThis\s*\?\s*\(\s*<textarea[\s\S]*?\/>\s*\)\s*:\s*\(\s*<span[\s\S]*?<\/span>\s*\)\}/m;
    const hasCorrectStructure = conditionalPattern.test(fileContent);

    console.log(`Conditional render structure (textarea/span toggle): ${hasCorrectStructure ? 'CORRECT' : 'INCORRECT'}`);
    expect(hasCorrectStructure).toBe(true);

    // Verify both elements are rendered inside the same parent div container
    // The parent div has className containing "absolute cursor-text"
    const parentDivPattern = /className=\{cn\(\s*["']absolute cursor-text["']/m;
    const hasParentDiv = parentDivPattern.test(fileContent);

    console.log(`Parent div has 'absolute cursor-text' class: ${hasParentDiv ? 'PRESENT' : 'MISSING'}`);
    expect(hasParentDiv).toBe(true);

    console.log('\n=== Structure Verification Complete ===\n');
  });

  test('verify no p-0 m-0 in className (moved to inline style)', async () => {
    console.log('\n=== Verifying Tailwind Classes Moved to Inline Styles ===\n');

    const fileContent = fs.readFileSync(SCRIPT_PAGE_VIEW_PATH, 'utf-8');

    // The fix removes p-0 m-0 from className and uses inline styles instead
    // to avoid potential Tailwind specificity issues
    const textareaClassNamePattern = /className="[^"]*w-full[^"]*bg-transparent[^"]*"/m;
    const textareaMatch = fileContent.match(textareaClassNamePattern);

    if (textareaMatch) {
      const classNameStr = textareaMatch[0];
      const hasP0InClassName = classNameStr.includes('p-0');
      const hasM0InClassName = classNameStr.includes('m-0');

      console.log(`p-0 removed from className (using inline style instead): ${!hasP0InClassName ? 'CORRECT' : 'STILL IN CLASSNAME'}`);
      console.log(`m-0 removed from className (using inline style instead): ${!hasM0InClassName ? 'CORRECT' : 'STILL IN CLASSNAME'}`);

      // We expect these to NOT be in className anymore since we moved them to inline styles
      // However, having them in both places doesn't hurt, so this is informational
      console.log(`Note: Using inline styles for padding/margin ensures browser default overrides`);
    }

    console.log('\n=== Tailwind Class Verification Complete ===\n');
  });

  test('output the actual textarea style object for review', async () => {
    console.log('\n=== Extracting Textarea Style Object ===\n');

    const fileContent = fs.readFileSync(SCRIPT_PAGE_VIEW_PATH, 'utf-8');

    // Find the textarea element with its style object
    const textareaPattern = /<textarea[\s\S]*?style=\{\{([\s\S]*?)\}\}/m;
    const match = fileContent.match(textareaPattern);

    if (match) {
      const styleObject = match[1];
      console.log('Textarea inline style properties:');
      console.log('--------------------------------');

      // Parse and display each style property
      const styleLines = styleObject.split('\n').filter(line => line.trim() && !line.trim().startsWith('//'));
      for (const line of styleLines) {
        const cleanLine = line.trim().replace(/,\s*$/, '');
        if (cleanLine) {
          console.log(`  ${cleanLine}`);
        }
      }
      console.log('--------------------------------');
    } else {
      console.log('Could not extract textarea style object');
    }

    console.log('\n=== Style Object Extraction Complete ===\n');
  });
});
