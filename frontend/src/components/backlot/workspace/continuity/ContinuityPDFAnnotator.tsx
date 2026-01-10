/**
 * ContinuityPDFAnnotator - PDF Viewer with Persistent Annotations
 *
 * PDF.js-based viewer with annotation tools (highlight, pen, text, notes)
 * that save to the database per export version.
 */
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Loader2,
  MessageSquare,
  Highlighter,
  Pencil,
  Download,
  Printer,
  MousePointer2,
  Trash2,
  Undo2,
  Redo2,
  StickyNote,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import {
  useExportAnnotations,
  useCreateExportHighlight,
  useCreateExportNote,
  useCreateExportDrawing,
  useDeleteExportHighlight,
  useDeleteExportNote,
  useDeleteExportDrawing,
  useUpdateExportNote,
  ExportHighlight,
  ExportNote,
  ExportDrawing,
  PathPoint,
} from '@/hooks/backlot/useContinuityExportAnnotations';
import { useToast } from '@/hooks/use-toast';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Import PDF.js styles
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Tool types
type AnnotationTool = 'select' | 'highlight' | 'pen' | 'text' | 'note';

// Colors
const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#FFEB3B' },
  { name: 'Green', value: '#4CAF50' },
  { name: 'Blue', value: '#2196F3' },
  { name: 'Pink', value: '#E91E63' },
  { name: 'Orange', value: '#FF9800' },
];

const PEN_COLORS = [
  { name: 'Red', value: '#FF3C3C' },
  { name: 'Blue', value: '#2196F3' },
  { name: 'Green', value: '#4CAF50' },
  { name: 'Black', value: '#000000' },
  { name: 'Yellow', value: '#FFEB3B' },
];

const NOTE_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'continuity', label: 'Continuity' },
  { value: 'blocking', label: 'Blocking' },
  { value: 'props', label: 'Props' },
  { value: 'wardrobe', label: 'Wardrobe' },
  { value: 'makeup', label: 'Makeup' },
  { value: 'camera', label: 'Camera' },
  { value: 'sound', label: 'Sound' },
];

interface ContinuityPDFAnnotatorProps {
  projectId: string;
  exportId: string;
  fileUrl: string;
  initialPage?: number;
  onPageChange?: (page: number) => void;
  canEdit?: boolean;
}

