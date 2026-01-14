/**
 * AssetsView - Manage project assets and deliverables
 * Assets tab: Track episodes, trailers, social cuts, etc.
 * Deliverables tab: Track platform-specific deliverables and their status
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Film,
  Video,
  Clapperboard,
  Tv,
  Share2,
  Camera,
  FileVideo,
  ChevronRight,
  Clock,
  Check,
  AlertCircle,
  Send,
  Eye,
  Search,
  Filter,
  Package,
  CheckCircle2,
  Link,
  Circle,
  Star,
  ChevronDown,
  Play,
  HardDrive,
} from 'lucide-react';
import { parseLocalDate } from '@/lib/dateUtils';
import {
  useAssets,
  useAssetsSummary,
  useAssetMutations,
  useProjectDeliverables,
  useDeliverablesSummary,
  useDeliverableMutations,
  useDeliverableTemplates,
  useAssetSourceClips,
} from '@/hooks/backlot';
import {
  BacklotAsset,
  BacklotAssetType,
  BacklotDeliverableStatus,
  BacklotProjectDeliverable,
  BacklotDeliverableTemplate,
  AssetInput,
  ProjectDeliverableInput,
  ASSET_TYPE_LABELS,
  ASSET_TYPE_COLORS,
  DELIVERABLE_STATUS_LABELS,
  DELIVERABLE_STATUS_COLORS,
} from '@/types/backlot';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AssetsViewProps {
  projectId: string;
  canEdit: boolean;
}

const ASSET_TYPES: BacklotAssetType[] = ['episode', 'feature', 'trailer', 'teaser', 'social', 'bts', 'footage', 'other'];
const DELIVERABLE_STATUSES: BacklotDeliverableStatus[] = ['not_started', 'in_progress', 'in_review', 'approved', 'delivered'];

const AssetTypeIcon: React.FC<{ type: BacklotAssetType; className?: string }> = ({ type, className }) => {
  const iconClass = cn('w-4 h-4', className);
  switch (type) {
    case 'episode':
      return <Tv className={iconClass} />;
    case 'feature':
      return <Film className={iconClass} />;
    case 'trailer':
      return <Video className={iconClass} />;
    case 'teaser':
      return <Clapperboard className={iconClass} />;
    case 'social':
      return <Share2 className={iconClass} />;
    case 'bts':
      return <Camera className={iconClass} />;
    case 'footage':
      return <HardDrive className={iconClass} />;
    default:
      return <FileVideo className={iconClass} />;
  }
};

const StatusIcon: React.FC<{ status: BacklotDeliverableStatus; className?: string }> = ({ status, className }) => {
  const iconClass = cn('w-4 h-4', className);
  switch (status) {
    case 'not_started':
      return <Clock className={iconClass} />;
    case 'in_progress':
      return <AlertCircle className={iconClass} />;
    case 'in_review':
      return <Eye className={iconClass} />;
    case 'approved':
      return <Check className={iconClass} />;
    case 'delivered':
      return <Send className={iconClass} />;
  }
};

// Source Clips Section - Shows dailies clips linked to an asset
const SourceClipsSection: React.FC<{ assetId: string }> = ({ assetId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { data: clips, isLoading } = useAssetSourceClips(assetId);

  if (isLoading) {
    return (
      <div className="px-4 py-2 border-t border-muted-gray/10">
        <Skeleton className="h-4 w-24" />
      </div>
    );
  }

  if (!clips || clips.length === 0) {
    return null;
  }

  const formatDurationShort = (seconds: number | null | undefined) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full px-4 py-2 border-t border-muted-gray/10 flex items-center justify-between text-sm text-muted-gray hover:text-bone-white hover:bg-charcoal-black/30 transition-colors">
          <div className="flex items-center gap-2">
            <Link className="w-3 h-3" />
            <span>{clips.length} source clip{clips.length !== 1 ? 's' : ''}</span>
          </div>
          <ChevronDown
            className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 py-2 border-t border-muted-gray/10 bg-charcoal-black/30 space-y-2">
          {clips.map((linkedClip) => (
            <div
              key={linkedClip.link_id}
              className="flex items-center gap-3 p-2 rounded bg-charcoal-black/50 border border-muted-gray/10"
            >
              {/* Thumbnail placeholder */}
              <div className="w-12 h-8 bg-charcoal-black rounded flex items-center justify-center flex-shrink-0">
                <Play className="w-3 h-3 text-muted-gray/50" />
              </div>

              {/* Clip info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-bone-white truncate">
                    {linkedClip.clip.file_name || 'Untitled Clip'}
                  </span>
                  {linkedClip.clip.is_circle_take && (
                    <Circle className="w-3 h-3 text-green-400" fill="currentColor" />
                  )}
                  {linkedClip.clip.rating && linkedClip.clip.rating > 0 && (
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: linkedClip.clip.rating }).map((_, i) => (
                        <Star key={i} className="w-2 h-2 text-accent-yellow" fill="currentColor" />
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-gray">
                  {linkedClip.clip.scene_number && <span>Sc. {linkedClip.clip.scene_number}</span>}
                  {linkedClip.clip.take_number && <span>Tk. {linkedClip.clip.take_number}</span>}
                  <span>{formatDurationShort(linkedClip.clip.duration_seconds)}</span>
                </div>
              </div>

              {/* Link type badge */}
              <Badge variant="outline" className="text-xs border-muted-gray/30 text-muted-gray capitalize">
                {linkedClip.link_type}
              </Badge>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

