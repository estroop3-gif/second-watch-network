/**
 * TimecardsView - Timecard management for crew and managers
 * Shows personal timecards for crew, review interface for showrunner/producers
 */
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Timer,
  Plus,
  Clock,
  Calendar,
  Check,
  X,
  Send,
  ChevronRight,
  AlertCircle,
  Coffee,
  Download,
  Loader2,
  ChevronDown,
  Edit3,
  MapPin,
  DollarSign,
  Plane,
  Package,
  Flag,
  Star,
  Eye,
  FileText,
  Info,
  TriangleAlert,
  CircleX,
  CheckCircle2,
  Printer,
  Play,
  Square,
  UtensilsCrossed,
} from 'lucide-react';
import {
  useMyTimecards,
  useTimecardsForReview,
  useTimecard,
  useTimecardSummary,
  useCreateTimecard,
  useUpsertTimecardEntry,
  useImportCheckinsToTimecard,
  useTimecardPreview,
  useSubmitTimecard,
  useApproveTimecard,
  useRejectTimecard,
  useMyCheckins,
  useTodayClockStatus,
  useClockIn,
  useClockOut,
  useResetClock,
  useUnwrap,
  useLunchStart,
  useLunchEnd,
  calculateRunningDuration,
  TimecardListItem,
  TimecardEntry,
  TimecardPreview,
  ClockStatus,
  getWeekStartDate,
  getWeekDates,
  formatWeekRange,
  TIMECARD_STATUS_CONFIG,
} from '@/hooks/backlot';
import { cn } from '@/lib/utils';

interface TimecardsViewProps {
  projectId: string;
  canReview: boolean; // showrunner or producer role
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DEPARTMENTS = [
  { value: 'production', label: 'Production' },
  { value: 'camera', label: 'Camera' },
  { value: 'grip', label: 'Grip' },
  { value: 'electric', label: 'Electric' },
  { value: 'sound', label: 'Sound' },
  { value: 'art', label: 'Art Department' },
  { value: 'wardrobe', label: 'Wardrobe' },
  { value: 'hair_makeup', label: 'Hair & Makeup' },
  { value: 'locations', label: 'Locations' },
  { value: 'transport', label: 'Transport' },
  { value: 'catering', label: 'Catering' },
  { value: 'post', label: 'Post Production' },
  { value: 'other', label: 'Other' },
] as const;

const RATE_TYPES = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'flat', label: 'Flat Rate' },
] as const;

// LiveClockWidget Component - shows live time tracking at top of view
interface LiveClockWidgetProps {
  projectId: string;
  onTimecardCreated?: (timecardId: string) => void;
}

// Optimistic state type for instant UI updates
type OptimisticState =
  | { type: 'idle' }
  | { type: 'clocked_in'; clockInTime: string }
  | { type: 'on_lunch'; clockInTime: string; lunchStartTime: string }
  | { type: 'wrapped'; clockInTime: string; wrapTime: string };

