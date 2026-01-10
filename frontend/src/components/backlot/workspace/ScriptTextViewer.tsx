/**
 * ScriptTextViewer - Read-only paginated screenplay viewer
 *
 * Uses IDENTICAL page-based rendering as ScriptPageView (the editor's Page mode).
 * White pages with black text, zoom controls, page navigation.
 * Supports breakdown highlights overlaid on text.
 * Allows creating new highlights via text selection.
 */
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ZoomIn,
  ZoomOut,
  Maximize,
  Maximize2,
  Minimize2,
  FileText,
  AlertTriangle,
  Highlighter,
  X,
  StickyNote,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BacklotScriptHighlightBreakdown,
  BacklotBreakdownItemType,
  BREAKDOWN_HIGHLIGHT_COLORS,
  BREAKDOWN_ITEM_TYPE_LABELS,
  TitlePageData,
  BacklotScriptPageNote,
  ScriptPageNoteSummary,
  SCRIPT_PAGE_NOTE_TYPE_LABELS,
} from '@/types/backlot';
import { ScriptTitlePage } from './ScriptTitlePage';

// Screenplay page constants (industry standard at 72 DPI) - matching ScriptPageView
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
const CHAR_LEFT = 266;     // 3.7" - Character name position
const DIALOGUE_LEFT = 180; // 2.5" - Dialogue start
const DIALOGUE_RIGHT = 432; // 6" - Dialogue end
const PAREN_LEFT = 223;    // 3.1" - Parenthetical start
const PAREN_RIGHT = 403;   // 5.6" - Parenthetical end

// Element types
type ScriptElementType =
  | 'scene_heading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'general'
  | 'title'
  | 'author'
  | 'contact'
  | 'draft_info'
  | 'copyright'
  | 'title_page_text';

interface ScriptLine {
  type: ScriptElementType;
  content: string;
  lineIndex: number;
  charOffset: number; // Character offset from start of document for highlights
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
  transition: /^(FADE IN:|FADE OUT:|FADE TO:|CUT TO:|DISSOLVE TO:|DISSOLVE:|SMASH CUT TO:|SMASH CUT:|MATCH CUT TO:|MATCH CUT:|JUMP CUT TO:|JUMP CUT:|TIME CUT:|IRIS IN:|IRIS OUT:|WIPE TO:|.+\s+TO:|THE END\.?)[\s\S]*/i,
  character: /^[A-Z][A-Z0-9\s\-'\.]+(\s*\(V\.O\.\)|\s*\(O\.S\.\)|\s*\(O\.C\.\)|\s*\(CONT'D\))?$/,
  parenthetical: /^\(.+\)$/,
  author: /^(written\s+by|screenplay\s+by|teleplay\s+by|story\s+by|by\s*$)/i,
  draft_info: /^(draft|revision|version|\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  copyright: /^(©|copyright|\(c\))/i,
  contact: /(@[\w.-]+\.\w+|\(\d{3}\)\s*\d{3}[-.]?\d{4}|\d{3}[-.]?\d{3}[-.]?\d{4}|agent:|manager:|represented\s+by)/i,
};

// Element text styling (positioning handled separately)
const ELEMENT_TEXT_STYLES: Record<ScriptElementType, React.CSSProperties> = {
  scene_heading: { fontWeight: 'bold', textTransform: 'uppercase' },
  action: {},
  character: { textTransform: 'uppercase' },
  dialogue: {},
  parenthetical: {},
  transition: { textTransform: 'uppercase' },
  general: {},
  title: { fontWeight: 'bold', textTransform: 'uppercase', fontSize: '18px' },
  author: {},
  contact: { fontSize: '10px' },
  draft_info: { fontSize: '10px' },
  copyright: { fontSize: '10px' },
  title_page_text: {},
};

