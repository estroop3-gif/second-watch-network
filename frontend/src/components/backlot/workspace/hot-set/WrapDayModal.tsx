/**
 * WrapDayModal - Wrap confirmation with day summary report
 *
 * Two-step confirmation process to prevent accidental wraps:
 * 1. Review day summary and click "Proceed to Wrap"
 * 2. Type "WRAP" to confirm final wrap
 *
 * Shows:
 * - Confirmation prompt
 * - Day summary (scenes completed/skipped, timing, variance)
 * - AD notes
 * - Time markers
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Square,
  CheckCircle2,
  SkipForward,
  Clock,
  Film,
  Flag,
  StickyNote,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ShieldAlert,
  DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWrapReport, formatElapsedTime, WrapReportData } from '@/hooks/backlot';

interface WrapDayModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  onConfirmWrap: (recordToBudget: boolean) => void;
  isWrapping: boolean;
}

export const WrapDayModal: React.FC<WrapDayModalProps> = ({
  open,
  onOpenChange,
  sessionId,
  onConfirmWrap,
  isWrapping,
}) => {
  const { data: report, isLoading } = useWrapReport(open ? sessionId : null);

  // Two-step confirmation state
  const [confirmationStep, setConfirmationStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState('');
  const [recordToBudget, setRecordToBudget] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setConfirmationStep(1);
      setConfirmText('');
      setRecordToBudget(false);
    }
  }, [open]);

  // Check if user typed "WRAP" correctly
  const isConfirmTextValid = confirmText.toUpperCase() === 'WRAP';

  const handleProceedToStep2 = () => {
    setConfirmationStep(2);
  };

  const handleBackToStep1 = () => {
    setConfirmationStep(1);
    setConfirmText('');
  };

  const handleFinalConfirm = () => {
    if (isConfirmTextValid) {
      onConfirmWrap(recordToBudget);
    }
  };

  const formatVariance = (minutes: number) => {
    const absMinutes = Math.abs(minutes);
    const hours = Math.floor(absMinutes / 60);
    const mins = absMinutes % 60;

    let timeStr = '';
    if (hours > 0) {
      timeStr = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    } else {
      timeStr = `${mins}m`;
    }

    if (minutes > 0) return `${timeStr} under budget`;
    if (minutes < 0) return `${timeStr} over budget`;
    return 'On budget';
  };

  const getVarianceColor = (minutes: number) => {
    if (minutes > 0) return 'text-green-400';
    if (minutes < 0) return 'text-red-400';
    return 'text-yellow-400';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-soft-black border-muted-gray/30 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-bone-white">
            {confirmationStep === 1 ? (
              <>
                <Square className="w-5 h-5 text-red-400" />
                Wrap Day {report?.day_number}
              </>
            ) : (
              <>
                <ShieldAlert className="w-5 h-5 text-red-400" />
                Confirm Wrap - Day {report?.day_number}
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            {confirmationStep === 1
              ? 'Review the day summary before wrapping. (Step 1 of 2)'
              : 'Final confirmation required. This action cannot be easily undone. (Step 2 of 2)'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Review day summary */}
        {confirmationStep === 1 && (
          <>
            {isLoading ? (
              <div className="space-y-4 py-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : report ? (
              <div className="space-y-4 py-4">
                {/* Day Overview */}
                <Card className="bg-charcoal-black border-muted-gray/20">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-gray uppercase">Call Time</p>
                        <p className="text-lg font-bold text-bone-white">
                          {report.call_time || '--:--'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-gray uppercase">Wrap Time</p>
                        <p className="text-lg font-bold text-bone-white">
                          {report.wrap_time || 'Now'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-gray uppercase">Total Shooting</p>
                        <p className="text-lg font-bold text-bone-white">
                          {formatElapsedTime(report.total_shooting_minutes)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-gray uppercase">Variance</p>
                        <p className={cn('text-lg font-bold', getVarianceColor(report.variance_minutes))}>
                          {formatVariance(report.variance_minutes)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Scenes Summary */}
                <Card className="bg-charcoal-black border-muted-gray/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Film className="w-4 h-4 text-accent-yellow" />
                      <h4 className="font-medium text-bone-white">Scenes</h4>
                    </div>

                    {/* Completed Scenes */}
                    {report.scenes_completed.length > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center gap-2 text-sm text-green-400 mb-2">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Completed ({report.scenes_completed.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {report.scenes_completed.map((scene, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="bg-green-500/10 border-green-500/30 text-green-400"
                            >
                              {scene.scene_number}
                              <span className="ml-1 text-xs text-green-400/70">
                                ({scene.actual_minutes}m)
                              </span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Skipped Scenes */}
                    {report.scenes_skipped.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 text-sm text-red-400 mb-2">
                          <SkipForward className="w-3 h-3" />
                          <span>Skipped ({report.scenes_skipped.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {report.scenes_skipped.map((scene, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="bg-red-500/10 border-red-500/30 text-red-400"
                            >
                              {scene.scene_number}
                              {scene.status !== 'skipped' && (
                                <span className="ml-1 text-xs text-red-400/70">
                                  ({scene.status})
                                </span>
                              )}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {report.scenes_completed.length === 0 && report.scenes_skipped.length === 0 && (
                      <p className="text-sm text-muted-gray text-center py-2">
                        No scenes tracked
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Time Markers */}
                {report.markers.length > 0 && (
                  <Card className="bg-charcoal-black border-muted-gray/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Flag className="w-4 h-4 text-blue-400" />
                        <h4 className="font-medium text-bone-white">Time Markers</h4>
                      </div>
                      <div className="space-y-2">
                        {report.markers.map((marker, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-muted-gray">{marker.label}</span>
                            <span className="font-mono text-bone-white">{marker.time}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* AD Notes */}
                {report.ad_notes && (
                  <Card className="bg-charcoal-black border-muted-gray/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <StickyNote className="w-4 h-4 text-accent-yellow" />
                        <h4 className="font-medium text-bone-white">AD Notes</h4>
                      </div>
                      <p className="text-sm text-muted-gray whitespace-pre-wrap">
                        {report.ad_notes}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Warning if behind schedule */}
                {report.variance_minutes < -30 && (
                  <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-400">Significantly Over Schedule</p>
                      <p className="text-xs text-red-400/70">
                        Day ran {formatElapsedTime(Math.abs(report.variance_minutes))} over the scheduled time.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-gray">
                <p>Unable to load wrap report</p>
              </div>
            )}
          </>
        )}

        {/* Step 2: Final confirmation */}
        {confirmationStep === 2 && (
          <div className="space-y-4 py-4">
            {/* Warning banner */}
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <ShieldAlert className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-400">Are you absolutely sure?</p>
                <p className="text-sm text-red-400/80 mt-1">
                  Wrapping the day will end all tracking for Day {report?.day_number}.
                  While you can resume the day if needed, it's best to only wrap when you're certain.
                </p>
              </div>
            </div>

            {/* Quick summary */}
            <Card className="bg-charcoal-black border-muted-gray/20">
              <CardContent className="p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-400">
                      {report?.scenes_completed.length || 0}
                    </p>
                    <p className="text-xs text-muted-gray">Scenes Completed</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-bone-white">
                      {report ? formatElapsedTime(report.total_shooting_minutes) : '--'}
                    </p>
                    <p className="text-xs text-muted-gray">Total Time</p>
                  </div>
                  <div>
                    <p className={cn(
                      'text-2xl font-bold',
                      report ? getVarianceColor(report.variance_minutes) : 'text-muted-gray'
                    )}>
                      {report?.variance_minutes !== undefined
                        ? (report.variance_minutes >= 0 ? '+' : '') + report.variance_minutes + 'm'
                        : '--'}
                    </p>
                    <p className="text-xs text-muted-gray">Variance</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Record labor costs option */}
            <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <Checkbox
                id="record-to-budget"
                checked={recordToBudget}
                onCheckedChange={(checked) => setRecordToBudget(checked === true)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <Label
                  htmlFor="record-to-budget"
                  className="text-sm font-medium text-bone-white cursor-pointer flex items-center gap-2"
                >
                  <DollarSign className="w-4 h-4 text-blue-400" />
                  Record labor costs to budget
                </Label>
                <p className="text-xs text-muted-gray mt-1">
                  Automatically record all crew day rates and overtime to the project budget actuals.
                </p>
              </div>
            </div>

            {/* Type WRAP to confirm */}
            <div className="space-y-2">
              <Label htmlFor="confirm-wrap" className="text-bone-white">
                Type <span className="font-mono font-bold text-red-400">WRAP</span> to confirm
              </Label>
              <Input
                id="confirm-wrap"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type WRAP here..."
                className={cn(
                  'bg-charcoal-black border-muted-gray/30 text-bone-white font-mono text-center text-lg',
                  isConfirmTextValid && 'border-green-500/50 bg-green-500/5'
                )}
                autoComplete="off"
                autoFocus
              />
              {confirmText && !isConfirmTextValid && (
                <p className="text-xs text-red-400">Please type "WRAP" exactly to confirm</p>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {confirmationStep === 1 ? (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleProceedToStep2}
                disabled={isLoading || !report}
                className="bg-orange-600 hover:bg-orange-500 text-white"
              >
                Proceed to Wrap
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleBackToStep1}
                disabled={isWrapping}
              >
                Go Back
              </Button>
              <Button
                onClick={handleFinalConfirm}
                disabled={isWrapping || !isConfirmTextValid}
                className={cn(
                  'text-white',
                  isConfirmTextValid
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-red-600/50 cursor-not-allowed'
                )}
              >
                {isWrapping ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Wrapping...
                  </>
                ) : (
                  <>
                    <Square className="w-4 h-4 mr-2" />
                    Wrap Day {report?.day_number}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
