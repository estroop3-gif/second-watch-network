/**
 * EpisodeDetailView - Detailed episode editing page with cards for all data
 */
import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChevronLeft,
  Save,
  Lock,
  Unlock,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  Pencil,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Link2,
  Unlink2,
  Calendar,
  FileText,
  Users,
  MapPin,
  Package,
  Images,
  MessageSquare,
  ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  useEpisode,
  useUpdateEpisode,
  useCreateSubject,
  useUpdateSubject,
  useDeleteSubject,
  useCreateLocation,
  useUpdateLocation,
  useDeleteLocation,
  useCreateListItem,
  useUpdateListItem,
  useDeleteListItem,
  useReorderListItem,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
  useCreateDeliverable,
  useUpdateDeliverable,
  useDeleteDeliverable,
  useApplyDeliverableTemplate,
  useEpisodeDeliverableTemplates,
  useCreateAssetLink,
  useDeleteAssetLink,
  useProjectStoryboards,
  useLinkStoryboard,
  useUnlinkStoryboard,
  useProjectDays,
  useTagShootDay,
  useUntagShootDay,
  useRequestApproval,
  useDecideApproval,
  useUnlockEpisode,
  PIPELINE_STAGES,
  EDIT_STATUSES,
  DELIVERY_STATUSES,
  SUBJECT_TYPES,
  LIST_ITEM_KINDS,
  DELIVERABLE_STATUSES_CONFIG,
  getPipelineStageInfo,
  getEditStatusInfo,
  getDeliveryStatusInfo,
  getDeliverableStatusInfo,
  EpisodeSubjectType,
  EpisodeListItemKind,
  DeliverableStatus,
  EpisodeSubject,
  EpisodeLocation,
  EpisodeListItem,
  EpisodeMilestone,
  EpisodeDeliverable,
  EpisodeAssetLink,
  EpisodeShootDay,
  EpisodeApproval,
  EpisodeStoryboard,
} from '@/hooks/backlot';

interface EpisodeDetailViewProps {
  projectId: string;
  episodeId: string;
  canEdit: boolean;
  onBack: () => void;
}

