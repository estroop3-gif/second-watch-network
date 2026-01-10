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
  List,
  ChevronDown,
  ChevronUp,
  Film,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BacklotScriptHighlightBreakdown,
  BacklotBreakdownItemType,
  BacklotHighlightStatus,
  BREAKDOWN_HIGHLIGHT_COLORS,
  BREAKDOWN_ITEM_TYPE_LABELS,
  TitlePageData,
  BacklotScriptPageNote,
  ScriptPageNoteSummary,
  SCRIPT_PAGE_NOTE_TYPE_LABELS,
} from '@/types/backlot';
import { ScriptTitlePage } from './ScriptTitlePage';
import ScriptViewerSidebar, { SidebarMode } from './ScriptViewerSidebar';

// Screenplay page constants (industry standard at 72 DPI) - matching ScriptPageView
// Page has 792px height - 72px top - 72px bottom = 648px for content
// At 12px font with 1.0 line-height = 12px per line (matches PDF export)
// Max lines = 648 / 12 = 54 lines per page
const LINES_PER_PAGE = 54;
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

// Import centralized screenplay formatting
import {
  ScriptElementType,
  ELEMENT_PATTERNS,
  detectElementType,
  FORGIVING_CONFIG,
  parseSceneFromContent,
  getSceneForOffset,
  formatSluglineForDisplay,
  ParsedScene,
} from '@/utils/scriptFormatting';

// Local interfaces for text viewer (with charOffset for highlights)
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

// Note: detectElementType is now imported from scriptFormatting with FORGIVING_CONFIG
// for imported content display (uses indent + pattern detection)

// Parse content into lines with types and character offsets
// Note: Page number filtering is handled by the backend parser during import
function parseScriptLines(content: string): ScriptLine[] {
  const rawLines = content.split('\n');
  const lines: ScriptLine[] = [];
  let prevType: ScriptElementType | undefined;
  let currentOffset = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    // Use FORGIVING_CONFIG for imported content (indent + pattern detection)
    // Pass the full line WITH indentation for detection
    const type = detectElementType(line, undefined, prevType, false, FORGIVING_CONFIG);

    // IMPORTANT: Store trimmed content since positioning is handled by CSS marginLeft
    // The original line has indentation which would double-indent if we kept it
    const trimmedContent = line.trim();

    lines.push({
      type,
      content: trimmedContent,
      lineIndex: i,
      charOffset: currentOffset,
    });
    if (trimmedContent) prevType = type;
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

// Scene info passed when creating a highlight
export interface HighlightSceneInfo {
  sceneNumber: string;
  slugline: string;
}

interface ScriptTextViewerProps {
  content: string;
  title: string;
  isLive?: boolean;
  titlePageData?: TitlePageData | null;
  highlights?: BacklotScriptHighlightBreakdown[];
  showHighlights?: boolean;
  onHighlightClick?: (highlight: BacklotScriptHighlightBreakdown) => void;
  onCreateHighlight?: (
    text: string,
    startOffset: number,
    endOffset: number,
    category: BacklotBreakdownItemType,
    scene?: HighlightSceneInfo,
    notes?: string,
    pageNumber?: number
  ) => void;
  pageNotes?: BacklotScriptPageNote[];
  notesSummary?: ScriptPageNoteSummary[];
  showNotes?: boolean;
  onNoteClick?: (note: BacklotScriptPageNote) => void;
  onAddNote?: (pageNumber: number) => void;
  canEdit?: boolean;
  // Sidebar props for highlight editing
  scriptId?: string;
  dbScenes?: { id: string; scene_number: string; slugline?: string }[];
  onUpdateHighlight?: (highlightId: string, updates: {
    category?: BacklotBreakdownItemType;
    scene_id?: string | null;
    suggested_label?: string;
    status?: BacklotHighlightStatus;
  }) => void;
  onDeleteHighlight?: (highlightId: string) => void;
  onViewBreakdownItem?: (breakdownItemId: string) => void;
  // For scrolling to a specific highlight from other tabs
  targetHighlightId?: string | null;
}

// Selection state for highlight creation
interface TextSelection {
  text: string;
  startOffset: number;
  endOffset: number;
  anchorRect: DOMRect | null;
  scene: ParsedScene | null; // Auto-detected scene for the selection
}

// Highlight category picker - organized by type
interface CategoryGroup {
  label: string;
  categories: BacklotBreakdownItemType[];
}

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    label: 'CAST & TALENT',
    categories: ['cast', 'background', 'stunt'],
  },
  {
    label: 'PROPS & WARDROBE',
    categories: ['prop', 'wardrobe', 'set_dressing'],
  },
  {
    label: 'EFFECTS & MAKEUP',
    categories: ['makeup', 'sfx', 'vfx'],
  },
  {
    label: 'LOCATIONS & SETS',
    categories: ['location', 'greenery'],
  },
  {
    label: 'VEHICLES & ANIMALS',
    categories: ['vehicle', 'animal', 'special_equipment'],
  },
  {
    label: 'SOUND',
    categories: ['sound', 'music'],
  },
];

