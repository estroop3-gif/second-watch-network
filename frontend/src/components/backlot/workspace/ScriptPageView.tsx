/**
 * ScriptPageView - Paginated screenplay editor with Celtx-style editing
 *
 * Features:
 * - Industry standard page layout (US Letter: 8.5" x 11")
 * - Fixed lines per page (~55 lines for screenplay)
 * - Visual page breaks with page numbers
 * - Editable with screenplay formatting
 * - Keyboard shortcuts for element types
 * - Auto-formatting as you type
 */
import React, { useState, useMemo, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Edit,
  Eye,
  FileText,
  Save,
  X,
  Clapperboard,
  Users,
  MessageSquare,
  AlignLeft,
  ArrowRight,
  Type,
  Maximize,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Screenplay page constants (industry standard at 72 DPI)
const LINES_PER_PAGE = 55;
const PAGE_WIDTH_PX = 612; // 8.5" at 72dpi
const PAGE_HEIGHT_PX = 792; // 11" at 72dpi

// Industry standard margins (in pixels at 72 DPI)
const MARGIN_LEFT = 108;   // 1.5" left margin (for binding)
const MARGIN_RIGHT = 72;   // 1" right margin
const MARGIN_TOP = 72;     // 1" top margin
const MARGIN_BOTTOM = 72;  // 1" bottom margin
const CONTENT_WIDTH = PAGE_WIDTH_PX - MARGIN_LEFT - MARGIN_RIGHT; // 432px = 6"

// Element positioning from LEFT EDGE of page (in pixels at 72 DPI)
// These match standard screenplay formatting software
const CHAR_LEFT = 266;     // 3.7" - Character name position
const DIALOGUE_LEFT = 180; // 2.5" - Dialogue start
const DIALOGUE_RIGHT = 432; // 6" - Dialogue end
const PAREN_LEFT = 223;    // 3.1" - Parenthetical start
const PAREN_RIGHT = 403;   // 5.6" - Parenthetical end
const TRANSITION_RIGHT = MARGIN_RIGHT; // Right-aligned to 1" margin

// Element types
type ScriptElementType =
  | 'scene_heading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'general';

interface ScriptLine {
  type: ScriptElementType;
  content: string;
  lineIndex: number;
}

interface ScriptPage {
  pageNumber: number;
  lines: ScriptLine[];
  startLineIndex: number;
  endLineIndex: number;
}

// Element patterns for detection
const ELEMENT_PATTERNS = {
  scene_heading: /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)[\s\S]*/i,
  transition: /^(FADE IN:|FADE OUT:|FADE TO:|CUT TO:|DISSOLVE TO:|SMASH CUT TO:|MATCH CUT TO:|THE END\.?)[\s\S]*/i,
  character: /^[A-Z][A-Z0-9\s\-'\.]+(\s*\(V\.O\.\)|\s*\(O\.S\.\)|\s*\(O\.C\.\)|\s*\(CONT'D\))?$/,
  parenthetical: /^\(.+\)$/,
};

// Element styling config (positioning is calculated separately based on page measurements)
const ELEMENT_CONFIG: Record<ScriptElementType, {
  label: string;
  shortcut: string;
  icon: any;
  textStyle: React.CSSProperties; // Only text styling, not positioning
  placeholder: string;
}> = {
  scene_heading: {
    label: 'Scene Heading',
    shortcut: 'Ctrl+1',
    icon: Clapperboard,
    textStyle: { fontWeight: 'bold', textTransform: 'uppercase' as const },
    placeholder: 'INT. LOCATION - DAY',
  },
  action: {
    label: 'Action',
    shortcut: 'Ctrl+2',
    icon: AlignLeft,
    textStyle: {},
    placeholder: 'Description of action...',
  },
  character: {
    label: 'Character',
    shortcut: 'Ctrl+3',
    icon: Users,
    textStyle: { textTransform: 'uppercase' as const },
    placeholder: 'CHARACTER NAME',
  },
  dialogue: {
    label: 'Dialogue',
    shortcut: 'Ctrl+4',
    icon: MessageSquare,
    textStyle: {},
    placeholder: 'Dialogue text...',
  },
  parenthetical: {
    label: 'Parenthetical',
    shortcut: 'Ctrl+5',
    icon: Type,
    textStyle: {},
    placeholder: '(direction)',
  },
  transition: {
    label: 'Transition',
    shortcut: 'Ctrl+6',
    icon: ArrowRight,
    textStyle: { textTransform: 'uppercase' as const },
    placeholder: 'CUT TO:',
  },
  general: {
    label: 'General',
    shortcut: 'Ctrl+0',
    icon: AlignLeft,
    textStyle: {},
    placeholder: '',
  },
};

