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
import { parseLocalDate } from '@/lib/dateUtils';
import {
  useEpisode,
  useUpdateEpisode,
  useCreateSubject,
  useUpdateSubject,
  useDeleteSubject,
  useLinkContact,
  useContacts,
  useCreateLocation,
  useUpdateLocation,
  useDeleteLocation,
  useLinkProjectLocation,
  useProjectLocations,
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
  useLinkProjectDeliverable,
  useEpisodeDeliverableTemplates,
  useProjectDeliverables,
  useCreateAssetLink,
  useDeleteAssetLink,
  useLinkAsset,
  useAssets,
  useProjectStoryboards,
  useLinkStoryboard,
  useUnlinkStoryboard,
  useProjectDays,
  useTagShootDay,
  useUntagShootDay,
  useRequestApproval,
  useDecideApproval,
  useUnlockEpisode,
  useEpisodeStoryLinks,
  useLinkEpisodeToStory,
  useUnlinkEpisodeFromStory,
  useStories,
  PIPELINE_STAGES,
  EDIT_STATUSES,
  DELIVERY_STATUSES,
  SUBJECT_TYPES,
  LIST_ITEM_KINDS,
  DELIVERABLE_STATUSES_CONFIG,
  APPROVAL_TYPES,
  getPipelineStageInfo,
  getEditStatusInfo,
  getDeliveryStatusInfo,
  getDeliverableStatusInfo,
  getApprovalTypeInfo,
  EpisodeSubjectType,
  EpisodeListItemKind,
  DeliverableStatus,
  ApprovalType,
  EpisodeSubject,
  EpisodeLocation,
  EpisodeListItem,
  EpisodeMilestone,
  EpisodeDeliverable,
  EpisodeAssetLink,
  EpisodeShootDay,
  EpisodeApproval,
  EpisodeStoryboard,
  EpisodeStoryLink,
} from '@/hooks/backlot';
import LocationPickerModal from './LocationPickerModal';
import { BacklotLocation, BacklotLocationInput, LocationWithClearance } from '@/types/backlot';
import { api } from '@/lib/api';

interface EpisodeDetailViewProps {
  projectId: string;
  episodeId: string;
  canEdit: boolean;
  onBack: () => void;
}

// Section names for edit mode tracking
type SectionName = 'status' | 'story' | 'structure' | 'subjects' | 'locations' |
  'milestones' | 'deliverables' | 'runtime' | 'assetLinks' | 'storyboards' |
  'shootDays' | 'approvals';

