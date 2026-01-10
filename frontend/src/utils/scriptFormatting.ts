/**
 * Shared screenplay formatting constants and styles
 * Used by ScriptEditorPanel and ScriptTextViewer for consistent formatting
 */
import React from 'react';

// ============================================================================
// SCREENPLAY ELEMENT TYPES
// ============================================================================

export type ScriptElementType =
  | 'scene_heading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'shot'
  | 'general'
  // Title page elements
  | 'title'
  | 'author'
  | 'contact'
  | 'draft_info'
  | 'copyright'
  | 'title_page_text';

export interface ScriptElement {
  type: ScriptElementType;
  content: string;
  lineIndex: number;
}

// ============================================================================
// PAGE LAYOUT CONSTANTS
// ============================================================================

// Industry standard page dimensions (in pixels at 72 DPI)
export const PAGE_WIDTH_PX = 612;    // 8.5" at 72dpi
export const PAGE_HEIGHT_PX = 792;   // 11" at 72dpi

// Industry standard margins (in pixels at 72 DPI)
export const MARGIN_LEFT = 108;      // 1.5" left margin (for binding)
export const MARGIN_RIGHT = 72;      // 1" right margin
export const MARGIN_TOP = 72;        // 1" top margin
export const MARGIN_BOTTOM = 72;     // 1" bottom margin

// Content area
export const CONTENT_WIDTH = PAGE_WIDTH_PX - MARGIN_LEFT - MARGIN_RIGHT; // 432px = 6"

// Lines per page - calculated based on actual available space (matches PDF export)
// Page has 792px height - 72px top - 72px bottom = 648px for content
// At 12px font with 1.0 line-height = 12px per line
// Max lines = 648 / 12 = 54 lines per page
export const LINES_PER_PAGE = 54;

// ============================================================================
// ELEMENT POSITIONING (from LEFT EDGE of page)
// ============================================================================

// Element positioning from LEFT EDGE of page (in pixels at 72 DPI)
export const CHAR_LEFT = 266;        // 3.7" - Character name position
export const DIALOGUE_LEFT = 180;    // 2.5" - Dialogue start
export const DIALOGUE_RIGHT = 432;   // 6" - Dialogue end
export const PAREN_LEFT = 223;       // 3.1" - Parenthetical start
export const PAREN_RIGHT = 403;      // 5.6" - Parenthetical end

// ============================================================================
// ELEMENT DETECTION PATTERNS
// ============================================================================

/**
 * All standard screenplay character extensions (parenthetical modifiers)
 * Used in character pattern matching for Celtx/Final Draft compatibility
 */
export const CHARACTER_EXTENSIONS = [
  // Standard extensions
  'V\\.O\\.',        // Voice Over
  'O\\.S\\.',        // Off Screen
  'O\\.C\\.',        // Off Camera
  "CONT'D",          // Continued
  'CONTINUING',      // Continuing
  // Extended extensions (Celtx/Final Draft compatible)
  'FILTERED',        // Through device/filter
  'SUBTITLED',       // Foreign language with subtitles
  'WHISPERING',      // Whispered dialogue
  'SINGING',         // Musical element
  'PRE-LAP',         // Audio before scene transition
  'MORE',            // Page break continuation
  'INTO PHONE',      // Speaking into phone
  'ON PHONE',        // On phone call
  'TELEPATHY',       // Telepathic speech
  'NARRATING',       // Narration
  'OVER',            // Voice over (alternate)
];

// Build extended character pattern from extensions
const CHARACTER_EXTENSION_PATTERN = `(?:\\s*\\((?:${CHARACTER_EXTENSIONS.join('|')})\\))?`;
const EXTENDED_CHARACTER_REGEX = new RegExp(
  `^[A-Z][A-Z0-9\\s\\-'\\.]+${CHARACTER_EXTENSION_PATTERN}\\s*$`
);