// Calculate element positioning based on type (returns left offset and width in pixels at base scale)
function getElementPosition(type: ScriptElementType): { left: number; width: number; textAlign?: 'left' | 'right' | 'center' } {
  switch (type) {
    case 'scene_heading':
    case 'action':
    case 'general':
      // Full width from left margin to right margin
      return { left: 0, width: CONTENT_WIDTH };
    case 'character':
      // Centered, starting at 3.7" from page left (158px from content left)
      return { left: CHAR_LEFT - MARGIN_LEFT, width: CONTENT_WIDTH - (CHAR_LEFT - MARGIN_LEFT) };
    case 'dialogue':
      // 2.5" to 6" from page left
      return { left: DIALOGUE_LEFT - MARGIN_LEFT, width: DIALOGUE_RIGHT - DIALOGUE_LEFT };
    case 'parenthetical':
      // 3.1" to 5.6" from page left
      return { left: PAREN_LEFT - MARGIN_LEFT, width: PAREN_RIGHT - PAREN_LEFT };
    case 'transition':
      // Right-aligned
      return { left: 0, width: CONTENT_WIDTH, textAlign: 'right' };
    default:
      return { left: 0, width: CONTENT_WIDTH };
  }
}

// Detect element type from content
function detectElementType(line: string, prevType?: ScriptElementType): ScriptElementType {
  const trimmed = line.trim();
  if (!trimmed) return 'general';

  if (ELEMENT_PATTERNS.scene_heading.test(trimmed)) return 'scene_heading';
  if (ELEMENT_PATTERNS.transition.test(trimmed)) return 'transition';
  if (ELEMENT_PATTERNS.parenthetical.test(trimmed) &&
      (prevType === 'character' || prevType === 'dialogue')) return 'parenthetical';
  if (ELEMENT_PATTERNS.character.test(trimmed) && trimmed.length < 50) return 'character';
  if (prevType === 'character' || prevType === 'parenthetical') return 'dialogue';

  return 'action';
}

// Parse content into lines with types
function parseScriptLines(content: string): ScriptLine[] {
  const rawLines = content.split('\n');
  const lines: ScriptLine[] = [];
  let prevType: ScriptElementType | undefined;

  for (let i = 0; i < rawLines.length; i++) {
    const type = detectElementType(rawLines[i], prevType);
    lines.push({ type, content: rawLines[i], lineIndex: i });
    if (rawLines[i].trim()) prevType = type;
  }

  return lines;
}

// Split lines into pages
function paginateScript(lines: ScriptLine[]): ScriptPage[] {
  const pages: ScriptPage[] = [];
  let currentPageLines: ScriptLine[] = [];
  let pageNumber = 1;
  let startLineIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Scene headings shouldn't be orphaned at bottom of page
    if (currentPageLines.length >= LINES_PER_PAGE - 2 && line.type === 'scene_heading') {
      if (currentPageLines.length > 0) {
        pages.push({
          pageNumber,
          lines: currentPageLines,
          startLineIndex,
          endLineIndex: i - 1,
        });
        pageNumber++;
        startLineIndex = i;
      }
      currentPageLines = [line];
    } else if (currentPageLines.length >= LINES_PER_PAGE) {
      pages.push({
        pageNumber,
        lines: currentPageLines,
        startLineIndex,
        endLineIndex: i - 1,
      });
      pageNumber++;
      startLineIndex = i;
      currentPageLines = [line];
    } else {
      currentPageLines.push(line);
    }
  }

  if (currentPageLines.length > 0) {
    pages.push({
      pageNumber,
      lines: currentPageLines,
      startLineIndex,
      endLineIndex: lines.length - 1,
    });
  }

  return pages.length > 0 ? pages : [{
    pageNumber: 1,
    lines: [],
    startLineIndex: 0,
    endLineIndex: 0,
  }];
}

interface ScriptPageViewProps {
  content: string;
  title?: string;
  pageCount?: number;
  isEditing?: boolean;
  canEdit?: boolean;
  onContentChange?: (content: string) => void;
  onStartEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
}

