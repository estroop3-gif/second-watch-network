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
// These match standard screenplay formatting software
const CHAR_LEFT = 266;     // 3.7" - Character name position
const DIALOGUE_LEFT = 180; // 2.5" - Dialogue start
const DIALOGUE_RIGHT = 432; // 6" - Dialogue end
const PAREN_LEFT = 223;    // 3.1" - Parenthetical start
const PAREN_RIGHT = 403;   // 5.6" - Parenthetical end
const TRANSITION_RIGHT = MARGIN_RIGHT; // Right-aligned to 1" margin

// Import centralized screenplay formatting
import {
  ScriptElementType,
  ELEMENT_PATTERNS,
  detectElementType,
  FORGIVING_CONFIG,
} from '@/utils/scriptFormatting';

// Local interfaces for page view - ELEMENT-BASED storage
// Each ScriptElement represents a logical screenplay element (dialogue block, action block, etc.)
// that can span multiple visual lines but is edited as one unit
interface ScriptElement {
  id: string; // Unique ID for React keys
  type: ScriptElementType;
  content: string; // Full content of the element (may contain multiple visual lines worth of text)
  startLineIndex: number; // First line index in original content
  endLineIndex: number; // Last line index in original content
  originalIndent: number; // Indentation for this element type
}

// Legacy line interface (kept for pagination calculations)
interface ScriptLine {
  type: ScriptElementType;
  content: string;
  lineIndex: number;
  originalIndent?: number;
}

interface ScriptPage {
  pageNumber: number;
  lines: ScriptLine[]; // Line-based for pagination
  startLineIndex: number;
  endLineIndex: number;
}

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
  // Title page elements - centered formatting
  title: {
    label: 'Title',
    shortcut: '',
    icon: Type,
    textStyle: { fontWeight: 'bold', textTransform: 'uppercase' as const, fontSize: '18px' },
    placeholder: 'TITLE',
  },
  author: {
    label: 'Author',
    shortcut: '',
    icon: Users,
    textStyle: {},
    placeholder: 'Written by...',
  },
  contact: {
    label: 'Contact',
    shortcut: '',
    icon: AlignLeft,
    textStyle: { fontSize: '10px' },
    placeholder: 'Contact info',
  },
  draft_info: {
    label: 'Draft Info',
    shortcut: '',
    icon: AlignLeft,
    textStyle: { fontSize: '10px' },
    placeholder: 'Draft date',
  },
  copyright: {
    label: 'Copyright',
    shortcut: '',
    icon: AlignLeft,
    textStyle: { fontSize: '10px' },
    placeholder: 'Copyright notice',
  },
  title_page_text: {
    label: 'Title Page',
    shortcut: '',
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
    // Title page elements - centered
    case 'title':
    case 'author':
    case 'draft_info':
    case 'copyright':
    case 'title_page_text':
      return { left: 0, width: CONTENT_WIDTH, textAlign: 'center' };
    case 'contact':
      // Contact info is left-aligned at bottom of page
      return { left: 0, width: CONTENT_WIDTH, textAlign: 'left' };
    default:
      return { left: 0, width: CONTENT_WIDTH };
  }
}

// Get the standard indentation (in spaces) for each element type
// This matches the backend formatting and ensures consistent re-detection
function getElementIndent(type: ScriptElementType): number {
  switch (type) {
    case 'scene_heading':
    case 'action':
    case 'general':
    case 'shot':
      return 0; // Left-aligned
    case 'dialogue':
      return 10; // 10 spaces - within dialogue range (8-14)
    case 'parenthetical':
      return 15; // 15 spaces - within parenthetical range (12-18)
    case 'character':
      return 22; // 22 spaces - within character range (15-30)
    case 'transition':
      return 40; // 40 spaces - right-aligned (35+)
    // Title page elements
    case 'title':
    case 'author':
    case 'draft_info':
    case 'copyright':
    case 'title_page_text':
      return 20; // Centered
    case 'contact':
      return 0; // Left-aligned
    default:
      return 0;
  }
}