export const ELEMENT_PATTERNS = {
  scene_heading: /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)[\s\S]*/i,
  transition: /^(FADE IN:|FADE OUT:|FADE TO:|CUT TO:|DISSOLVE TO:|SMASH CUT TO:|MATCH CUT TO:|JUMP CUT TO:|TIME CUT:|IRIS IN:|IRIS OUT:|WIPE TO:|.+\s+TO:$|THE END\.?)[\s\S]*/i,
  shot: /^(CLOSE ON|ANGLE ON|POV|INSERT|FLASHBACK|FLASH FORWARD|BACK TO SCENE|CONTINUOUS|LATER|MOMENTS LATER|SAME TIME|INTERCUT)[\s\S]*/i,
  character: EXTENDED_CHARACTER_REGEX,
  parenthetical: /^\([\s\S]*\)$/,
  // Title page patterns
  author: /^(written\s+by|screenplay\s+by|teleplay\s+by|story\s+by|by\s*$)/i,
  draft_info: /^(draft|revision|version|\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  copyright: /^(©|copyright|\(c\))/i,
  contact: /(@[\w.-]+\.\w+|\(\d{3}\)\s*\d{3}[-.]?\d{4}|\d{3}[-.]?\d{3}[-.]?\d{4}|agent:|manager:|represented\s+by)/i,
};

// ============================================================================
// DETECTION CONFIGURATION (Celtx/Final Draft style)
// ============================================================================

/**
 * Detection strictness mode
 * - 'strict': Pattern-only matching (for editor typing)
 * - 'forgiving': Pattern + indent fallback (for imported content)
 */
export type DetectionStrictness = 'strict' | 'forgiving';

/**
 * Configuration for element detection behavior
 */
export interface DetectionConfig {
  strictness: DetectionStrictness;
  allowIndentFallback: boolean;  // Use indent hints if pattern fails
  characterMinLength: number;    // Min chars for character name
  characterMaxLength: number;    // Max chars for character name
}

/**
 * Strict configuration - for editor typing (like Final Draft)
 * Only uses pattern matching, no indent guessing
 */
export const STRICT_CONFIG: DetectionConfig = {
  strictness: 'strict',
  allowIndentFallback: false,
  characterMinLength: 2,
  characterMaxLength: 50,
};

/**
 * Forgiving configuration - for imported content display
 * Uses patterns + indent hints for ambiguous cases
 */
export const FORGIVING_CONFIG: DetectionConfig = {
  strictness: 'forgiving',
  allowIndentFallback: true,
  characterMinLength: 1,
  characterMaxLength: 60,
};

// Indent thresholds for forgiving mode (based on backend formatting)
const INDENT_THRESHOLDS = {
  leftAligned: 8,       // 0-8 spaces: scene heading, action
  dialogue: 14,         // 8-14 spaces: dialogue
  parenthetical: 18,    // 12-18 spaces: parenthetical
  character: 30,        // 15-30 spaces: character
  transition: 35,       // 35+ spaces: transition (right-aligned)
};

// ============================================================================
// ELEMENT POSITIONING HELPERS
// ============================================================================

/**
 * Get inline element positioning (margin/width) for screenplay elements
 * Calculates position relative to the content area (after left margin)
 */
export function getInlineElementPosition(type: ScriptElementType): {
  marginLeft?: string;
  marginRight?: string;
  width?: string;
  maxWidth?: string;
} {
  switch (type) {
    case 'scene_heading':
    case 'action':
    case 'shot':
    case 'general':
      // Full width from left margin to right margin - no additional margins
      return {};

    case 'character':
      // Character: starts at 3.7" from page left (158px from content left)
      // Convert to pixels: CHAR_LEFT - MARGIN_LEFT = 266 - 108 = 158px
      return {
        marginLeft: '158px',
        width: 'auto',
        maxWidth: `${CONTENT_WIDTH - 158}px` // 274px
      };

    case 'dialogue':
      // Dialogue: 2.5" to 6" from page left (72px from content left, width 252px)
      // DIALOGUE_LEFT - MARGIN_LEFT = 180 - 108 = 72px
      // DIALOGUE_RIGHT - DIALOGUE_LEFT = 432 - 180 = 252px
      return {
        marginLeft: '72px',
        width: '252px',
        maxWidth: '252px'
      };

    case 'parenthetical':
      // Parenthetical: 3.1" to 5.6" from page left (115px from content left, width 180px)
      // PAREN_LEFT - MARGIN_LEFT = 223 - 108 = 115px
      // PAREN_RIGHT - PAREN_LEFT = 403 - 223 = 180px
      return {
        marginLeft: '115px',
        width: '180px',
        maxWidth: '180px'
      };

    case 'transition':
      // Right-aligned
      return {};

    // Title page elements - centered
    case 'title':
    case 'author':
    case 'draft_info':
    case 'copyright':
    case 'title_page_text':
      return {};

    case 'contact':
      // Contact info is left-aligned
      return {};

    default:
      return {};
  }
}

