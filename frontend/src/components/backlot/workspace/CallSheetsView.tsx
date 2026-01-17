/**
 * CallSheetsView - Manage call sheets for production days
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  FileText,
  Plus,
  Calendar,
  Clock,
  MapPin,
  Users,
  Send,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Loader2,
  Mail,
  History,
  Copy,
  Lightbulb,
  FileSpreadsheet,
  Download,
  CheckSquare,
  CalendarDays,
  Check,
  ArrowRight,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCallSheets, useProductionDays, useCreateCallSheetFromDay, useProductionDayScenes } from '@/hooks/backlot';
import { BacklotCallSheet, BacklotProductionDay } from '@/types/backlot';
import { format, formatDistanceToNow } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';
import CallSheetSendModal from './CallSheetSendModal';
import CallSheetDetailView from './CallSheetDetailView';
import CallSheetCreateEditModal from './CallSheetCreateEditModal';
import { SyncStatusBadge } from './SyncStatusBadge';
import { BidirectionalSyncModal } from './BidirectionalSyncModal';
import { RefreshCw } from 'lucide-react';

interface CallSheetsViewProps {
  projectId: string;
  canEdit: boolean;
}

const CallSheetCard: React.FC<{
  sheet: BacklotCallSheet;
  canEdit: boolean;
  onPublish: (id: string, publish: boolean) => void;
  onDelete: (id: string) => void;
  onSend: (sheet: BacklotCallSheet) => void;
  onView: (sheet: BacklotCallSheet) => void;
  onEdit: (sheet: BacklotCallSheet) => void;
  onClone: (sheet: BacklotCallSheet) => void;
}> = ({ sheet, canEdit, onPublish, onDelete, onSend, onView, onEdit, onClone }) => {
  const [showSyncModal, setShowSyncModal] = React.useState(false);

  return (
    <>

    <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4 hover:border-muted-gray/40 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          {/* Title & Status */}
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-accent-yellow" />
            <h4 className="font-medium text-bone-white">{sheet.title}</h4>
            <Badge
              variant="outline"
              className={
                sheet.is_published
                  ? 'bg-green-500/20 text-green-400 border-green-500/30'
                  : 'bg-muted-gray/20 text-muted-gray border-muted-gray/30'
              }
            >
              {sheet.is_published ? 'Published' : 'Draft'}
            </Badge>
            {/* Sync Status Badge - only show if linked to a production day */}
            {sheet.production_day_id && (
              <SyncStatusBadge
                dayId={sheet.production_day_id}
                onSyncClick={() => setShowSyncModal(true)}
                showQuickSync={true}
              />
            )}
          </div>

          {/* Details */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-gray">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {format(parseLocalDate(sheet.date), 'EEEE, MMM d, yyyy')}
            </div>
            {sheet.general_call_time && (
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                General Call: {sheet.general_call_time}
              </div>
            )}
            {sheet.location_name && (
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {sheet.location_name}
              </div>
            )}
          </div>

          {/* Schedule Preview */}
          {sheet.schedule_blocks && sheet.schedule_blocks.length > 0 && (
            <div className="mt-3 text-sm">
              <div className="text-muted-gray mb-1">Schedule:</div>
              <div className="space-y-1">
                {sheet.schedule_blocks.slice(0, 3).map((block, i) => (
                  <div key={i} className="flex gap-2 text-muted-gray">
                    <span className="text-bone-white font-mono">{block.time}</span>
                    <span>{block.activity}</span>
                  </div>
                ))}
                {sheet.schedule_blocks.length > 3 && (
                  <div className="text-muted-gray/60">
                    +{sheet.schedule_blocks.length - 3} more...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timestamp */}
          <div className="text-xs text-muted-gray mt-3">
            {sheet.is_published && sheet.published_at
              ? `Published ${formatDistanceToNow(new Date(sheet.published_at), { addSuffix: true })}`
              : `Updated ${formatDistanceToNow(new Date(sheet.updated_at), { addSuffix: true })}`}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Send Button - Primary action for editors */}
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSend(sheet)}
              className="border-accent-yellow/30 text-accent-yellow hover:bg-accent-yellow/10"
            >
              <Mail className="w-4 h-4 mr-1" />
              Send
            </Button>
          )}

          {/* View Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onView(sheet)}
            className="text-muted-gray hover:text-bone-white"
          >
            <Eye className="w-4 h-4 mr-1" />
            View
          </Button>

          {/* More Actions */}
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onView(sheet)}>
                  <Eye className="w-4 h-4 mr-2" />
                  View / Print
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(sheet)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onClone(sheet)}>
                  <Copy className="w-4 h-4 mr-2" />
                  Clone
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onSend(sheet)}>
                  <Mail className="w-4 h-4 mr-2" />
                  Send to Team
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onPublish(sheet.id, !sheet.is_published)}>
                  <Send className="w-4 h-4 mr-2" />
                  {sheet.is_published ? 'Unpublish' : 'Publish'}
                </DropdownMenuItem>
                {sheet.production_day_id && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShowSyncModal(true)}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Sync with Schedule
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-400" onClick={() => onDelete(sheet.id)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>

      {/* Bidirectional Sync Modal */}
      {sheet.production_day_id && (
        <BidirectionalSyncModal
          dayId={sheet.production_day_id}
          open={showSyncModal}
          onOpenChange={setShowSyncModal}
        />
      )}
    </>
  );
};

