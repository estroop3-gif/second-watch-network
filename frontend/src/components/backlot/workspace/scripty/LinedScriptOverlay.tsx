/**
 * LinedScriptOverlay - PDF viewer with coverage lining marks overlay
 *
 * Features:
 * - Displays PDF page from script
 * - Allows drawing coverage lines (lining marks)
 * - Shows existing marks with color-coded coverage types
 * - Interactive line editing (add, move, delete)
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Pen,
  Trash2,
  Move,
  Plus,
  Save,
  X,
  FileText,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useLiningMarks, useCreateLiningMark, useUpdateLiningMark, useDeleteLiningMark } from '@/hooks/backlot/useContinuity';

interface LinedScriptOverlayProps {
  projectId: string;
  scriptId: string | null;
  sceneId: string | null;
  pageNumber: number;
  canEdit: boolean;
  fileUrl?: string;
  isFullscreen?: boolean;
}

// Coverage type colors
const COVERAGE_COLORS: Record<string, string> = {
  WS: '#EF4444',     // Red - Wide Shot
  MWS: '#F97316',    // Orange - Medium Wide
  MS: '#EAB308',     // Yellow - Medium Shot
  MCU: '#22C55E',   // Green - Medium Close-Up
  CU: '#3B82F6',    // Blue - Close-Up
  ECU: '#8B5CF6',   // Purple - Extreme Close-Up
  OTS: '#EC4899',   // Pink - Over the Shoulder
  POV: '#14B8A6',   // Teal - Point of View
  INSERT: '#6B7280', // Gray - Insert
  '2-SHOT': '#F59E0B', // Amber - Two Shot
  GROUP: '#10B981',  // Emerald - Group
  AERIAL: '#0EA5E9', // Sky - Aerial
  OTHER: '#94A3B8',  // Slate - Other
};

const COVERAGE_TYPES = [
  { value: 'WS', label: 'Wide Shot' },
  { value: 'MWS', label: 'Medium Wide' },
  { value: 'MS', label: 'Medium Shot' },
  { value: 'MCU', label: 'Medium Close-Up' },
  { value: 'CU', label: 'Close-Up' },
  { value: 'ECU', label: 'Extreme Close-Up' },
  { value: 'OTS', label: 'Over the Shoulder' },
  { value: 'POV', label: 'Point of View' },
  { value: 'INSERT', label: 'Insert' },
  { value: '2-SHOT', label: 'Two Shot' },
  { value: 'GROUP', label: 'Group' },
  { value: 'AERIAL', label: 'Aerial' },
  { value: 'OTHER', label: 'Other' },
];

const LINE_STYLES = [
  { value: 'solid', label: 'Solid' },
  { value: 'wavy', label: 'Wavy' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

interface LiningMark {
  id: string;
  page_number: number;
  start_y: number;
  end_y: number;
  x_position: number;
  coverage_type: string;
  camera_label?: string;
  setup_label?: string;
  line_style: string;
  line_color: string;
  notes?: string;
}

type DrawingMode = 'none' | 'draw' | 'move' | 'delete';

const LinedScriptOverlay: React.FC<LinedScriptOverlayProps> = ({
  projectId,
  scriptId,
  sceneId,
  pageNumber,
  canEdit,
  fileUrl,
  isFullscreen = false,
}) => {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('none');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ y: number } | null>(null);
  const [drawEnd, setDrawEnd] = useState<{ y: number } | null>(null);
  const [selectedMark, setSelectedMark] = useState<LiningMark | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100); // Zoom percentage
  const [newMarkData, setNewMarkData] = useState({
    coverage_type: 'MS',
    camera_label: '',
    setup_label: '',
    line_style: 'solid',
    notes: '',
  });

  // Zoom handlers
  const handleZoomIn = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    console.log('Zoom in clicked, current:', zoomLevel);
    setZoomLevel(prev => Math.min(prev + 25, 200));
  }, [zoomLevel]);

  const handleZoomOut = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    console.log('Zoom out clicked, current:', zoomLevel);
    setZoomLevel(prev => Math.max(prev - 25, 50));
  }, [zoomLevel]);

  const handleZoomReset = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    console.log('Zoom reset clicked');
    setZoomLevel(100);
  }, []);

  // Data hooks
  const { data: liningMarks = [], isLoading: marksLoading, refetch } = useLiningMarks({
    projectId,
    scriptId: scriptId || undefined,
    pageNumber,
  });

  const createMark = useCreateLiningMark();
  const updateMark = useUpdateLiningMark();
  const deleteMark = useDeleteLiningMark();

  // Calculate position from mouse event
  const getRelativeY = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    return (e.clientY - rect.top) / rect.height;
  }, []);

  // Mouse handlers for drawing
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (drawingMode !== 'draw' || !canEdit) return;
    e.preventDefault();
    const y = getRelativeY(e);
    setIsDrawing(true);
    setDrawStart({ y });
    setDrawEnd({ y });
  }, [drawingMode, canEdit, getRelativeY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || drawingMode !== 'draw') return;
    e.preventDefault();
    const y = getRelativeY(e);
    setDrawEnd({ y });
  }, [isDrawing, drawingMode, getRelativeY]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !drawStart || !drawEnd) {
      setIsDrawing(false);
      return;
    }

    // Only create mark if there's meaningful line length
    const lineLength = Math.abs(drawEnd.y - drawStart.y);
    if (lineLength > 0.02) {
      // Show the new mark form
      setSelectedMark({
        id: 'new',
        page_number: pageNumber,
        start_y: Math.min(drawStart.y, drawEnd.y),
        end_y: Math.max(drawStart.y, drawEnd.y),
        x_position: 0.85,
        coverage_type: newMarkData.coverage_type,
        line_style: newMarkData.line_style,
        line_color: COVERAGE_COLORS[newMarkData.coverage_type] || '#3B82F6',
      });
    }

    setIsDrawing(false);
    setDrawStart(null);
    setDrawEnd(null);
  }, [isDrawing, drawStart, drawEnd, pageNumber, newMarkData]);

  // Handle click on existing mark
  const handleMarkClick = useCallback((mark: LiningMark, e: React.MouseEvent) => {
    e.stopPropagation();
    if (drawingMode === 'delete' && canEdit) {
      // Delete mode
      if (confirm('Delete this coverage mark?')) {
        deleteMark.mutate(
          { id: mark.id },
          {
            onSuccess: () => {
              toast({ title: 'Mark deleted' });
              refetch();
            },
            onError: (err: any) => {
              toast({
                title: 'Error',
                description: err.message || 'Failed to delete mark',
                variant: 'destructive',
              });
            },
          }
        );
      }
    } else {
      // Select mode - show edit popover
      setSelectedMark(mark);
      setNewMarkData({
        coverage_type: mark.coverage_type,
        camera_label: mark.camera_label || '',
        setup_label: mark.setup_label || '',
        line_style: mark.line_style,
        notes: mark.notes || '',
      });
    }
  }, [drawingMode, canEdit, deleteMark, toast, refetch]);

  // Save new or updated mark
  const handleSaveMark = async () => {
    if (!selectedMark || !scriptId) return;

    const markData = {
      project_id: projectId,
      script_id: scriptId,
      scene_id: sceneId || undefined,
      page_number: selectedMark.page_number,
      start_y: selectedMark.start_y,
      end_y: selectedMark.end_y,
      x_position: selectedMark.x_position,
      coverage_type: newMarkData.coverage_type,
      camera_label: newMarkData.camera_label || undefined,
      setup_label: newMarkData.setup_label || undefined,
      line_style: newMarkData.line_style,
      line_color: COVERAGE_COLORS[newMarkData.coverage_type] || '#3B82F6',
      notes: newMarkData.notes || undefined,
    };

    try {
      if (selectedMark.id === 'new') {
        await createMark.mutateAsync(markData);
        toast({ title: 'Coverage mark added' });
      } else {
        await updateMark.mutateAsync({ id: selectedMark.id, ...markData });
        toast({ title: 'Coverage mark updated' });
      }
      setSelectedMark(null);
      refetch();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to save mark',
        variant: 'destructive',
      });
    }
  };

  // Render a lining mark
  const renderMark = (mark: LiningMark) => {
    const height = Math.abs(mark.end_y - mark.start_y) * 100;
    const top = Math.min(mark.start_y, mark.end_y) * 100;
    const color = mark.line_color || COVERAGE_COLORS[mark.coverage_type] || '#3B82F6';

    // Generate SVG path based on line style
    const getLinePath = () => {
      if (mark.line_style === 'wavy') {
        // Wavy line
        return 'M 0,0 Q 5,10 0,20 T 0,40 T 0,60 T 0,80 T 0,100';
      }
      return 'M 0,0 L 0,100';
    };

    return (
      <div
        key={mark.id}
        className={cn(
          'absolute cursor-pointer hover:opacity-80 transition-opacity',
          selectedMark?.id === mark.id && 'ring-2 ring-accent-yellow'
        )}
        style={{
          top: `${top}%`,
          right: `${(1 - mark.x_position) * 100}%`,
          height: `${height}%`,
          width: '20px',
        }}
        onClick={(e) => handleMarkClick(mark, e)}
      >
        <svg
          className="w-full h-full overflow-visible"
          viewBox="0 0 10 100"
          preserveAspectRatio="none"
        >
          <path
            d={getLinePath()}
            stroke={color}
            strokeWidth="3"
            fill="none"
            strokeDasharray={
              mark.line_style === 'dashed' ? '8,4' :
              mark.line_style === 'dotted' ? '2,4' : 'none'
            }
          />
        </svg>
        {/* Label */}
        <div
          className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-medium px-1 rounded"
          style={{ backgroundColor: color, color: 'white' }}
        >
          {mark.camera_label || mark.coverage_type}
        </div>
      </div>
    );
  };

  // Render drawing preview
  const renderDrawingPreview = () => {
    if (!isDrawing || !drawStart || !drawEnd) return null;

    const top = Math.min(drawStart.y, drawEnd.y) * 100;
    const height = Math.abs(drawEnd.y - drawStart.y) * 100;
    const color = COVERAGE_COLORS[newMarkData.coverage_type] || '#3B82F6';

    return (
      <div
        className="absolute pointer-events-none"
        style={{
          top: `${top}%`,
          right: '15%',
          height: `${height}%`,
          width: '20px',
        }}
      >
        <svg
          className="w-full h-full overflow-visible"
          viewBox="0 0 10 100"
          preserveAspectRatio="none"
        >
          <path
            d="M 0,0 L 0,100"
            stroke={color}
            strokeWidth="3"
            fill="none"
            opacity="0.7"
          />
        </svg>
      </div>
    );
  };

  // No script selected
  if (!scriptId) {
    return (
      <div className="h-full flex items-center justify-center text-muted-gray">
        Select a script to view
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-muted-gray/20 shrink-0 bg-charcoal-black relative z-50">
        {/* Zoom Controls */}
        <div className="flex items-center gap-1 border-r border-muted-gray/30 pr-2 mr-2">
          <button
            type="button"
            onClick={(e) => handleZoomOut(e)}
            disabled={zoomLevel <= 50}
            title="Zoom Out"
            className="p-2 rounded text-bone-white hover:bg-muted-gray/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-bone-white min-w-[3rem] text-center">
            {zoomLevel}%
          </span>
          <button
            type="button"
            onClick={(e) => handleZoomIn(e)}
            disabled={zoomLevel >= 200}
            title="Zoom In"
            className="p-2 rounded text-bone-white hover:bg-muted-gray/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => handleZoomReset(e)}
            title="Reset Zoom"
            className="p-2 rounded text-bone-white hover:bg-muted-gray/30"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Drawing Controls (only if canEdit) */}
        {canEdit && (
          <>
            <Button
              type="button"
              variant={drawingMode === 'draw' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Draw button clicked');
                setDrawingMode(drawingMode === 'draw' ? 'none' : 'draw');
              }}
              className="text-bone-white hover:bg-muted-gray/30"
            >
              <Pen className="w-4 h-4 mr-1" />
              Draw
            </Button>
            <Button
              type="button"
              variant={drawingMode === 'delete' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Delete button clicked');
                setDrawingMode(drawingMode === 'delete' ? 'none' : 'delete');
              }}
              className="text-bone-white hover:bg-muted-gray/30"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
            <div className="flex-1" />
            <Select
              value={newMarkData.coverage_type}
              onValueChange={(v) => setNewMarkData(d => ({ ...d, coverage_type: v }))}
            >
              <SelectTrigger className="w-32 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COVERAGE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COVERAGE_COLORS[type.value] }}
                      />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {/* PDF/Script Content Area - Full Page Display */}
      <div
        ref={containerRef}
        className={cn(
          'flex-1 relative bg-white overflow-auto',
          drawingMode === 'draw' && 'cursor-crosshair',
          drawingMode === 'delete' && 'cursor-not-allowed'
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* PDF Background - Using iframe for PDF with full page view and zoom */}
        {fileUrl ? (
          <div
            className="origin-top-left h-full"
            style={{
              transform: `scale(${zoomLevel / 100})`,
              width: `${10000 / zoomLevel}%`,
              height: `${10000 / zoomLevel}%`,
            }}
          >
            <iframe
              src={`${fileUrl}#page=${pageNumber}&view=FitH&toolbar=0&navpanes=0`}
              className="w-full h-full border-0"
              title="Script PDF"
            />
          </div>
        ) : (
          <div className="w-full h-full min-h-[600px] flex items-center justify-center bg-charcoal-black text-bone-white">
            <div className="text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-muted-gray" />
              <p className="text-lg font-medium text-bone-white">No PDF Available</p>
              <p className="text-sm mt-1 text-muted-gray">Page {pageNumber}</p>
              <p className="text-xs mt-4 text-muted-gray">Upload a script to view it here</p>
            </div>
          </div>
        )}

        {/* Lining Marks Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="relative w-full h-full pointer-events-auto">
            {marksLoading ? (
              <div className="absolute right-[15%] top-1/4 h-1/2 w-1">
                <Skeleton className="h-full w-1" />
              </div>
            ) : (
              liningMarks.map(renderMark)
            )}
            {renderDrawingPreview()}
          </div>
        </div>
      </div>

      {/* Mark Edit Popover */}
      {selectedMark && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-4 w-80 max-w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-bone-white">
                {selectedMark.id === 'new' ? 'New Coverage Mark' : 'Edit Coverage Mark'}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setSelectedMark(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs">Coverage Type</Label>
                <Select
                  value={newMarkData.coverage_type}
                  onValueChange={(v) => setNewMarkData(d => ({ ...d, coverage_type: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COVERAGE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COVERAGE_COLORS[type.value] }}
                          />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Camera</Label>
                  <Input
                    value={newMarkData.camera_label}
                    onChange={(e) => setNewMarkData(d => ({ ...d, camera_label: e.target.value }))}
                    placeholder="A"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Setup</Label>
                  <Input
                    value={newMarkData.setup_label}
                    onChange={(e) => setNewMarkData(d => ({ ...d, setup_label: e.target.value }))}
                    placeholder="1"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Line Style</Label>
                <Select
                  value={newMarkData.line_style}
                  onValueChange={(v) => setNewMarkData(d => ({ ...d, line_style: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LINE_STYLES.map((style) => (
                      <SelectItem key={style.value} value={style.value}>
                        {style.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea
                  value={newMarkData.notes}
                  onChange={(e) => setNewMarkData(d => ({ ...d, notes: e.target.value }))}
                  placeholder="Optional notes..."
                  className="mt-1 h-16"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedMark(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                  onClick={handleSaveMark}
                  disabled={createMark.isPending || updateMark.isPending}
                >
                  {createMark.isPending || updateMark.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LinedScriptOverlay;
