/**
 * AnnotationToolbar - Tool selection for PDF annotations
 *
 * Provides buttons for selecting annotation tools (highlight, note, pen, shapes)
 * and settings (color, stroke width) for the Continuity PDF viewer.
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Highlighter,
  StickyNote,
  Pencil,
  Minus,
  ArrowRight,
  Square,
  Circle,
  Type,
  Eraser,
  Palette,
  MousePointer2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DrawingToolType } from '@/hooks/backlot/useContinuityExportAnnotations';

export type AnnotationTool = 'select' | 'highlight' | 'note' | DrawingToolType;

interface AnnotationToolbarProps {
  activeTool: AnnotationTool;
  setActiveTool: (tool: AnnotationTool) => void;
  highlightColor: string;
  setHighlightColor: (color: string) => void;
  strokeColor: string;
  setStrokeColor: (color: string) => void;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
  disabled?: boolean;
  className?: string;
}

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#FFEB3B' },
  { name: 'Green', value: '#4CAF50' },
  { name: 'Blue', value: '#2196F3' },
  { name: 'Pink', value: '#E91E63' },
  { name: 'Orange', value: '#FF9800' },
  { name: 'Purple', value: '#9C27B0' },
];

const STROKE_COLORS = [
  { name: 'Red', value: '#FF3C3C' },
  { name: 'Blue', value: '#2196F3' },
  { name: 'Green', value: '#4CAF50' },
  { name: 'Black', value: '#000000' },
  { name: 'White', value: '#FFFFFF' },
  { name: 'Yellow', value: '#FFEB3B' },
];

const AnnotationToolbar: React.FC<AnnotationToolbarProps> = ({
  activeTool,
  setActiveTool,
  highlightColor,
  setHighlightColor,
  strokeColor,
  setStrokeColor,
  strokeWidth,
  setStrokeWidth,
  disabled = false,
  className,
}) => {
  const tools: { id: AnnotationTool; icon: React.ReactNode; label: string; group: string }[] = [
    { id: 'select', icon: <MousePointer2 className="w-4 h-4" />, label: 'Select', group: 'basic' },
    { id: 'highlight', icon: <Highlighter className="w-4 h-4" />, label: 'Highlight', group: 'basic' },
    { id: 'note', icon: <StickyNote className="w-4 h-4" />, label: 'Note', group: 'basic' },
    { id: 'pen', icon: <Pencil className="w-4 h-4" />, label: 'Pen', group: 'draw' },
    { id: 'line', icon: <Minus className="w-4 h-4" />, label: 'Line', group: 'draw' },
    { id: 'arrow', icon: <ArrowRight className="w-4 h-4" />, label: 'Arrow', group: 'draw' },
    { id: 'rectangle', icon: <Square className="w-4 h-4" />, label: 'Rectangle', group: 'shape' },
    { id: 'circle', icon: <Circle className="w-4 h-4" />, label: 'Circle', group: 'shape' },
    { id: 'text', icon: <Type className="w-4 h-4" />, label: 'Text', group: 'shape' },
  ];

  const basicTools = tools.filter((t) => t.group === 'basic');
  const drawTools = tools.filter((t) => t.group === 'draw');
  const shapeTools = tools.filter((t) => t.group === 'shape');

  const renderToolButton = (tool: typeof tools[0]) => (
    <TooltipProvider key={tool.id}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={activeTool === tool.id ? 'secondary' : 'ghost'}
            size="icon"
            className={cn(
              'h-8 w-8',
              activeTool === tool.id && tool.id === 'highlight' && 'bg-yellow-500/20 text-yellow-400',
              activeTool === tool.id && tool.id === 'note' && 'bg-blue-500/20 text-blue-400',
              activeTool === tool.id && tool.group === 'draw' && 'bg-red-500/20 text-red-400',
              activeTool === tool.id && tool.group === 'shape' && 'bg-purple-500/20 text-purple-400'
            )}
            onClick={() => setActiveTool(tool.id)}
            disabled={disabled}
          >
            {tool.icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{tool.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <div
      className={cn(
        'flex items-center gap-1 p-1 bg-charcoal-black/80 rounded-lg border border-muted-gray/30',
        className
      )}
    >
      {/* Basic Tools */}
      {basicTools.map(renderToolButton)}

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Draw Tools */}
      {drawTools.map(renderToolButton)}

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Shape Tools */}
      {shapeTools.map(renderToolButton)}

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Highlight Color Picker (shown when highlight tool active) */}
      {activeTool === 'highlight' && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={disabled}
            >
              <div
                className="w-4 h-4 rounded-full border border-white/30"
                style={{ backgroundColor: highlightColor }}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2 bg-charcoal-black border-muted-gray/30">
            <div className="flex gap-1">
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color.value}
                  className={cn(
                    'w-6 h-6 rounded-full border-2 transition-transform hover:scale-110',
                    highlightColor === color.value ? 'border-white' : 'border-transparent'
                  )}
                  style={{ backgroundColor: color.value }}
                  onClick={() => setHighlightColor(color.value)}
                  title={color.name}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Stroke Color & Width Picker (shown when drawing tools active) */}
      {(activeTool === 'pen' || activeTool === 'line' || activeTool === 'arrow' ||
        activeTool === 'rectangle' || activeTool === 'circle' || activeTool === 'text') && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={disabled}
            >
              <Palette className="w-4 h-4" style={{ color: strokeColor }} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-3 bg-charcoal-black border-muted-gray/30">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-gray mb-2">Color</p>
                <div className="flex gap-1 flex-wrap">
                  {STROKE_COLORS.map((color) => (
                    <button
                      key={color.value}
                      className={cn(
                        'w-6 h-6 rounded-full border-2 transition-transform hover:scale-110',
                        strokeColor === color.value ? 'border-white' : 'border-muted-gray/30'
                      )}
                      style={{ backgroundColor: color.value }}
                      onClick={() => setStrokeColor(color.value)}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-gray mb-2">Stroke Width: {strokeWidth}px</p>
                <Slider
                  value={[strokeWidth]}
                  onValueChange={([value]) => setStrokeWidth(value)}
                  min={1}
                  max={10}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

export default AnnotationToolbar;