const ScriptPageView: React.FC<ScriptPageViewProps> = ({
  content,
  title,
  pageCount,
  isEditing = false,
  canEdit = false,
  onContentChange,
  onStartEdit,
  onSave,
  onCancel,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(70); // Start at 70% to fit page on screen
  const [viewMode, setViewMode] = useState<'single' | 'continuous'>('continuous');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [currentElementType, setCurrentElementType] = useState<ScriptElementType>('action');

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const lineInputRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());

  // Parse and paginate content
  const lines = useMemo(() => parseScriptLines(content || ''), [content]);
  const pages = useMemo(() => paginateScript(lines), [lines]);
  const totalPages = pages.length;

  // Navigation handlers
  const goToPage = useCallback((page: number) => {
    const targetPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(targetPage);

    if (viewMode === 'continuous') {
      const pageEl = pageRefs.current.get(targetPage);
      pageEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [totalPages, viewMode]);

  // Zoom handlers
  const zoomIn = () => setZoom(z => Math.min(z + 10, 200));
  const zoomOut = () => setZoom(z => Math.max(z - 10, 50));
  const fitToWidth = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      const containerWidth = container.clientWidth - 64; // Account for padding
      const newZoom = Math.floor((containerWidth / PAGE_WIDTH_PX) * 100);
      setZoom(Math.max(50, Math.min(newZoom, 150)));
    }
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // Update content for a specific line
  const updateLine = useCallback((lineIndex: number, newContent: string) => {
    const rawLines = content.split('\n');
    rawLines[lineIndex] = newContent;
    onContentChange?.(rawLines.join('\n'));
  }, [content, onContentChange]);

  // Insert a new line after the current one
  const insertLine = useCallback((afterIndex: number, newContent: string = '') => {
    const rawLines = content.split('\n');
    rawLines.splice(afterIndex + 1, 0, newContent);
    onContentChange?.(rawLines.join('\n'));
    setEditingLineIndex(afterIndex + 1);
  }, [content, onContentChange]);

  // Delete a line
  const deleteLine = useCallback((lineIndex: number) => {
    const rawLines = content.split('\n');
    if (rawLines.length > 1) {
      rawLines.splice(lineIndex, 1);
      onContentChange?.(rawLines.join('\n'));
      setEditingLineIndex(Math.max(0, lineIndex - 1));
    }
  }, [content, onContentChange]);

  // Element type cycle order (like Celtx)
  const ELEMENT_CYCLE: ScriptElementType[] = [
    'scene_heading',
    'action',
    'character',
    'dialogue',
    'parenthetical',
    'transition',
  ];

  // Format current line as specific element type
  const formatAsElement = useCallback((lineIndex: number, elementType: ScriptElementType) => {
    const rawLines = content.split('\n');
    let lineContent = rawLines[lineIndex] || '';
    const trimmedContent = lineContent.trim();

    // Apply formatting based on element type
    switch (elementType) {
      case 'scene_heading':
        // Add INT. prefix if not already a scene heading
        if (trimmedContent && !ELEMENT_PATTERNS.scene_heading.test(trimmedContent)) {
          lineContent = 'INT. ' + trimmedContent.toUpperCase() + ' - DAY';
        } else if (trimmedContent) {
          lineContent = trimmedContent.toUpperCase();
        } else {
          lineContent = 'INT. ';
        }
        break;
      case 'action':
        // Action is plain text, just use content as-is
        lineContent = trimmedContent;
        break;
      case 'character':
        // Character names are uppercase
        lineContent = trimmedContent.toUpperCase();
        break;
      case 'dialogue':
        // Dialogue is plain text
        lineContent = trimmedContent;
        break;
      case 'parenthetical':
        // Wrap in parentheses if not already
        if (trimmedContent) {
          if (!trimmedContent.startsWith('(')) {
            lineContent = '(' + trimmedContent;
          }
          if (!lineContent.endsWith(')')) {
            lineContent = lineContent + ')';
          }
        } else {
          lineContent = '()';
        }
        break;
      case 'transition':
        // Transitions end with colon and are uppercase
        if (trimmedContent) {
          lineContent = trimmedContent.toUpperCase();
          if (!lineContent.endsWith(':')) {
            lineContent = lineContent + ':';
          }
        } else {
          lineContent = 'CUT TO:';
        }
        break;
    }

    rawLines[lineIndex] = lineContent;
    onContentChange?.(rawLines.join('\n'));
    setCurrentElementType(elementType);

    // Focus back on the input after formatting
    setTimeout(() => {
      const input = lineInputRefs.current.get(lineIndex);
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }, 0);
  }, [content, onContentChange]);

  // Cycle to next element type (Tab behavior like Celtx)
  const cycleElementType = useCallback((lineIndex: number) => {
    const currentIdx = ELEMENT_CYCLE.indexOf(currentElementType);
    const nextIdx = (currentIdx + 1) % ELEMENT_CYCLE.length;
    const nextType = ELEMENT_CYCLE[nextIdx];
    formatAsElement(lineIndex, nextType);
  }, [currentElementType, formatAsElement]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>, lineIndex: number) => {
    // Ctrl+Number shortcuts for element types
    if (e.ctrlKey || e.metaKey) {
      if (e.key === '1') { e.preventDefault(); formatAsElement(lineIndex, 'scene_heading'); }
      else if (e.key === '2') { e.preventDefault(); formatAsElement(lineIndex, 'action'); }
      else if (e.key === '3') { e.preventDefault(); formatAsElement(lineIndex, 'character'); }
      else if (e.key === '4') { e.preventDefault(); formatAsElement(lineIndex, 'dialogue'); }
      else if (e.key === '5') { e.preventDefault(); formatAsElement(lineIndex, 'parenthetical'); }
      else if (e.key === '6') { e.preventDefault(); formatAsElement(lineIndex, 'transition'); }
      else if (e.key === 's') { e.preventDefault(); onSave?.(); }
    }

    // Enter to create new line with smart element type (like Celtx)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const textarea = e.currentTarget;
      const cursorPos = textarea.selectionStart;
      const currentContent = textarea.value;

      // Determine next element type based on current type (Celtx behavior)
      let nextElementType: ScriptElementType = 'action';
      switch (currentElementType) {
        case 'scene_heading':
          nextElementType = 'action';
          break;
        case 'action':
          nextElementType = 'action';
          break;
        case 'character':
          nextElementType = 'dialogue';
          break;
        case 'dialogue':
          nextElementType = 'character'; // Ready for next speaker
          break;
        case 'parenthetical':
          nextElementType = 'dialogue';
          break;
        case 'transition':
          nextElementType = 'scene_heading';
          break;
      }

      // If cursor is at end, just create new line
      if (cursorPos === currentContent.length) {
        insertLine(lineIndex, '');
        setCurrentElementType(nextElementType);
      } else {
        // Split the line at cursor
        const before = currentContent.substring(0, cursorPos);
        const after = currentContent.substring(cursorPos);
        updateLine(lineIndex, before);
        insertLine(lineIndex, after);
      }
    }

    // Backspace at start of line to merge with previous
    if (e.key === 'Backspace') {
      const textarea = e.currentTarget;
      if (textarea.selectionStart === 0 && textarea.selectionEnd === 0 && lineIndex > 0) {
        e.preventDefault();
        const rawLines = content.split('\n');
        const prevContent = rawLines[lineIndex - 1] || '';
        const currentContent = rawLines[lineIndex] || '';
        rawLines[lineIndex - 1] = prevContent + currentContent;
        rawLines.splice(lineIndex, 1);
        onContentChange?.(rawLines.join('\n'));
        setEditingLineIndex(lineIndex - 1);
      }
    }

    // Arrow up/down to navigate lines
    if (e.key === 'ArrowUp' && lineIndex > 0) {
      e.preventDefault();
      setEditingLineIndex(lineIndex - 1);
    }
    if (e.key === 'ArrowDown' && lineIndex < lines.length - 1) {
      e.preventDefault();
      setEditingLineIndex(lineIndex + 1);
    }

    // Tab to cycle element types (like Celtx)
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Tab goes backwards
        const currentIdx = ELEMENT_CYCLE.indexOf(currentElementType);
        const prevIdx = (currentIdx - 1 + ELEMENT_CYCLE.length) % ELEMENT_CYCLE.length;
        formatAsElement(lineIndex, ELEMENT_CYCLE[prevIdx]);
      } else {
        // Tab goes forwards
        cycleElementType(lineIndex);
      }
    }
  }, [content, formatAsElement, insertLine, updateLine, onSave, onContentChange, lines.length, currentElementType, cycleElementType]);

  // Focus on editing line when it changes
  useEffect(() => {
    if (editingLineIndex !== null) {
      const input = lineInputRefs.current.get(editingLineIndex);
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
  }, [editingLineIndex]);

  // Render a single page
  const renderPage = (page: ScriptPage, isVisible: boolean = true) => {
    const scaledWidth = (PAGE_WIDTH_PX * zoom) / 100;
    const scaledHeight = (PAGE_HEIGHT_PX * zoom) / 100;

    return (
      <div
        key={page.pageNumber}
        ref={(el) => { if (el) pageRefs.current.set(page.pageNumber, el); }}
        className={cn(
          "relative bg-white shadow-lg mx-auto select-none",
          viewMode === 'continuous' && "mb-8",
          !isVisible && viewMode === 'single' && "hidden"
        )}
        style={{ width: scaledWidth, minHeight: scaledHeight }}
      >
        {/* Page content area with margins */}
        <div
          className="absolute overflow-hidden"
          style={{
            top: (MARGIN_TOP * zoom) / 100,
            left: (MARGIN_LEFT * zoom) / 100,
            right: (MARGIN_RIGHT * zoom) / 100,
            bottom: (MARGIN_BOTTOM * zoom) / 100,
            color: '#000',
            position: 'absolute',
          }}
        >
          {page.lines.map((line, idx) => {
            const globalLineIndex = page.startLineIndex + idx;
            const config = ELEMENT_CONFIG[line.type] || ELEMENT_CONFIG.general;
            const position = getElementPosition(line.type);
            const isEditingThis = isEditing && editingLineIndex === globalLineIndex;
            const fontSize = (12 * zoom) / 100;
            const lineHeight = 1.5; // Standard screenplay line height

            // Calculate scaled position values
            const scaledLeft = (position.left * zoom) / 100;
            const scaledWidth = (position.width * zoom) / 100;

            return (
              <div
                key={idx}
                className={cn(
                  "absolute cursor-text",
                  isEditingThis && "bg-yellow-100/50"
                )}
                style={{
                  ...config.textStyle,
                  left: `${scaledLeft}px`,
                  width: `${scaledWidth}px`,
                  top: `${idx * fontSize * lineHeight}px`,
                  fontSize: `${fontSize}px`,
                  lineHeight: lineHeight,
                  minHeight: `${fontSize * lineHeight}px`,
                  fontFamily: 'Courier New, Courier, monospace',
                  textAlign: position.textAlign || 'left',
                }}
                onClick={() => {
                  if (isEditing) {
                    setEditingLineIndex(globalLineIndex);
                    // Set current element type based on the line's detected type
                    const detectedType = line.type === 'general' ? 'action' : line.type;
                    setCurrentElementType(detectedType);
                  } else if (canEdit && onStartEdit) {
                    // Start editing if not already editing
                    onStartEdit();
                    setTimeout(() => setEditingLineIndex(globalLineIndex), 100);
                  }
                }}
              >
                {isEditingThis ? (
                  <textarea
                    ref={(el) => { if (el) lineInputRefs.current.set(globalLineIndex, el); }}
                    value={line.content}
                    onChange={(e) => updateLine(globalLineIndex, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, globalLineIndex)}
                    placeholder={config.placeholder}
                    className="w-full bg-transparent border-none outline-none resize-none overflow-hidden p-0 m-0"
                    style={{
                      fontSize: `${fontSize}px`,
                      lineHeight: lineHeight,
                      fontFamily: 'Courier New, Courier, monospace',
                      color: '#000',
                      textAlign: position.textAlign || 'left',
                    }}
                    rows={1}
                  />
                ) : (
                  <span>{line.content || '\u00A0'}</span>
                )}
              </div>
            );
          })}

          {/* Add new line button at end of page content */}
          {isEditing && page.pageNumber === totalPages && (
            <div
              className="absolute text-gray-500 cursor-pointer hover:text-gray-600"
              style={{
                fontSize: `${(12 * zoom) / 100}px`,
                top: `${page.lines.length * (12 * zoom / 100) * 1.5 + 8}px`,
                left: 0,
              }}
              onClick={() => insertLine(lines.length - 1, '')}
            >
              + Click to add line
            </div>
          )}
        </div>

        {/* Page number - right aligned at top like standard screenplay */}
        <div
          className="absolute text-black"
          style={{
            top: (36 * zoom) / 100,
            right: (MARGIN_RIGHT * zoom) / 100,
            fontSize: `${(12 * zoom) / 100}px`,
            fontFamily: 'Courier New, Courier, monospace',
          }}
        >
          {page.pageNumber}.
        </div>

        {/* Header on subsequent pages - title in header */}
        {page.pageNumber > 1 && title && (
          <div
            className="absolute text-black"
            style={{
              top: (36 * zoom) / 100,
              left: (MARGIN_LEFT * zoom) / 100,
              fontSize: `${(12 * zoom) / 100}px`,
              fontFamily: 'Courier New, Courier, monospace',
            }}
          >
            {title}
          </div>
        )}
      </div>
    );
  };

  // Handle page navigation with keyboard in fullscreen
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if (!isFullscreen) return;

      // Page navigation with arrow keys when not editing a specific line
      if (editingLineIndex === null) {
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          e.preventDefault();
          goToPage(currentPage - 1);
        } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
          e.preventDefault();
          goToPage(currentPage + 1);
        } else if (e.key === 'Home') {
          e.preventDefault();
          goToPage(1);
        } else if (e.key === 'End') {
          e.preventDefault();
          goToPage(totalPages);
        }
      }

      // Escape to exit fullscreen
      if (e.key === 'Escape' && isFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isFullscreen, editingLineIndex, currentPage, totalPages, goToPage]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col h-full bg-muted-gray/20",
        isFullscreen && "fixed inset-0 z-50 bg-charcoal-black"
      )}
    >
      {/* Toolbar */}
      <div className={cn(
        "flex items-center justify-between bg-charcoal-black border-b border-muted-gray/20",
        isFullscreen ? "p-4" : "p-3"
      )}>
        {/* Left: Page navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goToPage(1)}
            disabled={currentPage === 1}
            className={cn(isFullscreen ? "h-10 w-10" : "h-8 w-8")}
          >
            <ChevronsLeft className={cn(isFullscreen ? "w-5 h-5" : "w-4 h-4")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className={cn(isFullscreen ? "h-10 w-10" : "h-8 w-8")}
          >
            <ChevronLeft className={cn(isFullscreen ? "w-5 h-5" : "w-4 h-4")} />
          </Button>

          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
              className={cn(
                "text-center bg-charcoal-black border-muted-gray/30",
                isFullscreen ? "w-20 h-10 text-base" : "w-16 h-8 text-sm"
              )}
            />
            <span className={cn("text-muted-gray", isFullscreen ? "text-base" : "text-sm")}>of {totalPages}</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={cn(isFullscreen ? "h-10 w-10" : "h-8 w-8")}
          >
            <ChevronRight className={cn(isFullscreen ? "w-5 h-5" : "w-4 h-4")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goToPage(totalPages)}
            disabled={currentPage === totalPages}
            className={cn(isFullscreen ? "h-10 w-10" : "h-8 w-8")}
          >
            <ChevronsRight className={cn(isFullscreen ? "w-5 h-5" : "w-4 h-4")} />
          </Button>

          {/* Fullscreen navigation hint */}
          {isFullscreen && !isEditing && (
            <span className="text-xs text-muted-gray ml-2">← → or PageUp/PageDown to navigate</span>
          )}
        </div>

        {/* Center: Element type indicator when editing */}
        {isEditing && (
          <TooltipProvider>
            <div className={cn("flex items-center", isFullscreen ? "gap-2" : "gap-1")}>
              {(['scene_heading', 'action', 'character', 'dialogue', 'parenthetical', 'transition'] as ScriptElementType[]).map((type) => {
                const config = ELEMENT_CONFIG[type];
                const Icon = config.icon;
                const isActive = currentElementType === type;

                return (
                  <Tooltip key={type}>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isActive ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => {
                          if (editingLineIndex !== null) {
                            formatAsElement(editingLineIndex, type);
                          }
                          setCurrentElementType(type);
                        }}
                        className={cn(
                          isFullscreen ? 'h-9 px-3' : 'h-7 px-2',
                          isActive ? 'bg-accent-yellow text-charcoal-black' : 'text-muted-gray hover:text-bone-white'
                        )}
                      >
                        <Icon className={cn(isFullscreen ? "w-4 h-4" : "w-3.5 h-3.5")} />
                        {isFullscreen && <span className="ml-1 text-xs">{config.label.split(' ')[0]}</span>}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{config.label}</p>
                      <p className="text-xs text-muted-gray">{config.shortcut}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        )}

        {/* Right: Zoom and actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={zoomOut}
            disabled={zoom <= 50}
            className={cn(isFullscreen ? "h-10 w-10" : "h-8 w-8")}
          >
            <ZoomOut className={cn(isFullscreen ? "w-5 h-5" : "w-4 h-4")} />
          </Button>
          <Badge variant="outline" className={cn("justify-center", isFullscreen ? "min-w-[70px] text-base" : "min-w-[60px]")}>
            {zoom}%
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={zoomIn}
            disabled={zoom >= 200}
            className={cn(isFullscreen ? "h-10 w-10" : "h-8 w-8")}
          >
            <ZoomIn className={cn(isFullscreen ? "w-5 h-5" : "w-4 h-4")} />
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={fitToWidth}
                  className={cn(isFullscreen ? "h-10 w-10" : "h-8 w-8")}
                >
                  <Maximize className={cn(isFullscreen ? "w-5 h-5" : "w-4 h-4")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Fit to Width</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className={cn("w-px bg-muted-gray/30", isFullscreen ? "h-8 mx-3" : "h-6 mx-2")} />

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className={cn(isFullscreen ? "h-10 w-10" : "h-8 w-8")}
          >
            {isFullscreen ? (
              <Minimize2 className={cn(isFullscreen ? "w-5 h-5" : "w-4 h-4")} />
            ) : (
              <Maximize2 className={cn(isFullscreen ? "w-5 h-5" : "w-4 h-4")} />
            )}
          </Button>

          {isEditing ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className={cn(isFullscreen ? "h-10 px-4" : "h-8")}
              >
                <X className={cn(isFullscreen ? "w-5 h-5 mr-2" : "w-4 h-4 mr-1")} />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={onSave}
                className={cn(
                  "bg-accent-yellow text-charcoal-black hover:bg-bone-white",
                  isFullscreen ? "h-10 px-4" : "h-8"
                )}
              >
                <Save className={cn(isFullscreen ? "w-5 h-5 mr-2" : "w-4 h-4 mr-1")} />
                Save
              </Button>
            </>
          ) : canEdit && onStartEdit && (
            <Button
              size="sm"
              onClick={onStartEdit}
              className={cn(
                "bg-accent-yellow text-charcoal-black hover:bg-bone-white",
                isFullscreen ? "h-10 px-4" : "h-8"
              )}
            >
              <Edit className={cn(isFullscreen ? "w-5 h-5 mr-2" : "w-4 h-4 mr-1")} />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Keyboard shortcuts help when editing */}
      {isEditing && (
        <div className={cn(
          "flex items-center gap-4 bg-charcoal-black/50 border-b border-muted-gray/20 text-muted-gray flex-wrap",
          isFullscreen ? "px-6 py-3 text-sm" : "px-4 py-2 text-xs"
        )}>
          <span className="font-medium">Shortcuts:</span>
          <span>Tab: Cycle element types →</span>
          <span>Shift+Tab: Cycle ←</span>
          <span>Ctrl+1-6: Direct element</span>
          <span>Enter: New line (smart type)</span>
          <span>↑↓: Navigate lines</span>
          <span>Ctrl+S: Save</span>
          {isFullscreen && <span>Esc: Exit fullscreen</span>}
        </div>
      )}

      {/* Page view area */}
      <ScrollArea className="flex-1">
        <div className={cn("py-8", viewMode === 'single' && "flex items-start justify-center min-h-full")}>
          {viewMode === 'single'
            ? renderPage(pages[currentPage - 1] || pages[0], true)
            : pages.map((page) => renderPage(page, true))
          }
        </div>
      </ScrollArea>

      {/* Footer status bar */}
      <div className={cn(
        "flex items-center justify-between bg-charcoal-black border-t border-muted-gray/20 text-muted-gray",
        isFullscreen ? "px-6 py-3 text-sm" : "px-4 py-2 text-xs"
      )}>
        <div>
          {lines.length} lines | {totalPages} pages
          {isEditing && editingLineIndex !== null && (
            <span className="ml-2">| Editing line {editingLineIndex + 1}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {isFullscreen && !isEditing && (
            <span className="text-muted-gray/60">Click page to start editing</span>
          )}
          <span>Page {currentPage} of {totalPages}</span>
        </div>
      </div>
    </div>
  );
};

export default ScriptPageView;