// Generic editable card component
function EditableCard({
  title,
  description,
  icon: Icon,
  children,
  canEdit,
  onSave,
  isSaving,
  isDirty,
}: {
  title: string;
  description?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  canEdit: boolean;
  onSave?: () => void;
  isSaving?: boolean;
  isDirty?: boolean;
}) {
  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-5 h-5 text-muted-gray" />}
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          {canEdit && onSave && (
            <Button
              size="sm"
              onClick={onSave}
              disabled={isSaving || !isDirty}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              Save
            </Button>
          )}
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function EpisodeDetailView({
  projectId,
  episodeId,
  canEdit,
  onBack,
}: EpisodeDetailViewProps) {
  // Fetch episode detail
  const { data: episode, isLoading, error, refetch } = useEpisode(projectId, episodeId);

  // Mutations
  const updateEpisode = useUpdateEpisode(projectId);
  const createSubject = useCreateSubject(projectId, episodeId);
  const updateSubject = useUpdateSubject(projectId, episodeId);
  const deleteSubject = useDeleteSubject(projectId, episodeId);
  const createLocation = useCreateLocation(projectId, episodeId);
  const updateLocation = useUpdateLocation(projectId, episodeId);
  const deleteLocation = useDeleteLocation(projectId, episodeId);
  const createListItem = useCreateListItem(projectId, episodeId);
  const updateListItem = useUpdateListItem(projectId, episodeId);
  const deleteListItem = useDeleteListItem(projectId, episodeId);
  const reorderListItem = useReorderListItem(projectId, episodeId);
  const createMilestone = useCreateMilestone(projectId, episodeId);
  const updateMilestone = useUpdateMilestone(projectId, episodeId);
  const deleteMilestone = useDeleteMilestone(projectId, episodeId);
  const createDeliverable = useCreateDeliverable(projectId, episodeId);
  const updateDeliverable = useUpdateDeliverable(projectId, episodeId);
  const deleteDeliverable = useDeleteDeliverable(projectId, episodeId);
  const applyTemplate = useApplyDeliverableTemplate(projectId, episodeId);
  const createAssetLink = useCreateAssetLink(projectId, episodeId);
  const deleteAssetLink = useDeleteAssetLink(projectId, episodeId);
  const linkStoryboard = useLinkStoryboard(projectId, episodeId);
  const unlinkStoryboard = useUnlinkStoryboard(projectId, episodeId);
  const tagShootDay = useTagShootDay(projectId, episodeId);
  const untagShootDay = useUntagShootDay(projectId, episodeId);
  const requestApproval = useRequestApproval(projectId, episodeId);
  const decideApproval = useDecideApproval(projectId, episodeId);
  const unlockEpisode = useUnlockEpisode(projectId, episodeId);

  // Supporting queries
  const { data: templates } = useEpisodeDeliverableTemplates(projectId);
  const { data: availableStoryboards } = useProjectStoryboards(projectId, true);
  const { data: projectDays } = useProjectDays(projectId);

  // Local form states
  const [statusForm, setStatusForm] = useState({
    pipeline_stage: '',
    edit_status: '',
    delivery_status: '',
  });
  const [storyForm, setStoryForm] = useState({
    title: '',
    logline: '',
    synopsis: '',
    outline: '',
    beat_sheet: '',
    notes: '',
  });
  const [teamForm, setTeamForm] = useState({
    planned_runtime_minutes: '',
    actual_runtime_minutes: '',
  });

  // Dialog states
  const [showSubjectDialog, setShowSubjectDialog] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [showListItemDialog, setShowListItemDialog] = useState(false);
  const [showMilestoneDialog, setShowMilestoneDialog] = useState(false);
  const [showDeliverableDialog, setShowDeliverableDialog] = useState(false);
  const [showAssetLinkDialog, setShowAssetLinkDialog] = useState(false);
  const [showLinkStoryboardDialog, setShowLinkStoryboardDialog] = useState(false);
  const [showTagShootDayDialog, setShowTagShootDayDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showDecisionDialog, setShowDecisionDialog] = useState<EpisodeApproval | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string } | null>(null);

  // Form data states
  const [subjectForm, setSubjectForm] = useState({
    id: '',
    subject_type: 'CAST' as EpisodeSubjectType,
    name: '',
    role: '',
    contact_info: '',
    notes: '',
  });
  const [locationForm, setLocationForm] = useState({
    id: '',
    name: '',
    address: '',
    notes: '',
  });
  const [listItemForm, setListItemForm] = useState({
    id: '',
    kind: 'SCENE' as EpisodeListItemKind,
    title: '',
    description: '',
    status: '',
  });
  const [milestoneForm, setMilestoneForm] = useState({
    id: '',
    milestone_type: '',
    date: '',
    notes: '',
  });
  const [deliverableForm, setDeliverableForm] = useState({
    id: '',
    deliverable_type: '',
    status: 'NOT_STARTED' as DeliverableStatus,
    due_date: '',
    notes: '',
  });
  const [assetLinkForm, setAssetLinkForm] = useState({ label: '', url: '' });
  const [approvalForm, setApprovalForm] = useState({ approval_type: 'EDIT_LOCK' as 'EDIT_LOCK' | 'DELIVERY_APPROVAL', notes: '' });
  const [decisionForm, setDecisionForm] = useState({ decision: 'APPROVE' as 'APPROVE' | 'REJECT', notes: '' });

  // Initialize forms when episode loads
  React.useEffect(() => {
    if (episode) {
      setStatusForm({
        pipeline_stage: episode.pipeline_stage,
        edit_status: episode.edit_status,
        delivery_status: episode.delivery_status,
      });
      setStoryForm({
        title: episode.title || '',
        logline: episode.logline || '',
        synopsis: episode.synopsis || '',
        outline: episode.outline || '',
        beat_sheet: episode.beat_sheet || '',
        notes: episode.notes || '',
      });
      setTeamForm({
        planned_runtime_minutes: episode.planned_runtime_minutes?.toString() || '',
        actual_runtime_minutes: episode.actual_runtime_minutes?.toString() || '',
      });
    }
  }, [episode]);

  // Check if forms are dirty
  const isStatusDirty = episode && (
    statusForm.pipeline_stage !== episode.pipeline_stage ||
    statusForm.edit_status !== episode.edit_status ||
    statusForm.delivery_status !== episode.delivery_status
  );
  const isStoryDirty = episode && (
    storyForm.title !== (episode.title || '') ||
    storyForm.logline !== (episode.logline || '') ||
    storyForm.synopsis !== (episode.synopsis || '') ||
    storyForm.outline !== (episode.outline || '') ||
    storyForm.beat_sheet !== (episode.beat_sheet || '') ||
    storyForm.notes !== (episode.notes || '')
  );
  const isTeamDirty = episode && (
    teamForm.planned_runtime_minutes !== (episode.planned_runtime_minutes?.toString() || '') ||
    teamForm.actual_runtime_minutes !== (episode.actual_runtime_minutes?.toString() || '')
  );

  // Save handlers
  const handleSaveStatus = useCallback(async () => {
    try {
      await updateEpisode.mutateAsync({ episodeId, data: statusForm });
      toast.success('Status updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  }, [updateEpisode, episodeId, statusForm]);

  const handleSaveStory = useCallback(async () => {
    try {
      await updateEpisode.mutateAsync({ episodeId, data: storyForm });
      toast.success('Story content updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  }, [updateEpisode, episodeId, storyForm]);

  const handleSaveTeam = useCallback(async () => {
    try {
      await updateEpisode.mutateAsync({
        episodeId,
        data: {
          planned_runtime_minutes: teamForm.planned_runtime_minutes ? parseInt(teamForm.planned_runtime_minutes) : null,
          actual_runtime_minutes: teamForm.actual_runtime_minutes ? parseInt(teamForm.actual_runtime_minutes) : null,
        },
      });
      toast.success('Runtime updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  }, [updateEpisode, episodeId, teamForm]);

  // Subject handlers
  const handleSaveSubject = useCallback(async () => {
    try {
      if (subjectForm.id) {
        await updateSubject.mutateAsync({
          subjectId: subjectForm.id,
          data: {
            subject_type: subjectForm.subject_type,
            name: subjectForm.name,
            role: subjectForm.role || undefined,
            contact_info: subjectForm.contact_info || undefined,
            notes: subjectForm.notes || undefined,
          },
        });
      } else {
        await createSubject.mutateAsync({
          subject_type: subjectForm.subject_type,
          name: subjectForm.name,
          role: subjectForm.role || undefined,
          contact_info: subjectForm.contact_info || undefined,
          notes: subjectForm.notes || undefined,
        });
      }
      setShowSubjectDialog(false);
      toast.success(subjectForm.id ? 'Subject updated' : 'Subject added');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save subject');
    }
  }, [createSubject, updateSubject, subjectForm]);

  // Location handlers
  const handleSaveLocation = useCallback(async () => {
    try {
      if (locationForm.id) {
        await updateLocation.mutateAsync({
          locationId: locationForm.id,
          data: {
            name: locationForm.name,
            address: locationForm.address || undefined,
            notes: locationForm.notes || undefined,
          },
        });
      } else {
        await createLocation.mutateAsync({
          name: locationForm.name,
          address: locationForm.address || undefined,
          notes: locationForm.notes || undefined,
        });
      }
      setShowLocationDialog(false);
      toast.success(locationForm.id ? 'Location updated' : 'Location added');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save location');
    }
  }, [createLocation, updateLocation, locationForm]);

  // List item handlers
  const handleSaveListItem = useCallback(async () => {
    try {
      if (listItemForm.id) {
        await updateListItem.mutateAsync({
          itemId: listItemForm.id,
          data: {
            kind: listItemForm.kind,
            title: listItemForm.title,
            description: listItemForm.description || undefined,
            status: listItemForm.status || undefined,
          },
        });
      } else {
        await createListItem.mutateAsync({
          kind: listItemForm.kind,
          title: listItemForm.title,
          description: listItemForm.description || undefined,
          status: listItemForm.status || undefined,
        });
      }
      setShowListItemDialog(false);
      toast.success(listItemForm.id ? 'Item updated' : 'Item added');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save item');
    }
  }, [createListItem, updateListItem, listItemForm]);

  // Milestone handlers
  const handleSaveMilestone = useCallback(async () => {
    try {
      if (milestoneForm.id) {
        await updateMilestone.mutateAsync({
          milestoneId: milestoneForm.id,
          data: {
            milestone_type: milestoneForm.milestone_type,
            date: milestoneForm.date,
            notes: milestoneForm.notes || undefined,
          },
        });
      } else {
        await createMilestone.mutateAsync({
          milestone_type: milestoneForm.milestone_type,
          date: milestoneForm.date,
          notes: milestoneForm.notes || undefined,
        });
      }
      setShowMilestoneDialog(false);
      toast.success(milestoneForm.id ? 'Milestone updated' : 'Milestone added');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save milestone');
    }
  }, [createMilestone, updateMilestone, milestoneForm]);

  // Deliverable handlers
  const handleSaveDeliverable = useCallback(async () => {
    try {
      if (deliverableForm.id) {
        await updateDeliverable.mutateAsync({
          deliverableId: deliverableForm.id,
          data: {
            deliverable_type: deliverableForm.deliverable_type,
            status: deliverableForm.status,
            due_date: deliverableForm.due_date || undefined,
            notes: deliverableForm.notes || undefined,
          },
        });
      } else {
        await createDeliverable.mutateAsync({
          deliverable_type: deliverableForm.deliverable_type,
          status: deliverableForm.status,
          due_date: deliverableForm.due_date || undefined,
          notes: deliverableForm.notes || undefined,
        });
      }
      setShowDeliverableDialog(false);
      toast.success(deliverableForm.id ? 'Deliverable updated' : 'Deliverable added');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save deliverable');
    }
  }, [createDeliverable, updateDeliverable, deliverableForm]);

  // Asset link handlers
  const handleSaveAssetLink = useCallback(async () => {
    try {
      await createAssetLink.mutateAsync({
        label: assetLinkForm.label,
        url: assetLinkForm.url,
      });
      setShowAssetLinkDialog(false);
      setAssetLinkForm({ label: '', url: '' });
      toast.success('Link added');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add link');
    }
  }, [createAssetLink, assetLinkForm]);

  // Storyboard linking
  const handleLinkStoryboard = useCallback(
    async (storyboardId: string) => {
      try {
        await linkStoryboard.mutateAsync(storyboardId);
        setShowLinkStoryboardDialog(false);
        toast.success('Storyboard linked');
      } catch (err: any) {
        toast.error(err.message || 'Failed to link storyboard');
      }
    },
    [linkStoryboard]
  );

  const handleUnlinkStoryboard = useCallback(
    async (storyboardId: string) => {
      try {
        await unlinkStoryboard.mutateAsync(storyboardId);
        toast.success('Storyboard unlinked');
      } catch (err: any) {
        toast.error(err.message || 'Failed to unlink storyboard');
      }
    },
    [unlinkStoryboard]
  );

  // Shoot day tagging
  const handleTagShootDay = useCallback(
    async (productionDayId: string) => {
      try {
        await tagShootDay.mutateAsync(productionDayId);
        setShowTagShootDayDialog(false);
        toast.success('Shoot day tagged');
      } catch (err: any) {
        toast.error(err.message || 'Failed to tag shoot day');
      }
    },
    [tagShootDay]
  );

  const handleUntagShootDay = useCallback(
    async (shootDayId: string) => {
      try {
        await untagShootDay.mutateAsync(shootDayId);
        toast.success('Shoot day untagged');
      } catch (err: any) {
        toast.error(err.message || 'Failed to untag shoot day');
      }
    },
    [untagShootDay]
  );

  // Approval handlers
  const handleRequestApproval = useCallback(async () => {
    try {
      await requestApproval.mutateAsync({
        approval_type: approvalForm.approval_type,
        notes: approvalForm.notes || undefined,
      });
      setShowApprovalDialog(false);
      setApprovalForm({ approval_type: 'EDIT_LOCK', notes: '' });
      toast.success('Approval requested');
    } catch (err: any) {
      toast.error(err.message || 'Failed to request approval');
    }
  }, [requestApproval, approvalForm]);

  const handleDecideApproval = useCallback(async () => {
    if (!showDecisionDialog) return;
    try {
      await decideApproval.mutateAsync({
        approvalId: showDecisionDialog.id,
        decision: decisionForm.decision,
        notes: decisionForm.notes || undefined,
      });
      setShowDecisionDialog(null);
      setDecisionForm({ decision: 'APPROVE', notes: '' });
      toast.success(`Request ${decisionForm.decision.toLowerCase()}d`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to process decision');
    }
  }, [decideApproval, showDecisionDialog, decisionForm]);

  const handleUnlock = useCallback(async () => {
    try {
      await unlockEpisode.mutateAsync();
      toast.success('Episode unlocked');
    } catch (err: any) {
      toast.error(err.message || 'Failed to unlock episode');
    }
  }, [unlockEpisode]);

  // Delete handler
  const handleDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    try {
      switch (deleteConfirm.type) {
        case 'subject':
          await deleteSubject.mutateAsync(deleteConfirm.id);
          break;
        case 'location':
          await deleteLocation.mutateAsync(deleteConfirm.id);
          break;
        case 'listItem':
          await deleteListItem.mutateAsync(deleteConfirm.id);
          break;
        case 'milestone':
          await deleteMilestone.mutateAsync(deleteConfirm.id);
          break;
        case 'deliverable':
          await deleteDeliverable.mutateAsync(deleteConfirm.id);
          break;
        case 'assetLink':
          await deleteAssetLink.mutateAsync(deleteConfirm.id);
          break;
      }
      setDeleteConfirm(null);
      toast.success('Deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  }, [deleteConfirm, deleteSubject, deleteLocation, deleteListItem, deleteMilestone, deleteDeliverable, deleteAssetLink]);

  // Reorder handler
  const handleReorder = useCallback(
    async (itemId: string, direction: 'up' | 'down') => {
      try {
        await reorderListItem.mutateAsync({ item_id: itemId, direction });
      } catch (err: any) {
        toast.error(err.message || 'Failed to reorder');
      }
    },
    [reorderListItem]
  );

  // Open edit dialogs with existing data
  const openEditSubject = (subject: EpisodeSubject) => {
    setSubjectForm({
      id: subject.id,
      subject_type: subject.subject_type,
      name: subject.name,
      role: subject.role || '',
      contact_info: subject.contact_info || '',
      notes: subject.notes || '',
    });
    setShowSubjectDialog(true);
  };

  const openEditLocation = (location: EpisodeLocation) => {
    setLocationForm({
      id: location.id,
      name: location.name,
      address: location.address || '',
      notes: location.notes || '',
    });
    setShowLocationDialog(true);
  };

  const openEditListItem = (item: EpisodeListItem) => {
    setListItemForm({
      id: item.id,
      kind: item.kind,
      title: item.title,
      description: item.description || '',
      status: item.status || '',
    });
    setShowListItemDialog(true);
  };

  const openEditMilestone = (milestone: EpisodeMilestone) => {
    setMilestoneForm({
      id: milestone.id,
      milestone_type: milestone.milestone_type,
      date: milestone.date,
      notes: milestone.notes || '',
    });
    setShowMilestoneDialog(true);
  };

  const openEditDeliverable = (deliverable: EpisodeDeliverable) => {
    setDeliverableForm({
      id: deliverable.id,
      deliverable_type: deliverable.deliverable_type,
      status: deliverable.status,
      due_date: deliverable.due_date || '',
      notes: deliverable.notes || '',
    });
    setShowDeliverableDialog(true);
  };

  // Group list items by kind
  const listItemsByKind = useMemo(() => {
    if (!episode?.list_items) return {};
    const grouped: Record<EpisodeListItemKind, EpisodeListItem[]> = {
      INTERVIEW: [],
      SCENE: [],
      SEGMENT: [],
    };
    for (const item of episode.list_items) {
      grouped[item.kind].push(item);
    }
    return grouped;
  }, [episode?.list_items]);

  // Get pending approvals
  const pendingApprovals = useMemo(() => {
    return episode?.approvals?.filter((a) => a.status === 'PENDING') || [];
  }, [episode?.approvals]);

  // Available shoot days (not already tagged)
  const availableDays = useMemo(() => {
    if (!projectDays || !episode?.shoot_days) return [];
    const taggedIds = new Set(episode.shoot_days.map((sd) => sd.production_day_id));
    return projectDays.filter((d) => !taggedIds.has(d.id));
  }, [projectDays, episode?.shoot_days]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // Error state
  if (error || !episode) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-bone-white mb-2">Failed to load episode</h3>
        <p className="text-muted-gray text-center mb-4">{(error as Error)?.message || 'Episode not found'}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const pipelineInfo = getPipelineStageInfo(episode.pipeline_stage);
  const effectiveCanEdit = canEdit && !episode.is_edit_locked;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg text-muted-gray">{episode.episode_code}</span>
              <h1 className="text-2xl font-heading text-bone-white">{episode.title}</h1>
              {episode.is_edit_locked && (
                <Badge variant="outline" className="border-yellow-500/50 text-yellow-400 gap-1">
                  <Lock className="w-3 h-3" />
                  Locked
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-gray mt-1">
              {episode.season_number ? `Season ${episode.season_number}, ` : ''}
              Episode {episode.episode_number}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn('text-white', pipelineInfo?.color || 'bg-gray-500')}>
            {pipelineInfo?.label || episode.pipeline_stage}
          </Badge>
        </div>
      </div>

      {/* Edit Lock Warning */}
      {episode.is_edit_locked && canEdit && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-yellow-400" />
            <div>
              <p className="font-medium text-yellow-400">Episode is edit-locked</p>
              <p className="text-sm text-muted-gray">Only approvers can make changes or unlock.</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleUnlock} className="border-yellow-500/30 text-yellow-400">
            <Unlock className="w-4 h-4 mr-2" />
            Unlock
          </Button>
        </div>
      )}

      {/* Status Card */}
      <EditableCard
        title="Status Tracking"
        description="Track production pipeline, edit status, and delivery status"
        canEdit={effectiveCanEdit}
        onSave={handleSaveStatus}
        isSaving={updateEpisode.isPending}
        isDirty={isStatusDirty}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Pipeline Stage</Label>
            <Select
              value={statusForm.pipeline_stage}
              onValueChange={(v) => setStatusForm((f) => ({ ...f, pipeline_stage: v }))}
              disabled={!effectiveCanEdit}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Edit Status</Label>
            <Select
              value={statusForm.edit_status}
              onValueChange={(v) => setStatusForm((f) => ({ ...f, edit_status: v }))}
              disabled={!effectiveCanEdit}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDIT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Delivery Status</Label>
            <Select
              value={statusForm.delivery_status}
              onValueChange={(v) => setStatusForm((f) => ({ ...f, delivery_status: v }))}
              disabled={!effectiveCanEdit}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELIVERY_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </EditableCard>

      {/* Story Content Card */}
      <EditableCard
        title="Story Content"
        description="Logline, synopsis, outline, and beat sheet"
        icon={FileText}
        canEdit={effectiveCanEdit}
        onSave={handleSaveStory}
        isSaving={updateEpisode.isPending}
        isDirty={isStoryDirty}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={storyForm.title}
              onChange={(e) => setStoryForm((f) => ({ ...f, title: e.target.value }))}
              disabled={!effectiveCanEdit}
            />
          </div>
          <div className="space-y-2">
            <Label>Logline</Label>
            <Textarea
              value={storyForm.logline}
              onChange={(e) => setStoryForm((f) => ({ ...f, logline: e.target.value }))}
              disabled={!effectiveCanEdit}
              rows={2}
              placeholder="One-sentence summary..."
            />
          </div>
          <div className="space-y-2">
            <Label>Synopsis</Label>
            <Textarea
              value={storyForm.synopsis}
              onChange={(e) => setStoryForm((f) => ({ ...f, synopsis: e.target.value }))}
              disabled={!effectiveCanEdit}
              rows={4}
              placeholder="Full story synopsis..."
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Outline</Label>
              <Textarea
                value={storyForm.outline}
                onChange={(e) => setStoryForm((f) => ({ ...f, outline: e.target.value }))}
                disabled={!effectiveCanEdit}
                rows={6}
                placeholder="Structural outline..."
              />
            </div>
            <div className="space-y-2">
              <Label>Beat Sheet</Label>
              <Textarea
                value={storyForm.beat_sheet}
                onChange={(e) => setStoryForm((f) => ({ ...f, beat_sheet: e.target.value }))}
                disabled={!effectiveCanEdit}
                rows={6}
                placeholder="Story beats..."
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={storyForm.notes}
              onChange={(e) => setStoryForm((f) => ({ ...f, notes: e.target.value }))}
              disabled={!effectiveCanEdit}
              rows={3}
              placeholder="Additional notes..."
            />
          </div>
        </div>
      </EditableCard>

      {/* List Items (Interviews, Scenes, Segments) */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Structure</CardTitle>
              <CardDescription>Interviews, scenes, and segments</CardDescription>
            </div>
            {effectiveCanEdit && (
              <Button
                size="sm"
                onClick={() => {
                  setListItemForm({ id: '', kind: 'SCENE', title: '', description: '', status: '' });
                  setShowListItemDialog(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {LIST_ITEM_KINDS.map((kind) => {
            const items = listItemsByKind[kind.value] || [];
            return (
              <div key={kind.value} className="mb-4 last:mb-0">
                <h4 className="text-sm font-medium text-muted-gray mb-2">{kind.label}s ({items.length})</h4>
                {items.length > 0 ? (
                  <div className="space-y-1">
                    {items.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 p-2 rounded bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <span className="text-xs text-muted-gray w-6 text-center">{idx + 1}</span>
                        <span className="flex-1 text-sm text-bone-white">{item.title}</span>
                        {item.status && (
                          <Badge variant="outline" className="text-xs">
                            {item.status}
                          </Badge>
                        )}
                        {effectiveCanEdit && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => handleReorder(item.id, 'up')}
                              disabled={idx === 0}
                            >
                              <ChevronUp className="w-3 h-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => handleReorder(item.id, 'down')}
                              disabled={idx === items.length - 1}
                            >
                              <ChevronDown className="w-3 h-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => openEditListItem(item)}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-red-400"
                              onClick={() => setDeleteConfirm({ type: 'listItem', id: item.id })}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-gray italic">No {kind.label.toLowerCase()}s</p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Subjects Card */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-gray" />
              <CardTitle className="text-lg">Subjects</CardTitle>
            </div>
            {effectiveCanEdit && (
              <Button
                size="sm"
                onClick={() => {
                  setSubjectForm({ id: '', subject_type: 'CAST', name: '', role: '', contact_info: '', notes: '' });
                  setShowSubjectDialog(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Subject
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {episode.subjects.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead className="text-muted-gray">Type</TableHead>
                  <TableHead className="text-muted-gray">Name</TableHead>
                  <TableHead className="text-muted-gray">Role</TableHead>
                  <TableHead className="text-muted-gray w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {episode.subjects.map((subject) => (
                  <TableRow key={subject.id} className="border-white/10">
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {SUBJECT_TYPES.find((t) => t.value === subject.subject_type)?.label || subject.subject_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-bone-white">{subject.name}</TableCell>
                    <TableCell className="text-muted-gray">{subject.role || '-'}</TableCell>
                    <TableCell>
                      {effectiveCanEdit && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditSubject(subject)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-400"
                            onClick={() => setDeleteConfirm({ type: 'subject', id: subject.id })}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-gray text-center py-4">No subjects added</p>
          )}
        </CardContent>
      </Card>

      {/* Locations Card */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-muted-gray" />
              <CardTitle className="text-lg">Locations</CardTitle>
            </div>
            {effectiveCanEdit && (
              <Button
                size="sm"
                onClick={() => {
                  setLocationForm({ id: '', name: '', address: '', notes: '' });
                  setShowLocationDialog(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Location
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {episode.locations.length > 0 ? (
            <div className="space-y-2">
              {episode.locations.map((location) => (
                <div key={location.id} className="flex items-start justify-between p-3 bg-white/5 rounded-lg">
                  <div>
                    <p className="font-medium text-bone-white">{location.name}</p>
                    {location.address && <p className="text-sm text-muted-gray">{location.address}</p>}
                  </div>
                  {effectiveCanEdit && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditLocation(location)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-400"
                        onClick={() => setDeleteConfirm({ type: 'location', id: location.id })}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-gray text-center py-4">No locations added</p>
          )}
        </CardContent>
      </Card>

      {/* Key Dates (Milestones) */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-muted-gray" />
              <CardTitle className="text-lg">Key Dates</CardTitle>
            </div>
            {effectiveCanEdit && (
              <Button
                size="sm"
                onClick={() => {
                  setMilestoneForm({ id: '', milestone_type: '', date: '', notes: '' });
                  setShowMilestoneDialog(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Date
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {episode.milestones.length > 0 ? (
            <div className="space-y-2">
              {episode.milestones.map((milestone) => (
                <div key={milestone.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-24">
                      <p className="text-sm font-medium text-bone-white">
                        {format(new Date(milestone.date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-bone-white">{milestone.milestone_type}</p>
                      {milestone.notes && <p className="text-sm text-muted-gray">{milestone.notes}</p>}
                    </div>
                  </div>
                  {effectiveCanEdit && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditMilestone(milestone)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-400"
                        onClick={() => setDeleteConfirm({ type: 'milestone', id: milestone.id })}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-gray text-center py-4">No key dates added</p>
          )}
        </CardContent>
      </Card>

      {/* Deliverables */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-muted-gray" />
              <CardTitle className="text-lg">Deliverables</CardTitle>
            </div>
            {effectiveCanEdit && (
              <div className="flex gap-2">
                {templates && templates.length > 0 && (
                  <Select onValueChange={(v) => applyTemplate.mutate(v)}>
                    <SelectTrigger className="w-40 h-8 text-sm">
                      <SelectValue placeholder="Apply template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  size="sm"
                  onClick={() => {
                    setDeliverableForm({ id: '', deliverable_type: '', status: 'NOT_STARTED', due_date: '', notes: '' });
                    setShowDeliverableDialog(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {episode.deliverables.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead className="text-muted-gray">Deliverable</TableHead>
                  <TableHead className="text-muted-gray">Status</TableHead>
                  <TableHead className="text-muted-gray">Due Date</TableHead>
                  <TableHead className="text-muted-gray w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {episode.deliverables.map((del) => {
                  const statusInfo = getDeliverableStatusInfo(del.status);
                  return (
                    <TableRow key={del.id} className="border-white/10">
                      <TableCell className="text-bone-white">{del.deliverable_type}</TableCell>
                      <TableCell>
                        <Badge className={cn('text-xs text-white', statusInfo?.color || 'bg-gray-500')}>
                          {statusInfo?.label || del.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-gray">
                        {del.due_date ? format(new Date(del.due_date), 'MMM d') : '-'}
                      </TableCell>
                      <TableCell>
                        {effectiveCanEdit && (
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditDeliverable(del)}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-400"
                              onClick={() => setDeleteConfirm({ type: 'deliverable', id: del.id })}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-gray text-center py-4">No deliverables</p>
          )}
        </CardContent>
      </Card>

      {/* Runtime */}
      <EditableCard
        title="Runtime"
        description="Planned and actual episode duration"
        canEdit={effectiveCanEdit}
        onSave={handleSaveTeam}
        isSaving={updateEpisode.isPending}
        isDirty={isTeamDirty}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Planned Runtime (minutes)</Label>
            <Input
              type="number"
              value={teamForm.planned_runtime_minutes}
              onChange={(e) => setTeamForm((f) => ({ ...f, planned_runtime_minutes: e.target.value }))}
              disabled={!effectiveCanEdit}
              placeholder="e.g., 45"
            />
          </div>
          <div className="space-y-2">
            <Label>Actual Runtime (minutes)</Label>
            <Input
              type="number"
              value={teamForm.actual_runtime_minutes}
              onChange={(e) => setTeamForm((f) => ({ ...f, actual_runtime_minutes: e.target.value }))}
              disabled={!effectiveCanEdit}
              placeholder="e.g., 47"
            />
          </div>
        </div>
      </EditableCard>

      {/* Asset Links */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-muted-gray" />
              <CardTitle className="text-lg">Asset Links</CardTitle>
            </div>
            {effectiveCanEdit && (
              <Button
                size="sm"
                onClick={() => {
                  setAssetLinkForm({ label: '', url: '' });
                  setShowAssetLinkDialog(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Link
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {episode.asset_links.length > 0 ? (
            <div className="space-y-2">
              {episode.asset_links.map((link) => (
                <div key={link.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-accent-yellow hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {link.label}
                  </a>
                  {effectiveCanEdit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-400"
                      onClick={() => setDeleteConfirm({ type: 'assetLink', id: link.id })}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-gray text-center py-4">No links added</p>
          )}
        </CardContent>
      </Card>

      {/* Storyboards */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Images className="w-5 h-5 text-muted-gray" />
              <CardTitle className="text-lg">Linked Storyboards</CardTitle>
            </div>
            {effectiveCanEdit && availableStoryboards && availableStoryboards.length > 0 && (
              <Button size="sm" onClick={() => setShowLinkStoryboardDialog(true)}>
                <Link2 className="w-4 h-4 mr-2" />
                Link Storyboard
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {episode.storyboards.length > 0 ? (
            <div className="space-y-2">
              {episode.storyboards.map((sb) => (
                <div key={sb.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Images className="w-4 h-4 text-muted-gray" />
                    <span className="text-bone-white">{sb.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {sb.status}
                    </Badge>
                  </div>
                  {effectiveCanEdit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-400"
                      onClick={() => handleUnlinkStoryboard(sb.id)}
                    >
                      <Unlink2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-gray text-center py-4">No storyboards linked</p>
          )}
        </CardContent>
      </Card>

      {/* Shoot Days */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-muted-gray" />
              <CardTitle className="text-lg">Tagged Shoot Days</CardTitle>
            </div>
            {effectiveCanEdit && availableDays.length > 0 && (
              <Button size="sm" onClick={() => setShowTagShootDayDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Tag Day
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {episode.shoot_days.length > 0 ? (
            <div className="space-y-2">
              {episode.shoot_days.map((day) => (
                <div key={day.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-muted-gray">
                      {format(new Date(day.date), 'MMM d, yyyy')}
                    </span>
                    <span className="text-bone-white">{day.day_title || day.day_type}</span>
                    <Badge variant="outline" className="text-xs">
                      {day.day_type}
                    </Badge>
                  </div>
                  {effectiveCanEdit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-400"
                      onClick={() => handleUntagShootDay(day.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-gray text-center py-4">No shoot days tagged</p>
          )}
        </CardContent>
      </Card>

      {/* Approvals */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-muted-gray" />
              <CardTitle className="text-lg">Approvals</CardTitle>
              {pendingApprovals.length > 0 && (
                <Badge className="bg-yellow-500/20 text-yellow-400">{pendingApprovals.length} pending</Badge>
              )}
            </div>
            {canEdit && (
              <Button
                size="sm"
                onClick={() => {
                  setApprovalForm({ approval_type: 'EDIT_LOCK', notes: '' });
                  setShowApprovalDialog(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Request Approval
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {episode.approvals.length > 0 ? (
            <div className="space-y-2">
              {episode.approvals.map((approval) => (
                <div
                  key={approval.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg',
                    approval.status === 'PENDING' ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-white/5'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {approval.status === 'PENDING' && <Clock className="w-4 h-4 text-yellow-400" />}
                    {approval.status === 'APPROVED' && <CheckCircle className="w-4 h-4 text-green-400" />}
                    {approval.status === 'REJECTED' && <XCircle className="w-4 h-4 text-red-400" />}
                    <div>
                      <p className="font-medium text-bone-white">
                        {approval.approval_type === 'EDIT_LOCK' ? 'Edit Lock' : 'Delivery Approval'}
                      </p>
                      <p className="text-xs text-muted-gray">
                        Requested by {approval.requested_by_name} on{' '}
                        {format(new Date(approval.requested_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  {approval.status === 'PENDING' && canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDecisionForm({ decision: 'APPROVE', notes: '' });
                        setShowDecisionDialog(approval);
                      }}
                    >
                      Review
                    </Button>
                  )}
                  {approval.status !== 'PENDING' && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs',
                        approval.status === 'APPROVED' && 'border-green-500/50 text-green-400',
                        approval.status === 'REJECTED' && 'border-red-500/50 text-red-400'
                      )}
                    >
                      {approval.status}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-gray text-center py-4">No approval requests</p>
          )}
        </CardContent>
      </Card>

      {/* Subject Dialog */}
      <Dialog open={showSubjectDialog} onOpenChange={setShowSubjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{subjectForm.id ? 'Edit Subject' : 'Add Subject'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select
                value={subjectForm.subject_type}
                onValueChange={(v) => setSubjectForm((f) => ({ ...f, subject_type: v as EpisodeSubjectType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={subjectForm.name}
                onChange={(e) => setSubjectForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Person's name"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input
                value={subjectForm.role}
                onChange={(e) => setSubjectForm((f) => ({ ...f, role: e.target.value }))}
                placeholder="Their role in the episode"
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Info</Label>
              <Input
                value={subjectForm.contact_info}
                onChange={(e) => setSubjectForm((f) => ({ ...f, contact_info: e.target.value }))}
                placeholder="Email or phone"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={subjectForm.notes}
                onChange={(e) => setSubjectForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubjectDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveSubject}
              disabled={!subjectForm.name || createSubject.isPending || updateSubject.isPending}
            >
              {subjectForm.id ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Location Dialog */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{locationForm.id ? 'Edit Location' : 'Add Location'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={locationForm.name}
                onChange={(e) => setLocationForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Location name"
              />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={locationForm.address}
                onChange={(e) => setLocationForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Full address"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={locationForm.notes}
                onChange={(e) => setLocationForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLocationDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveLocation}
              disabled={!locationForm.name || createLocation.isPending || updateLocation.isPending}
            >
              {locationForm.id ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* List Item Dialog */}
      <Dialog open={showListItemDialog} onOpenChange={setShowListItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{listItemForm.id ? 'Edit Item' : 'Add Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select
                value={listItemForm.kind}
                onValueChange={(v) => setListItemForm((f) => ({ ...f, kind: v as EpisodeListItemKind }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIST_ITEM_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={listItemForm.title}
                onChange={(e) => setListItemForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Title or name"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={listItemForm.description}
                onChange={(e) => setListItemForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Input
                value={listItemForm.status}
                onChange={(e) => setListItemForm((f) => ({ ...f, status: e.target.value }))}
                placeholder="e.g., Scheduled, Complete"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowListItemDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveListItem}
              disabled={!listItemForm.title || createListItem.isPending || updateListItem.isPending}
            >
              {listItemForm.id ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Milestone Dialog */}
      <Dialog open={showMilestoneDialog} onOpenChange={setShowMilestoneDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{milestoneForm.id ? 'Edit Key Date' : 'Add Key Date'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={milestoneForm.date}
                onChange={(e) => setMilestoneForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Milestone Type *</Label>
              <Input
                value={milestoneForm.milestone_type}
                onChange={(e) => setMilestoneForm((f) => ({ ...f, milestone_type: e.target.value }))}
                placeholder="e.g., Picture Lock, Fine Cut Due"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={milestoneForm.notes}
                onChange={(e) => setMilestoneForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMilestoneDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveMilestone}
              disabled={
                !milestoneForm.milestone_type ||
                !milestoneForm.date ||
                createMilestone.isPending ||
                updateMilestone.isPending
              }
            >
              {milestoneForm.id ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deliverable Dialog */}
      <Dialog open={showDeliverableDialog} onOpenChange={setShowDeliverableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deliverableForm.id ? 'Edit Deliverable' : 'Add Deliverable'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Deliverable Type *</Label>
              <Input
                value={deliverableForm.deliverable_type}
                onChange={(e) => setDeliverableForm((f) => ({ ...f, deliverable_type: e.target.value }))}
                placeholder="e.g., Final Master, Trailer"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={deliverableForm.status}
                onValueChange={(v) => setDeliverableForm((f) => ({ ...f, status: v as DeliverableStatus }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERABLE_STATUSES_CONFIG.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={deliverableForm.due_date}
                onChange={(e) => setDeliverableForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={deliverableForm.notes}
                onChange={(e) => setDeliverableForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeliverableDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveDeliverable}
              disabled={!deliverableForm.deliverable_type || createDeliverable.isPending || updateDeliverable.isPending}
            >
              {deliverableForm.id ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Asset Link Dialog */}
      <Dialog open={showAssetLinkDialog} onOpenChange={setShowAssetLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Asset Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Label *</Label>
              <Input
                value={assetLinkForm.label}
                onChange={(e) => setAssetLinkForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g., Frame.io Project"
              />
            </div>
            <div className="space-y-2">
              <Label>URL *</Label>
              <Input
                type="url"
                value={assetLinkForm.url}
                onChange={(e) => setAssetLinkForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssetLinkDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveAssetLink}
              disabled={!assetLinkForm.label || !assetLinkForm.url || createAssetLink.isPending}
            >
              Add Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Storyboard Dialog */}
      <Dialog open={showLinkStoryboardDialog} onOpenChange={setShowLinkStoryboardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Storyboard</DialogTitle>
            <DialogDescription>Select a storyboard to link to this episode.</DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-64 overflow-y-auto space-y-2">
            {availableStoryboards?.map((sb) => (
              <button
                key={sb.id}
                onClick={() => handleLinkStoryboard(sb.id)}
                className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <span className="text-bone-white">{sb.title}</span>
                <Badge variant="outline" className="text-xs">
                  {sb.status}
                </Badge>
              </button>
            ))}
            {(!availableStoryboards || availableStoryboards.length === 0) && (
              <p className="text-sm text-muted-gray text-center py-4">No unlinked storyboards available</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkStoryboardDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag Shoot Day Dialog */}
      <Dialog open={showTagShootDayDialog} onOpenChange={setShowTagShootDayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tag Shoot Day</DialogTitle>
            <DialogDescription>Link a production day from the schedule to this episode.</DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-64 overflow-y-auto space-y-2">
            {availableDays.map((day) => (
              <button
                key={day.id}
                onClick={() => handleTagShootDay(day.id)}
                className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <span className="text-bone-white font-mono text-sm">
                  {format(new Date(day.date), 'MMM d, yyyy')}
                </span>
                <div className="flex items-center gap-2">
                  {day.title && <span className="text-muted-gray text-sm">{day.title}</span>}
                  <Badge variant="outline" className="text-xs">
                    {day.day_type}
                  </Badge>
                </div>
              </button>
            ))}
            {availableDays.length === 0 && (
              <p className="text-sm text-muted-gray text-center py-4">No available shoot days to tag</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTagShootDayDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Approval</DialogTitle>
            <DialogDescription>Submit this episode for approval.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Approval Type *</Label>
              <Select
                value={approvalForm.approval_type}
                onValueChange={(v) => setApprovalForm((f) => ({ ...f, approval_type: v as 'EDIT_LOCK' | 'DELIVERY_APPROVAL' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EDIT_LOCK">Edit Lock</SelectItem>
                  <SelectItem value="DELIVERY_APPROVAL">Delivery Approval</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={approvalForm.notes}
                onChange={(e) => setApprovalForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes for the reviewer..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRequestApproval} disabled={requestApproval.isPending}>
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decision Dialog */}
      <Dialog open={!!showDecisionDialog} onOpenChange={(open) => !open && setShowDecisionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Approval Request</DialogTitle>
            <DialogDescription>
              {showDecisionDialog?.approval_type === 'EDIT_LOCK'
                ? 'Approving will lock the episode for editing.'
                : 'Approving confirms this episode is ready for delivery.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Decision *</Label>
              <Select
                value={decisionForm.decision}
                onValueChange={(v) => setDecisionForm((f) => ({ ...f, decision: v as 'APPROVE' | 'REJECT' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APPROVE">Approve</SelectItem>
                  <SelectItem value="REJECT">Reject</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={decisionForm.notes}
                onChange={(e) => setDecisionForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional feedback..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDecisionDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleDecideApproval}
              disabled={decideApproval.isPending}
              className={cn(
                decisionForm.decision === 'REJECT' && 'bg-red-500 hover:bg-red-600'
              )}
            >
              {decisionForm.decision === 'APPROVE' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default EpisodeDetailView;
