/**
 * ScriptPDFViewer - Full script viewer with PDF rendering and annotations
 * Allows page-by-page viewing and annotation overlays
 */
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  MessageSquarePlus,
  X,
  Check,
  Trash2,
  StickyNote,
  Loader2,
  ChevronsLeft,
  ChevronsRight,
  List,
  Filter,
  Eye,
  EyeOff,
  RotateCcw,
  Highlighter,
  Users,
  User,
  Clapperboard,
  MapPin,
  Package,
  Palette,
  Shirt,
  Sparkles,
  Car,
  PawPrint,
  TreeDeciduous,
  Wrench,
  Volume2,
  Music,
  HelpCircle,
  Maximize2,
  Minimize2,
  Clock,
  CheckCircle,
  Pencil,
  Save,
  MessageCircle,
  Send,
} from 'lucide-react';
import {
  BacklotScript,
  BacklotScriptPageNote,
  BacklotScriptPageNoteType,
  ScriptPageNoteSummary,
  SCRIPT_PAGE_NOTE_TYPE_LABELS,
  SCRIPT_PAGE_NOTE_TYPE_COLORS,
  BacklotScriptHighlightBreakdown,
  BacklotBreakdownItemType,
  BREAKDOWN_HIGHLIGHT_COLORS,
  BREAKDOWN_ITEM_TYPE_LABELS,
} from '@/types/backlot';
import {
  useScriptPageNotes,
  useScriptPageNotesSummary,
  useScriptPageNoteMutations,
  useScriptHighlights,
  useScriptHighlightMutations,
  useScenes,
  useHighlightNotes,
  useHighlightNoteMutations,
} from '@/hooks/backlot';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Import PDF.js styles
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Custom styles to ensure text layer is above highlights
const pdfStyles = `
  .react-pdf__Page__textContent {
    z-index: 2 !important;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleId = 'pdf-highlight-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = pdfStyles;
    document.head.appendChild(style);
  }
}

interface ScriptPDFViewerProps {
  script: BacklotScript;
  projectId: string;
  canEdit: boolean;
  onClose?: () => void;
}

// Note type color mapping for CSS classes
const NOTE_TYPE_BG_COLORS: Record<BacklotScriptPageNoteType, string> = {
  general: 'bg-gray-500',
  direction: 'bg-purple-500',
  production: 'bg-blue-500',
  character: 'bg-red-500',
  blocking: 'bg-orange-500',
  camera: 'bg-cyan-500',
  continuity: 'bg-yellow-500',
  sound: 'bg-sky-500',
  vfx: 'bg-fuchsia-500',
  prop: 'bg-violet-500',
  wardrobe: 'bg-indigo-500',
  makeup: 'bg-pink-500',
  location: 'bg-amber-500',
  safety: 'bg-rose-500',
  other: 'bg-slate-500',
};

// Breakdown category config for highlighting
const BREAKDOWN_CATEGORY_CONFIG: Record<BacklotBreakdownItemType, { icon: React.ReactNode; label: string; color: string }> = {
  cast: { icon: <Users className="w-4 h-4" />, label: 'Cast', color: '#FF0000' },
  background: { icon: <Users className="w-4 h-4" />, label: 'Background', color: '#00FF00' },
  stunt: { icon: <Clapperboard className="w-4 h-4" />, label: 'Stunt', color: '#FFA500' },
  location: { icon: <MapPin className="w-4 h-4" />, label: 'Location', color: '#8B4513' },
  prop: { icon: <Package className="w-4 h-4" />, label: 'Props', color: '#800080' },
  set_dressing: { icon: <Palette className="w-4 h-4" />, label: 'Set Dressing', color: '#00FFFF' },
  wardrobe: { icon: <Shirt className="w-4 h-4" />, label: 'Wardrobe', color: '#0000FF' },
  makeup: { icon: <Sparkles className="w-4 h-4" />, label: 'Makeup/Hair', color: '#FF69B4' },
  sfx: { icon: <Sparkles className="w-4 h-4" />, label: 'SFX', color: '#FFFF00' },
  vfx: { icon: <Sparkles className="w-4 h-4" />, label: 'VFX', color: '#FF00FF' },
  vehicle: { icon: <Car className="w-4 h-4" />, label: 'Vehicles', color: '#A52A2A' },
  animal: { icon: <PawPrint className="w-4 h-4" />, label: 'Animals', color: '#32CD32' },
  greenery: { icon: <TreeDeciduous className="w-4 h-4" />, label: 'Greenery', color: '#228B22' },
  special_equipment: { icon: <Wrench className="w-4 h-4" />, label: 'Special Equip.', color: '#4B0082' },
  sound: { icon: <Volume2 className="w-4 h-4" />, label: 'Sound', color: '#87CEEB' },
  music: { icon: <Music className="w-4 h-4" />, label: 'Music', color: '#DDA0DD' },
  other: { icon: <HelpCircle className="w-4 h-4" />, label: 'Other', color: '#808080' },
};

// Selected text info for highlighting
interface TextSelectionInfo {
  text: string;
  startOffset: number;
  endOffset: number;
  rect: { x: number; y: number; width: number; height: number } | null;
}

// Note marker component - clickable dot that appears directly on the PDF page
const NoteMarker: React.FC<{
  note: BacklotScriptPageNote;
  isSelected: boolean;
  onClick: () => void;
  scale: number;
}> = ({ note, isSelected, onClick, scale }) => {
  const bgColor = NOTE_TYPE_BG_COLORS[note.note_type];
  const [isHovered, setIsHovered] = useState(false);

  // Scale the marker size based on zoom level for consistent appearance
  const markerSize = Math.max(20, Math.min(32, 24 / scale));

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
              'absolute flex items-center justify-center cursor-pointer transition-all duration-200 z-10 pointer-events-auto',
              'rounded-full shadow-lg border-2 border-white',
              bgColor,
              isSelected && 'ring-2 ring-accent-yellow ring-offset-1 ring-offset-charcoal-black',
              isHovered && !isSelected && 'scale-125',
              note.resolved && 'opacity-60'
            )}
            style={{
              left: `${(note.position_x || 0) * 100}%`,
              top: `${(note.position_y || 0) * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: `${markerSize}px`,
              height: `${markerSize}px`,
            }}
          >
            <StickyNote className="text-white" style={{ width: markerSize * 0.5, height: markerSize * 0.5 }} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px]">
          <p className="text-xs font-medium">{SCRIPT_PAGE_NOTE_TYPE_LABELS[note.note_type]}</p>
          <p className="text-xs text-muted-foreground line-clamp-2">{note.note_text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Page thumbnail component
const PageThumbnail: React.FC<{
  pageNumber: number;
  pdfUrl: string;
  isActive: boolean;
  noteCount: number;
  unresolvedCount: number;
  onClick: () => void;
}> = ({ pageNumber, pdfUrl, isActive, noteCount, unresolvedCount, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex-shrink-0 border-2 rounded overflow-hidden transition-all',
        isActive ? 'border-accent-yellow' : 'border-transparent hover:border-muted-gray/50'
      )}
    >
      <Document file={pdfUrl} loading="">
        <Page
          pageNumber={pageNumber}
          width={80}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      </Document>
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs py-0.5 text-center">
        {pageNumber}
      </div>
      {noteCount > 0 && (
        <div className="absolute top-1 right-1 flex items-center gap-0.5">
          <Badge
            className={cn(
              'h-5 min-w-[20px] text-xs px-1',
              unresolvedCount > 0 ? 'bg-orange-500' : 'bg-green-500'
            )}
          >
            {noteCount}
          </Badge>
        </div>
      )}
    </button>
  );
};