function LiveClockWidget({ projectId, onTimecardCreated }: LiveClockWidgetProps) {
  const { data: clockStatus, isLoading, isError, refetch } = useTodayClockStatus(projectId);
  const clockIn = useClockIn(projectId);
  const clockOut = useClockOut(projectId);
  const resetClock = useResetClock(projectId);
  const unwrap = useUnwrap(projectId);
  const lunchStart = useLunchStart(projectId);
  const lunchEnd = useLunchEnd(projectId);

  // Optimistic state for instant UI updates
  const [optimistic, setOptimistic] = useState<OptimisticState>({ type: 'idle' });

  // Confirmation dialog states
  const [showCallConfirm, setShowCallConfirm] = useState(false);
  const [showWrapConfirm, setShowWrapConfirm] = useState(false);
  const [resetConfirmStep, setResetConfirmStep] = useState(0); // 0 = closed, 1-3 = confirmation steps

  // Running timer state - updates every second
  const [runningTime, setRunningTime] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [lunchTime, setLunchTime] = useState({ hours: 0, minutes: 0, seconds: 0 });

  // Derive effective state from optimistic or server state
  const effectiveState = React.useMemo(() => {
    // If we have optimistic state, use it
    if (optimistic.type !== 'idle') {
      return {
        is_clocked_in: optimistic.type === 'clocked_in' || optimistic.type === 'on_lunch',
        is_on_lunch: optimistic.type === 'on_lunch',
        is_wrapped: optimistic.type === 'wrapped',
        clock_in_time: optimistic.type !== 'idle' ? (optimistic as any).clockInTime : null,
        lunch_start_time: optimistic.type === 'on_lunch' ? optimistic.lunchStartTime : null,
        wrap_time: optimistic.type === 'wrapped' ? optimistic.wrapTime : null,
      };
    }
    // Otherwise use server state
    return {
      is_clocked_in: clockStatus?.is_clocked_in || false,
      is_on_lunch: clockStatus?.is_on_lunch || false,
      is_wrapped: !clockStatus?.is_clocked_in && !!clockStatus?.clock_out_time,
      clock_in_time: clockStatus?.clock_in_time || null,
      lunch_start_time: clockStatus?.lunch_start_time || null,
      wrap_time: clockStatus?.clock_out_time || null,
    };
  }, [optimistic, clockStatus]);

  // Log for debugging
  useEffect(() => {
    console.log('[LiveClockWidget] Status:', { isLoading, isError, clockStatus, optimistic: optimistic.type });
  }, [isLoading, isError, clockStatus, optimistic]);

  // Update timer every second based on effective state
  useEffect(() => {
    if (!effectiveState.is_clocked_in && !effectiveState.is_on_lunch) {
      setRunningTime({ hours: 0, minutes: 0, seconds: 0 });
      setLunchTime({ hours: 0, minutes: 0, seconds: 0 });
      return;
    }

    const updateTimer = () => {
      if (effectiveState.is_on_lunch && effectiveState.lunch_start_time) {
        setLunchTime(calculateRunningDuration(effectiveState.lunch_start_time));
        // Also keep running time updated (paused during lunch display)
        if (effectiveState.clock_in_time) {
          setRunningTime(calculateRunningDuration(effectiveState.clock_in_time));
        }
      } else if (effectiveState.clock_in_time) {
        setRunningTime(calculateRunningDuration(effectiveState.clock_in_time));
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [effectiveState.is_clocked_in, effectiveState.is_on_lunch, effectiveState.clock_in_time, effectiveState.lunch_start_time]);

  // Clear optimistic state when server data catches up
  useEffect(() => {
    if (optimistic.type === 'idle') return;

    // Check if server state matches our optimistic state
    if (optimistic.type === 'clocked_in' && clockStatus?.is_clocked_in && !clockStatus?.is_on_lunch) {
      setOptimistic({ type: 'idle' });
    } else if (optimistic.type === 'on_lunch' && clockStatus?.is_on_lunch) {
      setOptimistic({ type: 'idle' });
    } else if (optimistic.type === 'wrapped' && clockStatus?.clock_out_time) {
      setOptimistic({ type: 'idle' });
    }
  }, [clockStatus, optimistic.type]);

  // Show confirmation dialog for clock in
  const handleClockInClick = () => {
    setShowCallConfirm(true);
  };

  // Actually perform clock in after confirmation
  const handleClockInConfirm = async () => {
    setShowCallConfirm(false);
    const now = new Date().toISOString();
    // Optimistic update - instantly show clocked in state
    setOptimistic({ type: 'clocked_in', clockInTime: now });

    try {
      const result = await clockIn.mutateAsync();
      if (result.timecard_id && onTimecardCreated) {
        onTimecardCreated(result.timecard_id);
      }
      refetch();
    } catch (error) {
      console.error('Failed to clock in:', error);
      // Revert optimistic update on error
      setOptimistic({ type: 'idle' });
    }
  };

  // Show confirmation dialog for clock out
  const handleClockOutClick = () => {
    setShowWrapConfirm(true);
  };

  // Actually perform clock out after confirmation
  const handleClockOutConfirm = async () => {
    setShowWrapConfirm(false);
    const now = new Date().toISOString();
    const clockInTime = effectiveState.clock_in_time || now;
    // Optimistic update - instantly show wrapped state
    setOptimistic({ type: 'wrapped', clockInTime, wrapTime: now });

    try {
      await clockOut.mutateAsync(clockStatus?.entry_id);
      refetch();
    } catch (error) {
      console.error('Failed to clock out:', error);
      // Revert to clocked in state on error
      setOptimistic({ type: 'clocked_in', clockInTime });
    }
  };

  // Open reset confirmation dialog (3-step process)
  const handleClearDayClick = () => {
    setResetConfirmStep(1);
  };

  // Handle reset confirmation steps
  const handleResetConfirmNext = () => {
    if (resetConfirmStep < 3) {
      setResetConfirmStep(resetConfirmStep + 1);
    }
  };

  // Final reset after all 3 confirmations
  const handleClearDayConfirm = async () => {
    setResetConfirmStep(0);
    setOptimistic({ type: 'idle' });

    try {
      await resetClock.mutateAsync();
      refetch();
    } catch (error) {
      console.error('Failed to reset clock:', error);
    }
  };

  const handleLunchStart = async () => {
    const now = new Date().toISOString();
    const clockInTime = effectiveState.clock_in_time || now;
    // Optimistic update - instantly show on lunch state
    setOptimistic({ type: 'on_lunch', clockInTime, lunchStartTime: now });

    try {
      await lunchStart.mutateAsync(clockStatus?.entry_id);
      refetch();
    } catch (error) {
      console.error('Failed to start lunch:', error);
      // Revert to clocked in state on error
      setOptimistic({ type: 'clocked_in', clockInTime });
    }
  };

  const handleLunchEnd = async () => {
    const clockInTime = effectiveState.clock_in_time || new Date().toISOString();
    // Optimistic update - instantly show back on set
    setOptimistic({ type: 'clocked_in', clockInTime });

    try {
      await lunchEnd.mutateAsync(clockStatus?.entry_id);
      refetch();
    } catch (error) {
      console.error('Failed to end lunch:', error);
      // Revert to on lunch state on error
      const lunchStartTime = effectiveState.lunch_start_time || new Date().toISOString();
      setOptimistic({ type: 'on_lunch', clockInTime, lunchStartTime });
    }
  };

  const handleUnwrap = async () => {
    const clockInTime = effectiveState.clock_in_time || new Date().toISOString();
    // Optimistic update - instantly show back to clocked in state
    setOptimistic({ type: 'clocked_in', clockInTime });

    try {
      await unwrap.mutateAsync();
      refetch();
    } catch (error) {
      console.error('Failed to unwrap:', error);
      // Revert to wrapped state on error
      const wrapTime = effectiveState.wrap_time || new Date().toISOString();
      setOptimistic({ type: 'wrapped', clockInTime, wrapTime });
    }
  };

  const formatTime = (h: number, m: number, s: number) => {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatCallTime = (isoString: string | null) => {
    if (!isoString) return '--:--';
    // Ensure UTC times are parsed correctly - add 'Z' if no timezone info
    let timeStr = isoString;
    if (!timeStr.endsWith('Z') && !timeStr.includes('+') && !timeStr.includes('-', 10)) {
      timeStr = timeStr + 'Z';
    }
    const date = new Date(timeStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Confirmation dialogs (shared across all states)
  const confirmationDialogs = (
    <>
      <Dialog open={showCallConfirm} onOpenChange={setShowCallConfirm}>
        <DialogContent className="bg-charcoal-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle className="text-bone-white">Start Your Day?</DialogTitle>
            <DialogDescription className="text-muted-gray">
              This will clock you in at the current time. Are you sure you want to start?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCallConfirm(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleClockInConfirm}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              <Play className="w-4 h-4 mr-2" />
              Yes, Clock In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showWrapConfirm} onOpenChange={setShowWrapConfirm}>
        <DialogContent className="bg-charcoal-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle className="text-bone-white">Wrap for the Day?</DialogTitle>
            <DialogDescription className="text-muted-gray">
              This will clock you out and calculate your hours. Are you sure you want to wrap?
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-center">
            <p className="text-2xl font-mono font-bold text-green-400">
              {formatTime(runningTime.hours, runningTime.minutes, runningTime.seconds)}
            </p>
            <p className="text-xs text-muted-gray">Time worked today</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowWrapConfirm(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleClockOutConfirm}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              <Square className="w-4 h-4 mr-2" />
              Yes, Wrap
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3-Step Reset Confirmation Dialog */}
      <Dialog open={resetConfirmStep > 0} onOpenChange={(open) => !open && setResetConfirmStep(0)}>
        <DialogContent className="bg-charcoal-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle className="text-bone-white flex items-center gap-2">
              <TriangleAlert className="w-5 h-5 text-red-400" />
              Reset Today's Clock - Step {resetConfirmStep} of 3
            </DialogTitle>
            <DialogDescription className="text-muted-gray">
              {resetConfirmStep === 1 && (
                "This will clear all clock data for today. This action cannot be undone."
              )}
              {resetConfirmStep === 2 && (
                "Are you absolutely sure? Your call time, wrap time, and lunch data will be lost."
              )}
              {resetConfirmStep === 3 && (
                "Final confirmation: Click 'Reset' to permanently clear today's clock data."
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Progress indicator */}
          <div className="flex justify-center gap-2 py-4">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={cn(
                  "w-3 h-3 rounded-full transition-colors",
                  step <= resetConfirmStep ? "bg-red-500" : "bg-muted-gray/30"
                )}
              />
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResetConfirmStep(0)}>
              Cancel
            </Button>
            {resetConfirmStep < 3 ? (
              <Button
                onClick={handleResetConfirmNext}
                className="bg-red-500/80 hover:bg-red-500 text-white"
              >
                Continue ({resetConfirmStep}/3)
              </Button>
            ) : (
              <Button
                onClick={handleClearDayConfirm}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <X className="w-4 h-4 mr-2" />
                Reset Clock
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (isLoading && optimistic.type === 'idle') {
    return (
      <>
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-4">
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
        {confirmationDialogs}
      </>
    );
  }

  // State: Timecard is submitted or approved - cannot clock in
  const timecardStatus = clockStatus?.timecard_status;
  if (timecardStatus && !['draft', 'rejected'].includes(timecardStatus)) {
    const statusLabels: Record<string, string> = {
      submitted: 'submitted for approval',
      approved: 'approved',
      pending_approval: 'pending approval',
    };
    const statusLabel = statusLabels[timecardStatus] || timecardStatus;

    return (
      <>
        <Card className="bg-gradient-to-r from-charcoal-black to-charcoal-black/80 border-amber-500/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-lg font-medium text-bone-white">Timecard {statusLabel}</p>
                <p className="text-sm text-muted-gray">
                  This week's timecard has been {statusLabel}. You cannot clock in until it's processed or rejected.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        {confirmationDialogs}
      </>
    );
  }

  // State: Not clocked in yet (or error/no data - show Call button as default)
  if (!effectiveState.is_clocked_in && !effectiveState.is_on_lunch && !effectiveState.is_wrapped) {
    return (
      <>
        <Card className="bg-gradient-to-r from-charcoal-black to-charcoal-black/80 border-green-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Play className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-lg font-medium text-bone-white">Ready to start your day?</p>
                  <p className="text-sm text-muted-gray">Tap Call to clock in and start tracking time</p>
                </div>
              </div>
              <Button
                size="lg"
                onClick={handleClockInClick}
                disabled={clockIn.isPending}
                className="bg-green-500 hover:bg-green-600 text-white px-8"
              >
                {clockIn.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Call
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
        {confirmationDialogs}
      </>
    );
  }

  // State: Wrapped for the day - show summary
  if (effectiveState.is_wrapped) {
    const entry = clockStatus?.today_entry;
    const ot = clockStatus?.overtime_breakdown;
    const pay = clockStatus?.pay_breakdown;

    // Calculate hours for optimistic display
    let displayHours = ot?.total_hours || entry?.hours_worked || 0;
    if (optimistic.type === 'wrapped' && effectiveState.clock_in_time && effectiveState.wrap_time) {
      const start = new Date(effectiveState.clock_in_time).getTime();
      const end = new Date(effectiveState.wrap_time).getTime();
      const rawHours = (end - start) / (1000 * 60 * 60);
      // Show at least 0.1 for any positive time, round to 2 decimal places for precision
      displayHours = rawHours > 0 ? Math.max(0.1, Math.round(rawHours * 100) / 100) : 0;
    }
    // Ensure displayHours is a valid number
    if (isNaN(displayHours) || displayHours === undefined) {
      displayHours = 0;
    }

    return (
      <>
      <Card className="bg-gradient-to-r from-charcoal-black to-charcoal-black/80 border-blue-500/30">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-lg font-medium text-bone-white">Today's Summary</p>
                <p className="text-sm text-muted-gray">
                  {formatCallTime(effectiveState.clock_in_time || entry?.call_time)} - {formatCallTime(effectiveState.wrap_time || entry?.wrap_time)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted-gray/10 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-bone-white">
                {displayHours < 1 ? displayHours.toFixed(2) : displayHours.toFixed(1)}
              </p>
              <p className="text-xs text-muted-gray">Total Hours</p>
            </div>
            {ot && ot.regular_hours > 0 && (
              <div className="bg-muted-gray/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-400">{ot.regular_hours.toFixed(1)}</p>
                <p className="text-xs text-muted-gray">Regular</p>
              </div>
            )}
            {ot && ot.overtime_hours > 0 && (
              <div className="bg-muted-gray/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-accent-yellow">{ot.overtime_hours.toFixed(1)}</p>
                <p className="text-xs text-muted-gray">OT (1.5x)</p>
              </div>
            )}
            {ot && ot.double_time_hours > 0 && (
              <div className="bg-muted-gray/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-orange-400">{ot.double_time_hours.toFixed(1)}</p>
                <p className="text-xs text-muted-gray">DT (2x)</p>
              </div>
            )}
            {pay && pay.total_pay > 0 && (
              <div className="bg-green-500/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-400">
                  ${pay.total_pay.toFixed(2)}
                </p>
                <p className="text-xs text-muted-gray">Today's Pay</p>
              </div>
            )}
          </div>

          {pay && pay.total_pay > 0 && (
            <div className="mt-4 pt-4 border-t border-muted-gray/20">
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-gray">
                {pay.regular_pay > 0 && (
                  <span>Regular: ${pay.regular_pay.toFixed(2)}</span>
                )}
                {pay.overtime_pay > 0 && (
                  <span className="text-accent-yellow">OT: ${pay.overtime_pay.toFixed(2)}</span>
                )}
                {pay.double_time_pay > 0 && (
                  <span className="text-orange-400">DT: ${pay.double_time_pay.toFixed(2)}</span>
                )}
                <span className="text-muted-gray/60">
                  ({pay.rate_type === 'daily' ? 'Day Rate' : 'Hourly'}: ${pay.rate_amount})
                </span>
              </div>
            </div>
          )}

          {/* Unwrap and Clear buttons */}
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnwrap}
              disabled={unwrap.isPending}
              className="border-green-500/30 text-green-400 hover:bg-green-500/10 hover:text-green-300"
            >
              {unwrap.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-1" />
              )}
              Unwrap
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearDayClick}
              className="text-muted-gray hover:text-bone-white"
            >
              <X className="w-4 h-4 mr-1" />
              Clear & Start Over
            </Button>
          </div>
        </CardContent>
      </Card>
      {confirmationDialogs}
      </>
    );
  }

  // State: On lunch
  if (effectiveState.is_on_lunch) {
    return (
      <>
      <Card className="bg-gradient-to-r from-charcoal-black to-amber-900/20 border-amber-500/30">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center animate-pulse">
                <UtensilsCrossed className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                    At Lunch
                  </Badge>
                </div>
                <p className="text-sm text-muted-gray mt-1">
                  Started: {formatCallTime(effectiveState.lunch_start_time)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-3xl font-mono font-bold text-amber-400">
                  {formatTime(lunchTime.hours, lunchTime.minutes, lunchTime.seconds)}
                </p>
                <p className="text-xs text-muted-gray">Lunch Duration</p>
              </div>

              <Button
                size="lg"
                onClick={handleLunchEnd}
                disabled={lunchEnd.isPending}
                className="bg-amber-500 hover:bg-amber-600 text-white px-8"
              >
                {lunchEnd.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Back
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {confirmationDialogs}
      </>
    );
  }

  // State: Clocked in - on set
  return (
    <>
    <Card className="bg-gradient-to-r from-charcoal-black to-green-900/20 border-green-500/30">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  On Set
                </Badge>
              </div>
              <p className="text-sm text-muted-gray mt-1">
                Call: {formatCallTime(effectiveState.clock_in_time)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-3xl font-mono font-bold text-green-400">
                {formatTime(runningTime.hours, runningTime.minutes, runningTime.seconds)}
              </p>
              <p className="text-xs text-muted-gray">Running</p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="lg"
                variant="outline"
                onClick={handleLunchStart}
                disabled={lunchStart.isPending}
                className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 px-6"
              >
                {lunchStart.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <UtensilsCrossed className="w-5 h-5 mr-2" />
                    Lunch
                  </>
                )}
              </Button>

              <Button
                size="lg"
                onClick={handleClockOutClick}
                disabled={clockOut.isPending}
                className="bg-red-500 hover:bg-red-600 text-white px-6"
              >
                {clockOut.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Square className="w-5 h-5 mr-2" />
                    Wrap
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    {confirmationDialogs}
    </>
  );
}

export default function TimecardsView({ projectId, canReview }: TimecardsViewProps) {
  const [activeTab, setActiveTab] = useState<'my' | 'review'>('my');
  const [selectedTimecardId, setSelectedTimecardId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingTimecardId, setRejectingTimecardId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(getWeekStartDate());

  // Queries
  const { data: myTimecards, isLoading: loadingMy } = useMyTimecards(projectId, statusFilter === 'all' ? undefined : statusFilter);
  const { data: reviewTimecards, isLoading: loadingReview } = useTimecardsForReview(
    canReview && activeTab === 'review' ? projectId : null,
    statusFilter === 'all' ? undefined : statusFilter
  );
  const { data: summary, isLoading: loadingSummary } = useTimecardSummary(projectId);
  const { data: selectedTimecard, isLoading: loadingSelected } = useTimecard(projectId, selectedTimecardId);

  // Mutations
  const createTimecard = useCreateTimecard(projectId);
  const submitTimecard = useSubmitTimecard(projectId);
  const approveTimecard = useApproveTimecard(projectId);
  const rejectTimecard = useRejectTimecard(projectId);

  // Calculate current week's Monday
  const currentWeekStart = getWeekStartDate();

  // Check if current week timecard exists
  const hasCurrentWeekTimecard = myTimecards?.some(tc => tc.week_start_date === currentWeekStart);

  // Generate week options (current week and past 8 weeks)
  const getWeekOptions = () => {
    const options: { value: string; label: string; exists: boolean }[] = [];
    const today = new Date();

    for (let i = 0; i < 9; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - (i * 7));
      const weekStart = getWeekStartDate(d);
      const exists = myTimecards?.some(tc => tc.week_start_date === weekStart) || false;

      options.push({
        value: weekStart,
        label: formatWeekRange(weekStart) + (i === 0 ? ' (Current)' : ''),
        exists
      });
    }
    return options;
  };

  const weekOptions = getWeekOptions();

  const handleOpenCreateDialog = () => {
    // Find first week without a timecard, preferring current week
    const firstAvailableWeek = weekOptions.find(w => !w.exists)?.value || getWeekStartDate();
    setSelectedWeekStart(firstAvailableWeek);
    setCreateDialogOpen(true);
  };

  const handleCreateTimecard = async () => {
    try {
      const result = await createTimecard.mutateAsync(selectedWeekStart);
      setCreateDialogOpen(false);
      setSelectedTimecardId(result.id);
    } catch (error) {
      console.error('Failed to create timecard:', error);
    }
  };

  const handleSubmit = async (timecardId: string) => {
    try {
      await submitTimecard.mutateAsync(timecardId);
      setSelectedTimecardId(null);
    } catch (error) {
      console.error('Failed to submit timecard:', error);
    }
  };

  const handleApprove = async (timecardId: string) => {
    try {
      await approveTimecard.mutateAsync(timecardId);
    } catch (error) {
      console.error('Failed to approve timecard:', error);
    }
  };

  const handleReject = async () => {
    if (!rejectingTimecardId) return;
    try {
      await rejectTimecard.mutateAsync({ timecardId: rejectingTimecardId, reason: rejectReason });
      setRejectDialogOpen(false);
      setRejectingTimecardId(null);
      setRejectReason('');
    } catch (error) {
      console.error('Failed to reject timecard:', error);
    }
  };

  const openRejectDialog = (timecardId: string) => {
    setRejectingTimecardId(timecardId);
    setRejectDialogOpen(true);
  };

  if (loadingMy || loadingSummary) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  // If a timecard is selected, show detail/edit view
  if (selectedTimecardId && selectedTimecard) {
    return (
      <TimecardEditor
        projectId={projectId}
        timecard={selectedTimecard}
        onBack={() => setSelectedTimecardId(null)}
        onSubmit={() => handleSubmit(selectedTimecardId)}
        canEdit={selectedTimecard.status === 'draft' || selectedTimecard.status === 'rejected'}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading text-bone-white">Timecards</h2>
          <p className="text-sm text-muted-gray">
            Track and submit your work hours
          </p>
        </div>
        <Button
          onClick={handleOpenCreateDialog}
          disabled={createTimecard.isPending}
          className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          {createTimecard.isPending ? 'Creating...' : 'New Timecard'}
        </Button>
      </div>

      {/* Live Clock Widget */}
      <LiveClockWidget
        projectId={projectId}
        onTimecardCreated={(id) => setSelectedTimecardId(id)}
      />

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-charcoal-black border-muted-gray/20">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-bone-white">{summary.total_timecards}</p>
              <p className="text-xs text-muted-gray">Total Timecards</p>
            </CardContent>
          </Card>
          <Card className="bg-charcoal-black border-muted-gray/20">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{summary.total_hours.toFixed(1)}</p>
              <p className="text-xs text-muted-gray">Hours Logged</p>
            </CardContent>
          </Card>
          <Card className="bg-charcoal-black border-muted-gray/20">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-accent-yellow">{summary.total_overtime_hours.toFixed(1)}</p>
              <p className="text-xs text-muted-gray">Overtime Hours</p>
            </CardContent>
          </Card>
          <Card className="bg-charcoal-black border-muted-gray/20">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-400">{summary.submitted_count}</p>
              <p className="text-xs text-muted-gray">Pending Review</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs for My Timecards / Review (if manager) */}
      {canReview ? (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'my' | 'review')}>
          <div className="flex items-center justify-between">
            <TabsList className="bg-charcoal-black border border-muted-gray/20">
              <TabsTrigger value="my">My Timecards</TabsTrigger>
              <TabsTrigger value="review">
                Review
                {summary && summary.submitted_count > 0 && (
                  <Badge className="ml-2 bg-blue-500/20 text-blue-400 border-blue-500/30">
                    {summary.submitted_count}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 bg-charcoal-black border-muted-gray/30">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="my" className="mt-4">
            <TimecardList
              timecards={myTimecards || []}
              onSelect={setSelectedTimecardId}
              showUser={false}
            />
          </TabsContent>

          <TabsContent value="review" className="mt-4">
            {loadingReview ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
              </div>
            ) : (
              <TimecardReviewList
                timecards={reviewTimecards || []}
                onSelect={setSelectedTimecardId}
                onApprove={handleApprove}
                onReject={openRejectDialog}
                isApproving={approveTimecard.isPending}
              />
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <>
          <div className="flex items-center justify-end">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 bg-charcoal-black border-muted-gray/30">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <TimecardList
            timecards={myTimecards || []}
            onSelect={setSelectedTimecardId}
            showUser={false}
          />
        </>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="bg-charcoal-black border-muted-gray/20">
          <DialogHeader>
            <DialogTitle className="text-bone-white">Reject Timecard</DialogTitle>
            <DialogDescription className="text-muted-gray">
              Provide a reason for rejecting this timecard. The crew member will be notified.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection (optional)"
            className="bg-charcoal-black border-muted-gray/30 min-h-24"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectTimecard.isPending}
            >
              {rejectTimecard.isPending ? 'Rejecting...' : 'Reject Timecard'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Timecard Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="bg-charcoal-black border-muted-gray/20">
          <DialogHeader>
            <DialogTitle className="text-bone-white flex items-center gap-2">
              <Timer className="w-5 h-5 text-blue-400" />
              Create Timecard
            </DialogTitle>
            <DialogDescription className="text-muted-gray">
              Select the week for your new timecard
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm text-muted-gray block mb-2">Week Starting</label>
            <Select value={selectedWeekStart} onValueChange={setSelectedWeekStart}>
              <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                <SelectValue placeholder="Select week" />
              </SelectTrigger>
              <SelectContent>
                {weekOptions.map(week => (
                  <SelectItem
                    key={week.value}
                    value={week.value}
                    disabled={week.exists}
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-gray" />
                      <span>{week.label}</span>
                      {week.exists && (
                        <Badge variant="outline" className="ml-2 text-[10px] text-muted-gray border-muted-gray/30">
                          Exists
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateTimecard}
              disabled={createTimecard.isPending || weekOptions.find(w => w.value === selectedWeekStart)?.exists}
              className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
            >
              {createTimecard.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Timecard
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Subcomponent: Timecard List
interface TimecardListProps {
  timecards: TimecardListItem[];
  onSelect: (id: string) => void;
  showUser?: boolean;
}

function TimecardList({ timecards, onSelect, showUser = false }: TimecardListProps) {
  if (timecards.length === 0) {
    return (
      <Card className="bg-charcoal-black border-muted-gray/20">
        <CardContent className="py-12 text-center text-muted-gray">
          No timecards found
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {timecards.map(tc => {
        const statusConfig = TIMECARD_STATUS_CONFIG[tc.status as keyof typeof TIMECARD_STATUS_CONFIG] || TIMECARD_STATUS_CONFIG.draft;
        return (
          <Card
            key={tc.id}
            className="bg-charcoal-black border-muted-gray/20 cursor-pointer hover:border-muted-gray/40 transition-colors"
            onClick={() => onSelect(tc.id)}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-blue-500/10">
                  <Timer className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-bone-white">
                    {formatWeekRange(tc.week_start_date)}
                  </p>
                  {showUser && tc.user_name && (
                    <p className="text-sm text-muted-gray">{tc.user_name}</p>
                  )}
                  <p className="text-sm text-muted-gray">
                    {tc.entry_count} entries • {tc.total_hours.toFixed(1)} hrs
                    {tc.total_overtime > 0 && ` (+${tc.total_overtime.toFixed(1)} OT)`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                <ChevronRight className="w-4 h-4 text-muted-gray" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Subcomponent: Review List with approve/reject buttons
interface TimecardReviewListProps {
  timecards: TimecardListItem[];
  onSelect: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isApproving?: boolean;
}

function TimecardReviewList({ timecards, onSelect, onApprove, onReject, isApproving }: TimecardReviewListProps) {
  if (timecards.length === 0) {
    return (
      <Card className="bg-charcoal-black border-muted-gray/20">
        <CardContent className="py-12 text-center text-muted-gray">
          No timecards to review
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {timecards.map(tc => {
        const statusConfig = TIMECARD_STATUS_CONFIG[tc.status as keyof typeof TIMECARD_STATUS_CONFIG] || TIMECARD_STATUS_CONFIG.draft;
        return (
          <Card key={tc.id} className="bg-charcoal-black border-muted-gray/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center gap-4 flex-1 cursor-pointer"
                  onClick={() => onSelect(tc.id)}
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-blue-500/10">
                    <Timer className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-bone-white">
                      {tc.user_name || 'Unknown'}
                    </p>
                    <p className="text-sm text-muted-gray">
                      {formatWeekRange(tc.week_start_date)} • {tc.total_hours.toFixed(1)} hrs
                      {tc.total_overtime > 0 && ` (+${tc.total_overtime.toFixed(1)} OT)`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                  {tc.status === 'submitted' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          onApprove(tc.id);
                        }}
                        disabled={isApproving}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReject(tc.id);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Subcomponent: Timecard Editor
interface TimecardEditorProps {
  projectId: string;
  timecard: {
    id: string;
    week_start_date: string;
    status: string;
    entries: TimecardEntry[];
    total_hours: number;
    total_overtime: number;
    rejection_reason?: string | null;
  };
  onBack: () => void;
  onSubmit: () => void;
  canEdit: boolean;
}

function TimecardEditor({ projectId, timecard, onBack, onSubmit, canEdit }: TimecardEditorProps) {
  const weekDates = getWeekDates(timecard.week_start_date);
  const upsertEntry = useUpsertTimecardEntry(projectId, timecard.id);
  const importCheckins = useImportCheckinsToTimecard(projectId, timecard.id);

  // Preview state
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const { data: preview, isLoading: loadingPreview, refetch: refetchPreview } = useTimecardPreview(
    previewDialogOpen ? projectId : null,
    previewDialogOpen ? timecard.id : null
  );

  // Get available check-ins for this week
  const { data: myCheckins } = useMyCheckins(projectId, timecard.week_start_date);

  // Local state for all entry fields
  const [localValues, setLocalValues] = React.useState<Record<string, Partial<TimecardEntry>>>({});
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

  // Create a map of entries by date
  const entriesByDate: Record<string, TimecardEntry> = {};
  timecard.entries.forEach(entry => {
    entriesByDate[entry.shoot_date] = entry;
  });

  // Get the display value for a time field
  const getTimeValue = (date: string, field: 'call_time' | 'wrap_time' | 'break_start' | 'break_end') => {
    // First check local state
    const localVal = localValues[date]?.[field];
    if (localVal !== undefined) {
      return typeof localVal === 'string' && localVal.length >= 16 ? localVal.substring(11, 16) : localVal || '';
    }
    // Then check saved data
    const entry = entriesByDate[date];
    const value = entry?.[field];
    if (value && typeof value === 'string' && value.length >= 16) {
      return value.substring(11, 16);
    }
    return '';
  };

  // Get local or saved value for any field
  const getFieldValue = <T extends keyof TimecardEntry>(date: string, field: T): TimecardEntry[T] | undefined => {
    const localVal = localValues[date]?.[field];
    if (localVal !== undefined) return localVal as TimecardEntry[T];
    return entriesByDate[date]?.[field];
  };

  // Handle local input change (just update local state)
  const handleFieldChange = (date: string, field: keyof TimecardEntry, value: unknown) => {
    setLocalValues(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        [field]: value,
      },
    }));
  };

  // Handle blur - save to backend
  const handleFieldBlur = async (date: string, field: keyof TimecardEntry) => {
    const localValue = localValues[date]?.[field];
    if (localValue === undefined) return; // Nothing changed

    const existing = entriesByDate[date];

    // Build the data object with all current values
    const timeFields = ['call_time', 'wrap_time', 'break_start', 'break_end'];
    const data: Record<string, unknown> = {
      shoot_date: date,
      call_time: existing?.call_time,
      wrap_time: existing?.wrap_time,
      break_start: existing?.break_start,
      break_end: existing?.break_end,
      meal_break_minutes: existing?.meal_break_minutes || 30,
      department: existing?.department,
      position: existing?.position,
      rate_type: existing?.rate_type,
      rate_amount: existing?.rate_amount,
      notes: existing?.notes,
      is_travel_day: existing?.is_travel_day || false,
      is_prep_day: existing?.is_prep_day || false,
      is_wrap_day: existing?.is_wrap_day || false,
      is_holiday: existing?.is_holiday || false,
    };

    // Apply the changed field
    if (timeFields.includes(field as string)) {
      const localTime = localValue as string;
      data[field as string] = localTime ? `${date}T${localTime}:00` : null;
    } else {
      data[field as string] = localValue;
    }

    try {
      await upsertEntry.mutateAsync(data as Parameters<typeof upsertEntry.mutateAsync>[0]);
      // Clear local state for this field after successful save
      setLocalValues(prev => {
        const newState = { ...prev };
        if (newState[date]) {
          delete newState[date][field];
          if (Object.keys(newState[date]).length === 0) {
            delete newState[date];
          }
        }
        return newState;
      });
    } catch (error) {
      console.error('Failed to save entry field:', error);
    }
  };

  // Toggle day expansion
  const toggleDayExpansion = (date: string) => {
    setExpandedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  // Toggle day type flags
  const handleDayTypeToggle = async (date: string, field: 'is_travel_day' | 'is_prep_day' | 'is_wrap_day' | 'is_holiday') => {
    const existing = entriesByDate[date];
    const currentValue = existing?.[field] || false;

    const data: Record<string, unknown> = {
      shoot_date: date,
      call_time: existing?.call_time,
      wrap_time: existing?.wrap_time,
      meal_break_minutes: existing?.meal_break_minutes || 30,
      is_travel_day: existing?.is_travel_day || false,
      is_prep_day: existing?.is_prep_day || false,
      is_wrap_day: existing?.is_wrap_day || false,
      is_holiday: existing?.is_holiday || false,
      [field]: !currentValue,
    };

    try {
      await upsertEntry.mutateAsync(data as Parameters<typeof upsertEntry.mutateAsync>[0]);
    } catch (error) {
      console.error('Failed to toggle day type:', error);
    }
  };

  // Handle import check-ins
  const handleImportCheckins = async (overwrite: boolean = false) => {
    try {
      const result = await importCheckins.mutateAsync(overwrite);
      setImportResult({ imported: result.imported_count, skipped: result.skipped_count });
    } catch (error) {
      console.error('Failed to import check-ins:', error);
    }
  };

  // Handle preview and submit
  const handleOpenPreview = () => {
    setConfirmSubmit(false);
    setPreviewDialogOpen(true);
  };

  const handlePreviewSubmit = async () => {
    if (!confirmSubmit) return;
    setPreviewDialogOpen(false);
    onSubmit();
  };

  // Open print view in new window
  const handlePrintTimecard = () => {
    const token = localStorage.getItem('auth_token');
    const printUrl = `${import.meta.env.VITE_API_URL || ''}/api/v1/backlot/projects/${projectId}/timecards/${timecard.id}/print`;
    // Open the print view - needs auth header, so we'll fetch and open
    window.open(printUrl + `?token=${token}`, '_blank');
  };

  // Count available check-ins for this week
  const availableCheckins = myCheckins?.filter(c => {
    const checkinDate = c.session_date?.split('T')[0];
    return checkinDate && weekDates.includes(checkinDate);
  }).length || 0;

  const statusConfig = TIMECARD_STATUS_CONFIG[timecard.status as keyof typeof TIMECARD_STATUS_CONFIG] || TIMECARD_STATUS_CONFIG.draft;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <X className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-xl font-heading text-bone-white flex items-center gap-2">
              <Timer className="w-5 h-5 text-blue-400" />
              Week of {formatWeekRange(timecard.week_start_date)}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
              <span className="text-sm text-muted-gray">
                {timecard.total_hours.toFixed(1)} hrs total
                {timecard.total_overtime > 0 && ` (+${timecard.total_overtime.toFixed(1)} OT)`}
              </span>
            </div>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            {availableCheckins > 0 && (
              <Button
                variant="outline"
                onClick={() => setImportDialogOpen(true)}
                className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
              >
                <Download className="w-4 h-4 mr-2" />
                Import Check-ins ({availableCheckins})
              </Button>
            )}
            <Button
              onClick={handleOpenPreview}
              className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
            >
              <Eye className="w-4 h-4 mr-2" />
              Preview & Submit
            </Button>
          </div>
        )}
      </div>

      {/* Rejection reason if applicable */}
      {timecard.status === 'rejected' && timecard.rejection_reason && (
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
            <div>
              <p className="font-medium text-red-400">Timecard Rejected</p>
              <p className="text-sm text-muted-gray">{timecard.rejection_reason}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Time Entry Grid */}
      <Card className="bg-charcoal-black border-muted-gray/20">
        <CardHeader>
          <CardTitle className="text-bone-white text-base">Daily Hours</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {weekDates.map((date, idx) => {
              const entry = entriesByDate[date];
              const dayDate = new Date(date + 'T00:00:00');
              // Use local date for "today" comparison, not UTC
              const now = new Date();
              const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
              const isToday = date === todayLocal;
              const isExpanded = expandedDays.has(date);
              const hasEntry = !!entry;

              return (
                <div
                  key={date}
                  className={cn(
                    'rounded-lg overflow-hidden',
                    isToday ? 'ring-1 ring-accent-yellow/30' : ''
                  )}
                >
                  {/* Collapsed Row */}
                  <div
                    className={cn(
                      'flex items-center gap-3 p-3 cursor-pointer transition-colors',
                      isToday ? 'bg-accent-yellow/5' : 'bg-muted-gray/5',
                      'hover:bg-muted-gray/10'
                    )}
                    onClick={() => canEdit && toggleDayExpansion(date)}
                  >
                    {/* Expand Icon */}
                    {canEdit && (
                      <ChevronDown
                        className={cn(
                          'w-4 h-4 text-muted-gray transition-transform',
                          isExpanded ? 'rotate-180' : ''
                        )}
                      />
                    )}

                    {/* Day Label */}
                    <div className="w-14 text-center">
                      <p className="text-xs text-muted-gray">{DAY_LABELS[idx]}</p>
                      <p className="font-medium text-bone-white">{dayDate.getDate()}</p>
                    </div>

                    {/* Call Time */}
                    <div className="flex-1" onClick={(e) => e.stopPropagation()}>
                      <Input
                        type="time"
                        value={getTimeValue(date, 'call_time')}
                        onChange={(e) => handleFieldChange(date, 'call_time', e.target.value)}
                        onBlur={() => handleFieldBlur(date, 'call_time')}
                        disabled={!canEdit}
                        placeholder="Call"
                        className="bg-charcoal-black border-muted-gray/30 h-8 text-sm"
                      />
                    </div>

                    {/* Wrap Time */}
                    <div className="flex-1" onClick={(e) => e.stopPropagation()}>
                      <Input
                        type="time"
                        value={getTimeValue(date, 'wrap_time')}
                        onChange={(e) => handleFieldChange(date, 'wrap_time', e.target.value)}
                        onBlur={() => handleFieldBlur(date, 'wrap_time')}
                        disabled={!canEdit}
                        placeholder="Wrap"
                        className="bg-charcoal-black border-muted-gray/30 h-8 text-sm"
                      />
                    </div>

                    {/* Hours */}
                    <div className="w-16 text-center">
                      <p className="text-lg font-bold text-bone-white">
                        {entry?.hours_worked?.toFixed(1) || '-'}
                      </p>
                      <p className="text-[10px] text-muted-gray">hrs</p>
                    </div>

                    {/* Day Type Badges */}
                    <div className="w-28 flex flex-wrap gap-1 justify-end">
                      {entry?.is_travel_day && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-cyan-500/30 text-cyan-400">
                          <Plane className="w-3 h-3 mr-0.5" /> Travel
                        </Badge>
                      )}
                      {entry?.is_prep_day && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-purple-500/30 text-purple-400">
                          <Package className="w-3 h-3 mr-0.5" /> Prep
                        </Badge>
                      )}
                      {entry?.is_wrap_day && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-orange-500/30 text-orange-400">
                          <Flag className="w-3 h-3 mr-0.5" /> Wrap
                        </Badge>
                      )}
                      {entry?.is_holiday && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-red-500/30 text-red-400">
                          <Star className="w-3 h-3 mr-0.5" /> Holiday
                        </Badge>
                      )}
                      {entry?.department && !entry?.is_travel_day && !entry?.is_prep_day && !entry?.is_wrap_day && !entry?.is_holiday && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-muted-gray/30 text-muted-gray">
                          {DEPARTMENTS.find(d => d.value === entry.department)?.label || entry.department}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && canEdit && (
                    <div className="p-4 bg-muted-gray/5 border-t border-muted-gray/10 space-y-4">
                      {/* Meal Break Row */}
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-xs text-muted-gray block mb-1">
                            <Coffee className="w-3 h-3 inline mr-1" /> Meal Start
                          </label>
                          <Input
                            type="time"
                            value={getTimeValue(date, 'break_start')}
                            onChange={(e) => handleFieldChange(date, 'break_start', e.target.value)}
                            onBlur={() => handleFieldBlur(date, 'break_start')}
                            className="bg-charcoal-black border-muted-gray/30 h-8 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-gray block mb-1">Meal End</label>
                          <Input
                            type="time"
                            value={getTimeValue(date, 'break_end')}
                            onChange={(e) => handleFieldChange(date, 'break_end', e.target.value)}
                            onBlur={() => handleFieldBlur(date, 'break_end')}
                            className="bg-charcoal-black border-muted-gray/30 h-8 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-gray block mb-1">Break Minutes</label>
                          <Input
                            type="number"
                            value={getFieldValue(date, 'meal_break_minutes') || 30}
                            onChange={(e) => handleFieldChange(date, 'meal_break_minutes', parseInt(e.target.value) || 0)}
                            onBlur={() => handleFieldBlur(date, 'meal_break_minutes')}
                            className="bg-charcoal-black border-muted-gray/30 h-8 text-sm"
                          />
                        </div>
                      </div>

                      {/* Department & Position Row */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-muted-gray block mb-1">
                            <MapPin className="w-3 h-3 inline mr-1" /> Department
                          </label>
                          <Select
                            value={getFieldValue(date, 'department') || ''}
                            onValueChange={(value) => {
                              handleFieldChange(date, 'department', value);
                              // Immediately save department changes
                              setTimeout(() => handleFieldBlur(date, 'department'), 0);
                            }}
                          >
                            <SelectTrigger className="bg-charcoal-black border-muted-gray/30 h-8 text-sm">
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                            <SelectContent>
                              {DEPARTMENTS.map(dept => (
                                <SelectItem key={dept.value} value={dept.value}>
                                  {dept.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-gray block mb-1">Position</label>
                          <Input
                            type="text"
                            value={getFieldValue(date, 'position') || ''}
                            onChange={(e) => handleFieldChange(date, 'position', e.target.value)}
                            onBlur={() => handleFieldBlur(date, 'position')}
                            placeholder="e.g. Camera Operator"
                            className="bg-charcoal-black border-muted-gray/30 h-8 text-sm"
                          />
                        </div>
                      </div>

                      {/* Rate Row */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-muted-gray block mb-1">
                            <DollarSign className="w-3 h-3 inline mr-1" /> Rate Type
                          </label>
                          <Select
                            value={getFieldValue(date, 'rate_type') || ''}
                            onValueChange={(value) => {
                              handleFieldChange(date, 'rate_type', value);
                              setTimeout(() => handleFieldBlur(date, 'rate_type'), 0);
                            }}
                          >
                            <SelectTrigger className="bg-charcoal-black border-muted-gray/30 h-8 text-sm">
                              <SelectValue placeholder="Select rate type" />
                            </SelectTrigger>
                            <SelectContent>
                              {RATE_TYPES.map(rate => (
                                <SelectItem key={rate.value} value={rate.value}>
                                  {rate.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-gray block mb-1">Rate Amount</label>
                          <Input
                            type="number"
                            step="0.01"
                            value={getFieldValue(date, 'rate_amount') || ''}
                            onChange={(e) => handleFieldChange(date, 'rate_amount', parseFloat(e.target.value) || null)}
                            onBlur={() => handleFieldBlur(date, 'rate_amount')}
                            placeholder="0.00"
                            className="bg-charcoal-black border-muted-gray/30 h-8 text-sm"
                          />
                        </div>
                      </div>

                      {/* Day Type Toggles */}
                      <div>
                        <label className="text-xs text-muted-gray block mb-2">Day Type</label>
                        <div className="flex flex-wrap gap-2">
                          {/* Work Day - default when no other types selected */}
                          <Button
                            size="sm"
                            variant={(!entry?.is_travel_day && !entry?.is_prep_day && !entry?.is_wrap_day && !entry?.is_holiday) ? 'default' : 'outline'}
                            className={cn(
                              'h-7 text-xs',
                              (!entry?.is_travel_day && !entry?.is_prep_day && !entry?.is_wrap_day && !entry?.is_holiday)
                                ? 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30'
                                : 'border-muted-gray/30 text-muted-gray hover:bg-muted-gray/10'
                            )}
                            onClick={() => {
                              // Clear all other day types to make this a work day
                              if (entry?.is_travel_day) handleDayTypeToggle(date, 'is_travel_day');
                              if (entry?.is_prep_day) handleDayTypeToggle(date, 'is_prep_day');
                              if (entry?.is_wrap_day) handleDayTypeToggle(date, 'is_wrap_day');
                              if (entry?.is_holiday) handleDayTypeToggle(date, 'is_holiday');
                            }}
                          >
                            <Clock className="w-3 h-3 mr-1" /> Work Day
                          </Button>
                          <Button
                            size="sm"
                            variant={entry?.is_travel_day ? 'default' : 'outline'}
                            className={cn(
                              'h-7 text-xs',
                              entry?.is_travel_day
                                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30'
                                : 'border-muted-gray/30 text-muted-gray hover:bg-muted-gray/10'
                            )}
                            onClick={() => handleDayTypeToggle(date, 'is_travel_day')}
                          >
                            <Plane className="w-3 h-3 mr-1" /> Travel
                          </Button>
                          <Button
                            size="sm"
                            variant={entry?.is_prep_day ? 'default' : 'outline'}
                            className={cn(
                              'h-7 text-xs',
                              entry?.is_prep_day
                                ? 'bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30'
                                : 'border-muted-gray/30 text-muted-gray hover:bg-muted-gray/10'
                            )}
                            onClick={() => handleDayTypeToggle(date, 'is_prep_day')}
                          >
                            <Package className="w-3 h-3 mr-1" /> Prep
                          </Button>
                          <Button
                            size="sm"
                            variant={entry?.is_wrap_day ? 'default' : 'outline'}
                            className={cn(
                              'h-7 text-xs',
                              entry?.is_wrap_day
                                ? 'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30'
                                : 'border-muted-gray/30 text-muted-gray hover:bg-muted-gray/10'
                            )}
                            onClick={() => handleDayTypeToggle(date, 'is_wrap_day')}
                          >
                            <Flag className="w-3 h-3 mr-1" /> Wrap
                          </Button>
                          <Button
                            size="sm"
                            variant={entry?.is_holiday ? 'default' : 'outline'}
                            className={cn(
                              'h-7 text-xs',
                              entry?.is_holiday
                                ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
                                : 'border-muted-gray/30 text-muted-gray hover:bg-muted-gray/10'
                            )}
                            onClick={() => handleDayTypeToggle(date, 'is_holiday')}
                          >
                            <Star className="w-3 h-3 mr-1" /> Holiday
                          </Button>
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="text-xs text-muted-gray block mb-1">
                          <Edit3 className="w-3 h-3 inline mr-1" /> Notes
                        </label>
                        <Textarea
                          value={getFieldValue(date, 'notes') || ''}
                          onChange={(e) => handleFieldChange(date, 'notes', e.target.value)}
                          onBlur={() => handleFieldBlur(date, 'notes')}
                          placeholder="Add notes for this day..."
                          className="bg-charcoal-black border-muted-gray/30 min-h-16 text-sm resize-none"
                        />
                      </div>

                      {/* Save Button */}
                      <div className="flex justify-end pt-2 border-t border-muted-gray/10">
                        <Button
                          onClick={async () => {
                            // Save all pending changes for this day
                            const localDay = localValues[date];
                            if (localDay) {
                              for (const field of Object.keys(localDay) as Array<keyof TimecardEntry>) {
                                await handleFieldBlur(date, field);
                              }
                            }
                            // Collapse the day after saving
                            toggleDayExpansion(date);
                          }}
                          disabled={upsertEntry.isPending}
                          className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
                        >
                          {upsertEntry.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4 mr-2" />
                              Save Day
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-4 text-center">
            <Clock className="w-5 h-5 text-blue-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-bone-white">{timecard.total_hours.toFixed(1)}</p>
            <p className="text-xs text-muted-gray">Regular Hours</p>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-4 text-center">
            <Timer className="w-5 h-5 text-accent-yellow mx-auto mb-2" />
            <p className="text-2xl font-bold text-bone-white">{timecard.total_overtime.toFixed(1)}</p>
            <p className="text-xs text-muted-gray">Overtime Hours</p>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-4 text-center">
            <Calendar className="w-5 h-5 text-green-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-bone-white">{timecard.entries.length}</p>
            <p className="text-xs text-muted-gray">Days Worked</p>
          </CardContent>
        </Card>
      </div>

      {/* Import Check-ins Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => {
        setImportDialogOpen(open);
        if (!open) setImportResult(null);
      }}>
        <DialogContent className="bg-charcoal-black border-muted-gray/20">
          <DialogHeader>
            <DialogTitle className="text-bone-white">Import Check-ins</DialogTitle>
            <DialogDescription className="text-muted-gray">
              {importResult ? (
                `Successfully imported ${importResult.imported} check-in(s). ${importResult.skipped} skipped.`
              ) : (
                `Import your ${availableCheckins} QR check-in(s) from this week into the timecard. This will populate call and wrap times from your check-in/check-out records.`
              )}
            </DialogDescription>
          </DialogHeader>
          {!importResult && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-gray">
                Days with existing entries can be skipped or overwritten.
              </p>
            </div>
          )}
          <DialogFooter>
            {importResult ? (
              <Button onClick={() => {
                setImportDialogOpen(false);
                setImportResult(null);
              }}>
                Done
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleImportCheckins(false)}
                  disabled={importCheckins.isPending}
                  className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                >
                  {importCheckins.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Skip Existing
                </Button>
                <Button
                  onClick={() => handleImportCheckins(true)}
                  disabled={importCheckins.isPending}
                  className="bg-cyan-500 text-white hover:bg-cyan-600"
                >
                  {importCheckins.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Overwrite All
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview & Submit Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={(open) => {
        setPreviewDialogOpen(open);
        if (!open) setConfirmSubmit(false);
      }}>
        <DialogContent className="bg-charcoal-black border-muted-gray/20 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-bone-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Timecard Preview
            </DialogTitle>
            <DialogDescription className="text-muted-gray">
              Review your timecard before submitting for approval
            </DialogDescription>
          </DialogHeader>

          {loadingPreview ? (
            <div className="py-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-gray" />
              <p className="text-sm text-muted-gray mt-2">Loading preview...</p>
            </div>
          ) : preview ? (
            <div className="space-y-6 py-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-muted-gray/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-bone-white">{preview.total_hours.toFixed(1)}</p>
                  <p className="text-xs text-muted-gray">Regular Hrs</p>
                </div>
                <div className="bg-muted-gray/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-accent-yellow">{preview.total_overtime.toFixed(1)}</p>
                  <p className="text-xs text-muted-gray">OT Hrs</p>
                </div>
                <div className="bg-muted-gray/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-orange-400">{preview.total_double_time.toFixed(1)}</p>
                  <p className="text-xs text-muted-gray">DT Hrs</p>
                </div>
                <div className="bg-muted-gray/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-400">{preview.days_worked}</p>
                  <p className="text-xs text-muted-gray">Days</p>
                </div>
              </div>

              {/* Daily Breakdown */}
              <div className="border border-muted-gray/20 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted-gray/10">
                    <tr>
                      <th className="px-3 py-2 text-left text-muted-gray font-normal">Day</th>
                      <th className="px-3 py-2 text-left text-muted-gray font-normal">Call</th>
                      <th className="px-3 py-2 text-left text-muted-gray font-normal">Wrap</th>
                      <th className="px-3 py-2 text-right text-muted-gray font-normal">Hours</th>
                      <th className="px-3 py-2 text-right text-muted-gray font-normal">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.entries.map((entry) => (
                      <tr key={entry.date} className={cn(
                        'border-t border-muted-gray/10',
                        entry.has_entry ? 'text-bone-white' : 'text-muted-gray/50'
                      )}>
                        <td className="px-3 py-2">
                          <span className="font-medium">{entry.day_name.substring(0, 3)}</span>
                          <span className="text-muted-gray ml-2">{new Date(entry.date + 'T00:00:00').getDate()}</span>
                        </td>
                        <td className="px-3 py-2">
                          {entry.call_time ? new Date(entry.call_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="px-3 py-2">
                          {entry.wrap_time ? new Date(entry.wrap_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {entry.hours_worked?.toFixed(1) || '-'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {entry.is_travel_day && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-cyan-500/30 text-cyan-400 ml-1">T</Badge>}
                          {entry.is_prep_day && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-purple-500/30 text-purple-400 ml-1">P</Badge>}
                          {entry.is_wrap_day && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-orange-500/30 text-orange-400 ml-1">W</Badge>}
                          {entry.is_holiday && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-red-500/30 text-red-400 ml-1">H</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Warnings */}
              {preview.warnings.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-gray uppercase tracking-wide">Notices</p>
                  {preview.warnings.map((warning, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-start gap-2 p-3 rounded-lg text-sm',
                        warning.severity === 'error' && 'bg-red-500/10 border border-red-500/20',
                        warning.severity === 'warning' && 'bg-amber-500/10 border border-amber-500/20',
                        warning.severity === 'info' && 'bg-blue-500/10 border border-blue-500/20'
                      )}
                    >
                      {warning.severity === 'error' && <CircleX className="w-4 h-4 text-red-400 mt-0.5" />}
                      {warning.severity === 'warning' && <TriangleAlert className="w-4 h-4 text-amber-400 mt-0.5" />}
                      {warning.severity === 'info' && <Info className="w-4 h-4 text-blue-400 mt-0.5" />}
                      <span className={cn(
                        warning.severity === 'error' && 'text-red-400',
                        warning.severity === 'warning' && 'text-amber-400',
                        warning.severity === 'info' && 'text-blue-400'
                      )}>
                        {warning.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Confirmation Checkbox */}
              {preview.can_submit && (
                <div className="flex items-center gap-3 p-4 bg-muted-gray/5 rounded-lg border border-muted-gray/20">
                  <input
                    type="checkbox"
                    id="confirm-submit"
                    checked={confirmSubmit}
                    onChange={(e) => setConfirmSubmit(e.target.checked)}
                    className="w-4 h-4 rounded border-muted-gray/30"
                  />
                  <label htmlFor="confirm-submit" className="text-sm text-bone-white cursor-pointer">
                    I confirm these hours are accurate and ready for approval
                  </label>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-gray">
              Failed to load preview
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={handlePrintTimecard}
              className="border-muted-gray/30 text-muted-gray hover:bg-muted-gray/10"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print / PDF
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handlePreviewSubmit}
                disabled={!confirmSubmit || !preview?.can_submit}
                className={cn(
                  'gap-2',
                  confirmSubmit && preview?.can_submit
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-muted-gray/20 text-muted-gray'
                )}
              >
                <Send className="w-4 h-4" />
                Submit for Approval
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