// Generic editable card component with per-section edit mode
function EditableCard({
  title,
  description,
  icon: Icon,
  children,
  canEdit,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  isSaving,
  isDirty,
  badge,
}: {
  title: string;
  description?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  canEdit: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  isDirty?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <Card className={cn(
      "bg-white/5 border-white/10 transition-all",
      isEditing && "ring-1 ring-accent-yellow/30"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-5 h-5 text-muted-gray" />}
            <CardTitle className="text-lg">{title}</CardTitle>
            {badge}
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onCancel}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  {onSave && (
                    <Button
                      size="sm"
                      onClick={onSave}
                      disabled={isSaving || !isDirty}
                      className="gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onEdit}
                  className="gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </Button>
              )}
            </div>
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
  const linkContact = useLinkContact(projectId, episodeId);
  const { contacts: projectContacts } = useContacts({ projectId });
  const createLocation = useCreateLocation(projectId, episodeId);
  const updateLocation = useUpdateLocation(projectId, episodeId);
  const deleteLocation = useDeleteLocation(projectId, episodeId);
  const linkProjectLocation = useLinkProjectLocation(projectId, episodeId);
  const { locations: projectLocations } = useProjectLocations(projectId);
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
  const linkProjectDeliverable = useLinkProjectDeliverable(projectId, episodeId);
  const { data: projectDeliverables } = useProjectDeliverables(projectId);
  const createAssetLink = useCreateAssetLink(projectId, episodeId);
  const deleteAssetLink = useDeleteAssetLink(projectId, episodeId);
  const linkAsset = useLinkAsset(projectId, episodeId);
  const { data: projectAssets } = useAssets(projectId);
  const linkStoryboard = useLinkStoryboard(projectId, episodeId);
  const unlinkStoryboard = useUnlinkStoryboard(projectId, episodeId);
  const tagShootDay = useTagShootDay(projectId, episodeId);
  const untagShootDay = useUntagShootDay(projectId, episodeId);
  const requestApproval = useRequestApproval(projectId, episodeId);
  const decideApproval = useDecideApproval(projectId, episodeId);
  const unlockEpisode = useUnlockEpisode(projectId, episodeId);

  // Episode-Story linking (Beat Sheets)
  const { data: episodeStoryLinks, isLoading: isLoadingStoryLinks } = useEpisodeStoryLinks(projectId, episodeId);
  const linkEpisodeToStory = useLinkEpisodeToStory(projectId, episodeId);
  const unlinkEpisodeFromStory = useUnlinkEpisodeFromStory(projectId, episodeId);
  const { data: projectStories } = useStories(projectId);

  // Per-section edit mode state - only one section can be edited at a time
  const [editingSection, setEditingSection] = useState<SectionName | null>(null);

  // Helper to manage edit mode
  const startEditing = useCallback((section: SectionName) => {
    setEditingSection(section);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingSection(null);
  }, []);

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
  const [showLinkContactDialog, setShowLinkContactDialog] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showListItemDialog, setShowListItemDialog] = useState(false);
  const [showMilestoneDialog, setShowMilestoneDialog] = useState(false);
  const [showDeliverableDialog, setShowDeliverableDialog] = useState(false);
  const [showLinkProjectDeliverableDialog, setShowLinkProjectDeliverableDialog] = useState(false);
  const [showAssetLinkDialog, setShowAssetLinkDialog] = useState(false);
  const [showLinkAssetDialog, setShowLinkAssetDialog] = useState(false);
  const [showLinkStoryboardDialog, setShowLinkStoryboardDialog] = useState(false);
  const [showTagShootDayDialog, setShowTagShootDayDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showLinkBeatSheetDialog, setShowLinkBeatSheetDialog] = useState(false);
  const [selectedStoryId, setSelectedStoryId] = useState<string>('');
  const [showDecisionDialog, setShowDecisionDialog] = useState<EpisodeApproval | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string } | null>(null);

  // Form data states
  const [subjectForm, setSubjectForm] = useState({
    id: '',
    subject_type: 'CAST' as EpisodeSubjectType,
    name: '',
    role: '',  // Role in THIS episode
    // Contact fields
    company: '',
    email: '',
    phone: '',
    role_interest: '',  // General role/interest for contact
    status: 'new',
    source: '',
    notes: '',
    // For tracking if editing has linked contact
    contact_id: null as string | null,
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
  const [approvalForm, setApprovalForm] = useState({ approval_type: 'ROUGH_CUT' as ApprovalType, notes: '' });
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
      setEditingSection(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  }, [updateEpisode, episodeId, statusForm]);

  const handleSaveStory = useCallback(async () => {
    try {
      await updateEpisode.mutateAsync({ episodeId, data: storyForm });
      toast.success('Story content updated');
      setEditingSection(null);
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
      setEditingSection(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  }, [updateEpisode, episodeId, teamForm]);

  // Subject handlers
  const handleSaveSubject = useCallback(async () => {
    try {
      const subjectData = {
        subject_type: subjectForm.subject_type,
        name: subjectForm.name,
        role: subjectForm.role || undefined,
        // Contact fields
        company: subjectForm.company || undefined,
        email: subjectForm.email || undefined,
        phone: subjectForm.phone || undefined,
        role_interest: subjectForm.role_interest || undefined,
        status: subjectForm.status || 'new',
        source: subjectForm.source || undefined,
        notes: subjectForm.notes || undefined,
      };

      if (subjectForm.id) {
        await updateSubject.mutateAsync({
          subjectId: subjectForm.id,
          data: subjectData,
        });
      } else {
        await createSubject.mutateAsync(subjectData);
      }
      setShowSubjectDialog(false);
      toast.success(subjectForm.id ? 'Subject updated' : 'Subject & contact created');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save subject');
    }
  }, [createSubject, updateSubject, subjectForm]);

  // Location handlers for LocationPickerModal
  const handleSelectLocationForEpisode = useCallback(async (
    location: BacklotLocation | LocationWithClearance,
    projectLocationId?: string
  ) => {
    try {
      // Create episode_location linking to the project location
      await createLocation.mutateAsync({
        name: location.name,
        address: location.address || undefined,
        notes: (location as any).project_notes || undefined,
        project_location_id: projectLocationId || location.id,
      });
      toast.success('Location added to episode');
      setShowLocationPicker(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add location');
    }
  }, [createLocation]);

  const handleCreateLocationForEpisode = useCallback(async (data: BacklotLocationInput): Promise<BacklotLocation> => {
    // Create location in global library AND attach to project
    const newLocation = await api.post(`/api/v1/backlot/projects/${projectId}/locations`, {
      ...data,
      attach_to_project: true,
    });
    return newLocation as BacklotLocation;
  }, [projectId]);

  const handleAttachGlobalLocation = useCallback(async (locationId: string): Promise<{ attachment_id: string }> => {
    // Attach global location to project
    const result = await api.post(`/api/v1/backlot/projects/${projectId}/locations/attach`, {
      location_id: locationId,
    });
    return { attachment_id: result.id };
  }, [projectId]);

  const handleLinkAsset = useCallback(async (assetId: string) => {
    try {
      await linkAsset.mutateAsync(assetId);
      setShowLinkAssetDialog(false);
      toast.success('Asset linked');
    } catch (err: any) {
      toast.error(err.message || 'Failed to link asset');
    }
  }, [linkAsset]);

  const handleLinkProjectDeliverable = useCallback(async (projectDeliverableId: string) => {
    try {
      await linkProjectDeliverable.mutateAsync(projectDeliverableId);
      setShowLinkProjectDeliverableDialog(false);
      toast.success('Deliverable linked');
    } catch (err: any) {
      toast.error(err.message || 'Failed to link deliverable');
    }
  }, [linkProjectDeliverable]);

  const handleLinkContact = useCallback(async (contactId: string) => {
    try {
      await linkContact.mutateAsync(contactId);
      setShowLinkContactDialog(false);
      toast.success('Contact linked as subject');
    } catch (err: any) {
      toast.error(err.message || 'Failed to link contact');
    }
  }, [linkContact]);

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
      setApprovalForm({ approval_type: 'ROUGH_CUT', notes: '' });
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
    // Try to parse email/phone from contact_info for backwards compatibility
    const contactInfo = subject.contact_info || '';
    const emailMatch = contactInfo.match(/[\w.-]+@[\w.-]+\.\w+/);
    const phoneMatch = contactInfo.match(/[\d\s()+-]{7,}/);

    setSubjectForm({
      id: subject.id,
      subject_type: subject.subject_type,
      name: subject.name,
      role: subject.role || '',
      company: '',  // Will be populated from contact if linked
      email: emailMatch ? emailMatch[0] : '',
      phone: phoneMatch ? phoneMatch[0].trim() : '',
      role_interest: '',  // Will be populated from contact if linked
      status: 'new',
      source: '',
      notes: subject.notes || '',
      contact_id: subject.contact_id || null,
    });
    setShowSubjectDialog(true);
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
        isEditing={editingSection === 'status'}
        onEdit={() => startEditing('status')}
        onCancel={cancelEditing}
        onSave={handleSaveStatus}
        isSaving={updateEpisode.isPending}
        isDirty={isStatusDirty}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Pipeline Stage</Label>
            {editingSection === 'status' ? (
              <Select
                value={statusForm.pipeline_stage}
                onValueChange={(v) => setStatusForm((f) => ({ ...f, pipeline_stage: v }))}
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
            ) : (
              <p className="text-bone-white py-2">
                {PIPELINE_STAGES.find(s => s.value === statusForm.pipeline_stage)?.label || statusForm.pipeline_stage}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Edit Status</Label>
            {editingSection === 'status' ? (
              <Select
                value={statusForm.edit_status}
                onValueChange={(v) => setStatusForm((f) => ({ ...f, edit_status: v }))}
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
            ) : (
              <p className="text-bone-white py-2">
                {EDIT_STATUSES.find(s => s.value === statusForm.edit_status)?.label || statusForm.edit_status}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Delivery Status</Label>
            {editingSection === 'status' ? (
              <Select
                value={statusForm.delivery_status}
                onValueChange={(v) => setStatusForm((f) => ({ ...f, delivery_status: v }))}
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
            ) : (
              <p className="text-bone-white py-2">
                {DELIVERY_STATUSES.find(s => s.value === statusForm.delivery_status)?.label || statusForm.delivery_status}
              </p>
            )}
          </div>
        </div>
      </EditableCard>

      {/* Story Content Card */}
      <EditableCard
        title="Story Content"
        description="Logline, synopsis, outline, and beat sheet"
        icon={FileText}
        canEdit={effectiveCanEdit}
        isEditing={editingSection === 'story'}
        onEdit={() => startEditing('story')}
        onCancel={cancelEditing}
        onSave={handleSaveStory}
        isSaving={updateEpisode.isPending}
        isDirty={isStoryDirty}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            {editingSection === 'story' ? (
              <Input
                value={storyForm.title}
                onChange={(e) => setStoryForm((f) => ({ ...f, title: e.target.value }))}
              />
            ) : (
              <p className="text-bone-white py-2">{storyForm.title || <span className="text-muted-gray italic">Not set</span>}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Logline</Label>
            {editingSection === 'story' ? (
              <Textarea
                value={storyForm.logline}
                onChange={(e) => setStoryForm((f) => ({ ...f, logline: e.target.value }))}
                rows={2}
                placeholder="One-sentence summary..."
              />
            ) : (
              <p className="text-bone-white py-2 whitespace-pre-wrap">{storyForm.logline || <span className="text-muted-gray italic">Not set</span>}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Synopsis</Label>
            {editingSection === 'story' ? (
              <Textarea
                value={storyForm.synopsis}
                onChange={(e) => setStoryForm((f) => ({ ...f, synopsis: e.target.value }))}
                rows={4}
                placeholder="Full story synopsis..."
              />
            ) : (
              <p className="text-bone-white py-2 whitespace-pre-wrap">{storyForm.synopsis || <span className="text-muted-gray italic">Not set</span>}</p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Outline</Label>
              {editingSection === 'story' ? (
                <Textarea
                  value={storyForm.outline}
                  onChange={(e) => setStoryForm((f) => ({ ...f, outline: e.target.value }))}
                  rows={6}
                  placeholder="Structural outline..."
                />
              ) : (
                <p className="text-bone-white py-2 whitespace-pre-wrap">{storyForm.outline || <span className="text-muted-gray italic">Not set</span>}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Beat Sheet</Label>
              {editingSection === 'story' ? (
                <Textarea
                  value={storyForm.beat_sheet}
                  onChange={(e) => setStoryForm((f) => ({ ...f, beat_sheet: e.target.value }))}
                  rows={6}
                  placeholder="Story beats..."
                />
              ) : (
                <p className="text-bone-white py-2 whitespace-pre-wrap">{storyForm.beat_sheet || <span className="text-muted-gray italic">Not set</span>}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            {editingSection === 'story' ? (
              <Textarea
                value={storyForm.notes}
                onChange={(e) => setStoryForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                placeholder="Additional notes..."
              />
            ) : (
              <p className="text-bone-white py-2 whitespace-pre-wrap">{storyForm.notes || <span className="text-muted-gray italic">Not set</span>}</p>
            )}
          </div>

          {/* Linked Beat Sheets Section */}
          <div className="space-y-2 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-muted-gray" />
                Linked Beat Sheets
              </Label>
              {effectiveCanEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedStoryId('');
                    setShowLinkBeatSheetDialog(true);
                  }}
                  className="h-7 text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Link Beat Sheet
                </Button>
              )}
            </div>
            {isLoadingStoryLinks ? (
              <Skeleton className="h-10 w-full" />
            ) : episodeStoryLinks && episodeStoryLinks.length > 0 ? (
              <div className="space-y-2">
                {episodeStoryLinks.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between p-2 rounded bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-bone-white truncate">
                          {link.story?.title || 'Unknown Beat Sheet'}
                        </span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {link.relationship}
                        </Badge>
                      </div>
                      {link.story?.logline && (
                        <p className="text-xs text-muted-gray truncate mt-0.5">
                          {link.story.logline}
                        </p>
                      )}
                    </div>
                    {effectiveCanEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 ml-2 text-muted-gray hover:text-red-400"
                        onClick={() => {
                          unlinkEpisodeFromStory.mutate(link.id, {
                            onSuccess: () => toast.success('Beat sheet unlinked'),
                            onError: (err: any) => toast.error(err.message || 'Failed to unlink'),
                          });
                        }}
                        disabled={unlinkEpisodeFromStory.isPending}
                      >
                        <Unlink2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-gray italic py-2">
                No beat sheets linked to this episode
              </p>
            )}
          </div>
        </div>
      </EditableCard>

      {/* List Items (Interviews, Scenes, Segments) */}
      <EditableCard
        title="Structure"
        description="Interviews, scenes, and segments"
        canEdit={effectiveCanEdit}
        isEditing={editingSection === 'structure'}
        onEdit={() => startEditing('structure')}
        onCancel={cancelEditing}
      >
        {editingSection === 'structure' && (
          <div className="flex justify-end mb-4">
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
          </div>
        )}
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
                      {editingSection === 'structure' && (
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
      </EditableCard>

      {/* Subjects Card */}
      <EditableCard
        title="Subjects"
        icon={Users}
        canEdit={effectiveCanEdit}
        isEditing={editingSection === 'subjects'}
        onEdit={() => startEditing('subjects')}
        onCancel={cancelEditing}
      >
        {editingSection === 'subjects' && (
          <div className="flex justify-end gap-2 mb-4">
            {projectContacts && projectContacts.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowLinkContactDialog(true)}
              >
                <Link2 className="w-4 h-4 mr-2" />
                Link from Contacts
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => {
                setSubjectForm({
                  id: '',
                  subject_type: 'CAST',
                  name: '',
                  role: '',
                  company: '',
                  email: '',
                  phone: '',
                  role_interest: '',
                  status: 'new',
                  source: '',
                  notes: '',
                  contact_id: null,
                });
                setShowSubjectDialog(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New
            </Button>
          </div>
        )}
        {episode.subjects.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-muted-gray">Type</TableHead>
                <TableHead className="text-muted-gray">Name</TableHead>
                <TableHead className="text-muted-gray">Role</TableHead>
                {editingSection === 'subjects' && <TableHead className="text-muted-gray w-20"></TableHead>}
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
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {subject.contact_id && (
                        <Link2 className="w-3 h-3 text-accent-yellow flex-shrink-0" />
                      )}
                      <span className="text-bone-white">{subject.name}</span>
                      {subject.contact_id && subject.contact_name && (
                        <span className="text-xs text-muted-gray">(Linked)</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-gray">{subject.role || '-'}</TableCell>
                  {editingSection === 'subjects' && (
                    <TableCell>
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
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-gray text-center py-4">No subjects added</p>
        )}
      </EditableCard>

      {/* Locations Card */}
      <EditableCard
        title="Locations"
        icon={MapPin}
        canEdit={effectiveCanEdit}
        isEditing={editingSection === 'locations'}
        onEdit={() => startEditing('locations')}
        onCancel={cancelEditing}
      >
        {editingSection === 'locations' && (
          <div className="flex justify-end mb-4">
            <Button
              size="sm"
              onClick={() => setShowLocationPicker(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Location
            </Button>
          </div>
        )}
        {episode.locations.length > 0 ? (
          <div className="space-y-2">
            {episode.locations.map((location) => (
              <div key={location.id} className="flex items-start justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex items-start gap-2">
                  {location.project_location_id && (
                    <Link2 className="w-4 h-4 text-accent-yellow mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <p className="font-medium text-bone-white">{location.name}</p>
                    {location.address && <p className="text-sm text-muted-gray">{location.address}</p>}
                    {location.project_location_id && (
                      <p className="text-xs text-accent-yellow">Linked from Locations tab</p>
                    )}
                  </div>
                </div>
                {editingSection === 'locations' && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-red-400"
                    onClick={() => setDeleteConfirm({ type: 'location', id: location.id })}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-gray text-center py-4">No locations added</p>
        )}
      </EditableCard>

      {/* Key Dates (Milestones) */}
      <EditableCard
        title="Key Dates"
        icon={Calendar}
        canEdit={effectiveCanEdit}
        isEditing={editingSection === 'milestones'}
        onEdit={() => startEditing('milestones')}
        onCancel={cancelEditing}
      >
        {editingSection === 'milestones' && (
          <div className="flex justify-end mb-4">
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
          </div>
        )}
        {episode.milestones.length > 0 ? (
          <div className="space-y-2">
            {episode.milestones.map((milestone) => (
              <div key={milestone.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-24">
                    <p className="text-sm font-medium text-bone-white">
                      {format(parseLocalDate(milestone.date), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-bone-white">{milestone.milestone_type}</p>
                    {milestone.notes && <p className="text-sm text-muted-gray">{milestone.notes}</p>}
                  </div>
                </div>
                {editingSection === 'milestones' && (
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
      </EditableCard>

      {/* Deliverables */}
      <EditableCard
        title="Deliverables"
        icon={Package}
        canEdit={effectiveCanEdit}
        isEditing={editingSection === 'deliverables'}
        onEdit={() => startEditing('deliverables')}
        onCancel={cancelEditing}
      >
        {editingSection === 'deliverables' && (
          <div className="flex justify-end gap-2 mb-4">
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
            {projectDeliverables && projectDeliverables.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowLinkProjectDeliverableDialog(true)}
              >
                <Link2 className="w-4 h-4 mr-2" />
                Link from Assets
              </Button>
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
        {episode.deliverables.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-muted-gray">Deliverable</TableHead>
                <TableHead className="text-muted-gray">Status</TableHead>
                <TableHead className="text-muted-gray">Due Date</TableHead>
                {editingSection === 'deliverables' && <TableHead className="text-muted-gray w-20"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {episode.deliverables.map((del) => {
                const statusInfo = getDeliverableStatusInfo(del.status);
                return (
                  <TableRow key={del.id} className="border-white/10">
                    <TableCell className="text-bone-white">
                      {del.project_deliverable_id ? (
                        <div className="flex items-center gap-2">
                          <Link2 className="w-3 h-3 text-muted-gray" />
                          <span>{del.project_deliverable_name || del.deliverable_type}</span>
                        </div>
                      ) : (
                        del.deliverable_type
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('text-xs text-white', statusInfo?.color || 'bg-gray-500')}>
                        {statusInfo?.label || del.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-gray">
                      {del.due_date ? format(parseLocalDate(del.due_date), 'MMM d') : '-'}
                    </TableCell>
                    {editingSection === 'deliverables' && (
                      <TableCell>
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
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-gray text-center py-4">No deliverables</p>
        )}
      </EditableCard>

      {/* Runtime */}
      <EditableCard
        title="Runtime"
        description="Planned and actual episode duration"
        canEdit={effectiveCanEdit}
        isEditing={editingSection === 'runtime'}
        onEdit={() => startEditing('runtime')}
        onCancel={cancelEditing}
        onSave={handleSaveTeam}
        isSaving={updateEpisode.isPending}
        isDirty={isTeamDirty}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Planned Runtime (minutes)</Label>
            {editingSection === 'runtime' ? (
              <Input
                type="number"
                value={teamForm.planned_runtime_minutes}
                onChange={(e) => setTeamForm((f) => ({ ...f, planned_runtime_minutes: e.target.value }))}
                placeholder="e.g., 45"
              />
            ) : (
              <p className="text-bone-white py-2">
                {teamForm.planned_runtime_minutes ? `${teamForm.planned_runtime_minutes} min` : <span className="text-muted-gray italic">Not set</span>}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Actual Runtime (minutes)</Label>
            {editingSection === 'runtime' ? (
              <Input
                type="number"
                value={teamForm.actual_runtime_minutes}
                onChange={(e) => setTeamForm((f) => ({ ...f, actual_runtime_minutes: e.target.value }))}
                placeholder="e.g., 47"
              />
            ) : (
              <p className="text-bone-white py-2">
                {teamForm.actual_runtime_minutes ? `${teamForm.actual_runtime_minutes} min` : <span className="text-muted-gray italic">Not set</span>}
              </p>
            )}
          </div>
        </div>
      </EditableCard>

      {/* Asset Links */}
      <EditableCard
        title="Asset Links"
        icon={ExternalLink}
        canEdit={effectiveCanEdit}
        isEditing={editingSection === 'assetLinks'}
        onEdit={() => startEditing('assetLinks')}
        onCancel={cancelEditing}
      >
        {editingSection === 'assetLinks' && (
          <div className="flex justify-end gap-2 mb-4">
            {projectAssets && projectAssets.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowLinkAssetDialog(true)}
              >
                <Link2 className="w-4 h-4 mr-2" />
                Link Asset
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => {
                setAssetLinkForm({ label: '', url: '' });
                setShowAssetLinkDialog(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add URL
            </Button>
          </div>
        )}
        {episode.asset_links.length > 0 ? (
          <div className="space-y-2">
            {episode.asset_links.map((link) => (
              <div key={link.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                {link.asset_id ? (
                  <div className="flex items-center gap-2 text-accent-yellow">
                    <Link2 className="w-4 h-4" />
                    <span>{link.label}</span>
                    <span className="text-xs text-muted-gray">(from Assets tab)</span>
                  </div>
                ) : link.url ? (
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-accent-yellow hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {link.label}
                  </a>
                ) : (
                  <span className="text-bone-white">{link.label}</span>
                )}
                {editingSection === 'assetLinks' && (
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
      </EditableCard>

      {/* Storyboards */}
      <EditableCard
        title="Linked Storyboards"
        icon={Images}
        canEdit={effectiveCanEdit}
        isEditing={editingSection === 'storyboards'}
        onEdit={() => startEditing('storyboards')}
        onCancel={cancelEditing}
      >
        {editingSection === 'storyboards' && availableStoryboards && availableStoryboards.length > 0 && (
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowLinkStoryboardDialog(true)}>
              <Link2 className="w-4 h-4 mr-2" />
              Link Storyboard
            </Button>
          </div>
        )}
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
                {editingSection === 'storyboards' && (
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
      </EditableCard>

      {/* Shoot Days */}
      <EditableCard
        title="Tagged Shoot Days"
        icon={Calendar}
        canEdit={effectiveCanEdit}
        isEditing={editingSection === 'shootDays'}
        onEdit={() => startEditing('shootDays')}
        onCancel={cancelEditing}
      >
        {editingSection === 'shootDays' && availableDays.length > 0 && (
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setShowTagShootDayDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Tag Day
            </Button>
          </div>
        )}
        {episode.shoot_days.length > 0 ? (
          <div className="space-y-2">
            {episode.shoot_days.map((day) => (
              <div key={day.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-muted-gray">
                    {format(parseLocalDate(day.date), 'MMM d, yyyy')}
                  </span>
                  <span className="text-bone-white">{day.day_title || day.day_type}</span>
                  <Badge variant="outline" className="text-xs">
                    {day.day_type}
                  </Badge>
                </div>
                {editingSection === 'shootDays' && (
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
      </EditableCard>

      {/* Approvals */}
      <EditableCard
        title="Approvals"
        icon={ClipboardCheck}
        canEdit={canEdit}
        isEditing={editingSection === 'approvals'}
        onEdit={() => startEditing('approvals')}
        onCancel={cancelEditing}
        badge={pendingApprovals.length > 0 ? (
          <Badge className="bg-yellow-500/20 text-yellow-400">{pendingApprovals.length} pending</Badge>
        ) : undefined}
      >
        {editingSection === 'approvals' && (
          <div className="flex justify-end mb-4">
            <Button
              size="sm"
              onClick={() => {
                setApprovalForm({ approval_type: 'ROUGH_CUT', notes: '' });
                setShowApprovalDialog(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Request Approval
            </Button>
          </div>
        )}
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
                      {getApprovalTypeInfo(approval.approval_type)?.label || approval.approval_type}
                    </p>
                    <p className="text-xs text-muted-gray">
                      Requested by {approval.requested_by_name} on{' '}
                      {format(new Date(approval.requested_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                {approval.status === 'PENDING' && editingSection === 'approvals' && (
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
      </EditableCard>

      {/* Subject/Contact Dialog */}
      <Dialog open={showSubjectDialog} onOpenChange={setShowSubjectDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{subjectForm.id ? 'Edit Subject' : 'Add Subject as Contact'}</DialogTitle>
            {!subjectForm.id && (
              <DialogDescription>
                This will create a contact in the Contacts tab linked to this episode.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* Subject Type */}
            <div className="space-y-2">
              <Label>Subject Type *</Label>
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
              <p className="text-xs text-muted-gray">
                Maps to contact type: {
                  subjectForm.subject_type === 'CAST' ? 'Talent' :
                  subjectForm.subject_type === 'CREW' ? 'Crew' :
                  subjectForm.subject_type === 'CONTRIBUTOR' ? 'Collaborator' : 'Other'
                }
              </p>
            </div>

            {/* Name (required) */}
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={subjectForm.name}
                onChange={(e) => setSubjectForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Full name"
              />
            </div>

            {/* Company */}
            <div className="space-y-2">
              <Label>Company</Label>
              <Input
                value={subjectForm.company}
                onChange={(e) => setSubjectForm((f) => ({ ...f, company: e.target.value }))}
                placeholder="Company or organization"
              />
            </div>

            {/* Email & Phone (side by side) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={subjectForm.email}
                  onChange={(e) => setSubjectForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={subjectForm.phone}
                  onChange={(e) => setSubjectForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            {/* Role in Episode (subject-specific) */}
            <div className="space-y-2">
              <Label>Role in Episode</Label>
              <Input
                value={subjectForm.role}
                onChange={(e) => setSubjectForm((f) => ({ ...f, role: e.target.value }))}
                placeholder="Their role in this specific episode"
              />
            </div>

            {/* Role/Interest (contact general) */}
            <div className="space-y-2">
              <Label>General Role/Interest</Label>
              <Input
                value={subjectForm.role_interest}
                onChange={(e) => setSubjectForm((f) => ({ ...f, role_interest: e.target.value }))}
                placeholder="Overall role or area of interest"
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Contact Status</Label>
              <Select
                value={subjectForm.status}
                onValueChange={(v) => setSubjectForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="in_discussion">In Discussion</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Source */}
            <div className="space-y-2">
              <Label>Source</Label>
              <Input
                value={subjectForm.source}
                onChange={(e) => setSubjectForm((f) => ({ ...f, source: e.target.value }))}
                placeholder="How did you meet? (referral, website, etc.)"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={subjectForm.notes}
                onChange={(e) => setSubjectForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
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
              {subjectForm.id ? 'Update' : 'Add Subject & Contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        projectId={projectId}
        onSelect={handleSelectLocationForEpisode}
        onCreateNew={handleCreateLocationForEpisode}
        onAttachGlobal={handleAttachGlobalLocation}
      />

      {/* Link Contact Dialog */}
      <Dialog open={showLinkContactDialog} onOpenChange={setShowLinkContactDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Contact as Subject</DialogTitle>
            <DialogDescription>Select a contact from the project's Contacts tab</DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-80 overflow-y-auto">
            {projectContacts && projectContacts.length > 0 ? (
              <div className="space-y-2">
                {projectContacts
                  .filter((contact) => !episode.subjects.some((s) => s.contact_id === contact.id))
                  .map((contact) => (
                    <button
                      key={contact.id}
                      className="w-full flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 text-left transition-colors"
                      onClick={() => handleLinkContact(contact.id)}
                    >
                      <Users className="w-4 h-4 text-muted-gray mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-bone-white truncate">{contact.name}</p>
                        {contact.role_interest && (
                          <p className="text-sm text-muted-gray truncate">{contact.role_interest}</p>
                        )}
                        {contact.company && (
                          <p className="text-xs text-muted-gray truncate">{contact.company}</p>
                        )}
                      </div>
                    </button>
                  ))}
                {projectContacts.filter((contact) => !episode.subjects.some((s) => s.contact_id === contact.id)).length === 0 && (
                  <p className="text-sm text-muted-gray text-center py-4">All contacts are already linked</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-gray text-center py-4">No contacts available</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkContactDialog(false)}>
              Cancel
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

      {/* Link Asset Dialog */}
      <Dialog open={showLinkAssetDialog} onOpenChange={setShowLinkAssetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Asset</DialogTitle>
            <DialogDescription>Select an asset from the project's Assets tab</DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-80 overflow-y-auto">
            {projectAssets && projectAssets.length > 0 ? (
              <div className="space-y-2">
                {projectAssets
                  .filter((asset) => !episode.asset_links.some((al) => al.asset_id === asset.id))
                  .map((asset) => (
                    <button
                      key={asset.id}
                      className="w-full flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 text-left transition-colors"
                      onClick={() => handleLinkAsset(asset.id)}
                    >
                      <Package className="w-4 h-4 text-muted-gray mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-bone-white truncate">{asset.name}</p>
                        {asset.asset_type && (
                          <p className="text-sm text-muted-gray truncate">{asset.asset_type}</p>
                        )}
                      </div>
                    </button>
                  ))}
                {projectAssets.filter((asset) => !episode.asset_links.some((al) => al.asset_id === asset.id)).length === 0 && (
                  <p className="text-sm text-muted-gray text-center py-4">All project assets are already linked</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-gray text-center py-4">No project assets available</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkAssetDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Project Deliverable Dialog */}
      <Dialog open={showLinkProjectDeliverableDialog} onOpenChange={setShowLinkProjectDeliverableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Deliverable from Assets</DialogTitle>
            <DialogDescription>Select a deliverable from the project's Assets tab</DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-80 overflow-y-auto">
            {projectDeliverables && projectDeliverables.length > 0 ? (
              <div className="space-y-2">
                {projectDeliverables
                  .filter((pd) => !episode.deliverables.some((d) => d.project_deliverable_id === pd.id))
                  .map((pd) => (
                    <button
                      key={pd.id}
                      className="w-full flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 text-left transition-colors"
                      onClick={() => handleLinkProjectDeliverable(pd.id)}
                    >
                      <Package className="w-4 h-4 text-muted-gray mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-bone-white truncate">{pd.name}</p>
                        {pd.deliverable_type && (
                          <p className="text-sm text-muted-gray truncate">{pd.deliverable_type}</p>
                        )}
                      </div>
                    </button>
                  ))}
                {projectDeliverables.filter((pd) => !episode.deliverables.some((d) => d.project_deliverable_id === pd.id)).length === 0 && (
                  <p className="text-sm text-muted-gray text-center py-4">All project deliverables are already linked</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-gray text-center py-4">No project deliverables available</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkProjectDeliverableDialog(false)}>
              Cancel
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

      {/* Link Beat Sheet Dialog */}
      <Dialog open={showLinkBeatSheetDialog} onOpenChange={setShowLinkBeatSheetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Beat Sheet</DialogTitle>
            <DialogDescription>Select a beat sheet to link to this episode.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Beat Sheet</Label>
              <Select value={selectedStoryId} onValueChange={setSelectedStoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a beat sheet..." />
                </SelectTrigger>
                <SelectContent>
                  {(projectStories?.stories || [])
                    .filter((story) => !episodeStoryLinks?.some((link) => link.story_id === story.id))
                    .map((story) => (
                      <SelectItem key={story.id} value={story.id}>
                        {story.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {projectStories?.stories?.filter((s) => !episodeStoryLinks?.some((l) => l.story_id === s.id)).length === 0 && (
              <p className="text-sm text-muted-gray text-center py-2">
                No available beat sheets to link. Create one in the Beat Sheet tab first.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkBeatSheetDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedStoryId) return;
                linkEpisodeToStory.mutate(
                  { story_id: selectedStoryId, relationship: 'primary' },
                  {
                    onSuccess: () => {
                      toast.success('Beat sheet linked');
                      setShowLinkBeatSheetDialog(false);
                      setSelectedStoryId('');
                    },
                    onError: (err: any) => toast.error(err.message || 'Failed to link beat sheet'),
                  }
                );
              }}
              disabled={!selectedStoryId || linkEpisodeToStory.isPending}
            >
              {linkEpisodeToStory.isPending ? 'Linking...' : 'Link'}
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
                  {format(parseLocalDate(day.date), 'MMM d, yyyy')}
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
                onValueChange={(v) => setApprovalForm((f) => ({ ...f, approval_type: v as ApprovalType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPROVAL_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {approvalForm.approval_type && (
                <p className="text-xs text-muted-gray">
                  {getApprovalTypeInfo(approvalForm.approval_type)?.description}
                </p>
              )}
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
              {showDecisionDialog && getApprovalTypeInfo(showDecisionDialog.approval_type)?.description}
              {showDecisionDialog?.approval_type === 'EDIT_LOCK' && ' Approving will lock the episode for editing.'}
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
