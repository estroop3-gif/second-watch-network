/**
 * ScriptViewerSidebar - Context-aware sidebar for highlight management
 *
 * Modes:
 * - hidden: No selection, sidebar collapsed
 * - create: New text selected, shows category picker + notes
 * - edit: Existing highlight clicked, shows details + edit options
 */
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Highlighter,
  X,
  Trash2,
  ExternalLink,
  Film,
  Save,
} from 'lucide-react';
import {
  BacklotScriptHighlightBreakdown,
  BacklotBreakdownItemType,
  BacklotHighlightStatus,
  BREAKDOWN_HIGHLIGHT_COLORS,
  BREAKDOWN_ITEM_TYPE_LABELS,
} from '@/types/backlot';

// Status display labels and colors
const HIGHLIGHT_STATUS_OPTIONS: { value: BacklotHighlightStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: 'yellow' },
  { value: 'confirmed', label: 'Confirmed', color: 'green' },
  { value: 'rejected', label: 'Rejected', color: 'red' },
];

// Simple scene type for sidebar (subset of BacklotScene)
interface SimplifiedScene {
  id: string;
  scene_number: string;
  slugline?: string;
}
import { ParsedScene, formatSluglineForDisplay } from '@/utils/scriptFormatting';
import { cn } from '@/lib/utils';

// Category groups for the picker
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

// Text selection state (matches ScriptTextViewer)
export interface TextSelection {
  text: string;
  startOffset: number;
  endOffset: number;
  anchorRect: DOMRect | null;
  scene: ParsedScene | null;
  pageNumber: number | null;
}

export type SidebarMode = 'hidden' | 'create' | 'edit';

interface ScriptViewerSidebarProps {
  mode: SidebarMode;
  // Create mode props
  selection?: TextSelection | null;
  onCategorySelect?: (category: BacklotBreakdownItemType, notes?: string) => void;
  onCancel?: () => void;
  // Edit mode props
  highlight?: BacklotScriptHighlightBreakdown | null;
  scenes?: SimplifiedScene[];
  onUpdateHighlight?: (updates: {
    category?: BacklotBreakdownItemType;
    scene_id?: string | null;
    suggested_label?: string;
    status?: BacklotHighlightStatus;
  }) => void;
  onDeleteHighlight?: () => void;
  onViewBreakdown?: (breakdownItemId: string) => void;
  onClose?: () => void;
}

