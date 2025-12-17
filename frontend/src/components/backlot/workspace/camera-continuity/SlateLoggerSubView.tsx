/**
 * SlateLoggerSubView - Slate logging sub-tab
 * Records takes with scene, shot, take number, timecode, and notes
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Plus,
  Clapperboard,
  Search,
  Pencil,
  Trash2,
  Star,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useSlateLogs,
  useCreateSlateLog,
  useUpdateSlateLog,
  useDeleteSlateLog,
  useNextTakeNumber,
  useCameraShotList,
  SlateLogItem,
} from '@/hooks/backlot';
import { useScenes } from '@/hooks/backlot';

interface SlateLoggerSubViewProps {
  projectId: string;
  productionDayId: string | null;
  canEdit: boolean;
}

const SlateLoggerSubView: React.FC<SlateLoggerSubViewProps> = ({
  projectId,
  productionDayId,
  canEdit,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSlate, setEditingSlate] = useState<SlateLogItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string>('');
  const [selectedShotId, setSelectedShotId] = useState<string>('');

  // Queries
  const { data: slates, isLoading } = useSlateLogs(projectId, productionDayId || undefined);
  const { data: scenes } = useScenes(projectId);
  const { data: shots } = useCameraShotList(projectId);
  const { data: nextTakeData } = useNextTakeNumber(
    projectId,
    selectedSceneId || undefined,
    selectedShotId || undefined
  );

  // Mutations
  const createSlate = useCreateSlateLog(projectId);
  const updateSlate = useUpdateSlateLog(projectId);
  const deleteSlate = useDeleteSlateLog(projectId);

  // Form state
  const [formData, setFormData] = useState({
    scene_id: '',
    shot_id: '',
    take_number: 1,
    timecode_in: '',
    timecode_out: '',
    is_circle_take: false,
    notes: '',
    camera: 'A',
    sound_roll: '',
  });

  const resetForm = () => {
    setFormData({
      scene_id: '',
      shot_id: '',
      take_number: 1,
      timecode_in: '',
      timecode_out: '',
      is_circle_take: false,
      notes: '',
      camera: 'A',
      sound_roll: '',
    });
    setSelectedSceneId('');
    setSelectedShotId('');
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleOpenEdit = (slate: SlateLogItem) => {
    setFormData({
      scene_id: slate.scene_id || '',
      shot_id: slate.shot_id || '',
      take_number: slate.take_number,
      timecode_in: slate.timecode_in || '',
      timecode_out: slate.timecode_out || '',
      is_circle_take: slate.is_circle_take,
      notes: slate.notes || '',
      camera: slate.camera || 'A',
      sound_roll: slate.sound_roll || '',
    });
    setSelectedSceneId(slate.scene_id || '');
    setSelectedShotId(slate.shot_id || '');
    setEditingSlate(slate);
  };

  const handleSceneChange = (sceneId: string) => {
    setSelectedSceneId(sceneId);
    setFormData({ ...formData, scene_id: sceneId, shot_id: '' });
    setSelectedShotId('');
  };

  const handleShotChange = (shotId: string) => {
    setSelectedShotId(shotId);
    setFormData({ ...formData, shot_id: shotId });
  };

  // Auto-fill next take number when shot changes
  React.useEffect(() => {
    if (nextTakeData && !editingSlate) {
      setFormData((prev) => ({ ...prev, take_number: nextTakeData.next_take_number }));
    }
  }, [nextTakeData, editingSlate]);

  const handleSubmit = async () => {
    if (!productionDayId) return;

    const payload = {
      project_id: projectId,
      production_day_id: productionDayId,
      scene_id: formData.scene_id || null,
      shot_id: formData.shot_id || null,
      take_number: formData.take_number,
      timecode_in: formData.timecode_in || null,
      timecode_out: formData.timecode_out || null,
      is_circle_take: formData.is_circle_take,
      notes: formData.notes || null,
      camera: formData.camera || null,
      sound_roll: formData.sound_roll || null,
    };

    if (editingSlate) {
      await updateSlate.mutateAsync({
        id: editingSlate.id,
        data: payload,
      });
      setEditingSlate(null);
    } else {
      await createSlate.mutateAsync(payload);
      // Increment take for quick entry
      setFormData((prev) => ({ ...prev, take_number: prev.take_number + 1 }));
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteSlate.mutateAsync(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  const handleToggleCircle = async (slate: SlateLogItem) => {
    await updateSlate.mutateAsync({
      id: slate.id,
      data: { is_circle_take: !slate.is_circle_take },
    });
  };

  // Filter slates
  const filteredSlates = slates?.filter((slate) => {
    if (!searchTerm) return true;
    const scene = scenes?.find((s) => s.id === slate.scene_id);
    const shot = shots?.find((s) => s.id === slate.shot_id);
    return (
      scene?.scene_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shot?.shot_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      slate.notes?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Get shots for selected scene
  const filteredShots = shots?.filter(
    (shot) => !selectedSceneId || shot.scene_id === selectedSceneId
  );

  // Calculate stats
  const stats = {
    total: slates?.length || 0,
    circled: slates?.filter((s) => s.is_circle_take).length || 0,
  };

  if (!productionDayId) {
    return (
      <Card className="bg-soft-black border-muted-gray/20">
        <CardContent className="py-12 text-center">
          <Clapperboard className="w-12 h-12 mx-auto text-muted-gray mb-4" />
          <h3 className="text-bone-white font-medium mb-2">Select a Shoot Day</h3>
          <p className="text-muted-gray text-sm">
            Choose a production day above to log slates
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 gap-3 max-w-xs">
        <Card className="bg-soft-black border-muted-gray/20">
          <CardContent className="py-3 px-4">
            <div className="text-2xl font-bold text-bone-white">{stats.total}</div>
            <div className="text-xs text-muted-gray">Total Takes</div>
          </CardContent>
        </Card>
        <Card className="bg-soft-black border-accent-yellow/20">
          <CardContent className="py-3 px-4">
            <div className="text-2xl font-bold text-accent-yellow">{stats.circled}</div>
            <div className="text-xs text-muted-gray">Circle Takes</div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
          <Input
            placeholder="Search slates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-soft-black border-muted-gray/30"
          />
        </div>
        {canEdit && (
          <Button
            onClick={handleOpenAdd}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Log Slate
          </Button>
        )}
      </div>

      {/* Slate Log Table */}
      <Card className="bg-soft-black border-muted-gray/20 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-muted-gray/20">
              <TableHead className="w-12">Circle</TableHead>
              <TableHead className="w-20">Scene</TableHead>
              <TableHead className="w-20">Shot</TableHead>
              <TableHead className="w-16">Take</TableHead>
              <TableHead className="w-20">Camera</TableHead>
              <TableHead className="w-28">TC In</TableHead>
              <TableHead className="w-28">TC Out</TableHead>
              <TableHead>Notes</TableHead>
              {canEdit && <TableHead className="w-20 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSlates?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 9 : 8} className="text-center py-8">
                  <Clapperboard className="w-8 h-8 mx-auto text-muted-gray mb-2" />
                  <p className="text-muted-gray">No slates logged</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredSlates?.map((slate) => {
                const scene = scenes?.find((s) => s.id === slate.scene_id);
                const shot = shots?.find((s) => s.id === slate.shot_id);
                return (
                  <TableRow
                    key={slate.id}
                    className={cn(
                      'border-muted-gray/20 hover:bg-muted-gray/5',
                      slate.is_circle_take && 'bg-accent-yellow/5'
                    )}
                  >
                    <TableCell>
                      <button
                        onClick={() => canEdit && handleToggleCircle(slate)}
                        disabled={!canEdit}
                        className={cn(
                          'p-1 rounded-full transition-colors',
                          slate.is_circle_take
                            ? 'text-accent-yellow hover:text-accent-yellow/80'
                            : 'text-muted-gray/40 hover:text-muted-gray'
                        )}
                      >
                        <Star
                          className={cn(
                            'w-5 h-5',
                            slate.is_circle_take && 'fill-accent-yellow'
                          )}
                        />
                      </button>
                    </TableCell>
                    <TableCell className="font-mono text-bone-white">
                      {scene?.scene_number || '-'}
                    </TableCell>
                    <TableCell className="font-mono text-bone-white">
                      {shot?.shot_number || '-'}
                    </TableCell>
                    <TableCell className="font-mono font-bold text-bone-white">
                      {slate.take_number}
                    </TableCell>
                    <TableCell className="text-muted-gray">{slate.camera || 'A'}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-gray">
                      {slate.timecode_in || '-'}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-gray">
                      {slate.timecode_out || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-gray max-w-xs truncate">
                      {slate.notes || '-'}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleOpenEdit(slate)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-400 hover:text-red-300"
                            onClick={() => setDeleteConfirmId(slate.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog
        open={showAddModal || !!editingSlate}
        onOpenChange={() => {
          setShowAddModal(false);
          setEditingSlate(null);
          resetForm();
        }}
      >
        <DialogContent className="bg-soft-black border-muted-gray/30 max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSlate ? 'Edit Slate' : 'Log New Slate'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Scene</Label>
                <Select value={formData.scene_id} onValueChange={handleSceneChange}>
                  <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                    <SelectValue placeholder="Select scene" />
                  </SelectTrigger>
                  <SelectContent>
                    {scenes?.map((scene) => (
                      <SelectItem key={scene.id} value={scene.id}>
                        Scene {scene.scene_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Shot</Label>
                <Select value={formData.shot_id} onValueChange={handleShotChange}>
                  <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                    <SelectValue placeholder="Select shot" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredShots?.map((shot) => (
                      <SelectItem key={shot.id} value={shot.id}>
                        {shot.shot_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Take # *</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.take_number}
                  onChange={(e) =>
                    setFormData({ ...formData, take_number: parseInt(e.target.value) || 1 })
                  }
                  className="bg-charcoal-black border-muted-gray/30"
                />
              </div>
              <div>
                <Label>Camera</Label>
                <Select
                  value={formData.camera}
                  onValueChange={(v) => setFormData({ ...formData, camera: v })}
                >
                  <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A Cam</SelectItem>
                    <SelectItem value="B">B Cam</SelectItem>
                    <SelectItem value="C">C Cam</SelectItem>
                    <SelectItem value="D">D Cam</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sound Roll</Label>
                <Input
                  value={formData.sound_roll}
                  onChange={(e) => setFormData({ ...formData, sound_roll: e.target.value })}
                  placeholder="e.g., R1"
                  className="bg-charcoal-black border-muted-gray/30"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Timecode In</Label>
                <Input
                  value={formData.timecode_in}
                  onChange={(e) => setFormData({ ...formData, timecode_in: e.target.value })}
                  placeholder="00:00:00:00"
                  className="bg-charcoal-black border-muted-gray/30 font-mono"
                />
              </div>
              <div>
                <Label>Timecode Out</Label>
                <Input
                  value={formData.timecode_out}
                  onChange={(e) => setFormData({ ...formData, timecode_out: e.target.value })}
                  placeholder="00:00:00:00"
                  className="bg-charcoal-black border-muted-gray/30 font-mono"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={formData.is_circle_take}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_circle_take: checked })
                }
              />
              <Label className="flex items-center gap-2 cursor-pointer">
                <Star
                  className={cn(
                    'w-4 h-4',
                    formData.is_circle_take ? 'text-accent-yellow fill-accent-yellow' : 'text-muted-gray'
                  )}
                />
                Circle Take (Print)
              </Label>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Take notes (good take, NG, etc.)..."
                className="bg-charcoal-black border-muted-gray/30"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                setEditingSlate(null);
                resetForm();
              }}
            >
              {editingSlate ? 'Cancel' : 'Done'}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createSlate.isPending || updateSlate.isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {editingSlate ? 'Save Changes' : 'Log & Next'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="bg-soft-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle>Delete Slate Entry</DialogTitle>
          </DialogHeader>
          <p className="text-muted-gray">
            Are you sure you want to delete this slate entry? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteSlate.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SlateLoggerSubView;
