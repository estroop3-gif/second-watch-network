/**
 * PDFAnnotationOverlay - Canvas overlay for PDF annotations
 *
 * Renders highlights, notes, and drawings on top of a PDF viewer.
 * Handles mouse/touch events for creating and editing annotations.
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  useExportAnnotations,
  useCreateExportHighlight,
  useCreateExportNote,
  useCreateExportDrawing,
  useDeleteExportHighlight,
  useDeleteExportNote,
  useDeleteExportDrawing,
  ExportHighlight,
  ExportNote,
  ExportDrawing,
  PathPoint,
  DrawingToolType,
} from '@/hooks/backlot/useContinuityExportAnnotations';
import { AnnotationTool } from './AnnotationToolbar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X, Trash2, MessageSquare } from 'lucide-react';

interface PDFAnnotationOverlayProps {
  projectId: string;
  exportId: string;
  pageNumber: number;
  activeTool: AnnotationTool;
  highlightColor: string;
  strokeColor: string;
  strokeWidth: number;
  disabled?: boolean;
  className?: string;
}

interface DrawingState {
  isDrawing: boolean;
  startPoint: PathPoint | null;
  currentPoints: PathPoint[];
}

const PDFAnnotationOverlay: React.FC<PDFAnnotationOverlayProps> = ({
  projectId,
  exportId,
  pageNumber,
  activeTool,
  highlightColor,
  strokeColor,
  strokeWidth,
  disabled = false,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [drawing, setDrawing] = useState<DrawingState>({
    isDrawing: false,
    startPoint: null,
    currentPoints: [],
  });
  const [selectedAnnotation, setSelectedAnnotation] = useState<{
    type: 'highlight' | 'note' | 'drawing';
    id: string;
  } | null>(null);
  const [noteInput, setNoteInput] = useState<{
    show: boolean;
    x: number;
    y: number;
    text: string;
  }>({ show: false, x: 0, y: 0, text: '' });

  // Fetch annotations for current page
  const { highlights, notes, drawings, isLoading } = useExportAnnotations(
    projectId,
    exportId,
    pageNumber
  );

  // Mutation hooks
  const createHighlight = useCreateExportHighlight(projectId, exportId);
  const createNote = useCreateExportNote(projectId, exportId);
  const createDrawing = useCreateExportDrawing(projectId, exportId);
  const deleteHighlight = useDeleteExportHighlight(projectId, exportId);
  const deleteNote = useDeleteExportNote(projectId, exportId);
  const deleteDrawing = useDeleteExportDrawing(projectId, exportId);

  // Update canvas dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Convert screen coordinates to percentage (0-100)
  const screenToPercent = useCallback(
    (x: number, y: number): PathPoint => ({
      x: (x / dimensions.width) * 100,
      y: (y / dimensions.height) * 100,
    }),
    [dimensions]
  );

  // Convert percentage to screen coordinates
  const percentToScreen = useCallback(
    (x: number, y: number): PathPoint => ({
      x: (x / 100) * dimensions.width,
      y: (y / 100) * dimensions.height,
    }),
    [dimensions]
  );

  // Draw all annotations on canvas
  const drawAnnotations = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw highlights
    highlights.forEach((h) => {
      const { x, y } = percentToScreen(h.x, h.y);
      const width = (h.width / 100) * dimensions.width;
      const height = (h.height / 100) * dimensions.height;

      ctx.fillStyle = h.color + Math.round(h.opacity * 255).toString(16).padStart(2, '0');
      ctx.fillRect(x, y, width, height);

      // Selection outline
      if (selectedAnnotation?.type === 'highlight' && selectedAnnotation?.id === h.id) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
        ctx.setLineDash([]);
      }
    });

    // Draw drawings
    drawings.forEach((d) => {
      ctx.strokeStyle = d.stroke_color;
      ctx.lineWidth = d.stroke_width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = d.opacity;

      const pathData = d.path_data;

      switch (d.tool_type) {
        case 'pen':
          if (pathData.type === 'pen' && pathData.points.length > 0) {
            ctx.beginPath();
            const firstPoint = percentToScreen(pathData.points[0].x, pathData.points[0].y);
            ctx.moveTo(firstPoint.x, firstPoint.y);
            pathData.points.slice(1).forEach((p) => {
              const point = percentToScreen(p.x, p.y);
              ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
          }
          break;
        case 'line':
          if (pathData.type === 'line') {
            ctx.beginPath();
            const start = percentToScreen(pathData.start.x, pathData.start.y);
            const end = percentToScreen(pathData.end.x, pathData.end.y);
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
          }
          break;
        case 'arrow':
          if (pathData.type === 'arrow') {
            const start = percentToScreen(pathData.start.x, pathData.start.y);
            const end = percentToScreen(pathData.end.x, pathData.end.y);

            // Line
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();

            // Arrowhead
            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            const headLength = 15;
            ctx.beginPath();
            ctx.moveTo(end.x, end.y);
            ctx.lineTo(
              end.x - headLength * Math.cos(angle - Math.PI / 6),
              end.y - headLength * Math.sin(angle - Math.PI / 6)
            );
            ctx.moveTo(end.x, end.y);
            ctx.lineTo(
              end.x - headLength * Math.cos(angle + Math.PI / 6),
              end.y - headLength * Math.sin(angle + Math.PI / 6)
            );
            ctx.stroke();
          }
          break;
        case 'rectangle':
          if (pathData.type === 'rectangle') {
            const pos = percentToScreen(pathData.x, pathData.y);
            const width = (pathData.width / 100) * dimensions.width;
            const height = (pathData.height / 100) * dimensions.height;
            ctx.strokeRect(pos.x, pos.y, width, height);
            if (d.fill_color) {
              ctx.fillStyle = d.fill_color + '40'; // 25% opacity fill
              ctx.fillRect(pos.x, pos.y, width, height);
            }
          }
          break;
        case 'circle':
          if (pathData.type === 'circle') {
            const center = percentToScreen(pathData.cx, pathData.cy);
            const rx = (pathData.rx / 100) * dimensions.width;
            const ry = (pathData.ry / 100) * dimensions.height;
            ctx.beginPath();
            ctx.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2);
            ctx.stroke();
            if (d.fill_color) {
              ctx.fillStyle = d.fill_color + '40';
              ctx.fill();
            }
          }
          break;
        case 'text':
          if (pathData.type === 'text' && d.text_content) {
            const pos = percentToScreen(pathData.x, pathData.y);
            ctx.font = `${d.font_size || 12}px sans-serif`;
            ctx.fillStyle = d.stroke_color;
            ctx.fillText(d.text_content, pos.x, pos.y);
          }
          break;
      }

      ctx.globalAlpha = 1;

      // Selection outline for drawings
      if (selectedAnnotation?.type === 'drawing' && selectedAnnotation?.id === d.id) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        // Draw bounding box based on type
        ctx.setLineDash([]);
      }
    });

    // Draw note markers
    notes.forEach((n) => {
      const pos = percentToScreen(n.anchor_x, n.anchor_y);
      const isSelected = selectedAnnotation?.type === 'note' && selectedAnnotation?.id === n.id;

      // Note pin marker
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, isSelected ? 12 : 10, 0, Math.PI * 2);
      ctx.fillStyle = n.is_critical ? '#EF4444' : '#3B82F6';
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.5)';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Note icon
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('N', pos.x, pos.y);
    });

    // Draw current drawing preview
    if (drawing.isDrawing && drawing.currentPoints.length > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);

      if (activeTool === 'pen') {
        ctx.beginPath();
        const first = percentToScreen(drawing.currentPoints[0].x, drawing.currentPoints[0].y);
        ctx.moveTo(first.x, first.y);
        drawing.currentPoints.slice(1).forEach((p) => {
          const point = percentToScreen(p.x, p.y);
          ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
      } else if (drawing.startPoint && drawing.currentPoints.length > 0) {
        const start = percentToScreen(drawing.startPoint.x, drawing.startPoint.y);
        const end = percentToScreen(
          drawing.currentPoints[drawing.currentPoints.length - 1].x,
          drawing.currentPoints[drawing.currentPoints.length - 1].y
        );

        if (activeTool === 'line' || activeTool === 'arrow') {
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();

          if (activeTool === 'arrow') {
            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            const headLength = 15;
            ctx.beginPath();
            ctx.moveTo(end.x, end.y);
            ctx.lineTo(
              end.x - headLength * Math.cos(angle - Math.PI / 6),
              end.y - headLength * Math.sin(angle - Math.PI / 6)
            );
            ctx.moveTo(end.x, end.y);
            ctx.lineTo(
              end.x - headLength * Math.cos(angle + Math.PI / 6),
              end.y - headLength * Math.sin(angle + Math.PI / 6)
            );
            ctx.stroke();
          }
        } else if (activeTool === 'rectangle') {
          const width = end.x - start.x;
          const height = end.y - start.y;
          ctx.strokeRect(start.x, start.y, width, height);
        } else if (activeTool === 'circle') {
          const rx = Math.abs(end.x - start.x);
          const ry = Math.abs(end.y - start.y);
          ctx.beginPath();
          ctx.ellipse(start.x, start.y, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // Draw highlight preview
    if (activeTool === 'highlight' && drawing.isDrawing && drawing.startPoint && drawing.currentPoints.length > 0) {
      const start = percentToScreen(drawing.startPoint.x, drawing.startPoint.y);
      const end = percentToScreen(
        drawing.currentPoints[drawing.currentPoints.length - 1].x,
        drawing.currentPoints[drawing.currentPoints.length - 1].y
      );
      const width = end.x - start.x;
      const height = end.y - start.y;

      ctx.fillStyle = highlightColor + '4D'; // 30% opacity
      ctx.fillRect(start.x, start.y, width, height);
    }
  }, [
    highlights,
    notes,
    drawings,
    drawing,
    activeTool,
    strokeColor,
    strokeWidth,
    highlightColor,
    selectedAnnotation,
    dimensions,
    percentToScreen,
  ]);

  // Redraw when annotations or state changes
  useEffect(() => {
    drawAnnotations();
  }, [drawAnnotations]);

  // Mouse event handlers
  const getMousePosition = (e: React.MouseEvent): PathPoint => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return screenToPercent(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled || activeTool === 'select') return;

    const pos = getMousePosition(e);

    if (activeTool === 'note') {
      // Show note input
      setNoteInput({
        show: true,
        x: pos.x,
        y: pos.y,
        text: '',
      });
      return;
    }

    setDrawing({
      isDrawing: true,
      startPoint: pos,
      currentPoints: [pos],
    });
    setSelectedAnnotation(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawing.isDrawing || disabled) return;

    const pos = getMousePosition(e);

    if (activeTool === 'pen') {
      setDrawing((prev) => ({
        ...prev,
        currentPoints: [...prev.currentPoints, pos],
      }));
    } else {
      setDrawing((prev) => ({
        ...prev,
        currentPoints: [pos],
      }));
    }
  };

  const handleMouseUp = async () => {
    if (!drawing.isDrawing || disabled) return;

    const { startPoint, currentPoints } = drawing;
    if (!startPoint || currentPoints.length === 0) {
      setDrawing({ isDrawing: false, startPoint: null, currentPoints: [] });
      return;
    }

    const endPoint = currentPoints[currentPoints.length - 1];

    try {
      if (activeTool === 'highlight') {
        const x = Math.min(startPoint.x, endPoint.x);
        const y = Math.min(startPoint.y, endPoint.y);
        const width = Math.abs(endPoint.x - startPoint.x);
        const height = Math.abs(endPoint.y - startPoint.y);

        if (width > 1 && height > 1) {
          await createHighlight.mutateAsync({
            page_number: pageNumber,
            x,
            y,
            width,
            height,
            color: highlightColor,
            opacity: 0.3,
          });
        }
      } else if (activeTool === 'pen') {
        if (currentPoints.length > 2) {
          await createDrawing.mutateAsync({
            page_number: pageNumber,
            tool_type: 'pen',
            path_data: { type: 'pen', points: currentPoints },
            stroke_color: strokeColor,
            stroke_width: strokeWidth,
          });
        }
      } else if (activeTool === 'line' || activeTool === 'arrow') {
        await createDrawing.mutateAsync({
          page_number: pageNumber,
          tool_type: activeTool,
          path_data: {
            type: activeTool,
            start: startPoint,
            end: endPoint,
          },
          stroke_color: strokeColor,
          stroke_width: strokeWidth,
        });
      } else if (activeTool === 'rectangle') {
        const x = Math.min(startPoint.x, endPoint.x);
        const y = Math.min(startPoint.y, endPoint.y);
        const width = Math.abs(endPoint.x - startPoint.x);
        const height = Math.abs(endPoint.y - startPoint.y);

        if (width > 1 && height > 1) {
          await createDrawing.mutateAsync({
            page_number: pageNumber,
            tool_type: 'rectangle',
            path_data: { type: 'rectangle', x, y, width, height },
            stroke_color: strokeColor,
            stroke_width: strokeWidth,
          });
        }
      } else if (activeTool === 'circle') {
        const rx = Math.abs(endPoint.x - startPoint.x);
        const ry = Math.abs(endPoint.y - startPoint.y);

        if (rx > 1 && ry > 1) {
          await createDrawing.mutateAsync({
            page_number: pageNumber,
            tool_type: 'circle',
            path_data: { type: 'circle', cx: startPoint.x, cy: startPoint.y, rx, ry },
            stroke_color: strokeColor,
            stroke_width: strokeWidth,
          });
        }
      }
    } catch (error) {
      console.error('Failed to create annotation:', error);
    }

    setDrawing({ isDrawing: false, startPoint: null, currentPoints: [] });
  };

  const handleClick = (e: React.MouseEvent) => {
    if (activeTool !== 'select' || disabled) return;

    const pos = getMousePosition(e);
    const { x, y } = percentToScreen(pos.x, pos.y);

    // Check for note clicks
    for (const note of notes) {
      const notePos = percentToScreen(note.anchor_x, note.anchor_y);
      const dist = Math.sqrt(Math.pow(x - notePos.x, 2) + Math.pow(y - notePos.y, 2));
      if (dist < 15) {
        setSelectedAnnotation({ type: 'note', id: note.id });
        return;
      }
    }

    // Check for highlight clicks
    for (const h of highlights) {
      const hPos = percentToScreen(h.x, h.y);
      const hWidth = (h.width / 100) * dimensions.width;
      const hHeight = (h.height / 100) * dimensions.height;
      if (x >= hPos.x && x <= hPos.x + hWidth && y >= hPos.y && y <= hPos.y + hHeight) {
        setSelectedAnnotation({ type: 'highlight', id: h.id });
        return;
      }
    }

    // Deselect if clicking empty area
    setSelectedAnnotation(null);
  };

  const handleDeleteSelected = async () => {
    if (!selectedAnnotation) return;

    try {
      if (selectedAnnotation.type === 'highlight') {
        await deleteHighlight.mutateAsync(selectedAnnotation.id);
      } else if (selectedAnnotation.type === 'note') {
        await deleteNote.mutateAsync(selectedAnnotation.id);
      } else if (selectedAnnotation.type === 'drawing') {
        await deleteDrawing.mutateAsync(selectedAnnotation.id);
      }
      setSelectedAnnotation(null);
    } catch (error) {
      console.error('Failed to delete annotation:', error);
    }
  };

  const handleCreateNote = async () => {
    if (!noteInput.text.trim()) {
      setNoteInput({ show: false, x: 0, y: 0, text: '' });
      return;
    }

    try {
      await createNote.mutateAsync({
        page_number: pageNumber,
        anchor_x: noteInput.x,
        anchor_y: noteInput.y,
        note_text: noteInput.text,
        note_category: 'general',
        is_critical: false,
      });
    } catch (error) {
      console.error('Failed to create note:', error);
    }

    setNoteInput({ show: false, x: 0, y: 0, text: '' });
  };

  // Get selected note for display
  const selectedNote = selectedAnnotation?.type === 'note'
    ? notes.find((n) => n.id === selectedAnnotation.id)
    : null;

  return (
    <div
      ref={containerRef}
      className={cn('absolute inset-0 pointer-events-auto', className)}
    >
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className={cn(
          'absolute inset-0',
          activeTool === 'select' ? 'cursor-default' : 'cursor-crosshair'
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
      />

      {/* Note input popup */}
      {noteInput.show && (
        <div
          className="absolute bg-charcoal-black border border-muted-gray/30 rounded-lg p-3 shadow-lg z-50"
          style={{
            left: `${(noteInput.x / 100) * dimensions.width}px`,
            top: `${(noteInput.y / 100) * dimensions.height}px`,
            transform: 'translate(-50%, -100%) translateY(-10px)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-bone-white">Add Note</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 ml-auto"
              onClick={() => setNoteInput({ show: false, x: 0, y: 0, text: '' })}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
          <Textarea
            value={noteInput.text}
            onChange={(e) => setNoteInput((prev) => ({ ...prev, text: e.target.value }))}
            placeholder="Enter note..."
            className="w-48 h-20 text-sm bg-soft-black border-muted-gray/30"
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNoteInput({ show: false, x: 0, y: 0, text: '' })}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreateNote}>
              Save
            </Button>
          </div>
        </div>
      )}

      {/* Selected note popup */}
      {selectedNote && (
        <div
          className="absolute bg-charcoal-black border border-muted-gray/30 rounded-lg p-3 shadow-lg z-50 max-w-xs"
          style={{
            left: `${(selectedNote.anchor_x / 100) * dimensions.width}px`,
            top: `${(selectedNote.anchor_y / 100) * dimensions.height}px`,
            transform: 'translate(-50%, -100%) translateY(-20px)',
          }}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-xs text-muted-gray">
              {selectedNote.is_critical && (
                <span className="text-red-400 mr-1">Critical</span>
              )}
              {selectedNote.note_category}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-red-400 hover:text-red-300"
              onClick={handleDeleteSelected}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
          <p className="text-sm text-bone-white">{selectedNote.note_text}</p>
        </div>
      )}

      {/* Delete button for selected highlight */}
      {selectedAnnotation?.type === 'highlight' && (
        <Button
          variant="destructive"
          size="sm"
          className="absolute top-2 right-2 z-50"
          onClick={handleDeleteSelected}
        >
          <Trash2 className="w-4 h-4 mr-1" />
          Delete Highlight
        </Button>
      )}
    </div>
  );
};

export default PDFAnnotationOverlay;
