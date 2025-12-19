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
  TimecardListItem,
  TimecardEntry,
  TimecardPreview,
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

export default function TimecardsView({ projectId, canReview }: TimecardsViewProps) {
  const [activeTab, setActiveTab] = useState<'my' | 'review'>('my');
  const [selectedTimecardId, setSelectedTimecardId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingTimecardId, setRejectingTimecardId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

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
              const isToday = date === new Date().toISOString().split('T')[0];
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
