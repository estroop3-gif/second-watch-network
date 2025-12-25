/**
 * ShotListDetailView - Detailed view and editor for a single shot list
 * Allows adding, editing, deleting, and reordering shots
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  Lightbulb,
  Zap,
  MousePointer2,
  Keyboard,
  Copy,
  BookTemplate,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
import { useShotList, useShotListShots, useScenes, useProductionDays, useShotLists, useShotTemplates } from '@/hooks/backlot';
import { useToast } from '@/hooks/use-toast';
import {
  BacklotShot,
  ShotInput,
  ShotFrameSize,
  ShotCameraHeight,
  ShotMovement,
  ShotTimeOfDay,
  ShotListType,
  ShotListInput,
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
  const { toast } = useToast();
  const [showAddShotModal, setShowAddShotModal] = useState(false);
  const [editingShot, setEditingShot] = useState<BacklotShot | null>(null);
  const [deletingShot, setDeletingShot] = useState<BacklotShot | null>(null);
  const [showEditListModal, setShowEditListModal] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showTipsPanel, setShowTipsPanel] = useState(false);

  // Quick-add mode
  const [quickAddMode, setQuickAddMode] = useState(false);
  const [lastShotData, setLastShotData] = useState<Partial<ShotInput>>({});

  // Templates
  const [showTemplatesDropdown, setShowTemplatesDropdown] = useState(false);
  const [templatePrefill, setTemplatePrefill] = useState<Partial<ShotInput> | null>(null);

  // Selected shot for keyboard navigation
  const [selectedShotIndex, setSelectedShotIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { shotList, shots, isLoading, updateShotList, archiveShotList, refetch } = useShotList(shotListId);
  const { createShot, updateShot, deleteShot, toggleShotCompleted, reorderShots, cloneShot } = useShotListShots({ shotListId });
  const { defaultTemplates, personalTemplates, allTemplates, createTemplate } = useShotTemplates({ projectId });

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for reordering shots
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = shots.findIndex((shot) => shot.id === active.id);
    const newIndex = shots.findIndex((shot) => shot.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Create the new order array
    const reorderedShots = arrayMove(shots, oldIndex, newIndex);

    // Build the update payload with new sort_order values
    const updates = reorderedShots.map((shot, index) => ({
      id: shot.id,
      sort_order: index,
    }));

    try {
      await reorderShots.mutateAsync(updates);
      toast({
        title: 'Shots reordered',
        description: 'Shot order has been updated.',
      });
    } catch (error) {
      toast({
        title: 'Failed to reorder',
        description: 'Could not update shot order. Please try again.',
        variant: 'destructive',
      });
    }
  }, [shots, reorderShots, toast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Don't trigger if modal is open
      if (showAddShotModal || editingShot || deletingShot || showEditListModal || showTipsPanel) {
        return;
      }

      const selectedShot = selectedShotIndex !== null ? shots[selectedShotIndex] : null;

      switch (e.key.toLowerCase()) {
        case 'n':
          // New shot
          if (canEdit) {
            e.preventDefault();
            setShowAddShotModal(true);
          }
          break;
        case 't':
          // Toggle templates dropdown
          if (canEdit) {
            e.preventDefault();
            setShowTemplatesDropdown(prev => !prev);
          }
          break;
        case 'c':
          // Clone selected shot
          if (canEdit && selectedShot) {
            e.preventDefault();
            handleCloneShot(selectedShot);
          }
          break;
        case 'e':
          // Edit selected shot
          if (canEdit && selectedShot) {
            e.preventDefault();
            setEditingShot(selectedShot);
          }
          break;
        case 'delete':
        case 'backspace':
          // Delete selected shot
          if (canEdit && selectedShot) {
            e.preventDefault();
            setDeletingShot(selectedShot);
          }
          break;
        case 'arrowup':
          // Navigate up
          e.preventDefault();
          if (shots.length > 0) {
            if (selectedShotIndex === null) {
              setSelectedShotIndex(shots.length - 1);
            } else if (selectedShotIndex > 0) {
              setSelectedShotIndex(selectedShotIndex - 1);
            }
          }
          break;
        case 'arrowdown':
          // Navigate down
          e.preventDefault();
          if (shots.length > 0) {
            if (selectedShotIndex === null) {
              setSelectedShotIndex(0);
            } else if (selectedShotIndex < shots.length - 1) {
              setSelectedShotIndex(selectedShotIndex + 1);
            }
          }
          break;
        case 'escape':
          // Deselect
          setSelectedShotIndex(null);
          setShowTemplatesDropdown(false);
          break;
        case ' ':
          // Toggle completion
          if (canEdit && selectedShot) {
            e.preventDefault();
            handleToggleCompleted(selectedShot);
          }
          break;
        case '?':
          // Show help
          e.preventDefault();
          setShowTipsPanel(true);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [canEdit, shots, selectedShotIndex, showAddShotModal, editingShot, deletingShot, showEditListModal, showTipsPanel]);

  // Apply template to create a new shot
  const handleApplyTemplate = (templateData: Partial<ShotInput>) => {
    setTemplatePrefill(templateData);
    setShowTemplatesDropdown(false);
    setShowAddShotModal(true);
  };

  // Calculate stats
  const totalShots = shots.length;
  const completedShots = shots.filter(s => s.is_completed).length;
  const totalEstTime = shots.reduce((sum, s) => sum + (s.est_time_minutes || 0), 0);
  const remainingEstTime = shots.filter(s => !s.is_completed).reduce((sum, s) => sum + (s.est_time_minutes || 0), 0);

  const handleAddShot = async (data: ShotInput, continueAdding = false) => {
    try {
      await createShot.mutateAsync(data);
      toast({ title: 'Shot added' });

      if (quickAddMode || continueAdding) {
        // Save settings for next shot
        setLastShotData({
          frame_size: data.frame_size,
          lens: data.lens,
          focal_length_mm: data.focal_length_mm,
          camera_height: data.camera_height,
          movement: data.movement,
          est_time_minutes: data.est_time_minutes,
        });
        // Keep modal open for next shot
      } else {
        setShowAddShotModal(false);
      }
    } catch (error) {
      console.error('Error adding shot:', error);
      toast({ title: 'Error adding shot', variant: 'destructive' });
    }
  };

  const handleCloneShot = async (shot: BacklotShot) => {
    try {
      await cloneShot.mutateAsync({ shotId: shot.id });
      toast({ title: `Cloned shot ${shot.shot_number}` });
    } catch (error) {
      console.error('Error cloning shot:', error);
      toast({ title: 'Error cloning shot', variant: 'destructive' });
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

  const handleUpdateShotListInfo = async (data: Partial<ShotListInput>) => {
    try {
      await updateShotList.mutateAsync(data);
      setShowEditListModal(false);
    } catch (error) {
      console.error('Error updating shot list:', error);
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
            <Button variant="outline" size="sm" onClick={() => setShowEditListModal(true)}>
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Info
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={isExporting || shots.length === 0}
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Export PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTipsPanel(true)}
            className="border-muted-gray/30"
          >
            <Lightbulb className="w-4 h-4 mr-2" />
            Tips
          </Button>
          {canEdit && (
            <DropdownMenu open={showTemplatesDropdown} onOpenChange={setShowTemplatesDropdown}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="border-muted-gray/30">
                  <BookTemplate className="w-4 h-4 mr-2" />
                  Templates
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-charcoal-black border-muted-gray/20 w-64">
                {defaultTemplates.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-gray">Standard Templates</div>
                    {defaultTemplates.map((template, idx) => (
                      <DropdownMenuItem
                        key={`default-${idx}`}
                        onClick={() => handleApplyTemplate(template.template_data as Partial<ShotInput>)}
                        className="flex flex-col items-start gap-0.5"
                      >
                        <span className="text-bone-white">{template.name}</span>
                        {template.description && (
                          <span className="text-xs text-muted-gray">{template.description}</span>
                        )}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator className="bg-muted-gray/20" />
                  </>
                )}
                {allTemplates.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-gray">Your Templates</div>
                    {allTemplates.map((template) => (
                      <DropdownMenuItem
                        key={template.id}
                        onClick={() => handleApplyTemplate(template.template_data as Partial<ShotInput>)}
                        className="flex flex-col items-start gap-0.5"
                      >
                        <span className="text-bone-white">{template.name}</span>
                        {template.description && (
                          <span className="text-xs text-muted-gray">{template.description}</span>
                        )}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator className="bg-muted-gray/20" />
                  </>
                )}
                {defaultTemplates.length === 0 && allTemplates.length === 0 && (
                  <div className="px-2 py-3 text-sm text-muted-gray text-center">
                    No templates available
                  </div>
                )}
                <DropdownMenuItem onClick={() => setShowAddShotModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create from scratch
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {canEdit && (
            <Button
              onClick={() => setShowAddShotModal(true)}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Shot
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-charcoal-black border-muted-gray/20">
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
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
              <SortableContext
                items={shots.map((shot) => shot.id)}
                strategy={verticalListSortingStrategy}
              >
                <TableBody>
                  {shots.map((shot, index) => (
                    <ShotRow
                      key={shot.id}
                      shot={shot}
                      index={index}
                      canEdit={canEdit}
                      isSelected={selectedShotIndex === index}
                      onSelect={() => setSelectedShotIndex(index)}
                      onToggleCompleted={() => handleToggleCompleted(shot)}
                      onEdit={() => setEditingShot(shot)}
                      onDelete={() => setDeletingShot(shot)}
                      onClone={() => handleCloneShot(shot)}
                    />
                  ))}
                </TableBody>
              </SortableContext>
            </Table>
          </div>
        </DndContext>
      )}

      {/* Add Shot Modal */}
      <ShotEditModal
        isOpen={showAddShotModal}
        onClose={() => {
          setShowAddShotModal(false);
          setTemplatePrefill(null);
        }}
        onSubmit={handleAddShot}
        projectId={projectId}
        title="Add Shot"
        isSubmitting={createShot.isPending}
        prefillData={templatePrefill || lastShotData}
        quickAddMode={quickAddMode}
        onQuickAddModeChange={setQuickAddMode}
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

      {/* Edit Shot List Info Modal */}
      <EditShotListInfoModal
        isOpen={showEditListModal}
        onClose={() => setShowEditListModal(false)}
        onSubmit={handleUpdateShotListInfo}
        projectId={projectId}
        initialData={{
          title: shotList.title,
          description: shotList.description,
          list_type: shotList.list_type,
          production_day_id: shotList.production_day_id,
          scene_id: shotList.scene_id,
        }}
        isSubmitting={updateShotList.isPending}
      />

      {/* Tips & Shortcuts Panel */}
      <Dialog open={showTipsPanel} onOpenChange={setShowTipsPanel}>
        <DialogContent className="max-w-2xl bg-charcoal-black border-muted-gray/20 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-bone-white flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-accent-yellow" />
              Tips & Shortcuts
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Keyboard Shortcuts */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-blue-400 flex items-center gap-2">
                <Keyboard className="w-4 h-4" />
                Keyboard Shortcuts
                <Badge variant="outline" className="text-[10px] border-blue-400/30 text-blue-400 ml-1">NEW</Badge>
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
                <div className="flex justify-between items-center">
                  <span className="text-muted-gray">New shot</span>
                  <kbd className="px-2 py-0.5 bg-muted-gray/20 rounded text-bone-white">N</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-gray">Templates</span>
                  <kbd className="px-2 py-0.5 bg-muted-gray/20 rounded text-bone-white">T</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-gray">Clone selected</span>
                  <kbd className="px-2 py-0.5 bg-muted-gray/20 rounded text-bone-white">C</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-gray">Edit selected</span>
                  <kbd className="px-2 py-0.5 bg-muted-gray/20 rounded text-bone-white">E</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-gray">Delete selected</span>
                  <kbd className="px-2 py-0.5 bg-muted-gray/20 rounded text-bone-white">Del</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-gray">Toggle complete</span>
                  <kbd className="px-2 py-0.5 bg-muted-gray/20 rounded text-bone-white">Space</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-gray">Navigate up/down</span>
                  <kbd className="px-2 py-0.5 bg-muted-gray/20 rounded text-bone-white">↑ ↓</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-gray">Deselect / Close</span>
                  <kbd className="px-2 py-0.5 bg-muted-gray/20 rounded text-bone-white">Esc</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-gray">Show this help</span>
                  <kbd className="px-2 py-0.5 bg-muted-gray/20 rounded text-bone-white">?</kbd>
                </div>
              </div>
              <p className="text-xs text-muted-gray">Click on a shot row to select it, then use shortcuts to act on it.</p>
            </div>

            {/* Templates */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-purple-400 flex items-center gap-2">
                <BookTemplate className="w-4 h-4" />
                Shot Templates
                <Badge variant="outline" className="text-[10px] border-purple-400/30 text-purple-400 ml-1">NEW</Badge>
              </h3>
              <div className="grid gap-3 text-sm">
                <div className="flex items-start gap-3 p-3 bg-purple-500/5 rounded-lg border border-purple-500/20">
                  <BookTemplate className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Use Templates</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Click <span className="text-purple-400">Templates</span> button or press <kbd className="px-1.5 py-0.5 bg-muted-gray/20 rounded text-bone-white text-[10px]">T</kbd> to choose from standard or custom templates.
                      Templates pre-fill frame size, lens, movement, and time settings.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Rapid Shot Entry */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-green-400 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Rapid Shot Entry
              </h3>
              <div className="grid gap-3 text-sm">
                <div className="flex items-start gap-3 p-3 bg-green-500/5 rounded-lg border border-green-500/20">
                  <Copy className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Clone Shots <kbd className="ml-2 px-1.5 py-0.5 bg-muted-gray/20 rounded text-bone-white text-[10px]">C</kbd></p>
                    <p className="text-muted-gray text-xs mt-1">
                      Select a shot and press <kbd className="px-1 py-0.5 bg-muted-gray/20 rounded text-bone-white text-[10px]">C</kbd>, or use the <span className="text-bone-white">⋯</span> menu.
                      Perfect for creating coverage variations.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-green-500/5 rounded-lg border border-green-500/20">
                  <Zap className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Quick Add Mode</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Enable <span className="text-green-400">Quick Add</span> checkbox in the Add Shot dialog.
                      Lens, frame size, movement, and time carry over between shots.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-green-500/5 rounded-lg border border-green-500/20">
                  <Plus className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Save & Add Another</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Click <span className="text-green-400">Save & Add Another</span> to save and immediately start adding the next shot.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Shot Management */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-accent-yellow flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Shot Management
              </h3>
              <div className="grid gap-3 text-sm">
                <div className="flex items-start gap-3 p-3 bg-muted-gray/5 rounded-lg border border-muted-gray/10">
                  <CheckCircle2 className="w-5 h-5 text-muted-gray shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Mark Shots Complete <kbd className="ml-2 px-1.5 py-0.5 bg-muted-gray/20 rounded text-bone-white text-[10px]">Space</kbd></p>
                    <p className="text-muted-gray text-xs mt-1">
                      Use the checkbox or select a shot and press <kbd className="px-1 py-0.5 bg-muted-gray/20 rounded text-bone-white text-[10px]">Space</kbd>.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted-gray/5 rounded-lg border border-muted-gray/10">
                  <MoreHorizontal className="w-5 h-5 text-muted-gray shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Shot Actions Menu</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Click the <span className="text-bone-white">⋯</span> menu on any shot for Edit, Clone, or Delete.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted-gray/5 rounded-lg border border-muted-gray/10">
                  <GripVertical className="w-5 h-5 text-muted-gray shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Drag to Reorder</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Drag the grip handle on the left side of any shot to reorder.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Export & Share */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-accent-yellow flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export & Share
              </h3>
              <div className="grid gap-3 text-sm">
                <div className="flex items-start gap-3 p-3 bg-muted-gray/5 rounded-lg border border-muted-gray/10">
                  <Download className="w-5 h-5 text-muted-gray shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Export PDF</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Download a professional PDF of your shot list to share with your crew.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pro Tips */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-accent-yellow flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                Pro Tips
              </h3>
              <div className="text-xs text-muted-gray space-y-2 p-3 bg-muted-gray/5 rounded-lg border border-muted-gray/10">
                <p>• Press <kbd className="px-1 py-0.5 bg-muted-gray/20 rounded text-bone-white">T</kbd> then select a template to quickly add common shot types</p>
                <p>• Use <kbd className="px-1 py-0.5 bg-muted-gray/20 rounded text-bone-white">↑</kbd><kbd className="px-1 py-0.5 bg-muted-gray/20 rounded text-bone-white">↓</kbd> to navigate, then <kbd className="px-1 py-0.5 bg-muted-gray/20 rounded text-bone-white">C</kbd> to clone for fast coverage</p>
                <p>• Enable <span className="text-bone-white">Quick Add</span> when adding a series of similar shots</p>
                <p>• Link your shot list to a production day for organization</p>
                <p>• Export to PDF before shooting to share with your crew</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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

// Sortable Shot Row Component
interface ShotRowProps {
  shot: BacklotShot;
  index: number;
  canEdit: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onToggleCompleted: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClone: () => void;
}

const ShotRow: React.FC<ShotRowProps> = ({
  shot,
  index,
  canEdit,
  isSelected,
  onSelect,
  onToggleCompleted,
  onEdit,
  onDelete,
  onClone,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: shot.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : undefined,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={`border-muted-gray/20 cursor-pointer transition-colors ${shot.is_completed ? 'opacity-60' : ''} ${isSelected ? 'bg-accent-yellow/10 ring-1 ring-accent-yellow/30' : 'hover:bg-muted-gray/5'} ${isDragging ? 'bg-charcoal-black shadow-lg' : ''}`}
      onClick={onSelect}
    >
      {canEdit && (
        <TableCell className="w-10">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4 text-muted-gray hover:text-bone-white transition-colors" />
          </div>
        </TableCell>
      )}
      <TableCell>
        <Checkbox
          checked={shot.is_completed}
          onCheckedChange={onToggleCompleted}
          disabled={!canEdit}
          onClick={(e) => e.stopPropagation()}
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
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-charcoal-black border-muted-gray/20">
              <DropdownMenuItem onClick={onEdit}>
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onClone}>
                <Copy className="w-4 h-4 mr-2" />
                Clone
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-muted-gray/20" />
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
};

// Shot Edit Modal
interface ShotEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ShotInput, continueAdding?: boolean) => void;
  projectId: string;
  initialData?: BacklotShot;
  prefillData?: Partial<ShotInput>;
  title: string;
  isSubmitting?: boolean;
  quickAddMode?: boolean;
  onQuickAddModeChange?: (enabled: boolean) => void;
}

