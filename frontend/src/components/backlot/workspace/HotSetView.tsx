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
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

  // Queries
  const { data: productionDays, isLoading: daysLoading } = useProductionDays(projectId);
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

  // Auto-select active session
  useEffect(() => {
    if (sessions && sessions.length > 0 && !selectedSessionId) {
      // Prefer in_progress session, then most recent
      const activeSession = sessions.find((s) => s.status === 'in_progress');
      const session = activeSession || sessions[0];
      setSelectedSessionId(session.id);
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
          {/* Session Selector */}
          {sessions && sessions.length > 0 && (
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
          {canEdit && availableDays.length > 0 && (
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

      {/* No Session Selected */}
      {!selectedSessionId && (
        <Card className="bg-soft-black border-muted-gray/20">
          <CardContent className="py-12 text-center">
            <Calendar className="w-12 h-12 mx-auto text-muted-gray mb-4" />
            <h3 className="text-lg font-medium text-bone-white mb-2">No Production Day Selected</h3>
            <p className="text-muted-gray mb-4">
              {availableDays.length > 0
                ? 'Create a new production day session to start tracking.'
                : 'All production days have sessions or are completed.'}
            </p>
            {canEdit && availableDays.length > 0 && (
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Session
              </Button>
            )}
          </CardContent>
        </Card>
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
                      Day {day.day_number} - {new Date(day.date).toLocaleDateString()}
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
    </div>
  );
};

export default HotSetView;