// Note: detectElementType is now imported from scriptFormatting with FORGIVING_CONFIG
// for imported content display (uses indent + pattern detection)

// Parse content into ELEMENTS (groups of consecutive same-type lines)
// This enables element-based editing where dialogue, action, etc. flow as single blocks
function parseScriptElements(content: string): ScriptElement[] {
  const rawLines = content.split('\n');
  const elements: ScriptElement[] = [];
  let prevType: ScriptElementType | undefined;
  let currentElement: ScriptElement | null = null;
  let elementId = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const type = detectElementType(line, undefined, prevType, false, FORGIVING_CONFIG);
    const trimmedContent = line.trimStart();
    const indent = line.length - trimmedContent.length;

    // Determine if this line should continue the current element or start a new one
    // Group consecutive lines of the same type (except character names which are always single)
    const shouldGroup = currentElement &&
      currentElement.type === type &&
      type !== 'character' && // Character names are always single line
      type !== 'scene_heading' && // Scene headings are always single line
      type !== 'transition' && // Transitions are always single line
      trimmedContent.trim() !== ''; // Don't group empty lines

    if (shouldGroup && currentElement) {
      // Continue the current element - append content with newline
      currentElement.content += '\n' + trimmedContent;
      currentElement.endLineIndex = i;
    } else {
      // Start a new element
      if (currentElement) {
        elements.push(currentElement);
      }
      currentElement = {
        id: `el-${elementId++}`,
        type,
        content: trimmedContent,
        startLineIndex: i,
        endLineIndex: i,
        originalIndent: indent,
      };
    }

    if (trimmedContent.trim()) prevType = type;
  }

  // Don't forget the last element
  if (currentElement) {
    elements.push(currentElement);
  }

  return elements;
}

// Convert elements back to line-based content for storage
function elementsToContent(elements: ScriptElement[]): string {
  const lines: string[] = [];

  for (const element of elements) {
    const indent = ' '.repeat(element.originalIndent);
    // Split element content by newlines (for multi-line elements like dialogue)
    const contentLines = element.content.split('\n');
    for (const line of contentLines) {
      lines.push(indent + line);
    }
  }

  return lines.join('\n');
}