// ============================================================================
// ELEMENT STYLES
// ============================================================================

/**
 * Complete styling for each screenplay element type
 * Includes typography, spacing, and positioning
 */
export const ELEMENT_STYLES: Record<ScriptElementType, React.CSSProperties> = {
  scene_heading: {
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginTop: '24px',
    marginBottom: '12px',
    ...getInlineElementPosition('scene_heading'),
  },
  action: {
    marginBottom: '12px',
    ...getInlineElementPosition('action'),
  },
  character: {
    textTransform: 'uppercase',
    marginTop: '12px',
    marginBottom: '0',
    ...getInlineElementPosition('character'),
  },
  dialogue: {
    marginBottom: '0',
    ...getInlineElementPosition('dialogue'),
  },
  parenthetical: {
    fontStyle: 'italic',
    ...getInlineElementPosition('parenthetical'),
  },
  transition: {
    textAlign: 'right',
    textTransform: 'uppercase',
    marginTop: '12px',
    marginBottom: '12px',
    ...getInlineElementPosition('transition'),
  },
  shot: {
    textTransform: 'uppercase',
    marginTop: '12px',
    marginBottom: '12px',
    ...getInlineElementPosition('shot'),
  },
  general: {
    marginBottom: '12px',
    ...getInlineElementPosition('general'),
  },
  // Title page elements - centered formatting
  title: {
    textAlign: 'center',
    fontSize: '18px',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginTop: '120px',
    marginBottom: '24px',
    ...getInlineElementPosition('title'),
  },
  author: {
    textAlign: 'center',
    marginBottom: '8px',
    ...getInlineElementPosition('author'),
  },
  contact: {
    textAlign: 'left',
    fontSize: '12px',
    marginTop: '48px',
    ...getInlineElementPosition('contact'),
  },
  draft_info: {
    textAlign: 'center',
    marginTop: '24px',
    fontSize: '12px',
    ...getInlineElementPosition('draft_info'),
  },
  copyright: {
    textAlign: 'center',
    marginTop: '12px',
    fontSize: '10px',
    ...getInlineElementPosition('copyright'),
  },
  title_page_text: {
    textAlign: 'center',
    ...getInlineElementPosition('title_page_text'),
  },
};

// ============================================================================
// ELEMENT TYPE DETECTION
// ============================================================================

/**
 * Detect element type using indent-based heuristics (forgiving mode)
 * Used for imported content where backend has already formatted with indentation
 */
function detectByIndent(
  line: string,
  trimmed: string,
  prevType?: ScriptElementType
): ScriptElementType | null {
  const leadingSpaces = line.length - line.trimStart().length;

  // Right-aligned (35+ spaces) = transition
  if (leadingSpaces >= INDENT_THRESHOLDS.transition) {
    return 'transition';
  }

  // Character position (15-30 spaces) + ALL CAPS = character
  if (leadingSpaces >= 15 && leadingSpaces <= INDENT_THRESHOLDS.character) {
    if (trimmed === trimmed.toUpperCase() && trimmed.length < 60) {
      return 'character';
    }
  }

  // Parenthetical position (12-18 spaces) + starts with ( = parenthetical
  if (leadingSpaces >= 12 && leadingSpaces <= INDENT_THRESHOLDS.parenthetical) {
    if (trimmed.startsWith('(') && (prevType === 'character' || prevType === 'dialogue' || prevType === 'parenthetical')) {
      return 'parenthetical';
    }
  }

  // Dialogue position (8-14 spaces) + follows character/parenthetical/dialogue
  if (leadingSpaces >= 8 && leadingSpaces <= INDENT_THRESHOLDS.dialogue) {
    if (prevType === 'character' || prevType === 'parenthetical' || prevType === 'dialogue') {
      return 'dialogue';
    }
  }

  // Left-aligned (0-8 spaces) - could be scene heading, action, or transition
  if (leadingSpaces < INDENT_THRESHOLDS.leftAligned) {
    if (ELEMENT_PATTERNS.scene_heading.test(trimmed)) return 'scene_heading';
    if (ELEMENT_PATTERNS.transition.test(trimmed)) return 'transition';
    if (ELEMENT_PATTERNS.shot.test(trimmed)) return 'shot';
    return 'action';
  }

  return null; // No indent-based match
}