// Format duration in seconds to human-readable
const formatDuration = (seconds: number | null): string => {
  if (!seconds) return '-';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

// Parse duration string (HH:MM:SS or MM:SS) to seconds
const parseDuration = (str: string): number | null => {
  if (!str) return null;
  const parts = str.split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return null;
};

const AssetsView: React.FC<AssetsViewProps> = ({ projectId, canEdit }) => {
  const [activeTab, setActiveTab] = useState<'assets' | 'deliverables'>('assets');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<BacklotAssetType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<BacklotDeliverableStatus | 'all'>('all');

  // Asset modal state
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<BacklotAsset | null>(null);
  const [assetForm, setAssetForm] = useState<AssetInput>({
    asset_type: 'episode',
    title: '',
    description: '',
    duration_seconds: undefined,
    version_label: '',
    file_reference: '',
    status: 'not_started',
  });
  const [durationInput, setDurationInput] = useState('');

  // Deliverable modal state
  const [showDeliverableModal, setShowDeliverableModal] = useState(false);
  const [editingDeliverable, setEditingDeliverable] = useState<BacklotProjectDeliverable | null>(null);
  const [deliverableForm, setDeliverableForm] = useState<ProjectDeliverableInput>({
    platform: '',
    name: '',
    status: 'not_started',
  });
  const [selectedAssetForDeliverable, setSelectedAssetForDeliverable] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Bulk deliverables modal state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkAssetId, setBulkAssetId] = useState<string | null>(null);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'asset' | 'deliverable'; id: string; name: string } | null>(null);

  // Queries
  const { data: assets, isLoading: assetsLoading } = useAssets(projectId);
  const { data: assetsSummary } = useAssetsSummary(projectId);
  const { data: deliverables, isLoading: deliverablesLoading } = useProjectDeliverables(projectId);
  const { data: deliverablesSummary } = useDeliverablesSummary(projectId);
  const { data: templates = [] } = useDeliverableTemplates();

  // Mutations
  const assetMutations = useAssetMutations(projectId);
  const deliverableMutations = useDeliverableMutations(projectId);

  // Filter assets
  const filteredAssets = (assets || []).filter((asset) => {
    if (typeFilter !== 'all' && asset.asset_type !== typeFilter) return false;
    if (statusFilter !== 'all' && asset.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!asset.title.toLowerCase().includes(q) && !asset.description?.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  // Filter deliverables
  const filteredDeliverables = (deliverables || []).filter((d) => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!d.name.toLowerCase().includes(q) && !d.platform.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  // Open asset modal for create/edit
  const openAssetModal = (asset?: BacklotAsset) => {
    if (asset) {
      setEditingAsset(asset);
      setAssetForm({
        asset_type: asset.asset_type,
        title: asset.title,
        description: asset.description || '',
        duration_seconds: asset.duration_seconds || undefined,
        version_label: asset.version_label || '',
        file_reference: asset.file_reference || '',
        status: asset.status,
      });
      setDurationInput(formatDuration(asset.duration_seconds));
    } else {
      setEditingAsset(null);
      setAssetForm({
        asset_type: 'episode',
        title: '',
        description: '',
        duration_seconds: undefined,
        version_label: '',
        file_reference: '',
        status: 'not_started',
      });
      setDurationInput('');
    }
    setShowAssetModal(true);
  };

  // Handle asset save
  const handleSaveAsset = async () => {
    try {
      const input: AssetInput = {
        ...assetForm,
        duration_seconds: parseDuration(durationInput) || undefined,
      };

      if (editingAsset) {
        await assetMutations.updateAsset.mutateAsync({ assetId: editingAsset.id, input });
        toast.success('Asset updated');
      } else {
        await assetMutations.createAsset.mutateAsync(input);
        toast.success('Asset created');
      }
      setShowAssetModal(false);
    } catch (error) {
      toast.error('Failed to save asset');
    }
  };

  // Open deliverable modal for create/edit
  const openDeliverableModal = (deliverable?: BacklotProjectDeliverable, assetId?: string) => {
    if (deliverable) {
      setEditingDeliverable(deliverable);
      setDeliverableForm({
        asset_id: deliverable.asset_id || undefined,
        template_id: deliverable.template_id || undefined,
        platform: deliverable.platform,
        name: deliverable.name,
        specs: deliverable.specs,
        status: deliverable.status,
        due_date: deliverable.due_date || undefined,
        delivered_date: deliverable.delivered_date || undefined,
        delivery_notes: deliverable.delivery_notes || undefined,
        download_url: deliverable.download_url || undefined,
      });
      setSelectedAssetForDeliverable(deliverable.asset_id);
      setSelectedTemplateId(deliverable.template_id);
    } else {
      setEditingDeliverable(null);
      setDeliverableForm({
        platform: '',
        name: '',
        status: 'not_started',
      });
      setSelectedAssetForDeliverable(assetId || null);
      setSelectedTemplateId(null);
    }
    setShowDeliverableModal(true);
  };

  // Handle template selection for deliverable
  const handleTemplateSelect = (templateId: string) => {
    const template = templates?.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplateId(templateId);
      setDeliverableForm((prev) => ({
        ...prev,
        template_id: templateId,
        platform: template.platform,
        name: template.name,
        specs: template.specs,
      }));
    }
  };

  // Handle deliverable save
  const handleSaveDeliverable = async () => {
    try {
      const input: ProjectDeliverableInput = {
        ...deliverableForm,
        asset_id: selectedAssetForDeliverable || undefined,
      };

      if (editingDeliverable) {
        await deliverableMutations.updateDeliverable.mutateAsync({ deliverableId: editingDeliverable.id, input });
        toast.success('Deliverable updated');
      } else {
        await deliverableMutations.createDeliverable.mutateAsync(input);
        toast.success('Deliverable created');
      }
      setShowDeliverableModal(false);
    } catch (error) {
      toast.error('Failed to save deliverable');
    }
  };

  // Handle status change
  const handleStatusChange = async (id: string, type: 'asset' | 'deliverable', status: BacklotDeliverableStatus) => {
    try {
      if (type === 'asset') {
        await assetMutations.updateAssetStatus.mutateAsync({ assetId: id, status });
      } else {
        await deliverableMutations.updateDeliverableStatus.mutateAsync({ deliverableId: id, status });
      }
      toast.success('Status updated');
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'asset') {
        await assetMutations.deleteAsset.mutateAsync(deleteTarget.id);
        toast.success('Asset deleted');
      } else {
        await deliverableMutations.deleteDeliverable.mutateAsync(deleteTarget.id);
        toast.success('Deliverable deleted');
      }
      setDeleteTarget(null);
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  // Handle bulk create deliverables
  const openBulkModal = (assetId: string) => {
    setBulkAssetId(assetId);
    setSelectedTemplates([]);
    setShowBulkModal(true);
  };

  const handleBulkCreate = async () => {
    if (!bulkAssetId || selectedTemplates.length === 0) return;
    try {
      await deliverableMutations.bulkCreateDeliverables.mutateAsync({
        assetId: bulkAssetId,
        input: { template_ids: selectedTemplates },
      });
      toast.success(`Created ${selectedTemplates.length} deliverables`);
      setShowBulkModal(false);
    } catch (error) {
      toast.error('Failed to create deliverables');
    }
  };

  if (assetsLoading || deliverablesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading text-bone-white">Assets & Deliverables</h2>
          <p className="text-muted-gray text-sm">Track your project's media assets and platform deliverables</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-charcoal-black/50 border-muted-gray/20">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-bone-white">{assetsSummary?.total_assets || 0}</div>
            <p className="text-xs text-muted-gray">Total Assets</p>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black/50 border-muted-gray/20">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-bone-white">{deliverablesSummary?.total_deliverables || 0}</div>
            <p className="text-xs text-muted-gray">Deliverables</p>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black/50 border-muted-gray/20">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-400">
              {(deliverablesSummary?.by_status?.delivered || 0) + (deliverablesSummary?.by_status?.approved || 0)}
            </div>
            <p className="text-xs text-muted-gray">Completed</p>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black/50 border-muted-gray/20">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-orange-400">{deliverablesSummary?.overdue_count || 0}</div>
            <p className="text-xs text-muted-gray">Overdue</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'assets' | 'deliverables')}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList className="bg-muted-gray/10 w-fit">
            <TabsTrigger value="assets" className="data-[state=active]:bg-accent-yellow/20 data-[state=active]:text-accent-yellow">
              Assets
            </TabsTrigger>
            <TabsTrigger value="deliverables" className="data-[state=active]:bg-accent-yellow/20 data-[state=active]:text-accent-yellow">
              Deliverables
            </TabsTrigger>
          </TabsList>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-48 bg-charcoal-black border-muted-gray/30"
              />
            </div>

            {activeTab === 'assets' && (
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as BacklotAssetType | 'all')}>
                <SelectTrigger className="w-32 bg-charcoal-black border-muted-gray/30">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {ASSET_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {ASSET_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as BacklotDeliverableStatus | 'all')}>
              <SelectTrigger className="w-32 bg-charcoal-black border-muted-gray/30">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {DELIVERABLE_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {DELIVERABLE_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {canEdit && (
              <Button
                onClick={() => activeTab === 'assets' ? openAssetModal() : openDeliverableModal()}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                {activeTab === 'assets' ? 'Add Asset' : 'Add Deliverable'}
              </Button>
            )}
          </div>
        </div>

        {/* Assets Tab */}
        <TabsContent value="assets" className="mt-6">
          {filteredAssets.length === 0 ? (
            <Card className="bg-charcoal-black/50 border-muted-gray/20 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Film className="w-12 h-12 text-muted-gray mb-4" />
                <h3 className="text-lg font-medium text-bone-white mb-2">No assets yet</h3>
                <p className="text-muted-gray text-sm mb-4">
                  {searchQuery || typeFilter !== 'all' || statusFilter !== 'all'
                    ? 'No assets match your filters'
                    : 'Add your first asset to start tracking'}
                </p>
                {canEdit && !searchQuery && typeFilter === 'all' && statusFilter === 'all' && (
                  <Button onClick={() => openAssetModal()} className="bg-accent-yellow text-charcoal-black hover:bg-bone-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Asset
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAssets.map((asset) => (
                <Card key={asset.id} className="bg-charcoal-black/50 border-muted-gray/20 hover:border-accent-yellow/30 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn('text-xs', ASSET_TYPE_COLORS[asset.asset_type])}>
                          <AssetTypeIcon type={asset.asset_type} className="w-3 h-3 mr-1" />
                          {ASSET_TYPE_LABELS[asset.asset_type]}
                        </Badge>
                        {asset.version_label && (
                          <Badge variant="outline" className="text-xs border-muted-gray/30 text-muted-gray">
                            {asset.version_label}
                          </Badge>
                        )}
                      </div>
                      {canEdit && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openAssetModal(asset)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openBulkModal(asset.id)}>
                              <Package className="w-4 h-4 mr-2" />
                              Add Deliverables
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget({ type: 'asset', id: asset.id, name: asset.title })}
                              className="text-red-400"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    <CardTitle className="text-lg text-bone-white">{asset.title}</CardTitle>
                    {asset.description && (
                      <CardDescription className="text-muted-gray line-clamp-2">{asset.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-muted-gray">
                        {asset.duration_seconds && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(asset.duration_seconds)}
                          </span>
                        )}
                        {(asset.deliverables_count || 0) > 0 && (
                          <span className="flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            {asset.deliverables_count} deliverable{(asset.deliverables_count || 0) !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      <Select
                        value={asset.status}
                        onValueChange={(v) => handleStatusChange(asset.id, 'asset', v as BacklotDeliverableStatus)}
                        disabled={!canEdit}
                      >
                        <SelectTrigger className={cn('w-fit h-7 text-xs border-0', DELIVERABLE_STATUS_COLORS[asset.status])}>
                          <StatusIcon status={asset.status} className="w-3 h-3 mr-1" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DELIVERABLE_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {DELIVERABLE_STATUS_LABELS[status]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>

                  {/* Source Clips Section */}
                  <SourceClipsSection assetId={asset.id} />
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Deliverables Tab */}
        <TabsContent value="deliverables" className="mt-6">
          {filteredDeliverables.length === 0 ? (
            <Card className="bg-charcoal-black/50 border-muted-gray/20 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="w-12 h-12 text-muted-gray mb-4" />
                <h3 className="text-lg font-medium text-bone-white mb-2">No deliverables yet</h3>
                <p className="text-muted-gray text-sm mb-4">
                  {searchQuery || statusFilter !== 'all'
                    ? 'No deliverables match your filters'
                    : 'Create deliverables to track platform requirements'}
                </p>
                {canEdit && !searchQuery && statusFilter === 'all' && (
                  <Button onClick={() => openDeliverableModal()} className="bg-accent-yellow text-charcoal-black hover:bg-bone-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Deliverable
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredDeliverables.map((deliverable) => (
                <Card key={deliverable.id} className="bg-charcoal-black/50 border-muted-gray/20 hover:border-accent-yellow/30 transition-colors">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="flex flex-col">
                          <span className="text-bone-white font-medium truncate">{deliverable.name}</span>
                          <div className="flex items-center gap-2 text-sm text-muted-gray">
                            <span>{deliverable.platform}</span>
                            {deliverable.asset_title && (
                              <>
                                <ChevronRight className="w-3 h-3" />
                                <span className="truncate">{deliverable.asset_title}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {deliverable.due_date && (
                          <Badge variant="outline" className="text-xs border-muted-gray/30 text-muted-gray">
                            Due: {parseLocalDate(deliverable.due_date).toLocaleDateString()}
                          </Badge>
                        )}

                        <Select
                          value={deliverable.status}
                          onValueChange={(v) => handleStatusChange(deliverable.id, 'deliverable', v as BacklotDeliverableStatus)}
                          disabled={!canEdit}
                        >
                          <SelectTrigger className={cn('w-32 h-8 text-xs border-0', DELIVERABLE_STATUS_COLORS[deliverable.status])}>
                            <StatusIcon status={deliverable.status} className="w-3 h-3 mr-1" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DELIVERABLE_STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>
                                {DELIVERABLE_STATUS_LABELS[status]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {canEdit && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openDeliverableModal(deliverable)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget({ type: 'deliverable', id: deliverable.id, name: deliverable.name })}
                                className="text-red-400"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Asset Modal */}
      <Dialog open={showAssetModal} onOpenChange={setShowAssetModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAsset ? 'Edit Asset' : 'Add Asset'}</DialogTitle>
            <DialogDescription>
              {editingAsset ? 'Update asset details' : 'Add a new media asset to your project'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Asset Type</Label>
              <Select
                value={assetForm.asset_type}
                onValueChange={(v) => setAssetForm({ ...assetForm, asset_type: v as BacklotAssetType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      <div className="flex items-center gap-2">
                        <AssetTypeIcon type={type} />
                        {ASSET_TYPE_LABELS[type]}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={assetForm.title}
                onChange={(e) => setAssetForm({ ...assetForm, title: e.target.value })}
                placeholder="e.g., Episode 1 - Pilot"
              />
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={assetForm.description}
                onChange={(e) => setAssetForm({ ...assetForm, description: e.target.value })}
                placeholder="Brief description of this asset"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duration (MM:SS or HH:MM:SS)</Label>
                <Input
                  value={durationInput}
                  onChange={(e) => setDurationInput(e.target.value)}
                  placeholder="e.g., 45:30 or 1:30:00"
                />
              </div>

              <div className="space-y-2">
                <Label>Version Label</Label>
                <Input
                  value={assetForm.version_label}
                  onChange={(e) => setAssetForm({ ...assetForm, version_label: e.target.value })}
                  placeholder="e.g., v3, Final"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>File Reference (optional)</Label>
              <Input
                value={assetForm.file_reference}
                onChange={(e) => setAssetForm({ ...assetForm, file_reference: e.target.value })}
                placeholder="Path or identifier for the file"
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={assetForm.status}
                onValueChange={(v) => setAssetForm({ ...assetForm, status: v as BacklotDeliverableStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERABLE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {DELIVERABLE_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssetModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveAsset}
              disabled={!assetForm.title || assetMutations.createAsset.isPending || assetMutations.updateAsset.isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {editingAsset ? 'Save Changes' : 'Create Asset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deliverable Modal */}
      <Dialog open={showDeliverableModal} onOpenChange={setShowDeliverableModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDeliverable ? 'Edit Deliverable' : 'Add Deliverable'}</DialogTitle>
            <DialogDescription>
              {editingDeliverable ? 'Update deliverable details' : 'Add a platform deliverable'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!editingDeliverable && (
              <div className="space-y-2">
                <Label>Use Template (optional)</Label>
                <Select value={selectedTemplateId || ''} onValueChange={handleTemplateSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name} ({template.platform})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Link to Asset (optional)</Label>
              <Select
                value={selectedAssetForDeliverable || ''}
                onValueChange={(v) => setSelectedAssetForDeliverable(v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an asset..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No asset</SelectItem>
                  {assets?.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Platform</Label>
              <Input
                value={deliverableForm.platform}
                onChange={(e) => setDeliverableForm({ ...deliverableForm, platform: e.target.value })}
                placeholder="e.g., YouTube, Netflix, Instagram"
              />
            </div>

            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={deliverableForm.name}
                onChange={(e) => setDeliverableForm({ ...deliverableForm, name: e.target.value })}
                placeholder="e.g., YouTube 4K Master"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={deliverableForm.due_date || ''}
                  onChange={(e) => setDeliverableForm({ ...deliverableForm, due_date: e.target.value || undefined })}
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={deliverableForm.status}
                  onValueChange={(v) => setDeliverableForm({ ...deliverableForm, status: v as BacklotDeliverableStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELIVERABLE_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {DELIVERABLE_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={deliverableForm.delivery_notes || ''}
                onChange={(e) => setDeliverableForm({ ...deliverableForm, delivery_notes: e.target.value || undefined })}
                placeholder="Delivery notes or instructions"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeliverableModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveDeliverable}
              disabled={!deliverableForm.platform || !deliverableForm.name || deliverableMutations.createDeliverable.isPending || deliverableMutations.updateDeliverable.isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {editingDeliverable ? 'Save Changes' : 'Create Deliverable'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Deliverables Modal */}
      <Dialog open={showBulkModal} onOpenChange={setShowBulkModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Deliverables from Templates</DialogTitle>
            <DialogDescription>
              Select platform templates to create deliverables for this asset
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-80 overflow-y-auto">
            {templates?.map((template) => (
              <label
                key={template.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                  selectedTemplates.includes(template.id)
                    ? 'border-accent-yellow bg-accent-yellow/10'
                    : 'border-muted-gray/30 hover:border-muted-gray/50'
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedTemplates.includes(template.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedTemplates([...selectedTemplates, template.id]);
                    } else {
                      setSelectedTemplates(selectedTemplates.filter((id) => id !== template.id));
                    }
                  }}
                  className="sr-only"
                />
                <div className={cn(
                  'w-5 h-5 rounded border flex items-center justify-center',
                  selectedTemplates.includes(template.id)
                    ? 'border-accent-yellow bg-accent-yellow'
                    : 'border-muted-gray/50'
                )}>
                  {selectedTemplates.includes(template.id) && (
                    <CheckCircle2 className="w-4 h-4 text-charcoal-black" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-bone-white">{template.name}</div>
                  <div className="text-xs text-muted-gray">{template.platform}</div>
                </div>
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkCreate}
              disabled={selectedTemplates.length === 0 || deliverableMutations.bulkCreateDeliverables.isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              Create {selectedTemplates.length} Deliverable{selectedTemplates.length !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type === 'asset' ? 'Asset' : 'Deliverable'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
              {deleteTarget?.type === 'asset' && ' All associated deliverables will also be deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AssetsView;