// Calculate element positioning based on type
function getElementPosition(type: ScriptElementType): { left: number; width: number; textAlign?: 'left' | 'right' | 'center' } {
  switch (type) {
    case 'scene_heading':
    case 'action':
    case 'general':
      return { left: 0, width: CONTENT_WIDTH };
    case 'character':
      return { left: CHAR_LEFT - MARGIN_LEFT, width: CONTENT_WIDTH - (CHAR_LEFT - MARGIN_LEFT) };
    case 'dialogue':
      return { left: DIALOGUE_LEFT - MARGIN_LEFT, width: DIALOGUE_RIGHT - DIALOGUE_LEFT };
    case 'parenthetical':
      return { left: PAREN_LEFT - MARGIN_LEFT, width: PAREN_RIGHT - PAREN_LEFT };
    case 'transition':
      return { left: 0, width: CONTENT_WIDTH, textAlign: 'right' };
    case 'title':
    case 'author':
    case 'draft_info':
    case 'copyright':
    case 'title_page_text':
      return { left: 0, width: CONTENT_WIDTH, textAlign: 'center' };
    case 'contact':
      return { left: 0, width: CONTENT_WIDTH, textAlign: 'left' };
    default:
      return { left: 0, width: CONTENT_WIDTH };
  }
}

// Detect element type using indent-based detection (matches backend output)
function detectElementType(line: string, prevType?: ScriptElementType, isTitlePage?: boolean): ScriptElementType {
  const leadingSpaces = line.length - line.trimStart().length;
  const trimmed = line.trim();

  if (!trimmed) return 'general';

  if (isTitlePage) {
    const isCentered = leadingSpaces >= 15;
    if (ELEMENT_PATTERNS.copyright.test(trimmed)) return 'copyright';
    if (ELEMENT_PATTERNS.author.test(trimmed)) return 'author';
    if (ELEMENT_PATTERNS.draft_info.test(trimmed)) return 'draft_info';
    if (ELEMENT_PATTERNS.contact.test(trimmed)) return 'contact';
    if ((trimmed === trimmed.toUpperCase() && trimmed.length < 80 && !ELEMENT_PATTERNS.scene_heading.test(trimmed)) ||
        (isCentered && trimmed === trimmed.toUpperCase() && !ELEMENT_PATTERNS.scene_heading.test(trimmed))) {
      return 'title';
    }
    if (isCentered) return 'title_page_text';
    return 'title_page_text';
  }

  // RIGHT-ALIGNED TRANSITIONS (35+ chars indent)
  if (leadingSpaces >= 35) return 'transition';

  // CENTERED CHARACTER NAME (15-30 chars indent, ALL CAPS)
  if (leadingSpaces >= 15 && leadingSpaces <= 30) {
    const namePart = trimmed.replace(/\s*\([^)]+\)\s*$/, '');
    if (namePart === namePart.toUpperCase() && namePart.length > 1 && namePart.length < 50) {
      return 'character';
    }
  }

  // PARENTHETICAL (12-18 chars indent)
  if (leadingSpaces >= 12 && leadingSpaces <= 18 && trimmed.startsWith('(')) {
    if (ELEMENT_PATTERNS.parenthetical.test(trimmed)) return 'parenthetical';
  }

  // DIALOGUE (8-14 chars indent, after character/parenthetical/dialogue)
  if (leadingSpaces >= 8 && leadingSpaces <= 14) {
    if (prevType === 'character' || prevType === 'parenthetical' || prevType === 'dialogue') {
      return 'dialogue';
    }
  }

  // LEFT-ALIGNED (0-8 chars indent)
  if (leadingSpaces < 8) {
    if (ELEMENT_PATTERNS.scene_heading.test(trimmed)) return 'scene_heading';
    if (ELEMENT_PATTERNS.transition.test(trimmed)) return 'transition';
    return 'action';
  }

  // Fallback pattern matching
  if (ELEMENT_PATTERNS.scene_heading.test(trimmed)) return 'scene_heading';
  if (ELEMENT_PATTERNS.transition.test(trimmed)) return 'transition';
  if (ELEMENT_PATTERNS.parenthetical.test(trimmed) &&
      (prevType === 'character' || prevType === 'dialogue')) return 'parenthetical';
  if (ELEMENT_PATTERNS.character.test(trimmed) && trimmed.length < 50) return 'character';
  if (prevType === 'character' || prevType === 'parenthetical') return 'dialogue';

  return 'action';
}

// Check if a line is just a page number (e.g., "1.", "2.", "123.")
// These are often included in PDF imports and should be filtered out
// since we render our own page numbers
function isPageNumberLine(line: string): boolean {
  const trimmed = line.trim();
  return /^\d{1,3}\.$/.test(trimmed);
}

