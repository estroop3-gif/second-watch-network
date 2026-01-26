/**
 * AddCustomSegmentDialog - Create custom non-scripted segments
 *
 * Allows users to create custom segments with:
 * - Category selection
 * - Name and description
 * - Duration input
 * - Optional location
 * - Save as preset option
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
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
import { cn } from '@/lib/utils';
import {
  NonScriptedSegment,
  NonScriptedSegmentPreset,
  NonScriptedSegmentCategory,
} from '@/types/backlot';
import {
  SEGMENT_CATEGORIES,
  getSegmentCategoryColor,
  createUserPreset,
} from '@/lib/backlot/segmentPresets';
import {
  Plus,
  MessageSquare,
  Video,
  Wrench,
  User,
  Presentation,
  Music,
  MapPin,
  Layers,
  Save,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface AddCustomSegmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (segment: NonScriptedSegment) => void;
  onSaveAsPreset?: (preset: NonScriptedSegmentPreset) => void;
  locations?: Array<{ id: string; name: string }>;
}

// ============================================================================
// ICON MAPPING
// ============================================================================

function getCategoryIcon(category: NonScriptedSegmentCategory) {
  switch (category) {
    case 'interview': return <MessageSquare className="w-4 h-4" />;
    case 'broll': return <Video className="w-4 h-4" />;
    case 'technical': return <Wrench className="w-4 h-4" />;
    case 'talent': return <User className="w-4 h-4" />;
    case 'presentation': return <Presentation className="w-4 h-4" />;
    case 'performance': return <Music className="w-4 h-4" />;
    case 'location': return <MapPin className="w-4 h-4" />;
    case 'custom':
    default: return <Layers className="w-4 h-4" />;
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const AddCustomSegmentDialog: React.FC<AddCustomSegmentDialogProps> = ({
  isOpen,
  onClose,
  onAdd,
  onSaveAsPreset,
  locations = [],
}) => {
  // Form state
  const [category, setCategory] = useState<NonScriptedSegmentCategory>('custom');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(30);
  const [locationId, setLocationId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [saveAsPreset, setSaveAsPreset] = useState(false);

  // Reset form
  const resetForm = () => {
    setCategory('custom');
    setName('');
    setDescription('');
    setDuration(30);
    setLocationId('');
    setNotes('');
    setSaveAsPreset(false);
  };

  // Handle close
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Handle add
  const handleAdd = () => {
    if (!name.trim()) return;

    const selectedLocation = locations.find(l => l.id === locationId);

    // Create segment
    const segment: NonScriptedSegment = {
      id: `segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      category,
      name: name.trim(),
      description: description.trim() || undefined,
      duration_minutes: duration,
      location_id: locationId || undefined,
      location_name: selectedLocation?.name,
      notes: notes.trim() || undefined,
      sort_order: 0, // Will be set by parent
    };

    onAdd(segment);

    // Optionally save as preset
    if (saveAsPreset && onSaveAsPreset) {
      const preset = createUserPreset({
        category,
        name: name.trim(),
        description: description.trim() || undefined,
        duration_min_minutes: Math.max(5, duration - 15),
        duration_max_minutes: duration + 30,
        duration_default_minutes: duration,
      });
      onSaveAsPreset(preset);
    }

    handleClose();
  };

  const isValid = name.trim().length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-accent-yellow" />
            Add Custom Segment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as NonScriptedSegmentCategory)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEGMENT_CATEGORIES.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(cat.id)}
                      <span>{cat.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Segment Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., CEO Interview, Product B-Roll"
              className={cn(!name.trim() && 'border-red-500/50')}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this segment covers..."
              rows={2}
            />
          </div>

          {/* Duration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Duration</Label>
              <span className="text-sm font-medium text-accent-yellow">
                {duration} minutes
              </span>
            </div>
            <Slider
              value={[duration]}
              onValueChange={([v]) => setDuration(v)}
              min={5}
              max={180}
              step={5}
            />
            <div className="flex gap-2">
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
                min={5}
                max={480}
                className="h-8"
              />
              <span className="text-sm text-muted-gray self-center">min</span>
            </div>
          </div>

          {/* Location (optional) */}
          {locations.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="location">Location (optional)</Label>
              <Select
                value={locationId}
                onValueChange={setLocationId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select location..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No location</SelectItem>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-gray" />
                        {loc.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes for the production team..."
              rows={2}
            />
          </div>

          {/* Save as preset */}
          {onSaveAsPreset && (
            <div className="flex items-center space-x-2 p-3 bg-charcoal-black/50 rounded-lg border border-muted-gray/20">
              <Checkbox
                id="save_preset"
                checked={saveAsPreset}
                onCheckedChange={(checked) => setSaveAsPreset(!!checked)}
              />
              <label htmlFor="save_preset" className="text-sm cursor-pointer">
                <span className="flex items-center gap-2">
                  <Save className="w-4 h-4 text-muted-gray" />
                  Save as preset for future use
                </span>
                <p className="text-xs text-muted-gray mt-0.5">
                  This preset will be available in all your projects
                </p>
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!isValid}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Segment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddCustomSegmentDialog;
