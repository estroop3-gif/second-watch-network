/**
 * HotSetView - Production Day real-time management for 1st ADs
 *
 * Features:
 * - Day selection and configuration
 * - Scene progression (start, complete, skip)
 * - Real-time schedule tracking
 * - OT countdown and cost projections
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Play,
  Square,
  SkipForward,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Plus,
  Timer,
  DollarSign,
  ChevronRight,
  Calendar,
  Clapperboard,
  Coffee,
  Truck,
  Flag,
  HelpCircle,
  Film,
  Target,
  Settings,
  RotateCcw,
  FileDown,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseLocalDate } from '@/lib/dateUtils';
import { useProductionDays, useCallSheets, useProductionDayAdNotes } from '@/hooks/backlot';
import {
  useHotSetSessions,
  useCreateHotSetSession,
  useStartHotSetSession,
  useWrapHotSetSession,
  useResumeHotSetSession,
  useHotSetDashboard,
  useStartScene,
  useCompleteScene,
  useSkipScene,
  useAddMarker,
  useStartScheduleBlock,
  useCompleteScheduleBlock,
  useSkipScheduleBlock,
  useUpdateScheduleBlock,
  useImportFromProductionDay,
  useImportFromHourSchedule,
  useConfirmCrewCall,
  useConfirmFirstShot,
  useHotSetSettings,
  useUpdateHotSetSettings,
  useReorderSchedule,
  formatElapsedTime,
  formatTime,
  getCurrentTimeFormatted,
  getCurrentDateFormatted,
  calculateElapsedSeconds,
  formatSeconds,
  getScheduleStatusColor,
  getScheduleStatusBgColor,
  formatCurrency,
  formatScheduleTime,
} from '@/hooks/backlot';
import {
  HotSetSession,
  HotSetSceneLog,
  HotSetDayType,
  HotSetMarkerType,
  HotSetScheduleTrackingMode,
  HourScheduleBlock,
} from '@/types/backlot';
import {
  CreateHotSetSessionModal,
  HotSetTimeline,
  ScheduleDeviationCard,
  CatchUpSuggestionsPanel,
  ScheduleBlockCard,
  ADNotesPanel,
  CallSheetQuickLink,
  DayStatsCard,
  WrapDayModal,
  OTProjectionCard,
  CurrentActivityCard,
  LiveScheduleView,
  PreCrewCallCountdown,
  TabbedScheduleView,
  HotSetSettingsPanel,
  HotSetDayReportView,
  SessionTasksCard,
  AdNotesHistoryCard,
  AdNoteDetailModal,
} from './hot-set';
import { AdNoteEntry } from '@/hooks/backlot/useAdNotes';
import { useTaskLists, useCreateTaskFromSource } from '@/hooks/backlot/useTaskLists';
import TaskDetailDrawer from './TaskDetailDrawer';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ListTodo } from 'lucide-react';
import { toast } from 'sonner';

interface HotSetViewProps {
  projectId: string;
  canEdit: boolean;
}

// Timer component that updates every second
const LiveTimer: React.FC<{ startTime: string | null }> = ({ startTime }) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!startTime) {
      setSeconds(0);
      return;
    }

    // Initial calculation
    setSeconds(calculateElapsedSeconds(startTime));

    // Update every second
    const interval = setInterval(() => {
      setSeconds(calculateElapsedSeconds(startTime));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  if (!startTime) return <span className="text-muted-gray">--:--</span>;

  return <span className="font-mono text-4xl">{formatSeconds(seconds)}</span>;
};

// Live clock component that updates every second, supports timezone
const LiveClock: React.FC<{ timezone?: string | null; className?: string }> = ({ timezone, className }) => {
  const [time, setTime] = useState(getCurrentTimeFormatted(timezone));

  useEffect(() => {
    // Update immediately
    setTime(getCurrentTimeFormatted(timezone));

    // Update every second for accuracy
    const interval = setInterval(() => {
      setTime(getCurrentTimeFormatted(timezone));
    }, 1000);

    return () => clearInterval(interval);
  }, [timezone]);

  return <span className={className}>{time}</span>;
};

// Live date component that updates every minute, supports timezone
const LiveDate: React.FC<{ timezone?: string | null; className?: string }> = ({ timezone, className }) => {
  const [date, setDate] = useState(getCurrentDateFormatted(timezone));

  useEffect(() => {
    // Update immediately
    setDate(getCurrentDateFormatted(timezone));

    // Update every minute (date doesn't change often)
    const interval = setInterval(() => {
      setDate(getCurrentDateFormatted(timezone));
    }, 60000);

    return () => clearInterval(interval);
  }, [timezone]);

  return <span className={className}>{date}</span>;
};

// Scene card component
const SceneCard: React.FC<{
  scene: HotSetSceneLog;
  isActive?: boolean;
  onStart?: () => void;
  onComplete?: () => void;
  onSkip?: () => void;
  canEdit: boolean;
  isPending?: boolean;
  timezone?: string | null;
}> = ({ scene, isActive, onStart, onComplete, onSkip, canEdit, isPending, timezone }) => {
  const statusColors = {
    pending: 'border-muted-gray/30',
    in_progress: 'border-accent-yellow/50 bg-accent-yellow/5',
    completed: 'border-green-500/30 bg-green-500/5',
    skipped: 'border-red-500/30 bg-red-500/5 opacity-60',
    moved: 'border-orange-500/30 bg-orange-500/5 opacity-60',
  };

  return (
    <Card className={cn('bg-soft-black transition-all', statusColors[scene.status])}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-lg text-bone-white">
                {scene.scene_number || 'Scene'}
              </span>
              {scene.int_ext && (
                <Badge variant="outline" className="text-xs">
                  {scene.int_ext}
                </Badge>
              )}
              {scene.status === 'completed' && (
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              )}
            </div>
            <p className="text-sm text-muted-gray truncate">
              {scene.set_name || scene.description || 'No description'}
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-gray">
              {/* Expected time from schedule */}
              {scene.expected_start_time && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatScheduleTime(scene.expected_start_time, timezone)}
                </span>
              )}
              <span>Est: {scene.expected_duration_minutes || scene.estimated_minutes || 30}m</span>
              {scene.actual_duration_minutes && (
                <span
                  className={cn(
                    scene.actual_duration_minutes > (scene.expected_duration_minutes || scene.estimated_minutes || 30)
                      ? 'text-red-400'
                      : 'text-green-400'
                  )}
                >
                  Actual: {scene.actual_duration_minutes}m
                </span>
              )}
              {/* Deviation indicator */}
              {scene.start_deviation_minutes !== undefined && scene.start_deviation_minutes !== 0 && (
                <span
                  className={cn(
                    scene.start_deviation_minutes > 0 ? 'text-red-400' : 'text-green-400'
                  )}
                >
                  ({scene.start_deviation_minutes > 0 ? '+' : ''}{scene.start_deviation_minutes}m)
                </span>
              )}
            </div>
          </div>

          {canEdit && scene.status === 'pending' && onStart && (
            <Button
              size="sm"
              onClick={onStart}
              disabled={isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Play className="w-4 h-4 mr-1" />
              Start
            </Button>
          )}

          {canEdit && scene.status === 'in_progress' && (
            <div className="flex gap-2">
              {onComplete && (
                <Button
                  size="sm"
                  onClick={onComplete}
                  disabled={isPending}
                  className="bg-green-600 hover:bg-green-500"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Complete
                </Button>
              )}
              {onSkip && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onSkip}
                  disabled={isPending}
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  <SkipForward className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const HotSetView: React.FC<HotSetViewProps> = ({ projectId, canEdit }) => {
  const navigate = useNavigate();

  // Track when user explicitly navigated to All Days so auto-select doesn't override
  const userWantsAllDays = React.useRef(false);

  // State
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMarkerModal, setShowMarkerModal] = useState(false);
  const [newSessionDayId, setNewSessionDayId] = useState<string>('');
  const [newSessionCallSheetId, setNewSessionCallSheetId] = useState<string>('');
  const [newSessionDayType, setNewSessionDayType] = useState<HotSetDayType>('10hr');

  // Task creation state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [selectedTaskListId, setSelectedTaskListId] = useState<string>('');

  // Tips panel state
  const [showTipsPanel, setShowTipsPanel] = useState(false);

  // Schedule integration state
  const [showSuggestionsPanel, setShowSuggestionsPanel] = useState(true);

  // Wrap modal state
  const [showWrapModal, setShowWrapModal] = useState(false);
  const [pendingWrapBlockId, setPendingWrapBlockId] = useState<string | null>(null);

  // Resume modal state (for accidentally wrapped sessions)
  const [showResumeModal, setShowResumeModal] = useState(false);

  // Report view state (for wrapped sessions)
  const [showReportView, setShowReportView] = useState(false);

  // Settings panel state
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  // AD Note detail modal state
  const [selectedAdNoteEntry, setSelectedAdNoteEntry] = useState<AdNoteEntry | null>(null);
  const [showAdNoteModal, setShowAdNoteModal] = useState(false);

  // Task detail drawer state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showTaskDrawer, setShowTaskDrawer] = useState(false);

  // Queries
  const { days: productionDays, isLoading: daysLoading } = useProductionDays(projectId);
  const { data: callSheets } = useCallSheets(projectId);
  const { data: sessions, isLoading: sessionsLoading } = useHotSetSessions(projectId);
  const { data: dashboard, isLoading: dashboardLoading, refetch } = useHotSetDashboard(selectedSessionId, {
    // Poll every 5s when session is in_progress for live updates, 30s otherwise
    pollingInterval: selectedSessionId ? (sessions?.find(s => s.id === selectedSessionId)?.status === 'in_progress' ? 5000 : 30000) : undefined,
  });

  // Production day AD notes (persisted at day level, not session)
  const { data: dayAdNotes } = useProductionDayAdNotes(dashboard?.session?.production_day_id || null);

  // Settings and confirmation hooks
  const { data: hotSetSettings } = useHotSetSettings(projectId);
  const updateSettings = useUpdateHotSetSettings(projectId);
  const confirmCrewCall = useConfirmCrewCall();
  const confirmFirstShot = useConfirmFirstShot();

  // Mutations
  const createSession = useCreateHotSetSession(projectId);
  const startSession = useStartHotSetSession();
  const wrapSession = useWrapHotSetSession();
  const resumeSession = useResumeHotSetSession();
  const startScene = useStartScene();
  const completeScene = useCompleteScene();
  const skipScene = useSkipScene();
  const addMarker = useAddMarker();

  // Schedule block mutations
  const startScheduleBlock = useStartScheduleBlock();
  const completeScheduleBlock = useCompleteScheduleBlock();
  const skipScheduleBlock = useSkipScheduleBlock();
  const updateScheduleBlock = useUpdateScheduleBlock();
  const reorderSchedule = useReorderSchedule();

  // Import mutations
  const importFromProductionDay = useImportFromProductionDay();
  const importFromHourSchedule = useImportFromHourSchedule();

  // Task hooks
  const { taskLists } = useTaskLists({ projectId });
  const { createTaskFromSource } = useCreateTaskFromSource(projectId, selectedTaskListId);

  // Auto-select ONLY if there's an active (in_progress) session on initial load
  // Don't override if user explicitly navigated to All Days
  useEffect(() => {
    if (sessions && sessions.length > 0 && !selectedSessionId && !userWantsAllDays.current) {
      const activeSession = sessions.find((s) => s.status === 'in_progress');
      if (activeSession) {
        setSelectedSessionId(activeSession.id);
      }
    }
  }, [sessions, selectedSessionId]);

  // Auto-detect user's timezone on first load if no timezone is set
  useEffect(() => {
    if (hotSetSettings && !hotSetSettings.timezone && canEdit) {
      // Get user's browser timezone
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (userTimezone) {
        updateSettings.mutate({ timezone: userTimezone });
      }
    }
  }, [hotSetSettings, canEdit]);

  // Get days that don't have sessions yet
  const availableDays = useMemo(() => {
    if (!productionDays || !sessions) return [];
    const sessionDayIds = new Set(sessions.map((s) => s.production_day_id));
    return productionDays.filter((d) => !sessionDayIds.has(d.id) && !d.is_completed);
  }, [productionDays, sessions]);

  // Get call sheets for selected day
  const dayCallSheets = useMemo(() => {
    if (!callSheets || !newSessionDayId) return [];
    const selectedDay = productionDays?.find((d) => d.id === newSessionDayId);
    if (!selectedDay) return [];
    return callSheets.filter(
      (cs) => cs.date === selectedDay.date || cs.production_day_id === newSessionDayId
    );
  }, [callSheets, newSessionDayId, productionDays]);

  const handleCreateSession = async () => {
    if (!newSessionDayId) return;

    await createSession.mutateAsync({
      production_day_id: newSessionDayId,
      call_sheet_id: newSessionCallSheetId || undefined,
      day_type: newSessionDayType,
      import_from_call_sheet: !!newSessionCallSheetId,
    });

    setShowCreateModal(false);
    setNewSessionDayId('');
    setNewSessionCallSheetId('');
    setNewSessionDayType('10hr');
  };

  // Enhanced session creation with schedule import
  const handleCreateSessionWithSchedule = async (data: {
    production_day_id: string;
    call_sheet_id?: string;
    day_type: HotSetDayType;
    import_hour_schedule: boolean;
    import_scenes: boolean;
    schedule_tracking_mode: HotSetScheduleTrackingMode;
  }) => {
    try {
      const result = await createSession.mutateAsync({
        production_day_id: data.production_day_id,
        call_sheet_id: data.call_sheet_id,
        day_type: data.day_type,
        import_hour_schedule: data.import_hour_schedule,
        import_scenes: data.import_scenes,
        schedule_tracking_mode: data.schedule_tracking_mode,
      });

      setShowCreateModal(false);
      if (result?.id) {
        userWantsAllDays.current = false;
        setSelectedSessionId(result.id);
      }
    } catch (error) {
      console.error('Failed to create Hot Set session:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create session');
    }
  };

  // Schedule block handlers
  const handleStartScheduleBlock = async (blockId: string) => {
    if (!selectedSessionId) return;
    await startScheduleBlock.mutateAsync({ sessionId: selectedSessionId, blockId });
  };

  const handleCompleteScheduleBlock = async (blockId: string) => {
    if (!selectedSessionId) return;

    // Check if this is a wrap block (match by id or original_schedule_block_id)
    const block = scheduleBlocks.find(b =>
      b.id === blockId || b.original_schedule_block_id === blockId
    );

    await completeScheduleBlock.mutateAsync({ sessionId: selectedSessionId, blockId });

    // If it's a wrap block, trigger the wrap process to finalize the day
    if (block?.block_type === 'wrap') {
      await wrapSession.mutateAsync(selectedSessionId);
      toast.success('Day wrapped!');
    }
  };

  const handleSkipScheduleBlock = async (blockId: string, reason?: string) => {
    if (!selectedSessionId) return;
    await skipScheduleBlock.mutateAsync({ sessionId: selectedSessionId, blockId, reason });
  };

  const handleAdjustScheduleBlockTime = async (blockId: string, startTime: string, endTime: string) => {
    if (!selectedSessionId) return;
    await updateScheduleBlock.mutateAsync({
      sessionId: selectedSessionId,
      blockId,
      expected_start_time: startTime,
      expected_end_time: endTime,
    });
  };

  const handleStartSession = async () => {
    if (!selectedSessionId) return;
    await startSession.mutateAsync(selectedSessionId);
  };

  const handleOpenWrapModal = () => {
    setPendingWrapBlockId(null);  // Clear any pending block - this is manual wrap
    setShowWrapModal(true);
  };

  const handleConfirmWrap = async (recordToBudget: boolean = false) => {
    if (!selectedSessionId) return;

    // If wrap was triggered from a wrap block, complete that block first
    if (pendingWrapBlockId) {
      try {
        await completeScheduleBlock.mutateAsync({
          sessionId: selectedSessionId,
          blockId: pendingWrapBlockId
        });
      } catch (e) {
        // Block might already be completed, continue with wrap
        console.log('Wrap block completion error (may already be complete):', e);
      }
    }

    await wrapSession.mutateAsync({ sessionId: selectedSessionId, recordToBudget });
    setShowWrapModal(false);
    setPendingWrapBlockId(null);
  };

  const handleOpenResumeModal = () => {
    setShowResumeModal(true);
  };

  const handleConfirmResume = async () => {
    if (!selectedSessionId) return;
    try {
      await resumeSession.mutateAsync(selectedSessionId);
      setShowResumeModal(false);
      toast.success('Day resumed - tracking is now active');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to resume day');
    }
  };

  const handleStartScene = async (sceneId: string) => {
    if (!selectedSessionId) return;
    await startScene.mutateAsync({ sessionId: selectedSessionId, sceneId });
  };

  const handleCompleteScene = async (sceneId: string) => {
    if (!selectedSessionId) return;
    await completeScene.mutateAsync({ sessionId: selectedSessionId, sceneId });
  };

  const handleSkipScene = async (sceneId: string) => {
    if (!selectedSessionId) return;
    const reason = window.prompt('Skip reason (optional):');
    await skipScene.mutateAsync({
      sessionId: selectedSessionId,
      sceneId,
      reason: reason || undefined,
    });
  };

  const handleAddMarker = async (markerType: HotSetMarkerType, label?: string) => {
    if (!selectedSessionId) return;
    await addMarker.mutateAsync({
      sessionId: selectedSessionId,
      marker_type: markerType,
      label,
    });
    setShowMarkerModal(false);
  };

  // Task creation handlers
  const handleOpenTaskModal = () => {
    const dayNumber = session?.production_day?.day_number || dashboard?.production_day?.day_number || 'Unknown';
    setTaskTitle(`Hot Set task: Day ${dayNumber}`);
    setTaskDescription(`Production Day: ${dayNumber}\nSession Status: ${session?.status || 'N/A'}`);
    setSelectedTaskListId(taskLists[0]?.id || '');
    setShowTaskModal(true);
  };

  const handleCreateTask = async () => {
    if (!selectedSessionId || !selectedTaskListId) {
      toast.error('Please select a task list');
      return;
    }

    try {
      await createTaskFromSource.mutateAsync({
        title: taskTitle,
        sourceType: 'hot_set',
        sourceId: selectedSessionId,
        description: taskDescription,
      });
      toast.success('Task created successfully');
      setShowTaskModal(false);
      setTaskTitle('');
      setTaskDescription('');
    } catch (error) {
      toast.error('Failed to create task');
    }
  };

  // Derived state (must be before early return to maintain hook order)
  const session = dashboard?.session;
  const isActive = session?.status === 'in_progress';
  const isWrapped = session?.status === 'wrapped';

  // Get production day info for current session
  const currentProductionDay = useMemo(() => {
    if (!session?.production_day_id || !productionDays) return null;
    return productionDays.find((d) => d.id === session.production_day_id) || null;
  }, [session?.production_day_id, productionDays]);

  // Handle clicking on a scene to view its details
  const handleSceneClick = useCallback((sceneNumber: string) => {
    // Navigate to the scene detail page
    navigate(`/backlot/${projectId}/scenes/${encodeURIComponent(sceneNumber)}`);
  }, [navigate, projectId]);

  // Schedule integration data
  const scheduleStatus = dashboard?.schedule_status;
  const timeStats = dashboard?.time_stats;
  const importedSchedule = (session?.imported_schedule || []) as HourScheduleBlock[];
  const hasImportedSchedule = importedSchedule.length > 0;
  const scheduleBlocks = dashboard?.schedule_blocks || [];
  const scheduleDeviationMinutes = dashboard?.schedule_deviation_minutes || 0;
  const currentExpectedBlock = dashboard?.current_expected_block || null;
  const catchUpSuggestions = dashboard?.catch_up_suggestions || [];
  const timelineData = dashboard?.timeline || null;

  // Pre-crew call phase detection
  const isPreCrewCallPhase =
    session &&
    session.status === 'in_progress' &&
    session.auto_started &&
    !session.crew_call_confirmed_at;

  const showCountdown = isPreCrewCallPhase && currentProductionDay?.general_call_time;

  // Loading state
  if (daysLoading || sessionsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading text-bone-white flex items-center gap-2">
            <Flame className="w-6 h-6 text-accent-yellow" />
            Production Day
          </h2>
          <p className="text-muted-gray text-sm">Real-time shoot day management</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Settings Button */}
          {canEdit && selectedSessionId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettingsPanel(!showSettingsPanel)}
              className="border-muted-gray/30"
            >
              <Settings className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{showSettingsPanel ? 'Hide Settings' : 'Settings'}</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTipsPanel(true)}
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <HelpCircle className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">Tips</span>
          </Button>
          {/* View All Days Button - Always visible when a session is selected */}
          {selectedSessionId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                userWantsAllDays.current = true;
                setSelectedSessionId(null);
                setShowReportView(false);
              }}
              className="border-muted-gray/30"
            >
              <Calendar className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">All Days</span>
            </Button>
          )}

          {/* Session Selector */}
          {sessions && sessions.length > 0 && selectedSessionId && (
            <Select value={selectedSessionId || ''} onValueChange={(val) => { userWantsAllDays.current = false; setSelectedSessionId(val); }}>
              <SelectTrigger className="w-32 sm:w-48 bg-charcoal-black border-muted-gray/30">
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((s) => {
                  const day = (s as any).production_day;
                  const statusLabels: Record<string, string> = {
                    not_started: 'Not Started',
                    in_progress: 'In Progress',
                    wrapped: 'Wrapped',
                    completed: 'Completed',
                  };
                  return (
                    <SelectItem key={s.id} value={s.id}>
                      Day {day?.day_number || '?'} - {statusLabels[s.status] || s.status}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}

          {/* Create New Session */}
          {canEdit && availableDays.length > 0 && selectedSessionId && (
            <Button
              size="sm"
              onClick={() => setShowCreateModal(true)}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">New Day</span>
            </Button>
          )}
        </div>
      </div>

      {/* Settings Panel (collapsible) */}
      {showSettingsPanel && selectedSessionId && hotSetSettings && (
        <HotSetSettingsPanel
          settings={hotSetSettings}
          onSave={(settings) => {
            updateSettings.mutate(settings, {
              onSuccess: () => toast.success('Settings saved'),
            });
          }}
          isSaving={updateSettings.isPending}
        />
      )}

      {/* No Session Selected - Show Production Days */}
      {!selectedSessionId && (
        <div className="space-y-6">
          {/* Timezone Selector Card */}
          <Card className="bg-soft-black border-muted-gray/20">
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-accent-yellow" />
                  <div>
                    <p className="text-sm font-medium text-bone-white">Production Timezone</p>
                    <p className="text-xs text-muted-gray">
                      Schedule times will be compared using this timezone
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={hotSetSettings?.timezone || ''}
                    onValueChange={(value) => {
                      if (canEdit) {
                        updateSettings.mutate({ timezone: value });
                      }
                    }}
                    disabled={!canEdit || updateSettings.isPending}
                  >
                    <SelectTrigger className="w-64 bg-charcoal-black border-muted-gray/30">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      <SelectItem value="America/Los_Angeles">Pacific Time (Los Angeles)</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time (Denver)</SelectItem>
                      <SelectItem value="America/Chicago">Central Time (Chicago)</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time (New York)</SelectItem>
                      <SelectItem value="America/Anchorage">Alaska Time (Anchorage)</SelectItem>
                      <SelectItem value="Pacific/Honolulu">Hawaii Time (Honolulu)</SelectItem>
                      <SelectItem value="America/Phoenix">Arizona (Phoenix - No DST)</SelectItem>
                      <SelectItem value="America/Toronto">Eastern Time (Toronto)</SelectItem>
                      <SelectItem value="America/Vancouver">Pacific Time (Vancouver)</SelectItem>
                      <SelectItem value="Europe/London">UK Time (London)</SelectItem>
                      <SelectItem value="Europe/Paris">Central European (Paris)</SelectItem>
                      <SelectItem value="Europe/Berlin">Central European (Berlin)</SelectItem>
                      <SelectItem value="Asia/Tokyo">Japan (Tokyo)</SelectItem>
                      <SelectItem value="Asia/Seoul">Korea (Seoul)</SelectItem>
                      <SelectItem value="Asia/Shanghai">China (Shanghai)</SelectItem>
                      <SelectItem value="Asia/Singapore">Singapore</SelectItem>
                      <SelectItem value="Australia/Sydney">Australia Eastern (Sydney)</SelectItem>
                      <SelectItem value="Australia/Melbourne">Australia Eastern (Melbourne)</SelectItem>
                      <SelectItem value="Pacific/Auckland">New Zealand (Auckland)</SelectItem>
                    </SelectContent>
                  </Select>
                  {hotSetSettings?.timezone && (
                    <span className="text-xs text-muted-gray whitespace-nowrap">
                      {new Date().toLocaleTimeString('en-US', {
                        timeZone: hotSetSettings.timezone,
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })} now
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Available Production Days */}
          {productionDays && productionDays.length > 0 ? (
            <Card className="bg-soft-black border-muted-gray/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-bone-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-accent-yellow" />
                  Production Days from Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {productionDays
                  .sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime())
                  .map((day) => {
                    const existingSession = sessions?.find((s) => s.production_day_id === day.id);
                    const hasSession = !!existingSession;
                    const isPast = parseLocalDate(day.date) < new Date(new Date().toDateString());
                    const isToday = parseLocalDate(day.date).toDateString() === new Date().toDateString();

                    return (
                      <div
                        key={day.id}
                        className={cn(
                          'flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 p-3 sm:p-4 rounded-lg border transition-all cursor-pointer',
                          hasSession
                            ? 'bg-green-500/5 border-green-500/30 hover:bg-green-500/10'
                            : day.is_completed
                            ? 'bg-muted-gray/5 border-muted-gray/20 cursor-default opacity-60'
                            : isToday
                            ? 'bg-accent-yellow/10 border-accent-yellow/50 hover:border-accent-yellow'
                            : 'bg-charcoal-black/50 border-muted-gray/20 hover:border-muted-gray/40'
                        )}
                        onClick={() => {
                          if (hasSession && existingSession) {
                            userWantsAllDays.current = false;
                            setSelectedSessionId(existingSession.id);
                            // Auto-show report view for wrapped sessions
                            if (existingSession.status === 'wrapped') {
                              setShowReportView(true);
                            } else {
                              setShowReportView(false);
                            }
                          } else if (!day.is_completed && canEdit) {
                            setNewSessionDayId(day.id);
                            setShowCreateModal(true);
                          }
                        }}
                      >
                        {/* Day Number */}
                        <div
                          className={cn(
                            'flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-lg flex flex-col items-center justify-center font-bold',
                            hasSession
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : day.is_completed
                              ? 'bg-muted-gray/20 text-muted-gray border border-muted-gray/30'
                              : isToday
                              ? 'bg-accent-yellow/20 text-accent-yellow border border-accent-yellow/30'
                              : isPast
                              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          )}
                        >
                          <span className="text-xs">Day</span>
                          <span className="text-lg sm:text-xl">{day.day_number}</span>
                        </div>

                        {/* Day Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-1">
                            <span className="font-medium text-bone-white text-sm sm:text-base truncate">
                              {parseLocalDate(day.date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                            {isToday && (
                              <Badge className="bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30 text-xs">
                                Today
                              </Badge>
                            )}
                            {day.is_completed && (
                              <Badge className="bg-muted-gray/20 text-muted-gray border-muted-gray/30 text-xs">
                                <CheckCircle2 className="w-3 h-3 sm:mr-1" />
                                <span className="hidden sm:inline">Completed</span>
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-gray">
                            {day.title && <span className="truncate max-w-[120px] sm:max-w-none">{day.title}</span>}
                            {day.general_call_time && (
                              <span className="flex items-center gap-1 flex-shrink-0">
                                <Clock className="w-3 h-3" />
                                {day.general_call_time}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Session Status */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {hasSession ? (
                            existingSession?.status === 'in_progress' ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-green-500/30 text-green-400 hover:bg-green-500/10 text-xs sm:text-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    userWantsAllDays.current = false;
                                    setSelectedSessionId(existingSession.id);
                                    setShowReportView(false);
                                  }}
                                >
                                  <Play className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                                  Continue
                                </Button>
                              </>
                            ) : (
                              <>
                                <Badge
                                  className={cn(
                                    'capitalize text-xs',
                                    existingSession?.status === 'wrapped' &&
                                      'bg-blue-500/20 text-blue-400 border-blue-500/30',
                                    existingSession?.status === 'not_started' &&
                                      'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
                                    existingSession?.status === 'pending' &&
                                      'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                                  )}
                                >
                                  {existingSession?.status === 'wrapped' && <CheckCircle2 className="w-3 h-3 sm:mr-1" />}
                                  {(existingSession?.status === 'not_started' || existingSession?.status === 'pending') && <Clock className="w-3 h-3 sm:mr-1" />}
                                  <span className="hidden sm:inline">
                                    {existingSession?.status === 'wrapped' ? 'Wrapped' : 'Not Started'}
                                  </span>
                                </Badge>
                                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-muted-gray" />
                              </>
                            )
                          ) : !day.is_completed && canEdit ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-accent-yellow/30 text-accent-yellow hover:bg-accent-yellow/10 text-xs sm:text-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setNewSessionDayId(day.id);
                                setShowCreateModal(true);
                              }}
                            >
                              <Plus className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                              <span className="hidden sm:inline">Start Day</span>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-soft-black border-muted-gray/20">
              <CardContent className="py-12 text-center">
                <Calendar className="w-12 h-12 mx-auto text-muted-gray mb-4" />
                <h3 className="text-lg font-medium text-bone-white mb-2">No Production Days Scheduled</h3>
                <p className="text-muted-gray mb-4">
                  Add production days in the Schedule tab first to start managing shoot days here.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Dashboard */}
      {selectedSessionId && dashboard && (
        <>
          {/* Report View - Full day report for wrapped sessions */}
          {showReportView && session && (
            <HotSetDayReportView
              session={session}
              projectId={projectId}
              onBack={() => {
                userWantsAllDays.current = true;
                setShowReportView(false);
                setSelectedSessionId(null);
              }}
              onResume={() => {
                setShowReportView(false);
                setShowResumeModal(true);
              }}
              isResuming={resumeSession.isPending}
            />
          )}

          {/* Normal Dashboard View */}
          {!showReportView && (
            <>
              {/* Day Header Banner */}
              <Card className="bg-gradient-to-r from-accent-yellow/10 via-soft-black to-soft-black border-accent-yellow/30 overflow-hidden">
            <CardContent className="py-3 sm:py-4 px-3 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
                <div className="flex flex-wrap items-center gap-3 sm:gap-6 min-w-0">
                  {/* Day Number */}
                  <div className="flex-shrink-0">
                    <span className="text-2xl sm:text-3xl font-bold text-accent-yellow">
                      Day {currentProductionDay?.day_number || '?'}
                    </span>
                  </div>

                  {/* Schedule Date */}
                  <div className="hidden xs:block flex-shrink-0">
                    <p className="text-xs text-muted-gray uppercase">Date</p>
                    <p className="text-sm sm:text-lg text-bone-white">
                      {currentProductionDay?.date
                        ? new Date(currentProductionDay.date + 'T00:00:00').toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '--'}
                    </p>
                  </div>

                  {/* Call Time */}
                  <div className="hidden sm:block flex-shrink-0">
                    <p className="text-xs text-muted-gray uppercase">Call</p>
                    <p className="text-sm sm:text-lg text-bone-white">
                      {formatTime(session?.actual_call_time || null, session?.timezone)}
                    </p>
                  </div>

                  {/* Current Date & Time */}
                  <div className="hidden lg:block flex-shrink-0">
                    <p className="text-xs text-muted-gray uppercase truncate max-w-[150px]">
                      Now{session?.location_name && ` (${session.location_name})`}
                      {!session?.location_name && session?.timezone && ` (${session.timezone.split('/').pop()?.replace(/_/g, ' ')})`}
                    </p>
                    <p className="text-sm sm:text-lg text-bone-white">
                      <LiveDate timezone={session?.timezone} />{' '}
                      <LiveClock timezone={session?.timezone} />
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                <Badge
                  className={cn(
                    'text-xs sm:text-sm py-1 sm:py-1.5 px-2 sm:px-3 flex-shrink-0',
                    session?.status === 'in_progress' && 'bg-green-500/20 text-green-400 border-green-500/30',
                    session?.status === 'not_started' && 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
                    session?.status === 'wrapped' && 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  )}
                >
                  {session?.status === 'in_progress' && 'LIVE'}
                  {session?.status === 'not_started' && 'NOT STARTED'}
                  {session?.status === 'wrapped' && 'WRAPPED'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* PRE-CREW CALL PHASE: Show countdown & checklist */}
          {isPreCrewCallPhase && showCountdown && (
            <PreCrewCallCountdown
              session={session}
              crewCallTime={new Date(
                `${currentProductionDay.date}T${currentProductionDay.general_call_time}`
              )}
              onConfirmCrewCall={() => {
                // Find the crew_call schedule block to start it
                const crewCallBlock = scheduleBlocks.find(b => b.block_type === 'crew_call');

                confirmCrewCall.mutate(session.id, {
                  onSuccess: async () => {
                    // Also start the crew_call schedule block so it shows as in_progress with timer
                    if (crewCallBlock) {
                      await handleStartScheduleBlock(crewCallBlock.id);
                    }
                    toast.success('Crew call confirmed');
                    refetch();
                  },
                });
              }}
              onConfirmFirstShot={() => {
                confirmFirstShot.mutate(session.id, {
                  onSuccess: () => {
                    toast.success('First shot confirmed - day tracking active');
                    refetch();
                  },
                });
              }}
              isConfirmingCrewCall={confirmCrewCall.isPending}
              isConfirmingFirstShot={confirmFirstShot.isPending}
            />
          )}

          {/* Status Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
            {/* Schedule Status */}
            <Card
              className={cn('bg-soft-black', getScheduleStatusBgColor(scheduleStatus?.status || 'on_time'))}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-gray uppercase truncate">Schedule</p>
                    <p
                      className={cn('text-xl sm:text-2xl font-bold', getScheduleStatusColor(scheduleStatus?.status || 'on_time'))}
                    >
                      {scheduleStatus?.status === 'ahead' && '+'}
                      {scheduleStatus?.variance_minutes || 0}m
                    </p>
                  </div>
                  <Badge
                    className={cn(
                      'capitalize text-xs hidden sm:inline-flex',
                      scheduleStatus?.status === 'ahead' && 'bg-green-500/20 text-green-400',
                      scheduleStatus?.status === 'behind' && 'bg-red-500/20 text-red-400',
                      scheduleStatus?.status === 'on_time' && 'bg-yellow-500/20 text-yellow-400'
                    )}
                  >
                    {scheduleStatus?.status?.replace('_', ' ') || 'On Time'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Time Elapsed */}
            <Card className="bg-soft-black border-muted-gray/20">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-gray uppercase truncate">Elapsed</p>
                    <p className="text-xl sm:text-2xl font-bold text-bone-white">
                      {formatElapsedTime(timeStats?.elapsed_minutes || 0)}
                    </p>
                  </div>
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-muted-gray flex-shrink-0" />
                </div>
              </CardContent>
            </Card>

            {/* Progress */}
            <Card className="bg-soft-black border-muted-gray/20">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-gray uppercase truncate">Progress</p>
                  <span className="text-xs sm:text-sm text-bone-white flex-shrink-0">
                    {scheduleStatus?.scenes_completed || 0}/{scheduleStatus?.scenes_total || 0}
                  </span>
                </div>
                <Progress value={scheduleStatus?.percent_complete || 0} className="h-2" />
              </CardContent>
            </Card>

            {/* Day Type */}
            <Card className="bg-soft-black border-muted-gray/20">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-gray uppercase truncate">Day Type</p>
                    <p className="text-xl sm:text-2xl font-bold text-bone-white">{session?.day_type || '10hr'}</p>
                  </div>
                  <Timer className="w-5 h-5 sm:w-6 sm:h-6 text-muted-gray flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Schedule Integration: Timeline & Deviation */}
          {hasImportedSchedule && (
            <div className="space-y-4">
              {/* Schedule Deviation Card - Only show when active */}
              {isActive && dashboard.projected_schedule && dashboard.projected_schedule.length > 0 && (
                <ScheduleDeviationCard
                  cumulativeVariance={
                    dashboard.projected_schedule.find(i => i.is_current)?.variance_from_plan ?? 0
                  }
                  realtimeDeviation={
                    dashboard.projected_schedule.find(i => i.is_current)?.realtime_deviation_minutes
                  }
                  currentItem={
                    dashboard.projected_schedule.find(i => i.is_current)
                  }
                  currentExpectedBlock={currentExpectedBlock}
                  currentScene={dashboard?.current_scene || null}
                  onViewSuggestions={() => setShowSuggestionsPanel(true)}
                  hasSuggestions={catchUpSuggestions.length > 0}
                  timezone={session?.timezone}
                />
              )}

              {/* Catch-Up Suggestions (when behind) */}
              {isActive && scheduleDeviationMinutes > 0 && catchUpSuggestions.length > 0 && (
                <CatchUpSuggestionsPanel
                  suggestions={catchUpSuggestions}
                  deviationMinutes={scheduleDeviationMinutes}
                  isExpanded={showSuggestionsPanel}
                  onToggleExpanded={() => setShowSuggestionsPanel(!showSuggestionsPanel)}
                  onApplySuggestion={(suggestion) => {
                    // Handle applying suggestion
                    if (suggestion.type === 'shorten_meal' && suggestion.action_data?.block_id) {
                      handleAdjustScheduleBlockTime(
                        suggestion.action_data.block_id as string,
                        '', // keep start time
                        '' // need to calculate new end time
                      );
                    } else if (suggestion.type === 'skip_activity' && suggestion.action_data?.block_id) {
                      handleSkipScheduleBlock(
                        suggestion.action_data.block_id as string,
                        'Skipped to catch up on schedule'
                      );
                    }
                    toast.success('Suggestion applied');
                  }}
                />
              )}

              {/* Visual Timeline - Show always when schedule is imported */}
              <Card className="bg-soft-black border-muted-gray/20">
                <CardHeader className="py-3 border-b border-muted-gray/20">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-accent-yellow" />
                    Day Schedule
                    {!isActive && !isWrapped && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        Preview
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <HotSetTimeline
                    importedSchedule={importedSchedule}
                    completedScenes={dashboard?.completed_scenes || []}
                    currentScene={dashboard?.current_scene || null}
                    scheduleBlocks={scheduleBlocks}
                    timeline={timelineData}
                    deviationMinutes={scheduleDeviationMinutes}
                    onSceneClick={handleSceneClick}
                    projectId={projectId}
                    timezone={session?.timezone}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Schedule View - Primary */}
            <div className="lg:col-span-2">
              {/* Tabbed Schedule View - Primary display for current activity and schedule */}
              {dashboard.projected_schedule && dashboard.projected_schedule.length > 0 ? (
                <TabbedScheduleView
                    items={dashboard.projected_schedule}
                    currentScene={dashboard?.current_scene || null}
                    nextScenes={dashboard?.next_scenes || []}
                    isActive={session.status === 'in_progress'}
                    isWrapped={session.status === 'wrapped'}
                    canEdit={canEdit}
                    sessionId={session.id}
                    defaultTab={hotSetSettings?.default_schedule_view || 'current'}
                    onScheduleModified={() => refetch()}
                    onStartScene={(sceneId) => startScene.mutate({ sessionId: session.id, sceneId })}
                    onCompleteScene={(sceneId) => completeScene.mutate({ sessionId: session.id, sceneId })}
                    onSkipScene={(sceneId) => skipScene.mutate({ sessionId: session.id, sceneId })}
                    onStartActivity={(blockId) => {
                      console.log('[HotSet] Starting activity with blockId:', blockId);
                      startScheduleBlock.mutate(
                        { sessionId: session.id, blockId },
                        {
                          onSuccess: () => {
                            console.log('[HotSet] Activity started successfully');
                            toast.success('Activity started');
                          },
                          onError: (error) => {
                            console.error('[HotSet] Failed to start activity:', error);
                            toast.error(`Failed to start: ${error.message}`);
                          },
                        }
                      );
                    }}
                    onCompleteActivity={(blockId) => {
                      // Check if completing a wrap block - show modal instead of direct complete
                      const block = scheduleBlocks.find(b =>
                        b.id === blockId || b.original_schedule_block_id === blockId
                      );
                      if (block?.block_type === 'wrap') {
                        // Store the block ID and open wrap modal
                        setPendingWrapBlockId(blockId);
                        setShowWrapModal(true);
                      } else {
                        completeScheduleBlock.mutate({ sessionId: session.id, blockId });
                      }
                    }}
                    onSkipActivity={(blockId) => skipScheduleBlock.mutate({ sessionId: session.id, blockId })}
                    onStartDay={() => startSession.mutate(session.id)}
                    isStartingScene={startScene.isPending}
                    isCompletingScene={completeScene.isPending}
                    isSkippingScene={skipScene.isPending}
                    isStartingActivity={startScheduleBlock.isPending}
                    isCompletingActivity={completeScheduleBlock.isPending}
                    isSkippingActivity={skipScheduleBlock.isPending}
                    timezone={session?.timezone}
                    onReorderSchedule={(items) => {
                      reorderSchedule.mutate(
                        { sessionId: session.id, items },
                        {
                          onSuccess: () => {
                            toast.success('Schedule reordered');
                          },
                          onError: (error) => {
                            toast.error(`Failed to reorder: ${error.message}`);
                          },
                        }
                      );
                    }}
                    isReordering={reorderSchedule.isPending}
                  />
              ) : (
                /* Fallback when no schedule - show import options */
                <Card className="bg-soft-black border-muted-gray/20">
                  <CardHeader className="border-b border-muted-gray/20">
                    <CardTitle className="flex items-center gap-2">
                      <Clapperboard className="w-5 h-5 text-accent-yellow" />
                      {!isActive && !isWrapped ? 'Ready to Start' : isWrapped ? 'Day Wrapped' : 'Schedule'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="text-center py-8">
                      {!isActive && !isWrapped ? (
                        <>
                          <p className="text-muted-gray mb-4">Day not started yet</p>
                          {canEdit && (
                            <Button
                              size="lg"
                              onClick={handleStartSession}
                              disabled={startSession.isPending}
                              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                            >
                              <Play className="w-5 h-5 mr-2" />
                              Start Day
                            </Button>
                          )}
                        </>
                      ) : isWrapped ? (
                        <div className="text-green-400">
                          <CheckCircle2 className="w-12 h-12 mx-auto mb-4" />
                          <p className="text-xl font-medium">Day Wrapped</p>
                          <p className="text-sm text-muted-gray mt-2">
                            Wrapped at {formatTime(session?.actual_wrap_time || null, session?.timezone)}
                          </p>
                        </div>
                      ) : (
                        <div className="text-muted-gray">
                          <Film className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p className="text-lg font-medium mb-2">No scenes imported</p>
                          <p className="text-sm mb-4">Import scenes to start tracking your shooting day</p>
                          {canEdit && session && (
                            <div className="flex flex-col gap-2 max-w-xs mx-auto">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  importFromProductionDay.mutate(
                                    { sessionId: session.id },
                                    {
                                      onSuccess: ({ scenesImported }) => {
                                        if (scenesImported === 0) {
                                          alert('No scenes are assigned to this production day. Go to the Schedule tab to assign scenes first.');
                                        }
                                      },
                                    }
                                  );
                                }}
                                disabled={importFromProductionDay.isPending || importFromHourSchedule.isPending}
                                className="border-accent-yellow/50 text-accent-yellow hover:bg-accent-yellow/10"
                              >
                                {importFromProductionDay.isPending ? (
                                  <>Importing...</>
                                ) : (
                                  <>
                                    <Film className="w-4 h-4 mr-2" />
                                    Import from Schedule Tab
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  importFromHourSchedule.mutate(
                                    { sessionId: session.id },
                                    {
                                      onSuccess: ({ scenesImported, blocksImported }) => {
                                        if (scenesImported === 0 && blocksImported === 0) {
                                          alert('No hour schedule found for this day. Go to the Schedule tab and create an hour-by-hour schedule first.');
                                        }
                                      },
                                    }
                                  );
                                }}
                                disabled={importFromProductionDay.isPending || importFromHourSchedule.isPending}
                                className="border-muted-gray/50 hover:bg-muted-gray/10"
                              >
                                {importFromHourSchedule.isPending ? (
                                  <>Importing...</>
                                ) : (
                                  <>
                                    <Clock className="w-4 h-4 mr-2" />
                                    Import Hour Schedule
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Task Creation - Quick Access */}
              {canEdit && isActive && (
                <div className="mt-4">
                  <Button
                    variant="outline"
                    onClick={handleOpenTaskModal}
                    className="w-full"
                  >
                    <ListTodo className="w-4 h-4 mr-2" />
                    Create Task
                  </Button>
                </div>
              )}
            </div>

            {/* Right Panel - AD Command Hub */}
            <div className="space-y-4">
              {/* Call Sheet Quick Link */}
              {session && (
                <CallSheetQuickLink
                  projectId={projectId}
                  callSheetId={session.call_sheet_id}
                  productionDayId={session.production_day_id}
                  dayNumber={currentProductionDay?.day_number || 1}
                  date={currentProductionDay?.date}
                />
              )}

              {/* AD Notes */}
              {session && session.production_day_id && (
                <ADNotesPanel
                  dayId={session.production_day_id}
                  initialNotes={dayAdNotes ?? null}
                  canEdit={canEdit}
                />
              )}

              {/* AD Notes History */}
              {session && session.production_day_id && (
                <AdNotesHistoryCard
                  dayId={session.production_day_id}
                  projectId={projectId}
                  canEdit={canEdit}
                  onEntryClick={(entry) => {
                    setSelectedAdNoteEntry(entry);
                    setShowAdNoteModal(true);
                  }}
                />
              )}

              {/* Session Tasks */}
              {session && (
                <SessionTasksCard
                  projectId={projectId}
                  sessionId={session.id}
                  canEdit={canEdit}
                  onTaskClick={(taskId) => {
                    setSelectedTaskId(taskId);
                    setShowTaskDrawer(true);
                  }}
                />
              )}

              {/* Day Stats */}
              <DayStatsCard
                elapsedMinutes={timeStats?.elapsed_minutes || 0}
                scenesCompleted={scheduleStatus?.scenes_completed || 0}
                scenesTotal={scheduleStatus?.scenes_total || 0}
                scheduleStatus={scheduleStatus?.status || 'on_time'}
                varianceMinutes={scheduleStatus?.variance_minutes || 0}
              />

              {/* OT Projection */}
              {session && (
                <OTProjectionCard
                  projection={dashboard?.ot_projection}
                  dayType={session.day_type}
                  timezone={session?.timezone}
                />
              )}

              {/* Quick Actions */}
              {canEdit && isActive && (
                <Card className="bg-soft-black border-muted-gray/20">
                  <CardContent className="p-4 space-y-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowMarkerModal(true)}
                      className="w-full justify-start"
                    >
                      <Flag className="w-4 h-4 mr-2" />
                      Add Time Marker
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleOpenWrapModal}
                      disabled={wrapSession.isPending}
                      className="w-full justify-start border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <Square className="w-4 h-4 mr-2" />
                      Wrap Day
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Wrapped Day Actions - View report and resume option */}
              {isWrapped && (
                <Card className="bg-soft-black border-green-500/20">
                  <CardContent className="p-4 space-y-3">
                    <div className="text-center mb-3">
                      <CheckCircle2 className="w-8 h-8 mx-auto text-green-400 mb-2" />
                      <p className="text-sm text-muted-gray">Day has been wrapped</p>
                    </div>
                    <Button
                      onClick={() => setShowReportView(true)}
                      className="w-full bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                    >
                      <FileDown className="w-4 h-4 mr-2" />
                      View Day Report
                    </Button>
                    {canEdit && (
                      <>
                        <Button
                          variant="outline"
                          onClick={handleOpenResumeModal}
                          disabled={resumeSession.isPending}
                          className="w-full justify-start border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                        >
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Resume Day
                        </Button>
                        <p className="text-xs text-muted-gray text-center">
                          Accidentally wrapped? Resume to continue tracking.
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Up Next */}
              <Card className="bg-soft-black border-muted-gray/20">
                <CardHeader className="py-3 border-b border-muted-gray/20">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ChevronRight className="w-4 h-4" />
                    Up Next ({dashboard.next_scenes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-2 max-h-48 overflow-y-auto">
                  {dashboard.next_scenes.length === 0 ? (
                    <p className="text-sm text-muted-gray text-center py-4">No scenes queued</p>
                  ) : (
                    dashboard.next_scenes.slice(0, 3).map((scene, idx) => (
                      <SceneCard
                        key={scene.id}
                        scene={scene}
                        canEdit={canEdit && isActive && idx === 0}
                        onStart={idx === 0 ? () => handleStartScene(scene.id) : undefined}
                        isPending={startScene.isPending}
                        timezone={session?.timezone}
                      />
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Schedule Blocks (Meals, Moves, Activities) */}
              {scheduleBlocks.length > 0 && (
                <Card className="bg-soft-black border-muted-gray/20">
                  <CardHeader className="py-3 border-b border-muted-gray/20">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Coffee className="w-4 h-4 text-green-400" />
                      Schedule Blocks
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 space-y-2 max-h-48 overflow-y-auto">
                    {scheduleBlocks
                      .filter((block) => block.status !== 'completed' && block.status !== 'skipped')
                      .slice(0, 3)
                      .map((block) => (
                        <ScheduleBlockCard
                          key={block.id}
                          block={block}
                          canEdit={canEdit && isActive}
                          onStart={() => handleStartScheduleBlock(block.id)}
                          onComplete={() => handleCompleteScheduleBlock(block.id)}
                          onSkip={(reason) => handleSkipScheduleBlock(block.id, reason)}
                          onAdjustTime={(start, end) => handleAdjustScheduleBlockTime(block.id, start, end)}
                          isPending={
                            startScheduleBlock.isPending ||
                            completeScheduleBlock.isPending ||
                            skipScheduleBlock.isPending
                          }
                          timezone={session?.timezone}
                        />
                      ))}
                  </CardContent>
                </Card>
              )}

              {/* Completed Scenes (collapsed) */}
              {dashboard.completed_scenes.length > 0 && (
                <Card className="bg-soft-black border-muted-gray/20">
                  <CardHeader className="py-3 border-b border-muted-gray/20">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      Completed ({dashboard.completed_scenes.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 space-y-2 max-h-32 overflow-y-auto">
                    {dashboard.completed_scenes.slice(-3).reverse().map((scene) => (
                      <div
                        key={scene.id}
                        className="flex items-center justify-between py-2 px-3 bg-green-500/5 rounded border border-green-500/20"
                      >
                        <span className="text-sm text-bone-white">
                          {scene.scene_number || 'Scene'}
                        </span>
                        <span className="text-xs text-muted-gray">
                          {scene.actual_duration_minutes}m
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
            </>
          )}
        </>
      )}

      {/* Create Session Modal - Enhanced with Schedule Import and OT Preview */}
      <CreateHotSetSessionModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        productionDays={availableDays}
        callSheets={callSheets || []}
        projectId={projectId}
        onSubmit={handleCreateSessionWithSchedule}
        defaultAutoStart={hotSetSettings?.auto_start_enabled ?? true}
        autoStartMinutes={hotSetSettings?.auto_start_minutes_before_call ?? 30}
        isLoading={createSession.isPending}
      />

      {/* Add Marker Modal */}
      <Dialog open={showMarkerModal} onOpenChange={setShowMarkerModal}>
        <DialogContent className="bg-soft-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle>Add Time Marker</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-4">
            <Button
              variant="outline"
              className="h-20 flex-col"
              onClick={() => handleAddMarker('meal_in', 'Meal In')}
            >
              <Coffee className="w-6 h-6 mb-2" />
              Meal In
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col"
              onClick={() => handleAddMarker('meal_out', 'Meal Out')}
            >
              <Coffee className="w-6 h-6 mb-2" />
              Meal Out
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col"
              onClick={() => handleAddMarker('company_move', 'Company Move')}
            >
              <Truck className="w-6 h-6 mb-2" />
              Company Move
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col"
              onClick={() => handleAddMarker('martini', 'Martini Shot')}
            >
              <Clapperboard className="w-6 h-6 mb-2" />
              Martini
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col col-span-2"
              onClick={() => {
                const label = window.prompt('Marker label:');
                if (label) handleAddMarker('custom', label);
              }}
            >
              <Flag className="w-6 h-6 mb-2" />
              Custom Marker
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={showTaskModal} onOpenChange={setShowTaskModal}>
        <DialogContent className="bg-soft-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-primary" />
              Create Task from Hot Set
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Task List *</Label>
              <Select value={selectedTaskListId} onValueChange={setSelectedTaskListId}>
                <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                  <SelectValue placeholder="Select a task list" />
                </SelectTrigger>
                <SelectContent>
                  {taskLists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Task Title *</Label>
              <Input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="bg-charcoal-black border-muted-gray/30"
                placeholder="Enter task title"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                className="bg-charcoal-black border-muted-gray/30"
                placeholder="Enter task description"
                rows={3}
              />
            </div>
            {session && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-xs text-muted-gray mb-1">Linked to session:</p>
                <p className="text-sm text-bone-white font-medium">
                  Day {session.production_day?.day_number || 'N/A'} - {session.status}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateTask}
              disabled={!taskTitle || !selectedTaskListId || createTaskFromSource.isPending}
              className="bg-primary text-white hover:bg-primary/90"
            >
              {createTaskFromSource.isPending ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tips Panel Dialog */}
      <Dialog open={showTipsPanel} onOpenChange={setShowTipsPanel}>
        <DialogContent className="sm:max-w-lg bg-charcoal-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-bone-white">
              <HelpCircle className="w-5 h-5 text-amber-400" />
              Production Day Tips
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-accent-yellow/10 rounded-lg">
                <Play className="w-5 h-5 text-accent-yellow" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Starting the Day</h4>
                <p className="text-sm text-muted-gray">
                  Click a production day to create a session, then "Start Day" to begin
                  real-time tracking. The timer starts from first shot.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Film className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Scene Progression</h4>
                <p className="text-sm text-muted-gray">
                  Start scenes when camera rolls, complete when you move on. Skip scenes
                  you won't shoot. The timeline updates in real-time.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Coffee className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Time Markers</h4>
                <p className="text-sm text-muted-gray">
                  Mark meals, company moves, and custom events. These help track breaks
                  and calculate actual shooting time for wrap reports.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">OT Countdown</h4>
                <p className="text-sm text-muted-gray">
                  Watch the overtime countdown. The indicator turns orange then red as
                  you approach and exceed the day's threshold.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Target className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Schedule Status</h4>
                <p className="text-sm text-muted-gray">
                  Green means ahead, yellow on track, red behind. Compare pages shot
                  vs. pages planned to adjust your day.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowTipsPanel(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wrap Day Modal */}
      {selectedSessionId && (
        <WrapDayModal
          open={showWrapModal}
          onOpenChange={(open) => {
            setShowWrapModal(open);
            if (!open) setPendingWrapBlockId(null);  // Clear pending block when modal closes
          }}
          sessionId={selectedSessionId}
          onConfirmWrap={handleConfirmWrap}
          isWrapping={wrapSession.isPending || completeScheduleBlock.isPending}
        />
      )}

      {/* Resume Day Modal */}
      <Dialog open={showResumeModal} onOpenChange={setShowResumeModal}>
        <DialogContent className="sm:max-w-md bg-soft-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-bone-white">
              <RotateCcw className="w-5 h-5 text-blue-400" />
              Resume Day {currentProductionDay?.day_number}
            </DialogTitle>
            <DialogDescription className="text-muted-gray">
              Resume tracking for this production day.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-400">Are you sure?</p>
                <p className="text-xs text-blue-400/80 mt-1">
                  This will set the day status back to "In Progress" and resume tracking.
                  The wrap time will be cleared.
                </p>
              </div>
            </div>

            <div className="text-sm text-muted-gray">
              <p>This is useful if:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>You accidentally wrapped the day too early</li>
                <li>You need to continue shooting after wrap was called</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowResumeModal(false)}
              disabled={resumeSession.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmResume}
              disabled={resumeSession.isPending}
              className="bg-blue-600 hover:bg-blue-500 text-white"
            >
              {resumeSession.isPending ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Resuming...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Resume Day
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AD Note Detail Modal */}
      {session?.production_day_id && (
        <AdNoteDetailModal
          entry={selectedAdNoteEntry}
          dayId={session.production_day_id}
          canEdit={canEdit}
          isOpen={showAdNoteModal}
          onClose={() => {
            setShowAdNoteModal(false);
            setSelectedAdNoteEntry(null);
          }}
        />
      )}

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        taskId={selectedTaskId}
        projectId={projectId}
        canEdit={canEdit}
        open={showTaskDrawer}
        onClose={() => {
          setShowTaskDrawer(false);
          setSelectedTaskId(null);
        }}
      />
    </div>
  );
};

export default HotSetView;
