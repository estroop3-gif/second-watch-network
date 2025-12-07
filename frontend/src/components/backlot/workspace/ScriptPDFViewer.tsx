/**
 * ScriptPDFViewer - Full script viewer with PDF rendering and annotations
 * Allows page-by-page viewing and annotation overlays
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
} from '@/hooks/backlot';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Import PDF.js styles
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

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
    <Popover open={isSelected} onOpenChange={(open) => !open && onClick()}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={cn(
            'absolute flex items-center justify-center cursor-pointer transition-all duration-200 z-10',
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
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        className="w-80 p-0 bg-charcoal-black border-muted-gray/30"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 space-y-3">
          {/* Header with type badge */}
          <div className="flex items-center justify-between">
            <Badge className={cn('text-xs', bgColor)}>
              {SCRIPT_PAGE_NOTE_TYPE_LABELS[note.note_type]}
            </Badge>
            {note.resolved && (
              <Badge variant="outline" className="text-green-500 text-xs border-green-500/30">
                <Check className="w-3 h-3 mr-1" />
                Resolved
              </Badge>
            )}
          </div>

          {/* Note content */}
          <div className="bg-black/30 rounded-lg p-3">
            <p className="text-sm text-bone-white whitespace-pre-wrap">{note.note_text}</p>
          </div>

          {/* Meta info */}
          <div className="text-xs text-muted-gray flex items-center gap-2">
            <StickyNote className="w-3 h-3" />
            Page {note.page_number}
            {note.author && (
              <>
                <span className="mx-1">•</span>
                {note.author.display_name || note.author.username}
              </>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
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

  // Data hooks
  const { notes, isLoading: notesLoading } = useScriptPageNotes({
    scriptId: script.id,
    page_number: currentPage,
    note_type: noteTypeFilter,
    resolved: showResolved ? undefined : false,
  });

  const { data: notesSummary } = useScriptPageNotesSummary(script.id);
  const { createNote, updateNote, deleteNote, toggleResolved } = useScriptPageNoteMutations();

  // Highlight hooks
  const { highlights, isLoading: highlightsLoading } = useScriptHighlights(script.id, currentPage);
  const { createHighlight, updateHighlight, deleteHighlight, confirmHighlight } = useScriptHighlightMutations();
  const { scenes } = useScenes(script.id);

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
    setHighlightPopoverOpen(true);
  }, [isBreakdownMode, canEdit]);

  // Create breakdown highlight
  const handleCreateHighlight = async (category: BacklotBreakdownItemType) => {
    if (!textSelection) return;

    try {
      await createHighlight.mutateAsync({
        scriptId: script.id,
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
      <div className="flex items-center justify-between px-4 py-2 border-b border-muted-gray/20 bg-black/20">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-medium text-bone-white truncate max-w-[300px]">
            {script.title}
          </h2>
          {script.version && (
            <Badge variant="outline" className="text-xs">
              v{script.version}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
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

                {/* Breakdown highlight overlays - visible directly on the PDF */}
                {showHighlights && !highlightsLoading && highlights && (
                  <div className="absolute inset-0 pointer-events-none">
                    {highlights.map((highlight) => {
                      const categoryConfig = BREAKDOWN_CATEGORY_CONFIG[highlight.category];
                      const highlightColor = highlight.color || categoryConfig?.color || '#FFFF00';

                      return (
                        <Popover key={highlight.id} open={selectedHighlight?.id === highlight.id} onOpenChange={(open) => !open && setSelectedHighlight(null)}>
                          <PopoverTrigger asChild>
                            <button
                              className="absolute pointer-events-auto transition-all duration-200 cursor-pointer rounded-sm"
                              style={{
                                left: `${(highlight.rect_x || 0) * 100}%`,
                                top: `${(highlight.rect_y || 0) * 100}%`,
                                width: `${Math.max((highlight.rect_width || 0.1) * 100, 3)}%`,
                                height: `${Math.max((highlight.rect_height || 0.02) * 100, 1.5)}%`,
                                backgroundColor: highlightColor,
                                opacity: selectedHighlight?.id === highlight.id ? 0.7 : 0.5,
                                boxShadow: selectedHighlight?.id === highlight.id
                                  ? `0 0 0 2px ${highlightColor}, 0 2px 8px rgba(0,0,0,0.3)`
                                  : `0 1px 3px rgba(0,0,0,0.2)`,
                                border: `1px solid ${highlightColor}`,
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.opacity = '0.7';
                                e.currentTarget.style.boxShadow = `0 0 0 2px ${highlightColor}, 0 2px 8px rgba(0,0,0,0.3)`;
                              }}
                              onMouseLeave={(e) => {
                                if (selectedHighlight?.id !== highlight.id) {
                                  e.currentTarget.style.opacity = '0.5';
                                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
                                }
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedHighlight(highlight);
                              }}
                            />
                          </PopoverTrigger>
                          <PopoverContent
                            side="top"
                            align="start"
                            className="w-72 p-0 bg-charcoal-black border-muted-gray/30"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="p-3 space-y-2">
                              {/* Category header */}
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-4 h-4 rounded-full flex items-center justify-center"
                                  style={{ backgroundColor: highlightColor }}
                                >
                                  {categoryConfig?.icon}
                                </span>
                                <span className="font-medium text-bone-white text-sm">
                                  {categoryConfig?.label || highlight.category}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-[10px] ml-auto',
                                    highlight.status === 'confirmed' && 'text-green-400 border-green-400/30',
                                    highlight.status === 'pending' && 'text-yellow-400 border-yellow-400/30',
                                    highlight.status === 'rejected' && 'text-red-400 border-red-400/30'
                                  )}
                                >
                                  {highlight.status}
                                </Badge>
                              </div>

                              {/* Highlighted text */}
                              <div className="bg-black/30 rounded p-2 border-l-2" style={{ borderColor: highlightColor }}>
                                <p className="text-sm text-bone-white">"{highlight.highlighted_text}"</p>
                              </div>

                              {/* Suggested label if different */}
                              {highlight.suggested_label && highlight.suggested_label !== highlight.highlighted_text && (
                                <div className="text-xs text-muted-gray">
                                  <span className="font-medium">Label:</span> {highlight.suggested_label}
                                </div>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
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

        {/* Notes action panel (when note is selected) - compact version since popover shows content */}
        {selectedNote && canEdit && (
          <div className="w-64 border-l border-muted-gray/20 p-4 overflow-y-auto bg-black/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-bone-white">Note Actions</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedNote(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3">
              {/* Type indicator */}
              <div className="flex items-center gap-2">
                <Badge className={cn('text-xs', NOTE_TYPE_BG_COLORS[selectedNote.note_type])}>
                  {SCRIPT_PAGE_NOTE_TYPE_LABELS[selectedNote.note_type]}
                </Badge>
                {selectedNote.resolved && (
                  <Badge variant="outline" className="text-green-500 text-xs">
                    Resolved
                  </Badge>
                )}
              </div>

              {/* Quick preview */}
              <p className="text-xs text-muted-gray line-clamp-2">
                {selectedNote.note_text}
              </p>

              {/* Action buttons */}
              <div className="flex flex-col gap-2 pt-2 border-t border-muted-gray/20">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleResolved(selectedNote)}
                  className="w-full justify-start"
                >
                  {selectedNote.resolved ? (
                    <>
                      <RotateCcw className="w-3 h-3 mr-2" />
                      Reopen Note
                    </>
                  ) : (
                    <>
                      <Check className="w-3 h-3 mr-2" />
                      Mark as Resolved
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteNote(selectedNote.id)}
                  className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="w-3 h-3 mr-2" />
                  Delete Note
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Highlight actions panel (when highlight is selected) - compact version */}
        {selectedHighlight && !selectedNote && canEdit && (
          <div className="w-64 border-l border-muted-gray/20 p-4 overflow-y-auto bg-black/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-bone-white">Breakdown Actions</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedHighlight(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3">
              {/* Category indicator */}
              <div className="flex items-center gap-2">
                <span
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: BREAKDOWN_CATEGORY_CONFIG[selectedHighlight.category]?.color }}
                />
                <span className="font-medium text-sm text-bone-white">
                  {BREAKDOWN_CATEGORY_CONFIG[selectedHighlight.category]?.label}
                </span>
              </div>

              {/* Quick preview */}
              <p className="text-xs text-muted-gray line-clamp-2 italic">
                "{selectedHighlight.highlighted_text}"
              </p>

              {/* Status badge */}
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

              {/* Action buttons */}
              <div className="flex flex-col gap-2 pt-2 border-t border-muted-gray/20">
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
