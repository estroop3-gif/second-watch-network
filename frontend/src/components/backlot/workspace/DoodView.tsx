/**
 * DoodView - Day Out of Days Grid
 *
 * Features:
 * - Date range selection
 * - Generate days for range
 * - Subject management (add, edit, delete)
 * - Grid with code cells
 * - Cell editing with popover
 * - Totals display
 * - Publish snapshot
 * - Export CSV
 */
import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Calendar,
  Download,
  Plus,
  Trash2,
  CalendarRange,
  Save,
  FileSpreadsheet,
  RefreshCw,
  Users,
  AlertCircle,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useDoodRange,
  useGenerateDoodDays,
  useCreateDoodSubject,
  useDeleteDoodSubject,
  useUpsertDoodAssignment,
  usePublishDood,
  getDoodExportUrl,
  calculateSubjectTotals,
  getCodeInfo,
  DOOD_CODES,
  SUBJECT_TYPES,
  DoodSubject,
  DoodDay,
  DoodAssignment,
} from '@/hooks/backlot';

interface DoodViewProps {
  projectId: string;
  canEdit: boolean;
}

// Helper to format date for display
function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// Helper to get day of week abbreviation
function getDayOfWeek(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

// Helper to get default date range (today + 13 days)
function getDefaultDateRange(): { start: string; end: string } {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 13);

  return {
    start: today.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

export function DoodView({ projectId, canEdit }: DoodViewProps) {
  // Date range state
  const [dateRange, setDateRange] = useState(getDefaultDateRange);

  // Subject dialog state
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectType, setNewSubjectType] = useState<string>('CAST');
  const [newSubjectDept, setNewSubjectDept] = useState('');

  // Delete confirmation state
  const [deleteSubjectId, setDeleteSubjectId] = useState<string | null>(null);

  // Cell edit state
  const [editingCell, setEditingCell] = useState<{
    subjectId: string;
    dayId: string;
    currentCode: string | null;
    notes: string | null;
  } | null>(null);
  const [cellNotes, setCellNotes] = useState('');

  // Publish dialog state
  const [showPublishDialog, setShowPublishDialog] = useState(false);

  // Queries
  const {
    data: rangeData,
    isLoading,
    error,
    refetch,
  } = useDoodRange(projectId, dateRange.start, dateRange.end);

  // Mutations
  const generateDays = useGenerateDoodDays(projectId);
  const createSubject = useCreateDoodSubject(projectId);
  const deleteSubject = useDeleteDoodSubject(projectId);
  const upsertAssignment = useUpsertDoodAssignment(projectId);
  const publishDood = usePublishDood(projectId);

  // Build assignment lookup map
  const assignmentMap = useMemo(() => {
    const map = new Map<string, DoodAssignment>();
    if (rangeData?.assignments) {
      for (const a of rangeData.assignments) {
        map.set(`${a.subject_id}:${a.day_id}`, a);
      }
    }
    return map;
  }, [rangeData?.assignments]);

  // Handlers
  const handleGenerateDays = useCallback(async () => {
    try {
      await generateDays.mutateAsync({
        start: dateRange.start,
        end: dateRange.end,
      });
      toast.success('Days generated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate days');
    }
  }, [generateDays, dateRange]);

  const handleAddSubject = useCallback(async () => {
    if (!newSubjectName.trim()) {
      toast.error('Subject name is required');
      return;
    }
    try {
      await createSubject.mutateAsync({
        display_name: newSubjectName.trim(),
        subject_type: newSubjectType,
        department: newSubjectDept.trim() || undefined,
      });
      setNewSubjectName('');
      setNewSubjectType('CAST');
      setNewSubjectDept('');
      setShowAddSubject(false);
      toast.success('Subject added');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add subject');
    }
  }, [createSubject, newSubjectName, newSubjectType, newSubjectDept]);

  const handleDeleteSubject = useCallback(async () => {
    if (!deleteSubjectId) return;
    try {
      await deleteSubject.mutateAsync(deleteSubjectId);
      setDeleteSubjectId(null);
      toast.success('Subject deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete subject');
    }
  }, [deleteSubject, deleteSubjectId]);

  const handleCellClick = useCallback(
    (subject: DoodSubject, day: DoodDay) => {
      if (!canEdit) return;
      const assignment = assignmentMap.get(`${subject.id}:${day.id}`);
      setEditingCell({
        subjectId: subject.id,
        dayId: day.id,
        currentCode: assignment?.code || null,
        notes: assignment?.notes || null,
      });
      setCellNotes(assignment?.notes || '');
    },
    [canEdit, assignmentMap]
  );

  const handleSaveCell = useCallback(
    async (code: string | null) => {
      if (!editingCell) return;
      try {
        await upsertAssignment.mutateAsync({
          subject_id: editingCell.subjectId,
          day_id: editingCell.dayId,
          code,
          notes: cellNotes.trim() || undefined,
        });
        setEditingCell(null);
        setCellNotes('');
      } catch (err: any) {
        toast.error(err.message || 'Failed to save');
      }
    },
    [upsertAssignment, editingCell, cellNotes]
  );

  const handlePublish = useCallback(async () => {
    try {
      const result = await publishDood.mutateAsync({
        start: dateRange.start,
        end: dateRange.end,
      });
      toast.success(`Published version ${result.version_number}`);
      setShowPublishDialog(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish');
    }
  }, [publishDood, dateRange]);

  const handleExport = useCallback(() => {
    const url = getDoodExportUrl(projectId, dateRange.start, dateRange.end);
    // Add auth token to the request
    const token = localStorage.getItem('access_token');
    if (token) {
      // Create a temporary form to submit with auth
      const form = document.createElement('form');
      form.method = 'GET';
      form.action = url;
      form.target = '_blank';

      // For GET request with auth header, we need to fetch and download
      fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((res) => res.blob())
        .then((blob) => {
          const downloadUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `dood_${dateRange.start}_${dateRange.end}.csv`;
          a.click();
          URL.revokeObjectURL(downloadUrl);
        })
        .catch((err) => {
          toast.error('Failed to export CSV');
          console.error(err);
        });
    }
  }, [projectId, dateRange]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-bone-white mb-2">
          Failed to load Day Out of Days
        </h3>
        <p className="text-muted-gray text-center mb-4">
          {(error as Error).message || 'An error occurred'}
        </p>
        <Button onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const days = rangeData?.days || [];
  const subjects = rangeData?.subjects || [];
  const latestVersion = rangeData?.latest_published_version;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-heading text-bone-white">Day Out of Days</h2>
        <p className="text-sm text-muted-gray">
          Track cast and crew availability across your shoot schedule
        </p>
      </div>

      {/* Published Version Banner */}
      {latestVersion && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span className="text-sm text-green-400">
              Latest published: Version {latestVersion.version_number} (
              {new Date(latestVersion.created_at).toLocaleDateString()})
            </span>
          </div>
        </div>
      )}

      {/* Controls */}
      <Card className="bg-white/5 border-white/10">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Date Range */}
            <div className="flex gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs text-muted-gray">Start Date</Label>
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, start: e.target.value }))
                  }
                  className="w-40 bg-white/5 border-white/10"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-gray">End Date</Label>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, end: e.target.value }))
                  }
                  className="w-40 bg-white/5 border-white/10"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 ml-auto">
              {canEdit && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleGenerateDays}
                    disabled={generateDays.isPending}
                    className="gap-2"
                  >
                    <CalendarRange className="w-4 h-4" />
                    Generate Days
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddSubject(true)}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Subject
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowPublishDialog(true)}
                    disabled={days.length === 0}
                    className="gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Publish
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={days.length === 0}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Empty State */}
      {days.length === 0 && subjects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4 border border-white/10 rounded-lg">
          <CalendarRange className="w-12 h-12 text-muted-gray mb-4" />
          <h3 className="text-lg font-medium text-bone-white mb-2">
            No data yet
          </h3>
          <p className="text-muted-gray text-center mb-4">
            Generate days for your date range and add subjects to get started.
          </p>
          {canEdit && (
            <Button onClick={handleGenerateDays} disabled={generateDays.isPending}>
              <CalendarRange className="w-4 h-4 mr-2" />
              Generate Days
            </Button>
          )}
        </div>
      )}

      {/* DOOD Grid */}
      {(days.length > 0 || subjects.length > 0) && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-max">
            <thead>
              <tr>
                {/* Subject header */}
                <th className="sticky left-0 z-20 bg-charcoal-black p-2 text-left text-sm font-medium text-muted-gray border-b border-white/10 min-w-[200px]">
                  Subject
                </th>
                <th className="p-2 text-center text-xs text-muted-gray border-b border-white/10 w-12">
                  Type
                </th>
                <th className="p-2 text-center text-xs text-muted-gray border-b border-white/10 w-16">
                  W
                </th>
                <th className="p-2 text-center text-xs text-muted-gray border-b border-white/10 w-16">
                  H
                </th>
                <th className="p-2 text-center text-xs text-muted-gray border-b border-white/10 w-16">
                  Total
                </th>
                {/* Day headers */}
                {days.map((day) => (
                  <th
                    key={day.id}
                    className="p-2 text-center border-b border-white/10 min-w-[50px]"
                  >
                    <div className="text-xs text-muted-gray">
                      {getDayOfWeek(day.date)}
                    </div>
                    <div className="text-sm font-medium text-bone-white">
                      {formatDateForDisplay(day.date)}
                    </div>
                    {day.day_number && (
                      <div className="text-xs text-muted-gray">D{day.day_number}</div>
                    )}
                  </th>
                ))}
                {canEdit && (
                  <th className="p-2 border-b border-white/10 w-10"></th>
                )}
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject) => {
                const totals = calculateSubjectTotals(
                  subject.id,
                  rangeData?.assignments || []
                );
                return (
                  <tr key={subject.id} className="hover:bg-white/5">
                    {/* Subject name */}
                    <td className="sticky left-0 z-10 bg-charcoal-black p-2 border-b border-white/10">
                      <div className="font-medium text-bone-white">
                        {subject.display_name}
                      </div>
                      {subject.department && (
                        <div className="text-xs text-muted-gray">
                          {subject.department}
                        </div>
                      )}
                    </td>
                    {/* Type badge */}
                    <td className="p-2 text-center border-b border-white/10">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          subject.subject_type === 'CAST' && 'border-blue-500 text-blue-400',
                          subject.subject_type === 'BACKGROUND' && 'border-purple-500 text-purple-400',
                          subject.subject_type === 'CREW' && 'border-green-500 text-green-400',
                          subject.subject_type === 'OTHER' && 'border-gray-500 text-gray-400'
                        )}
                      >
                        {subject.subject_type.charAt(0)}
                      </Badge>
                    </td>
                    {/* Totals */}
                    <td className="p-2 text-center text-sm text-green-400 border-b border-white/10">
                      {totals.work || '-'}
                    </td>
                    <td className="p-2 text-center text-sm text-yellow-400 border-b border-white/10">
                      {totals.hold || '-'}
                    </td>
                    <td className="p-2 text-center text-sm text-bone-white border-b border-white/10">
                      {totals.total || '-'}
                    </td>
                    {/* Day cells */}
                    {days.map((day) => {
                      const assignment = assignmentMap.get(
                        `${subject.id}:${day.id}`
                      );
                      const codeInfo = assignment ? getCodeInfo(assignment.code) : null;
                      const isEditing =
                        editingCell?.subjectId === subject.id &&
                        editingCell?.dayId === day.id;

                      return (
                        <td
                          key={day.id}
                          className="p-1 text-center border-b border-white/10"
                        >
                          <Popover
                            open={isEditing}
                            onOpenChange={(open) => {
                              if (!open) {
                                setEditingCell(null);
                                setCellNotes('');
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <button
                                onClick={() => handleCellClick(subject, day)}
                                className={cn(
                                  'w-10 h-10 rounded text-sm font-bold transition-colors',
                                  codeInfo
                                    ? `${codeInfo.color} text-white`
                                    : 'bg-white/5 text-muted-gray hover:bg-white/10',
                                  canEdit && 'cursor-pointer',
                                  !canEdit && 'cursor-default'
                                )}
                                disabled={!canEdit}
                              >
                                {assignment?.code || ''}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3" align="center">
                              <div className="space-y-3">
                                <div className="text-sm font-medium text-bone-white">
                                  Select Code
                                </div>
                                <div className="grid grid-cols-3 gap-1">
                                  {DOOD_CODES.map((c) => (
                                    <button
                                      key={c.code}
                                      onClick={() => handleSaveCell(c.code)}
                                      className={cn(
                                        'p-2 rounded text-xs font-bold text-white',
                                        c.color,
                                        'hover:opacity-80'
                                      )}
                                    >
                                      {c.code}
                                    </button>
                                  ))}
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Notes</Label>
                                  <Textarea
                                    value={cellNotes}
                                    onChange={(e) => setCellNotes(e.target.value)}
                                    placeholder="Optional notes..."
                                    className="h-16 text-sm"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSaveCell(null)}
                                    className="flex-1"
                                  >
                                    <X className="w-3 h-3 mr-1" />
                                    Clear
                                  </Button>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </td>
                      );
                    })}
                    {/* Delete button */}
                    {canEdit && (
                      <td className="p-2 border-b border-white/10">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteSubjectId(subject.id)}
                          className="h-8 w-8 text-muted-gray hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Code Legend */}
      {(days.length > 0 || subjects.length > 0) && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-gray">
              Code Legend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {DOOD_CODES.map((c) => (
                <div key={c.code} className="flex items-center gap-2">
                  <span
                    className={cn(
                      'w-6 h-6 rounded text-xs font-bold flex items-center justify-center text-white',
                      c.color
                    )}
                  >
                    {c.code}
                  </span>
                  <span className="text-sm text-muted-gray">{c.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Subject Dialog */}
      <Dialog open={showAddSubject} onOpenChange={setShowAddSubject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Subject</DialogTitle>
            <DialogDescription>
              Add a cast member, crew member, or other subject to track in the DOOD.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="e.g., John Smith"
              />
            </div>
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={newSubjectType} onValueChange={setNewSubjectType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Input
                value={newSubjectDept}
                onChange={(e) => setNewSubjectDept(e.target.value)}
                placeholder="e.g., Camera, Art, Production"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSubject(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSubject} disabled={createSubject.isPending}>
              Add Subject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteSubjectId}
        onOpenChange={(open) => !open && setDeleteSubjectId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subject?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the subject and all their assignments. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSubject}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Publish Dialog */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish DOOD Snapshot</DialogTitle>
            <DialogDescription>
              Create an immutable snapshot of the current DOOD for the date range{' '}
              {dateRange.start} to {dateRange.end}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-gray">
              This will create a new version that can be referenced later. The
              current data will not be locked - you can continue editing after
              publishing.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublishDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handlePublish} disabled={publishDood.isPending}>
              <Save className="w-4 h-4 mr-2" />
              Publish Version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DoodView;