const NONE_VALUE = '__none__';

// Edit Shot List Info Modal
interface EditShotListInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<ShotListInput>) => void;
  projectId: string;
  initialData: {
    title: string;
    description?: string;
    list_type?: ShotListType;
    production_day_id?: string;
    scene_id?: string;
  };
  isSubmitting?: boolean;
}

const EditShotListInfoModal: React.FC<EditShotListInfoModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  projectId,
  initialData,
  isSubmitting,
}) => {
  const [title, setTitle] = useState(initialData.title);
  const [description, setDescription] = useState(initialData.description || '');
  const [listType, setListType] = useState<ShotListType | typeof NONE_VALUE>(initialData.list_type || NONE_VALUE);
  const [productionDayId, setProductionDayId] = useState(initialData.production_day_id || NONE_VALUE);
  const [sceneId, setSceneId] = useState(initialData.scene_id || NONE_VALUE);

  // Fetch production days and scenes for dropdowns
  const { data: productionDays } = useProductionDays(projectId);
  const { scenes } = useScenes({ projectId });

  // Reset form when initialData changes (e.g., when opening modal)
  React.useEffect(() => {
    setTitle(initialData.title);
    setDescription(initialData.description || '');
    setListType(initialData.list_type || NONE_VALUE);
    setProductionDayId(initialData.production_day_id || NONE_VALUE);
    setSceneId(initialData.scene_id || NONE_VALUE);
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      list_type: listType && listType !== NONE_VALUE ? listType : undefined,
      production_day_id: productionDayId && productionDayId !== NONE_VALUE ? productionDayId : undefined,
      scene_id: sceneId && sceneId !== NONE_VALUE ? sceneId : undefined,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-charcoal-black border-muted-gray/20 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-bone-white">Edit Shot List Info</DialogTitle>
          <DialogDescription className="text-muted-gray">
            Update the shot list details below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="edit-title" className="text-bone-white">Title *</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Day 3 - Church Interior"
              className="bg-charcoal-black border-muted-gray/30 text-bone-white"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="edit-description" className="text-bone-white">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Notes about this shot list..."
              className="bg-charcoal-black border-muted-gray/30 text-bone-white min-h-[80px]"
            />
          </div>

          {/* List Type */}
          <div className="space-y-2">
            <Label className="text-bone-white">List Type</Label>
            <Select value={listType} onValueChange={(v) => setListType(v as ShotListType)}>
              <SelectTrigger className="bg-charcoal-black border-muted-gray/30 text-bone-white">
                <SelectValue placeholder="Select type (optional)" />
              </SelectTrigger>
              <SelectContent className="bg-charcoal-black border-muted-gray/20">
                <SelectItem value={NONE_VALUE}>None</SelectItem>
                {Object.entries(SHOT_LIST_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Link to Production Day */}
          <div className="space-y-2">
            <Label className="text-bone-white">Link to Production Day</Label>
            <Select value={productionDayId} onValueChange={setProductionDayId}>
              <SelectTrigger className="bg-charcoal-black border-muted-gray/30 text-bone-white">
                <SelectValue placeholder="Select production day (optional)" />
              </SelectTrigger>
              <SelectContent className="bg-charcoal-black border-muted-gray/20">
                <SelectItem value={NONE_VALUE}>None</SelectItem>
                {productionDays?.map(day => (
                  <SelectItem key={day.id} value={day.id}>
                    {day.label || new Date(day.date).toLocaleDateString()} - Day {day.day_number || '?'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Link to Scene */}
          <div className="space-y-2">
            <Label className="text-bone-white">Link to Primary Scene</Label>
            <Select value={sceneId} onValueChange={setSceneId}>
              <SelectTrigger className="bg-charcoal-black border-muted-gray/30 text-bone-white">
                <SelectValue placeholder="Select scene (optional)" />
              </SelectTrigger>
              <SelectContent className="bg-charcoal-black border-muted-gray/20 max-h-60">
                <SelectItem value={NONE_VALUE}>None</SelectItem>
                {scenes?.map(scene => (
                  <SelectItem key={scene.id} value={scene.id}>
                    {scene.scene_number} - {scene.slugline || scene.set_name || 'Untitled'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || isSubmitting}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const ShotEditModal: React.FC<ShotEditModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  projectId,
  initialData,
  prefillData,
  title,
  isSubmitting,
  quickAddMode = false,
  onQuickAddModeChange,
}) => {
  const descriptionRef = React.useRef<HTMLTextAreaElement>(null);
  const [shotNumber, setShotNumber] = useState(initialData?.shot_number || '');
  const [sceneNumber, setSceneNumber] = useState(initialData?.scene_number || '');
  const [sceneId, setSceneId] = useState(initialData?.scene_id || '');
  const [cameraLabel, setCameraLabel] = useState(initialData?.camera_label || '');
  const [frameSize, setFrameSize] = useState<ShotFrameSize | typeof NONE_VALUE>(initialData?.frame_size || prefillData?.frame_size || NONE_VALUE);
  const [lens, setLens] = useState(initialData?.lens || prefillData?.lens || '');
  const [focalLength, setFocalLength] = useState(initialData?.focal_length_mm?.toString() || prefillData?.focal_length_mm?.toString() || '');
  const [cameraHeight, setCameraHeight] = useState<ShotCameraHeight | typeof NONE_VALUE>(initialData?.camera_height || prefillData?.camera_height || NONE_VALUE);
  const [movement, setMovement] = useState<ShotMovement | typeof NONE_VALUE>(initialData?.movement || prefillData?.movement || NONE_VALUE);
  const [locationHint, setLocationHint] = useState(initialData?.location_hint || '');
  const [timeOfDay, setTimeOfDay] = useState<ShotTimeOfDay | typeof NONE_VALUE>(initialData?.time_of_day || NONE_VALUE);
  const [description, setDescription] = useState(initialData?.description || '');
  const [technicalNotes, setTechnicalNotes] = useState(initialData?.technical_notes || '');
  const [performanceNotes, setPerformanceNotes] = useState(initialData?.performance_notes || '');
  const [estTime, setEstTime] = useState(initialData?.est_time_minutes?.toString() || prefillData?.est_time_minutes?.toString() || '');

  const { scenes } = useScenes({ projectId });

  // Reset form when initialData changes (for editing)
  React.useEffect(() => {
    if (initialData) {
      setShotNumber(initialData.shot_number || '');
      setSceneNumber(initialData.scene_number || '');
      setSceneId(initialData.scene_id || '');
      setCameraLabel(initialData.camera_label || '');
      setFrameSize(initialData.frame_size || NONE_VALUE);
      setLens(initialData.lens || '');
      setFocalLength(initialData.focal_length_mm?.toString() || '');
      setCameraHeight(initialData.camera_height || NONE_VALUE);
      setMovement(initialData.movement || NONE_VALUE);
      setLocationHint(initialData.location_hint || '');
      setTimeOfDay(initialData.time_of_day || NONE_VALUE);
      setDescription(initialData.description || '');
      setTechnicalNotes(initialData.technical_notes || '');
      setPerformanceNotes(initialData.performance_notes || '');
      setEstTime(initialData.est_time_minutes?.toString() || '');
    }
  }, [initialData]);

  // Update prefilled values when prefillData changes (for quick-add mode)
  React.useEffect(() => {
    if (prefillData && !initialData) {
      setFrameSize(prefillData.frame_size || NONE_VALUE);
      setLens(prefillData.lens || '');
      setFocalLength(prefillData.focal_length_mm?.toString() || '');
      setCameraHeight(prefillData.camera_height || NONE_VALUE);
      setMovement(prefillData.movement || NONE_VALUE);
      setEstTime(prefillData.est_time_minutes?.toString() || '');
      // Clear fields that shouldn't carry over
      setShotNumber('');
      setDescription('');
      setTechnicalNotes('');
      setPerformanceNotes('');
      // Focus description field
      setTimeout(() => descriptionRef.current?.focus(), 100);
    }
  }, [prefillData, initialData]);

  const getData = (): ShotInput => ({
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(getData(), false);
  };

  const handleSaveAndContinue = () => {
    onSubmit(getData(), true);
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
              <Label className="text-bone-white">Scene</Label>
              <Select
                value={sceneId || NONE_VALUE}
                onValueChange={(v) => {
                  if (v === NONE_VALUE) {
                    setSceneId('');
                    setSceneNumber('');
                  } else {
                    const selectedScene = scenes?.find(s => s.id === v);
                    setSceneId(v);
                    setSceneNumber(selectedScene?.scene_number || '');
                  }
                }}
              >
                <SelectTrigger className="bg-charcoal-black border-muted-gray/30 text-bone-white">
                  <SelectValue placeholder="Select scene..." />
                </SelectTrigger>
                <SelectContent className="bg-charcoal-black border-muted-gray/20 max-h-60">
                  <SelectItem value={NONE_VALUE}>None</SelectItem>
                  {scenes?.map((scene) => (
                    <SelectItem key={scene.id} value={scene.id}>
                      {scene.scene_number} - {scene.set_name || scene.synopsis?.slice(0, 30) || 'Untitled'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              ref={descriptionRef}
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

          <DialogFooter className="flex-col sm:flex-row gap-3">
            {/* Quick Add Mode toggle - only for new shots */}
            {!initialData && onQuickAddModeChange && (
              <div className="flex items-center gap-2 mr-auto">
                <Checkbox
                  id="quick-add-mode"
                  checked={quickAddMode}
                  onCheckedChange={(checked) => onQuickAddModeChange(!!checked)}
                />
                <Label htmlFor="quick-add-mode" className="text-sm text-muted-gray cursor-pointer flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Quick Add
                </Label>
              </div>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                {quickAddMode && !initialData ? 'Done' : 'Cancel'}
              </Button>
              {!initialData && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveAndContinue}
                  disabled={isSubmitting}
                  className="border-accent-yellow/50 text-accent-yellow hover:bg-accent-yellow/10"
                >
                  {isSubmitting ? 'Saving...' : 'Save & Add Another'}
                </Button>
              )}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {isSubmitting ? 'Saving...' : initialData ? 'Save Changes' : 'Add Shot'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ShotListDetailView;