const ContinuityPDFAnnotator: React.FC<ContinuityPDFAnnotatorProps> = ({
  projectId,
  exportId,
  fileUrl,
  initialPage = 1,
  onPageChange,
  canEdit = true,
}) => {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);

  // PDF state
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [scale, setScale] = useState(1.0);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });

  // Tool state
  const [activeTool, setActiveTool] = useState<AnnotationTool>('select');
  const [highlightColor, setHighlightColor] = useState('#FFEB3B');
  const [penColor, setPenColor] = useState('#FF3C3C');
  const [penWidth, setPenWidth] = useState(2);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<PathPoint[]>([]);
  const [highlightStart, setHighlightStart] = useState<PathPoint | null>(null);
  const [highlightEnd, setHighlightEnd] = useState<PathPoint | null>(null);

  // Note popover state - notes are click-to-place pin markers
  const [notePosition, setNotePosition] = useState<PathPoint | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showNotePopover, setShowNotePopover] = useState(false);
  const [hoveredNote, setHoveredNote] = useState<string | null>(null);

  // Note edit panel state
  const [editingNote, setEditingNote] = useState<ExportNote | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [editNoteCategory, setEditNoteCategory] = useState('general');

  // Selected annotation for deletion
  const [selectedAnnotation, setSelectedAnnotation] = useState<{
    type: 'highlight' | 'note' | 'drawing';
    id: string;
  } | null>(null);

  // Undo/Redo stacks - stores annotation data for recreation
  type UndoAction = {
    type: 'create' | 'delete';
    annotationType: 'highlight' | 'note' | 'drawing';
    id?: string; // For create actions, store the ID to delete on undo
    data: any;
  };
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [redoStack, setRedoStack] = useState<UndoAction[]>([]);

  // Store fileUrl in a ref to prevent PDF reload on annotation changes
  const fileUrlRef = useRef(fileUrl);
  useEffect(() => {
    fileUrlRef.current = fileUrl;
  }, [fileUrl]);

  // Memoize fileUrl to prevent unnecessary PDF reloads
  const stableFileUrl = useMemo(() => fileUrl, [fileUrl]);

  // Fetch annotations - use stable reference to prevent re-renders
  const annotationsQuery = useExportAnnotations(
    projectId,
    exportId,
    currentPage
  );
  const { highlights, notes, drawings, isLoading: annotationsLoading } = annotationsQuery;

  // Mutation hooks
  const createHighlight = useCreateExportHighlight(projectId, exportId);
  const createNote = useCreateExportNote(projectId, exportId);
  const createDrawing = useCreateExportDrawing(projectId, exportId);
  const deleteHighlight = useDeleteExportHighlight(projectId, exportId);
  const deleteNote = useDeleteExportNote(projectId, exportId);
  const deleteDrawing = useDeleteExportDrawing(projectId, exportId);
  const updateNote = useUpdateExportNote(projectId, exportId);

  // PDF document loaded
  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPdfError(null);
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('Error loading PDF:', error);
    setPdfError('Failed to load PDF');
  }, []);

  // Page rendered - get dimensions
  const onPageLoadSuccess = useCallback((page: any) => {
    const viewport = page.getViewport({ scale: 1 });
    setPageSize({ width: viewport.width, height: viewport.height });
  }, []);

  // Page navigation
  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page);
      onPageChange?.(page);
    }
  }, [numPages, onPageChange]);

  // Zoom controls
  const zoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const zoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));

  // Convert screen coordinates to percentage of page
  const screenToPercent = useCallback((clientX: number, clientY: number): PathPoint | null => {
    if (!pageContainerRef.current) return null;
    const rect = pageContainerRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  }, []);

  // Handle mouse down on canvas
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!canEdit) return;
    const point = screenToPercent(e.clientX, e.clientY);
    if (!point) return;

    if (activeTool === 'highlight') {
      setHighlightStart(point);
      setIsDrawing(true);
    } else if (activeTool === 'pen') {
      setCurrentPath([point]);
      setIsDrawing(true);
    } else if (activeTool === 'note') {
      // Notes are click-to-place pin markers
      setNotePosition(point);
      setShowNotePopover(true);
    }
  }, [activeTool, canEdit, screenToPercent]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !canEdit) return;
    const point = screenToPercent(e.clientX, e.clientY);
    if (!point) return;

    if (activeTool === 'pen') {
      setCurrentPath((prev) => [...prev, point]);
    } else if (activeTool === 'highlight') {
      setHighlightEnd(point);
    }
  }, [isDrawing, activeTool, canEdit, screenToPercent]);

  // Temporary highlight being drawn (for visual feedback during save)
  const [tempHighlight, setTempHighlight] = useState<{x: number; y: number; width: number; height: number} | null>(null);

  // Handle mouse up
  const handleMouseUp = useCallback(async (e: React.MouseEvent) => {
    if (!isDrawing || !canEdit) return;
    const point = screenToPercent(e.clientX, e.clientY);
    if (!point) return;

    setIsDrawing(false);
    setHighlightEnd(null);

    if (activeTool === 'highlight' && highlightStart) {
      // Create highlight rectangle
      const x = Math.min(highlightStart.x, point.x);
      const y = Math.min(highlightStart.y, point.y);
      const width = Math.abs(point.x - highlightStart.x);
      const height = Math.abs(point.y - highlightStart.y);

      if (width > 1 && height > 1) {
        // Keep showing the highlight while saving
        setTempHighlight({ x, y, width, height });
        setHighlightStart(null);

        try {
          const result = await createHighlight.mutateAsync({
            page_number: currentPage,
            x,
            y,
            width,
            height,
            color: highlightColor,
            opacity: 0.3,
          });
          // Add to undo stack with the new ID
          if (result?.id) {
            setUndoStack((prev) => [...prev, {
              type: 'create',
              annotationType: 'highlight',
              id: result.id,
              data: { page_number: currentPage, x, y, width, height, color: highlightColor, opacity: 0.3 },
            }]);
            setRedoStack([]);
          }
        } catch (err) {
          toast({ title: 'Failed to save highlight', variant: 'destructive' });
        }
        // Clear temp highlight after save (data will be refetched)
        setTempHighlight(null);
      } else {
        setHighlightStart(null);
      }
    } else if (activeTool === 'pen' && currentPath.length > 1) {
      // Keep the path visible - don't clear it yet
      const pathToSave = [...currentPath];

      try {
        const result = await createDrawing.mutateAsync({
          page_number: currentPage,
          tool_type: 'pen',
          path_data: { type: 'pen', points: pathToSave },
          stroke_color: penColor,
          stroke_width: penWidth,
          opacity: 1,
        });
        // Add to undo stack with the new ID
        if (result?.id) {
          setUndoStack((prev) => [...prev, {
            type: 'create',
            annotationType: 'drawing',
            id: result.id,
            data: { page_number: currentPage, tool_type: 'pen', path_data: { type: 'pen', points: pathToSave }, stroke_color: penColor, stroke_width: penWidth, opacity: 1 },
          }]);
          setRedoStack([]);
        }
      } catch (err) {
        toast({ title: 'Failed to save drawing', variant: 'destructive' });
      }
      // Clear path after save completes (saved drawing will show from refetch)
      setCurrentPath([]);
    }
  }, [isDrawing, activeTool, highlightStart, currentPath, currentPage, highlightColor, penColor, penWidth, canEdit, screenToPercent, createHighlight, createDrawing, toast]);

  // Save note as pin marker
  const handleSaveNote = useCallback(async () => {
    if (!notePosition || !noteText.trim()) return;

    try {
      const result = await createNote.mutateAsync({
        page_number: currentPage,
        anchor_x: notePosition.x,
        anchor_y: notePosition.y,
        note_text: noteText.trim(),
        note_category: 'general',
      });
      // Add to undo stack
      if (result?.id) {
        setUndoStack((prev) => [...prev, {
          type: 'create',
          annotationType: 'note',
          id: result.id,
          data: { page_number: currentPage, anchor_x: notePosition.x, anchor_y: notePosition.y, note_text: noteText.trim(), note_category: 'general' },
        }]);
        setRedoStack([]);
      }
      toast({ title: 'Note saved' });
      setNoteText('');
      setShowNotePopover(false);
      setNotePosition(null);
    } catch (err) {
      toast({ title: 'Failed to save note', variant: 'destructive' });
    }
  }, [notePosition, noteText, currentPage, createNote, toast]);

  // Delete selected annotation
  const handleDelete = useCallback(async () => {
    if (!selectedAnnotation) return;

    try {
      // Find the annotation data to store for undo
      let annotationData: any = null;
      if (selectedAnnotation.type === 'highlight') {
        annotationData = highlights.find((h: ExportHighlight) => h.id === selectedAnnotation.id);
        await deleteHighlight.mutateAsync(selectedAnnotation.id);
      } else if (selectedAnnotation.type === 'note') {
        annotationData = notes.find((n: ExportNote) => n.id === selectedAnnotation.id);
        await deleteNote.mutateAsync(selectedAnnotation.id);
      } else if (selectedAnnotation.type === 'drawing') {
        annotationData = drawings.find((d: ExportDrawing) => d.id === selectedAnnotation.id);
        await deleteDrawing.mutateAsync(selectedAnnotation.id);
      }

      // Add to undo stack
      if (annotationData) {
        setUndoStack((prev) => [...prev, {
          type: 'delete',
          annotationType: selectedAnnotation.type,
          data: annotationData,
        }]);
        // Clear redo stack on new action
        setRedoStack([]);
      }

      toast({ title: 'Deleted (Ctrl+Z to undo)' });
      setSelectedAnnotation(null);
    } catch (err) {
      toast({ title: 'Failed to delete', variant: 'destructive' });
    }
  }, [selectedAnnotation, highlights, notes, drawings, deleteHighlight, deleteNote, deleteDrawing, toast]);

  // Populate form when editing note changes
  useEffect(() => {
    if (editingNote) {
      setEditNoteText(editingNote.note_text || '');
      setEditNoteCategory(editingNote.note_category || 'general');
    }
  }, [editingNote]);

  // Check if note form has changes
  const hasNoteChanges = editingNote && (
    editNoteText !== (editingNote.note_text || '') ||
    editNoteCategory !== (editingNote.note_category || 'general')
  );

  // Save note edits
  const handleSaveNoteEdit = useCallback(async () => {
    if (!editingNote || !hasNoteChanges) return;

    try {
      await updateNote.mutateAsync({
        noteId: editingNote.id,
        data: {
          note_text: editNoteText,
          note_category: editNoteCategory,
        },
      });
      toast({ title: 'Note updated' });
      setEditingNote(null);
      setSelectedAnnotation(null);
    } catch (err) {
      toast({ title: 'Failed to update note', variant: 'destructive' });
    }
  }, [editingNote, hasNoteChanges, editNoteText, editNoteCategory, updateNote, toast]);

  // Delete note from edit panel
  const handleDeleteEditingNote = useCallback(async () => {
    if (!editingNote) return;

    try {
      await deleteNote.mutateAsync(editingNote.id);
      toast({ title: 'Note deleted' });
      setEditingNote(null);
      setSelectedAnnotation(null);
    } catch (err) {
      toast({ title: 'Failed to delete note', variant: 'destructive' });
    }
  }, [editingNote, deleteNote, toast]);

  // Open note for editing
  const handleNoteClick = useCallback((note: ExportNote) => {
    setEditingNote(note);
    setSelectedAnnotation({ type: 'note', id: note.id });
  }, []);

  // Undo - delete the last created annotation or recreate the last deleted annotation
  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0) return;

    const lastAction = undoStack[undoStack.length - 1];

    try {
      if (lastAction.type === 'create' && lastAction.id) {
        // Undo a create = delete the annotation
        if (lastAction.annotationType === 'highlight') {
          await deleteHighlight.mutateAsync(lastAction.id);
        } else if (lastAction.annotationType === 'note') {
          await deleteNote.mutateAsync(lastAction.id);
        } else if (lastAction.annotationType === 'drawing') {
          await deleteDrawing.mutateAsync(lastAction.id);
        }

        // Move from undo to redo stack
        setUndoStack((prev) => prev.slice(0, -1));
        setRedoStack((prev) => [...prev, lastAction]);
        toast({ title: 'Undone' });
      } else if (lastAction.type === 'delete') {
        const data = lastAction.data;
        // Undo a delete = recreate the annotation
        let newId: string | undefined;
        if (lastAction.annotationType === 'highlight') {
          const result = await createHighlight.mutateAsync({
            page_number: data.page_number,
            x: data.x,
            y: data.y,
            width: data.width,
            height: data.height,
            color: data.color,
            opacity: data.opacity,
            text_content: data.text_content,
          });
          newId = result?.id;
        } else if (lastAction.annotationType === 'note') {
          const result = await createNote.mutateAsync({
            page_number: data.page_number,
            anchor_x: data.anchor_x,
            anchor_y: data.anchor_y,
            note_text: data.note_text,
            note_category: data.note_category,
            is_critical: data.is_critical,
          });
          newId = result?.id;
        } else if (lastAction.annotationType === 'drawing') {
          const result = await createDrawing.mutateAsync({
            page_number: data.page_number,
            tool_type: data.tool_type,
            path_data: data.path_data,
            stroke_color: data.stroke_color,
            stroke_width: data.stroke_width,
            fill_color: data.fill_color,
            opacity: data.opacity,
            text_content: data.text_content,
            font_size: data.font_size,
          });
          newId = result?.id;
        }

        // Move from undo to redo stack (update with new ID for redo)
        setUndoStack((prev) => prev.slice(0, -1));
        setRedoStack((prev) => [...prev, { ...lastAction, id: newId }]);
        toast({ title: 'Undone' });
      }
    } catch (err) {
      toast({ title: 'Failed to undo', variant: 'destructive' });
    }
  }, [undoStack, createHighlight, createNote, createDrawing, deleteHighlight, deleteNote, deleteDrawing, toast]);

  // Redo - reverse the undo action
  const handleRedo = useCallback(async () => {
    if (redoStack.length === 0) return;

    const lastAction = redoStack[redoStack.length - 1];

    try {
      if (lastAction.type === 'create') {
        // Redo a create = recreate the annotation
        const data = lastAction.data;
        let newId: string | undefined;
        if (lastAction.annotationType === 'highlight') {
          const result = await createHighlight.mutateAsync({
            page_number: data.page_number,
            x: data.x,
            y: data.y,
            width: data.width,
            height: data.height,
            color: data.color,
            opacity: data.opacity,
            text_content: data.text_content,
          });
          newId = result?.id;
        } else if (lastAction.annotationType === 'note') {
          const result = await createNote.mutateAsync({
            page_number: data.page_number,
            anchor_x: data.anchor_x,
            anchor_y: data.anchor_y,
            note_text: data.note_text,
            note_category: data.note_category,
            is_critical: data.is_critical,
            x: data.x,
            y: data.y,
            width: data.width,
            height: data.height,
            highlight_color: data.highlight_color,
          });
          newId = result?.id;
        } else if (lastAction.annotationType === 'drawing') {
          const result = await createDrawing.mutateAsync({
            page_number: data.page_number,
            tool_type: data.tool_type,
            path_data: data.path_data,
            stroke_color: data.stroke_color,
            stroke_width: data.stroke_width,
            fill_color: data.fill_color,
            opacity: data.opacity,
            text_content: data.text_content,
            font_size: data.font_size,
          });
          newId = result?.id;
        }

        // Move from redo to undo stack
        setRedoStack((prev) => prev.slice(0, -1));
        setUndoStack((prev) => [...prev, { ...lastAction, id: newId }]);
        toast({ title: 'Redone' });
      } else if (lastAction.type === 'delete' && lastAction.id) {
        // Redo a delete = delete the annotation again
        if (lastAction.annotationType === 'highlight') {
          await deleteHighlight.mutateAsync(lastAction.id);
        } else if (lastAction.annotationType === 'note') {
          await deleteNote.mutateAsync(lastAction.id);
        } else if (lastAction.annotationType === 'drawing') {
          await deleteDrawing.mutateAsync(lastAction.id);
        }

        // Move from redo to undo stack
        setRedoStack((prev) => prev.slice(0, -1));
        setUndoStack((prev) => [...prev, lastAction]);
        toast({ title: 'Redone' });
      }
    } catch (err) {
      toast({ title: 'Failed to redo', variant: 'destructive' });
    }
  }, [redoStack, createHighlight, createNote, createDrawing, deleteHighlight, deleteNote, deleteDrawing, toast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Delete selected annotation
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAnnotation) {
        e.preventDefault();
        handleDelete();
      }

      // Undo: Ctrl+Z
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }

      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) ||
          (e.key === 'y' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        handleRedo();
      }

      // Escape to deselect
      if (e.key === 'Escape') {
        setSelectedAnnotation(null);
        setActiveTool('select');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAnnotation, handleDelete, handleUndo, handleRedo]);

  // Download PDF
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = 'script.pdf';
    link.click();
  };

  // Print PDF
  const handlePrint = () => {
    const printWindow = window.open(fileUrl, '_blank');
    printWindow?.print();
  };

  // Render annotations SVG overlay
  const renderAnnotations = () => {
    if (!pageSize.width) return null;

    return (
      <svg
        className="absolute inset-0"
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {/* SVG filters */}
        <defs>
          <filter id="noteShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0.2" dy="0.2" stdDeviation="0.3" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* Highlights - light fill + colored bottom border (like Script tab) */}
        {highlights.map((h: ExportHighlight) => (
          <g key={h.id}>
            {/* Light semi-transparent fill */}
            <rect
              x={h.x}
              y={h.y}
              width={h.width}
              height={h.height}
              fill={h.color}
              fillOpacity={0.15}
              style={{ pointerEvents: 'auto', cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedAnnotation({ type: 'highlight', id: h.id });
              }}
            />
            {/* Colored bottom border */}
            <line
              x1={h.x}
              y1={h.y + h.height}
              x2={h.x + h.width}
              y2={h.y + h.height}
              stroke={h.color}
              strokeWidth={0.4}
              style={{ pointerEvents: 'none' }}
            />
            {/* Selection indicator */}
            {selectedAnnotation?.id === h.id && (
              <rect
                x={h.x}
                y={h.y}
                width={h.width}
                height={h.height}
                fill="none"
                stroke="#2196F3"
                strokeWidth={0.4}
                style={{ pointerEvents: 'none' }}
              />
            )}
          </g>
        ))}

        {/* Drawings */}
        {drawings.map((d: ExportDrawing) => {
          if (d.tool_type === 'pen' && d.path_data.type === 'pen') {
            const points = d.path_data.points;
            if (points.length < 2) return null;
            const pathD = points.map((p, i) =>
              `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
            ).join(' ');
            return (
              <g key={d.id}>
                {/* Invisible wider stroke for easier selection */}
                <path
                  d={pathD}
                  stroke="transparent"
                  strokeWidth={Math.max(d.stroke_width * 2, 3)}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAnnotation({ type: 'drawing', id: d.id });
                  }}
                />
                {/* Visible stroke */}
                <path
                  d={pathD}
                  stroke={selectedAnnotation?.id === d.id ? '#2196F3' : d.stroke_color}
                  strokeWidth={d.stroke_width * 0.3}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ pointerEvents: 'none' }}
                />
              </g>
            );
          }
          if (d.tool_type === 'text' && d.path_data.type === 'text') {
            return (
              <text
                key={d.id}
                x={d.path_data.x}
                y={d.path_data.y}
                fill={d.stroke_color}
                fontSize={d.font_size ? d.font_size * 0.15 : 2}
                className={cn(
                  'pointer-events-auto cursor-pointer',
                  selectedAnnotation?.id === d.id && 'stroke-1 stroke-blue-500'
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeTool === 'select') {
                    setSelectedAnnotation({ type: 'drawing', id: d.id });
                  }
                }}
              >
                {d.text_content}
              </text>
            );
          }
          return null;
        })}

        {/* Notes rendered as HTML in separate layer for proper styling */}

        {/* Highlight preview while dragging */}
        {highlightStart && highlightEnd && (
          <rect
            x={Math.min(highlightStart.x, highlightEnd.x)}
            y={Math.min(highlightStart.y, highlightEnd.y)}
            width={Math.abs(highlightEnd.x - highlightStart.x)}
            height={Math.abs(highlightEnd.y - highlightStart.y)}
            fill={highlightColor}
            fillOpacity={0.25}
            stroke={highlightColor}
            strokeWidth={0.3}
            strokeDasharray="2,1"
            style={{ pointerEvents: 'none' }}
          />
        )}

        {/* Temporary highlight while saving */}
        {tempHighlight && (
          <rect
            x={tempHighlight.x}
            y={tempHighlight.y}
            width={tempHighlight.width}
            height={tempHighlight.height}
            fill={highlightColor}
            fillOpacity={0.3}
            style={{ pointerEvents: 'none' }}
          />
        )}

        {/* Current pen stroke being drawn or saving */}
        {currentPath.length > 1 && (
          <path
            d={currentPath.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
            stroke={penColor}
            strokeWidth={penWidth * 0.3}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#3a3a3a]" ref={containerRef}>
      {/* Toolbar - Chrome-like style */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#323232] border-b border-[#555]">
        {/* Left: Page navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-300 hover:bg-[#444]"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={1}
              max={numPages}
              value={currentPage}
              onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
              className="w-12 h-7 text-center text-sm bg-[#3a3a3a] border-[#555] text-white"
            />
            <span className="text-sm text-gray-400">of {numPages}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-300 hover:bg-[#444]"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= numPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Center: Zoom */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-300 hover:bg-[#444]"
            onClick={zoomOut}
            disabled={scale <= 0.5}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Select value={`${Math.round(scale * 100)}`} onValueChange={(v) => setScale(parseInt(v) / 100)}>
            <SelectTrigger className="w-28 h-7 bg-[#3a3a3a] border-[#555] text-white text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50%</SelectItem>
              <SelectItem value="75">75%</SelectItem>
              <SelectItem value="100">100%</SelectItem>
              <SelectItem value="125">125%</SelectItem>
              <SelectItem value="150">150%</SelectItem>
              <SelectItem value="200">200%</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-300 hover:bg-[#444]"
            onClick={zoomIn}
            disabled={scale >= 3}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>

        {/* Right: Annotation tools & actions */}
        <div className="flex items-center gap-1">
          {/* Select tool */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-8 w-8 text-gray-300 hover:bg-[#444]',
                    activeTool === 'select' && 'bg-[#555]'
                  )}
                  onClick={() => setActiveTool('select')}
                >
                  <MousePointer2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Select</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="w-px h-6 bg-[#555]" />

          {/* Note tool */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-8 w-8 text-gray-300 hover:bg-[#444]',
                    activeTool === 'note' && 'bg-[#555]'
                  )}
                  onClick={() => setActiveTool('note')}
                  disabled={!canEdit}
                >
                  <MessageSquare className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add Note</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Highlight tool with color picker */}
          <Popover>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'h-8 w-8 text-gray-300 hover:bg-[#444]',
                        activeTool === 'highlight' && 'bg-[#555]'
                      )}
                      onClick={() => setActiveTool('highlight')}
                      disabled={!canEdit}
                    >
                      <Highlighter className="w-4 h-4" style={{ color: highlightColor }} />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>Highlight</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <PopoverContent className="w-auto p-2 bg-[#3a3a3a] border-[#555]">
              <div className="flex gap-1">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    className={cn(
                      'w-6 h-6 rounded border-2',
                      highlightColor === c.value ? 'border-white' : 'border-transparent'
                    )}
                    style={{ backgroundColor: c.value }}
                    onClick={() => {
                      setHighlightColor(c.value);
                      setActiveTool('highlight');
                    }}
                    title={c.name}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Pen tool with color picker */}
          <Popover>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'h-8 w-8 text-gray-300 hover:bg-[#444]',
                        activeTool === 'pen' && 'bg-[#555]'
                      )}
                      onClick={() => setActiveTool('pen')}
                      disabled={!canEdit}
                    >
                      <Pencil className="w-4 h-4" style={{ color: penColor }} />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>Draw</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <PopoverContent className="w-auto p-3 bg-[#3a3a3a] border-[#555]">
              <div className="space-y-3">
                <div className="flex gap-1">
                  {PEN_COLORS.map((c) => (
                    <button
                      key={c.value}
                      className={cn(
                        'w-6 h-6 rounded border-2',
                        penColor === c.value ? 'border-white' : 'border-transparent'
                      )}
                      style={{ backgroundColor: c.value }}
                      onClick={() => setPenColor(c.value)}
                      title={c.name}
                    />
                  ))}
                </div>
                <div>
                  <span className="text-xs text-gray-400">Width: {penWidth}px</span>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={penWidth}
                    onChange={(e) => setPenWidth(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Delete button (when annotation selected) */}
          {selectedAnnotation && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-400 hover:bg-red-500/20"
                    onClick={handleDelete}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete Selected (Del)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <div className="w-px h-6 bg-[#555]" />

          {/* Undo button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-300 hover:bg-[#444] disabled:opacity-30"
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                >
                  <Undo2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Redo button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-300 hover:bg-[#444] disabled:opacity-30"
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                >
                  <Redo2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="w-px h-6 bg-[#555]" />

          {/* Print */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-300 hover:bg-[#444]"
                  onClick={handlePrint}
                >
                  <Printer className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Print</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Download */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-300 hover:bg-[#444]"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto flex justify-center p-4 bg-[#525659] relative">
        {/* Floating selection indicator */}
        {selectedAnnotation && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-[#1a1a1a]/95 px-3 py-2 rounded-lg border border-gray-600 shadow-lg">
            <span className="text-sm text-gray-300 capitalize">
              {selectedAnnotation.type} selected
            </span>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 px-2"
              onClick={handleDelete}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Delete
            </Button>
            <span className="text-xs text-gray-500">or press Del</span>
          </div>
        )}

        {pdfError ? (
          <div className="text-center text-gray-400 py-12">
            <p>{pdfError}</p>
          </div>
        ) : (
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading PDF...</span>
              </div>
            }
          >
            <div
              ref={pageContainerRef}
              className={cn(
                "relative shadow-2xl",
                activeTool === 'select' && "cursor-default",
                activeTool === 'highlight' && "cursor-crosshair",
                activeTool === 'pen' && "cursor-crosshair",
                activeTool === 'note' && "cursor-crosshair"
              )}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => {
                if (isDrawing) {
                  setIsDrawing(false);
                  setCurrentPath([]);
                  setHighlightStart(null);
                  setHighlightEnd(null);
                }
              }}
            >
              <Page
                pageNumber={currentPage}
                scale={scale}
                onLoadSuccess={onPageLoadSuccess}
                renderTextLayer={true}
                renderAnnotationLayer={false}
              />
              {/* Annotations overlay */}
              {renderAnnotations()}

              {/* Note markers - HTML elements for proper styling like Script tab */}
              {notes.map((n: ExportNote) => (
                <div
                  key={n.id}
                  data-note-marker
                  className={cn(
                    "absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20",
                    "rounded-full flex items-center justify-center",
                    "shadow-lg border-2 border-white/80 hover:scale-110 transition-transform",
                    "bg-orange-500",
                    selectedAnnotation?.id === n.id && "ring-2 ring-accent-yellow ring-offset-2 ring-offset-white"
                  )}
                  style={{
                    left: `${n.anchor_x}%`,
                    top: `${n.anchor_y}%`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNoteClick(n);
                  }}
                  onMouseEnter={() => setHoveredNote(n.id)}
                  onMouseLeave={() => setHoveredNote(null)}
                  title={n.note_text.slice(0, 50) + (n.note_text.length > 50 ? '...' : '')}
                >
                  <StickyNote className="w-3 h-3 text-white" />
                </div>
              ))}
            </div>
          </Document>
        )}
      </div>

      {/* Note popover */}
      {showNotePopover && notePosition && (
        <div
          className="fixed z-50 bg-[#3a3a3a] border border-[#555] rounded-lg p-3 shadow-xl"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <p className="text-sm text-gray-300 mb-2">Add Note</p>
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Enter your note..."
            className="w-64 h-24 bg-[#2a2a2a] border-[#555] text-white text-sm"
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowNotePopover(false);
                setNotePosition(null);
                setNoteText('');
              }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveNote} disabled={!noteText.trim()}>
              Save
            </Button>
          </div>
        </div>
      )}

      {/* Note tooltip on hover */}
      {hoveredNote && !editingNote && (
        <div className="fixed z-50 bg-[#2a2a2a] border border-[#555] rounded-lg p-2 shadow-xl max-w-xs pointer-events-none" style={{ left: '50%', top: '40%', transform: 'translate(-50%, -50%)' }}>
          <p className="text-sm text-white whitespace-pre-wrap">
            {notes.find((n: ExportNote) => n.id === hoveredNote)?.note_text || ''}
          </p>
        </div>
      )}

      {/* Note Edit Panel - Slide-over from right */}
      {editingNote && (
        <>
          {/* Backdrop - click to close */}
          <div
            className="absolute inset-0 z-20 bg-black/20"
            onClick={() => {
              setEditingNote(null);
              setSelectedAnnotation(null);
            }}
          />
          {/* Panel */}
          <div className="absolute top-0 right-0 bottom-0 w-80 bg-charcoal-black border-l border-gray-600 z-30 flex flex-col shadow-xl animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-600">
              <h3 className="text-sm font-medium text-bone-white flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-orange-500" />
                Edit Note
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  setEditingNote(null);
                  setSelectedAnnotation(null);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 p-3 space-y-4 overflow-auto">
              {/* Page info */}
              <div className="text-xs text-gray-400">
                Page {editingNote.page_number}
              </div>

              {/* Category selector */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Category</label>
                <Select value={editNoteCategory} onValueChange={setEditNoteCategory}>
                  <SelectTrigger className="bg-[#2a2a2a] border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Note text */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Note</label>
                <Textarea
                  value={editNoteText}
                  onChange={(e) => setEditNoteText(e.target.value)}
                  className="bg-[#2a2a2a] border-gray-600 min-h-[120px] text-white"
                  placeholder="Enter note text..."
                />
              </div>

              {/* Created info */}
              {editingNote.created_at && (
                <div className="text-xs text-gray-500">
                  Created {formatDistanceToNow(new Date(editingNote.created_at))} ago
                  {editingNote.created_by_profile?.display_name &&
                    ` by ${editingNote.created_by_profile.display_name}`}
                </div>
              )}
            </div>

            {/* Footer with actions */}
            <div className="p-3 border-t border-gray-600 flex justify-between">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteEditingNote}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
              <Button
                size="sm"
                onClick={handleSaveNoteEdit}
                disabled={!hasNoteChanges || updateNote.isPending}
              >
                {updateNote.isPending ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : null}
                Save Changes
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Loading overlay for annotations */}
      {annotationsLoading && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      )}
    </div>
  );
};

export default ContinuityPDFAnnotator;
