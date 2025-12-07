/**
 * CallSheetSceneLinkModal - Modal for linking/unlinking scenes to a call sheet
 */
import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Film,
  Clock,
  MapPin,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  useScenes,
  useCallSheetSceneLinks,
  useCallSheetSceneLinkMutations,
} from '@/hooks/backlot';
import {
  BacklotScene,
  BacklotCallSheetSceneLink,
  BacklotSceneCoverageStatus,
  SCENE_COVERAGE_STATUS_LABELS,
} from '@/types/backlot';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface CallSheetSceneLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  callSheetId: string;
  projectId: string;
  canEdit: boolean;
}

const TIME_OF_DAY_ICONS: Record<string, React.ElementType> = {
  day: Sun,
  night: Moon,
  dawn: Sunrise,
  dusk: Sunset,
};

const COVERAGE_COLORS: Record<BacklotSceneCoverageStatus, string> = {
  not_scheduled: 'text-muted-gray',
  scheduled: 'text-blue-400',
  shot: 'text-green-400',
  needs_pickup: 'text-orange-400',
};

// Scene row component for the list
const SceneRow: React.FC<{
  scene: BacklotScene;
  isLinked: boolean;
  link?: BacklotCallSheetSceneLink;
  onToggle: () => void;
  onUpdateOrder?: (order: number) => void;
  isLoading?: boolean;
}> = ({ scene, isLinked, link, onToggle, isLoading }) => {
  const TimeIcon = scene.time_of_day ? TIME_OF_DAY_ICONS[scene.time_of_day] || Sun : Sun;

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border transition-colors',
        isLinked
          ? 'bg-accent-yellow/10 border-accent-yellow/30'
          : 'bg-charcoal-black border-muted-gray/20 hover:border-muted-gray/40'
      )}
    >
      <Checkbox
        checked={isLinked}
        onCheckedChange={onToggle}
        disabled={isLoading}
        className="data-[state=checked]:bg-accent-yellow data-[state=checked]:border-accent-yellow"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono shrink-0">
            {scene.scene_number}
          </Badge>
          {scene.int_ext && (
            <span className="text-xs text-muted-gray uppercase">{scene.int_ext}</span>
          )}
          <TimeIcon className="w-3 h-3 text-muted-gray" />
          <Badge
            variant="outline"
            className={cn('text-xs', COVERAGE_COLORS[scene.coverage_status])}
          >
            {SCENE_COVERAGE_STATUS_LABELS[scene.coverage_status]}
          </Badge>
        </div>

        <p className="text-sm text-bone-white font-medium truncate mt-1">
          {scene.scene_heading || scene.location_name || 'Untitled Scene'}
        </p>

        <div className="flex items-center gap-3 mt-1 text-xs text-muted-gray">
          {scene.estimated_duration && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{scene.estimated_duration}m</span>
            </div>
          )}
          {scene.page_count && <span>{scene.page_count} pg</span>}
        </div>
      </div>

      {isLinked && link && (
        <div className="text-xs text-muted-gray">
          #{link.sort_order}
        </div>
      )}

      {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-gray" />}
    </div>
  );
};

