/**
 * TimecardsView - Timecard management for crew and managers
 * Shows personal timecards for crew, review interface for showrunner/producers
 */
import React, { useState } from 'react';
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
} from 'lucide-react';
import {
  useMyTimecards,
  useTimecardsForReview,
  useTimecard,
  useTimecardSummary,
  useCreateTimecard,
  useUpsertTimecardEntry,
  useSubmitTimecard,
  useApproveTimecard,
  useRejectTimecard,
  TimecardListItem,
  TimecardEntry,
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

export default function TimecardsView({ projectId, canReview }: TimecardsViewProps) {
  const [activeTab, setActiveTab] = useState<'my' | 'review'>('my');
  const [selectedTimecardId, setSelectedTimecardId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingTimecardId, setRejectingTimecardId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Queries
  const { data: myTimecards, isLoading: loadingMy } = useMyTimecards(projectId, statusFilter || undefined);
  const { data: reviewTimecards, isLoading: loadingReview } = useTimecardsForReview(
    canReview && activeTab === 'review' ? projectId : null,
    statusFilter || undefined
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

  const handleCreateCurrentWeek = async () => {
    try {
      const result = await createTimecard.mutateAsync(currentWeekStart);
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
        {!hasCurrentWeekTimecard && (
          <Button
            onClick={handleCreateCurrentWeek}
            disabled={createTimecard.isPending}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            {createTimecard.isPending ? 'Creating...' : 'New Timecard'}
          </Button>
        )}
      </div>

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
                <SelectItem value="">All statuses</SelectItem>
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
                <SelectItem value="">All statuses</SelectItem>
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

  // Create a map of entries by date
  const entriesByDate: Record<string, TimecardEntry> = {};
  timecard.entries.forEach(entry => {
    entriesByDate[entry.shoot_date] = entry;
  });

  const handleTimeChange = async (date: string, field: 'call_time' | 'wrap_time', value: string) => {
    const existing = entriesByDate[date];
    const data = {
      shoot_date: date,
      call_time: field === 'call_time' ? value : existing?.call_time,
      wrap_time: field === 'wrap_time' ? value : existing?.wrap_time,
      meal_break_minutes: existing?.meal_break_minutes || 30,
    };
    await upsertEntry.mutateAsync(data);
  };

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
          <Button
            onClick={onSubmit}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
          >
            <Send className="w-4 h-4 mr-2" />
            Submit Timecard
          </Button>
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
          <div className="space-y-3">
            {weekDates.map((date, idx) => {
              const entry = entriesByDate[date];
              const dayDate = new Date(date + 'T00:00:00');
              const isToday = date === new Date().toISOString().split('T')[0];

              return (
                <div
                  key={date}
                  className={cn(
                    'flex items-center gap-4 p-3 rounded-lg',
                    isToday ? 'bg-accent-yellow/5 border border-accent-yellow/20' : 'bg-muted-gray/5'
                  )}
                >
                  {/* Day Label */}
                  <div className="w-16 text-center">
                    <p className="text-xs text-muted-gray">{DAY_LABELS[idx]}</p>
                    <p className="font-medium text-bone-white">{dayDate.getDate()}</p>
                  </div>

                  {/* Call Time */}
                  <div className="flex-1">
                    <label className="text-xs text-muted-gray block mb-1">Call</label>
                    <Input
                      type="time"
                      value={entry?.call_time?.substring(11, 16) || ''}
                      onChange={(e) => handleTimeChange(date, 'call_time', e.target.value ? `${date}T${e.target.value}:00` : '')}
                      disabled={!canEdit}
                      className="bg-charcoal-black border-muted-gray/30 h-9"
                    />
                  </div>

                  {/* Wrap Time */}
                  <div className="flex-1">
                    <label className="text-xs text-muted-gray block mb-1">Wrap</label>
                    <Input
                      type="time"
                      value={entry?.wrap_time?.substring(11, 16) || ''}
                      onChange={(e) => handleTimeChange(date, 'wrap_time', e.target.value ? `${date}T${e.target.value}:00` : '')}
                      disabled={!canEdit}
                      className="bg-charcoal-black border-muted-gray/30 h-9"
                    />
                  </div>

                  {/* Hours */}
                  <div className="w-20 text-center">
                    <p className="text-xs text-muted-gray">Hours</p>
                    <p className="font-medium text-bone-white">
                      {entry?.hours_worked?.toFixed(1) || '-'}
                    </p>
                  </div>

                  {/* Day Type Badges */}
                  <div className="w-24 flex gap-1">
                    {entry?.is_travel_day && (
                      <Badge variant="outline" className="text-xs border-cyan-500/30 text-cyan-400">Travel</Badge>
                    )}
                    {entry?.is_prep_day && (
                      <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">Prep</Badge>
                    )}
                    {entry?.is_wrap_day && (
                      <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-400">Wrap</Badge>
                    )}
                    {entry?.is_holiday && (
                      <Badge variant="outline" className="text-xs border-red-500/30 text-red-400">Holiday</Badge>
                    )}
                  </div>
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
    </div>
  );
}