/**
 * Detect the element type for a line of script content
 * Uses pattern matching and context awareness
 *
 * @param line - The full line including leading whitespace
 * @param prevLine - Previous line (optional, for context)
 * @param prevType - Previous element type (for dialogue/parenthetical context)
 * @param isTitlePage - Whether we're on the title page
 * @param config - Detection configuration (defaults to STRICT_CONFIG)
 */
export function detectElementType(
  line: string,
  prevLine?: string,
  prevType?: ScriptElementType,
  isTitlePage?: boolean,
  config: DetectionConfig = STRICT_CONFIG
): ScriptElementType {
  const trimmed = line.trim();
  if (!trimmed) return 'general';

  // Title page detection (same for both modes)
  if (isTitlePage) {
    const leadingSpaces = line.length - line.trimStart().length;
    const isCentered = leadingSpaces >= 15;

    // Check patterns in order: copyright, author, draft_info, contact
    if (ELEMENT_PATTERNS.copyright.test(trimmed)) return 'copyright';
    if (ELEMENT_PATTERNS.author.test(trimmed)) return 'author';
    if (ELEMENT_PATTERNS.draft_info.test(trimmed)) return 'draft_info';
    if (ELEMENT_PATTERNS.contact.test(trimmed)) return 'contact';

    // Title detection: ALL CAPS, short, no scene heading prefix
    if ((trimmed === trimmed.toUpperCase() && trimmed.length < 80 &&
         !ELEMENT_PATTERNS.scene_heading.test(trimmed)) ||
        (isCentered && trimmed === trimmed.toUpperCase() &&
         !ELEMENT_PATTERNS.scene_heading.test(trimmed))) {
      return 'title';
    }

    // Default title page text
    return 'title_page_text';
  }

  // Forgiving mode: try indent-based detection first for imported content
  if (config.strictness === 'forgiving' && config.allowIndentFallback) {
    const indentResult = detectByIndent(line, trimmed, prevType);
    if (indentResult) return indentResult;
  }

  // Pattern-based detection (used by both modes)

  // Scene heading: INT./EXT. patterns
  if (ELEMENT_PATTERNS.scene_heading.test(trimmed)) return 'scene_heading';

  // Transition: FADE IN, CUT TO, etc.
  if (ELEMENT_PATTERNS.transition.test(trimmed)) return 'transition';

  // Shot: CLOSE ON, ANGLE ON, POV, etc.
  if (ELEMENT_PATTERNS.shot.test(trimmed)) return 'shot';

  // Parenthetical: must follow character or dialogue
  if (ELEMENT_PATTERNS.parenthetical.test(trimmed) &&
      (prevType === 'character' || prevType === 'dialogue' || prevType === 'parenthetical')) {
    return 'parenthetical';
  }

  // Character: ALL CAPS with optional extensions, within length limits
  const maxLen = config.characterMaxLength;
  const minLen = config.characterMinLength;
  if (ELEMENT_PATTERNS.character.test(trimmed) &&
      trimmed.length >= minLen &&
      trimmed.length <= maxLen) {
    return 'character';
  }

  // Dialogue: follows character or parenthetical
  if (prevType === 'character' || prevType === 'parenthetical') {
    return 'dialogue';
  }

  // Default to action
  return 'action';
}

/**
 * Parse script content into typed elements
 *
 * @param content - Full script text content
 * @param config - Detection configuration (defaults to FORGIVING_CONFIG for parsing)
 */
