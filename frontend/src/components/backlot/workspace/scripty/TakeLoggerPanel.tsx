/**
 * TakeLoggerPanel - Fast take logging for script supervisors
 *
 * Features:
 * - One-tap take status (Print, Circled, Hold, NG, Wild, MOS)
 * - Timestamped notes per take
 * - Auto-incrementing take numbers
 * - Quick scene linking
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  CheckCircle2,
  Circle,
  AlertCircle,
  XCircle,
  Pause,
  Volume2,
  VolumeX,
  Clock,
  Film,
  Edit,
  Trash2,
  Save,
  X,
  Info,
  Loader2,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useTakes, useCreateTake, useUpdateTake, useDeleteTake, useTakeNotes, useCreateTakeNote } from '@/hooks/backlot/useContinuity';

interface TakeLoggerPanelProps {
  projectId: string;
  sceneId: string | null;
  productionDayId: string | null;
  selectedSceneNumber?: string; // Auto-populated scene number from parent
  canEdit: boolean;
  isRecording: boolean;
  onTakeLogged?: () => void;
}

// Take status configuration
const TAKE_STATUSES = [
  { value: 'ok', label: 'OK', icon: Circle, color: 'text-muted-gray', bgColor: 'bg-muted-gray/20' },
  { value: 'print', label: 'Print', icon: CheckCircle2, color: 'text-green-400', bgColor: 'bg-green-500/20' },
  { value: 'circled', label: 'Circled', icon: CheckCircle2, color: 'text-accent-yellow', bgColor: 'bg-accent-yellow/20' },
  { value: 'hold', label: 'Hold', icon: Pause, color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  { value: 'ng', label: 'NG', icon: XCircle, color: 'text-red-400', bgColor: 'bg-red-500/20' },
  { value: 'wild', label: 'Wild', icon: Volume2, color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  { value: 'mos', label: 'MOS', icon: VolumeX, color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  { value: 'false_start', label: 'FS', icon: AlertCircle, color: 'text-muted-gray', bgColor: 'bg-muted-gray/10' },
];

interface Take {
  id: string;
  scene_number: string;
  take_number: number;
  status: string;
  timecode_in?: string;
  timecode_out?: string;
  notes?: string;
  camera_label?: string;
  setup_label?: string;
  duration_seconds?: number;
  created_at: string;
}

const TakeLoggerPanel: React.FC<TakeLoggerPanelProps> = ({
  projectId,
  sceneId,
  productionDayId,
  selectedSceneNumber,
  canEdit,
  isRecording,
  onTakeLogged,
}) => {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTake, setEditingTake] = useState<Take | null>(null);
  const [newTakeData, setNewTakeData] = useState({
    scene_number: '',
    take_number: 0, // Will use nextTakeNumber as fallback
    status: 'ok',
    timecode_in: '',
    notes: '',
    camera_label: 'A',
    setup_label: '1',
  });
  const [noteText, setNoteText] = useState('');

  // Data hooks
  const { data: takes = [], isLoading: takesLoading, refetch } = useTakes({
    projectId,
    sceneId: sceneId || undefined,
    productionDayId: productionDayId || undefined,
  });

  const createTake = useCreateTake();
  const updateTake = useUpdateTake();
  const deleteTake = useDeleteTake();
  const createNote = useCreateTakeNote();

  // Calculate next take number directly (no useEffect needed)
  const nextTakeNumber = useMemo(() => {
    if (!Array.isArray(takes) || takes.length === 0) return 1;
    const maxTake = Math.max(...takes.map((t: Take) => t.take_number || 0), 0);
    return maxTake + 1;
  }, [takes]);

  // Auto-show add form when recording starts
  useEffect(() => {
    if (isRecording && canEdit) {
      setShowAddForm(true);
      // Set current time as timecode_in
      const now = new Date();
      const timecode = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}:00`;
      setNewTakeData(d => ({ ...d, timecode_in: timecode }));
    }
  }, [isRecording, canEdit]);

  // Quick status update
  const handleQuickStatus = async (takeId: string, status: string) => {
    try {
      await updateTake.mutateAsync({ id: takeId, status });
      toast({ title: `Take marked as ${status.toUpperCase()}` });
      refetch();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update take';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  // Create new take
  const handleCreateTake = async () => {
    // Only require scene selection - productionDayId is optional
    if (!sceneId) {
      toast({
        title: 'Scene Required',
        description: 'Please select a scene from the script panel',
        variant: 'destructive',
      });
      return;
    }

    // Derive scene_number from selected scene or manual entry
    const sceneNumber = selectedSceneNumber || newTakeData.scene_number;
    if (!sceneNumber) {
      toast({
        title: 'Scene Number Required',
        description: 'Could not determine scene number. Please ensure a scene is selected.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const takeNumberToUse = newTakeData.take_number || nextTakeNumber;
      await createTake.mutateAsync({
        project_id: projectId,
        scene_id: sceneId,
        production_day_id: productionDayId || undefined, // Optional now
        scene_number: sceneNumber,
        take_number: takeNumberToUse,
        status: newTakeData.status,
        timecode_in: newTakeData.timecode_in || undefined,
        camera_label: newTakeData.camera_label || undefined,
        setup_label: newTakeData.setup_label || undefined,
        notes: newTakeData.notes || undefined,
      });

      toast({ title: 'Take logged', description: `Take ${takeNumberToUse} for Scene ${sceneNumber}` });
      setShowAddForm(false);
      // Reset form - nextTakeNumber will auto-update from the refetch
      setNewTakeData(d => ({
        ...d,
        take_number: 0, // Will use nextTakeNumber
        notes: '',
        timecode_in: '',
      }));
      refetch();
      onTakeLogged?.();
    } catch (err: unknown) {
      // Extract meaningful error message from backend
      let errorMessage = 'Failed to log take';
      if (err instanceof Error) {
        // Check for response data from API errors
        const errWithResponse = err as Error & { response?: { data?: { detail?: string } } };
        errorMessage = errWithResponse.response?.data?.detail || err.message;
      }
      toast({
        title: 'Failed to Log Take',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  // Add note to take
  const handleAddNote = async (takeId: string) => {
    if (!noteText.trim()) return;

    try {
      await createNote.mutateAsync({
        project_id: projectId,
        take_id: takeId,
        note_text: noteText,
        note_category: 'general',
      });
      toast({ title: 'Note added' });
      setNoteText('');
      refetch();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add note';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  // Delete take
  const handleDeleteTake = async (takeId: string) => {
    if (!confirm('Delete this take?')) return;

    try {
      await deleteTake.mutateAsync({ id: takeId });
      toast({ title: 'Take deleted' });
      refetch();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete take';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  // Get status config
  const getStatusConfig = (status: string) => {
    return TAKE_STATUSES.find(s => s.value === status) || TAKE_STATUSES[0];
  };

  // No scene selected
  if (!sceneId) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-muted-gray">
        <Film className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-sm text-center">Select a scene to log takes</p>
      </div>
    );
  }

  return (
    <div data-testid="take-logger-panel" className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-muted-gray/20 shrink-0">
        <h4 className="text-sm font-medium text-bone-white">Takes</h4>
        {canEdit && (
          <Button
            data-testid="new-take-button"
            size="sm"
            variant={showAddForm ? 'secondary' : 'default'}
            className={cn(
              'h-7 text-xs',
              !showAddForm && 'bg-accent-yellow text-charcoal-black hover:bg-bone-white'
            )}
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? (
              <>
                <X className="w-3 h-3 mr-1" />
                Cancel
              </>
            ) : (
              <>
                <Plus className="w-3 h-3 mr-1" />
                New Take
              </>
            )}
          </Button>
        )}
      </div>

      {/* Add Take Form */}
      {showAddForm && canEdit && (
        <div data-testid="new-take-form" className="p-3 border-b border-muted-gray/20 space-y-2 shrink-0">
          {/* Info banner when no production day selected */}
          {!productionDayId && (
            <Alert className="bg-blue-500/10 border-blue-500/30 py-2">
              <Info className="w-3 h-3 text-blue-400" />
              <AlertDescription className="text-xs text-blue-300">
                No production day selected. Take will be logged without a day reference.
              </AlertDescription>
            </Alert>
          )}

          {/* Scene info */}
          {selectedSceneNumber && (
            <div className="text-xs text-muted-gray flex items-center gap-1">
              <Film className="w-3 h-3" />
              Scene {selectedSceneNumber}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Input
                data-testid="take-number-input"
                placeholder="Take #"
                type="number"
                value={newTakeData.take_number || nextTakeNumber}
                onChange={(e) => setNewTakeData(d => ({ ...d, take_number: parseInt(e.target.value) || nextTakeNumber }))}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Input
                data-testid="camera-label-input"
                placeholder="Cam"
                value={newTakeData.camera_label}
                onChange={(e) => setNewTakeData(d => ({ ...d, camera_label: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Input
                data-testid="setup-label-input"
                placeholder="Setup"
                value={newTakeData.setup_label}
                onChange={(e) => setNewTakeData(d => ({ ...d, setup_label: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Quick Status Buttons */}
          <div data-testid="status-buttons" className="flex flex-wrap gap-1">
            {TAKE_STATUSES.filter(s => s.value !== 'false_start').map((status) => (
              <Button
                key={status.value}
                data-testid={`status-${status.value}`}
                size="sm"
                variant={newTakeData.status === status.value ? 'secondary' : 'ghost'}
                className={cn(
                  'h-7 text-xs px-2',
                  newTakeData.status === status.value && status.bgColor
                )}
                onClick={() => setNewTakeData(d => ({ ...d, status: status.value }))}
                disabled={createTake.isPending}
              >
                <status.icon className={cn('w-3 h-3 mr-1', status.color)} />
                {status.label}
              </Button>
            ))}
          </div>

          <Textarea
            data-testid="take-notes-input"
            placeholder="Notes..."
            value={newTakeData.notes}
            onChange={(e) => setNewTakeData(d => ({ ...d, notes: e.target.value }))}
            className="h-16 text-sm resize-none"
            disabled={createTake.isPending}
          />

          <Button
            data-testid="log-take-button"
            className="w-full bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            onClick={handleCreateTake}
            disabled={createTake.isPending}
          >
            {createTake.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Logging Take...
              </>
            ) : (
              'Log Take'
            )}
          </Button>
        </div>
      )}

      {/* Takes List */}
      <ScrollArea className="flex-1">
        <div data-testid="takes-list" className="p-2 space-y-2">
          {takesLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 bg-muted-gray/10" />
            ))
          ) : takes.length === 0 ? (
            <p className="text-sm text-muted-gray text-center py-4">
              No takes logged yet
            </p>
          ) : (
            takes.map((take: Take) => {
              const statusConfig = getStatusConfig(take.status);
              return (
                <div
                  key={take.id}
                  data-testid={`take-item-${take.take_number}`}
                  className={cn(
                    'bg-soft-black border border-muted-gray/20 rounded-lg p-3',
                    editingTake?.id === take.id && 'ring-2 ring-accent-yellow'
                  )}
                >
                  {/* Take Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-bone-white">
                        Take {take.take_number}
                      </span>
                      <Badge className={cn('text-[10px]', statusConfig.bgColor, statusConfig.color)}>
                        <statusConfig.icon className="w-3 h-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                      {take.camera_label && (
                        <Badge variant="outline" className="text-[10px]">
                          Cam {take.camera_label}
                        </Badge>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <Button
                          data-testid={`delete-take-${take.take_number}`}
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-gray hover:text-red-400"
                          onClick={() => handleDeleteTake(take.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Quick Status Update */}
                  {canEdit && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {TAKE_STATUSES.slice(0, 5).map((status) => (
                        <Button
                          key={status.value}
                          size="sm"
                          variant="ghost"
                          className={cn(
                            'h-5 text-[10px] px-1.5',
                            take.status === status.value && status.bgColor
                          )}
                          onClick={() => handleQuickStatus(take.id, status.value)}
                        >
                          <status.icon className={cn('w-2.5 h-2.5', status.color)} />
                        </Button>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  {take.notes && (
                    <p className="text-xs text-muted-gray mb-2">{take.notes}</p>
                  )}

                  {/* Timecode */}
                  {take.timecode_in && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-gray">
                      <Clock className="w-3 h-3" />
                      {take.timecode_in}
                      {take.duration_seconds && ` (${take.duration_seconds}s)`}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default TakeLoggerPanel;
