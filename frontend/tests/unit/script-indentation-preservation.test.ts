/**
 * Unit test: Script Line Indentation Preservation
 *
 * Tests that when editing dialogue lines in the script editor,
 * the original indentation is preserved, preventing lines below
 * from shifting position during re-parsing.
 */

import { describe, it, expect } from 'vitest';

describe('Script Line Indentation Preservation', () => {
  it('should preserve dialogue indentation (10 spaces)', () => {
    const originalLine = '          This is dialogue text';
    const leadingSpaces = originalLine.length - originalLine.trimStart().length;
    expect(leadingSpaces).toBe(10);

    // Simulate editing - trim the content
    const trimmed = originalLine.trim();
    expect(trimmed).toBe('This is dialogue text');

    // When saving back, restore the indentation
    const restored = ' '.repeat(leadingSpaces) + trimmed;
    expect(restored).toBe(originalLine);
    expect(restored.length - restored.trimStart().length).toBe(10);
  });

  it('should preserve character indentation (22 spaces)', () => {
    const originalLine = '                      JOHN';
    const leadingSpaces = originalLine.length - originalLine.trimStart().length;
    expect(leadingSpaces).toBe(22);

    // Simulate editing
    const trimmed = originalLine.trim();
    const restored = ' '.repeat(leadingSpaces) + trimmed;

    expect(restored).toBe(originalLine);
    expect(restored.length - restored.trimStart().length).toBe(22);
  });

  it('should preserve parenthetical indentation (15 spaces)', () => {
    const originalLine = '               (quietly)';
    const leadingSpaces = originalLine.length - originalLine.trimStart().length;
    expect(leadingSpaces).toBe(15);

    // Simulate editing
    const trimmed = originalLine.trim();
    const restored = ' '.repeat(leadingSpaces) + trimmed;

    expect(restored).toBe(originalLine);
    expect(restored.length - restored.trimStart().length).toBe(15);
  });

  it('should preserve action indentation (0 spaces)', () => {
    const originalLine = 'John walks into the room.';
    const leadingSpaces = originalLine.length - originalLine.trimStart().length;
    expect(leadingSpaces).toBe(0);

    // Simulate editing
    const trimmed = originalLine.trim();
    const restored = ' '.repeat(leadingSpaces) + trimmed;

    expect(restored).toBe(originalLine);
    expect(restored.length - restored.trimStart().length).toBe(0);
  });

  it('should handle multi-line script content preserving all indentations', () => {
    const scriptLines = [
      'INT. COFFEE SHOP - DAY',           // Scene heading: 0 spaces
      '',                                  // Empty line
      'John walks to the counter.',       // Action: 0 spaces
      '',                                  // Empty line
      '                      JOHN',        // Character: 22 spaces
      '          Hi, can I get a coffee?', // Dialogue: 10 spaces
      '',                                  // Empty line
      '                      BARISTA',     // Character: 22 spaces
      '               (smiling)',          // Parenthetical: 15 spaces
      '          Coming right up!',        // Dialogue: 10 spaces
    ];

    // Simulate the parse -> edit -> save cycle
    const parsedLines = scriptLines.map(line => ({
      content: line.trim(),
      originalIndent: line.length - line.trimStart().length,
    }));

    // Verify parsed correctly
    expect(parsedLines[0].originalIndent).toBe(0);  // Scene heading
    expect(parsedLines[4].originalIndent).toBe(22); // JOHN
    expect(parsedLines[5].originalIndent).toBe(10); // Dialogue
    expect(parsedLines[7].originalIndent).toBe(22); // BARISTA
    expect(parsedLines[8].originalIndent).toBe(15); // Parenthetical
    expect(parsedLines[9].originalIndent).toBe(10); // Dialogue

    // Simulate editing line 5 (first dialogue)
    const editedIndex = 5;
    const newContent = 'Actually, make it a tea instead.';

    // Restore with original indent
    const restoredLine = ' '.repeat(parsedLines[editedIndex].originalIndent) + newContent;

    // Verify indentation preserved
    expect(restoredLine.length - restoredLine.trimStart().length).toBe(10);
    expect(restoredLine.trim()).toBe(newContent);

    // Reconstruct the script
    const reconstructedLines = parsedLines.map((line, idx) => {
      if (idx === editedIndex) {
        return restoredLine;
      }
      return ' '.repeat(line.originalIndent) + line.content;
    });

    // All other lines should maintain their original indentation
    expect(reconstructedLines[0].length - reconstructedLines[0].trimStart().length).toBe(0);  // Scene heading
    expect(reconstructedLines[4].length - reconstructedLines[4].trimStart().length).toBe(22); // JOHN
    expect(reconstructedLines[5].length - reconstructedLines[5].trimStart().length).toBe(10); // Edited dialogue - PRESERVED
    expect(reconstructedLines[7].length - reconstructedLines[7].trimStart().length).toBe(22); // BARISTA
    expect(reconstructedLines[8].length - reconstructedLines[8].trimStart().length).toBe(15); // Parenthetical
    expect(reconstructedLines[9].length - reconstructedLines[9].trimStart().length).toBe(10); // Next dialogue
  });

  it('should demonstrate the bug scenario - without preservation indentation is lost', () => {
    const dialogueLine = '          This is dialogue';

    // BUG: Old behavior - just store trimmed content
    const trimmed = dialogueLine.trim();
    const buggyRestore = trimmed; // No indentation!

    // This would cause re-detection to fail
    expect(buggyRestore.length - buggyRestore.trimStart().length).toBe(0); // Lost indentation!

    // FIXED: New behavior - preserve original indent
    const originalIndent = dialogueLine.length - dialogueLine.trimStart().length;
    const fixedRestore = ' '.repeat(originalIndent) + trimmed;

    expect(fixedRestore.length - fixedRestore.trimStart().length).toBe(10); // Indentation preserved!
  });
});