interface HighlightPickerProps {
  selection: TextSelection;
  onSelect: (category: BacklotBreakdownItemType) => void;
  onClose: () => void;
}

const HighlightPicker: React.FC<HighlightPickerProps> = ({ selection, onSelect, onClose }) => {
  const sceneDisplay = selection.scene
    ? `Scene ${selection.scene.sceneNumber}: ${formatSluglineForDisplay(selection.scene.slugline)}`
    : 'Before first scene';

  return (
    <div className="p-3 bg-charcoal-black border border-muted-gray/30 rounded-lg shadow-xl min-w-[300px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-muted-gray/20">
        <div className="flex items-center gap-2">
          <Highlighter className="w-4 h-4 text-accent-yellow" />
          <span className="text-sm font-medium text-bone-white">Add Breakdown Item</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-gray hover:text-bone-white" onClick={onClose}>
          <X className="w-3 h-3" />
        </Button>
      </div>

      {/* Selected text preview */}
      <div className="text-xs mb-2 p-2 bg-muted-gray/10 rounded border border-muted-gray/20">
        <span className="text-muted-gray">Selected: </span>
        <span className="text-bone-white font-medium">"{selection.text.length > 40 ? selection.text.slice(0, 40) + '...' : selection.text}"</span>
      </div>

      {/* Detected scene */}
      <div className="text-xs mb-3 p-2 bg-blue-500/10 rounded border border-blue-500/20">
        <span className="text-blue-400">Scene: </span>
        <span className="text-bone-white font-medium truncate block">{sceneDisplay}</span>
      </div>

      {/* Category groups */}
      <div className="space-y-2 max-h-[280px] overflow-y-auto">
        {CATEGORY_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="text-[10px] font-semibold text-muted-gray/70 mb-1 tracking-wider">
              {group.label}
            </div>
            <div className="grid grid-cols-2 gap-1">
              {group.categories.map((category) => {
                const color = BREAKDOWN_HIGHLIGHT_COLORS[category] || '#808080';
                const label = BREAKDOWN_ITEM_TYPE_LABELS[category] || category;
                return (
                  <button
                    key={category}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-muted-gray/20 transition-colors group"
                    onClick={() => onSelect(category)}
                  >
                    <div
                      className="w-4 h-4 rounded-full border-2 flex-shrink-0 group-hover:scale-110 transition-transform"
                      style={{
                        backgroundColor: `${color}40`,
                        borderColor: color,
                      }}
                    />
                    <span className="text-xs text-bone-white group-hover:text-accent-yellow transition-colors truncate">
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Helper text */}
      <div className="mt-3 pt-2 border-t border-muted-gray/20 text-[10px] text-muted-gray/60 text-center">
        Click a category to create breakdown item in detected scene
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
  // Sidebar props
  scriptId,
  dbScenes = [],
  onUpdateHighlight,
  onDeleteHighlight,
  onViewBreakdownItem,
  targetHighlightId,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(70); // Start at 70% to fit page on screen
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('hidden');
  const [selectedHighlight, setSelectedHighlight] = useState<BacklotScriptHighlightBreakdown | null>(null);
  const [showScenePanel, setShowScenePanel] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());

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

  // Parse scenes for breakdown integration
  const scenes = useMemo(() => parseSceneFromContent(content || ''), [content]);

  // Navigation handlers
  const goToPage = useCallback((page: number) => {
    const targetPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(targetPage);
    const pageEl = pageRefs.current.get(targetPage);
    pageEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [totalPages]);

  // Jump to a scene by finding the page it's on
  const goToScene = useCallback((scene: ParsedScene) => {
    // Find which page contains this scene's line number
    const pageWithScene = pages.find(
      (page) => scene.lineNumber >= page.startLineIndex && scene.lineNumber <= page.endLineIndex
    );
    if (pageWithScene) {
      goToPage(pageWithScene.pageNumber);
    }
  }, [pages, goToPage]);

  // Find which page contains a character offset
  const getPageForCharOffset = useCallback((charOffset: number): number | null => {
    for (const page of pages) {
      // Get the first and last line's character offsets for this page
      if (page.lines.length === 0) continue;
      const firstLine = page.lines[0];
      const lastLine = page.lines[page.lines.length - 1];
      const pageStartOffset = firstLine.charOffset;
      // End offset is the last line's offset + its content length
      const pageEndOffset = lastLine.charOffset + lastLine.content.length;

      if (charOffset >= pageStartOffset && charOffset <= pageEndOffset) {
        return page.pageNumber;
      }
    }
    // If not found, return the last page (selection might be after last char)
    return pages.length > 0 ? pages[pages.length - 1].pageNumber : null;
  }, [pages]);

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
      // Don't close sidebar if in edit mode
      if (sidebarMode === 'create') {
        setSelection(null);
        setSidebarMode('hidden');
      }
      return;
    }

    const selectedText = windowSelection.toString().trim();
    if (!selectedText || selectedText.length < 2) {
      if (sidebarMode === 'create') {
        setSelection(null);
        setSidebarMode('hidden');
      }
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

    // Auto-detect which scene this selection belongs to
    const detectedScene = getSceneForOffset(scenes, startOffset);

    // Auto-detect which page this selection is on
    const detectedPage = getPageForCharOffset(startOffset);

    setSelection({
      text: selectedText,
      startOffset,
      endOffset,
      anchorRect: rect,
      scene: detectedScene,
      pageNumber: detectedPage,
    });
    setSidebarMode('create');
    setSelectedHighlight(null);
  }, [onCreateHighlight, scenes, sidebarMode, getPageForCharOffset]);

  const handleCategorySelect = useCallback((category: BacklotBreakdownItemType, notes?: string) => {
    if (selection && onCreateHighlight) {
      // Include scene info if detected
      const sceneInfo = selection.scene
        ? {
            sceneNumber: selection.scene.sceneNumber,
            slugline: formatSluglineForDisplay(selection.scene.slugline),
          }
        : undefined;

      onCreateHighlight(
        selection.text,
        selection.startOffset,
        selection.endOffset,
        category,
        sceneInfo,
        notes,
        selection.pageNumber || undefined
      );
      window.getSelection()?.removeAllRanges();
      setSelection(null);
      setSidebarMode('hidden');
    }
  }, [selection, onCreateHighlight]);

  const handleCloseSidebar = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
    setSelectedHighlight(null);
    setSidebarMode('hidden');
  }, []);

  // Handle clicking on an existing highlight - open edit mode
  const handleHighlightClickInternal = useCallback((highlight: BacklotScriptHighlightBreakdown) => {
    setSelectedHighlight(highlight);
    setSidebarMode('edit');
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    onHighlightClick?.(highlight);
  }, [onHighlightClick]);

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
            onClick={() => handleHighlightClickInternal(highlight)}
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
  }, [highlights, showHighlights, handleHighlightClickInternal]);

  // Render a single page - matching ScriptPageView exactly
  const renderPage = (page: ScriptPage) => {
    const scaledWidth = (PAGE_WIDTH_PX * zoom) / 100;
    const scaledHeight = (PAGE_HEIGHT_PX * zoom) / 100;
    const fontSize = (12 * zoom) / 100;
    const lineHeight = 1.0; // Single-spaced (matches PDF export)

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

  // Scroll to target highlight when navigating from breakdown tab
  useEffect(() => {
    if (!targetHighlightId || highlights.length === 0) return;

    const targetHighlight = highlights.find(h => h.id === targetHighlightId);
    if (!targetHighlight) return;

    // Find the page containing this highlight
    const page = getPageForCharOffset(targetHighlight.start_offset);
    if (page) {
      goToPage(page);
      // Also select the highlight to show it in the sidebar
      setSelectedHighlight(targetHighlight);
      setSidebarMode('edit');
    }
  }, [targetHighlightId, highlights, getPageForCharOffset, goToPage]);

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
          {/* Scene list toggle */}
          {scenes.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "text-muted-gray hover:text-accent-yellow",
                      showScenePanel && "bg-muted-gray/20 text-accent-yellow"
                    )}
                    onClick={() => setShowScenePanel(!showScenePanel)}
                  >
                    <Film className="w-4 h-4 mr-1" />
                    {scenes.length} Scenes
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle Scene Navigator</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

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

      {/* Page view area with optional scene panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Scene Navigator Panel */}
        {showScenePanel && scenes.length > 0 && (
          <div className="w-64 flex-shrink-0 bg-charcoal-black/80 border-r border-muted-gray/20 overflow-y-auto">
            <div className="p-3 border-b border-muted-gray/20 sticky top-0 bg-charcoal-black/95 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-accent-yellow" />
                  <span className="text-sm font-medium text-bone-white">Scenes</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {scenes.length}
                </Badge>
              </div>
            </div>
            <div className="p-2">
              {scenes.map((scene, idx) => {
                // Determine which page this scene is on
                const pageWithScene = pages.find(
                  (page) => scene.lineNumber >= page.startLineIndex && scene.lineNumber <= page.endLineIndex
                );
                const isCurrentPage = pageWithScene?.pageNumber === currentPage;

                // Count highlights in this scene
                const sceneHighlights = highlights.filter(h =>
                  h.start_offset >= scene.startOffset && h.start_offset < scene.endOffset
                );

                return (
                  <button
                    key={idx}
                    onClick={() => goToScene(scene)}
                    className={cn(
                      "w-full text-left p-2 rounded mb-1 transition-colors group",
                      isCurrentPage
                        ? "bg-accent-yellow/20 border border-accent-yellow/40"
                        : "hover:bg-muted-gray/20 border border-transparent"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn(
                        "text-xs font-bold",
                        isCurrentPage ? "text-accent-yellow" : "text-bone-white"
                      )}>
                        Scene {scene.sceneNumber}
                      </span>
                      {sceneHighlights.length > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {sceneHighlights.length}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-gray truncate group-hover:text-bone-white/70">
                      {formatSluglineForDisplay(scene.slugline)}
                    </div>
                    {pageWithScene && (
                      <div className="text-[10px] text-muted-gray/60 mt-1">
                        Page {pageWithScene.pageNumber}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Script pages */}
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

        {/* Context-Aware Sidebar for highlight creation/editing */}
        <ScriptViewerSidebar
          mode={sidebarMode}
          selection={selection}
          onCategorySelect={handleCategorySelect}
          onCancel={handleCloseSidebar}
          highlight={selectedHighlight}
          scenes={dbScenes.map(s => ({
            id: s.id,
            scene_number: s.scene_number,
            slugline: s.slugline,
          }))}
          onUpdateHighlight={selectedHighlight && onUpdateHighlight ? (updates) => {
            onUpdateHighlight(selectedHighlight.id, updates);
            handleCloseSidebar(); // Close sidebar after update to refresh highlight state
          } : undefined}
          onDeleteHighlight={selectedHighlight && onDeleteHighlight ? () => {
            onDeleteHighlight(selectedHighlight.id);
            handleCloseSidebar();
          } : undefined}
          onViewBreakdown={onViewBreakdownItem}
          onClose={handleCloseSidebar}
        />
      </div>

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