const CallSheetSceneLinkModal: React.FC<CallSheetSceneLinkModalProps> = ({
  isOpen,
  onClose,
  callSheetId,
  projectId,
  canEdit,
}) => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [coverageFilter, setCoverageFilter] = useState<BacklotSceneCoverageStatus | 'all'>('all');
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());

  const { scenes, isLoading: scenesLoading } = useScenes({
    projectId,
    coverage_status: coverageFilter !== 'all' ? coverageFilter : undefined,
    search: searchQuery || undefined,
  });

  const { data: linkedScenes, isLoading: linksLoading } = useCallSheetSceneLinks(callSheetId);
  const { linkScene, unlinkScene } = useCallSheetSceneLinkMutations();

  // Create a map of linked scene IDs for quick lookup
  const linkedSceneMap = useMemo(() => {
    const map = new Map<string, BacklotCallSheetSceneLink>();
    linkedScenes?.forEach((link) => {
      map.set(link.scene_id, link);
    });
    return map;
  }, [linkedScenes]);

  // Filter scenes based on search
  const filteredScenes = useMemo(() => {
    if (!scenes) return [];
    return scenes.filter((scene) => !scene.is_omitted);
  }, [scenes]);

  // Separate into linked and available scenes
  const { linkedList, availableList } = useMemo(() => {
    const linked: BacklotScene[] = [];
    const available: BacklotScene[] = [];

    filteredScenes.forEach((scene) => {
      if (linkedSceneMap.has(scene.id)) {
        linked.push(scene);
      } else {
        available.push(scene);
      }
    });

    // Sort linked scenes by sort_order
    linked.sort((a, b) => {
      const orderA = linkedSceneMap.get(a.id)?.sort_order || 0;
      const orderB = linkedSceneMap.get(b.id)?.sort_order || 0;
      return orderA - orderB;
    });

    return { linkedList: linked, availableList: available };
  }, [filteredScenes, linkedSceneMap]);

  const handleToggleScene = async (scene: BacklotScene) => {
    if (!canEdit) return;

    const isLinked = linkedSceneMap.has(scene.id);
    const link = linkedSceneMap.get(scene.id);

    setPendingActions((prev) => new Set(prev).add(scene.id));

    try {
      if (isLinked && link) {
        await unlinkScene.mutateAsync({ linkId: link.id });
        toast({
          title: 'Scene Unlinked',
          description: `Scene ${scene.scene_number} removed from call sheet.`,
        });
      } else {
        const maxOrder = linkedScenes?.reduce((max, l) => Math.max(max, l.sort_order), 0) || 0;
        await linkScene.mutateAsync({
          callSheetId,
          scene_id: scene.id,
          sort_order: maxOrder + 1,
        });
        toast({
          title: 'Scene Linked',
          description: `Scene ${scene.scene_number} added to call sheet.`,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update scene link',
        variant: 'destructive',
      });
    } finally {
      setPendingActions((prev) => {
        const next = new Set(prev);
        next.delete(scene.id);
        return next;
      });
    }
  };

  const isLoading = scenesLoading || linksLoading;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="w-5 h-5" />
            Link Scenes to Call Sheet
          </DialogTitle>
          <DialogDescription>
            Select scenes to include in this call sheet. Linked scenes will be marked as scheduled.
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="flex items-center gap-3 py-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
            <Input
              placeholder="Search scenes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-charcoal-black border-muted-gray/20"
            />
          </div>

          <Select
            value={coverageFilter}
            onValueChange={(v) => setCoverageFilter(v as any)}
          >
            <SelectTrigger className="w-[160px] bg-charcoal-black border-muted-gray/20">
              <SelectValue placeholder="Coverage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="not_scheduled">Not Scheduled</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="shot">Shot</SelectItem>
              <SelectItem value="needs_pickup">Needs Pickup</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 flex flex-col gap-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="space-y-4 pr-4">
                {/* Linked Scenes */}
                {linkedList.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <h4 className="text-sm font-medium text-bone-white">
                        Linked Scenes ({linkedList.length})
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {linkedList.map((scene) => (
                        <SceneRow
                          key={scene.id}
                          scene={scene}
                          isLinked={true}
                          link={linkedSceneMap.get(scene.id)}
                          onToggle={() => handleToggleScene(scene)}
                          isLoading={pendingActions.has(scene.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Available Scenes */}
                {availableList.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-muted-gray" />
                      <h4 className="text-sm font-medium text-bone-white">
                        Available Scenes ({availableList.length})
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {availableList.map((scene) => (
                        <SceneRow
                          key={scene.id}
                          scene={scene}
                          isLinked={false}
                          onToggle={() => handleToggleScene(scene)}
                          isLoading={pendingActions.has(scene.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {filteredScenes.length === 0 && (
                  <div className="text-center py-12 text-muted-gray">
                    <Film className="w-12 h-12 mx-auto mb-4 opacity-40" />
                    <p>No scenes found</p>
                    <p className="text-sm">
                      {searchQuery
                        ? 'Try a different search term'
                        : 'Import or create scenes in the Script section'}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-muted-gray/20">
          <div className="text-sm text-muted-gray">
            {linkedList.length} scene{linkedList.length !== 1 ? 's' : ''} linked
          </div>
          <Button onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CallSheetSceneLinkModal;
