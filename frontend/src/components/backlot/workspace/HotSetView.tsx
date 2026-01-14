/**
 * HotSetView - Production Day real-time management for 1st ADs
 *
 * Features:
 * - Day selection and configuration
 * - Scene progression (start, complete, skip)
 * - Real-time schedule tracking
 * - OT countdown and cost projections
 */
import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseLocalDate } from '@/lib/dateUtils';
import { useProductionDays, useCallSheets } from '@/hooks/backlot';
import {
  useHotSetSessions,
  useCreateHotSetSession,
  useStartHotSetSession,
  useWrapHotSetSession,
  useHotSetDashboard,
  useStartScene,
  useCompleteScene,
  useSkipScene,
  useAddMarker,
  formatElapsedTime,
  formatTime,
  calculateElapsedSeconds,
  formatSeconds,
  getScheduleStatusColor,
  getScheduleStatusBgColor,
  formatCurrency,
} from '@/hooks/backlot';
import {
  HotSetSession,
  HotSetSceneLog,
  HotSetDayType,
  HotSetMarkerType,
} from '@/types/backlot';
import { useTaskLists, useCreateTaskFromSource } from '@/hooks/backlot/useTaskLists';
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

// Scene card component
const SceneCard: React.FC<{
  scene: HotSetSceneLog;
  isActive?: boolean;
  onStart?: () => void;
  onComplete?: () => void;
  onSkip?: () => void;
  canEdit: boolean;
  isPending?: boolean;
}> = ({ scene, isActive, onStart, onComplete, onSkip, canEdit, isPending }) => {
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
              <span>Est: {scene.estimated_minutes || 30}m</span>
              {scene.actual_duration_minutes && (
                <span
                  className={cn(
                    scene.actual_duration_minutes > (scene.estimated_minutes || 30)
                      ? 'text-red-400'
                      : 'text-green-400'
                  )}
                >
                  Actual: {scene.actual_duration_minutes}m
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

  // Queries
  const { days: productionDays, isLoading: daysLoading } = useProductionDays(projectId);
  const { data: callSheets } = useCallSheets(projectId);
  const { data: sessions, isLoading: sessionsLoading } = useHotSetSessions(projectId);
  const { data: dashboard, isLoading: dashboardLoading } = useHotSetDashboard(selectedSessionId, {
    pollingInterval: selectedSessionId ? 30000 : undefined, // Poll every 30s when active
  });

  // Mutations
  const createSession = useCreateHotSetSession(projectId);
  const startSession = useStartHotSetSession();
  const wrapSession = useWrapHotSetSession();
  const startScene = useStartScene();
  const completeScene = useCompleteScene();
  const skipScene = useSkipScene();
  const addMarker = useAddMarker();

  // Task hooks
  const { taskLists } = useTaskLists({ projectId });
  const { createTaskFromSource } = useCreateTaskFromSource(projectId, selectedTaskListId);

  // Auto-select ONLY if there's an active (in_progress) session - otherwise show all days
  useEffect(() => {
    if (sessions && sessions.length > 0 && !selectedSessionId) {
      // Only auto-select if there's an active session in progress
      const activeSession = sessions.find((s) => s.status === 'in_progress');
      if (activeSession) {
        setSelectedSessionId(activeSession.id);
      }
      // Don't auto-select otherwise - let user see all production days
    }
  }, [sessions, selectedSessionId]);

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

  const handleStartSession = async () => {
    if (!selectedSessionId) return;
    await startSession.mutateAsync(selectedSessionId);
  };

  const handleWrapSession = async () => {
    if (!selectedSessionId) return;
    if (window.confirm('Are you sure you want to wrap the day?')) {
      await wrapSession.mutateAsync(selectedSessionId);
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

  // Loading state
  if (daysLoading || sessionsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const session = dashboard?.session;
  const isActive = session?.status === 'in_progress';
  const isWrapped = session?.status === 'wrapped';
  const scheduleStatus = dashboard?.schedule_status;
  const timeStats = dashboard?.time_stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading text-bone-white flex items-center gap-2">
            <Flame className="w-6 h-6 text-accent-yellow" />
            Production Day
          </h2>
          <p className="text-muted-gray text-sm">Real-time shoot day management</p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTipsPanel(true)}
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <HelpCircle className="w-4 h-4 mr-1" />
            Tips
          </Button>
          {/* View All Days Button - Always visible when a session is selected */}
          {selectedSessionId && (
            <Button
              variant="outline"
              onClick={() => setSelectedSessionId(null)}
              className="border-muted-gray/30"
            >
              <Calendar className="w-4 h-4 mr-2" />
              All Days
            </Button>
          )}

          {/* Session Selector */}
          {sessions && sessions.length > 0 && selectedSessionId && (
            <Select value={selectedSessionId || ''} onValueChange={setSelectedSessionId}>
              <SelectTrigger className="w-48 bg-charcoal-black border-muted-gray/30">
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((s) => {
                  const day = s.backlot_production_days;
                  return (
                    <SelectItem key={s.id} value={s.id}>
                      Day {day?.day_number || '?'} - {s.status}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}

          {/* Create New Session */}
          {canEdit && availableDays.length > 0 && selectedSessionId && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Day
            </Button>
          )}
        </div>
      </div>

      {/* No Session Selected - Show Production Days */}
      {!selectedSessionId && (
        <div className="space-y-6">
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
                          'flex items-center gap-4 p-4 rounded-lg border transition-all cursor-pointer',
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
                            setSelectedSessionId(existingSession.id);
                          } else if (!day.is_completed && canEdit) {
                            setNewSessionDayId(day.id);
                            setShowCreateModal(true);
                          }
                        }}
                      >
                        {/* Day Number */}
                        <div
                          className={cn(
                            'flex-shrink-0 w-14 h-14 rounded-lg flex flex-col items-center justify-center font-bold',
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
                          <span className="text-xl">{day.day_number}</span>
                        </div>

                        {/* Day Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-bone-white">
                              {parseLocalDate(day.date).toLocaleDateString('en-US', {
                                weekday: 'long',
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
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Completed
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-gray">
                            {day.title && <span>{day.title}</span>}
                            {day.general_call_time && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Call: {day.general_call_time}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Session Status */}
                        <div className="flex items-center gap-2">
                          {hasSession ? (
                            <>
                              <Badge
                                className={cn(
                                  'capitalize',
                                  existingSession?.status === 'in_progress' &&
                                    'bg-green-500/20 text-green-400 border-green-500/30',
                                  existingSession?.status === 'wrapped' &&
                                    'bg-blue-500/20 text-blue-400 border-blue-500/30',
                                  existingSession?.status === 'pending' &&
                                    'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                                )}
                              >
                                {existingSession?.status === 'in_progress' && <Play className="w-3 h-3 mr-1" />}
                                {existingSession?.status === 'wrapped' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                                {existingSession?.status?.replace('_', ' ')}
                              </Badge>
                              <ChevronRight className="w-5 h-5 text-muted-gray" />
                            </>
                          ) : !day.is_completed && canEdit ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-accent-yellow/30 text-accent-yellow hover:bg-accent-yellow/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setNewSessionDayId(day.id);
                                setShowCreateModal(true);
                              }}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Start Day
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
          {/* Status Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Schedule Status */}
            <Card
              className={cn('bg-soft-black', getScheduleStatusBgColor(scheduleStatus?.status || 'on_time'))}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-gray uppercase">Schedule</p>
                    <p
                      className={cn('text-2xl font-bold', getScheduleStatusColor(scheduleStatus?.status || 'on_time'))}
                    >
                      {scheduleStatus?.status === 'ahead' && '+'}
                      {scheduleStatus?.variance_minutes || 0}m
                    </p>
                  </div>
                  <Badge
                    className={cn(
                      'capitalize',
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
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-gray uppercase">Elapsed</p>
                    <p className="text-2xl font-bold text-bone-white">
                      {formatElapsedTime(timeStats?.elapsed_minutes || 0)}
                    </p>
                  </div>
                  <Clock className="w-6 h-6 text-muted-gray" />
                </div>
              </CardContent>
            </Card>

            {/* Progress */}
            <Card className="bg-soft-black border-muted-gray/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-gray uppercase">Progress</p>
                  <span className="text-sm text-bone-white">
                    {scheduleStatus?.scenes_completed || 0}/{scheduleStatus?.scenes_total || 0}
                  </span>
                </div>
                <Progress value={scheduleStatus?.percent_complete || 0} className="h-2" />
              </CardContent>
            </Card>

            {/* Day Type */}
            <Card className="bg-soft-black border-muted-gray/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-gray uppercase">Day Type</p>
                    <p className="text-2xl font-bold text-bone-white">{session?.day_type || '10hr'}</p>
                  </div>
                  <Timer className="w-6 h-6 text-muted-gray" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Current Scene - Large */}
            <div className="lg:col-span-2">
              <Card className="bg-soft-black border-accent-yellow/30">
                <CardHeader className="border-b border-muted-gray/20">
                  <CardTitle className="flex items-center gap-2">
                    <Clapperboard className="w-5 h-5 text-accent-yellow" />
                    {dashboard.current_scene ? 'Now Shooting' : 'Ready to Start'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {dashboard.current_scene ? (
                    <div className="text-center space-y-4">
                      <div>
                        <span className="text-6xl font-bold text-accent-yellow">
                          {dashboard.current_scene.scene_number || 'Scene'}
                        </span>
                        {dashboard.current_scene.int_ext && (
                          <Badge variant="outline" className="ml-3 text-lg">
                            {dashboard.current_scene.int_ext}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xl text-bone-white">
                        {dashboard.current_scene.set_name || dashboard.current_scene.description}
                      </p>

                      {/* Timer */}
                      <div className="py-6">
                        <LiveTimer startTime={dashboard.current_scene.actual_start_time} />
                        <p className="text-sm text-muted-gray mt-2">
                          Est: {dashboard.current_scene.estimated_minutes || 30} min
                        </p>
                      </div>

                      {/* Controls */}
                      {canEdit && (
                        <div className="flex justify-center gap-4">
                          <Button
                            size="lg"
                            onClick={() => handleCompleteScene(dashboard.current_scene!.id)}
                            disabled={completeScene.isPending}
                            className="bg-green-600 hover:bg-green-500 text-white"
                          >
                            <CheckCircle2 className="w-5 h-5 mr-2" />
                            Complete Scene
                          </Button>
                          <Button
                            size="lg"
                            variant="outline"
                            onClick={() => handleSkipScene(dashboard.current_scene!.id)}
                            disabled={skipScene.isPending}
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                          >
                            <SkipForward className="w-5 h-5 mr-2" />
                            Skip
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
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
                            Wrapped at {formatTime(session?.actual_wrap_time || null)}
                          </p>
                        </div>
                      ) : dashboard.next_scenes.length > 0 ? (
                        <>
                          <p className="text-muted-gray mb-4">No scene in progress</p>
                          {canEdit && (
                            <Button
                              size="lg"
                              onClick={() => handleStartScene(dashboard.next_scenes[0].id)}
                              disabled={startScene.isPending}
                              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                            >
                              <Play className="w-5 h-5 mr-2" />
                              Start Next Scene
                            </Button>
                          )}
                        </>
                      ) : (
                        <p className="text-muted-gray">All scenes completed</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Action Buttons */}
              {canEdit && isActive && (
                <div className="flex gap-3 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowMarkerModal(true)}
                    className="flex-1"
                  >
                    <Flag className="w-4 h-4 mr-2" />
                    Add Marker
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleOpenTaskModal}
                    className="flex-1"
                  >
                    <ListTodo className="w-4 h-4 mr-2" />
                    Create Task
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleWrapSession}
                    disabled={wrapSession.isPending}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Wrap Day
                  </Button>
                </div>
              )}
            </div>

            {/* Scene Queue */}
            <div className="space-y-4">
              {/* Up Next */}
              <Card className="bg-soft-black border-muted-gray/20">
                <CardHeader className="py-3 border-b border-muted-gray/20">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ChevronRight className="w-4 h-4" />
                    Up Next ({dashboard.next_scenes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-2 max-h-64 overflow-y-auto">
                  {dashboard.next_scenes.length === 0 ? (
                    <p className="text-sm text-muted-gray text-center py-4">No scenes queued</p>
                  ) : (
                    dashboard.next_scenes.slice(0, 5).map((scene, idx) => (
                      <SceneCard
                        key={scene.id}
                        scene={scene}
                        canEdit={canEdit && isActive && idx === 0}
                        onStart={idx === 0 ? () => handleStartScene(scene.id) : undefined}
                        isPending={startScene.isPending}
                      />
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Completed */}
              <Card className="bg-soft-black border-muted-gray/20">
                <CardHeader className="py-3 border-b border-muted-gray/20">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    Completed ({dashboard.completed_scenes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-2 max-h-48 overflow-y-auto">
                  {dashboard.completed_scenes.length === 0 ? (
                    <p className="text-sm text-muted-gray text-center py-4">No scenes completed yet</p>
                  ) : (
                    dashboard.completed_scenes.slice(-5).reverse().map((scene) => (
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
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* Create Session Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-soft-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle>Create Production Day Session</DialogTitle>
            <DialogDescription>
              Set up a new session to track your shoot day in real-time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Production Day</Label>
              <Select value={newSessionDayId} onValueChange={setNewSessionDayId}>
                <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {availableDays.map((day) => (
                    <SelectItem key={day.id} value={day.id}>
                      Day {day.day_number} - {parseLocalDate(day.date).toLocaleDateString()}
                      {day.title && ` - ${day.title}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Day Type</Label>
              <Select
                value={newSessionDayType}
                onValueChange={(v) => setNewSessionDayType(v as HotSetDayType)}
              >
                <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4hr">Half Day (4hr)</SelectItem>
                  <SelectItem value="8hr">8 Hour Day</SelectItem>
                  <SelectItem value="10hr">10 Hour Day</SelectItem>
                  <SelectItem value="12hr">12 Hour Day</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-gray mt-1">Used for OT threshold calculations</p>
            </div>

            {dayCallSheets.length > 0 && (
              <div>
                <Label>Import from Call Sheet (optional)</Label>
                <Select value={newSessionCallSheetId} onValueChange={setNewSessionCallSheetId}>
                  <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                    <SelectValue placeholder="Select call sheet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Don't import</SelectItem>
                    {dayCallSheets.map((cs) => (
                      <SelectItem key={cs.id} value={cs.id}>
                        {cs.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-gray mt-1">Import scenes from call sheet</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSession}
              disabled={!newSessionDayId || createSession.isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              Create Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
};

export default HotSetView;
