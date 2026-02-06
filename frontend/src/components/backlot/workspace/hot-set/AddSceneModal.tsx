/**
 * AddSceneModal - Modal for adding a scene from another production day to the Hot Set
 *
 * Features:
 * - Select source production day from dropdown
 * - List of available scenes from that day
 * - Search/filter by scene number
 * - Preview selected scene details
 * - Insert position selector
 */
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  Clock,
  Film,
  Loader2,
  Search,
  MapPin,
  FileText,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseLocalDate } from '@/lib/dateUtils';
import {
  useAvailableScenes,
  useAddSceneToHotSet,
  AvailableScene,
  AvailableScenesDay,
} from '@/hooks/backlot';
import { ProjectedScheduleItem } from '@/types/backlot';
import { toast } from 'sonner';

interface AddSceneModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  scheduleItems?: ProjectedScheduleItem[];
  onSuccess?: () => void;
}

export const AddSceneModal: React.FC<AddSceneModalProps> = ({
  open,
  onOpenChange,
  sessionId,
  scheduleItems = [],
  onSuccess,
}) => {
  const [selectedDayId, setSelectedDayId] = useState<string>('');
  const [selectedScene, setSelectedScene] = useState<AvailableScene | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [insertAfterId, setInsertAfterId] = useState<string>('end');
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(30);

  // Fetch available scenes from other production days
  const { data: availableDays, isLoading: isLoadingScenes } = useAvailableScenes(sessionId);

  // Add scene mutation
  const addSceneMutation = useAddSceneToHotSet();

  // Get scenes from selected day
  const selectedDayData = useMemo(() => {
    if (!selectedDayId || !availableDays) return null;
    return availableDays.find(d => d.production_day_id === selectedDayId);
  }, [selectedDayId, availableDays]);

  // Filter scenes by search query
  const filteredScenes = useMemo(() => {
    if (!selectedDayData) return [];
    if (!searchQuery) return selectedDayData.scenes;

    const query = searchQuery.toLowerCase();
    return selectedDayData.scenes.filter(scene =>
      scene.scene_number?.toLowerCase().includes(query) ||
      scene.set_name?.toLowerCase().includes(query) ||
      scene.description?.toLowerCase().includes(query) ||
      scene.slugline?.toLowerCase().includes(query)
    );
  }, [selectedDayData, searchQuery]);

  // Get pending schedule items for insert position
  const pendingItems = useMemo(() => {
    return scheduleItems.filter(item =>
      item.status === 'pending' && item.source_id
    );
  }, [scheduleItems]);

  // Format date for display
  const formatDate = (dateStr: string) => {
    try {
      const date = parseLocalDate(dateStr);
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Reset state when modal closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedDayId('');
      setSelectedScene(null);
      setSearchQuery('');
      setInsertAfterId('end');
      setEstimatedMinutes(30);
    }
    onOpenChange(isOpen);
  };

  // Handle scene selection
  const handleSceneClick = (scene: AvailableScene) => {
    setSelectedScene(scene);
    setEstimatedMinutes(scene.estimated_minutes || 30);
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!selectedScene || !selectedDayId) return;

    try {
      await addSceneMutation.mutateAsync({
        sessionId,
        sceneId: selectedScene.id,
        sourceProductionDayId: selectedDayId,
        insertAfterId: insertAfterId === 'end' ? null : insertAfterId,
        estimatedMinutes,
      });

      toast.success(`Scene ${selectedScene.scene_number} added to schedule`);
      handleOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add scene');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-soft-black border-muted-gray/30 max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-bone-white flex items-center gap-2">
            <Film className="w-5 h-5 text-blue-400" />
            Add Scene to Schedule
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            Select a scene from another production day to add to today's schedule
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Source day selection */}
          <div className="space-y-2">
            <Label className="text-bone-white">Source Production Day</Label>
            <Select value={selectedDayId} onValueChange={(val) => {
              setSelectedDayId(val);
              setSelectedScene(null);
              setSearchQuery('');
            }}>
              <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                <SelectValue placeholder="Select a production day..." />
              </SelectTrigger>
              <SelectContent className="bg-soft-black border-muted-gray/30">
                {isLoadingScenes ? (
                  <div className="p-4 text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-gray" />
                  </div>
                ) : !availableDays || availableDays.length === 0 ? (
                  <div className="p-4 text-center text-muted-gray text-sm">
                    No other days with scenes available
                  </div>
                ) : (
                  availableDays.map(day => (
                    <SelectItem key={day.production_day_id} value={day.production_day_id}>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-gray" />
                        <span>Day {day.day_number}</span>
                        {day.date && (
                          <span className="text-muted-gray">- {formatDate(day.date)}</span>
                        )}
                        <Badge variant="outline" className="ml-2 text-xs">
                          {day.scenes.length} scene{day.scenes.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Scene search and list */}
          {selectedDayId && selectedDayData && (
            <>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                <Input
                  placeholder="Search scenes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-charcoal-black border-muted-gray/30"
                />
              </div>

              {/* Scene list */}
              <div className="space-y-2">
                {filteredScenes.length === 0 ? (
                  <div className="p-4 text-center text-muted-gray text-sm">
                    {searchQuery ? 'No scenes match your search' : 'No scenes available'}
                  </div>
                ) : (
                  filteredScenes.map(scene => (
                    <Card
                      key={scene.id}
                      className={cn(
                        'cursor-pointer transition-all border',
                        selectedScene?.id === scene.id
                          ? 'bg-blue-500/10 border-blue-500/50'
                          : 'bg-charcoal-black/50 border-muted-gray/20 hover:border-muted-gray/40'
                      )}
                      onClick={() => handleSceneClick(scene)}
                    >
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className={cn(
                          'w-8 h-8 rounded flex items-center justify-center flex-shrink-0',
                          selectedScene?.id === scene.id ? 'bg-blue-500' : 'bg-blue-500/20'
                        )}>
                          {selectedScene?.id === scene.id ? (
                            <CheckCircle className="w-4 h-4 text-white" />
                          ) : (
                            <Film className="w-4 h-4 text-blue-400" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-bone-white">
                              {scene.scene_number}
                            </span>
                            {scene.int_ext && (
                              <Badge variant="outline" className="text-xs text-muted-gray">
                                {scene.int_ext}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-gray truncate">
                            {scene.set_name || scene.slugline || scene.description}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-gray flex-shrink-0">
                          <Clock className="w-3 h-3" />
                          <span>{scene.estimated_minutes}m</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </>
          )}

          {/* Selected scene details */}
          {selectedScene && (
            <Card className="bg-blue-500/5 border-blue-500/20">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-bone-white">Selected Scene</h4>
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                    {selectedScene.scene_number}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-gray text-xs">Set/Location</Label>
                    <p className="text-bone-white">
                      {selectedScene.set_name || selectedScene.slugline || '-'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-gray text-xs">Duration (minutes)</Label>
                    <Input
                      type="number"
                      value={estimatedMinutes}
                      onChange={(e) => setEstimatedMinutes(parseInt(e.target.value) || 30)}
                      min={1}
                      max={480}
                      className="mt-1 h-8 bg-charcoal-black border-muted-gray/30"
                    />
                  </div>
                </div>

                {selectedScene.description && (
                  <div>
                    <Label className="text-muted-gray text-xs">Description</Label>
                    <p className="text-bone-white text-sm">{selectedScene.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Insert position */}
          {selectedScene && pendingItems.length > 0 && (
            <div className="space-y-2">
              <Label className="text-bone-white">Insert Position</Label>
              <Select value={insertAfterId} onValueChange={setInsertAfterId}>
                <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-soft-black border-muted-gray/30">
                  <SelectItem value="end">
                    <span className="flex items-center gap-2">
                      <ArrowRight className="w-4 h-4" />
                      Add at the end
                    </span>
                  </SelectItem>
                  {pendingItems.map((item, index) => (
                    <SelectItem key={item.source_id} value={item.source_id!}>
                      <span className="flex items-center gap-2">
                        After {index + 1}. {item.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-gray">
                Choose where to insert the scene in today's schedule
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-muted-gray/20 pt-4">
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={addSceneMutation.isPending}
            className="text-muted-gray hover:text-bone-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedScene || addSceneMutation.isPending}
            className="bg-blue-500 text-white hover:bg-blue-600"
          >
            {addSceneMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Film className="w-4 h-4 mr-2" />
                Add Scene
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
