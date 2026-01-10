/**
 * StripboardView - Production schedule planning board
 * Strips derived from ScriptScene assigned to ProductionDays
 */
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Calendar,
  Download,
  Plus,
  Trash2,
  Columns3,
  FileSpreadsheet,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  MoreVertical,
  AlertTriangle,
  Printer,
  Archive,
  Users,
  Clock,
  Film,
  Wand2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  useActiveStripboard,
  useCreateStripboard,
  useStripboardView,
  useGenerateStripsFromScript,
  useCreateStrip,
  useUpdateStrip,
  useDeleteStrip,
  useReorderStrip,
  getStripboardExportUrl,
  Strip,
  DayColumn,
  STRIP_UNITS,
  STRIP_STATUSES,
} from '@/hooks/backlot';

interface StripboardViewProps {
  projectId: string;
  canEdit: boolean;
}

// =====================================================
// Helper Functions
// =====================================================

function getDefaultDateRange(): { start: string; end: string } {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 13);
  return {
    start: today.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return format(date, 'MMM d');
}

function getDayOfWeek(dateStr: string): string {
  const date = new Date(dateStr);
  return format(date, 'EEE');
}

function getStatusBadgeColor(status: string): string {
  switch (status) {
    case 'SHOT':
      return 'bg-green-500';
    case 'SCHEDULED':
      return 'bg-blue-500';
    case 'DROPPED':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
}

function getUnitBadgeColor(unit: string): string {
  switch (unit) {
    case 'A':
      return 'bg-accent-yellow text-charcoal-black';
    case 'B':
      return 'bg-purple-500 text-white';
    default:
      return 'bg-gray-400 text-white';
  }
}

// =====================================================
// Strip Card Component
// =====================================================

interface StripCardProps {
  strip: Strip;
  stripboardId: string;
  projectId: string;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
  allDays: DayColumn[];
  onEdit: (strip: Strip) => void;
}

function StripCard({
  strip,
  stripboardId,
  projectId,
  canEdit,
  isFirst,
  isLast,
  allDays,
  onEdit,
}: StripCardProps) {
  const updateStrip = useUpdateStrip(projectId);
  const deleteStrip = useDeleteStrip(projectId);
  const reorderStrip = useReorderStrip(projectId);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const title = strip.scene_number
    ? `${strip.scene_number}. ${strip.slugline || ''}`
    : strip.custom_title || 'Untitled';

  const handleMoveUp = async () => {
    try {
      await reorderStrip.mutateAsync({
        stripboardId,
        stripId: strip.id,
        direction: 'UP',
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to move strip');
    }
  };

  const handleMoveDown = async () => {
    try {
      await reorderStrip.mutateAsync({
        stripboardId,
        stripId: strip.id,
        direction: 'DOWN',
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to move strip');
    }
  };

  const handleAssignDay = async (dayId: string) => {
    try {
      await updateStrip.mutateAsync({
        stripboardId,
        stripId: strip.id,
        data: { assigned_day_id: dayId },
      });
      toast.success('Strip assigned');
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign strip');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteStrip.mutateAsync({ stripboardId, stripId: strip.id });
      toast.success('Strip deleted');
      setShowDeleteConfirm(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete strip');
    }
  };

  return (
    <>
      <div className="bg-charcoal-black/50 border border-muted-gray/30 rounded-md p-2 hover:border-accent-yellow/50 transition-colors">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-bone-white truncate">{title}</p>
            {strip.estimated_duration_minutes && (
              <p className="text-xs text-muted-gray flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" />
                {strip.estimated_duration_minutes} min
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <Badge className={cn('text-xs h-5', getUnitBadgeColor(strip.unit))}>
              {strip.unit}
            </Badge>
            <Badge className={cn('text-xs h-5 text-white', getStatusBadgeColor(strip.status))}>
              {strip.status}
            </Badge>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-muted-gray/20">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={handleMoveUp}
                disabled={isFirst}
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={handleMoveDown}
                disabled={isLast}
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onEdit(strip)}>
                  Edit Details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleAssignDay('')}
                  disabled={strip.assigned_day_id === null}
                >
                  Move to Bank
                </DropdownMenuItem>
                {allDays.map((dayCol) => (
                  <DropdownMenuItem
                    key={dayCol.day.id}
                    onClick={() => handleAssignDay(dayCol.day.id)}
                    disabled={strip.assigned_day_id === dayCol.day.id}
                  >
                    {formatDateShort(dayCol.day.date)} - {dayCol.day.day_type}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-400"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete Strip
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Strip</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this strip? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// =====================================================
// Bank Column Component
// =====================================================

interface BankColumnProps {
  strips: Strip[];
  stripboardId: string;
  projectId: string;
  canEdit: boolean;
  allDays: DayColumn[];
  onEditStrip: (strip: Strip) => void;
}

function BankColumn({ strips, stripboardId, projectId, canEdit, allDays, onEditStrip }: BankColumnProps) {
  return (
    <div className="flex-shrink-0 w-64 bg-muted-gray/5 border border-muted-gray/30 rounded-lg">
      <div className="p-3 border-b border-muted-gray/30 bg-muted-gray/10">
        <div className="flex items-center gap-2">
          <Archive className="w-4 h-4 text-muted-gray" />
          <h3 className="font-medium text-bone-white">Bank</h3>
          <Badge variant="outline" className="ml-auto text-xs">
            {strips.length}
          </Badge>
        </div>
        <p className="text-xs text-muted-gray mt-1">Unscheduled strips</p>
      </div>
      <ScrollArea className="h-[calc(100vh-380px)]">
        <div className="p-2 space-y-2">
          {strips.length === 0 ? (
            <p className="text-xs text-muted-gray text-center py-4">No unscheduled strips</p>
          ) : (
            strips.map((strip, idx) => (
              <StripCard
                key={strip.id}
                strip={strip}
                stripboardId={stripboardId}
                projectId={projectId}
                canEdit={canEdit}
                isFirst={idx === 0}
                isLast={idx === strips.length - 1}
                allDays={allDays}
                onEdit={onEditStrip}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// =====================================================
// Day Column Component
// =====================================================

interface DayColumnComponentProps {
  dayColumn: DayColumn;
  stripboardId: string;
  projectId: string;
  canEdit: boolean;
  allDays: DayColumn[];
  onEditStrip: (strip: Strip) => void;
  onShowCastMismatch: (dayColumn: DayColumn) => void;
}

function DayColumnComponent({
  dayColumn,
  stripboardId,
  projectId,
  canEdit,
  allDays,
  onEditStrip,
  onShowCastMismatch,
}: DayColumnComponentProps) {
  const { day, strips, cast_mismatch } = dayColumn;

  return (
    <div className="flex-shrink-0 w-64 bg-charcoal-black/30 border border-muted-gray/30 rounded-lg">
      <div className="p-3 border-b border-muted-gray/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-gray">{getDayOfWeek(day.date)}</p>
            <h3 className="font-medium text-bone-white">{formatDateShort(day.date)}</h3>
          </div>
          <div className="flex items-center gap-2">
            {cast_mismatch.has_mismatch && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-amber-400"
                onClick={() => onShowCastMismatch(dayColumn)}
              >
                <AlertTriangle className="w-4 h-4" />
              </Button>
            )}
            <Badge variant="outline" className="text-xs">
              {strips.length}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge
            variant="outline"
            className="text-xs bg-muted-gray/20 text-muted-gray border-muted-gray/30"
          >
            {day.day_type}
          </Badge>
          {day.day_number > 0 && (
            <span className="text-xs text-muted-gray">Day {day.day_number}</span>
          )}
        </div>
      </div>
      <ScrollArea className="h-[calc(100vh-380px)]">
        <div className="p-2 space-y-2">
          {strips.length === 0 ? (
            <p className="text-xs text-muted-gray text-center py-4">No strips</p>
          ) : (
            strips.map((strip, idx) => (
              <StripCard
                key={strip.id}
                strip={strip}
                stripboardId={stripboardId}
                projectId={projectId}
                canEdit={canEdit}
                isFirst={idx === 0}
                isLast={idx === strips.length - 1}
                allDays={allDays}
                onEdit={onEditStrip}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// =====================================================
// Cast Mismatch Modal
// =====================================================

interface CastMismatchModalProps {
  dayColumn: DayColumn | null;
  onClose: () => void;
}

function CastMismatchModal({ dayColumn, onClose }: CastMismatchModalProps) {
  if (!dayColumn) return null;

  const { day, cast_mismatch, derived_cast, dood_work_cast } = dayColumn;

  return (
    <Dialog open={!!dayColumn} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Cast Mismatch - {formatDateShort(day.date)}
          </DialogTitle>
          <DialogDescription>
            Comparison between scenes' characters and DOOD working cast
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {cast_mismatch.needed_but_not_working.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-red-400 mb-2">
                Characters needed but not working ({cast_mismatch.needed_but_not_working.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {cast_mismatch.needed_but_not_working.map((name) => (
                  <Badge key={name} variant="outline" className="text-red-400 border-red-400">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {cast_mismatch.working_but_not_needed.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-amber-400 mb-2">
                Working but not in scenes ({cast_mismatch.working_but_not_needed.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {cast_mismatch.working_but_not_needed.map((name) => (
                  <Badge key={name} variant="outline" className="text-amber-400 border-amber-400">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-muted-gray/30">
            <div>
              <h4 className="text-sm font-medium text-muted-gray mb-2">
                Characters in Scenes ({derived_cast.length})
              </h4>
              <div className="flex flex-wrap gap-1">
                {derived_cast.map((name) => (
                  <Badge key={name} variant="secondary" className="text-xs">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-gray mb-2">
                DOOD Working Cast ({dood_work_cast.length})
              </h4>
              <div className="flex flex-wrap gap-1">
                {dood_work_cast.map((name) => (
                  <Badge key={name} variant="secondary" className="text-xs">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================
// Strip Editor Modal
// =====================================================

interface StripEditorModalProps {
  strip: Strip | null;
  stripboardId: string;
  projectId: string;
  onClose: () => void;
}

function StripEditorModal({ strip, stripboardId, projectId, onClose }: StripEditorModalProps) {
  const updateStrip = useUpdateStrip(projectId);
  const [unit, setUnit] = useState(strip?.unit || 'A');
  const [status, setStatus] = useState(strip?.status || 'PLANNED');
  const [notes, setNotes] = useState(strip?.notes || '');
  const [duration, setDuration] = useState(strip?.estimated_duration_minutes?.toString() || '');
  const [customTitle, setCustomTitle] = useState(strip?.custom_title || '');

  if (!strip) return null;

  const handleSave = async () => {
    try {
      await updateStrip.mutateAsync({
        stripboardId,
        stripId: strip.id,
        data: {
          unit,
          status,
          notes: notes || undefined,
          estimated_duration_minutes: duration ? parseInt(duration) : undefined,
          custom_title: strip.script_scene_id ? undefined : customTitle,
        },
      });
      toast.success('Strip updated');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update strip');
    }
  };

  const title = strip.scene_number
    ? `Scene ${strip.scene_number} - ${strip.slugline || ''}`
    : 'Custom Strip';

  return (
    <Dialog open={!!strip} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Strip</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!strip.script_scene_id && (
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Custom strip title"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STRIP_UNITS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STRIP_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Estimated Duration (minutes)</Label>
            <Input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="30"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Production notes..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateStrip.isPending}>
            {updateStrip.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================
// Create Stripboard Modal
// =====================================================

interface CreateStripboardModalProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

function CreateStripboardModal({ projectId, open, onClose }: CreateStripboardModalProps) {
  const createStripboard = useCreateStripboard(projectId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    try {
      await createStripboard.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
      });
      toast.success('Stripboard created');
      setTitle('');
      setDescription('');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create stripboard');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Stripboard</DialogTitle>
          <DialogDescription>
            Create a new stripboard for schedule planning
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Main Schedule"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={createStripboard.isPending}>
            {createStripboard.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================
// Create Custom Strip Modal
// =====================================================

interface CreateStripModalProps {
  projectId: string;
  stripboardId: string;
  open: boolean;
  onClose: () => void;
}

function CreateStripModal({ projectId, stripboardId, open, onClose }: CreateStripModalProps) {
  const createStrip = useCreateStrip(projectId);
  const [customTitle, setCustomTitle] = useState('');
  const [unit, setUnit] = useState('A');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');

  const handleCreate = async () => {
    if (!customTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    try {
      await createStrip.mutateAsync({
        stripboardId,
        data: {
          custom_title: customTitle.trim(),
          unit,
          estimated_duration_minutes: duration ? parseInt(duration) : undefined,
          notes: notes.trim() || undefined,
        },
      });
      toast.success('Strip created');
      setCustomTitle('');
      setUnit('A');
      setDuration('');
      setNotes('');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create strip');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Custom Strip</DialogTitle>
          <DialogDescription>
            Add a custom strip (company move, meal break, etc.)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Company Move to Location B"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STRIP_UNITS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Duration (min)</Label>
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="30"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={createStrip.isPending}>
            {createStrip.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================
// Main StripboardView Component
// =====================================================

export function StripboardView({ projectId, canEdit }: StripboardViewProps) {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState(getDefaultDateRange);
  const [showCreateStripboard, setShowCreateStripboard] = useState(false);
  const [showCreateStrip, setShowCreateStrip] = useState(false);
  const [editingStrip, setEditingStrip] = useState<Strip | null>(null);
  const [castMismatchDay, setCastMismatchDay] = useState<DayColumn | null>(null);

  // Queries
  const { data: summary, isLoading: loadingSummary } = useActiveStripboard(projectId);
  const stripboard = summary?.stripboard;
  const stripboardId = stripboard?.id;

  const { data: viewData, isLoading: loadingView, refetch } = useStripboardView(
    projectId,
    stripboardId || null,
    dateRange.start,
    dateRange.end
  );

  // Mutations
  const generateStrips = useGenerateStripsFromScript(projectId);

  const handleGenerate = async () => {
    if (!stripboardId) return;
    try {
      const result = await generateStrips.mutateAsync(stripboardId);
      toast.success(`Generated ${result.created} strips, skipped ${result.skipped} existing`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate strips');
    }
  };

  const handleExport = () => {
    if (!stripboardId) return;
    const url = getStripboardExportUrl(projectId, stripboardId, dateRange.start, dateRange.end);
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    if (!stripboardId) return;
    const params = new URLSearchParams();
    params.append('start', dateRange.start);
    params.append('end', dateRange.end);
    navigate(`/backlot/${projectId}/stripboard/${stripboardId}/print?${params.toString()}`);
  };

  // Loading state
  if (loadingSummary) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-heading text-bone-white">Stripboard</h2>
          <p className="text-sm text-muted-gray">Production schedule planning</p>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  // No stripboard - show create prompt
  if (!stripboard) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-heading text-bone-white">Stripboard</h2>
          <p className="text-sm text-muted-gray">Production schedule planning</p>
        </div>

        <Card className="bg-charcoal-black/30 border-muted-gray/30">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-accent-yellow/10 flex items-center justify-center mb-4">
              <Columns3 className="w-8 h-8 text-accent-yellow" />
            </div>
            <h3 className="text-xl font-semibold text-bone-white mb-2">No Stripboard Yet</h3>
            <p className="text-muted-gray text-center max-w-md mb-6">
              Create a stripboard to plan your production schedule. Assign scenes to days and
              track your shooting order.
            </p>
            {canEdit && (
              <Button onClick={() => setShowCreateStripboard(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Stripboard
              </Button>
            )}
          </CardContent>
        </Card>

        <CreateStripboardModal
          projectId={projectId}
          open={showCreateStripboard}
          onClose={() => setShowCreateStripboard(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-heading text-bone-white">{stripboard.title}</h2>
          <p className="text-sm text-muted-gray">
            {summary?.counts.total || 0} strips • {summary?.counts.bank || 0} in bank •{' '}
            {summary?.counts.scheduled || 0} scheduled
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={generateStrips.isPending}
              >
                <Wand2 className="w-4 h-4 mr-2" />
                {generateStrips.isPending ? 'Generating...' : 'Generate from Script'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowCreateStrip(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Custom Strip
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Date Range Controls */}
      <Card className="bg-charcoal-black/30 border-muted-gray/30">
        <CardContent className="py-3">
          <div className="flex items-center gap-4">
            <Calendar className="w-4 h-4 text-muted-gray" />
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-gray">From</Label>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                className="w-40 h-8"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-gray">To</Label>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                className="w-40 h-8"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stripboard Grid */}
      {loadingView ? (
        <div className="flex gap-4">
          <Skeleton className="h-96 w-64 flex-shrink-0" />
          <Skeleton className="h-96 w-64 flex-shrink-0" />
          <Skeleton className="h-96 w-64 flex-shrink-0" />
        </div>
      ) : (
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4">
            {/* Bank Column */}
            <BankColumn
              strips={viewData?.bank_strips || []}
              stripboardId={stripboardId}
              projectId={projectId}
              canEdit={canEdit}
              allDays={viewData?.day_columns || []}
              onEditStrip={setEditingStrip}
            />

            {/* Day Columns */}
            {viewData?.day_columns.map((dayCol) => (
              <DayColumnComponent
                key={dayCol.day.id}
                dayColumn={dayCol}
                stripboardId={stripboardId}
                projectId={projectId}
                canEdit={canEdit}
                allDays={viewData.day_columns}
                onEditStrip={setEditingStrip}
                onShowCastMismatch={setCastMismatchDay}
              />
            ))}

            {/* Empty state for no days */}
            {(!viewData?.day_columns || viewData.day_columns.length === 0) && (
              <div className="flex-1 flex items-center justify-center p-8 border border-dashed border-muted-gray/30 rounded-lg">
                <div className="text-center">
                  <Calendar className="w-8 h-8 text-muted-gray mx-auto mb-2" />
                  <p className="text-muted-gray">No production days in selected range</p>
                  <p className="text-xs text-muted-gray mt-1">
                    Create production days in the Schedule tab
                  </p>
                </div>
              </div>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}

      {/* Modals */}
      <CreateStripboardModal
        projectId={projectId}
        open={showCreateStripboard}
        onClose={() => setShowCreateStripboard(false)}
      />

      {stripboardId && (
        <CreateStripModal
          projectId={projectId}
          stripboardId={stripboardId}
          open={showCreateStrip}
          onClose={() => setShowCreateStrip(false)}
        />
      )}

      {stripboardId && (
        <StripEditorModal
          strip={editingStrip}
          stripboardId={stripboardId}
          projectId={projectId}
          onClose={() => setEditingStrip(null)}
        />
      )}

      <CastMismatchModal
        dayColumn={castMismatchDay}
        onClose={() => setCastMismatchDay(null)}
      />
    </div>
  );
}

export default StripboardView;
