/**
 * MediaTrackerSubView - Camera and media tracker sub-tab
 * Tracks camera cards, drives, and media with status tracking
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
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
  HardDrive,
  Search,
  Pencil,
  Trash2,
  Disc,
  Database,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Upload,
  Archive,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCameraMedia,
  useCreateCameraMedia,
  useUpdateCameraMedia,
  useDeleteCameraMedia,
  MEDIA_TYPES,
  MEDIA_STATUSES,
  CameraMediaItem,
} from '@/hooks/backlot';

interface MediaTrackerSubViewProps {
  projectId: string;
  productionDayId: string | null;
  canEdit: boolean;
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  in_camera: { icon: Clock, color: 'text-blue-400 border-blue-500/30 bg-blue-500/10', label: 'In Camera' },
  offloading: { icon: Upload, color: 'text-orange-400 border-orange-500/30 bg-orange-500/10', label: 'Offloading' },
  backed_up: { icon: CheckCircle2, color: 'text-green-400 border-green-500/30 bg-green-500/10', label: 'Backed Up' },
  verified: { icon: CheckCircle2, color: 'text-accent-yellow border-accent-yellow/30 bg-accent-yellow/10', label: 'Verified' },
  archived: { icon: Archive, color: 'text-purple-400 border-purple-500/30 bg-purple-500/10', label: 'Archived' },
  issue: { icon: AlertTriangle, color: 'text-red-400 border-red-500/30 bg-red-500/10', label: 'Issue' },
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  cf_express: Disc,
  sd_card: Disc,
  ssd: HardDrive,
  hdd: HardDrive,
  lto_tape: Database,
  other: HardDrive,
};

const MediaTrackerSubView: React.FC<MediaTrackerSubViewProps> = ({
  projectId,
  productionDayId,
  canEdit,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMedia, setEditingMedia] = useState<CameraMediaItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Queries
  const { data: mediaItems, isLoading } = useCameraMedia(projectId, productionDayId || undefined);

  // Mutations
  const createMedia = useCreateCameraMedia(projectId);
  const updateMedia = useUpdateCameraMedia(projectId);
  const deleteMedia = useDeleteCameraMedia(projectId);

  // Form state
  const [formData, setFormData] = useState({
    media_type: 'cf_express',
    card_label: '',
    camera_id: '',
    capacity_gb: 0,
    used_gb: 0,
    clip_count: 0,
    notes: '',
  });

  const resetForm = () => {
    setFormData({
      media_type: 'cf_express',
      card_label: '',
      camera_id: '',
      capacity_gb: 0,
      used_gb: 0,
      clip_count: 0,
      notes: '',
    });
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleOpenEdit = (media: CameraMediaItem) => {
    setFormData({
      media_type: media.media_type,
      card_label: media.card_label,
      camera_id: media.camera_id || '',
      capacity_gb: media.capacity_gb || 0,
      used_gb: media.used_gb || 0,
      clip_count: media.clip_count || 0,
      notes: media.notes || '',
    });
    setEditingMedia(media);
  };

  const handleSubmit = async () => {
    if (!productionDayId) return;

    const payload = {
      project_id: projectId,
      production_day_id: productionDayId,
      media_type: formData.media_type,
      card_label: formData.card_label,
      camera_id: formData.camera_id || null,
      capacity_gb: formData.capacity_gb || null,
      used_gb: formData.used_gb || null,
      clip_count: formData.clip_count || null,
      notes: formData.notes || null,
    };

    if (editingMedia) {
      await updateMedia.mutateAsync({
        id: editingMedia.id,
        data: payload,
      });
      setEditingMedia(null);
    } else {
      await createMedia.mutateAsync(payload);
      setShowAddModal(false);
    }
    resetForm();
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteMedia.mutateAsync(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  const handleStatusChange = async (media: CameraMediaItem, newStatus: string) => {
    await updateMedia.mutateAsync({
      id: media.id,
      data: { status: newStatus },
    });
  };

  // Filter media
  const filteredMedia = mediaItems?.filter((media) => {
    const matchesSearch =
      !searchTerm ||
      media.card_label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      media.camera_id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || media.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = {
    total: mediaItems?.length || 0,
    inCamera: mediaItems?.filter((m) => m.status === 'in_camera').length || 0,
    backedUp: mediaItems?.filter((m) => m.status === 'backed_up' || m.status === 'verified').length || 0,
    totalCapacity: mediaItems?.reduce((sum, m) => sum + (m.capacity_gb || 0), 0) || 0,
    totalUsed: mediaItems?.reduce((sum, m) => sum + (m.used_gb || 0), 0) || 0,
  };

  if (!productionDayId) {
    return (
      <Card className="bg-soft-black border-muted-gray/20">
        <CardContent className="py-12 text-center">
          <HardDrive className="w-12 h-12 mx-auto text-muted-gray mb-4" />
          <h3 className="text-bone-white font-medium mb-2">Select a Shoot Day</h3>
          <p className="text-muted-gray text-sm">
            Choose a production day above to track camera media
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
            <div className="text-xs text-muted-gray">Total Cards</div>
          </CardContent>
        </Card>
        <Card className="bg-soft-black border-blue-500/20">
          <CardContent className="py-3 px-4">
            <div className="text-2xl font-bold text-blue-400">{stats.inCamera}</div>
            <div className="text-xs text-muted-gray">In Camera</div>
          </CardContent>
        </Card>
        <Card className="bg-soft-black border-green-500/20">
          <CardContent className="py-3 px-4">
            <div className="text-2xl font-bold text-green-400">{stats.backedUp}</div>
            <div className="text-xs text-muted-gray">Backed Up</div>
          </CardContent>
        </Card>
        <Card className="bg-soft-black border-muted-gray/20">
          <CardContent className="py-3 px-4">
            <div className="text-lg font-bold text-bone-white">
              {stats.totalUsed} / {stats.totalCapacity} GB
            </div>
            <div className="text-xs text-muted-gray">Storage Used</div>
            {stats.totalCapacity > 0 && (
              <Progress
                value={(stats.totalUsed / stats.totalCapacity) * 100}
                className="mt-1 h-1"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
            <Input
              placeholder="Search media..."
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
              {MEDIA_STATUSES.map((status) => (
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
            Add Media
          </Button>
        )}
      </div>

      {/* Media Table */}
      <Card className="bg-soft-black border-muted-gray/20 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-muted-gray/20">
              <TableHead className="w-10"></TableHead>
              <TableHead>Card Label</TableHead>
              <TableHead className="w-24">Type</TableHead>
              <TableHead className="w-20">Camera</TableHead>
              <TableHead className="w-32">Capacity</TableHead>
              <TableHead className="w-20">Clips</TableHead>
              <TableHead className="w-32">Status</TableHead>
              {canEdit && <TableHead className="w-20 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMedia?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 8 : 7} className="text-center py-8">
                  <HardDrive className="w-8 h-8 mx-auto text-muted-gray mb-2" />
                  <p className="text-muted-gray">No media tracked</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredMedia?.map((media) => {
                const TypeIcon = TYPE_ICONS[media.media_type] || HardDrive;
                const statusConfig = STATUS_CONFIG[media.status];
                const StatusIcon = statusConfig?.icon || Clock;
                const usagePercent = media.capacity_gb
                  ? ((media.used_gb || 0) / media.capacity_gb) * 100
                  : 0;
                return (
                  <TableRow
                    key={media.id}
                    className="border-muted-gray/20 hover:bg-muted-gray/5"
                  >
                    <TableCell>
                      <TypeIcon className="w-5 h-5 text-muted-gray" />
                    </TableCell>
                    <TableCell className="font-medium text-bone-white">
                      {media.card_label}
                    </TableCell>
                    <TableCell className="text-sm text-muted-gray">
                      {MEDIA_TYPES.find((t) => t.value === media.media_type)?.label}
                    </TableCell>
                    <TableCell className="text-muted-gray">{media.camera_id || '-'}</TableCell>
                    <TableCell>
                      {media.capacity_gb ? (
                        <div className="space-y-1">
                          <div className="text-xs text-muted-gray">
                            {media.used_gb || 0} / {media.capacity_gb} GB
                          </div>
                          <Progress value={usagePercent} className="h-1" />
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-muted-gray">{media.clip_count || '-'}</TableCell>
                    <TableCell>
                      {canEdit ? (
                        <Select
                          value={media.status}
                          onValueChange={(v) => handleStatusChange(media, v)}
                        >
                          <SelectTrigger
                            className={cn(
                              'w-28 h-7 text-xs border',
                              statusConfig?.color
                            )}
                          >
                            <StatusIcon className="w-3 h-3 mr-1" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MEDIA_STATUSES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge
                          variant="outline"
                          className={cn('text-xs', statusConfig?.color)}
                        >
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusConfig?.label}
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
                            onClick={() => handleOpenEdit(media)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-400 hover:text-red-300"
                            onClick={() => setDeleteConfirmId(media.id)}
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
        open={showAddModal || !!editingMedia}
        onOpenChange={() => {
          setShowAddModal(false);
          setEditingMedia(null);
          resetForm();
        }}
      >
        <DialogContent className="bg-soft-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle>{editingMedia ? 'Edit Media' : 'Add Media'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Card Label *</Label>
                <Input
                  value={formData.card_label}
                  onChange={(e) => setFormData({ ...formData, card_label: e.target.value })}
                  placeholder="e.g., A001, CFE-01"
                  className="bg-charcoal-black border-muted-gray/30"
                />
              </div>
              <div>
                <Label>Media Type</Label>
                <Select
                  value={formData.media_type}
                  onValueChange={(v) => setFormData({ ...formData, media_type: v })}
                >
                  <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEDIA_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Camera ID</Label>
                <Input
                  value={formData.camera_id}
                  onChange={(e) => setFormData({ ...formData, camera_id: e.target.value })}
                  placeholder="e.g., A, B"
                  className="bg-charcoal-black border-muted-gray/30"
                />
              </div>
              <div>
                <Label>Capacity (GB)</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.capacity_gb || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, capacity_gb: parseInt(e.target.value) || 0 })
                  }
                  className="bg-charcoal-black border-muted-gray/30"
                />
              </div>
              <div>
                <Label>Used (GB)</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.used_gb || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, used_gb: parseInt(e.target.value) || 0 })
                  }
                  className="bg-charcoal-black border-muted-gray/30"
                />
              </div>
            </div>
            <div>
              <Label>Clip Count</Label>
              <Input
                type="number"
                min={0}
                value={formData.clip_count || ''}
                onChange={(e) =>
                  setFormData({ ...formData, clip_count: parseInt(e.target.value) || 0 })
                }
                className="bg-charcoal-black border-muted-gray/30 max-w-32"
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
                setEditingMedia(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.card_label || createMedia.isPending || updateMedia.isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {editingMedia ? 'Save Changes' : 'Add Media'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="bg-soft-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle>Delete Media Entry</DialogTitle>
          </DialogHeader>
          <p className="text-muted-gray">
            Are you sure you want to delete this media entry? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMedia.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MediaTrackerSubView;
