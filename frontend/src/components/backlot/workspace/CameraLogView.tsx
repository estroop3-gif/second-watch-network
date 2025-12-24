/**
 * CameraLogView - Quick camera take logging for 1st AC / 2nd AC
 * Painless camera notes that are faster than writing by hand
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import {
  Aperture,
  Star,
  Check,
  ChevronDown,
  ChevronRight,
  Trash2,
  HardDrive,
  StickyNote,
  Calendar,
  Plus,
  ArrowRight,
  X,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCameraLogs,
  useCreateCameraLog,
  useDeleteCameraLog,
  useToggleCircleTake,
  useCameraSettings,
  useNextTakeNumber,
  SHOT_TYPES,
  getLastUsedSettings,
  saveLastUsedSettings,
  CameraLogItem,
} from '@/hooks/backlot/useCameraLog';
import { useProductionDays } from '@/hooks/backlot';
import { useCallSheets } from '@/hooks/backlot';
import { useScenesList } from '@/hooks/backlot/useSceneView';
import {
  useCameraMedia,
  useCreateCameraMedia,
  useUpdateCameraMedia,
  useDeleteCameraMedia,
  CameraMediaItem,
  useContinuityNotes,
  useCreateContinuityNote,
  useDeleteContinuityNote,
  ContinuityNoteItem,
} from '@/hooks/backlot';
import { useToast } from '@/hooks/use-toast';
import { generateCameraLogPdf } from './camera-log-pdf';

// Department options for continuity notes
const DEPARTMENTS = [
  { value: 'general', label: 'General', color: 'bg-muted-gray' },
  { value: 'script', label: 'Script', color: 'bg-blue-500' },
  { value: 'wardrobe', label: 'Wardrobe', color: 'bg-purple-500' },
  { value: 'makeup', label: 'Makeup', color: 'bg-pink-500' },
  { value: 'hair', label: 'Hair', color: 'bg-orange-500' },
  { value: 'props', label: 'Props', color: 'bg-green-500' },
  { value: 'art', label: 'Art', color: 'bg-yellow-500' },
];

interface CameraLogViewProps {
  projectId: string;
  canEdit: boolean;
}

export default function CameraLogView({ projectId, canEdit }: CameraLogViewProps) {
  const { toast } = useToast();

  // Production day selection
  const { data: productionDays, isLoading: loadingDays } = useProductionDays(projectId);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  // Form state
  const [selectedCamera, setSelectedCamera] = useState('A');
  const [sceneNumber, setSceneNumber] = useState('');
  const [shotType, setShotType] = useState('');
  const [lens, setLens] = useState('');
  const [iris, setIris] = useState('');
  const [filter, setFilter] = useState('');
  const [focusDistance, setFocusDistance] = useState('');
  const [notes, setNotes] = useState('');
  const [isCircleTake, setIsCircleTake] = useState(false);

  // Collapsible sections
  const [mediaOpen, setMediaOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  // Media card state
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCardLabel, setNewCardLabel] = useState('');
  const [newCardCamera, setNewCardCamera] = useState('A');
  const [newCardCapacity, setNewCardCapacity] = useState('512');

  // Data hooks
  const { data: settings } = useCameraSettings(projectId);
  const { data: logs, isLoading: loadingLogs } = useCameraLogs(projectId, {
    productionDayId: selectedDayId || undefined,
    limit: 50,
  });
  const { data: nextTake } = useNextTakeNumber(projectId, sceneNumber, shotType, selectedCamera);

  // Mutations
  const createLog = useCreateCameraLog(projectId);
  const deleteLog = useDeleteCameraLog(projectId);
  const toggleCircle = useToggleCircleTake(projectId);

  // Call sheets for scene dropdown
  const { data: callSheets } = useCallSheets(projectId);

  // Scenes list from scene tab
  const { data: scenesList } = useScenesList(projectId);

  // Media card hooks
  const { data: mediaCards, isLoading: loadingMedia } = useCameraMedia(projectId);
  const createMedia = useCreateCameraMedia(projectId);
  const updateMedia = useUpdateCameraMedia(projectId);
  const deleteMedia = useDeleteCameraMedia(projectId);

  // Continuity notes hooks
  const { data: continuityNotes, isLoading: loadingNotes } = useContinuityNotes(projectId);
  const createNote = useCreateContinuityNote(projectId);
  const deleteNote = useDeleteContinuityNote(projectId);

  // Notes form state
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNoteScene, setNewNoteScene] = useState('');
  const [newNoteDepartment, setNewNoteDepartment] = useState<string>('general');
  const [newNoteText, setNewNoteText] = useState('');

  // PDF generation state
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Get all scenes from the project's scene tab
  const allScenes = useMemo(() => {
    if (!scenesList || scenesList.length === 0) return [];
    // Sort scenes naturally (1, 2, 3, 10, 11 instead of 1, 10, 11, 2, 3)
    return [...scenesList]
      .sort((a, b) => {
        const aNum = parseFloat(a.scene_number.replace(/[^\d.]/g, '')) || 0;
        const bNum = parseFloat(b.scene_number.replace(/[^\d.]/g, '')) || 0;
        return aNum - bNum;
      })
      .map(s => s.scene_number);
  }, [scenesList]);

  // Auto-select today's production day
  useEffect(() => {
    if (productionDays && productionDays.length > 0 && !selectedDayId) {
      const today = new Date().toISOString().split('T')[0];
      const todayDay = productionDays.find(d => d.shoot_date === today);
      if (todayDay) {
        setSelectedDayId(todayDay.id);
      } else {
        // Find nearest future day, or most recent past day
        const futureDays = productionDays.filter(d => d.shoot_date >= today).sort((a, b) => a.shoot_date.localeCompare(b.shoot_date));
        const pastDays = productionDays.filter(d => d.shoot_date < today).sort((a, b) => b.shoot_date.localeCompare(a.shoot_date));
        setSelectedDayId(futureDays[0]?.id || pastDays[0]?.id || null);
      }
    }
  }, [productionDays, selectedDayId]);

  // Load last used settings
  useEffect(() => {
    const lastUsed = getLastUsedSettings();
    if (lastUsed.lens) setLens(lastUsed.lens);
    if (lastUsed.iris) setIris(lastUsed.iris);
    if (lastUsed.filter) setFilter(lastUsed.filter);
    if (lastUsed.camera) setSelectedCamera(lastUsed.camera);
  }, []);

  // Get current day info
  const currentDay = productionDays?.find(d => d.id === selectedDayId);

  const handleLogTake = async () => {
    if (!sceneNumber || !shotType) return;

    try {
      await createLog.mutateAsync({
        production_day_id: selectedDayId || undefined,
        scene_number: sceneNumber,
        shot_type: shotType,
        camera_id: selectedCamera,
        lens: lens || undefined,
        iris: iris || undefined,
        filter: filter || undefined,
        focus_distance: focusDistance || undefined,
        is_circle_take: isCircleTake,
        notes: notes || undefined,
      });

      // Save last used settings
      saveLastUsedSettings({ lens, iris, filter, camera: selectedCamera });

      // Reset form for next take (keep scene, shot, camera settings)
      setNotes('');
      setIsCircleTake(false);
      setFocusDistance('');
    } catch (err) {
      console.error('Failed to log take:', err);
    }
  };

  const handleCircleAndLog = async () => {
    setIsCircleTake(true);
    // Small delay to ensure state is set
    setTimeout(() => handleLogTake(), 50);
  };

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('Delete this take?')) return;
    try {
      await deleteLog.mutateAsync(logId);
    } catch (err) {
      console.error('Failed to delete log:', err);
    }
  };

  const handleToggleCircle = async (logId: string, current: boolean) => {
    try {
      await toggleCircle.mutateAsync({ logId, isCircle: !current });
    } catch (err) {
      console.error('Failed to toggle circle:', err);
    }
  };

  // Media card handlers
  const handleAddCard = async () => {
    if (!newCardLabel.trim()) return;

    try {
      await createMedia.mutateAsync({
        media_label: newCardLabel.trim(),
        media_type: 'CFexpress',
        camera: newCardCamera,
        capacity_gb: parseInt(newCardCapacity) || 512,
        status: 'in_camera',
      });

      // Reset form
      setNewCardLabel('');
      setShowAddCard(false);
    } catch (err) {
      console.error('Failed to add media card:', err);
    }
  };

  const handleUpdateCardStatus = async (cardId: string, newStatus: string) => {
    try {
      await updateMedia.mutateAsync({
        mediaId: cardId,
        updates: { status: newStatus },
      });
    } catch (err) {
      console.error('Failed to update card status:', err);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!confirm('Delete this media card?')) return;
    try {
      await deleteMedia.mutateAsync(cardId);
    } catch (err) {
      console.error('Failed to delete card:', err);
    }
  };

  // Continuity notes handlers
  const handleAddNote = async () => {
    if (!newNoteText.trim()) return;

    try {
      await createNote.mutateAsync({
        scene_number: newNoteScene || sceneNumber || 'General',
        department: newNoteDepartment,
        note: newNoteText.trim(),
      });

      // Reset form
      setNewNoteText('');
      setNewNoteScene('');
      setShowAddNote(false);
    } catch (err) {
      console.error('Failed to add note:', err);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return;
    try {
      await deleteNote.mutateAsync(noteId);
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  // PDF download handler
  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      await generateCameraLogPdf(
        logs || [],
        mediaCards || [],
        continuityNotes || [],
        currentDay || null
      );
      toast({ title: 'PDF Downloaded', description: 'Camera report saved successfully' });
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast({
        title: 'PDF Generation Failed',
        description: 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Get department info for display
  const getDepartmentInfo = (dept: string) => {
    return DEPARTMENTS.find(d => d.value === dept) || DEPARTMENTS[0];
  };

  // Get next card label suggestion
  const getNextCardLabel = (camera: string) => {
    const cameraCards = (mediaCards || []).filter((c: CameraMediaItem) => c.camera === camera);
    const highestNum = cameraCards.reduce((max: number, c: CameraMediaItem) => {
      const match = c.media_label?.match(/\d+/);
      const num = match ? parseInt(match[0]) : 0;
      return Math.max(max, num);
    }, 0);
    return `${camera}${String(highestNum + 1).padStart(3, '0')}`;
  };

  // Get status info for display
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'in_camera':
        return { label: 'In Camera', color: 'text-green-400', bg: 'bg-green-500/20', next: 'with_DIT' };
      case 'with_DIT':
        return { label: 'With DIT', color: 'text-yellow-400', bg: 'bg-yellow-500/20', next: 'backed_up' };
      case 'backed_up':
        return { label: 'Backed Up', color: 'text-blue-400', bg: 'bg-blue-500/20', next: 'ready_to_format' };
      case 'ready_to_format':
        return { label: 'Ready to Format', color: 'text-purple-400', bg: 'bg-purple-500/20', next: 'in_camera' };
      case 'archived':
        return { label: 'Archived', color: 'text-muted-gray', bg: 'bg-muted-gray/20', next: null };
      case 'failed':
        return { label: 'FAILED', color: 'text-red-400', bg: 'bg-red-500/20', next: null };
      default:
        return { label: status, color: 'text-muted-gray', bg: 'bg-muted-gray/20', next: null };
    }
  };

  // Cards currently in cameras
  const cardsInCameras = useMemo(() => {
    const result: Record<string, CameraMediaItem | null> = {};
    (settings?.camera_ids || ['A', 'B']).forEach(cam => {
      result[cam] = (mediaCards || []).find(
        (c: CameraMediaItem) => c.camera === cam && c.status === 'in_camera'
      ) || null;
    });
    return result;
  }, [mediaCards, settings?.camera_ids]);

  // Preset button component
  const PresetButton = ({
    value,
    selected,
    onClick,
    className,
  }: {
    value: string;
    selected: boolean;
    onClick: () => void;
    className?: string;
  }) => (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-2 text-sm rounded-lg border transition-colors',
        selected
          ? 'bg-film-red/20 border-film-red text-film-red'
          : 'bg-deep-black/50 border-muted-gray/30 text-bone-white hover:bg-deep-black/80',
        className
      )}
    >
      {value}
    </button>
  );

  if (loadingDays) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Day Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Aperture className="w-6 h-6 text-film-red" />
          <div>
            <h2 className="text-xl font-heading text-bone-white">Camera Log</h2>
            {currentDay && (
              <p className="text-sm text-muted-gray">
                Day {currentDay.day_number} • {new Date(currentDay.shoot_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="border-muted-gray/30 text-muted-gray hover:text-bone-white"
          >
            <Download className="w-4 h-4 mr-2" />
            {isGeneratingPdf ? 'Generating...' : 'PDF'}
          </Button>

          <Select value={selectedDayId || ''} onValueChange={setSelectedDayId}>
            <SelectTrigger className="w-[180px] bg-deep-black/50 border-muted-gray/30">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Select Day" />
            </SelectTrigger>
            <SelectContent>
              {productionDays?.map(day => (
                <SelectItem key={day.id} value={day.id}>
                  Day {day.day_number} - {new Date(day.shoot_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Camera Selector - Prominent toggle buttons */}
      <div className="flex gap-2 justify-center bg-deep-black/30 rounded-xl p-2">
        {(settings?.camera_ids || ['A', 'B']).map(cam => (
          <button
            key={cam}
            onClick={() => setSelectedCamera(cam)}
            className={cn(
              'w-14 h-14 text-xl font-bold rounded-xl transition-all',
              selectedCamera === cam
                ? 'bg-film-red text-bone-white shadow-lg scale-105'
                : 'bg-deep-black/50 text-muted-gray hover:bg-deep-black/80'
            )}
          >
            {cam}
          </button>
        ))}
      </div>

      {/* Quick Log Form */}
      <Card className="bg-deep-black/50 border-muted-gray/30">
        <CardContent className="pt-4 space-y-4">
          {/* Scene / Shot / Take Row */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-muted-gray text-xs">SCENE</Label>
              <Select value={sceneNumber} onValueChange={setSceneNumber}>
                <SelectTrigger className="bg-deep-black/50 border-muted-gray/30 mt-1">
                  <SelectValue placeholder="Scene" />
                </SelectTrigger>
                <SelectContent>
                  {allScenes.length > 0 ? (
                    allScenes.map((scene: string) => (
                      <SelectItem key={scene} value={scene}>{scene}</SelectItem>
                    ))
                  ) : (
                    // Manual entry fallback
                    <>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              {/* Also allow custom input */}
              <Input
                value={sceneNumber}
                onChange={e => setSceneNumber(e.target.value)}
                placeholder="or type..."
                className="mt-1 bg-bone-white border-muted-gray/20 text-sm text-charcoal-black placeholder:text-muted-gray"
              />
            </div>

            <div>
              <Label className="text-muted-gray text-xs">SHOT</Label>
              <Select value={shotType} onValueChange={setShotType}>
                <SelectTrigger className="bg-deep-black/50 border-muted-gray/30 mt-1">
                  <SelectValue placeholder="Shot" />
                </SelectTrigger>
                <SelectContent>
                  {SHOT_TYPES.map(shot => (
                    <SelectItem key={shot.value} value={shot.value}>
                      {shot.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-muted-gray text-xs">TAKE</Label>
              <div className="mt-1 h-10 flex items-center justify-center bg-deep-black/70 rounded-md border border-muted-gray/30">
                <span className="text-2xl font-bold text-bone-white">
                  {nextTake?.next_take_number || 1}
                </span>
              </div>
            </div>
          </div>

          {/* Camera Settings - Preset Buttons */}
          <div className="grid grid-cols-4 gap-3">
            {/* Lens */}
            <div>
              <Label className="text-muted-gray text-xs">LENS</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {(settings?.lens_presets || ['35mm', '50mm', '85mm']).slice(0, 3).map(l => (
                  <PresetButton
                    key={l}
                    value={l}
                    selected={lens === l}
                    onClick={() => setLens(l)}
                  />
                ))}
              </div>
              <Input
                value={lens}
                onChange={e => setLens(e.target.value)}
                placeholder="mm"
                className="mt-1 bg-bone-white border-muted-gray/20 text-sm text-charcoal-black placeholder:text-muted-gray"
              />
            </div>

            {/* Iris */}
            <div>
              <Label className="text-muted-gray text-xs">IRIS</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {(settings?.iris_presets || ['2.8', '4', '5.6']).slice(0, 3).map(i => (
                  <PresetButton
                    key={i}
                    value={i}
                    selected={iris === i}
                    onClick={() => setIris(i)}
                  />
                ))}
              </div>
              <Input
                value={iris}
                onChange={e => setIris(e.target.value)}
                placeholder="T-stop"
                className="mt-1 bg-bone-white border-muted-gray/20 text-sm text-charcoal-black placeholder:text-muted-gray"
              />
            </div>

            {/* Filter */}
            <div>
              <Label className="text-muted-gray text-xs">FILTER</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {(settings?.filter_presets || ['ND.6', 'ND.9', 'Clear']).slice(0, 3).map(f => (
                  <PresetButton
                    key={f}
                    value={f}
                    selected={filter === f}
                    onClick={() => setFilter(f)}
                  />
                ))}
              </div>
              <Input
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Filter"
                className="mt-1 bg-bone-white border-muted-gray/20 text-sm text-charcoal-black placeholder:text-muted-gray"
              />
            </div>

            {/* Focus */}
            <div>
              <Label className="text-muted-gray text-xs">FOCUS</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {["5'", "8'", "∞"].map(f => (
                  <PresetButton
                    key={f}
                    value={f}
                    selected={focusDistance === f}
                    onClick={() => setFocusDistance(f)}
                  />
                ))}
              </div>
              <Input
                value={focusDistance}
                onChange={e => setFocusDistance(e.target.value)}
                placeholder="Distance"
                className="mt-1 bg-bone-white border-muted-gray/20 text-sm text-charcoal-black placeholder:text-muted-gray"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-muted-gray text-xs">NOTES</Label>
            <Input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Quick note..."
              className="mt-1 bg-bone-white border-muted-gray/20 text-charcoal-black placeholder:text-muted-gray"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleCircleAndLog}
              disabled={!sceneNumber || !shotType || createLog.isPending}
              className="flex-1 h-14 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30"
            >
              <Star className="w-5 h-5 mr-2" />
              CIRCLE
            </Button>
            <Button
              onClick={handleLogTake}
              disabled={!sceneNumber || !shotType || createLog.isPending}
              className="flex-1 h-14 bg-film-red hover:bg-film-red/80"
            >
              <Check className="w-5 h-5 mr-2" />
              LOG TAKE
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Takes */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-deep-black/30 rounded-lg hover:bg-deep-black/50">
          <div className="flex items-center gap-2">
            <span className="text-bone-white font-medium">Recent Takes</span>
            <Badge variant="secondary" className="bg-muted-gray/20">
              {logs?.length || 0}
            </Badge>
          </div>
          <ChevronDown className="w-5 h-5 text-muted-gray" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          {loadingLogs ? (
            <div className="space-y-2 mt-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : logs && logs.length > 0 ? (
            <div className="mt-2 space-y-1">
              {logs.map((log: CameraLogItem) => (
                <div
                  key={log.id}
                  className="flex items-center gap-3 p-3 bg-deep-black/20 rounded-lg group"
                >
                  <span className="text-muted-gray font-mono text-sm w-8">{log.camera_id}</span>
                  <span className="text-bone-white font-medium w-16">{log.scene_number}</span>
                  <span className="text-muted-gray w-12">{log.shot_type}</span>
                  <span className="text-bone-white font-mono w-8">T{log.take_number}</span>
                  <span className="text-muted-gray text-sm flex-1 truncate">{log.lens || '-'}</span>
                  <span className="text-muted-gray text-sm flex-1 truncate">{log.notes || ''}</span>
                  <button
                    onClick={() => handleToggleCircle(log.id, log.is_circle_take)}
                    className={cn(
                      'p-1.5 rounded transition-colors',
                      log.is_circle_take
                        ? 'text-yellow-400 bg-yellow-500/20'
                        : 'text-muted-gray hover:text-yellow-400'
                    )}
                  >
                    <Star className="w-4 h-4" fill={log.is_circle_take ? 'currentColor' : 'none'} />
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => handleDeleteLog(log.id)}
                      className="p-1.5 text-muted-gray hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 p-8 text-center text-muted-gray bg-deep-black/20 rounded-lg">
              No takes logged yet. Start logging!
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Media Cards Section */}
      <Collapsible open={mediaOpen} onOpenChange={setMediaOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-deep-black/30 rounded-lg hover:bg-deep-black/50">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-muted-gray" />
            <span className="text-bone-white font-medium">Media Cards</span>
            <Badge variant="secondary" className="bg-muted-gray/20">
              {mediaCards?.length || 0}
            </Badge>
          </div>
          {mediaOpen ? (
            <ChevronDown className="w-5 h-5 text-muted-gray" />
          ) : (
            <ChevronRight className="w-5 h-5 text-muted-gray" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 space-y-3">
            {/* Current Cards in Cameras */}
            <div className="grid grid-cols-2 gap-2">
              {(settings?.camera_ids || ['A', 'B']).map(cam => {
                const cardInCam = cardsInCameras[cam];
                return (
                  <div
                    key={cam}
                    className={cn(
                      'p-3 rounded-lg border',
                      cardInCam
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-deep-black/30 border-muted-gray/20'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-muted-gray">Camera {cam}</span>
                      {cardInCam && (
                        <button
                          onClick={() => handleUpdateCardStatus(cardInCam.id, 'with_DIT')}
                          className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded hover:bg-yellow-500/30"
                        >
                          Pull Card
                        </button>
                      )}
                    </div>
                    {cardInCam ? (
                      <div className="text-bone-white font-mono text-lg">{cardInCam.media_label}</div>
                    ) : (
                      <div className="text-muted-gray text-sm italic">No card</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add Card Form */}
            {showAddCard ? (
              <div className="p-3 bg-deep-black/40 rounded-lg border border-muted-gray/20 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs text-muted-gray">Card Label</Label>
                    <Input
                      value={newCardLabel}
                      onChange={e => setNewCardLabel(e.target.value)}
                      placeholder={getNextCardLabel(newCardCamera)}
                      className="mt-1 bg-bone-white border-muted-gray/30 text-charcoal-black placeholder:text-muted-gray"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-gray">Camera</Label>
                    <Select value={newCardCamera} onValueChange={setNewCardCamera}>
                      <SelectTrigger className="mt-1 bg-deep-black/50 border-muted-gray/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(settings?.camera_ids || ['A', 'B']).map(cam => (
                          <SelectItem key={cam} value={cam}>{cam}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-gray">Capacity (GB)</Label>
                    <Select value={newCardCapacity} onValueChange={setNewCardCapacity}>
                      <SelectTrigger className="mt-1 bg-deep-black/50 border-muted-gray/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="128">128 GB</SelectItem>
                        <SelectItem value="256">256 GB</SelectItem>
                        <SelectItem value="512">512 GB</SelectItem>
                        <SelectItem value="1024">1 TB</SelectItem>
                        <SelectItem value="2048">2 TB</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleAddCard}
                    disabled={!newCardLabel.trim() || createMedia.isPending}
                    className="flex-1 bg-film-red hover:bg-film-red/80"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Card
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddCard(false)}
                    className="border-muted-gray/30"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setNewCardLabel(getNextCardLabel(selectedCamera));
                  setNewCardCamera(selectedCamera);
                  setShowAddCard(true);
                }}
                className="w-full border-dashed border-muted-gray/30 text-muted-gray hover:text-bone-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Card
              </Button>
            )}

            {/* All Cards List */}
            {loadingMedia ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : mediaCards && mediaCards.length > 0 ? (
              <div className="space-y-1">
                {mediaCards.map((card: CameraMediaItem) => {
                  const statusInfo = getStatusInfo(card.status);
                  return (
                    <div
                      key={card.id}
                      className="flex items-center gap-3 p-2 bg-deep-black/20 rounded-lg group"
                    >
                      <span className="text-muted-gray font-mono text-sm w-6">{card.camera}</span>
                      <span className="text-bone-white font-mono font-medium w-16">{card.media_label}</span>
                      <span className="text-muted-gray text-xs w-16">{card.capacity_gb}GB</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded', statusInfo.bg, statusInfo.color)}>
                        {statusInfo.label}
                      </span>
                      <div className="flex-1" />
                      {statusInfo.next && canEdit && (
                        <button
                          onClick={() => handleUpdateCardStatus(card.id, statusInfo.next!)}
                          className="p-1.5 text-muted-gray hover:text-bone-white transition-colors"
                          title={`Move to ${getStatusInfo(statusInfo.next).label}`}
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => handleDeleteCard(card.id)}
                          className="p-1.5 text-muted-gray hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-muted-gray bg-deep-black/20 rounded-lg">
                No media cards registered yet
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Notes Section (Collapsed) */}
      <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-deep-black/30 rounded-lg hover:bg-deep-black/50">
          <div className="flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-muted-gray" />
            <span className="text-bone-white font-medium">Notes</span>
            <Badge variant="secondary" className="bg-muted-gray/20">
              {continuityNotes?.length || 0}
            </Badge>
          </div>
          {notesOpen ? (
            <ChevronDown className="w-5 h-5 text-muted-gray" />
          ) : (
            <ChevronRight className="w-5 h-5 text-muted-gray" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 space-y-3">
            {/* Add Note Button / Form */}
            {showAddNote ? (
              <div className="p-3 bg-deep-black/40 rounded-lg border border-muted-gray/20 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-gray">Scene</Label>
                    <Select value={newNoteScene} onValueChange={setNewNoteScene}>
                      <SelectTrigger className="mt-1 bg-bone-white border-muted-gray/30 text-charcoal-black">
                        <SelectValue placeholder={sceneNumber || "Scene"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="General">General</SelectItem>
                        {allScenes.map((scene: string) => (
                          <SelectItem key={scene} value={scene}>{scene}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-gray">Department</Label>
                    <Select value={newNoteDepartment} onValueChange={setNewNoteDepartment}>
                      <SelectTrigger className="mt-1 bg-bone-white border-muted-gray/30 text-charcoal-black">
                        <SelectValue placeholder="Department" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map(dept => (
                          <SelectItem key={dept.value} value={dept.value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${dept.color}`} />
                              {dept.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-gray">Note</Label>
                  <textarea
                    value={newNoteText}
                    onChange={e => setNewNoteText(e.target.value)}
                    placeholder="Enter continuity note..."
                    className="mt-1 w-full h-20 px-3 py-2 bg-bone-white border border-muted-gray/30 rounded-md text-charcoal-black placeholder:text-muted-gray text-sm resize-none"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAddNote(false);
                      setNewNoteText('');
                      setNewNoteScene('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAddNote}
                    disabled={!newNoteText.trim() || createNote.isPending}
                    className="bg-primary-red hover:bg-primary-red/80"
                  >
                    {createNote.isPending ? 'Adding...' : 'Add Note'}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddNote(true)}
                className="w-full border-dashed border-muted-gray/30 text-muted-gray hover:text-bone-white"
                disabled={!canEdit}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Note
              </Button>
            )}

            {/* Notes List */}
            {loadingNotes ? (
              <div className="p-4 text-center text-muted-gray">Loading notes...</div>
            ) : continuityNotes && continuityNotes.length > 0 ? (
              <div className="space-y-2">
                {continuityNotes.map((note: ContinuityNoteItem) => {
                  const deptInfo = getDepartmentInfo(note.department);
                  return (
                    <div
                      key={note.id}
                      className="p-3 bg-deep-black/30 rounded-lg border border-muted-gray/20"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={`${deptInfo.color} text-white text-xs`}>
                              {deptInfo.label}
                            </Badge>
                            <span className="text-xs text-muted-gray">
                              Scene {note.scene_number}
                            </span>
                            {note.take_ref && (
                              <span className="text-xs text-muted-gray">
                                • Take {note.take_ref}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-bone-white whitespace-pre-wrap">
                            {note.note}
                          </p>
                          <p className="text-xs text-muted-gray mt-1">
                            {new Date(note.created_at).toLocaleString()}
                          </p>
                        </div>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-muted-gray hover:text-red-400 p-1 h-auto"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-muted-gray bg-deep-black/20 rounded-lg">
                No notes yet
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
