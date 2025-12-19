/**
 * CallSheetsView - Manage call sheets for production days
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCallSheets } from '@/hooks/backlot';
import { BacklotCallSheet } from '@/types/backlot';
import { format, formatDistanceToNow } from 'date-fns';
import CallSheetSendModal from './CallSheetSendModal';
import CallSheetDetailView from './CallSheetDetailView';
import CallSheetCreateEditModal from './CallSheetCreateEditModal';

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
  return (
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
          </div>

          {/* Details */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-gray">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {format(new Date(sheet.date), 'EEEE, MMM d, yyyy')}
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
  );
};

const CallSheetsView: React.FC<CallSheetsViewProps> = ({ projectId, canEdit }) => {
  const { callSheets, isLoading, publishCallSheet, deleteCallSheet, cloneCallSheet } = useCallSheets(projectId);
  const [sendModalSheet, setSendModalSheet] = useState<BacklotCallSheet | null>(null);
  const [viewSheet, setViewSheet] = useState<BacklotCallSheet | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editSheet, setEditSheet] = useState<BacklotCallSheet | null>(null);
  const [cloneSheet, setCloneSheet] = useState<BacklotCallSheet | null>(null);
  const [cloneDate, setCloneDate] = useState('');
  const [isCloning, setIsCloning] = useState(false);

  const handlePublish = async (id: string, publish: boolean) => {
    await publishCallSheet.mutateAsync({ id, publish });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this call sheet?')) {
      await deleteCallSheet.mutateAsync(id);
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
    const sourceDate = new Date(sheet.date);
    sourceDate.setDate(sourceDate.getDate() + 1);
    setCloneDate(sourceDate.toISOString().split('T')[0]);
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
          keep_people: true,
          keep_scenes: true,
          keep_locations: true,
          keep_schedule_blocks: true,
          keep_department_notes: true,
        },
      });
      setCloneSheet(null);
      setCloneDate('');
    } finally {
      setIsCloning(false);
    }
  };

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

      {/* Call Sheets List */}
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
              Create a copy of "{cloneSheet?.title}" with all cast, crew, scenes, and settings.
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
            <p className="text-xs text-muted-gray">
              The cloned call sheet will include all people, scenes, locations, schedule, and department notes.
            </p>
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
    </div>
  );
};

export default CallSheetsView;
