/**
 * SwapSceneDialog - Dialog for swapping a scene with one from another production day
 *
 * Features:
 * - Two-column view: Current day scene | Other day scene
 * - Auto-suggest matching scenes based on:
 *   - Similar duration (within 15 minutes)
 *   - Same set/location
 *   - Available on adjacent days
 * - Duration comparison display
 * - Click to select swap pair
 */
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  ArrowLeftRight,
  ArrowRight,
  Check,
  Star,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseLocalDate } from '@/lib/dateUtils';
import {
  useAvailableScenes,
  useSwapScenes,
  useSwapSuggestions,
  AvailableScene,
  AvailableScenesDay,
  SwapSuggestion,
} from '@/hooks/backlot';
import { HotSetSceneLog } from '@/types/backlot';
import { toast } from 'sonner';

interface SwapSceneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  sceneToSwap: HotSetSceneLog;
  onSuccess?: () => void;
}

export const SwapSceneDialog: React.FC<SwapSceneDialogProps> = ({
  open,
  onOpenChange,
  sessionId,
  sceneToSwap,
  onSuccess,
}) => {
  const [selectedDayId, setSelectedDayId] = useState<string>('');
  const [selectedScene, setSelectedScene] = useState<SwapSuggestion | AvailableScene | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'suggestions' | 'browse'>('suggestions');

  // Fetch available scenes from other production days
  const { data: availableDays, isLoading: isLoadingScenes } = useAvailableScenes(sessionId);

  // Fetch swap suggestions
  const { data: suggestionsData, isLoading: isLoadingSuggestions } = useSwapSuggestions(
    sessionId,
    sceneToSwap.id
  );

  // Swap scenes mutation
  const swapMutation = useSwapScenes();

  // Get scenes from selected day (for browse tab)
  const selectedDayData = useMemo(() => {
    if (!selectedDayId || !availableDays) return null;
    return availableDays.find(d => d.production_day_id === selectedDayId);
  }, [selectedDayId, availableDays]);

  // Filter scenes by search query (for browse tab)
  const filteredScenes = useMemo(() => {
    if (!selectedDayData) return [];
    if (!searchQuery) return selectedDayData.scenes;

    const query = searchQuery.toLowerCase();
    return selectedDayData.scenes.filter(scene =>
      scene.scene_number?.toLowerCase().includes(query) ||
      scene.set_name?.toLowerCase().includes(query) ||
      scene.description?.toLowerCase().includes(query)
    );
  }, [selectedDayData, searchQuery]);

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
      setActiveTab('suggestions');
    }
    onOpenChange(isOpen);
  };

  // Handle swap
  const handleSwap = async () => {
    if (!selectedScene) return;

    // Determine the scene ID and source day ID based on selection type
    const sceneId = 'match_score' in selectedScene
      ? (selectedScene as SwapSuggestion).scene_id
      : (selectedScene as AvailableScene).id;

    const sourceDayId = 'match_score' in selectedScene
      ? (selectedScene as SwapSuggestion).production_day_id
      : selectedDayId;

    try {
      await swapMutation.mutateAsync({
        sessionId,
        sceneToRemoveId: sceneToSwap.id,
        sceneToAddId: sceneId,
        sourceProductionDayId: sourceDayId,
      });

      toast.success(`Swapped ${sceneToSwap.scene_number} with ${selectedScene.scene_number}`);
      handleOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to swap scenes');
    }
  };

  const currentSceneDuration = sceneToSwap.estimated_minutes || 30;
  const selectedSceneDuration = selectedScene?.estimated_minutes || 0;
  const durationDiff = selectedSceneDuration - currentSceneDuration;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-soft-black border-muted-gray/30 max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-bone-white flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-accent-yellow" />
            Swap Scene
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            Exchange {sceneToSwap.scene_number} with a scene from another day
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Current scene card */}
          <Card className="bg-charcoal-black/50 border-muted-gray/20 mb-4">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm text-muted-gray">Current Scene (to be swapped out)</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Film className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-bone-white text-lg">
                      {sceneToSwap.scene_number}
                    </span>
                    {sceneToSwap.int_ext && (
                      <Badge variant="outline" className="text-xs">
                        {sceneToSwap.int_ext}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-gray">
                    {sceneToSwap.set_name || sceneToSwap.description}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-muted-gray">
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">{currentSceneDuration}m</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs for suggestions vs browse */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'suggestions' | 'browse')}>
            <TabsList className="w-full bg-charcoal-black/50">
              <TabsTrigger value="suggestions" className="flex-1">
                <Sparkles className="w-4 h-4 mr-2" />
                Suggestions
              </TabsTrigger>
              <TabsTrigger value="browse" className="flex-1">
                <Search className="w-4 h-4 mr-2" />
                Browse All
              </TabsTrigger>
            </TabsList>

            {/* Suggestions tab */}
            <TabsContent value="suggestions" className="mt-4 space-y-2">
              {isLoadingSuggestions ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-gray" />
                  <p className="text-sm text-muted-gray mt-2">Finding matching scenes...</p>
                </div>
              ) : !suggestionsData?.suggestions || suggestionsData.suggestions.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-muted-gray">No matching scenes found</p>
                  <p className="text-sm text-muted-gray/70 mt-1">
                    Try browsing all available scenes
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {suggestionsData.suggestions.map(suggestion => {
                    const isSelected = selectedScene &&
                      'match_score' in selectedScene &&
                      (selectedScene as SwapSuggestion).scene_id === suggestion.scene_id;

                    return (
                      <Card
                        key={suggestion.scene_id}
                        className={cn(
                          'cursor-pointer transition-all border',
                          isSelected
                            ? 'bg-accent-yellow/10 border-accent-yellow/50'
                            : 'bg-charcoal-black/50 border-muted-gray/20 hover:border-muted-gray/40'
                        )}
                        onClick={() => setSelectedScene(suggestion)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                              isSelected ? 'bg-accent-yellow' : 'bg-blue-500/20'
                            )}>
                              {isSelected ? (
                                <Check className="w-5 h-5 text-charcoal-black" />
                              ) : (
                                <Film className="w-5 h-5 text-blue-400" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-bone-white">
                                  {suggestion.scene_number}
                                </span>
                                {suggestion.int_ext && (
                                  <Badge variant="outline" className="text-xs text-muted-gray">
                                    {suggestion.int_ext}
                                  </Badge>
                                )}
                                {suggestion.time_of_day && (
                                  <Badge variant="outline" className="text-xs text-muted-gray">
                                    {suggestion.time_of_day}
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-xs text-blue-400 border-blue-500/30">
                                  Day {suggestion.day_number}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-gray truncate">
                                {suggestion.set_name || suggestion.description}
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {suggestion.match_reasons.map((reason, i) => (
                                  <Badge
                                    key={i}
                                    variant="outline"
                                    className="text-xs bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30"
                                  >
                                    <Star className="w-3 h-3 mr-1" />
                                    {reason}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            <div className="text-right flex-shrink-0">
                              <div className="flex items-center gap-1 text-muted-gray">
                                <Clock className="w-4 h-4" />
                                <span className="font-medium">{suggestion.estimated_minutes}m</span>
                              </div>
                              {suggestion.date && (
                                <div className="text-xs text-muted-gray mt-1">
                                  {formatDate(suggestion.date)}
                                </div>
                              )}
                              {/* Match quality indicator */}
                              <div className={cn(
                                'text-xs font-medium mt-1 px-2 py-0.5 rounded-full',
                                suggestion.match_score >= 70 ? 'bg-green-500/20 text-green-400' :
                                suggestion.match_score >= 40 ? 'bg-accent-yellow/20 text-accent-yellow' :
                                'bg-muted-gray/20 text-muted-gray'
                              )}>
                                {suggestion.match_score >= 70 ? 'Great' :
                                 suggestion.match_score >= 40 ? 'Good' : 'Fair'} match
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Browse all tab */}
            <TabsContent value="browse" className="mt-4 space-y-4">
              {/* Day selector */}
              <div className="space-y-2">
                <Label className="text-bone-white">Production Day</Label>
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

              {/* Scene list */}
              {selectedDayId && selectedDayData && (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                    <Input
                      placeholder="Search scenes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 bg-charcoal-black border-muted-gray/30"
                    />
                  </div>

                  <div className="space-y-2">
                    {filteredScenes.length === 0 ? (
                      <div className="p-4 text-center text-muted-gray text-sm">
                        {searchQuery ? 'No scenes match your search' : 'No scenes available'}
                      </div>
                    ) : (
                      filteredScenes.map(scene => {
                        const isSelected = selectedScene &&
                          !('match_score' in selectedScene) &&
                          (selectedScene as AvailableScene).id === scene.id;

                        return (
                          <Card
                            key={scene.id}
                            className={cn(
                              'cursor-pointer transition-all border',
                              isSelected
                                ? 'bg-accent-yellow/10 border-accent-yellow/50'
                                : 'bg-charcoal-black/50 border-muted-gray/20 hover:border-muted-gray/40'
                            )}
                            onClick={() => setSelectedScene(scene)}
                          >
                            <CardContent className="p-3 flex items-center gap-3">
                              <div className={cn(
                                'w-8 h-8 rounded flex items-center justify-center flex-shrink-0',
                                isSelected ? 'bg-accent-yellow' : 'bg-blue-500/20'
                              )}>
                                {isSelected ? (
                                  <Check className="w-4 h-4 text-charcoal-black" />
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
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>

          {/* Duration comparison */}
          {selectedScene && (
            <Card className="mt-4 bg-soft-black border-muted-gray/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <p className="text-xs text-muted-gray mb-1">Current</p>
                    <p className="text-lg font-bold text-bone-white">{currentSceneDuration}m</p>
                    <p className="text-sm text-muted-gray">{sceneToSwap.scene_number}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <ArrowRight className="w-5 h-5 text-muted-gray" />
                    <div className={cn(
                      'px-3 py-1 rounded-full text-sm font-medium',
                      durationDiff > 0
                        ? 'bg-red-500/20 text-red-400'
                        : durationDiff < 0
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-muted-gray/20 text-muted-gray'
                    )}>
                      {durationDiff > 0 ? '+' : ''}{durationDiff}m
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-gray" />
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-muted-gray mb-1">New</p>
                    <p className="text-lg font-bold text-accent-yellow">{selectedSceneDuration}m</p>
                    <p className="text-sm text-muted-gray">{selectedScene.scene_number}</p>
                  </div>
                </div>
                {durationDiff !== 0 && (
                  <p className="text-xs text-muted-gray text-center mt-2">
                    {durationDiff > 0
                      ? `New scene is ${durationDiff} minutes longer`
                      : `New scene is ${Math.abs(durationDiff)} minutes shorter`
                    }
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="border-t border-muted-gray/20 pt-4">
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={swapMutation.isPending}
            className="text-muted-gray hover:text-bone-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSwap}
            disabled={!selectedScene || swapMutation.isPending}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
          >
            {swapMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Swapping...
              </>
            ) : (
              <>
                <ArrowLeftRight className="w-4 h-4 mr-2" />
                Swap Scenes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
