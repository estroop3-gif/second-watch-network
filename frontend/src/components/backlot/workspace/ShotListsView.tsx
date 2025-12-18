/**
 * ShotListsView - Overview of all shot lists for a project
 * Allows creating, viewing, and managing shot lists
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Plus,
  ClipboardList,
  Calendar,
  Film,
  CheckCircle2,
  Circle,
  Archive,
  MoreHorizontal,
  Eye,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useShotLists, useProductionDays, useScenes } from '@/hooks/backlot';
import {
  BacklotShotList,
  ShotListType,
  SHOT_LIST_TYPE_LABELS,
} from '@/types/backlot';
import { formatDistanceToNow } from 'date-fns';

interface ShotListsViewProps {
  projectId: string;
  canEdit?: boolean;
  onSelectShotList?: (shotList: BacklotShotList) => void;
}

const ShotListsView: React.FC<ShotListsViewProps> = ({
  projectId,
  canEdit = false,
  onSelectShotList,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedShotList, setSelectedShotList] = useState<BacklotShotList | null>(null);

  const { shotLists, isLoading, createShotList, archiveShotList } = useShotLists({
    projectId,
    includeArchived: showArchived,
  });

  const handleArchive = async (shotList: BacklotShotList) => {
    try {
      await archiveShotList.mutateAsync({
        shotListId: shotList.id,
        isArchived: !shotList.is_archived,
      });
    } catch (error) {
      console.error('Error archiving shot list:', error);
    }
  };

  // Separate active and archived lists
  const activeLists = shotLists.filter(sl => !sl.is_archived);
  const archivedLists = shotLists.filter(sl => sl.is_archived);

  const handleCreateShotList = async (data: {
    title: string;
    description?: string;
    list_type?: ShotListType;
    production_day_id?: string;
    scene_id?: string;
  }) => {
    try {
      const result = await createShotList.mutateAsync(data);
      setShowCreateModal(false);
      if (result && onSelectShotList) {
        onSelectShotList(result);
      }
    } catch (error) {
      console.error('Error creating shot list:', error);
    }
  };

  const handleSelectShotList = (shotList: BacklotShotList) => {
    setSelectedShotList(shotList);
    if (onSelectShotList) {
      onSelectShotList(shotList);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading text-bone-white">Shot Lists</h2>
          <p className="text-sm text-muted-gray mt-1">
            Professional shot planning for DPs, Directors, and 1st ADs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
            className={showArchived ? 'border-accent-yellow text-accent-yellow' : ''}
          >
            <Archive className="w-4 h-4 mr-2" />
            {showArchived ? 'Hide Archived' : 'Show Archived'}
          </Button>
          {canEdit && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Shot List
            </Button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {activeLists.length === 0 && !showArchived && (
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="w-12 h-12 text-muted-gray mb-4" />
            <h3 className="text-lg font-medium text-bone-white mb-2">No Shot Lists Yet</h3>
            <p className="text-muted-gray text-center max-w-md mb-4">
              Create your first shot list to start planning your shots. Organize by day, scene, or sequence.
            </p>
            {canEdit && (
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Shot List
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Shot Lists Grid */}
      {activeLists.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeLists.map(shotList => (
            <ShotListCard
              key={shotList.id}
              shotList={shotList}
              onClick={() => handleSelectShotList(shotList)}
              canEdit={canEdit}
              onArchive={() => handleArchive(shotList)}
            />
          ))}
        </div>
      )}

      {/* Archived Lists */}
      {showArchived && archivedLists.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-muted-gray flex items-center gap-2">
            <Archive className="w-4 h-4" />
            Archived Shot Lists
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {archivedLists.map(shotList => (
              <ShotListCard
                key={shotList.id}
                shotList={shotList}
                onClick={() => handleSelectShotList(shotList)}
                canEdit={canEdit}
                isArchived
                onArchive={() => handleArchive(shotList)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Create Shot List Modal */}
      <CreateShotListModal
        projectId={projectId}
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateShotList}
        isSubmitting={createShotList.isPending}
      />
    </div>
  );
};

// Shot List Card Component
interface ShotListCardProps {
  shotList: BacklotShotList;
  onClick: () => void;
  canEdit?: boolean;
  isArchived?: boolean;
  onArchive?: () => void;
}

const ShotListCard: React.FC<ShotListCardProps> = ({
  shotList,
  onClick,
  canEdit,
  isArchived,
  onArchive,
}) => {
  const completionPercent = shotList.shot_count && shotList.shot_count > 0
    ? Math.round((shotList.completed_count || 0) / shotList.shot_count * 100)
    : 0;

  return (
    <Card
      className={`bg-charcoal-black border-muted-gray/20 hover:border-accent-yellow/50 transition-colors cursor-pointer ${
        isArchived ? 'opacity-60' : ''
      }`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-bone-white text-lg truncate">
              {shotList.title}
            </CardTitle>
            {shotList.list_type && (
              <Badge
                variant="outline"
                className="mt-1 text-xs border-muted-gray/30 text-muted-gray"
              >
                {SHOT_LIST_TYPE_LABELS[shotList.list_type]}
              </Badge>
            )}
          </div>
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-charcoal-black border-muted-gray/20">
                <DropdownMenuItem onClick={e => { e.stopPropagation(); onClick(); }}>
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={e => {
                    e.stopPropagation();
                    onArchive?.();
                  }}
                  className="text-red-400"
                >
                  <Archive className="w-4 h-4 mr-2" />
                  {isArchived ? 'Unarchive' : 'Archive'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {shotList.description && (
          <p className="text-sm text-muted-gray line-clamp-2">
            {shotList.description}
          </p>
        )}

        {/* Linked Items */}
        <div className="flex flex-wrap gap-2">
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

        {/* Shot Count & Progress */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-gray">
            <span>{shotList.shot_count || 0} shots</span>
            {shotList.shot_count && shotList.shot_count > 0 && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  {completionPercent === 100 ? (
                    <CheckCircle2 className="w-3 h-3 text-green-400" />
                  ) : (
                    <Circle className="w-3 h-3" />
                  )}
                  {completionPercent}% done
                </span>
              </>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {shotList.shot_count && shotList.shot_count > 0 && (
          <div className="w-full h-1.5 bg-muted-gray/20 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                completionPercent === 100 ? 'bg-green-500' : 'bg-accent-yellow'
              }`}
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        )}

        {/* Footer */}
        <div className="text-xs text-muted-gray pt-2 border-t border-muted-gray/10">
          Updated {formatDistanceToNow(new Date(shotList.updated_at), { addSuffix: true })}
        </div>
      </CardContent>
    </Card>
  );
};

// Create Shot List Modal
interface CreateShotListModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    list_type?: ShotListType;
    production_day_id?: string;
    scene_id?: string;
  }) => void;
  isSubmitting?: boolean;
}

const NONE_VALUE = '__none__';

const CreateShotListModal: React.FC<CreateShotListModalProps> = ({
  projectId,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [listType, setListType] = useState<ShotListType | typeof NONE_VALUE>(NONE_VALUE);
  const [productionDayId, setProductionDayId] = useState(NONE_VALUE);
  const [sceneId, setSceneId] = useState(NONE_VALUE);

  // Fetch production days and scenes for dropdowns
  const { data: productionDays } = useProductionDays(projectId);
  const { scenes } = useScenes({ projectId });

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

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setListType(NONE_VALUE);
    setProductionDayId(NONE_VALUE);
    setSceneId(NONE_VALUE);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-charcoal-black border-muted-gray/20 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-bone-white">Create Shot List</DialogTitle>
          <DialogDescription className="text-muted-gray">
            Create a new shot list to plan your shots. You can organize by day, scene, or sequence.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-bone-white">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Day 3 - Church Interior"
              className="bg-charcoal-black border-muted-gray/30 text-bone-white"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-bone-white">Description</Label>
            <Textarea
              id="description"
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
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || isSubmitting}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {isSubmitting ? 'Creating...' : 'Create Shot List'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ShotListsView;