// Main component
const ScriptPDFViewer: React.FC<ScriptPDFViewerProps> = ({
  script,
  projectId,
  canEdit,
  onClose,
}) => {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  // State
  const [numPages, setNumPages] = useState<number>(script.total_pages || 0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [showNotes, setShowNotes] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [noteTypeFilter, setNoteTypeFilter] = useState<BacklotScriptPageNoteType | 'all'>('all');
  const [selectedNote, setSelectedNote] = useState<BacklotScriptPageNote | null>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNotePosition, setNewNotePosition] = useState<{ x: number; y: number } | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteType, setNewNoteType] = useState<BacklotScriptPageNoteType>('general');
  const [showSidebar, setShowSidebar] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Breakdown highlighting state
  const [isBreakdownMode, setIsBreakdownMode] = useState(false);
  const [showHighlights, setShowHighlights] = useState(true);
  const [textSelection, setTextSelection] = useState<TextSelectionInfo | null>(null);
  const [highlightPopoverOpen, setHighlightPopoverOpen] = useState(false);
  const [selectedHighlight, setSelectedHighlight] = useState<BacklotScriptHighlightBreakdown | null>(null);
  const [selectedSceneForHighlight, setSelectedSceneForHighlight] = useState<string | null>(null);

  // Data hooks
  const { notes, isLoading: notesLoading } = useScriptPageNotes({
    scriptId: script.id,
    page_number: currentPage,
    note_type: noteTypeFilter,
    resolved: showResolved ? undefined : false,
  });

  const { data: notesSummary } = useScriptPageNotesSummary(script.id);
  const { createNote, updateNote, deleteNote, toggleResolved } = useScriptPageNoteMutations();

  // Highlight hooks - fetch ALL highlights for the script (not just current page)
  // This allows us to show highlighting for text that appears across multiple pages
  const { data: allHighlights = [], isLoading: highlightsLoading } = useScriptHighlights(script.id);
  const { createHighlight, deleteHighlight, confirmHighlight, updateHighlight } = useScriptHighlightMutations();

  // Highlight notes hooks
  const { data: highlightNotes = [], isLoading: notesLoadingHighlight } = useHighlightNotes(
    script.id,
    selectedHighlight?.id || null
  );
  const { createNote: createHighlightNote, deleteNote: deleteHighlightNote } = useHighlightNoteMutations();

  // State for editing highlight
  const [isEditingHighlight, setIsEditingHighlight] = useState(false);
  const [editHighlightLabel, setEditHighlightLabel] = useState('');
  const [editHighlightCategory, setEditHighlightCategory] = useState<BacklotBreakdownItemType | ''>('');
  const [editHighlightSceneId, setEditHighlightSceneId] = useState('');
  const [newHighlightNote, setNewHighlightNote] = useState('');
  const { scenes } = useScenes({ projectId });

  // Calculate which scene the current page belongs to based on page_start
  const currentPageSceneId = useMemo(() => {
    if (!scenes || scenes.length === 0) return null;

    // Sort scenes by sequence to ensure correct order
    const sortedScenesRaw = [...scenes].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

    // Deduplicate scenes by scene_number (keep first occurrence)
    const seenSceneNumbers = new Set<string>();
    const sortedScenes = sortedScenesRaw.filter(scene => {
      const sn = scene.scene_number;
      if (seenSceneNumbers.has(sn)) return false;
      seenSceneNumbers.add(sn);
      return true;
    });

    console.log(`[SceneCalc] Raw scenes: ${sortedScenesRaw.length}, after dedup: ${sortedScenes.length}`);

    // Check if any scene has page_start set
    const hasPageStart = sortedScenes.some(s => s.page_start !== null && s.page_start !== undefined);

    console.log(`[SceneCalc] currentPage=${currentPage}, totalScenes=${sortedScenes.length}, hasPageStart=${hasPageStart}`);

    if (hasPageStart) {
      // Find scenes that could be on this page (page_start <= currentPage)
      // Multiple scenes may share the same page, so find the FIRST one whose page_start is <= currentPage
      // but whose NEXT scene (with a different page_start) hasn't started yet

      let matchedScene = null;
      for (let i = 0; i < sortedScenes.length; i++) {
        const scene = sortedScenes[i];
        const pageStart = scene.page_start ?? 0;

        // If this scene starts on or before current page, it's a candidate
        if (pageStart <= currentPage) {
          // Find the next scene that starts on a DIFFERENT page
          let nextDifferentPageStart = null;
          for (let j = i + 1; j < sortedScenes.length; j++) {
            const nextPageStart = sortedScenes[j].page_start;
            if (nextPageStart !== null && nextPageStart !== undefined && nextPageStart > pageStart) {
              nextDifferentPageStart = nextPageStart;
              break;
            }
          }

          // Check if current page is before the next different page starts
          if (nextDifferentPageStart === null || currentPage < nextDifferentPageStart) {
            // This is the first scene on this page
            matchedScene = scene;
            console.log(`[SceneCalc] Matched scene ${scene.scene_number} (id=${scene.id}) page_start=${pageStart}, nextDifferent=${nextDifferentPageStart}`);
            break;
          }
        }
      }

      if (matchedScene) {
        return matchedScene.id;
      }
    } else {
      // Calculate from page_length - use cumulative pages
      let cumulativePage = 1;
      for (const scene of sortedScenes) {
        const pageLength = scene.page_length || 1;
        const sceneEndPage = cumulativePage + pageLength;

        // Check if current page falls within this scene's range
        if (currentPage >= cumulativePage && currentPage < sceneEndPage + 0.5) {
          console.log(`[SceneCalc] Matched scene ${scene.scene_number} (id=${scene.id}) using page_length: cumulative=${cumulativePage.toFixed(2)}, end=${sceneEndPage.toFixed(2)}`);
          return scene.id;
        }
        cumulativePage += pageLength;
      }
      console.log(`[SceneCalc] No scene matched for page ${currentPage}, cumulative reached ${cumulativePage.toFixed(2)}`);
    }

    // Fallback to first scene
    console.log(`[SceneCalc] Falling back to first scene: ${sortedScenes[0]?.scene_number}`);
    return sortedScenes[0]?.id || null;
  }, [scenes, currentPage]);

  // Get scenes that could be on the current page (for scene selector)
  const scenesOnCurrentPage = useMemo(() => {
    if (!scenes || scenes.length === 0) return [];

    const sortedScenes = [...scenes].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

    // Deduplicate by scene_number
    const seenSceneNumbers = new Set<string>();
    const dedupedScenes = sortedScenes.filter(scene => {
      const sn = scene.scene_number;
      if (seenSceneNumbers.has(sn)) return false;
      seenSceneNumbers.add(sn);
      return true;
    });

    // Find scenes that could be on this page
    const hasPageStart = dedupedScenes.some(s => s.page_start !== null && s.page_start !== undefined);

    if (hasPageStart) {
      // Get all scenes whose page_start <= currentPage and whose next different page hasn't started
      const scenesOnPage: typeof dedupedScenes = [];
      for (let i = 0; i < dedupedScenes.length; i++) {
        const scene = dedupedScenes[i];
        const pageStart = scene.page_start ?? 0;

        if (pageStart <= currentPage) {
          // Find the next scene that starts on a different (later) page
          let nextDifferentPageStart = null;
          for (let j = i + 1; j < dedupedScenes.length; j++) {
            const nextPs = dedupedScenes[j].page_start;
            if (nextPs !== null && nextPs !== undefined && nextPs > pageStart) {
              nextDifferentPageStart = nextPs;
              break;
            }
          }

          // If current page is before the next different page starts, this scene could be on current page
          if (nextDifferentPageStart === null || currentPage < nextDifferentPageStart) {
            scenesOnPage.push(scene);
          }
        }
      }
      return scenesOnPage;
    }

    // Fallback: return first scene
    return dedupedScenes.slice(0, 1);
  }, [scenes, currentPage]);

  // State for dynamically found text positions (for non-character categories)
  const [foundTextPositions, setFoundTextPositions] = useState<Array<{
    highlightId: string;
    category: string;
    color: string;
    text: string;
    rect: { x: number; y: number; width: number; height: number };
  }>>([]);

  // Character categories that only show the original highlight (not all instances)
  const characterCategories = ['cast', 'background', 'stunt'];

  // Filter highlights that have stored positions on the current page
  const pageHighlights = allHighlights.filter(h => h.page_number === currentPage);

  // Scan text layer for non-character highlights to show all instances
  const scanTextLayerForHighlights = useCallback(() => {
    if (!pageRef.current || !showHighlights || allHighlights.length === 0) {
      setFoundTextPositions([]);
      return;
    }

    // Only scan for non-character categories (props, vehicles, etc.)
    const nonCharacterHighlights = allHighlights.filter(h => !characterCategories.includes(h.category));
    if (nonCharacterHighlights.length === 0) {
      setFoundTextPositions([]);
      return;
    }

    // Small delay to ensure text layer is rendered
    setTimeout(() => {
      const textLayer = pageRef.current?.querySelector('.react-pdf__Page__textContent');
      if (!textLayer) {
        setFoundTextPositions([]);
        return;
      }

      const pageRect = pageRef.current!.getBoundingClientRect();
      const foundPositions: typeof foundTextPositions = [];

      // Get unique texts to search for from non-character highlights
      const textsToFind = new Map<string, { highlightId: string; category: string; color: string }>();
      nonCharacterHighlights.forEach(h => {
        const text = h.highlighted_text.trim();
        if (!textsToFind.has(text.toLowerCase())) {
          const categoryConfig = BREAKDOWN_CATEGORY_CONFIG[h.category];
          textsToFind.set(text.toLowerCase(), {
            highlightId: h.id,
            category: h.category,
            color: h.color || categoryConfig?.color || '#FFFF00',
          });
        }
      });

      // Search through text spans for word matches
      const textSpans = textLayer.querySelectorAll('span');
      textSpans.forEach((span) => {
        const spanText = span.textContent || '';
        const textNode = span.firstChild;
        if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;

        textsToFind.forEach((highlightInfo, searchTextLower) => {
          // Regex for word boundary matching (allows suffixes like 's, 's)
          const escapedText = searchTextLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const wordRegex = new RegExp(`\\b${escapedText}(?:'?s?)?\\b`, 'gi');

          // Find all matches and their positions
          let match;
          while ((match = wordRegex.exec(spanText)) !== null) {
            const matchStart = match.index;
            const matchEnd = matchStart + match[0].length;

            // Create a Range to get the exact bounding rect of just the matched word
            try {
              const range = document.createRange();
              range.setStart(textNode, matchStart);
              range.setEnd(textNode, matchEnd);

              const rangeRect = range.getBoundingClientRect();
              if (rangeRect.width < 2 || rangeRect.height < 2) continue;

              const rect = {
                x: (rangeRect.left - pageRect.left) / pageRect.width,
                y: (rangeRect.top - pageRect.top) / pageRect.height,
                width: rangeRect.width / pageRect.width,
                height: rangeRect.height / pageRect.height,
              };

              // Check if this overlaps with a stored highlight position
              const isStoredPosition = pageHighlights.some(h => {
                if (h.highlighted_text.toLowerCase().trim() !== searchTextLower) return false;
                const storedRect = {
                  x: h.rect_x || 0,
                  y: h.rect_y || 0,
                  width: h.rect_width || 0.1,
                  height: h.rect_height || 0.02,
                };
                const overlapX = Math.max(0, Math.min(rect.x + rect.width, storedRect.x + storedRect.width) - Math.max(rect.x, storedRect.x));
                const overlapY = Math.max(0, Math.min(rect.y + rect.height, storedRect.y + storedRect.height) - Math.max(rect.y, storedRect.y));
                return overlapX > 0.01 && overlapY > 0.005;
              });

              if (!isStoredPosition) {
                foundPositions.push({
                  highlightId: highlightInfo.highlightId,
                  category: highlightInfo.category,
                  color: highlightInfo.color,
                  text: match[0], // Use the actual matched text
                  rect,
                });
              }
            } catch (e) {
              // Range creation failed, skip this match
              console.warn('Failed to create range for highlight match:', e);
            }
          }
        });
      });

      setFoundTextPositions(foundPositions);
    }, 100);
  }, [allHighlights, pageHighlights, showHighlights]);

  // Re-scan when page changes or highlights change
  useEffect(() => {
    scanTextLayerForHighlights();
  }, [currentPage, allHighlights, showHighlights, scanTextLayerForHighlights]);

  // PDF document loaded
  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPdfError(null);
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('Error loading PDF:', error);
    setPdfError('Failed to load PDF. The file may be corrupted or inaccessible.');
  }, []);

  // Page navigation
  const goToPage = (page: number) => {
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page);
      setSelectedNote(null);
    }
  };

  const goToPrevPage = () => goToPage(currentPage - 1);
  const goToNextPage = () => goToPage(currentPage + 1);
  const goToFirstPage = () => goToPage(1);
  const goToLastPage = () => goToPage(numPages);

  // Zoom controls
  const zoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const zoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));
  const resetZoom = () => setScale(1.0);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      // Enter fullscreen
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      } else if ((containerRef.current as any).webkitRequestFullscreen) {
        (containerRef.current as any).webkitRequestFullscreen();
      } else if ((containerRef.current as any).msRequestFullscreen) {
        (containerRef.current as any).msRequestFullscreen();
      }
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    }
  }, [isFullscreen]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Click handler for adding notes
  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAddingNote || !canEdit || !pageRef.current) return;

    const rect = pageRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setNewNotePosition({ x, y });
  };

  // Create new note
  const handleCreateNote = async () => {
    if (!newNotePosition || !newNoteText.trim()) return;

    try {
      await createNote.mutateAsync({
        scriptId: script.id,
        page_number: currentPage,
        position_x: newNotePosition.x,
        position_y: newNotePosition.y,
        note_text: newNoteText.trim(),
        note_type: newNoteType,
      });

      toast({
        title: 'Note Created',
        description: 'Your annotation has been saved.',
      });

      setNewNotePosition(null);
      setNewNoteText('');
      setNewNoteType('general');
      setIsAddingNote(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create note',
        variant: 'destructive',
      });
    }
  };

  // Delete note
  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteNote.mutateAsync({ scriptId: script.id, noteId });
      toast({
        title: 'Note Deleted',
        description: 'The annotation has been removed.',
      });
      setSelectedNote(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete note',
        variant: 'destructive',
      });
    }
  };

  // Toggle resolved
  const handleToggleResolved = async (note: BacklotScriptPageNote) => {
    try {
      await toggleResolved.mutateAsync({
        scriptId: script.id,
        noteId: note.id,
        resolved: !note.resolved,
      });
      toast({
        title: note.resolved ? 'Note Reopened' : 'Note Resolved',
        description: note.resolved
          ? 'The note has been marked as unresolved.'
          : 'The note has been marked as resolved.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update note',
        variant: 'destructive',
      });
    }
  };

  // Handle text selection for breakdown highlighting
  const handleTextSelection = useCallback(() => {
    if (!isBreakdownMode || !canEdit || !pageRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      return;
    }

    const selectedText = selection.toString().trim();
    const range = selection.getRangeAt(0);
    const pageRect = pageRef.current.getBoundingClientRect();
    const selectionRect = range.getBoundingClientRect();

    // Calculate normalized position relative to page
    const rect = {
      x: (selectionRect.left - pageRect.left) / pageRect.width,
      y: (selectionRect.top - pageRect.top) / pageRect.height,
      width: selectionRect.width / pageRect.width,
      height: selectionRect.height / pageRect.height,
    };

    setTextSelection({
      text: selectedText,
      startOffset: 0, // In a real implementation, we'd calculate actual text offsets
      endOffset: selectedText.length,
      rect,
    });
    // Initialize selected scene to the first scene on this page
    setSelectedSceneForHighlight(currentPageSceneId);
    setHighlightPopoverOpen(true);
  }, [isBreakdownMode, canEdit, currentPageSceneId]);

  // Create breakdown highlight
  const handleCreateHighlight = async (category: BacklotBreakdownItemType) => {
    if (!textSelection) return;

    const sceneToUse = selectedSceneForHighlight || currentPageSceneId;
    console.log(`[CreateHighlight] Creating highlight for "${textSelection.text}" on page ${currentPage}, scene_id=${sceneToUse}`);

    try {
      await createHighlight.mutateAsync({
        scriptId: script.id,
        scene_id: sceneToUse || undefined,
        page_number: currentPage,
        start_offset: textSelection.startOffset,
        end_offset: textSelection.endOffset,
        highlighted_text: textSelection.text,
        rect_x: textSelection.rect?.x,
        rect_y: textSelection.rect?.y,
        rect_width: textSelection.rect?.width,
        rect_height: textSelection.rect?.height,
        category,
        color: BREAKDOWN_CATEGORY_CONFIG[category].color,
        suggested_label: textSelection.text,
      });

      toast({
        title: 'Breakdown Created',
        description: `"${textSelection.text}" added as ${BREAKDOWN_CATEGORY_CONFIG[category].label}`,
      });

      setTextSelection(null);
      setHighlightPopoverOpen(false);
      window.getSelection()?.removeAllRanges();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create breakdown highlight',
        variant: 'destructive',
      });
    }
  };

  // Delete highlight
  const handleDeleteHighlight = async (highlightId: string) => {
    try {
      await deleteHighlight.mutateAsync({ scriptId: script.id, highlightId });
      toast({
        title: 'Highlight Deleted',
        description: 'The breakdown highlight has been removed.',
      });
      setSelectedHighlight(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete highlight',
        variant: 'destructive',
      });
    }
  };

  // Listen for text selection events
  useEffect(() => {
    if (!isBreakdownMode) return;

    const handleMouseUp = () => {
      setTimeout(handleTextSelection, 10); // Small delay to ensure selection is complete
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [isBreakdownMode, handleTextSelection]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowLeft') goToPrevPage();
      if (e.key === 'ArrowRight') goToNextPage();
      if (e.key === 'Home') goToFirstPage();
      if (e.key === 'End') goToLastPage();
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      if (e.key === 'Escape') {
        if (isFullscreen) {
          // Let the browser handle ESC for exiting fullscreen
          return;
        }
        setIsAddingNote(false);
        setNewNotePosition(null);
        setSelectedNote(null);
        setIsBreakdownMode(false);
        setTextSelection(null);
        setHighlightPopoverOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, numPages, isFullscreen, toggleFullscreen]);

  // Get summary for current page
  const currentPageSummary = notesSummary?.find((s) => s.page_number === currentPage);

  if (!script.file_url) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-muted-gray">
        <StickyNote className="w-16 h-16 mb-4 opacity-40" />
        <p className="text-lg">No PDF file attached to this script</p>
        <p className="text-sm">Import a PDF script to view and annotate it here</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-charcoal-black" ref={containerRef}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-muted-gray/20 bg-black/20 overflow-x-auto">
        <div className="flex items-center gap-4 flex-shrink-0">
          <h2 className="text-lg font-medium text-bone-white truncate max-w-[200px]">
            {script.title}
          </h2>
          {script.version && (
            <Badge variant="outline" className="text-xs">
              v{script.version}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* View controls */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSidebar(!showSidebar)}
            title="Toggle page list"
          >
            <List className="w-4 h-4" />
          </Button>

          <div className="h-4 w-px bg-muted-gray/30" />

          {/* Zoom controls */}
          <Button variant="ghost" size="sm" onClick={zoomOut} disabled={scale <= 0.5}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-gray w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="ghost" size="sm" onClick={zoomIn} disabled={scale >= 3}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={resetZoom}>
            <RotateCcw className="w-4 h-4" />
          </Button>

          <div className="h-4 w-px bg-muted-gray/30" />

          {/* Note controls */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNotes(!showNotes)}
            title={showNotes ? 'Hide notes' : 'Show notes'}
          >
            {showNotes ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowResolved(!showResolved)}
            className={showResolved ? 'text-green-400' : ''}
            title={showResolved ? 'Hide resolved' : 'Show resolved'}
          >
            <Check className="w-4 h-4" />
          </Button>

          <Select
            value={noteTypeFilter}
            onValueChange={(v) => setNoteTypeFilter(v as any)}
          >
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <Filter className="w-3 h-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(SCRIPT_PAGE_NOTE_TYPE_LABELS).map(([type, label]) => (
                <SelectItem key={type} value={type}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {canEdit && (
            <Button
              variant={isAddingNote ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => {
                setIsAddingNote(!isAddingNote);
                setNewNotePosition(null);
                setIsBreakdownMode(false);
              }}
            >
              <MessageSquarePlus className="w-4 h-4 mr-1" />
              {isAddingNote ? 'Cancel' : 'Add Note'}
            </Button>
          )}

          <div className="h-4 w-px bg-muted-gray/30" />

          {/* Breakdown highlighting controls */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHighlights(!showHighlights)}
            title={showHighlights ? 'Hide breakdowns' : 'Show breakdowns'}
          >
            {showHighlights ? (
              <Highlighter className="w-4 h-4 text-accent-yellow" />
            ) : (
              <Highlighter className="w-4 h-4" />
            )}
          </Button>

          {canEdit && (
            <Button
              variant={isBreakdownMode ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => {
                setIsBreakdownMode(!isBreakdownMode);
                setIsAddingNote(false);
                setNewNotePosition(null);
                // Clear any existing text selection when toggling breakdown mode
                setTextSelection(null);
                setHighlightPopoverOpen(false);
                window.getSelection()?.removeAllRanges();
                if (!isBreakdownMode) {
                  toast({
                    title: 'Breakdown Mode',
                    description: 'Select text to create breakdown items',
                  });
                }
              }}
              className={isBreakdownMode ? 'bg-accent-yellow/20 text-accent-yellow' : ''}
            >
              <Highlighter className="w-4 h-4 mr-1" />
              {isBreakdownMode ? 'Exit Breakdown' : 'Breakdown'}
            </Button>
          )}

          <div className="h-4 w-px bg-muted-gray/30" />

          {/* Fullscreen toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleFullscreen}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {onClose && !isFullscreen && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Page thumbnails sidebar */}
        {showSidebar && (
          <div className="w-28 border-r border-muted-gray/20 overflow-y-auto p-2 flex flex-col gap-2 bg-black/10">
            {numPages > 0 &&
              Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
                const summary = notesSummary?.find((s) => s.page_number === pageNum);
                return (
                  <PageThumbnail
                    key={pageNum}
                    pageNumber={pageNum}
                    pdfUrl={script.file_url!}
                    isActive={currentPage === pageNum}
                    noteCount={summary?.note_count || 0}
                    unresolvedCount={summary?.unresolved_count || 0}
                    onClick={() => goToPage(pageNum)}
                  />
                );
              })}
          </div>
        )}

        {/* PDF viewer */}
        <div className="flex-1 overflow-auto flex items-start justify-center p-4">
          {pdfError ? (
            <div className="text-center text-muted-gray py-12">
              <StickyNote className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p>{pdfError}</p>
            </div>
          ) : (
            <Document
              file={script.file_url}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex items-center gap-2 text-muted-gray">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading PDF...
                </div>
              }
            >
              <div
                ref={pageRef}
                className={cn(
                  'relative shadow-2xl',
                  isAddingNote && 'cursor-crosshair'
                )}
                onClick={handlePageClick}
              >
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  onRenderSuccess={() => {
                    // Re-scan text layer after page renders (for non-character highlights)
                    scanTextLayerForHighlights();
                  }}
                />

                {/* Note markers overlay - clickable dots directly on the PDF */}
                {showNotes && !notesLoading && (
                  <div className="absolute inset-0 pointer-events-none z-20">
                    {notes.map((note) => (
                      <NoteMarker
                        key={note.id}
                        note={note}
                        isSelected={selectedNote?.id === note.id}
                        onClick={() => setSelectedNote(selectedNote?.id === note.id ? null : note)}
                        scale={scale}
                      />
                    ))}
                  </div>
                )}

                {/* Breakdown highlight overlays - clickable layer above text */}
                {showHighlights && !highlightsLoading && (
                  <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 3 }}>
                    {/* Render stored highlights for this page */}
                    {pageHighlights.map((highlight) => {
                      const categoryConfig = BREAKDOWN_CATEGORY_CONFIG[highlight.category];
                      const highlightColor = highlight.color || categoryConfig?.color || '#FFFF00';

                      // Convert hex to rgba for transparent but bright colors
                      const hexToRgba = (hex: string, alpha: number) => {
                        const r = parseInt(hex.slice(1, 3), 16);
                        const g = parseInt(hex.slice(3, 5), 16);
                        const b = parseInt(hex.slice(5, 7), 16);
                        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                      };

                      const isSelected = selectedHighlight?.id === highlight.id;

                      return (
                        <button
                          key={highlight.id}
                          className="absolute pointer-events-auto transition-all duration-200 cursor-pointer rounded-sm"
                          style={{
                            left: `${(highlight.rect_x || 0) * 100}%`,
                            top: `${(highlight.rect_y || 0) * 100}%`,
                            width: `${Math.max((highlight.rect_width || 0.1) * 100, 3)}%`,
                            height: `${Math.max((highlight.rect_height || 0.02) * 100, 1.5)}%`,
                            backgroundColor: hexToRgba(highlightColor, isSelected ? 0.4 : 0.2),
                            boxShadow: isSelected
                              ? `0 0 0 2px ${highlightColor}`
                              : 'none',
                            zIndex: 3,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = hexToRgba(highlightColor, 0.3);
                            e.currentTarget.style.boxShadow = `0 0 0 2px ${highlightColor}`;
                          }}
                          onMouseLeave={(e) => {
                            if (selectedHighlight?.id !== highlight.id) {
                              e.currentTarget.style.backgroundColor = hexToRgba(highlightColor, 0.2);
                              e.currentTarget.style.boxShadow = 'none';
                            }
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Clear any selected note to ensure highlight sidebar shows
                            setSelectedNote(null);
                            setSelectedHighlight(highlight);
                            console.log('[Highlight Click] Selected highlight:', highlight.id, highlight.highlighted_text);
                          }}
                          title={`${categoryConfig?.label || highlight.category}: ${highlight.highlighted_text}`}
                        />
                      );
                    })}

                    {/* Render dynamically found text matches (for props and non-character highlights) */}
                    {foundTextPositions.map((found, index) => {
                      const hexToRgba = (hex: string, alpha: number) => {
                        const r = parseInt(hex.slice(1, 3), 16);
                        const g = parseInt(hex.slice(3, 5), 16);
                        const b = parseInt(hex.slice(5, 7), 16);
                        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                      };

                      return (
                        <div
                          key={`found-${found.highlightId}-${index}`}
                          className="absolute rounded-sm pointer-events-none"
                          style={{
                            left: `${found.rect.x * 100}%`,
                            top: `${found.rect.y * 100}%`,
                            width: `${Math.max(found.rect.width * 100, 2)}%`,
                            height: `${Math.max(found.rect.height * 100, 1.5)}%`,
                            backgroundColor: hexToRgba(found.color, 0.2),
                          }}
                          title={`${BREAKDOWN_CATEGORY_CONFIG[found.category as BacklotBreakdownItemType]?.label || found.category}: ${found.text}`}
                        />
                      );
                    })}
                  </div>
                )}

                {/* New note position marker */}
                {isAddingNote && newNotePosition && (
                  <div
                    className="absolute w-6 h-6 bg-accent-yellow rounded-full border-2 border-white shadow-lg flex items-center justify-center animate-pulse"
                    style={{
                      left: `${newNotePosition.x * 100}%`,
                      top: `${newNotePosition.y * 100}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <MessageSquarePlus className="w-3 h-3 text-charcoal-black" />
                  </div>
                )}

                {/* Text selection category picker popover */}
                {isBreakdownMode && textSelection && highlightPopoverOpen && textSelection.rect && (
                  <div
                    className="absolute z-50"
                    style={{
                      left: `${textSelection.rect.x * 100}%`,
                      top: `${(textSelection.rect.y + textSelection.rect.height) * 100}%`,
                    }}
                  >
                    <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg shadow-xl p-3 mt-2 min-w-[280px]">
                      <div className="text-sm font-medium text-bone-white mb-2 flex items-center gap-2">
                        <Highlighter className="w-4 h-4 text-accent-yellow" />
                        Create Breakdown Item
                      </div>
                      <div className="text-xs text-muted-gray mb-3 p-2 bg-black/30 rounded">
                        "{textSelection.text.slice(0, 50)}{textSelection.text.length > 50 ? '...' : ''}"
                      </div>

                      {/* Scene selector - only show if multiple scenes on this page */}
                      {scenesOnCurrentPage.length > 1 && (
                        <div className="mb-3">
                          <label className="text-xs text-muted-gray mb-1 block">Add to Scene:</label>
                          <select
                            value={selectedSceneForHighlight || ''}
                            onChange={(e) => setSelectedSceneForHighlight(e.target.value)}
                            className="w-full text-xs bg-black/30 border border-muted-gray/30 rounded px-2 py-1.5 text-bone-white"
                          >
                            {scenesOnCurrentPage.map((scene) => (
                              <option key={scene.id} value={scene.id}>
                                Scene {scene.scene_number}: {scene.slugline?.slice(0, 30) || 'Untitled'}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <ScrollArea className="max-h-[240px]">
                        <div className="grid grid-cols-2 gap-1">
                          {(Object.entries(BREAKDOWN_CATEGORY_CONFIG) as [BacklotBreakdownItemType, { icon: React.ReactNode; label: string; color: string }][]).map(([category, config]) => (
                            <button
                              key={category}
                              onClick={() => handleCreateHighlight(category)}
                              className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-muted-gray/20 transition-colors text-left"
                            >
                              <span
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: config.color }}
                              />
                              <span className="truncate">{config.label}</span>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                      <div className="flex justify-end mt-2 pt-2 border-t border-muted-gray/20">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setTextSelection(null);
                            setHighlightPopoverOpen(false);
                            window.getSelection()?.removeAllRanges();
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Breakdown mode indicator */}
                {isBreakdownMode && (
                  <div className="absolute top-2 left-2 px-2 py-1 bg-accent-yellow/90 text-charcoal-black text-xs font-medium rounded flex items-center gap-1">
                    <Highlighter className="w-3 h-3" />
                    Breakdown Mode - Select text to create items
                  </div>
                )}
              </div>
            </Document>
          )}
        </div>

        {/* Notes detail panel (when note is selected) - comprehensive view for all users */}
        {selectedNote && (
          <div className="w-80 border-l border-muted-gray/20 overflow-y-auto bg-black/10">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-muted-gray/20">
              <h3 className="text-sm font-medium text-bone-white">Note Details</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedNote(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-4 space-y-4">
              {/* Author section */}
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {selectedNote.author?.avatar_url ? (
                    <AvatarImage src={selectedNote.author.avatar_url} alt={selectedNote.author.display_name || selectedNote.author.username || 'User'} />
                  ) : null}
                  <AvatarFallback className="bg-muted-gray/30 text-bone-white">
                    {selectedNote.author?.display_name?.[0] || selectedNote.author?.username?.[0] || <User className="w-4 h-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-bone-white truncate">
                    {selectedNote.author?.display_name || selectedNote.author?.full_name || selectedNote.author?.username || 'Unknown User'}
                  </p>
                  <p className="text-xs text-muted-gray flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(selectedNote.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>

              {/* Type and status badges */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={cn('text-xs', NOTE_TYPE_BG_COLORS[selectedNote.note_type])}>
                  {SCRIPT_PAGE_NOTE_TYPE_LABELS[selectedNote.note_type]}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Page {selectedNote.page_number}
                </Badge>
                {selectedNote.resolved && (
                  <Badge variant="outline" className="text-green-500 text-xs border-green-500/30">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Resolved
                  </Badge>
                )}
              </div>

              {/* Note content */}
              <div className="bg-black/30 rounded-lg p-3 border border-muted-gray/20">
                <p className="text-sm text-bone-white whitespace-pre-wrap leading-relaxed">
                  {selectedNote.note_text}
                </p>
              </div>

              {/* Resolved info (if resolved) */}
              {selectedNote.resolved && selectedNote.resolved_at && (
                <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
                  <div className="flex items-center gap-2 text-xs text-green-400 mb-1">
                    <CheckCircle className="w-3 h-3" />
                    Resolved
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedNote.resolved_by && (
                      <>
                        <Avatar className="h-5 w-5">
                          {selectedNote.resolved_by.avatar_url ? (
                            <AvatarImage src={selectedNote.resolved_by.avatar_url} />
                          ) : null}
                          <AvatarFallback className="bg-green-500/20 text-green-400 text-[10px]">
                            {selectedNote.resolved_by.display_name?.[0] || selectedNote.resolved_by.username?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-gray">
                          by {selectedNote.resolved_by.display_name || selectedNote.resolved_by.username}
                        </span>
                      </>
                    )}
                    <span className="text-xs text-muted-gray ml-auto">
                      {new Date(selectedNote.resolved_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              )}

              {/* Action buttons (only for users who can edit) */}
              {canEdit && (
                <div className="flex flex-col gap-2 pt-3 border-t border-muted-gray/20">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleResolved(selectedNote)}
                    className={cn(
                      "w-full justify-start",
                      !selectedNote.resolved && "text-green-400 hover:text-green-300 hover:bg-green-500/10 border-green-400/30"
                    )}
                  >
                    {selectedNote.resolved ? (
                      <>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reopen Note
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Mark as Resolved
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteNote(selectedNote.id)}
                    className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-400/30"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Note
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Highlight detail sidebar (when highlight is selected) */}
        {selectedHighlight && !selectedNote && (
          <div className="w-80 border-l border-muted-gray/20 overflow-y-auto bg-black/10 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-muted-gray/20">
              <h3 className="text-sm font-medium text-bone-white">Breakdown Item</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedHighlight(null);
                  setIsEditingHighlight(false);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Highlighted text preview */}
              <div className="p-3 bg-black/30 rounded-lg">
                <p className="text-xs text-muted-gray mb-1">Highlighted Text</p>
                <p className="text-sm text-bone-white italic">"{selectedHighlight.highlighted_text}"</p>
              </div>

              {/* Edit mode or display mode */}
              {isEditingHighlight ? (
                <div className="space-y-3">
                  {/* Edit Label */}
                  <div>
                    <label className="text-xs text-muted-gray mb-1 block">Label</label>
                    <Input
                      value={editHighlightLabel}
                      onChange={(e) => setEditHighlightLabel(e.target.value)}
                      className="text-sm"
                      placeholder="Enter label..."
                    />
                  </div>

                  {/* Edit Category */}
                  <div>
                    <label className="text-xs text-muted-gray mb-1 block">Category</label>
                    <select
                      value={editHighlightCategory}
                      onChange={(e) => setEditHighlightCategory(e.target.value as BacklotBreakdownItemType)}
                      className="w-full text-sm bg-black/30 border border-muted-gray/30 rounded px-2 py-1.5 text-bone-white"
                    >
                      {(Object.entries(BREAKDOWN_CATEGORY_CONFIG) as [BacklotBreakdownItemType, { label: string; color: string }][]).map(([cat, config]) => (
                        <option key={cat} value={cat}>{config.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Edit Scene */}
                  <div>
                    <label className="text-xs text-muted-gray mb-1 block">Scene</label>
                    <select
                      value={editHighlightSceneId}
                      onChange={(e) => setEditHighlightSceneId(e.target.value)}
                      className="w-full text-sm bg-black/30 border border-muted-gray/30 rounded px-2 py-1.5 text-bone-white"
                    >
                      <option value="">Select scene...</option>
                      {scenes?.sort((a, b) => (a.sequence || 0) - (b.sequence || 0)).map((scene) => (
                        <option key={scene.id} value={scene.id}>
                          Scene {scene.scene_number}: {scene.slugline?.slice(0, 25) || 'Untitled'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Save/Cancel buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingHighlight(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await updateHighlight.mutateAsync({
                            scriptId: script.id,
                            highlightId: selectedHighlight.id,
                            suggested_label: editHighlightLabel || undefined,
                            category: editHighlightCategory || undefined,
                            scene_id: editHighlightSceneId || undefined,
                          });
                          toast({
                            title: 'Updated',
                            description: 'Breakdown item updated',
                          });
                          setIsEditingHighlight(false);
                        } catch (error) {
                          toast({
                            title: 'Error',
                            description: 'Failed to update',
                            variant: 'destructive',
                          });
                        }
                      }}
                      className="flex-1 bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
                    >
                      <Save className="w-3 h-3 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Display Label */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-gray">Label</p>
                      <p className="text-sm font-medium text-bone-white">
                        {selectedHighlight.suggested_label || selectedHighlight.highlighted_text}
                      </p>
                    </div>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditHighlightLabel(selectedHighlight.suggested_label || selectedHighlight.highlighted_text);
                          setEditHighlightCategory(selectedHighlight.category);
                          setEditHighlightSceneId(selectedHighlight.scene_id || '');
                          setIsEditingHighlight(true);
                        }}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                    )}
                  </div>

                  {/* Display Category */}
                  <div>
                    <p className="text-xs text-muted-gray mb-1">Category</p>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: BREAKDOWN_CATEGORY_CONFIG[selectedHighlight.category]?.color }}
                      />
                      <span className="text-sm text-bone-white">
                        {BREAKDOWN_CATEGORY_CONFIG[selectedHighlight.category]?.label}
                      </span>
                    </div>
                  </div>

                  {/* Display Scene */}
                  <div>
                    <p className="text-xs text-muted-gray mb-1">Scene</p>
                    <p className="text-sm text-bone-white">
                      {scenes?.find(s => s.id === selectedHighlight.scene_id)?.scene_number
                        ? `Scene ${scenes.find(s => s.id === selectedHighlight.scene_id)?.scene_number}`
                        : 'Not assigned'}
                    </p>
                  </div>

                  {/* Status */}
                  <div>
                    <p className="text-xs text-muted-gray mb-1">Status</p>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs',
                        selectedHighlight.status === 'confirmed' && 'text-green-400 border-green-400/30',
                        selectedHighlight.status === 'pending' && 'text-yellow-400 border-yellow-400/30',
                        selectedHighlight.status === 'rejected' && 'text-red-400 border-red-400/30'
                      )}
                    >
                      {selectedHighlight.status}
                    </Badge>
                  </div>

                  {/* Page number */}
                  <div>
                    <p className="text-xs text-muted-gray mb-1">Page</p>
                    <p className="text-sm text-bone-white">{selectedHighlight.page_number}</p>
                  </div>
                </div>
              )}

              {/* Internal Notes Section */}
              <div className="border-t border-muted-gray/20 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <MessageCircle className="w-4 h-4 text-muted-gray" />
                  <h4 className="text-sm font-medium text-bone-white">Internal Notes</h4>
                </div>

                {/* Notes list */}
                <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                  {notesLoadingHighlight ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-gray" />
                    </div>
                  ) : highlightNotes.length === 0 ? (
                    <p className="text-xs text-muted-gray text-center py-2">No notes yet</p>
                  ) : (
                    highlightNotes.map((note) => (
                      <div key={note.id} className="p-2 bg-black/20 rounded text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-muted-gray">
                            {note.profiles?.display_name || note.profiles?.full_name || 'Unknown'}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-muted-gray/60">
                              {new Date(note.created_at).toLocaleDateString()}
                            </span>
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 text-red-400 hover:text-red-300"
                                onClick={async () => {
                                  try {
                                    await deleteHighlightNote.mutateAsync({
                                      scriptId: script.id,
                                      highlightId: selectedHighlight.id,
                                      noteId: note.id,
                                    });
                                  } catch (error) {
                                    toast({
                                      title: 'Error',
                                      description: 'Failed to delete note',
                                      variant: 'destructive',
                                    });
                                  }
                                }}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <p className="text-bone-white whitespace-pre-wrap">{note.content}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Add note input */}
                {canEdit && (
                  <div className="flex gap-2">
                    <Textarea
                      value={newHighlightNote}
                      onChange={(e) => setNewHighlightNote(e.target.value)}
                      placeholder="Add a note..."
                      className="text-xs min-h-[60px] resize-none"
                    />
                    <Button
                      size="sm"
                      disabled={!newHighlightNote.trim() || createHighlightNote.isPending}
                      onClick={async () => {
                        if (!newHighlightNote.trim()) return;
                        try {
                          await createHighlightNote.mutateAsync({
                            scriptId: script.id,
                            highlightId: selectedHighlight.id,
                            content: newHighlightNote.trim(),
                          });
                          setNewHighlightNote('');
                        } catch (error) {
                          toast({
                            title: 'Error',
                            description: 'Failed to add note',
                            variant: 'destructive',
                          });
                        }
                      }}
                      className="self-end"
                    >
                      {createHighlightNote.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              {canEdit && (
                <div className="border-t border-muted-gray/20 pt-4 space-y-2">
                  {selectedHighlight.status === 'pending' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await confirmHighlight.mutateAsync({
                            scriptId: script.id,
                            highlightId: selectedHighlight.id,
                          });
                          toast({
                            title: 'Confirmed',
                            description: 'Breakdown item confirmed',
                          });
                        } catch (error) {
                          toast({
                            title: 'Error',
                            description: 'Failed to confirm',
                            variant: 'destructive',
                          });
                        }
                      }}
                      className="w-full justify-start text-green-400 hover:text-green-300 hover:bg-green-500/10"
                    >
                      <Check className="w-3 h-3 mr-2" />
                      Confirm Breakdown
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteHighlight(selectedHighlight.id)}
                    className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-3 h-3 mr-2" />
                    Delete Highlight
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-muted-gray/20 bg-black/20">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={goToFirstPage} disabled={currentPage <= 1}>
            <ChevronsLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToPrevPage} disabled={currentPage <= 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={numPages}
              value={currentPage}
              onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
              className="w-16 h-8 text-center text-sm"
            />
            <span className="text-sm text-muted-gray">of {numPages}</span>
          </div>

          <Button variant="ghost" size="sm" onClick={goToNextPage} disabled={currentPage >= numPages}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToLastPage} disabled={currentPage >= numPages}>
            <ChevronsRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Current page note summary */}
        <div className="flex items-center gap-4 text-sm text-muted-gray">
          {currentPageSummary && currentPageSummary.note_count > 0 ? (
            <>
              <span>{currentPageSummary.note_count} note{currentPageSummary.note_count !== 1 ? 's' : ''}</span>
              {currentPageSummary.unresolved_count > 0 && (
                <Badge variant="outline" className="text-orange-400">
                  {currentPageSummary.unresolved_count} unresolved
                </Badge>
              )}
            </>
          ) : (
            <span>No notes on this page</span>
          )}
        </div>
      </div>

      {/* New note dialog */}
      <Dialog
        open={newNotePosition !== null}
        onOpenChange={(open) => !open && setNewNotePosition(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note to Page {currentPage}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-muted-gray mb-2 block">
                Note Type
              </label>
              <Select
                value={newNoteType}
                onValueChange={(v) => setNewNoteType(v as BacklotScriptPageNoteType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SCRIPT_PAGE_NOTE_TYPE_LABELS).map(([type, label]) => (
                    <SelectItem key={type} value={type}>
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'w-3 h-3 rounded-full',
                            NOTE_TYPE_BG_COLORS[type as BacklotScriptPageNoteType]
                          )}
                        />
                        {label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-gray mb-2 block">
                Note Text
              </label>
              <Textarea
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Enter your note..."
                rows={4}
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewNotePosition(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateNote}
              disabled={!newNoteText.trim() || createNote.isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {createNote.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Add Note'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScriptPDFViewer;
