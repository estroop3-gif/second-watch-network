/**
 * ScheduleView - Manage production days/schedule with scene assignment
 */
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Calendar,
  Plus,
  Clock,
  MapPin,
  Check,
  CheckCircle2,
  MoreVertical,
  Edit,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronRight,
  Film,
  FileText,
  List,
  CalendarDays,
  X,
  GripVertical,
  FileSpreadsheet,
  ExternalLink,
  Wand2,
  Lightbulb,
  Layers,
  ListChecks,
  Target,
  Users,
} from 'lucide-react';
import { AutoSchedulerWizard } from './schedule/AutoSchedulerWizard';
import { SyncStatusBadge } from './SyncStatusBadge';
import { BidirectionalSyncModal } from './BidirectionalSyncModal';
import { RefreshCw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  useProductionDays,
  useProductionDayScenes,
  useUnassignedScenes,
  useLinkedCallSheet,
  useCreateCallSheetFromDay,
} from '@/hooks/backlot';
import { BacklotProductionDay, ProductionDayInput, ProductionDayScene } from '@/types/backlot';
import { format, isBefore, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';

interface ScheduleViewProps {
  projectId: string;
  canEdit: boolean;
}

type ViewMode = 'list' | 'calendar';

// Scene item for assignment panel
interface SceneItem {
  id: string;
  scene_number: string;
  slugline: string | null;
  set_name: string | null;
  page_length: number | null;
  int_ext: string | null;
  time_of_day: string | null;
}

// =====================================================
// Scene Assignment Panel
// =====================================================

const SceneAssignmentPanel: React.FC<{
  dayId: string;
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  canEdit: boolean;
}> = ({ dayId, projectId, isOpen, onClose, canEdit }) => {
  const { scenes: assignedScenes, isLoading: loadingAssigned, addScene, removeScene } = useProductionDayScenes(dayId);
  const { data: unassignedScenes, isLoading: loadingUnassigned } = useUnassignedScenes(projectId);

  const handleAddScene = async (sceneId: string) => {
    try {
      await addScene.mutateAsync({ scene_id: sceneId });
    } catch (err) {
      console.error('Failed to add scene:', err);
    }
  };

  const handleRemoveScene = async (sceneId: string) => {
    try {
      await removeScene.mutateAsync(sceneId);
    } catch (err) {
      console.error('Failed to remove scene:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="bg-charcoal-black/80 border border-muted-gray/30 rounded-lg mt-4 p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-bone-white">Scene Assignment</h4>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Assigned Scenes */}
        <div>
          <h5 className="text-xs font-medium text-muted-gray mb-2">Assigned to this day</h5>
          <ScrollArea className="h-48 border border-muted-gray/20 rounded-md">
            {loadingAssigned ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : assignedScenes.length === 0 ? (
              <div className="p-4 text-center text-muted-gray text-sm">
                No scenes assigned
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {assignedScenes.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-2 bg-muted-gray/10 rounded-md group hover:bg-muted-gray/20"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <GripVertical className="w-3 h-3 text-muted-gray/50 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-accent-yellow">
                          {assignment.scene?.scene_number}
                        </span>
                        <span className="text-xs text-muted-gray ml-2 truncate">
                          {assignment.scene?.slugline || assignment.scene?.set_name}
                        </span>
                      </div>
                    </div>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                        onClick={() => handleRemoveScene(assignment.scene_id)}
                      >
                        <X className="w-3 h-3 text-red-400" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Unassigned Scenes */}
        <div>
          <h5 className="text-xs font-medium text-muted-gray mb-2">Unassigned scenes</h5>
          <ScrollArea className="h-48 border border-muted-gray/20 rounded-md">
            {loadingUnassigned ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : !unassignedScenes || unassignedScenes.length === 0 ? (
              <div className="p-4 text-center text-muted-gray text-sm">
                All scenes assigned
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {(unassignedScenes as SceneItem[]).map((scene) => (
                  <div
                    key={scene.id}
                    className="flex items-center justify-between p-2 bg-muted-gray/10 rounded-md group hover:bg-muted-gray/20"
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-bone-white">
                        {scene.scene_number}
                      </span>
                      <span className="text-xs text-muted-gray ml-2 truncate">
                        {scene.slugline || scene.set_name}
                      </span>
                      {scene.page_length && (
                        <span className="text-xs text-muted-gray/60 ml-1">
                          ({scene.page_length} pgs)
                        </span>
                      )}
                    </div>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 h-6 px-2"
                        onClick={() => handleAddScene(scene.id)}
                        disabled={addScene.isPending}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};

// =====================================================
// Day Detail Modal (Read-Only View)
// =====================================================

const DayDetailModal: React.FC<{
  day: BacklotProductionDay | null;
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
}> = ({ day, projectId, isOpen, onClose, onEdit, onDelete, canEdit }) => {
  const { scenes, isLoading: scenesLoading, error: scenesError } = useProductionDayScenes(day?.id || '');
  const { data: linkedData } = useLinkedCallSheet(day?.id || '');

  if (!day) return null;

  const dayDate = new Date(day.date);
  const totalPages = scenes.reduce((sum, s) => sum + (s.scene?.page_length || 0), 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-2xl font-bold text-accent-yellow">Day {day.day_number}</span>
            {day.is_completed && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                <Check className="w-3 h-3 mr-1" />
                Complete
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          {day.title && (
            <div>
              <h3 className="text-lg font-semibold text-bone-white">{day.title}</h3>
            </div>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-muted-gray">
              <Calendar className="w-4 h-4" />
              <span>{format(dayDate, 'EEEE, MMMM d, yyyy')}</span>
            </div>
            {day.general_call_time && (
              <div className="flex items-center gap-2 text-muted-gray">
                <Clock className="w-4 h-4" />
                <span>Call: {day.general_call_time}</span>
              </div>
            )}
            {day.wrap_time && (
              <div className="flex items-center gap-2 text-muted-gray">
                <Clock className="w-4 h-4" />
                <span>Wrap: {day.wrap_time}</span>
              </div>
            )}
          </div>

          {/* Location */}
          {(day.location_name || day.location_address) && (
            <div className="flex items-start gap-2 text-muted-gray">
              <MapPin className="w-4 h-4 mt-0.5" />
              <div>
                {day.location_name && <p className="text-bone-white">{day.location_name}</p>}
                {day.location_address && <p className="text-sm">{day.location_address}</p>}
              </div>
            </div>
          )}

          {/* Description */}
          {day.description && (
            <div className="bg-charcoal-black/30 rounded-lg p-3">
              <p className="text-sm text-muted-gray">{day.description}</p>
            </div>
          )}

          {/* Scenes Summary */}
          <div className="border-t border-muted-gray/20 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-bone-white">Scenes</h4>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs">
                  <Film className="w-3 h-3 mr-1" />
                  {scenes.length} scene{scenes.length !== 1 ? 's' : ''}
                </Badge>
                {totalPages > 0 && (
                  <Badge variant="outline" className="text-xs">
                    <FileText className="w-3 h-3 mr-1" />
                    {totalPages.toFixed(1)} pages
                  </Badge>
                )}
              </div>
            </div>
            {scenes.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {scenes.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-2 bg-muted-gray/10 rounded-md"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-accent-yellow min-w-[3rem]">
                        {s.scene?.scene_number}
                      </span>
                      <span className="text-sm text-bone-white truncate max-w-[200px]">
                        {s.scene?.slugline || s.scene?.set_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.scene?.int_ext && (
                        <Badge variant="outline" className="text-[10px]">
                          {s.scene.int_ext}
                        </Badge>
                      )}
                      {s.scene?.page_length && (
                        <span className="text-xs text-muted-gray">
                          {s.scene.page_length} pgs
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-gray">No scenes assigned to this day</p>
            )}
          </div>

          {/* Call Sheet Link */}
          {linkedData?.hasCallSheet && (
            <div className="border-t border-muted-gray/20 pt-4">
              <a
                href={`/backlot/${projectId}/call-sheets/${linkedData.callSheet?.id}`}
                className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>View Linked Call Sheet</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <DialogFooter className="flex gap-2 sm:justify-between">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {canEdit && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="text-red-400 border-red-400/30 hover:bg-red-500/10"
                onClick={onDelete}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
              <Button
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                onClick={onEdit}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Day
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// =====================================================
// Enhanced Day Card with Scene Preview
// =====================================================

const DayCard: React.FC<{
  day: BacklotProductionDay;
  projectId: string;
  canEdit: boolean;
  onEdit: (day: BacklotProductionDay) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onViewDetail: (day: BacklotProductionDay) => void;
}> = ({ day, projectId, canEdit, onEdit, onToggleComplete, onDelete, onViewDetail }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showScenePanel, setShowScenePanel] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const { scenes, isLoading: loadingScenes } = useProductionDayScenes(day.id);
  const { data: linkedData } = useLinkedCallSheet(day.id);
  const createCallSheet = useCreateCallSheetFromDay(day.id);

  const today = new Date();
  const dayDate = new Date(day.date);
  const isPast = isBefore(dayDate, today) && !day.is_completed;
  const isToday = format(dayDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');

  // Calculate total page count
  const totalPages = useMemo(() => {
    return scenes.reduce((sum, s) => sum + (s.scene?.page_length || 0), 0);
  }, [scenes]);

  const handleCreateCallSheet = async () => {
    try {
      await createCallSheet.mutateAsync({ include_scenes: true });
    } catch (err) {
      console.error('Failed to create call sheet:', err);
    }
  };

  return (
    <div
      className={cn(
        'bg-charcoal-black/50 border rounded-lg transition-colors',
        day.is_completed
          ? 'border-green-500/30 bg-green-500/5'
          : isToday
          ? 'border-accent-yellow/50'
          : isPast
          ? 'border-orange-500/30'
          : 'border-muted-gray/20 hover:border-muted-gray/40'
      )}
    >
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div
              className="flex-1 cursor-pointer"
              onClick={() => onViewDetail(day)}
            >
              {/* Day Number & Badges */}
              <div className="flex items-center gap-2 mb-1">
                <button
                  className="flex items-center gap-1 hover:opacity-80"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-gray" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-gray" />
                  )}
                </button>
                <span className="text-lg font-bold text-accent-yellow">Day {day.day_number}</span>

                {/* Scene Count Badge */}
                {scenes.length > 0 && (
                  <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
                    <Film className="w-3 h-3 mr-1" />
                    {scenes.length} scene{scenes.length !== 1 ? 's' : ''}
                  </Badge>
                )}
                {totalPages > 0 && (
                  <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/30">
                    <FileText className="w-3 h-3 mr-1" />
                    {totalPages.toFixed(1)} pgs
                  </Badge>
                )}
                {/* Call Sheet Linked Badge */}
                {linkedData?.hasCallSheet && (
                  <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                    <FileSpreadsheet className="w-3 h-3 mr-1" />
                    Call Sheet
                  </Badge>
                )}

                {/* Sync Status Badge */}
                <SyncStatusBadge
                  dayId={day.id}
                  onSyncClick={() => setShowSyncModal(true)}
                  showQuickSync={linkedData?.hasCallSheet}
                />

                {day.is_completed && (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    <Check className="w-3 h-3 mr-1" />
                    Complete
                  </Badge>
                )}
                {isToday && !day.is_completed && (
                  <Badge className="bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30">
                    Today
                  </Badge>
                )}
                {isPast && (
                  <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                    Past Due
                  </Badge>
                )}
              </div>

              {/* Title */}
              {day.title && <h4 className="font-medium text-bone-white mb-2">{day.title}</h4>}

              {/* Date & Time */}
              <div className="flex flex-wrap gap-4 text-sm text-muted-gray">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(day.date), 'EEEE, MMMM d, yyyy')}
                </div>
                {day.general_call_time && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Call: {day.general_call_time}
                    {day.wrap_time && ` - Wrap: ${day.wrap_time}`}
                  </div>
                )}
              </div>

              {/* Location */}
              {(day.location_name || day.location_address) && (
                <div className="flex items-center gap-1 text-sm text-muted-gray mt-2">
                  <MapPin className="w-4 h-4" />
                  {day.location_name}
                  {day.location_address && ` • ${day.location_address}`}
                </div>
              )}

              {/* Scene Preview (collapsed view) */}
              {!isExpanded && scenes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {scenes.slice(0, 5).map((s) => (
                    <span
                      key={s.id}
                      className="text-xs px-2 py-0.5 bg-muted-gray/10 rounded-md text-muted-gray"
                    >
                      {s.scene?.scene_number}
                    </span>
                  ))}
                  {scenes.length > 5 && (
                    <span className="text-xs px-2 py-0.5 text-muted-gray">
                      +{scenes.length - 5} more
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <>
                    <DropdownMenuItem onClick={() => setShowScenePanel(!showScenePanel)}>
                      <Film className="w-4 h-4 mr-2" />
                      {showScenePanel ? 'Hide' : 'Assign'} Scenes
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {/* Call Sheet Integration */}
                    {linkedData?.hasCallSheet ? (
                      <>
                        <DropdownMenuItem asChild>
                          <a
                            href={`/backlot/${projectId}/call-sheets/${linkedData.callSheet?.id}`}
                            className="flex items-center"
                          >
                            <FileSpreadsheet className="w-4 h-4 mr-2" />
                            View Call Sheet
                            <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShowSyncModal(true)}>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Sync with Call Sheet
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <DropdownMenuItem
                        onClick={handleCreateCallSheet}
                        disabled={createCallSheet.isPending}
                      >
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        {createCallSheet.isPending ? 'Creating...' : 'Create Call Sheet'}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onEdit(day)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Day
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onToggleComplete(day.id, !day.is_completed)}>
                      <Check className="w-4 h-4 mr-2" />
                      {day.is_completed ? 'Mark Incomplete' : 'Mark Complete'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-400" onClick={() => onDelete(day.id)}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
                {!canEdit && (
                  <>
                    <DropdownMenuItem onClick={() => setShowScenePanel(!showScenePanel)}>
                      <Film className="w-4 h-4 mr-2" />
                      View Scenes
                    </DropdownMenuItem>
                    {linkedData?.hasCallSheet && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <a
                            href={`/backlot/${projectId}/call-sheets/${linkedData.callSheet?.id}`}
                            className="flex items-center"
                          >
                            <FileSpreadsheet className="w-4 h-4 mr-2" />
                            View Call Sheet
                            <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                          </a>
                        </DropdownMenuItem>
                      </>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Expanded Content */}
        <CollapsibleContent>
          <div className="px-4 pb-4 border-t border-muted-gray/20 pt-4">
            {/* Description */}
            {day.description && (
              <p className="text-sm text-muted-gray mb-4">{day.description}</p>
            )}

            {/* Full Scene List */}
            <div>
              <h5 className="text-sm font-medium text-bone-white mb-2">
                Scenes ({scenes.length})
              </h5>
              {loadingScenes ? (
                <Skeleton className="h-20 w-full" />
              ) : scenes.length === 0 ? (
                <p className="text-sm text-muted-gray">No scenes assigned to this day</p>
              ) : (
                <div className="space-y-2">
                  {scenes.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-2 bg-muted-gray/10 rounded-md"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-accent-yellow min-w-[3rem]">
                          {s.scene?.scene_number}
                        </span>
                        <div>
                          <span className="text-sm text-bone-white">
                            {s.scene?.slugline || s.scene?.set_name}
                          </span>
                          {s.scene?.int_ext && (
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              {s.scene?.int_ext}
                            </Badge>
                          )}
                          {s.scene?.time_of_day && (
                            <Badge variant="outline" className="ml-1 text-[10px]">
                              {s.scene?.time_of_day}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {s.scene?.page_length && (
                        <span className="text-xs text-muted-gray">
                          {s.scene.page_length} pgs
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Scene Assignment Panel */}
      {showScenePanel && (
        <div className="px-4 pb-4">
          <SceneAssignmentPanel
            dayId={day.id}
            projectId={projectId}
            isOpen={showScenePanel}
            onClose={() => setShowScenePanel(false)}
            canEdit={canEdit}
          />
        </div>
      )}

      {/* Bidirectional Sync Modal */}
      <BidirectionalSyncModal
        dayId={day.id}
        open={showSyncModal}
        onOpenChange={setShowSyncModal}
      />
    </div>
  );
};

// =====================================================
// Calendar View
// =====================================================

const CalendarView: React.FC<{
  days: BacklotProductionDay[];
  projectId: string;
  canEdit: boolean;
  onDayClick: (day: BacklotProductionDay) => void;
  onAddDay: (date: Date) => void;
}> = ({ days, projectId, canEdit, onDayClick, onAddDay }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const daysByDate = useMemo(() => {
    const map = new Map<string, BacklotProductionDay[]>();
    days.forEach((day) => {
      const key = format(new Date(day.date), 'yyyy-MM-dd');
      const existing = map.get(key) || [];
      existing.push(day);
      map.set(key, existing);
    });
    return map;
  }, [days]);

  const today = new Date();

  return (
    <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronRight className="w-4 h-4 rotate-180" />
        </Button>
        <h3 className="text-lg font-medium text-bone-white">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-xs text-muted-gray font-medium py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells for days before the first of the month */}
        {Array.from({ length: calendarDays[0].getDay() }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}

        {calendarDays.map((date) => {
          const dateKey = format(date, 'yyyy-MM-dd');
          const productionDays = daysByDate.get(dateKey) || [];
          const isCurrentMonth = isSameMonth(date, currentMonth);
          const isCurrentDay = isSameDay(date, today);

          return (
            <div
              key={dateKey}
              className={cn(
                'aspect-square p-1 border rounded-md relative group cursor-pointer transition-colors',
                isCurrentMonth ? 'bg-charcoal-black/30' : 'bg-charcoal-black/10 opacity-50',
                isCurrentDay && 'border-accent-yellow',
                productionDays.length > 0 && 'border-blue-500/50 bg-blue-500/10',
                'hover:bg-muted-gray/20'
              )}
              onClick={() => {
                if (productionDays.length > 0) {
                  onDayClick(productionDays[0]);
                } else if (canEdit) {
                  onAddDay(date);
                }
              }}
            >
              <span
                className={cn(
                  'text-xs',
                  isCurrentDay ? 'text-accent-yellow font-bold' : 'text-muted-gray'
                )}
              >
                {format(date, 'd')}
              </span>

              {productionDays.length > 0 && (
                <div className="absolute bottom-1 left-1 right-1">
                  {productionDays.map((pd) => (
                    <div
                      key={pd.id}
                      className={cn(
                        'text-[10px] truncate px-1 rounded',
                        pd.is_completed
                          ? 'bg-green-500/30 text-green-400'
                          : 'bg-blue-500/30 text-blue-400'
                      )}
                    >
                      Day {pd.day_number}
                    </div>
                  ))}
                </div>
              )}

              {/* Add button on hover */}
              {canEdit && productionDays.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Plus className="w-4 h-4 text-muted-gray" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// =====================================================
// Main Schedule View
// =====================================================

const ScheduleView: React.FC<ScheduleViewProps> = ({ projectId, canEdit }) => {
  const { days, isLoading, createDay, updateDay, markCompleted, deleteDay, refetch } =
    useProductionDays(projectId);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showForm, setShowForm] = useState(false);
  const [editingDay, setEditingDay] = useState<BacklotProductionDay | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prefilledDate, setPrefilledDate] = useState<string | null>(null);
  const [showAutoScheduler, setShowAutoScheduler] = useState(false);
  const [viewingDay, setViewingDay] = useState<BacklotProductionDay | null>(null);
  const [showTipsPanel, setShowTipsPanel] = useState(false);

  // Scene selection state for Add/Edit Day form
  const [selectedSceneIds, setSelectedSceneIds] = useState<string[]>([]);
  const [sceneSearchQuery, setSceneSearchQuery] = useState('');

  // Fetch unassigned scenes for the picker
  const { data: unassignedScenes, isLoading: loadingUnassignedScenes } = useUnassignedScenes(projectId);

  // Fetch scenes for the day being edited (if any)
  const { scenes: editingDayScenes, addScenesBulk, removeScene } = useProductionDayScenes(editingDay?.id || null);

  // Initialize selectedSceneIds when editing a day (scenes are fetched asynchronously)
  React.useEffect(() => {
    if (editingDay && editingDayScenes.length > 0) {
      setSelectedSceneIds(editingDayScenes.map(s => s.scene_id));
    }
  }, [editingDay, editingDayScenes]);

  // Combine unassigned scenes with scenes on the day being edited (for the picker)
  const availableScenes = useMemo(() => {
    const unassigned = unassignedScenes || [];
    if (!editingDay) {
      return unassigned;
    }
    // When editing, include both unassigned scenes and scenes already on this day
    const editingScenesList = editingDayScenes.map(pds => pds.scene).filter(Boolean) as SceneItem[];
    const combined = [...editingScenesList, ...unassigned];
    // De-duplicate by scene id
    const seen = new Set<string>();
    return combined.filter(s => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [unassignedScenes, editingDay, editingDayScenes]);

  // Filter scenes by search query
  const filteredScenes = useMemo(() => {
    if (!sceneSearchQuery.trim()) return availableScenes;
    const query = sceneSearchQuery.toLowerCase();
    return availableScenes.filter(s =>
      s.scene_number?.toLowerCase().includes(query) ||
      s.slugline?.toLowerCase().includes(query) ||
      s.set_name?.toLowerCase().includes(query)
    );
  }, [availableScenes, sceneSearchQuery]);

  // Form state
  const [formData, setFormData] = useState<ProductionDayInput>({
    day_number: 1,
    date: format(new Date(), 'yyyy-MM-dd'),
    title: '',
    description: '',
    general_call_time: '',
    wrap_time: '',
    location_name: '',
    location_address: '',
    notes: '',
  });

  const resetForm = () => {
    setFormData({
      day_number: days.length + 1,
      date: prefilledDate || format(new Date(), 'yyyy-MM-dd'),
      title: '',
      description: '',
      general_call_time: '',
      wrap_time: '',
      location_name: '',
      location_address: '',
      notes: '',
    });
    setPrefilledDate(null);
    setSelectedSceneIds([]);
    setSceneSearchQuery('');
  };

  const handleOpenForm = (day?: BacklotProductionDay, date?: Date) => {
    if (day) {
      setEditingDay(day);
      setFormData({
        day_number: day.day_number,
        date: day.date,
        title: day.title || '',
        description: day.description || '',
        general_call_time: day.general_call_time || '',
        wrap_time: day.wrap_time || '',
        location_name: day.location_name || '',
        location_address: day.location_address || '',
        notes: day.notes || '',
      });
    } else {
      setEditingDay(null);
      if (date) {
        setPrefilledDate(format(date, 'yyyy-MM-dd'));
      }
      resetForm();
      if (date) {
        setFormData((prev) => ({
          ...prev,
          date: format(date, 'yyyy-MM-dd'),
        }));
      }
    }
    setShowForm(true);
  };

  // Helper to sync scenes to a day after creation/update
  const syncScenesToDay = async (dayId: string) => {
    const currentIds = editingDay ? editingDayScenes.map(s => s.scene_id) : [];

    // Scenes to add (in selected but not in current)
    const toAdd = selectedSceneIds.filter(id => !currentIds.includes(id));

    // Scenes to remove (in current but not in selected)
    const toRemove = currentIds.filter(id => !selectedSceneIds.includes(id));

    // For newly created days, use bulk add directly via API
    if (toAdd.length > 0) {
      if (editingDay) {
        // Use the hook's bulk add (which has the dayId already)
        await addScenesBulk.mutateAsync(toAdd);
      } else {
        // For new days, we need to call the API directly with the new dayId
        const token = localStorage.getItem('access_token');
        await fetch(
          `${import.meta.env.VITE_API_URL || 'https://vnvvoelid6.execute-api.us-east-1.amazonaws.com'}/api/v1/backlot/production-days/${dayId}/scenes/bulk`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(toAdd),
          }
        );
      }
    }

    // Remove scenes one by one
    for (const sceneId of toRemove) {
      await removeScene.mutateAsync(sceneId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let savedDayId: string;

      if (editingDay) {
        await updateDay.mutateAsync({
          id: editingDay.id,
          ...formData,
        });
        savedDayId = editingDay.id;
      } else {
        const result = await createDay.mutateAsync({
          projectId,
          ...formData,
        });
        savedDayId = result?.id || result?.day?.id;
      }

      // Sync scenes to the day (run even if no scenes selected, to handle removals)
      if (savedDayId) {
        await syncScenesToDay(savedDayId);
      }

      setShowForm(false);
      resetForm();
    } catch (err) {
      console.error('Failed to save day:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this production day?')) {
      await deleteDay.mutateAsync(id);
    }
  };

  const handleToggleComplete = async (id: string, completed: boolean) => {
    await markCompleted.mutateAsync({ id, completed });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading text-bone-white">Schedule</h2>
          <p className="text-sm text-muted-gray">
            {days.length} production day{days.length !== 1 ? 's' : ''} planned
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex bg-charcoal-black/50 rounded-md border border-muted-gray/20 p-0.5">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 px-3',
                viewMode === 'list' && 'bg-muted-gray/20'
              )}
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4 mr-1" />
              List
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 px-3',
                viewMode === 'calendar' && 'bg-muted-gray/20'
              )}
              onClick={() => setViewMode('calendar')}
            >
              <CalendarDays className="w-4 h-4 mr-1" />
              Calendar
            </Button>
          </div>

          {/* Tips Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTipsPanel(true)}
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <Lightbulb className="w-4 h-4 mr-1" />
            Tips
          </Button>

          {canEdit && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowAutoScheduler(true)}
                className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Auto-Schedule
              </Button>
              <Button
                onClick={() => handleOpenForm()}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Day
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      {days.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-charcoal-black border-muted-gray/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Calendar className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-bone-white">{days.length}</p>
                  <p className="text-xs text-muted-gray">Total Days</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-charcoal-black border-muted-gray/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-bone-white">
                    {days.filter(d => d.is_completed).length}
                  </p>
                  <p className="text-xs text-muted-gray">Wrapped</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-charcoal-black border-muted-gray/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent-yellow/10">
                  <CalendarDays className="w-5 h-5 text-accent-yellow" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-bone-white">
                    {days.filter(d => !d.is_completed).length}
                  </p>
                  <p className="text-xs text-muted-gray">Remaining</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-charcoal-black border-muted-gray/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Target className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-bone-white">
                    {days.length > 0 ? Math.round((days.filter(d => d.is_completed).length / days.length) * 100) : 0}%
                  </p>
                  <p className="text-xs text-muted-gray">Complete</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Today's Shoot Banner */}
      {(() => {
        const today = format(new Date(), 'yyyy-MM-dd');
        const todayShoot = days.find(d => d.date === today);
        if (!todayShoot) return null;
        return (
          <Card
            className="bg-gradient-to-r from-green-500/20 to-green-600/10 border-green-500/30 cursor-pointer hover:border-green-400/50 transition-colors"
            onClick={() => setViewingDay(todayShoot)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center justify-center w-16 h-16 rounded-lg bg-green-500/30">
                    <span className="text-[10px] font-bold text-green-300 uppercase">Today</span>
                    <span className="text-2xl font-bold text-green-300">{todayShoot.day_number}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-green-300 text-lg">Shooting Today</span>
                      {todayShoot.title && (
                        <span className="text-green-400/70">— {todayShoot.title}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-green-400/80">
                      {todayShoot.general_call_time && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Call: {todayShoot.general_call_time}
                        </span>
                      )}
                      {todayShoot.location_name && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {todayShoot.location_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-green-400">View Details</span>
                  <ChevronRight className="w-5 h-5 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* View Content */}
      {viewMode === 'list' ? (
        days.length > 0 ? (
          <div className="space-y-4">
            {days.map((day) => (
              <DayCard
                key={day.id}
                day={day}
                projectId={projectId}
                canEdit={canEdit}
                onEdit={handleOpenForm}
                onToggleComplete={handleToggleComplete}
                onDelete={handleDelete}
                onViewDetail={setViewingDay}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
            <Calendar className="w-12 h-12 text-muted-gray/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-bone-white mb-2">No production days yet</h3>
            <p className="text-muted-gray mb-4">Add your first shoot day to get started.</p>
            {canEdit && (
              <Button
                onClick={() => handleOpenForm()}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Day
              </Button>
            )}
          </div>
        )
      ) : (
        <CalendarView
          days={days}
          projectId={projectId}
          canEdit={canEdit}
          onDayClick={(day) => handleOpenForm(day)}
          onAddDay={(date) => handleOpenForm(undefined, date)}
        />
      )}

      {/* Day Form Modal */}
      <Dialog open={showForm} onOpenChange={(open) => {
        setShowForm(open);
        if (!open) {
          setEditingDay(null);
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingDay ? `Edit Day ${editingDay.day_number}` : 'Add Production Day'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="day_number">Day Number *</Label>
                <Input
                  id="day_number"
                  type="number"
                  min={1}
                  value={formData.day_number}
                  onChange={(e) =>
                    setFormData({ ...formData, day_number: parseInt(e.target.value) || 1 })
                  }
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g., EXT. BEACH - Day Scene"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="call_time">Call Time</Label>
                <Input
                  id="call_time"
                  type="time"
                  value={formData.general_call_time}
                  onChange={(e) => setFormData({ ...formData, general_call_time: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wrap_time">Wrap Time</Label>
                <Input
                  id="wrap_time"
                  type="time"
                  value={formData.wrap_time}
                  onChange={(e) => setFormData({ ...formData, wrap_time: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location_name">Location Name</Label>
              <Input
                id="location_name"
                placeholder="e.g., Malibu Beach"
                value={formData.location_name}
                onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location_address">Location Address</Label>
              <Input
                id="location_address"
                placeholder="Full address..."
                value={formData.location_address}
                onChange={(e) => setFormData({ ...formData, location_address: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What's happening this day..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={isSubmitting}
                rows={3}
              />
            </div>

            {/* Scene Selection Section */}
            <div className="border-t border-muted-gray/20 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-accent-yellow" />
                  Scenes to Shoot
                  {selectedSceneIds.length > 0 && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      {selectedSceneIds.length} selected
                    </Badge>
                  )}
                </Label>
              </div>

              {/* Search Input */}
              <Input
                placeholder="Search scenes..."
                value={sceneSearchQuery}
                onChange={(e) => setSceneSearchQuery(e.target.value)}
                disabled={isSubmitting}
                className="h-8"
              />

              {/* Scene List with Checkboxes */}
              <ScrollArea className="h-48 border border-muted-gray/20 rounded-md">
                {loadingUnassignedScenes ? (
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : filteredScenes.length === 0 ? (
                  <div className="p-4 text-center text-muted-gray text-sm">
                    {sceneSearchQuery ? 'No scenes match your search' : 'No unassigned scenes available'}
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredScenes.map((scene) => {
                      const isSelected = selectedSceneIds.includes(scene.id);
                      return (
                        <label
                          key={scene.id}
                          className={cn(
                            'flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors',
                            isSelected
                              ? 'bg-accent-yellow/10 border border-accent-yellow/30'
                              : 'hover:bg-muted-gray/10'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSceneIds([...selectedSceneIds, scene.id]);
                              } else {
                                setSelectedSceneIds(selectedSceneIds.filter(id => id !== scene.id));
                              }
                            }}
                            disabled={isSubmitting}
                            className="w-4 h-4 rounded border-muted-gray/50 text-accent-yellow focus:ring-accent-yellow"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-accent-yellow">
                                {scene.scene_number || 'No #'}
                              </span>
                              {scene.int_ext && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                  {scene.int_ext}
                                </Badge>
                              )}
                              {scene.time_of_day && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                  {scene.time_of_day}
                                </Badge>
                              )}
                            </div>
                            {scene.slugline && (
                              <p className="text-xs text-muted-gray truncate">
                                {scene.slugline}
                              </p>
                            )}
                          </div>
                          {scene.page_length && (
                            <span className="text-xs text-muted-gray whitespace-nowrap">
                              {scene.page_length} pg
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : editingDay ? (
                  'Save Changes'
                ) : (
                  'Add Day'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Auto-Scheduler Wizard */}
      <AutoSchedulerWizard
        projectId={projectId}
        isOpen={showAutoScheduler}
        onClose={() => setShowAutoScheduler(false)}
        onComplete={() => {
          refetch();
        }}
      />

      {/* Day Detail Modal */}
      <DayDetailModal
        day={viewingDay}
        projectId={projectId}
        isOpen={!!viewingDay}
        onClose={() => setViewingDay(null)}
        onEdit={() => {
          if (viewingDay) {
            handleOpenForm(viewingDay);
            setViewingDay(null);
          }
        }}
        onDelete={() => {
          if (viewingDay) {
            handleDelete(viewingDay.id);
            setViewingDay(null);
          }
        }}
        canEdit={canEdit}
      />

      {/* Tips Panel Dialog */}
      <Dialog open={showTipsPanel} onOpenChange={setShowTipsPanel}>
        <DialogContent className="sm:max-w-lg bg-charcoal-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-bone-white">
              <Lightbulb className="w-5 h-5 text-amber-400" />
              Schedule Tips
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <CalendarDays className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Production Days</h4>
                <p className="text-sm text-muted-gray">
                  Each production day represents a single shoot day. Add dates, call times,
                  and locations to plan your schedule.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-accent-yellow/10 rounded-lg">
                <Film className="w-5 h-5 text-accent-yellow" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Scene Assignment</h4>
                <p className="text-sm text-muted-gray">
                  Assign scenes to production days from the day menu. Group scenes by
                  location or lighting to maximize efficiency.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Wand2 className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Auto-Scheduler</h4>
                <p className="text-sm text-muted-gray">
                  Use the Auto-Schedule wizard to automatically distribute scenes
                  across production days based on page count and scene grouping.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Call Sheets</h4>
                <p className="text-sm text-muted-gray">
                  Generate call sheets from production days with one click.
                  Assigned scenes are automatically included on the call sheet.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Check className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Day Completion</h4>
                <p className="text-sm text-muted-gray">
                  Mark days as complete after wrap to track your progress.
                  Past due days are highlighted in orange.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowTipsPanel(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScheduleView;
