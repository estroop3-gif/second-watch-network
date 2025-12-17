/**
 * ShotListSubView - Shot list and coverage tracker sub-tab
 * Lists planned shots with scene, shot type, framing, description, and status
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
import {
  Plus,
  Camera,
  Search,
  Pencil,
  Trash2,
  GripVertical,
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCameraShotList,
  useCreateShot,
  useUpdateShot,
  useDeleteShot,
  SHOT_STATUSES,
  FRAMING_OPTIONS,
  ShotListItem,
} from '@/hooks/backlot';
import { useScenes } from '@/hooks/backlot';

interface ShotListSubViewProps {
  projectId: string;
  productionDayId: string | null;
  canEdit: boolean;
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  planned: Circle,
  setup: Clock,
  captured: CheckCircle2,
  skipped: XCircle,
};

const STATUS_COLORS: Record<string, string> = {
  planned: 'text-muted-gray border-muted-gray/30',
  setup: 'text-orange-400 border-orange-500/30',
  captured: 'text-green-400 border-green-500/30',
  skipped: 'text-red-400 border-red-500/30',
};

const ShotListSubView: React.FC<ShotListSubViewProps> = ({
  projectId,
  productionDayId,
  canEdit,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingShot, setEditingShot] = useState<ShotListItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Queries
  const { data: shots, isLoading } = useCameraShotList(projectId);
  const { data: scenes } = useScenes(projectId);

  // Mutations
  const createShotMutation = useCreateShot(projectId);
  const updateShotMutation = useUpdateShot(projectId);
  const deleteShotMutation = useDeleteShot(projectId);

  // Form state
  const [formData, setFormData] = useState({
    scene_id: '',
    shot_number: '',
    shot_type: 'master',
    framing: 'ws',
    description: '',
    notes: '',
  });

  const resetForm = () => {
    setFormData({
      scene_id: '',
      shot_number: '',
      shot_type: 'master',
      framing: 'ws',
      description: '',
      notes: '',
    });
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleOpenEdit = (shot: ShotListItem) => {
    setFormData({
      scene_id: shot.scene_id || '',
      shot_number: shot.shot_number,
      shot_type: shot.shot_type,
      framing: shot.framing,
      description: shot.description || '',
      notes: shot.notes || '',
    });
    setEditingShot(shot);
  };

  const handleSubmit = async () => {
    if (!productionDayId) return;

    const payload = {
      project_id: projectId,
      production_day_id: productionDayId,
      scene_id: formData.scene_id || null,
      shot_number: formData.shot_number,
      shot_type: formData.shot_type,
      framing: formData.framing,
      description: formData.description || null,
      notes: formData.notes || null,
    };

    if (editingShot) {
      await updateShotMutation.mutateAsync({
        id: editingShot.id,
        data: payload,
      });
      setEditingShot(null);
    } else {
      await createShotMutation.mutateAsync(payload);
      setShowAddModal(false);
    }
    resetForm();
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteShotMutation.mutateAsync(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  const handleStatusChange = async (shot: ShotListItem, newStatus: string) => {
    await updateShotMutation.mutateAsync({
      id: shot.id,
      data: { status: newStatus },
    });
  };

  // Filter shots
  const filteredShots = shots?.filter((shot) => {
    const matchesSearch =
      !searchTerm ||
      shot.shot_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shot.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || shot.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = {
    total: shots?.length || 0,
    planned: shots?.filter((s) => s.status === 'planned').length || 0,
    captured: shots?.filter((s) => s.status === 'captured').length || 0,
    skipped: shots?.filter((s) => s.status === 'skipped').length || 0,
  };

  if (!productionDayId) {
    return (
      <Card className="bg-soft-black border-muted-gray/20">
        <CardContent className="py-12 text-center">
          <Camera className="w-12 h-12 mx-auto text-muted-gray mb-4" />
          <h3 className="text-bone-white font-medium mb-2">Select a Shoot Day</h3>
          <p className="text-muted-gray text-sm">
            Choose a production day above to manage shot lists
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-soft-black border-muted-gray/20">
          <CardContent className="py-3 px-4">
            <div className="text-2xl font-bold text-bone-white">{stats.total}</div>
            <div className="text-xs text-muted-gray">Total Shots</div>
          </CardContent>
        </Card>
        <Card className="bg-soft-black border-muted-gray/20">
          <CardContent className="py-3 px-4">
            <div className="text-2xl font-bold text-muted-gray">{stats.planned}</div>
            <div className="text-xs text-muted-gray">Planned</div>
          </CardContent>
        </Card>
        <Card className="bg-soft-black border-green-500/20">
          <CardContent className="py-3 px-4">
            <div className="text-2xl font-bold text-green-400">{stats.captured}</div>
            <div className="text-xs text-muted-gray">Captured</div>
          </CardContent>
        </Card>
        <Card className="bg-soft-black border-red-500/20">
          <CardContent className="py-3 px-4">
            <div className="text-2xl font-bold text-red-400">{stats.skipped}</div>
            <div className="text-xs text-muted-gray">Skipped</div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
            <Input
              placeholder="Search shots..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-soft-black border-muted-gray/30"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 bg-soft-black border-muted-gray/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {SHOT_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canEdit && (
          <Button
            onClick={handleOpenAdd}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Shot
          </Button>
        )}
      </div>

      {/* Shot List Table */}
      <Card className="bg-soft-black border-muted-gray/20 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-muted-gray/20">
              <TableHead className="w-8"></TableHead>
              <TableHead className="w-24">Shot #</TableHead>
              <TableHead>Scene</TableHead>
              <TableHead className="w-24">Type</TableHead>
              <TableHead className="w-20">Frame</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-28">Status</TableHead>
              {canEdit && <TableHead className="w-20 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredShots?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 8 : 7} className="text-center py-8">
                  <Camera className="w-8 h-8 mx-auto text-muted-gray mb-2" />
                  <p className="text-muted-gray">No shots found</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredShots?.map((shot, index) => {
                const StatusIcon = STATUS_ICONS[shot.status] || Circle;
                const scene = scenes?.find((s) => s.id === shot.scene_id);
                return (
                  <TableRow
                    key={shot.id}
                    className="border-muted-gray/20 hover:bg-muted-gray/5"
                  >
                    <TableCell className="text-muted-gray">
                      {canEdit && <GripVertical className="w-4 h-4 cursor-grab" />}
                    </TableCell>
                    <TableCell className="font-mono font-medium text-bone-white">
                      {shot.shot_number}
                    </TableCell>
                    <TableCell className="text-muted-gray">
                      {scene ? `${scene.scene_number}` : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-gray capitalize">
                      {shot.shot_type}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs border-muted-gray/30">
                        {shot.framing.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-gray max-w-xs truncate">
                      {shot.description || '-'}
                    </TableCell>
                    <TableCell>
                      {canEdit ? (
                        <Select
                          value={shot.status}
                          onValueChange={(v) => handleStatusChange(shot, v)}
                        >
                          <SelectTrigger
                            className={cn(
                              'w-24 h-7 text-xs border',
                              STATUS_COLORS[shot.status]
                            )}
                          >
                            <StatusIcon className="w-3 h-3 mr-1" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SHOT_STATUSES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge
                          variant="outline"
                          className={cn('text-xs', STATUS_COLORS[shot.status])}
                        >
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {SHOT_STATUSES.find((s) => s.value === shot.status)?.label}
                        </Badge>
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleOpenEdit(shot)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-400 hover:text-red-300"
                            onClick={() => setDeleteConfirmId(shot.id)}
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
        open={showAddModal || !!editingShot}
        onOpenChange={() => {
          setShowAddModal(false);
          setEditingShot(null);
          resetForm();
        }}
      >
        <DialogContent className="bg-soft-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle>{editingShot ? 'Edit Shot' : 'Add Shot'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Shot Number *</Label>
                <Input
                  value={formData.shot_number}
                  onChange={(e) => setFormData({ ...formData, shot_number: e.target.value })}
                  placeholder="e.g., 1A, 2B"
                  className="bg-charcoal-black border-muted-gray/30"
                />
              </div>
              <div>
                <Label>Scene</Label>
                <Select
                  value={formData.scene_id}
                  onValueChange={(v) => setFormData({ ...formData, scene_id: v })}
                >
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
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Shot Type</Label>
                <Select
                  value={formData.shot_type}
                  onValueChange={(v) => setFormData({ ...formData, shot_type: v })}
                >
                  <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="master">Master</SelectItem>
                    <SelectItem value="coverage">Coverage</SelectItem>
                    <SelectItem value="insert">Insert</SelectItem>
                    <SelectItem value="cutaway">Cutaway</SelectItem>
                    <SelectItem value="establishing">Establishing</SelectItem>
                    <SelectItem value="pickup">Pickup</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Framing</Label>
                <Select
                  value={formData.framing}
                  onValueChange={(v) => setFormData({ ...formData, framing: v })}
                >
                  <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FRAMING_OPTIONS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Shot description..."
                className="bg-charcoal-black border-muted-gray/30"
                rows={2}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                className="bg-charcoal-black border-muted-gray/30"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                setEditingShot(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.shot_number || createShotMutation.isPending || updateShotMutation.isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {editingShot ? 'Save Changes' : 'Add Shot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="bg-soft-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle>Delete Shot</DialogTitle>
          </DialogHeader>
          <p className="text-muted-gray">
            Are you sure you want to delete this shot? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteShotMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShotListSubView;