export function parseScriptElements(
  content: string,
  config: DetectionConfig = FORGIVING_CONFIG
): ScriptElement[] {
  const lines = content.split('\n');
  const elements: ScriptElement[] = [];
  let prevType: ScriptElementType | undefined;

  // Determine where title page ends (first scene heading or after ~60 lines)
  let titlePageEnds = -1;
  for (let i = 0; i < Math.min(lines.length, 60); i++) {
    const trimmed = lines[i].trim();
    if (ELEMENT_PATTERNS.scene_heading.test(trimmed)) {
      titlePageEnds = i;
      break;
    }
  }
  // If no scene heading in first 60 lines, assume first ~55 lines = title page
  if (titlePageEnds === -1) {
    titlePageEnds = Math.min(55, lines.length);
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prevLine = i > 0 ? lines[i - 1] : undefined;
    const isTitlePage = i < titlePageEnds;
    const type = detectElementType(line, prevLine, prevType, isTitlePage, config);

    elements.push({
      type,
      content: line,
      lineIndex: i,
    });

    prevType = type;
  }

  return elements;
}

// ============================================================================
// SCENE PARSING FOR BREAKDOWN INTEGRATION
// ============================================================================

/**
 * Represents a parsed scene from script content
 */
export interface ParsedScene {
  /** Scene number extracted from heading (if present) or auto-generated index */
  sceneNumber: string;
  /** Full scene heading (slugline), e.g., "INT. COFFEE SHOP - DAY" */
  slugline: string;
  /** Character offset where this scene starts in the content */
  startOffset: number;
  /** Character offset where this scene ends (start of next scene or end of content) */
  endOffset: number;
  /** Line number where scene heading appears (0-based) */
  lineNumber: number;
}

/**
 * Extract scene number from a scene heading
 * Handles formats like:
 * - "1. INT. COFFEE SHOP - DAY" -> "1"
 * - "1A. EXT. PARK - NIGHT" -> "1A"
 * - "SCENE 12: INT. HOUSE - DAY" -> "12"
 * - "INT. COFFEE SHOP - DAY" -> null (no scene number)
 */
function extractSceneNumber(heading: string): string | null {
  const trimmed = heading.trim();

  // Pattern 1: Number at start followed by dot (e.g., "1. INT." or "1A. INT.")
  const numDotMatch = trimmed.match(/^(\d+[A-Z]?)\.\s+/i);
  if (numDotMatch) return numDotMatch[1].toUpperCase();

  // Pattern 2: "SCENE X:" or "SCENE X -" format
  const sceneMatch = trimmed.match(/^SCENE\s+(\d+[A-Z]?)[\s:-]/i);
  if (sceneMatch) return sceneMatch[1].toUpperCase();

  // Pattern 3: Number in parentheses at start (e.g., "(1) INT.")
  const parenMatch = trimmed.match(/^\((\d+[A-Z]?)\)\s+/i);
  if (parenMatch) return parenMatch[1].toUpperCase();

  return null;
}

/**
 * Parse script content and extract all scenes with their character offsets
 *
 * @param content - Full script text content
 * @returns Array of parsed scenes with offset ranges
 *
 * @example
 * const scenes = parseSceneFromContent(scriptText);
 * // Returns:
 * // [
 * //   { sceneNumber: "1", slugline: "INT. COFFEE SHOP - DAY", startOffset: 0, endOffset: 523, lineNumber: 0 },
 * //   { sceneNumber: "2", slugline: "EXT. STREET - NIGHT", startOffset: 523, endOffset: 1024, lineNumber: 15 },
 * // ]
 */
