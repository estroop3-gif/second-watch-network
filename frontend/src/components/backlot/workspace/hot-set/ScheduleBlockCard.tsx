/**
 * ScheduleBlockCard - Card for non-scene schedule items (meals, moves, activities)
 *
 * Features:
 * - Shows expected time, status
 * - Controls: Start, Complete, Skip, Adjust Time
 * - Visual status indicators
 */
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { HotSetScheduleBlock } from '@/types/backlot';
import { formatScheduleTime } from '@/hooks/backlot/useHotSet';
import {
  Coffee,
  Truck,
  Target,
  Clock,
  Play,
  CheckCircle2,
  SkipForward,
  Edit2,
  MapPin,
  Loader2,
} from 'lucide-react';

interface ScheduleBlockCardProps {
  block: HotSetScheduleBlock;
  onStart?: () => void;
  onComplete?: () => void;
  onSkip?: (reason?: string) => void;
  onAdjustTime?: (startTime: string, endTime: string) => void;
  canEdit: boolean;
  isPending?: boolean;
  timezone?: string | null;
}

// Block type icons
const blockTypeIcons: Record<string, React.ReactNode> = {
  meal: <Coffee className="w-5 h-5" />,
  company_move: <Truck className="w-5 h-5" />,
  activity: <Target className="w-5 h-5" />,
  crew_call: <Clock className="w-5 h-5" />,
  first_shot: <Clock className="w-5 h-5" />,
  wrap: <Clock className="w-5 h-5" />,
};

// Block type colors
const blockTypeColors: Record<string, string> = {
  meal: 'text-green-400 border-green-500/30',
  company_move: 'text-orange-400 border-orange-500/30',
  activity: 'text-purple-400 border-purple-500/30',
  crew_call: 'text-accent-yellow border-accent-yellow/30',
  first_shot: 'text-primary-red border-primary-red/30',
  wrap: 'text-muted-gray border-muted-gray/30',
};

// Status colors
const statusColors: Record<string, string> = {
  pending: 'border-muted-gray/30',
  in_progress: 'border-accent-yellow/50 bg-accent-yellow/5',
  completed: 'border-green-500/30 bg-green-500/5',
  skipped: 'border-red-500/30 bg-red-500/5 opacity-60',
};

export const ScheduleBlockCard: React.FC<ScheduleBlockCardProps> = ({
  block,
  onStart,
  onComplete,
  onSkip,
  onAdjustTime,
  canEdit,
  isPending,
  timezone,
}) => {
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustStartTime, setAdjustStartTime] = useState(block.expected_start_time);
  const [adjustEndTime, setAdjustEndTime] = useState(block.expected_end_time);

  const icon = blockTypeIcons[block.block_type] || <Target className="w-5 h-5" />;
  const typeColor = blockTypeColors[block.block_type] || 'text-muted-gray border-muted-gray/30';

  const handleAdjustSave = () => {
    onAdjustTime?.(adjustStartTime, adjustEndTime);
    setShowAdjustModal(false);
  };

  return (
    <>
      <Card className={cn('bg-soft-black transition-all', statusColors[block.status])}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            {/* Icon and Info */}
            <div className="flex items-start gap-3">
              {/* Type Icon */}
              <div className={cn('flex-shrink-0', typeColor)}>{icon}</div>

              {/* Content */}
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-bone-white">{block.name}</span>
                  {block.status === 'completed' && (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  )}
                  {block.status === 'in_progress' && (
                    <Badge className="bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30 text-xs">
                      In Progress
                    </Badge>
                  )}
                  {block.status === 'skipped' && (
                    <Badge variant="outline" className="text-xs text-red-400 border-red-500/30">
                      Skipped
                    </Badge>
                  )}
                </div>

                {/* Time Info */}
                <div className="flex items-center gap-4 text-sm text-muted-gray">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>
                      {formatScheduleTime(block.expected_start_time, timezone)} -{' '}
                      {formatScheduleTime(block.expected_end_time, timezone)}
                    </span>
                  </div>
                  <span className="text-xs">({block.expected_duration_minutes}m)</span>
                </div>

                {/* Location */}
                {block.location_name && (
                  <div className="flex items-center gap-1 mt-1 text-sm text-muted-gray">
                    <MapPin className="w-3 h-3" />
                    <span>{block.location_name}</span>
                  </div>
                )}

                {/* Notes */}
                {block.notes && (
                  <p className="mt-1 text-xs text-muted-gray italic">{block.notes}</p>
                )}
              </div>
            </div>

            {/* Actions */}
            {canEdit && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Pending: Start, Adjust, Skip */}
                {block.status === 'pending' && (
                  <>
                    {onStart && (
                      <Button
                        size="sm"
                        onClick={onStart}
                        disabled={isPending}
                        className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                      >
                        {isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-1" />
                            Start
                          </>
                        )}
                      </Button>
                    )}
                    {onAdjustTime && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowAdjustModal(true)}
                        disabled={isPending}
                        className="border-muted-gray/30"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    )}
                    {onSkip && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSkip()}
                        disabled={isPending}
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        <SkipForward className="w-4 h-4" />
                      </Button>
                    )}
                  </>
                )}

                {/* In Progress: Complete, Skip */}
                {block.status === 'in_progress' && (
                  <>
                    {onComplete && (
                      <Button
                        size="sm"
                        onClick={onComplete}
                        disabled={isPending}
                        className="bg-green-600 hover:bg-green-500"
                      >
                        {isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Complete
                          </>
                        )}
                      </Button>
                    )}
                    {onSkip && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSkip()}
                        disabled={isPending}
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        <SkipForward className="w-4 h-4" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Adjust Time Modal */}
      <Dialog open={showAdjustModal} onOpenChange={setShowAdjustModal}>
        <DialogContent className="bg-charcoal-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle className="text-bone-white">Adjust Expected Time</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-bone-white">Start Time</Label>
              <Input
                type="time"
                value={adjustStartTime}
                onChange={(e) => setAdjustStartTime(e.target.value)}
                className="bg-soft-black border-muted-gray/30"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-bone-white">End Time</Label>
              <Input
                type="time"
                value={adjustEndTime}
                onChange={(e) => setAdjustEndTime(e.target.value)}
                className="bg-soft-black border-muted-gray/30"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAdjustModal(false)}
              className="border-muted-gray/30"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdjustSave}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ScheduleBlockCard;
