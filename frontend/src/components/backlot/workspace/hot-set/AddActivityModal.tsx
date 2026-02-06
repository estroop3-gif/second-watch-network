/**
 * AddActivityModal - Modal for adding a new activity/schedule block to the Hot Set
 *
 * Features:
 * - Activity type selector (meal, company_move, camera_reset, lighting_reset, activity)
 * - Custom type option with name input
 * - Duration input (minutes) with defaults per type
 * - Optional location and notes
 * - Insert position selector
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Clock,
  Coffee,
  Truck,
  Target,
  Camera,
  Sun,
  Loader2,
  MapPin,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCreateActivity,
  ACTIVITY_DEFAULTS,
  ActivityBlockType,
} from '@/hooks/backlot';
import { ProjectedScheduleItem } from '@/types/backlot';
import { toast } from 'sonner';

interface AddActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  scheduleItems?: ProjectedScheduleItem[];
  onSuccess?: () => void;
}

// Activity type configuration
const ACTIVITY_TYPES: Array<{
  value: ActivityBlockType;
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
}> = [
  {
    value: 'meal',
    label: 'Meal Break',
    icon: Coffee,
    color: 'text-green-400 bg-green-500/10 border-green-500/30',
    description: 'Lunch, dinner, or other meal break',
  },
  {
    value: 'company_move',
    label: 'Company Move',
    icon: Truck,
    color: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    description: 'Move to a new location',
  },
  {
    value: 'camera_reset',
    label: 'Camera Reset',
    icon: Camera,
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    description: 'Camera setup or relocation',
  },
  {
    value: 'lighting_reset',
    label: 'Lighting Reset',
    icon: Sun,
    color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    description: 'Lighting change (day/night, etc.)',
  },
  {
    value: 'activity',
    label: 'Custom Activity',
    icon: Target,
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    description: 'Any other activity or break',
  },
];

export const AddActivityModal: React.FC<AddActivityModalProps> = ({
  open,
  onOpenChange,
  sessionId,
  scheduleItems = [],
  onSuccess,
}) => {
  const [blockType, setBlockType] = useState<ActivityBlockType>('meal');
  const [customName, setCustomName] = useState('');
  const [duration, setDuration] = useState(30);
  const [locationName, setLocationName] = useState('');
  const [notes, setNotes] = useState('');
  const [insertAfterId, setInsertAfterId] = useState<string>('end');

  // Create activity mutation
  const createActivityMutation = useCreateActivity();

  // Update duration when type changes
  useEffect(() => {
    setDuration(ACTIVITY_DEFAULTS[blockType].duration);
    if (blockType !== 'activity') {
      setCustomName('');
    }
  }, [blockType]);

  // Get pending schedule items for insert position
  const pendingItems = useMemo(() => {
    return scheduleItems.filter(item =>
      item.status === 'pending' && item.source_id
    );
  }, [scheduleItems]);

  // Get selected activity type config
  const selectedType = ACTIVITY_TYPES.find(t => t.value === blockType);

  // Reset state when modal closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setBlockType('meal');
      setCustomName('');
      setDuration(30);
      setLocationName('');
      setNotes('');
      setInsertAfterId('end');
    }
    onOpenChange(isOpen);
  };

  // Handle submit
  const handleSubmit = async () => {
    const name = blockType === 'activity' && customName
      ? customName
      : ACTIVITY_DEFAULTS[blockType].name;

    try {
      await createActivityMutation.mutateAsync({
        sessionId,
        blockType,
        name: blockType === 'activity' ? customName || undefined : undefined,
        expectedDurationMinutes: duration,
        insertAfterId: insertAfterId === 'end' ? null : insertAfterId,
        locationName: locationName || undefined,
        notes: notes || undefined,
      });

      toast.success(`${name} added to schedule`);
      handleOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add activity');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-soft-black border-muted-gray/30 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-bone-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-400" />
            Add Activity
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            Add a meal break, company move, or other activity to the schedule
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Activity type selection */}
          <div className="space-y-2">
            <Label className="text-bone-white">Activity Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {ACTIVITY_TYPES.map(type => {
                const Icon = type.icon;
                const isSelected = blockType === type.value;

                return (
                  <Card
                    key={type.value}
                    className={cn(
                      'cursor-pointer transition-all border',
                      isSelected
                        ? type.color
                        : 'bg-charcoal-black/50 border-muted-gray/20 hover:border-muted-gray/40'
                    )}
                    onClick={() => setBlockType(type.value)}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <Icon className={cn(
                        'w-5 h-5',
                        isSelected ? '' : 'text-muted-gray'
                      )} />
                      <div className="min-w-0">
                        <p className={cn(
                          'font-medium text-sm',
                          isSelected ? '' : 'text-bone-white'
                        )}>
                          {type.label}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {selectedType && (
              <p className="text-xs text-muted-gray mt-1">
                {selectedType.description}
              </p>
            )}
          </div>

          {/* Custom name for 'activity' type */}
          {blockType === 'activity' && (
            <div className="space-y-2">
              <Label className="text-bone-white">Activity Name</Label>
              <Input
                placeholder="e.g., Stunt Rehearsal, Hair/Makeup Touch-up..."
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="bg-charcoal-black border-muted-gray/30"
              />
            </div>
          )}

          {/* Duration */}
          <div className="space-y-2">
            <Label className="text-bone-white">Duration (minutes)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 15)}
                min={1}
                max={480}
                className="w-24 bg-charcoal-black border-muted-gray/30"
              />
              <span className="text-muted-gray text-sm">
                Default: {ACTIVITY_DEFAULTS[blockType].duration} min
              </span>
            </div>
          </div>

          {/* Location (for company_move) */}
          {blockType === 'company_move' && (
            <div className="space-y-2">
              <Label className="text-bone-white">Destination Location</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                <Input
                  placeholder="e.g., Stage 5, Backlot, etc."
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="pl-9 bg-charcoal-black border-muted-gray/30"
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-bone-white">Notes (optional)</Label>
            <Textarea
              placeholder="Any additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="bg-charcoal-black border-muted-gray/30 resize-none"
            />
          </div>

          {/* Insert position */}
          {pendingItems.length > 0 && (
            <div className="space-y-2">
              <Label className="text-bone-white">Insert Position</Label>
              <Select value={insertAfterId} onValueChange={setInsertAfterId}>
                <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-soft-black border-muted-gray/30">
                  <SelectItem value="end">
                    <span className="flex items-center gap-2">
                      <ArrowRight className="w-4 h-4" />
                      Add at the end
                    </span>
                  </SelectItem>
                  {pendingItems.map((item, index) => (
                    <SelectItem key={item.source_id} value={item.source_id!}>
                      <span className="flex items-center gap-2">
                        After {index + 1}. {item.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-gray">
                Choose where to insert the activity in today's schedule
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-muted-gray/20 pt-4">
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={createActivityMutation.isPending}
            className="text-muted-gray hover:text-bone-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createActivityMutation.isPending || (blockType === 'activity' && !customName)}
            className="bg-purple-500 text-white hover:bg-purple-600"
          >
            {createActivityMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Clock className="w-4 h-4 mr-2" />
                Add Activity
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
