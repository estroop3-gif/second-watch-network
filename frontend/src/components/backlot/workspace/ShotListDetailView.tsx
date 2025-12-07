/**
 * ShotListDetailView - Detailed view and editor for a single shot list
 * Allows adding, editing, deleting, and reordering shots
 */
import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  GripVertical,
  MoreHorizontal,
  CheckCircle2,
  Circle,
  Calendar,
  Film,
  Archive,
  Clock,
  Camera,
  Move,
  Download,
  Loader2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
import { useShotList, useShotListShots, useScenes } from '@/hooks/backlot';
import {
  BacklotShot,
  ShotInput,
  ShotFrameSize,
  ShotCameraHeight,
  ShotMovement,
  ShotTimeOfDay,
  SHOT_FRAME_SIZE_LABELS,
  SHOT_FRAME_SIZE_SHORT_LABELS,
  SHOT_CAMERA_HEIGHT_LABELS,
  SHOT_MOVEMENT_LABELS,
  SHOT_TIME_OF_DAY_LABELS,
  SHOT_LIST_TYPE_LABELS,
} from '@/types/backlot';

interface ShotListDetailViewProps {
  shotListId: string;
  projectId: string;
  canEdit?: boolean;
  onBack?: () => void;
}

const ShotListDetailView: React.FC<ShotListDetailViewProps> = ({
  shotListId,
  projectId,
  canEdit = false,
  onBack,
}) => {
  const [showAddShotModal, setShowAddShotModal] = useState(false);
  const [editingShot, setEditingShot] = useState<BacklotShot | null>(null);
  const [deletingShot, setDeletingShot] = useState<BacklotShot | null>(null);
  const [showEditListModal, setShowEditListModal] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { shotList, shots, isLoading, updateShotList, archiveShotList, refetch } = useShotList(shotListId);
  const { createShot, updateShot, deleteShot, toggleShotCompleted, reorderShots } = useShotListShots({ shotListId });

  // Calculate stats
  const totalShots = shots.length;
  const completedShots = shots.filter(s => s.is_completed).length;
  const totalEstTime = shots.reduce((sum, s) => sum + (s.est_time_minutes || 0), 0);
  const remainingEstTime = shots.filter(s => !s.is_completed).reduce((sum, s) => sum + (s.est_time_minutes || 0), 0);

  const handleAddShot = async (data: ShotInput) => {
    try {
      await createShot.mutateAsync(data);
      setShowAddShotModal(false);
    } catch (error) {
      console.error('Error adding shot:', error);
    }
  };

  const handleEditShot = async (data: ShotInput & { id: string }) => {
    try {
      await updateShot.mutateAsync(data);
      setEditingShot(null);
    } catch (error) {
      console.error('Error updating shot:', error);
    }
  };

  const handleDeleteShot = async () => {
    if (!deletingShot) return;
    try {
      await deleteShot.mutateAsync(deletingShot.id);
      setDeletingShot(null);
    } catch (error) {
      console.error('Error deleting shot:', error);
    }
  };

  const handleToggleCompleted = async (shot: BacklotShot) => {
    try {
      await toggleShotCompleted.mutateAsync({ id: shot.id, is_completed: !shot.is_completed });
    } catch (error) {
      console.error('Error toggling shot completion:', error);
    }
  };

  const handleArchive = async () => {
    try {
      await archiveShotList.mutateAsync();
      setShowArchiveConfirm(false);
      if (onBack) onBack();
    } catch (error) {
      console.error('Error archiving shot list:', error);
    }
  };

  const handleExportPDF = async () => {
    if (!shotList) return;
    setIsExporting(true);

    try {
      // Dynamically import jspdf and jspdf-autotable
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      // Title
      doc.setFontSize(20);
      doc.setTextColor(40, 40, 40);
      doc.text(shotList.title, 14, 20);

      // Metadata line
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      const metadata: string[] = [];
      if (shotList.list_type) {
        metadata.push(SHOT_LIST_TYPE_LABELS[shotList.list_type]);
      }
      if (shotList.production_day) {
        metadata.push(`Day: ${shotList.production_day.label || new Date(shotList.production_day.date).toLocaleDateString()}`);
      }
      if (shotList.scene) {
        metadata.push(`Scene ${shotList.scene.scene_number}`);
      }
      metadata.push(`${totalShots} shots`);
      metadata.push(`${completedShots}/${totalShots} completed`);
      metadata.push(`Est. ${totalEstTime} min`);
      doc.text(metadata.join('  |  '), 14, 28);

      // Description if present
      let startY = 35;
      if (shotList.description) {
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        const descLines = doc.splitTextToSize(shotList.description, 270);
        doc.text(descLines, 14, startY);
        startY += descLines.length * 4 + 5;
      }

      // Table data
      const tableData = shots.map((shot) => [
        shot.is_completed ? '✓' : '',
        shot.shot_number || '',
        shot.scene_number || shot.scene?.scene_number || '',
        shot.frame_size ? SHOT_FRAME_SIZE_SHORT_LABELS[shot.frame_size] : '',
        shot.lens || (shot.focal_length_mm ? `${shot.focal_length_mm}mm` : ''),
        shot.movement ? SHOT_MOVEMENT_LABELS[shot.movement] : '',
        shot.description || '',
        shot.location_hint || '',
        shot.est_time_minutes ? `${shot.est_time_minutes}m` : '',
        shot.technical_notes || '',
      ]);

      // Generate table
      autoTable(doc, {
        head: [['Done', 'Shot #', 'Scene', 'Frame', 'Lens', 'Movement', 'Description', 'Location', 'Time', 'Tech Notes']],
        body: tableData,
        startY: startY,
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [50, 50, 50],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 15 },
          2: { cellWidth: 15 },
          3: { cellWidth: 15 },
          4: { cellWidth: 20 },
          5: { cellWidth: 20 },
          6: { cellWidth: 50 },
          7: { cellWidth: 30 },
          8: { cellWidth: 12 },
          9: { cellWidth: 40 },
        },
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Generated on ${new Date().toLocaleDateString()} | Page ${i} of ${pageCount}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        );
      }

      // Save
      const filename = `shot-list-${shotList.title.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
    } catch (error) {
      console.error('Error exporting PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading || !shotList) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div>
            <h2 className="text-2xl font-heading text-bone-white">{shotList.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              {shotList.list_type && (
                <Badge variant="outline" className="text-xs border-muted-gray/30 text-muted-gray">
                  {SHOT_LIST_TYPE_LABELS[shotList.list_type]}
                </Badge>
              )}
              {shotList.production_day && (
                <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/20">
                  <Calendar className="w-3 h-3 mr-1" />
                  {shotList.production_day.label || new Date(shotList.production_day.date).toLocaleDateString()}
                </Badge>
              )}
              {shotList.scene && (
                <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/20">
                  <Film className="w-3 h-3 mr-1" />
                  Sc. {shotList.scene.scene_number}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowEditListModal(true)}>
                <Edit2 className="w-4 h-4 mr-2" />
                Edit Info
              </Button>
              <Button
                onClick={() => setShowAddShotModal(true)}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Shot
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-charcoal-black border-muted-gray/20">
              <DropdownMenuItem onClick={handleExportPDF} disabled={isExporting}>
                {isExporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                {isExporting ? 'Exporting...' : 'Export PDF'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {canEdit && (
                <>
                  <DropdownMenuItem onClick={() => setShowArchiveConfirm(true)}>
                    <Archive className="w-4 h-4 mr-2" />
                    Archive Shot List
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => refetch()}>
                Refresh
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Description */}
      {shotList.description && (
        <p className="text-muted-gray">{shotList.description}</p>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Shots"
          value={totalShots}
          icon={<Camera className="w-4 h-4" />}
        />
        <StatCard
          label="Completed"
          value={`${completedShots}/${totalShots}`}
          icon={<CheckCircle2 className="w-4 h-4 text-green-400" />}
          subtext={totalShots > 0 ? `${Math.round(completedShots / totalShots * 100)}%` : '0%'}
        />
        <StatCard
          label="Est. Total Time"
          value={`${Math.round(totalEstTime)} min`}
          icon={<Clock className="w-4 h-4" />}
        />
        <StatCard
          label="Remaining"
          value={`${Math.round(remainingEstTime)} min`}
          icon={<Clock className="w-4 h-4 text-orange-400" />}
        />
      </div>

      {/* Shots Table */}
      {shots.length === 0 ? (
        <div className="border border-muted-gray/20 rounded-lg p-12 text-center">
          <Camera className="w-12 h-12 text-muted-gray mx-auto mb-4" />
          <h3 className="text-lg font-medium text-bone-white mb-2">No Shots Yet</h3>
          <p className="text-muted-gray mb-4">Add your first shot to this list.</p>
          {canEdit && (
            <Button
              onClick={() => setShowAddShotModal(true)}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Shot
            </Button>
          )}
        </div>
      ) : (
        <div className="border border-muted-gray/20 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-muted-gray/20 hover:bg-transparent">
                {canEdit && <TableHead className="w-10"></TableHead>}
                <TableHead className="w-10">Done</TableHead>
                <TableHead className="w-16">Shot #</TableHead>
                <TableHead className="w-16">Scene</TableHead>
                <TableHead className="w-20">Frame</TableHead>
                <TableHead className="w-24">Lens</TableHead>
                <TableHead className="w-24">Movement</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-16">Time</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shots.map((shot, index) => (
                <ShotRow
                  key={shot.id}
                  shot={shot}
                  index={index}
                  canEdit={canEdit}
                  onToggleCompleted={() => handleToggleCompleted(shot)}
                  onEdit={() => setEditingShot(shot)}
                  onDelete={() => setDeletingShot(shot)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Shot Modal */}
      <ShotEditModal
        isOpen={showAddShotModal}
        onClose={() => setShowAddShotModal(false)}
        onSubmit={handleAddShot}
        projectId={projectId}
        title="Add Shot"
        isSubmitting={createShot.isPending}
      />

      {/* Edit Shot Modal */}
      {editingShot && (
        <ShotEditModal
          isOpen={!!editingShot}
          onClose={() => setEditingShot(null)}
          onSubmit={(data) => handleEditShot({ ...data, id: editingShot.id })}
          projectId={projectId}
          initialData={editingShot}
          title="Edit Shot"
          isSubmitting={updateShot.isPending}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingShot} onOpenChange={() => setDeletingShot(null)}>
        <AlertDialogContent className="bg-charcoal-black border-muted-gray/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-bone-white">Delete Shot?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-gray">
              This will permanently delete shot #{deletingShot?.shot_number}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteShot}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Confirmation */}
      <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <AlertDialogContent className="bg-charcoal-black border-muted-gray/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-bone-white">Archive Shot List?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-gray">
              This shot list will be archived and hidden from the main view. You can still access it by showing archived lists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Stat Card Component
const StatCard: React.FC<{
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  subtext?: string;
}> = ({ label, value, icon, subtext }) => (
  <div className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-4">
    <div className="flex items-center gap-2 text-muted-gray text-sm mb-1">
      {icon}
      {label}
    </div>
    <div className="text-2xl font-bold text-bone-white">{value}</div>
    {subtext && <div className="text-xs text-muted-gray">{subtext}</div>}
  </div>
);

// Shot Row Component
interface ShotRowProps {
  shot: BacklotShot;
  index: number;
  canEdit: boolean;
  onToggleCompleted: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const ShotRow: React.FC<ShotRowProps> = ({
  shot,
  index,
  canEdit,
  onToggleCompleted,
  onEdit,
  onDelete,
}) => (
  <TableRow className={`border-muted-gray/20 ${shot.is_completed ? 'opacity-60' : ''}`}>
    {canEdit && (
      <TableCell className="w-10">
        <GripVertical className="w-4 h-4 text-muted-gray cursor-grab" />
      </TableCell>
    )}
    <TableCell>
      <Checkbox
        checked={shot.is_completed}
        onCheckedChange={onToggleCompleted}
        disabled={!canEdit}
      />
    </TableCell>
    <TableCell className="font-mono text-bone-white">{shot.shot_number}</TableCell>
    <TableCell className="text-muted-gray">
      {shot.scene_number || shot.scene?.scene_number || '-'}
    </TableCell>
    <TableCell>
      {shot.frame_size && (
        <Badge variant="outline" className="text-xs border-accent-yellow/30 text-accent-yellow">
          {SHOT_FRAME_SIZE_SHORT_LABELS[shot.frame_size]}
        </Badge>
      )}
    </TableCell>
    <TableCell className="text-muted-gray text-sm">
      {shot.lens || (shot.focal_length_mm ? `${shot.focal_length_mm}mm` : '-')}
    </TableCell>
    <TableCell className="text-muted-gray text-sm">
      {shot.movement ? SHOT_MOVEMENT_LABELS[shot.movement] : '-'}
    </TableCell>
    <TableCell className="text-bone-white text-sm max-w-xs truncate">
      {shot.description || '-'}
    </TableCell>
    <TableCell className="text-muted-gray text-sm">
      {shot.est_time_minutes ? `${shot.est_time_minutes}m` : '-'}
    </TableCell>
    <TableCell>
      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-charcoal-black border-muted-gray/20">
            <DropdownMenuItem onClick={onEdit}>
              <Edit2 className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-red-400">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </TableCell>
  </TableRow>
);

// Shot Edit Modal
interface ShotEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ShotInput) => void;
  projectId: string;
  initialData?: BacklotShot;
  title: string;
  isSubmitting?: boolean;
}

const NONE_VALUE = '__none__';

const ShotEditModal: React.FC<ShotEditModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  projectId,
  initialData,
  title,
  isSubmitting,
}) => {
  const [shotNumber, setShotNumber] = useState(initialData?.shot_number || '');
  const [sceneNumber, setSceneNumber] = useState(initialData?.scene_number || '');
  const [sceneId, setSceneId] = useState(initialData?.scene_id || '');
  const [cameraLabel, setCameraLabel] = useState(initialData?.camera_label || '');
  const [frameSize, setFrameSize] = useState<ShotFrameSize | typeof NONE_VALUE>(initialData?.frame_size || NONE_VALUE);
  const [lens, setLens] = useState(initialData?.lens || '');
  const [focalLength, setFocalLength] = useState(initialData?.focal_length_mm?.toString() || '');
  const [cameraHeight, setCameraHeight] = useState<ShotCameraHeight | typeof NONE_VALUE>(initialData?.camera_height || NONE_VALUE);
  const [movement, setMovement] = useState<ShotMovement | typeof NONE_VALUE>(initialData?.movement || NONE_VALUE);
  const [locationHint, setLocationHint] = useState(initialData?.location_hint || '');
  const [timeOfDay, setTimeOfDay] = useState<ShotTimeOfDay | typeof NONE_VALUE>(initialData?.time_of_day || NONE_VALUE);
  const [description, setDescription] = useState(initialData?.description || '');
  const [technicalNotes, setTechnicalNotes] = useState(initialData?.technical_notes || '');
  const [performanceNotes, setPerformanceNotes] = useState(initialData?.performance_notes || '');
  const [estTime, setEstTime] = useState(initialData?.est_time_minutes?.toString() || '');

  const { data: scenes } = useScenes(projectId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      shot_number: shotNumber || undefined,
      scene_number: sceneNumber || undefined,
      scene_id: sceneId || undefined,
      camera_label: cameraLabel || undefined,
      frame_size: frameSize && frameSize !== NONE_VALUE ? frameSize : undefined,
      lens: lens || undefined,
      focal_length_mm: focalLength ? parseFloat(focalLength) : undefined,
      camera_height: cameraHeight && cameraHeight !== NONE_VALUE ? cameraHeight : undefined,
      movement: movement && movement !== NONE_VALUE ? movement : undefined,
      location_hint: locationHint || undefined,
      time_of_day: timeOfDay && timeOfDay !== NONE_VALUE ? timeOfDay : undefined,
      description: description || undefined,
      technical_notes: technicalNotes || undefined,
      performance_notes: performanceNotes || undefined,
      est_time_minutes: estTime ? parseFloat(estTime) : undefined,
    });
  };

  const handleClose = () => {
    if (!initialData) {
      // Reset form only for new shots
      setShotNumber('');
      setSceneNumber('');
      setSceneId('');
      setCameraLabel('');
      setFrameSize(NONE_VALUE);
      setLens('');
      setFocalLength('');
      setCameraHeight(NONE_VALUE);
      setMovement(NONE_VALUE);
      setLocationHint('');
      setTimeOfDay(NONE_VALUE);
      setDescription('');
      setTechnicalNotes('');
      setPerformanceNotes('');
      setEstTime('');
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-charcoal-black border-muted-gray/20 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-bone-white">{title}</DialogTitle>
          <DialogDescription className="text-muted-gray">
            Fill in the shot details below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Shot #, Scene #, Camera */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-bone-white">Shot #</Label>
              <Input
                value={shotNumber}
                onChange={e => setShotNumber(e.target.value)}
                placeholder="1, 1A, 2B..."
                className="bg-charcoal-black border-muted-gray/30 text-bone-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-bone-white">Scene #</Label>
              <Input
                value={sceneNumber}
                onChange={e => setSceneNumber(e.target.value)}
                placeholder="1, 2A..."
                className="bg-charcoal-black border-muted-gray/30 text-bone-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-bone-white">Camera</Label>
              <Input
                value={cameraLabel}
                onChange={e => setCameraLabel(e.target.value)}
                placeholder="A Cam, B Cam..."
                className="bg-charcoal-black border-muted-gray/30 text-bone-white"
              />
            </div>
          </div>

          {/* Row 2: Frame Size, Lens, Focal Length */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-bone-white">Frame Size</Label>
              <Select value={frameSize} onValueChange={(v) => setFrameSize(v as ShotFrameSize)}>
                <SelectTrigger className="bg-charcoal-black border-muted-gray/30 text-bone-white">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent className="bg-charcoal-black border-muted-gray/20 max-h-60">
                  <SelectItem value={NONE_VALUE}>None</SelectItem>
                  {Object.entries(SHOT_FRAME_SIZE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-bone-white">Lens</Label>
              <Input
                value={lens}
                onChange={e => setLens(e.target.value)}
                placeholder="35mm Prime, 24-70..."
                className="bg-charcoal-black border-muted-gray/30 text-bone-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-bone-white">Focal Length (mm)</Label>
              <Input
                type="number"
                value={focalLength}
                onChange={e => setFocalLength(e.target.value)}
                placeholder="35, 50, 85..."
                className="bg-charcoal-black border-muted-gray/30 text-bone-white"
              />
            </div>
          </div>

          {/* Row 3: Height, Movement, Time of Day */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-bone-white">Camera Height</Label>
              <Select value={cameraHeight} onValueChange={(v) => setCameraHeight(v as ShotCameraHeight)}>
                <SelectTrigger className="bg-charcoal-black border-muted-gray/30 text-bone-white">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent className="bg-charcoal-black border-muted-gray/20">
                  <SelectItem value={NONE_VALUE}>None</SelectItem>
                  {Object.entries(SHOT_CAMERA_HEIGHT_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-bone-white">Movement</Label>
              <Select value={movement} onValueChange={(v) => setMovement(v as ShotMovement)}>
                <SelectTrigger className="bg-charcoal-black border-muted-gray/30 text-bone-white">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent className="bg-charcoal-black border-muted-gray/20 max-h-60">
                  <SelectItem value={NONE_VALUE}>None</SelectItem>
                  {Object.entries(SHOT_MOVEMENT_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-bone-white">Time of Day</Label>
              <Select value={timeOfDay} onValueChange={(v) => setTimeOfDay(v as ShotTimeOfDay)}>
                <SelectTrigger className="bg-charcoal-black border-muted-gray/30 text-bone-white">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent className="bg-charcoal-black border-muted-gray/20">
                  <SelectItem value={NONE_VALUE}>None</SelectItem>
                  {Object.entries(SHOT_TIME_OF_DAY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 4: Location, Est Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-bone-white">Location Hint</Label>
              <Input
                value={locationHint}
                onChange={e => setLocationHint(e.target.value)}
                placeholder="Main Sanctuary, Hallway B..."
                className="bg-charcoal-black border-muted-gray/30 text-bone-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-bone-white">Est. Time (min)</Label>
              <Input
                type="number"
                value={estTime}
                onChange={e => setEstTime(e.target.value)}
                placeholder="5, 10, 15..."
                className="bg-charcoal-black border-muted-gray/30 text-bone-white"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-bone-white">Description</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What happens in this shot..."
              className="bg-charcoal-black border-muted-gray/30 text-bone-white min-h-[80px]"
            />
          </div>

          {/* Technical Notes */}
          <div className="space-y-2">
            <Label className="text-bone-white">Technical Notes</Label>
            <Textarea
              value={technicalNotes}
              onChange={e => setTechnicalNotes(e.target.value)}
              placeholder="Exposure, filtration, LUT, special rigs..."
              className="bg-charcoal-black border-muted-gray/30 text-bone-white min-h-[60px]"
            />
          </div>

          {/* Performance Notes */}
          <div className="space-y-2">
            <Label className="text-bone-white">Performance Notes</Label>
            <Textarea
              value={performanceNotes}
              onChange={e => setPerformanceNotes(e.target.value)}
              placeholder="Actor direction, emotional beats..."
              className="bg-charcoal-black border-muted-gray/30 text-bone-white min-h-[60px]"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {isSubmitting ? 'Saving...' : initialData ? 'Save Changes' : 'Add Shot'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ShotListDetailView;