// Legacy function for backward compatibility with pagination
function parseScriptLines(content: string): ScriptLine[] {
  const rawLines = content.split('\n');
  const lines: ScriptLine[] = [];
  let prevType: ScriptElementType | undefined;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const type = detectElementType(line, undefined, prevType, false, FORGIVING_CONFIG);
    const trimmedContent = line.trimStart();

    lines.push({
      type,
      content: trimmedContent,
      lineIndex: i,
      originalIndent: line.length - trimmedContent.length
    });
    if (trimmedContent.trim()) prevType = type;
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
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [currentElementType, setCurrentElementType] = useState<ScriptElementType>('action');

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const elementInputRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  // Parse content into elements (for editing) and lines (for pagination)
  const elements = useMemo(() => parseScriptElements(content || ''), [content]);
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

  // Update content for a specific element (element-based editing)
  const updateElement = useCallback((elementId: string, newContent: string) => {
    // Find the element being updated
    const elementIndex = elements.findIndex(el => el.id === elementId);
    if (elementIndex === -1) return;

    // Create a new elements array with the updated content
    const updatedElements = elements.map(el =>
      el.id === elementId ? { ...el, content: newContent } : el
    );

    // Convert elements back to line-based content for storage
    const newContentStr = elementsToContent(updatedElements);
    onContentChange?.(newContentStr);
  }, [elements, onContentChange]);

  // Insert a new element after the current one
  const insertElement = useCallback((afterElementId: string, elementType: ScriptElementType, newContent: string = '') => {
    const elementIndex = elements.findIndex(el => el.id === afterElementId);
    if (elementIndex === -1) return;

    const afterElement = elements[elementIndex];
    const indent = getElementIndent(elementType);

    // Create new element
    const newElement: ScriptElement = {
      id: `el-new-${Date.now()}`,
      type: elementType,
      content: newContent,
      startLineIndex: afterElement.endLineIndex + 1,
      endLineIndex: afterElement.endLineIndex + 1,
      originalIndent: indent,
    };

    // Insert the new element
    const updatedElements = [
      ...elements.slice(0, elementIndex + 1),
      newElement,
      ...elements.slice(elementIndex + 1),
    ];

    const newContentStr = elementsToContent(updatedElements);
    onContentChange?.(newContentStr);
    setEditingElementId(newElement.id);
    setCurrentElementType(elementType);
  }, [elements, onContentChange]);

  // Delete an element
  const deleteElement = useCallback((elementId: string) => {
    if (elements.length <= 1) return;

    const elementIndex = elements.findIndex(el => el.id === elementId);
    if (elementIndex === -1) return;

    const updatedElements = elements.filter(el => el.id !== elementId);
    const newContentStr = elementsToContent(updatedElements);
    onContentChange?.(newContentStr);

    // Move to previous element
    const prevIndex = Math.max(0, elementIndex - 1);
    setEditingElementId(updatedElements[prevIndex]?.id || null);
  }, [elements, onContentChange]);

  // Element type cycle order (like Celtx)
  const ELEMENT_CYCLE: ScriptElementType[] = [
    'scene_heading',
    'action',
    'character',
    'dialogue',
    'parenthetical',
    'transition',
  ];

  // Format current element as specific element type
  const formatElementAs = useCallback((elementId: string, elementType: ScriptElementType) => {
    const element = elements.find(el => el.id === elementId);
    if (!element) return;

    const trimmedContent = element.content.trim();

    // Apply formatting based on element type
    let formattedContent = '';
    switch (elementType) {
      case 'scene_heading':
        if (trimmedContent && !ELEMENT_PATTERNS.scene_heading.test(trimmedContent)) {
          formattedContent = 'INT. ' + trimmedContent.toUpperCase() + ' - DAY';
        } else if (trimmedContent) {
          formattedContent = trimmedContent.toUpperCase();
        } else {
          formattedContent = 'INT. ';
        }
        break;
      case 'action':
        formattedContent = trimmedContent;
        break;
      case 'character':
        formattedContent = trimmedContent.toUpperCase();
        break;
      case 'dialogue':
        formattedContent = trimmedContent;
        break;
      case 'parenthetical':
        if (trimmedContent) {
          formattedContent = trimmedContent.startsWith('(') ? trimmedContent : '(' + trimmedContent;
          formattedContent = formattedContent.endsWith(')') ? formattedContent : formattedContent + ')';
        } else {
          formattedContent = '()';
        }
        break;
      case 'transition':
        if (trimmedContent) {
          formattedContent = trimmedContent.toUpperCase();
          if (!formattedContent.endsWith(':')) formattedContent += ':';
        } else {
          formattedContent = 'CUT TO:';
        }
        break;
      default:
        formattedContent = trimmedContent;
    }

    // Update the element with new type and formatted content
    const updatedElements = elements.map(el =>
      el.id === elementId
        ? { ...el, type: elementType, content: formattedContent, originalIndent: getElementIndent(elementType) }
        : el
    );

    onContentChange?.(elementsToContent(updatedElements));
    setCurrentElementType(elementType);

    // Focus back on the input
    setTimeout(() => {
      const input = elementInputRefs.current.get(elementId);
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }, 0);
  }, [elements, onContentChange]);

  // Cycle to next element type (Tab behavior like Celtx)
  const cycleElementType = useCallback((elementId: string) => {
    const currentIdx = ELEMENT_CYCLE.indexOf(currentElementType);
    const nextIdx = (currentIdx + 1) % ELEMENT_CYCLE.length;
    formatElementAs(elementId, ELEMENT_CYCLE[nextIdx]);
  }, [currentElementType, formatElementAs]);

  // Handle keyboard shortcuts for element-based editing
  const handleElementKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>, elementId: string) => {
    const elementIndex = elements.findIndex(el => el.id === elementId);
    if (elementIndex === -1) return;

    // Ctrl+Number shortcuts for element types
    if (e.ctrlKey || e.metaKey) {
      if (e.key === '1') { e.preventDefault(); formatElementAs(elementId, 'scene_heading'); }
      else if (e.key === '2') { e.preventDefault(); formatElementAs(elementId, 'action'); }
      else if (e.key === '3') { e.preventDefault(); formatElementAs(elementId, 'character'); }
      else if (e.key === '4') { e.preventDefault(); formatElementAs(elementId, 'dialogue'); }
      else if (e.key === '5') { e.preventDefault(); formatElementAs(elementId, 'parenthetical'); }
      else if (e.key === '6') { e.preventDefault(); formatElementAs(elementId, 'transition'); }
      else if (e.key === 's') { e.preventDefault(); onSave?.(); }
    }

    // Enter to create new element with smart type (like Celtx)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      // Determine next element type based on current type (Celtx behavior)
      let nextElementType: ScriptElementType = 'action';
      switch (currentElementType) {
        case 'scene_heading': nextElementType = 'action'; break;
        case 'action': nextElementType = 'action'; break;
        case 'character': nextElementType = 'dialogue'; break;
        case 'dialogue': nextElementType = 'character'; break;
        case 'parenthetical': nextElementType = 'dialogue'; break;
        case 'transition': nextElementType = 'scene_heading'; break;
      }

      insertElement(elementId, nextElementType, '');
    }

    // Backspace at start to merge with previous element
    if (e.key === 'Backspace') {
      const textarea = e.currentTarget;
      if (textarea.selectionStart === 0 && textarea.selectionEnd === 0 && elementIndex > 0) {
        const currentElement = elements[elementIndex];
        const prevElement = elements[elementIndex - 1];

        // Only merge if same type or current is empty
        if (currentElement.content.trim() === '' || currentElement.type === prevElement.type) {
          e.preventDefault();
          // Merge with previous element
          const mergedContent = prevElement.content + (currentElement.content.trim() ? '\n' + currentElement.content : '');
          const updatedElements = elements
            .filter(el => el.id !== currentElement.id)
            .map(el => el.id === prevElement.id ? { ...el, content: mergedContent } : el);

          onContentChange?.(elementsToContent(updatedElements));
          setEditingElementId(prevElement.id);
        }
      }
    }

    // Arrow up/down to navigate elements
    if (e.key === 'ArrowUp' && elementIndex > 0) {
      const textarea = e.currentTarget;
      // Only navigate if at the start of the element
      if (textarea.selectionStart === 0) {
        e.preventDefault();
        setEditingElementId(elements[elementIndex - 1].id);
      }
    }
    if (e.key === 'ArrowDown' && elementIndex < elements.length - 1) {
      const textarea = e.currentTarget;
      // Only navigate if at the end of the element
      if (textarea.selectionStart === textarea.value.length) {
        e.preventDefault();
        setEditingElementId(elements[elementIndex + 1].id);
      }
    }

    // Tab to cycle element types (like Celtx)
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        const currentIdx = ELEMENT_CYCLE.indexOf(currentElementType);
        const prevIdx = (currentIdx - 1 + ELEMENT_CYCLE.length) % ELEMENT_CYCLE.length;
        formatElementAs(elementId, ELEMENT_CYCLE[prevIdx]);
      } else {
        cycleElementType(elementId);
      }
    }
  }, [elements, formatElementAs, insertElement, onSave, onContentChange, currentElementType, cycleElementType]);

  // Focus on editing element when it changes
  useEffect(() => {
    if (editingElementId !== null) {
      const input = elementInputRefs.current.get(editingElementId);
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
  }, [editingElementId]);

  // Render element-based editor (for editing mode - elements flow naturally)
  const renderElementEditor = () => {
    const scaledWidth = (PAGE_WIDTH_PX * zoom) / 100;
    const fontSize = (12 * zoom) / 100;
    const lineHeight = 1.5; // Slightly more spacing for editing comfort

    return (
      <div
        className="bg-white shadow-lg mx-auto"
        style={{
          width: scaledWidth,
          minHeight: '100%',
          paddingTop: (MARGIN_TOP * zoom) / 100,
          paddingLeft: (MARGIN_LEFT * zoom) / 100,
          paddingRight: (MARGIN_RIGHT * zoom) / 100,
          paddingBottom: (MARGIN_BOTTOM * zoom) / 100,
        }}
      >
        {elements.map((element) => {
          const isEditingThis = editingElementId === element.id;
          const effectiveType = isEditingThis ? currentElementType : element.type;
          const config = ELEMENT_CONFIG[effectiveType] || ELEMENT_CONFIG.general;
          const position = getElementPosition(effectiveType);

          const scaledLeft = (position.left * zoom) / 100;
          const scaledElementWidth = (position.width * zoom) / 100;

          return (
            <div
              key={element.id}
              className={cn(
                "relative cursor-text mb-1",
                isEditingThis && "bg-yellow-100/50 rounded"
              )}
              style={{
                ...config.textStyle,
                marginLeft: `${scaledLeft}px`,
                width: `${scaledElementWidth}px`,
                fontSize: `${fontSize}px`,
                lineHeight: lineHeight,
                minHeight: `${fontSize * lineHeight}px`,
                fontFamily: 'Courier New, Courier, monospace',
                textAlign: position.textAlign || 'left',
              }}
              onClick={() => {
                const detectedType = element.type === 'general' ? 'action' : element.type;
                setEditingElementId(element.id);
                setCurrentElementType(detectedType);
              }}
            >
              {isEditingThis ? (
                <textarea
                  ref={(el) => {
                    if (el) {
                      elementInputRefs.current.set(element.id, el);
                      el.style.height = '0px';
                      el.style.height = `${el.scrollHeight}px`;
                    }
                  }}
                  value={element.content}
                  onChange={(e) => {
                    updateElement(element.id, e.target.value);
                    const textarea = e.target as HTMLTextAreaElement;
                    textarea.style.height = '0px';
                    textarea.style.height = `${textarea.scrollHeight}px`;
                  }}
                  onKeyDown={(e) => handleElementKeyDown(e, element.id)}
                  placeholder={config.placeholder}
                  className="w-full bg-transparent border-none outline-none resize-none"
                  style={{
                    fontSize: `${fontSize}px`,
                    lineHeight: lineHeight,
                    fontFamily: 'Courier New, Courier, monospace',
                    color: '#000',
                    textAlign: position.textAlign || 'left',
                    padding: 0,
                    margin: 0,
                    border: 'none',
                    boxSizing: 'border-box',
                    display: 'block',
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    minHeight: `${fontSize * lineHeight}px`,
                    height: 'auto',
                    overflow: 'hidden',
                  }}
                />
              ) : (
                <span
                  style={{
                    display: 'block',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    wordWrap: 'break-word',
                  }}
                >
                  {element.content || '\u00A0'}
                </span>
              )}
            </div>
          );
        })}

        {/* Add new element button */}
        <div
          className="mt-4 text-gray-500 cursor-pointer hover:text-gray-700 text-center"
          style={{ fontSize: `${fontSize}px` }}
          onClick={() => {
            if (elements.length > 0) {
              insertElement(elements[elements.length - 1].id, 'action', '');
            }
          }}
        >
          + Click to add new element
        </div>
      </div>
    );
  };

  // Update an element's content for inline editing - simpler approach
  const updateElementContent = useCallback((elementId: string, newContent: string) => {
    const elementIndex = elements.findIndex(el => el.id === elementId);
    if (elementIndex === -1) return;

    const element = elements[elementIndex];

    // Rebuild the full content with updated element
    const allLines = content.split('\n');
    const indent = ' '.repeat(element.originalIndent);

    // Replace lines from startLineIndex to endLineIndex with new content
    const newLines = newContent.split('\n').map(line => indent + line);
    allLines.splice(element.startLineIndex, element.endLineIndex - element.startLineIndex + 1, ...newLines);

    onContentChange?.(allLines.join('\n'));
  }, [content, elements, onContentChange]);

  // Simple keyboard handler for inline editing
  const handleInlineKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      onSave?.();
      return;
    }

    // Escape to stop editing
    if (e.key === 'Escape') {
      e.preventDefault();
      setEditingElementId(null);
    }

    // Allow natural Enter and text flow - no special handling
  }, [onSave]);

  // Get elements that appear on a specific page (based on line indices)
  const getPageElements = useCallback((page: ScriptPage) => {
    return elements.filter(el =>
      (el.startLineIndex >= page.startLineIndex && el.startLineIndex <= page.endLineIndex) ||
      (el.endLineIndex >= page.startLineIndex && el.endLineIndex <= page.endLineIndex) ||
      (el.startLineIndex <= page.startLineIndex && el.endLineIndex >= page.endLineIndex)
    );
  }, [elements]);

  // Render a single page with element-based editing
  const renderPage = (page: ScriptPage, isVisible: boolean = true) => {
    const scaledWidth = (PAGE_WIDTH_PX * zoom) / 100;
    const scaledHeight = (PAGE_HEIGHT_PX * zoom) / 100;
    const fontSize = (12 * zoom) / 100;
    const lineHeightPx = Math.ceil(fontSize * 2); // Double the font size to prevent any overlap

    // Get elements for this page
    const pageElements = getPageElements(page);

    return (
      <div
        key={page.pageNumber}
        ref={(el) => { if (el) pageRefs.current.set(page.pageNumber, el); }}
        className={cn(
          "relative bg-white shadow-lg mx-auto",
          viewMode === 'continuous' && "mb-8",
          !isVisible && viewMode === 'single' && "hidden"
        )}
        style={{
          width: scaledWidth,
          minHeight: scaledHeight,
          height: 'auto',
          overflow: 'visible',
        }}
      >
        {/* Page content area with margins */}
        <div
          className="relative"
          style={{
            paddingTop: (MARGIN_TOP * zoom) / 100,
            paddingLeft: (MARGIN_LEFT * zoom) / 100,
            paddingRight: (MARGIN_RIGHT * zoom) / 100,
            paddingBottom: (MARGIN_BOTTOM * zoom) / 100,
            color: '#000',
            overflow: 'visible',
          }}
        >
          {pageElements.map((element) => {
            const isEditingThis = isEditing && editingElementId === element.id;
            const config = ELEMENT_CONFIG[element.type] || ELEMENT_CONFIG.general;
            const position = getElementPosition(element.type);

            const scaledLeft = (position.left * zoom) / 100;
            const scaledElementWidth = (position.width * zoom) / 100;

            return (
              <div
                key={element.id}
                className="relative cursor-text"
                style={{
                  ...config.textStyle,
                  marginLeft: `${scaledLeft}px`,
                  width: `${scaledElementWidth}px`,
                  fontSize: `${fontSize}px`,
                  lineHeight: `${lineHeightPx}px`,
                  minHeight: `${lineHeightPx}px`,
                  fontFamily: 'Courier New, Courier, monospace',
                  textAlign: position.textAlign || 'left',
                  marginBottom: 0,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isEditing) {
                    // Already in editing mode - select this element
                    setEditingElementId(element.id);
                    setCurrentElementType(element.type === 'general' ? 'action' : element.type);
                  } else if (canEdit && onStartEdit) {
                    // Start editing mode and select this element
                    onStartEdit();
                    setTimeout(() => {
                      setEditingElementId(element.id);
                      setCurrentElementType(element.type === 'general' ? 'action' : element.type);
                    }, 50);
                  }
                }}
              >
                {isEditingThis ? (
                  // Seamless inline textarea - text flows naturally like a document
                  <textarea
                    ref={(el) => {
                      if (el) {
                        elementInputRefs.current.set(element.id, el);
                        // Auto-size to content
                        el.style.height = 'auto';
                        el.style.height = `${el.scrollHeight}px`;
                      }
                    }}
                    value={element.content}
                    onChange={(e) => {
                      updateElementContent(element.id, e.target.value);
                      // Auto-resize as content changes
                      const textarea = e.target as HTMLTextAreaElement;
                      textarea.style.height = 'auto';
                      textarea.style.height = `${textarea.scrollHeight}px`;
                    }}
                    onKeyDown={handleInlineKeyDown}
                    placeholder={config.placeholder}
                    className="w-full bg-transparent border-none outline-none resize-none focus:ring-0 focus:outline-none"
                    style={{
                      fontSize: `${fontSize}px`,
                      lineHeight: `${lineHeightPx}px`,
                      fontFamily: 'Courier New, Courier, monospace',
                      color: '#000',
                      textAlign: position.textAlign || 'left',
                      padding: 0,
                      margin: 0,
                      border: 'none',
                      boxSizing: 'border-box',
                      display: 'block',
                      whiteSpace: 'pre-wrap',
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      wordBreak: 'break-word',
                      minHeight: `${lineHeightPx}px`,
                      height: 'auto',
                      overflow: 'hidden',
                      background: 'transparent',
                      caretColor: '#000',
                    }}
                  />
                ) : (
                  <span
                    style={{
                      display: 'block',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                      wordWrap: 'break-word',
                      lineHeight: `${lineHeightPx}px`,
                    }}
                  >
                    {element.content || '\u00A0'}
                  </span>
                )}
              </div>
            );
          })}

          {/* Add new element at end of last page */}
          {isEditing && page.pageNumber === totalPages && (
            <div
              className="mt-2 text-gray-400 cursor-pointer hover:text-gray-600 text-center"
              style={{ fontSize: `${fontSize}px` }}
              onClick={() => {
                // Add a new action element at the end
                const newContent = content + '\n\n';
                onContentChange?.(newContent);
              }}
            >
              + Click to add text
            </div>
          )}
        </div>

        {/* Page number */}
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

  // Handle page navigation with keyboard in fullscreen
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if (!isFullscreen) return;

      // Page navigation with arrow keys when not editing a specific element
      if (editingElementId === null) {
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
  }, [isFullscreen, editingElementId, currentPage, totalPages, goToPage]);

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

        {/* Center: Current element type indicator when editing */}
        {isEditing && editingElementId !== null && (
          <div className={cn("flex items-center gap-2", isFullscreen ? "text-base" : "text-sm")}>
            <span className="text-muted-gray">Editing:</span>
            <Badge variant="outline" className="bg-accent-yellow/20 text-accent-yellow border-accent-yellow/50">
              {ELEMENT_CONFIG[currentElementType]?.label || 'Text'}
            </Badge>
          </div>
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
          <span>Ctrl+S: Save</span>
          <span>Esc: Stop editing</span>
          {isFullscreen && <span>| Exit fullscreen</span>}
        </div>
      )}

      {/* Page view area - always use paginated view, with inline editing support */}
      <ScrollArea className="flex-1">
        <div className={cn("py-8", viewMode === 'single' && "flex items-start justify-center min-h-full")}>
          {/* Paginated view with inline editing - no view switch */}
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
          {elements.length} elements | {totalPages} pages
          {isEditing && editingElementId !== null && (
            <span className="ml-2">| Editing</span>
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