// Parse content into lines with types and character offsets
function parseScriptLines(content: string): ScriptLine[] {
  const rawLines = content.split('\n');
  const lines: ScriptLine[] = [];
  let prevType: ScriptElementType | undefined;
  let currentOffset = 0;
  let skipNextBlankLines = false;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const isBlank = !line.trim();

    // Skip standalone page number lines (from PDF imports)
    // since we render our own page numbers
    if (isPageNumberLine(line)) {
      currentOffset += line.length + 1;
      skipNextBlankLines = true; // Also skip blank lines after page numbers
      continue;
    }

    // Skip blank lines that follow page numbers
    if (skipNextBlankLines && isBlank) {
      currentOffset += line.length + 1;
      continue;
    }

    // Stop skipping blank lines once we hit actual content
    if (!isBlank) {
      skipNextBlankLines = false;
    }

    const type = detectElementType(line, prevType, false);
    lines.push({
      type,
      content: line,
      lineIndex: i,
      charOffset: currentOffset,
    });
    if (line.trim()) prevType = type;
    currentOffset += line.length + 1; // +1 for newline
  }

  return lines;
}

// Split lines into pages
function paginateScript(lines: ScriptLine[]): ScriptPage[] {
  const pages: ScriptPage[] = [];
  let currentPageLines: ScriptLine[] = [];
  let pageNumber = 1; // Content always starts at page 1 (title page is unnumbered)
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

interface ScriptTextViewerProps {
  content: string;
  title: string;
  isLive?: boolean;
  titlePageData?: TitlePageData | null;
  highlights?: BacklotScriptHighlightBreakdown[];
  showHighlights?: boolean;
  onHighlightClick?: (highlight: BacklotScriptHighlightBreakdown) => void;
  onCreateHighlight?: (text: string, startOffset: number, endOffset: number, category: BacklotBreakdownItemType) => void;
  pageNotes?: BacklotScriptPageNote[];
  notesSummary?: ScriptPageNoteSummary[];
  showNotes?: boolean;
  onNoteClick?: (note: BacklotScriptPageNote) => void;
  onAddNote?: (pageNumber: number) => void;
  canEdit?: boolean;
}

// Selection state for highlight creation
interface TextSelection {
  text: string;
  startOffset: number;
  endOffset: number;
  anchorRect: DOMRect | null;
}

// Highlight category picker
const HIGHLIGHT_CATEGORIES: BacklotBreakdownItemType[] = [
  'cast', 'background', 'stunt', 'location', 'prop', 'set_dressing',
  'wardrobe', 'makeup', 'sfx', 'vfx', 'vehicle', 'animal', 'greenery',
  'special_equipment', 'sound', 'music'
];

interface HighlightPickerProps {
  selection: TextSelection;
  onSelect: (category: BacklotBreakdownItemType) => void;
  onClose: () => void;
}

const HighlightPicker: React.FC<HighlightPickerProps> = ({ selection, onSelect, onClose }) => {
  return (
    <div className="p-2 bg-charcoal-black border border-muted-gray/30 rounded-lg shadow-xl">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Highlighter className="w-4 h-4 text-accent-yellow" />
          <span className="text-sm font-medium text-bone-white">Add Breakdown Item</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-gray" onClick={onClose}>
          <X className="w-3 h-3" />
        </Button>
      </div>
      <div className="text-xs text-muted-gray mb-2 max-w-[200px] truncate">
        "{selection.text}"
      </div>
      <div className="grid grid-cols-4 gap-1">
        {HIGHLIGHT_CATEGORIES.map((category) => {
          const color = BREAKDOWN_HIGHLIGHT_COLORS[category] || '#808080';
          return (
            <TooltipProvider key={category}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="w-8 h-8 rounded border border-muted-gray/30 hover:border-white transition-colors"
                    style={{ backgroundColor: `${color}60` }}
                    onClick={() => onSelect(category)}
                  />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {BREAKDOWN_ITEM_TYPE_LABELS[category] || category}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
};

const ScriptTextViewer: React.FC<ScriptTextViewerProps> = ({
  content,
  title,
  isLive = false,
  titlePageData,
  highlights = [],
  showHighlights = true,
  onHighlightClick,
  onCreateHighlight,
  pageNotes = [],
  showNotes = false,
  onNoteClick,
  onAddNote,
  canEdit = false,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(70); // Start at 70% to fit page on screen
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Parse titlePageData if it's a JSON string (API might return it as string)
  const parsedTitlePageData = useMemo(() => {
    if (!titlePageData) return null;
    if (typeof titlePageData === 'string') {
      try {
        return JSON.parse(titlePageData) as TitlePageData;
      } catch {
        return null;
      }
    }
    return titlePageData;
  }, [titlePageData]);

  // Parse and paginate content
  const lines = useMemo(() => parseScriptLines(content || ''), [content]);
  const pages = useMemo(() => paginateScript(lines), [lines]);
  // Total is just the content pages (title page is unnumbered and shown separately)
  const totalPages = pages.length;

  // Navigation handlers
  const goToPage = useCallback((page: number) => {
    const targetPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(targetPage);
    const pageEl = pageRefs.current.get(targetPage);
    pageEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [totalPages]);

  // Zoom handlers
  const zoomIn = () => setZoom(z => Math.min(z + 10, 200));
  const zoomOut = () => setZoom(z => Math.max(z - 10, 50));
  const fitToWidth = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      const containerWidth = container.clientWidth - 64;
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

  // Handle text selection for creating highlights
  const handleMouseUp = useCallback(() => {
    if (!onCreateHighlight) return;

    const windowSelection = window.getSelection();
    if (!windowSelection || windowSelection.isCollapsed) {
      setSelection(null);
      setShowPicker(false);
      return;
    }

    const selectedText = windowSelection.toString().trim();
    if (!selectedText || selectedText.length < 2) {
      setSelection(null);
      setShowPicker(false);
      return;
    }

    // Find the start element with data-char-offset
    const range = windowSelection.getRangeAt(0);
    let startEl = range.startContainer.parentElement;
    while (startEl && !startEl.hasAttribute('data-char-offset')) {
      startEl = startEl.parentElement;
    }

    if (!startEl) return;

    const lineOffset = parseInt(startEl.getAttribute('data-char-offset') || '0', 10);
    const startOffset = lineOffset + range.startOffset;
    const endOffset = startOffset + selectedText.length;
    const rect = range.getBoundingClientRect();

    setSelection({
      text: selectedText,
      startOffset,
      endOffset,
      anchorRect: rect,
    });
    setShowPicker(true);
  }, [onCreateHighlight]);

  const handleCategorySelect = useCallback((category: BacklotBreakdownItemType) => {
    if (selection && onCreateHighlight) {
      onCreateHighlight(selection.text, selection.startOffset, selection.endOffset, category);
      window.getSelection()?.removeAllRanges();
      setSelection(null);
      setShowPicker(false);
    }
  }, [selection, onCreateHighlight]);

  const handleClosePicker = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
    setShowPicker(false);
  }, []);

  // Render text with highlight overlays
  const renderTextWithHighlights = useCallback((
    text: string,
    lineCharOffset: number,
    fontSize: number,
  ): React.ReactNode => {
    if (!showHighlights || highlights.length === 0) {
      return text || '\u00A0';
    }

    const lineEndOffset = lineCharOffset + text.length;
    const lineHighlights = highlights.filter(h =>
      h.start_offset < lineEndOffset && h.end_offset > lineCharOffset
    );

    if (lineHighlights.length === 0) {
      return text || '\u00A0';
    }

    lineHighlights.sort((a, b) => a.start_offset - b.start_offset);
    const segments: React.ReactNode[] = [];
    let currentPos = 0;

    for (const highlight of lineHighlights) {
      const highlightStartInLine = Math.max(0, highlight.start_offset - lineCharOffset);
      const highlightEndInLine = Math.min(text.length, highlight.end_offset - lineCharOffset);

      if (highlightStartInLine > currentPos) {
        segments.push(
          <span key={`text-${currentPos}`}>{text.slice(currentPos, highlightStartInLine)}</span>
        );
      }

      if (highlightEndInLine > highlightStartInLine) {
        const highlightColor = BREAKDOWN_HIGHLIGHT_COLORS[highlight.category] || '#FFFF00';
        const isStale = highlight.status === 'stale';

        const highlightContent = (
          <span
            key={`highlight-${highlight.id}-${highlightStartInLine}`}
            className={cn(
              'cursor-pointer transition-opacity hover:opacity-80',
              isStale && 'ring-2 ring-yellow-500 ring-offset-1'
            )}
            style={{
              backgroundColor: `${highlightColor}40`,
              borderBottom: `2px solid ${highlightColor}`,
            }}
            onClick={() => onHighlightClick?.(highlight)}
          >
            {text.slice(highlightStartInLine, highlightEndInLine)}
          </span>
        );

        if (isStale) {
          segments.push(
            <TooltipProvider key={`tooltip-${highlight.id}`}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>{highlightContent}</span>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-yellow-500" />
                    <span>Highlight may have moved - click to review</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        } else {
          segments.push(highlightContent);
        }

        currentPos = highlightEndInLine;
      }
    }

    if (currentPos < text.length) {
      segments.push(<span key={`text-end-${currentPos}`}>{text.slice(currentPos)}</span>);
    }

    return segments.length > 0 ? segments : (text || '\u00A0');
  }, [highlights, showHighlights, onHighlightClick]);

  // Render a single page - matching ScriptPageView exactly
  const renderPage = (page: ScriptPage) => {
    const scaledWidth = (PAGE_WIDTH_PX * zoom) / 100;
    const scaledHeight = (PAGE_HEIGHT_PX * zoom) / 100;
    const fontSize = (12 * zoom) / 100;
    const lineHeight = 1.5;

    return (
      <div
        key={page.pageNumber}
        ref={(el) => { if (el) pageRefs.current.set(page.pageNumber, el); }}
        className="relative bg-white shadow-lg mx-auto mb-8 select-text"
        style={{ width: scaledWidth, minHeight: scaledHeight }}
        onMouseUp={handleMouseUp}
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
          }}
        >
          {page.lines.map((line, idx) => {
            const textStyle = ELEMENT_TEXT_STYLES[line.type] || {};
            const position = getElementPosition(line.type);
            const scaledLeft = (position.left * zoom) / 100;
            const scaledLineWidth = (position.width * zoom) / 100;

            return (
              <div
                key={idx}
                className="absolute"
                style={{
                  ...textStyle,
                  left: `${scaledLeft}px`,
                  width: `${scaledLineWidth}px`,
                  top: `${idx * fontSize * lineHeight}px`,
                  fontSize: `${fontSize}px`,
                  lineHeight: lineHeight,
                  minHeight: `${fontSize * lineHeight}px`,
                  fontFamily: 'Courier New, Courier, monospace',
                  textAlign: position.textAlign || 'left',
                }}
                data-char-offset={line.charOffset}
              >
                {renderTextWithHighlights(line.content, line.charOffset, fontSize)}
              </div>
            );
          })}
        </div>

        {/* Page number - right aligned at top */}
        <div
          className="absolute text-black"
          style={{
            top: (36 * zoom) / 100,
            right: (MARGIN_RIGHT * zoom) / 100,
            fontSize: `${fontSize}px`,
            fontFamily: 'Courier New, Courier, monospace',
          }}
        >
          {page.pageNumber}.
        </div>

        {/* Header on subsequent pages */}
        {page.pageNumber > 1 && title && (
          <div
            className="absolute text-black"
            style={{
              top: (36 * zoom) / 100,
              left: (MARGIN_LEFT * zoom) / 100,
              fontSize: `${fontSize}px`,
              fontFamily: 'Courier New, Courier, monospace',
            }}
          >
            {title}
          </div>
        )}
      </div>
    );
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFullscreen) return;
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
      } else if (e.key === 'Escape') {
        document.exitFullscreen().catch(() => {});
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, currentPage, totalPages, goToPage]);

  if (!content && !parsedTitlePageData) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-gray">
        <FileText className="w-12 h-12 mb-4 opacity-40" />
        <p className="text-bone-white text-lg mb-2">No Text Content</p>
        <p className="text-sm">Extract text from a PDF or use the Editor to add content.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col h-full bg-muted-gray/20",
        isFullscreen && "fixed inset-0 z-50 bg-charcoal-black"
      )}
    >
      {/* Toolbar - matching ScriptPageView */}
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

          {isLive && (
            <Badge variant="outline" className="ml-2 text-xs text-green-400 border-green-500/30">
              Live
            </Badge>
          )}
        </div>

        {/* Center: Title */}
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-gray" />
          <span className={cn("text-bone-white truncate max-w-[200px]", isFullscreen ? "text-base" : "text-sm")}>{title}</span>
        </div>

        {/* Right: Zoom and actions */}
        <div className="flex items-center gap-2">
          {/* Add Note button */}
          {showNotes && canEdit && onAddNote && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-gray hover:text-blue-400"
              onClick={() => onAddNote(currentPage)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Note
            </Button>
          )}

          <div className={cn("w-px bg-muted-gray/30", isFullscreen ? "h-8" : "h-6")} />

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

          <div className={cn("w-px bg-muted-gray/30", isFullscreen ? "h-8" : "h-6")} />

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
        </div>
      </div>

      {/* Page view area */}
      <ScrollArea className="flex-1">
        <div className="py-8">
          {/* Title Page (if present) - no page number per screenplay standard */}
          {parsedTitlePageData && (
            <div
              className="relative bg-white shadow-lg mx-auto mb-8"
              style={{
                width: (PAGE_WIDTH_PX * zoom) / 100,
                height: (PAGE_HEIGHT_PX * zoom) / 100,
              }}
            >
              <ScriptTitlePage
                data={parsedTitlePageData}
                className="w-full h-full"
                zoom={zoom}
              />
            </div>
          )}

          {/* Script pages */}
          {pages.map((page) => renderPage(page))}
        </div>
      </ScrollArea>

      {/* Highlight Creation Popover */}
      {showPicker && selection && selection.anchorRect && (
        <div
          className="fixed z-50"
          style={{
            left: selection.anchorRect.left + selection.anchorRect.width / 2 - 120,
            top: selection.anchorRect.bottom + 8,
          }}
        >
          <HighlightPicker
            selection={selection}
            onSelect={handleCategorySelect}
            onClose={handleClosePicker}
          />
        </div>
      )}

      {/* Notes Panel */}
      {showNotes && pageNotes.length > 0 && (
        <div className="border-t border-muted-gray/20 bg-charcoal-black/50 max-h-[200px] overflow-y-auto">
          <div className="p-2">
            <div className="flex items-center gap-2 mb-2">
              <StickyNote className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-bone-white">
                Script Notes ({pageNotes.length})
              </span>
            </div>
            <div className="space-y-2">
              {pageNotes.map((note) => (
                <div
                  key={note.id}
                  className={cn(
                    'p-2 rounded border cursor-pointer transition-colors',
                    note.resolved
                      ? 'bg-green-500/10 border-green-500/20 hover:border-green-500/40'
                      : 'bg-blue-500/10 border-blue-500/20 hover:border-blue-500/40'
                  )}
                  onClick={() => onNoteClick?.(note)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {SCRIPT_PAGE_NOTE_TYPE_LABELS[note.note_type] || note.note_type}
                      </Badge>
                      <span className="text-xs text-muted-gray">Page {note.page_number}</span>
                    </div>
                    {note.resolved && (
                      <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">
                        Resolved
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-bone-white line-clamp-2">{note.note_text}</p>
                  {note.author && (
                    <p className="text-xs text-muted-gray mt-1">
                      — {note.author.display_name || 'Unknown'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer status bar */}
      <div className={cn(
        "flex items-center justify-between bg-charcoal-black border-t border-muted-gray/20 text-muted-gray",
        isFullscreen ? "px-6 py-3 text-sm" : "px-4 py-2 text-xs"
      )}>
        <div>
          {lines.length} lines | {totalPages} pages
          {onCreateHighlight && <span className="ml-2">| Select text to create highlights</span>}
        </div>
        <div className="flex items-center gap-4">
          {isFullscreen && <span className="text-muted-gray/60">← → or PageUp/PageDown to navigate</span>}
          <span>Page {currentPage} of {totalPages}</span>
        </div>
      </div>
    </div>
  );
};

export default ScriptTextViewer;