// Production Day Row - shows a day from the schedule with call sheet status
const ProductionDayRow: React.FC<{
  day: BacklotProductionDay;
  projectId: string;
  linkedCallSheet: BacklotCallSheet | null;
  canEdit: boolean;
  onViewCallSheet: (sheet: BacklotCallSheet) => void;
}> = ({ day, projectId, linkedCallSheet, canEdit, onViewCallSheet }) => {
  const [showCreateCallSheetModal, setShowCreateCallSheetModal] = React.useState(false);
  const { scenes } = useProductionDayScenes(day.id);

  const handleCreateCallSheet = () => {
    setShowCreateCallSheetModal(true);
  };

  const isPast = parseLocalDate(day.date) < new Date(new Date().toDateString());

  return (
    <div className="flex items-center gap-4 p-3 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg hover:border-muted-gray/40 transition-colors">
      {/* Day Number Badge */}
      <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg ${
        day.is_completed
          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
          : isPast
          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
          : 'bg-accent-yellow/20 text-accent-yellow border border-accent-yellow/30'
      }`}>
        {day.day_number}
      </div>

      {/* Day Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-bone-white">
            {format(parseLocalDate(day.date), 'EEEE, MMM d, yyyy')}
          </span>
          {day.is_completed && (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
              <Check className="w-3 h-3 mr-1" />
              Complete
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-gray mt-1">
          {day.title && <span>{day.title}</span>}
          {day.general_call_time && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Call: {day.general_call_time}
            </span>
          )}
          {day.location_name && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {day.location_name}
            </span>
          )}
        </div>
      </div>

      {/* Call Sheet Status & Actions */}
      <div className="flex items-center gap-2">
        {linkedCallSheet ? (
          <>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
              <FileText className="w-3 h-3 mr-1" />
              Call Sheet Ready
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewCallSheet(linkedCallSheet)}
              className="border-muted-gray/30 text-bone-white hover:bg-muted-gray/20"
            >
              <Eye className="w-4 h-4 mr-1" />
              View
            </Button>
          </>
        ) : canEdit ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateCallSheet}
            className="border-accent-yellow/30 text-accent-yellow hover:bg-accent-yellow/10"
          >
            <Plus className="w-4 h-4 mr-1" />
            Create Call Sheet
          </Button>
        ) : (
          <Badge variant="outline" className="bg-muted-gray/10 text-muted-gray border-muted-gray/30">
            No Call Sheet
          </Badge>
        )}
      </div>

      {/* Create Call Sheet Modal */}
      <CallSheetCreateEditModal
        isOpen={showCreateCallSheetModal}
        onClose={() => setShowCreateCallSheetModal(false)}
        projectId={projectId}
        productionDay={{
          id: day.id,
          date: day.date,
          title: day.title,
          day_number: day.day_number,
          general_call_time: day.general_call_time,
          wrap_time: day.wrap_time,
          location_name: day.location_name,
          location_address: day.location_address,
        }}
        preloadedScenes={scenes.map(s => ({
          id: s.scene_id,
          scene_number: s.scene?.scene_number || '',
          set_name: s.scene?.set_name,
          slugline: s.scene?.slugline,
          int_ext: s.scene?.int_ext,
          time_of_day: s.scene?.time_of_day,
          page_length: s.scene?.page_length,
          description: s.scene?.description,
        }))}
      />
    </div>
  );
};

const CallSheetsView: React.FC<CallSheetsViewProps> = ({ projectId, canEdit }) => {
  const { callSheets, isLoading, publishCallSheet, deleteCallSheet, cloneCallSheet } = useCallSheets(projectId);
  const { days, isLoading: loadingDays } = useProductionDays(projectId);
  const { toast } = useToast();
  const [sendModalSheet, setSendModalSheet] = useState<BacklotCallSheet | null>(null);
  const [viewSheet, setViewSheet] = useState<BacklotCallSheet | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editSheet, setEditSheet] = useState<BacklotCallSheet | null>(null);
  const [cloneSheet, setCloneSheet] = useState<BacklotCallSheet | null>(null);
  const [cloneDate, setCloneDate] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [showTipsPanel, setShowTipsPanel] = useState(false);
  const [cloneOptions, setCloneOptions] = useState({
    keep_people: true,
    keep_scenes: true,
    keep_locations: true,
    keep_schedule_blocks: true,
    keep_department_notes: true,
  });

  const handlePublish = async (id: string, publish: boolean) => {
    try {
      await publishCallSheet.mutateAsync({ id, publish });
      toast({
        title: publish ? 'Call Sheet Published' : 'Call Sheet Unpublished',
        description: publish
          ? 'The call sheet is now visible to team members.'
          : 'The call sheet has been set to draft.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update call sheet status',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this call sheet? This action cannot be undone.')) {
      try {
        await deleteCallSheet.mutateAsync(id);
        toast({
          title: 'Call Sheet Deleted',
          description: 'The call sheet has been permanently removed.',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to delete call sheet',
          variant: 'destructive',
        });
      }
    }
  };

  const handleSend = (sheet: BacklotCallSheet) => {
    setSendModalSheet(sheet);
  };

  const handleView = (sheet: BacklotCallSheet) => {
    setViewSheet(sheet);
  };

  const handleEdit = (sheet: BacklotCallSheet) => {
    setEditSheet(sheet);
  };

  const handleCreate = () => {
    setIsCreateModalOpen(true);
  };

  const handleClone = (sheet: BacklotCallSheet) => {
    // Set default date to day after the source call sheet
    const sourceDate = parseLocalDate(sheet.date);
    sourceDate.setDate(sourceDate.getDate() + 1);
    setCloneDate(sourceDate.toISOString().split('T')[0]);
    // Reset options to default
    setCloneOptions({
      keep_people: true,
      keep_scenes: true,
      keep_locations: true,
      keep_schedule_blocks: true,
      keep_department_notes: true,
    });
    setCloneSheet(sheet);
  };

  const handleCloneConfirm = async () => {
    if (!cloneSheet || !cloneDate) return;

    setIsCloning(true);
    try {
      await cloneCallSheet.mutateAsync({
        id: cloneSheet.id,
        options: {
          new_date: cloneDate,
          ...cloneOptions,
        },
      });
      toast({
        title: 'Call Sheet Cloned',
        description: `Created a copy for ${new Date(cloneDate).toLocaleDateString()}`,
      });
      setCloneSheet(null);
      setCloneDate('');
    } catch (error) {
      toast({
        title: 'Clone Failed',
        description: error instanceof Error ? error.message : 'Failed to clone call sheet',
        variant: 'destructive',
      });
    } finally {
      setIsCloning(false);
    }
  };

  // Map call sheets to their production day IDs for quick lookup
  // NOTE: These useMemo hooks must be before any early returns to maintain consistent hook ordering
  const callSheetsByDayId = React.useMemo(() => {
    const map = new Map<string, BacklotCallSheet>();
    (callSheets || []).forEach((sheet) => {
      if (sheet.production_day_id) {
        map.set(sheet.production_day_id, sheet);
      }
    });
    return map;
  }, [callSheets]);

  // Sort days by date
  const sortedDays = React.useMemo(() => {
    return [...(days || [])].sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());
  }, [days]);

  // Count days with and without call sheets
  const daysWithCallSheets = sortedDays.filter((d) => callSheetsByDayId.has(d.id)).length;
  const daysWithoutCallSheets = sortedDays.length - daysWithCallSheets;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading text-bone-white">Call Sheets</h2>
          <p className="text-sm text-muted-gray">Create and manage call sheets for your crew</p>
        </div>
        <div className="flex items-center gap-2">
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
            <Button
              onClick={handleCreate}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Call Sheet
            </Button>
          )}
        </div>
      </div>

      {/* Tabs: Production Days and Call Sheets */}
      <Tabs defaultValue="days" className="w-full">
        <TabsList className="bg-charcoal-black/50 border border-muted-gray/20">
          <TabsTrigger value="days" className="data-[state=active]:bg-accent-yellow/20 data-[state=active]:text-accent-yellow">
            <CalendarDays className="w-4 h-4 mr-2" />
            Production Days
            {sortedDays.length > 0 && (
              <Badge variant="outline" className="ml-2 text-xs">
                {daysWithCallSheets}/{sortedDays.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sheets" className="data-[state=active]:bg-accent-yellow/20 data-[state=active]:text-accent-yellow">
            <FileText className="w-4 h-4 mr-2" />
            Call Sheets
            {callSheets.length > 0 && (
              <Badge variant="outline" className="ml-2 text-xs">{callSheets.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Production Days Tab */}
        <TabsContent value="days" className="mt-4">
          {loadingDays ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : sortedDays.length > 0 ? (
            <div className="space-y-3">
              {sortedDays.map((day) => (
                <ProductionDayRow
                  key={day.id}
                  day={day}
                  projectId={projectId}
                  linkedCallSheet={callSheetsByDayId.get(day.id) || null}
                  canEdit={canEdit}
                  onViewCallSheet={handleView}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
              <CalendarDays className="w-12 h-12 text-muted-gray/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-bone-white mb-2">No production days scheduled</h3>
              <p className="text-muted-gray mb-4">
                Add production days in the Schedule tab first, then create call sheets for them here.
              </p>
            </div>
          )}
        </TabsContent>

        {/* Call Sheets Tab */}
        <TabsContent value="sheets" className="mt-4">
          {callSheets.length > 0 ? (
            <div className="space-y-4">
              {callSheets.map((sheet) => (
                <CallSheetCard
                  key={sheet.id}
                  sheet={sheet}
                  canEdit={canEdit}
                  onPublish={handlePublish}
                  onDelete={handleDelete}
                  onSend={handleSend}
                  onView={handleView}
                  onEdit={handleEdit}
                  onClone={handleClone}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
              <FileText className="w-12 h-12 text-muted-gray/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-bone-white mb-2">No call sheets yet</h3>
              <p className="text-muted-gray mb-4">
                Create call sheets to communicate schedules with your crew.
              </p>
              {canEdit && (
                <Button
                  onClick={handleCreate}
                  className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Call Sheet
                </Button>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Modal */}
      <CallSheetCreateEditModal
        isOpen={isCreateModalOpen || !!editSheet}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditSheet(null);
        }}
        projectId={projectId}
        callSheet={editSheet}
      />

      {/* Send Modal */}
      {sendModalSheet && (
        <CallSheetSendModal
          isOpen={!!sendModalSheet}
          onClose={() => setSendModalSheet(null)}
          callSheet={sendModalSheet}
          projectId={projectId}
        />
      )}

      {/* View Sheet Modal */}
      {viewSheet && (
        <CallSheetDetailView
          isOpen={!!viewSheet}
          onClose={() => setViewSheet(null)}
          callSheet={viewSheet}
          projectId={projectId}
          canEdit={canEdit}
          onSend={() => {
            setViewSheet(null);
            setSendModalSheet(viewSheet);
          }}
        />
      )}

      {/* Clone Modal */}
      <Dialog open={!!cloneSheet} onOpenChange={(open) => !open && setCloneSheet(null)}>
        <DialogContent className="bg-deep-black border-muted-gray/30 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-bone-white">Clone Call Sheet</DialogTitle>
            <DialogDescription className="text-muted-gray">
              Create a copy of "{cloneSheet?.title}" with selected data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-muted-gray">New Date</Label>
              <Input
                type="date"
                value={cloneDate}
                onChange={(e) => setCloneDate(e.target.value)}
                className="bg-charcoal-black border-muted-gray/30"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-muted-gray">Include in Clone</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="keep_people"
                    checked={cloneOptions.keep_people}
                    onCheckedChange={(checked) =>
                      setCloneOptions((prev) => ({ ...prev, keep_people: !!checked }))
                    }
                  />
                  <label htmlFor="keep_people" className="text-sm text-bone-white cursor-pointer">
                    Cast & Crew
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="keep_scenes"
                    checked={cloneOptions.keep_scenes}
                    onCheckedChange={(checked) =>
                      setCloneOptions((prev) => ({ ...prev, keep_scenes: !!checked }))
                    }
                  />
                  <label htmlFor="keep_scenes" className="text-sm text-bone-white cursor-pointer">
                    Scenes
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="keep_locations"
                    checked={cloneOptions.keep_locations}
                    onCheckedChange={(checked) =>
                      setCloneOptions((prev) => ({ ...prev, keep_locations: !!checked }))
                    }
                  />
                  <label htmlFor="keep_locations" className="text-sm text-bone-white cursor-pointer">
                    Locations
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="keep_schedule_blocks"
                    checked={cloneOptions.keep_schedule_blocks}
                    onCheckedChange={(checked) =>
                      setCloneOptions((prev) => ({ ...prev, keep_schedule_blocks: !!checked }))
                    }
                  />
                  <label htmlFor="keep_schedule_blocks" className="text-sm text-bone-white cursor-pointer">
                    Schedule Blocks
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="keep_department_notes"
                    checked={cloneOptions.keep_department_notes}
                    onCheckedChange={(checked) =>
                      setCloneOptions((prev) => ({ ...prev, keep_department_notes: !!checked }))
                    }
                  />
                  <label htmlFor="keep_department_notes" className="text-sm text-bone-white cursor-pointer">
                    Department Notes
                  </label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCloneSheet(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleCloneConfirm}
              disabled={!cloneDate || isCloning}
              className="bg-accent-yellow text-deep-black hover:bg-accent-yellow/90"
            >
              {isCloning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cloning...
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Clone Call Sheet
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tips Panel Dialog */}
      <Dialog open={showTipsPanel} onOpenChange={setShowTipsPanel}>
        <DialogContent className="sm:max-w-lg bg-charcoal-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-bone-white">
              <Lightbulb className="w-5 h-5 text-amber-400" />
              Call Sheet Tips
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-accent-yellow/10 rounded-lg">
                <FileSpreadsheet className="w-5 h-5 text-accent-yellow" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Creating Call Sheets</h4>
                <p className="text-sm text-muted-gray">
                  Create call sheets from scratch or generate them from production days
                  in the Schedule tab for faster setup.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Adding Cast & Crew</h4>
                <p className="text-sm text-muted-gray">
                  Add people with individual call times, roles, and notes.
                  They'll receive their personalized call sheet by email.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Send className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Publishing & Sending</h4>
                <p className="text-sm text-muted-gray">
                  Publish the call sheet to make it visible, then send via email.
                  Track who has received it in the send history.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Copy className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Cloning Call Sheets</h4>
                <p className="text-sm text-muted-gray">
                  Clone a call sheet to reuse cast, crew, and locations
                  for the next shoot day. Just update the date and details.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-cyan-500/10 rounded-lg">
                <Download className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">PDF Export</h4>
                <p className="text-sm text-muted-gray">
                  Download call sheets as PDF for printing or offline access.
                  The PDF includes all scenes, cast, crew, and notes.
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

export default CallSheetsView;