export function parseSceneFromContent(content: string): ParsedScene[] {
  const scenes: ParsedScene[] = [];
  const lines = content.split('\n');

  let currentOffset = 0;
  let sceneIndex = 0;
  let firstSceneOffset = -1;
  let firstSceneLineNum = -1;

  // First pass: find where first scene heading starts
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    const trimmed = line.trim();

    if (ELEMENT_PATTERNS.scene_heading.test(trimmed)) {
      firstSceneOffset = currentOffset;
      firstSceneLineNum = lineNum;
      break;
    }

    currentOffset += line.length + 1;
  }

  // If there's content before the first scene, add a PROLOGUE scene
  if (firstSceneOffset > 0) {
    // Check if there's actual non-whitespace content before the first scene
    const contentBeforeFirstScene = content.substring(0, firstSceneOffset).trim();
    if (contentBeforeFirstScene.length > 0) {
      scenes.push({
        sceneNumber: 'PROLOGUE',
        slugline: 'PROLOGUE / COLD OPEN',
        startOffset: 0,
        endOffset: firstSceneOffset,
        lineNumber: 0,
      });
    }
  }

  // Second pass: parse actual scene headings
  currentOffset = 0;
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    const trimmed = line.trim();

    // Check if this is a scene heading
    if (ELEMENT_PATTERNS.scene_heading.test(trimmed)) {
      // Close the previous scene (if any)
      if (scenes.length > 0) {
        scenes[scenes.length - 1].endOffset = currentOffset;
      }

      // Extract scene number or generate one
      const extractedNumber = extractSceneNumber(trimmed);
      sceneIndex++;

      scenes.push({
        sceneNumber: extractedNumber || String(sceneIndex),
        slugline: trimmed,
        startOffset: currentOffset,
        endOffset: content.length, // Will be updated when next scene is found
        lineNumber: lineNum,
      });
    }

    // Account for line content plus newline character
    currentOffset += line.length + 1;
  }

  // Ensure last scene's endOffset is at content end
  if (scenes.length > 0) {
    scenes[scenes.length - 1].endOffset = content.length;
  }

  return scenes;
}

/**
 * Find which scene contains a given character offset
 *
 * @param scenes - Array of parsed scenes from parseSceneFromContent
 * @param offset - Character offset to find scene for
 * @returns The scene containing the offset, or null if before first scene
 *
 * @example
 * const scenes = parseSceneFromContent(scriptText);
 * const selection = { start: 150, end: 200 };
 * const scene = getSceneForOffset(scenes, selection.start);
 * // Returns: { sceneNumber: "1", slugline: "INT. COFFEE SHOP - DAY", ... }
 */
export function getSceneForOffset(scenes: ParsedScene[], offset: number): ParsedScene | null {
  if (scenes.length === 0) return null;

  // Binary search for efficiency on large scripts
  let left = 0;
  let right = scenes.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const scene = scenes[mid];

    if (offset >= scene.startOffset && offset < scene.endOffset) {
      return scene;
    } else if (offset < scene.startOffset) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  // If offset is after last scene's endOffset, return last scene
  if (offset >= scenes[scenes.length - 1].endOffset) {
    return scenes[scenes.length - 1];
  }

  // If offset is before first scene (title page, etc.)
  return null;
}

/**
 * Get scene information for a text selection range
 * Returns the scene that contains the start of the selection
 *
 * @param content - Full script content
 * @param selectionStart - Start offset of selection
 * @param selectionEnd - End offset of selection (optional, for validation)
 * @returns Scene info or null if selection is before first scene
 */
export function getSceneForSelection(
  content: string,
  selectionStart: number,
  selectionEnd?: number
): ParsedScene | null {
  const scenes = parseSceneFromContent(content);
  return getSceneForOffset(scenes, selectionStart);
}

/**
 * Format a scene heading for display
 * Removes scene numbers and cleans up the slugline
 *
 * @param slugline - Raw scene heading text
 * @returns Cleaned slugline for display
 */
export function formatSluglineForDisplay(slugline: string): string {
  let formatted = slugline.trim();

  // Remove leading scene numbers (e.g., "1. " or "(1) " or "SCENE 1: ")
  formatted = formatted
    .replace(/^\d+[A-Z]?\.\s+/i, '')
    .replace(/^\(\d+[A-Z]?\)\s+/i, '')
    .replace(/^SCENE\s+\d+[A-Z]?[\s:-]+/i, '');

  return formatted;
}

/**
 * Get a summary of scenes in content
 * Useful for debugging and UI display
 */
export function getSceneSummary(content: string): {
  totalScenes: number;
  scenes: { number: string; slugline: string; charCount: number }[];
} {
  const scenes = parseSceneFromContent(content);
  return {
    totalScenes: scenes.length,
    scenes: scenes.map(s => ({
      number: s.sceneNumber,
      slugline: formatSluglineForDisplay(s.slugline),
      charCount: s.endOffset - s.startOffset,
    })),
  };
}
