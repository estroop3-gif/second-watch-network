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
  StickyNote,
  Plus,
} from 'lucide-react';
import {
  BacklotScriptHighlightBreakdown,
  BacklotBreakdownItemType,
  BacklotBreakdownDepartment,
  BacklotHighlightStatus,
  BacklotScriptPageNote,
  BacklotScriptPageNoteType,
  BREAKDOWN_HIGHLIGHT_COLORS,
  BREAKDOWN_ITEM_TYPE_LABELS,
  BREAKDOWN_DEPARTMENTS,
  BREAKDOWN_DEPARTMENT_LABELS,
  TYPE_TO_DEPARTMENT,
  SCRIPT_PAGE_NOTE_TYPE_LABELS,
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

export type SidebarMode = 'hidden' | 'create' | 'edit' | 'create-note' | 'edit-note';

interface ScriptViewerSidebarProps {
  mode: SidebarMode;
  // Create mode props (for highlights)
  selection?: TextSelection | null;
  onCategorySelect?: (category: BacklotBreakdownItemType, notes?: string) => void;
  onCancel?: () => void;
  // Edit mode props (for highlights)
  highlight?: BacklotScriptHighlightBreakdown | null;
  scenes?: SimplifiedScene[];
  onUpdateHighlight?: (updates: {
    category?: BacklotBreakdownItemType;
    department?: BacklotBreakdownDepartment;
    scene_id?: string | null;
    suggested_label?: string;
    status?: BacklotHighlightStatus;
  }) => void;
  onDeleteHighlight?: () => void;
  onViewBreakdown?: (breakdownItemId: string) => void;
  onClose?: () => void;
  // Note creation props
  pendingNotePosition?: {
    pageNumber: number;
    x: number;
    y: number;
    scene: ParsedScene | null;
  } | null;
  onCreateNote?: (input: {
    page_number: number;
    position_x: number;
    position_y: number;
    note_text: string;
    note_type: BacklotScriptPageNoteType;
    scene_id: string | null;
  }) => void;
  // Note editing props
  selectedNote?: BacklotScriptPageNote | null;
  onUpdateNote?: (noteId: string, updates: {
    note_text?: string;
    note_type?: BacklotScriptPageNoteType;
    scene_id?: string | null;
  }) => void;
  onDeleteNote?: (noteId: string) => void;
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
    department?: BacklotBreakdownDepartment;
    scene_id?: string | null;
    suggested_label?: string;
    status?: BacklotHighlightStatus;
  }) => void;
  onDeleteHighlight?: () => void;
  onViewBreakdown?: (breakdownItemId: string) => void;
}> = ({ highlight, scenes = [], onUpdateHighlight, onDeleteHighlight, onViewBreakdown }) => {
  const [category, setCategory] = useState<BacklotBreakdownItemType>(highlight.category);
  const [department, setDepartment] = useState<BacklotBreakdownDepartment>(
    highlight.department || TYPE_TO_DEPARTMENT[highlight.category]
  );
  const [sceneId, setSceneId] = useState<string>(highlight.scene_id || '');
  const [label, setLabel] = useState<string>(highlight.suggested_label || highlight.highlighted_text);
  const [status, setStatus] = useState<BacklotHighlightStatus>(highlight.status);
  const [hasChanges, setHasChanges] = useState(false);

  // Reset state when highlight changes
  useEffect(() => {
    setCategory(highlight.category);
    setDepartment(highlight.department || TYPE_TO_DEPARTMENT[highlight.category]);
    setSceneId(highlight.scene_id || '');
    setLabel(highlight.suggested_label || highlight.highlighted_text);
    setStatus(highlight.status);
    setHasChanges(false);
  }, [highlight.id]);

  // Auto-update department when category changes (unless user has manually changed it)
  const handleCategoryChange = (newCategory: BacklotBreakdownItemType) => {
    setCategory(newCategory);
    // Auto-set department based on new category
    setDepartment(TYPE_TO_DEPARTMENT[newCategory]);
  };

  // Track changes
  useEffect(() => {
    const originalDepartment = highlight.department || TYPE_TO_DEPARTMENT[highlight.category];
    const changed =
      category !== highlight.category ||
      department !== originalDepartment ||
      sceneId !== (highlight.scene_id || '') ||
      label !== (highlight.suggested_label || highlight.highlighted_text) ||
      status !== highlight.status;
    setHasChanges(changed);
  }, [category, department, sceneId, label, status, highlight]);

  const handleSave = () => {
    if (!onUpdateHighlight || !hasChanges) return;
    const updates: { category?: BacklotBreakdownItemType; department?: BacklotBreakdownDepartment; scene_id?: string | null; suggested_label?: string; status?: BacklotHighlightStatus } = {};
    if (category !== highlight.category) updates.category = category;
    const originalDepartment = highlight.department || TYPE_TO_DEPARTMENT[highlight.category];
    if (department !== originalDepartment) updates.department = department;
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
        <Select value={category} onValueChange={(v) => handleCategoryChange(v as BacklotBreakdownItemType)}>
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

      {/* Department selector */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-gray">Department</Label>
        <Select value={department} onValueChange={(v) => setDepartment(v as BacklotBreakdownDepartment)}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {BREAKDOWN_DEPARTMENT_LABELS[department]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {BREAKDOWN_DEPARTMENTS.map((dept) => (
              <SelectItem key={dept} value={dept}>
                {BREAKDOWN_DEPARTMENT_LABELS[dept]}
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

// Note Type Colors for badges
const getNoteTypeColor = (type: BacklotScriptPageNoteType): string => {
  const colors: Record<BacklotScriptPageNoteType, string> = {
    general: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
    direction: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
    production: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
    character: 'bg-red-500/20 text-red-400 border-red-500/40',
    blocking: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
    camera: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
    continuity: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
    sound: 'bg-sky-500/20 text-sky-400 border-sky-500/40',
    vfx: 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/40',
    prop: 'bg-violet-500/20 text-violet-400 border-violet-500/40',
    wardrobe: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40',
    makeup: 'bg-pink-500/20 text-pink-400 border-pink-500/40',
    location: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    safety: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
    other: 'bg-slate-500/20 text-slate-400 border-slate-500/40',
  };
  return colors[type] || colors.general;
};

// Create Note Mode Content
const CreateNoteModeContent: React.FC<{
  position: {
    pageNumber: number;
    x: number;
    y: number;
    scene: ParsedScene | null;
  };
  scenes: SimplifiedScene[];
  onSubmit: (input: {
    page_number: number;
    position_x: number;
    position_y: number;
    note_text: string;
    note_type: BacklotScriptPageNoteType;
    scene_id: string | null;
  }) => void;
  onCancel: () => void;
}> = ({ position, scenes, onSubmit, onCancel }) => {
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState<BacklotScriptPageNoteType>('general');
  const [sceneId, setSceneId] = useState<string | null>(
    position.scene ? scenes.find(s => s.scene_number === position.scene?.sceneNumber)?.id || null : null
  );

  const handleSubmit = () => {
    if (!noteText.trim()) return;
    onSubmit({
      page_number: position.pageNumber,
      position_x: position.x,
      position_y: position.y,
      note_text: noteText.trim(),
      note_type: noteType,
      scene_id: sceneId,
    });
  };

  return (
    <>
      {/* Position info */}
      <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-blue-400">Page {position.pageNumber}</span>
        </div>
        {position.scene && (
          <div className="flex items-center gap-2 pt-2 border-t border-blue-500/20">
            <Film className="w-3 h-3 text-blue-400" />
            <span className="text-xs text-muted-gray">
              Scene {position.scene.sceneNumber}: {formatSluglineForDisplay(position.scene.slugline).slice(0, 30)}
            </span>
          </div>
        )}
      </div>

      {/* Scene selector (manual override) */}
      {scenes.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-gray">Scene</Label>
          <Select value={sceneId || '_none'} onValueChange={(v) => setSceneId(v === '_none' ? null : v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select scene...">
                {sceneId ? (
                  (() => {
                    const scene = scenes.find(s => s.id === sceneId);
                    return scene
                      ? `Scene ${scene.scene_number}${scene.slugline ? ` - ${scene.slugline.slice(0, 20)}` : ''}`
                      : 'Unknown scene';
                  })()
                ) : (
                  <span className="text-muted-gray">No scene</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">
                <span className="text-muted-gray">No scene</span>
              </SelectItem>
              {scenes.map((scene) => (
                <SelectItem key={scene.id} value={scene.id}>
                  Scene {scene.scene_number}
                  {scene.slugline ? ` - ${scene.slugline.slice(0, 25)}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Note type selector */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-gray">Note Type</Label>
        <Select value={noteType} onValueChange={(v) => setNoteType(v as BacklotScriptPageNoteType)}>
          <SelectTrigger className="w-full">
            <SelectValue>
              <Badge variant="outline" className={cn('text-xs', getNoteTypeColor(noteType))}>
                {SCRIPT_PAGE_NOTE_TYPE_LABELS[noteType]}
              </Badge>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SCRIPT_PAGE_NOTE_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                <Badge variant="outline" className={cn('text-xs', getNoteTypeColor(value as BacklotScriptPageNoteType))}>
                  {label}
                </Badge>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Note text */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-gray">Note</Label>
        <Textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Enter your note..."
          rows={4}
          className="text-sm resize-none"
          autoFocus
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!noteText.trim()}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Note
        </Button>
      </div>
    </>
  );
};

// Edit Note Mode Content
const EditNoteModeContent: React.FC<{
  note: BacklotScriptPageNote;
  scenes: SimplifiedScene[];
  onUpdate: (noteId: string, updates: {
    note_text?: string;
    note_type?: BacklotScriptPageNoteType;
    scene_id?: string | null;
  }) => void;
  onDelete: (noteId: string) => void;
}> = ({ note, scenes, onUpdate, onDelete }) => {
  const [noteText, setNoteText] = useState(note.note_text);
  const [noteType, setNoteType] = useState<BacklotScriptPageNoteType>(note.note_type);
  const [sceneId, setSceneId] = useState<string | null>(note.scene_id);
  const [hasChanges, setHasChanges] = useState(false);

  // Reset state when note changes
  useEffect(() => {
    setNoteText(note.note_text);
    setNoteType(note.note_type);
    setSceneId(note.scene_id);
    setHasChanges(false);
  }, [note.id]);

  // Track changes
  useEffect(() => {
    const changed =
      noteText !== note.note_text ||
      noteType !== note.note_type ||
      sceneId !== note.scene_id;
    setHasChanges(changed);
  }, [noteText, noteType, sceneId, note]);

  const handleSave = () => {
    if (!hasChanges) return;
    const updates: { note_text?: string; note_type?: BacklotScriptPageNoteType; scene_id?: string | null } = {};
    if (noteText !== note.note_text) updates.note_text = noteText;
    if (noteType !== note.note_type) updates.note_type = noteType;
    if (sceneId !== note.scene_id) updates.scene_id = sceneId;
    onUpdate(note.id, updates);
  };

  return (
    <>
      {/* Position info */}
      <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-blue-400">Page {note.page_number}</span>
          <Badge variant="outline" className={cn('text-xs', getNoteTypeColor(note.note_type))}>
            {SCRIPT_PAGE_NOTE_TYPE_LABELS[note.note_type]}
          </Badge>
        </div>
      </div>

      {/* Scene selector */}
      {scenes.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-gray">Scene</Label>
          <Select value={sceneId || '_none'} onValueChange={(v) => setSceneId(v === '_none' ? null : v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select scene...">
                {sceneId ? (
                  (() => {
                    const scene = scenes.find(s => s.id === sceneId);
                    return scene
                      ? `Scene ${scene.scene_number}${scene.slugline ? ` - ${scene.slugline.slice(0, 20)}` : ''}`
                      : 'Unknown scene';
                  })()
                ) : (
                  <span className="text-muted-gray">No scene</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">
                <span className="text-muted-gray">No scene</span>
              </SelectItem>
              {scenes.map((scene) => (
                <SelectItem key={scene.id} value={scene.id}>
                  Scene {scene.scene_number}
                  {scene.slugline ? ` - ${scene.slugline.slice(0, 25)}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Note type selector */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-gray">Note Type</Label>
        <Select value={noteType} onValueChange={(v) => setNoteType(v as BacklotScriptPageNoteType)}>
          <SelectTrigger className="w-full">
            <SelectValue>
              <Badge variant="outline" className={cn('text-xs', getNoteTypeColor(noteType))}>
                {SCRIPT_PAGE_NOTE_TYPE_LABELS[noteType]}
              </Badge>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SCRIPT_PAGE_NOTE_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                <Badge variant="outline" className={cn('text-xs', getNoteTypeColor(value as BacklotScriptPageNoteType))}>
                  {label}
                </Badge>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Note text */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-gray">Note</Label>
        <Textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Enter your note..."
          rows={4}
          className="text-sm resize-none"
        />
      </div>

      {/* Action buttons */}
      <div className="space-y-2 pt-3 border-t border-muted-gray/20">
        {/* Save changes */}
        {hasChanges && (
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleSave}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        )}

        {/* Delete */}
        <Button
          variant="ghost"
          className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
          onClick={() => onDelete(note.id)}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Note
        </Button>
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
  scenes = [],
  onUpdateHighlight,
  onDeleteHighlight,
  onViewBreakdown,
  onClose,
  // Note props
  pendingNotePosition,
  onCreateNote,
  selectedNote,
  onUpdateNote,
  onDeleteNote,
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

  // Determine header icon and title based on mode
  const isNoteMode = mode === 'create-note' || mode === 'edit-note';
  const headerIcon = isNoteMode
    ? <StickyNote className="w-4 h-4 text-blue-400" />
    : <Highlighter className="w-4 h-4 text-accent-yellow" />;
  const headerTitle = mode === 'create' ? 'Add Breakdown Item'
    : mode === 'edit' ? 'Edit Highlight'
    : mode === 'create-note' ? 'Add Note'
    : 'Edit Note';

  const handleClose = () => {
    if (mode === 'create' || mode === 'create-note') {
      onCancel?.();
    } else {
      onClose?.();
    }
  };

  return (
    <div className="w-80 flex-shrink-0 bg-charcoal-black/95 border-l border-muted-gray/20 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-muted-gray/20 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {headerIcon}
            <span className="text-sm font-medium text-bone-white">
              {headerTitle}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-gray hover:text-bone-white"
            onClick={handleClose}
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
        ) : mode === 'create-note' && pendingNotePosition && onCreateNote ? (
          <CreateNoteModeContent
            position={pendingNotePosition}
            scenes={scenes}
            onSubmit={(input) => {
              onCreateNote(input);
              onCancel?.();
            }}
            onCancel={() => onCancel?.()}
          />
        ) : mode === 'edit-note' && selectedNote && onUpdateNote && onDeleteNote ? (
          <EditNoteModeContent
            note={selectedNote}
            scenes={scenes}
            onUpdate={(noteId, updates) => {
              onUpdateNote(noteId, updates);
            }}
            onDelete={(noteId) => {
              onDeleteNote(noteId);
              onClose?.();
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

export default ScriptViewerSidebar;