// Create Mode Content
const CreateModeContent: React.FC<{
  selection: TextSelection;
  notes: string;
  setNotes: (notes: string) => void;
  onCategorySelect: (category: BacklotBreakdownItemType) => void;
}> = ({ selection, notes, setNotes, onCategorySelect }) => {
  const sceneDisplay = selection.scene
    ? `Scene ${selection.scene.sceneNumber}: ${formatSluglineForDisplay(selection.scene.slugline)}`
    : 'Before first scene (PROLOGUE)';

  return (
    <>
      {/* Selected text preview */}
      <div className="p-3 bg-muted-gray/10 rounded-lg border border-muted-gray/20">
        <span className="text-xs text-muted-gray block mb-1">Selected Text</span>
        <span className="text-sm text-bone-white font-medium">
          "{selection.text.length > 60 ? selection.text.slice(0, 60) + '...' : selection.text}"
        </span>
      </div>

      {/* Detected scene and page */}
      <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 space-y-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Film className="w-3 h-3 text-blue-400" />
            <span className="text-xs text-blue-400">Detected Scene</span>
          </div>
          <span className="text-sm text-bone-white font-medium block truncate">
            {sceneDisplay}
          </span>
        </div>
        {selection.pageNumber && (
          <div className="pt-2 border-t border-blue-500/20">
            <span className="text-xs text-blue-400">Found on Page </span>
            <span className="text-sm text-bone-white font-medium">{selection.pageNumber}</span>
          </div>
        )}
      </div>

      {/* Notes input (optional) */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-gray">Notes (optional)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about this breakdown item..."
          rows={2}
          className="text-sm resize-none"
        />
      </div>

      {/* Category picker */}
      <div className="space-y-3">
        <Label className="text-xs text-muted-gray">Select Category</Label>
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {CATEGORY_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="text-[10px] font-semibold text-muted-gray/70 mb-1.5 tracking-wider">
                {group.label}
              </div>
              <div className="grid grid-cols-2 gap-1">
                {group.categories.map((category) => {
                  const color = BREAKDOWN_HIGHLIGHT_COLORS[category] || '#808080';
                  const label = BREAKDOWN_ITEM_TYPE_LABELS[category] || category;
                  return (
                    <button
                      key={category}
                      className="flex items-center gap-2 px-2 py-2 rounded text-left hover:bg-muted-gray/20 transition-colors group border border-transparent hover:border-muted-gray/30"
                      onClick={() => onCategorySelect(category)}
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
      </div>

      {/* Helper text */}
      <div className="text-[10px] text-muted-gray/60 text-center pt-2 border-t border-muted-gray/20">
        Click a category to create breakdown item
      </div>
    </>
  );
};

// Edit Mode Content
const EditModeContent: React.FC<{
  highlight: BacklotScriptHighlightBreakdown;
  scenes?: SimplifiedScene[];
  onUpdateHighlight?: (updates: {
    category?: BacklotBreakdownItemType;
    scene_id?: string | null;
    suggested_label?: string;
    status?: BacklotHighlightStatus;
  }) => void;
  onDeleteHighlight?: () => void;
  onViewBreakdown?: (breakdownItemId: string) => void;
}> = ({ highlight, scenes = [], onUpdateHighlight, onDeleteHighlight, onViewBreakdown }) => {
  const [category, setCategory] = useState<BacklotBreakdownItemType>(highlight.category);
  const [sceneId, setSceneId] = useState<string>(highlight.scene_id || '');
  const [label, setLabel] = useState<string>(highlight.suggested_label || highlight.highlighted_text);
  const [status, setStatus] = useState<BacklotHighlightStatus>(highlight.status);
  const [hasChanges, setHasChanges] = useState(false);

  // Reset state when highlight changes
  useEffect(() => {
    setCategory(highlight.category);
    setSceneId(highlight.scene_id || '');
    setLabel(highlight.suggested_label || highlight.highlighted_text);
    setStatus(highlight.status);
    setHasChanges(false);
  }, [highlight.id]);

  // Track changes
  useEffect(() => {
    const changed =
      category !== highlight.category ||
      sceneId !== (highlight.scene_id || '') ||
      label !== (highlight.suggested_label || highlight.highlighted_text) ||
      status !== highlight.status;
    setHasChanges(changed);
  }, [category, sceneId, label, status, highlight]);

  const handleSave = () => {
    if (!onUpdateHighlight || !hasChanges) return;
    const updates: { category?: BacklotBreakdownItemType; scene_id?: string | null; suggested_label?: string; status?: BacklotHighlightStatus } = {};
    if (category !== highlight.category) updates.category = category;
    // Only include scene_id if it actually changed
    const originalSceneId = highlight.scene_id || '';
    if (sceneId !== originalSceneId) {
      // Send null for "no scene", otherwise send the scene id
      updates.scene_id = sceneId || null;
    }
    if (label !== (highlight.suggested_label || highlight.highlighted_text)) updates.suggested_label = label;
    if (status !== highlight.status) updates.status = status;
    onUpdateHighlight(updates);
  };

  const color = BREAKDOWN_HIGHLIGHT_COLORS[category] || '#808080';

  return (
    <>
      {/* Highlighted text display */}
      <div className="p-3 bg-muted-gray/10 rounded-lg border border-muted-gray/20">
        <span className="text-xs text-muted-gray block mb-1">Highlighted Text</span>
        <span
          className="text-sm font-medium block"
          style={{
            backgroundColor: `${color}30`,
            borderBottom: `2px solid ${color}`,
            padding: '2px 4px',
            borderRadius: '2px',
          }}
        >
          {highlight.highlighted_text.length > 80
            ? highlight.highlighted_text.slice(0, 80) + '...'
            : highlight.highlighted_text}
        </span>
        {highlight.page_number && (
          <div className="mt-2 pt-2 border-t border-muted-gray/20">
            <span className="text-xs text-muted-gray">Found on Page </span>
            <span className="text-sm text-bone-white font-medium">{highlight.page_number}</span>
          </div>
        )}
      </div>

      {/* Status selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-gray">Status</Label>
          {highlight.breakdown_item_id && (
            <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-400">
              Linked to breakdown
            </Badge>
          )}
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as BacklotHighlightStatus)}>
          <SelectTrigger className="w-full">
            <SelectValue>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    status === 'pending' && 'bg-yellow-400',
                    status === 'confirmed' && 'bg-green-400',
                    status === 'rejected' && 'bg-red-400'
                  )}
                />
                {HIGHLIGHT_STATUS_OPTIONS.find(o => o.value === status)?.label || status}
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {HIGHLIGHT_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full',
                      option.color === 'yellow' && 'bg-yellow-400',
                      option.color === 'green' && 'bg-green-400',
                      option.color === 'red' && 'bg-red-400'
                    )}
                  />
                  {option.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Label input */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-gray">Label</Label>
        <Textarea
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Item label..."
          rows={2}
          className="text-sm resize-none"
        />
      </div>

      {/* Category selector */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-gray">Category</Label>
        <Select value={category} onValueChange={(v) => setCategory(v as BacklotBreakdownItemType)}>
          <SelectTrigger className="w-full">
            <SelectValue>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: BREAKDOWN_HIGHLIGHT_COLORS[category] }}
                />
                {BREAKDOWN_ITEM_TYPE_LABELS[category]}
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(BREAKDOWN_ITEM_TYPE_LABELS).map(([key, labelText]) => (
              <SelectItem key={key} value={key}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: BREAKDOWN_HIGHLIGHT_COLORS[key as BacklotBreakdownItemType] }}
                  />
                  {labelText}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Scene selector */}
      {scenes.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-gray">Scene</Label>
          <Select value={sceneId || '_none'} onValueChange={(v) => setSceneId(v === '_none' ? '' : v)}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {sceneId ? (
                  (() => {
                    const scene = scenes.find(s => s.id === sceneId);
                    return scene
                      ? `Scene ${scene.scene_number}${scene.slugline ? ` - ${scene.slugline.slice(0, 25)}` : ''}`
                      : 'Unknown scene';
                  })()
                ) : (
                  <span className="text-muted-gray">No scene assigned</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">
                <span className="text-muted-gray">No scene assigned</span>
              </SelectItem>
              {scenes.map((scene) => (
                <SelectItem key={scene.id} value={scene.id}>
                  Scene {scene.scene_number}
                  {scene.slugline ? ` - ${scene.slugline.slice(0, 30)}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-2 pt-3 border-t border-muted-gray/20">
        {/* Save changes */}
        {hasChanges && onUpdateHighlight && (
          <Button
            className="w-full bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            onClick={handleSave}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        )}

        {/* View in breakdown */}
        {highlight.breakdown_item_id && onViewBreakdown && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onViewBreakdown(highlight.breakdown_item_id!)}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View in Breakdown Tab
          </Button>
        )}

        {/* Delete */}
        {onDeleteHighlight && (
          <Button
            variant="ghost"
            className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onClick={onDeleteHighlight}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Highlight
          </Button>
        )}
      </div>
    </>
  );
};

// Main Component
const ScriptViewerSidebar: React.FC<ScriptViewerSidebarProps> = ({
  mode,
  selection,
  onCategorySelect,
  onCancel,
  highlight,
  scenes,
  onUpdateHighlight,
  onDeleteHighlight,
  onViewBreakdown,
  onClose,
}) => {
  const [notes, setNotes] = useState('');

  // Reset notes when selection changes
  useEffect(() => {
    if (mode === 'create') {
      setNotes('');
    }
  }, [mode, selection?.text]);

  // Hidden mode - render nothing
  if (mode === 'hidden') {
    return null;
  }

  const handleCategorySelect = (category: BacklotBreakdownItemType) => {
    onCategorySelect?.(category, notes.trim() || undefined);
  };

  return (
    <div className="w-80 flex-shrink-0 bg-charcoal-black/95 border-l border-muted-gray/20 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-muted-gray/20 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Highlighter className="w-4 h-4 text-accent-yellow" />
            <span className="text-sm font-medium text-bone-white">
              {mode === 'create' ? 'Add Breakdown Item' : 'Edit Highlight'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-gray hover:text-bone-white"
            onClick={mode === 'create' ? onCancel : onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {mode === 'create' && selection ? (
          <CreateModeContent
            selection={selection}
            notes={notes}
            setNotes={setNotes}
            onCategorySelect={handleCategorySelect}
          />
        ) : mode === 'edit' && highlight ? (
          <EditModeContent
            highlight={highlight}
            scenes={scenes}
            onUpdateHighlight={onUpdateHighlight}
            onDeleteHighlight={onDeleteHighlight}
            onViewBreakdown={onViewBreakdown}
          />
        ) : null}
      </div>
    </div>
  );
};

export default ScriptViewerSidebar;
