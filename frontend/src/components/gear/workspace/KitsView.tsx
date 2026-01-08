/**
 * Kits View
 * Manage kit templates and instances
 */
import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Package,
  CheckCircle2,
  Loader2,
  ListPlus,
  XCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { useGearKitTemplates, useGearKitInstances, useGearKitTemplate, useGearKitInstance, useGearCategories, useGearPrintQueue, useGearAssets } from '@/hooks/gear';
import type { GearKitTemplate, GearKitInstance, AssetStatus, GearAsset } from '@/types/gear';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { AlertCircle, RefreshCw } from 'lucide-react';

const STATUS_COLORS: Record<AssetStatus, string> = {
  available: 'bg-green-500/20 text-green-400 border-green-500/30',
  reserved: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  checked_out: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  in_transit: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  quarantined: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  under_repair: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  retired: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  lost: 'bg-red-500/20 text-red-400 border-red-500/30',
};

interface KitsViewProps {
  orgId: string;
}

export function KitsView({ orgId }: KitsViewProps) {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'templates' | 'instances'>('instances');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateTemplateOpen, setIsCreateTemplateOpen] = useState(false);
  const [isCreateInstanceOpen, setIsCreateInstanceOpen] = useState(false);
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [verifyingKitId, setVerifyingKitId] = useState<string | null>(null);
  const [viewingKitId, setViewingKitId] = useState<string | null>(null);

  // Multi-select state for batch operations
  const [selectedKits, setSelectedKits] = useState<Set<string>>(new Set());
  const [queueAddedCount, setQueueAddedCount] = useState<number | null>(null);

  const { templates, isLoading: templatesLoading, error: templatesError, refetch: refetchTemplates, createTemplate } = useGearKitTemplates(orgId);
  const { instances, isLoading: instancesLoading, error: instancesError, refetch: refetchInstances, createInstance } = useGearKitInstances(orgId);
  const { addToQueue } = useGearPrintQueue(orgId);

  const filteredTemplates = (templates ?? []).filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredInstances = (instances ?? []).filter((i) =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Selection handlers for batch operations
  const toggleKit = (kitId: string) => {
    setSelectedKits((prev) => {
      const next = new Set(prev);
      if (next.has(kitId)) {
        next.delete(kitId);
      } else {
        next.add(kitId);
      }
      return next;
    });
  };

  const toggleAllKits = () => {
    if (selectedKits.size === filteredInstances.length && filteredInstances.length > 0) {
      setSelectedKits(new Set());
    } else {
      setSelectedKits(new Set(filteredInstances.map((k) => k.id)));
    }
  };

  const clearSelection = () => {
    setSelectedKits(new Set());
  };

  const handleAddToQueue = async () => {
    if (selectedKits.size === 0) return;
    try {
      await addToQueue.mutateAsync({
        kit_ids: Array.from(selectedKits),
      });
      setQueueAddedCount(selectedKits.size);
      clearSelection();
      // Clear the success message after 3 seconds
      setTimeout(() => setQueueAddedCount(null), 3000);
    } catch (error) {
      console.error('Failed to add to queue:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
          <Input
            placeholder="Search kits..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          onClick={() =>
            activeTab === 'templates' ? setIsCreateTemplateOpen(true) : setIsCreateInstanceOpen(true)
          }
        >
          <Plus className="w-4 h-4 mr-2" />
          {activeTab === 'templates' ? 'New Template' : 'New Kit'}
        </Button>
      </div>

      {/* Queue Added Success Message */}
      {queueAddedCount !== null && (
        <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          <span className="text-sm text-green-400">
            Added {queueAddedCount} kit{queueAddedCount !== 1 ? 's' : ''} to print queue
          </span>
        </div>
      )}

      {/* Selection Toolbar - shows when items selected */}
      {selectedKits.size > 0 && activeTab === 'instances' && (
        <div className="flex items-center gap-4 p-3 bg-accent-yellow/10 rounded-lg border border-accent-yellow/30">
          <Checkbox
            checked={selectedKits.size === filteredInstances.length && filteredInstances.length > 0}
            onCheckedChange={toggleAllKits}
            aria-label="Select all kits"
          />
          <span className="text-sm font-medium text-bone-white">
            {selectedKits.size} kit{selectedKits.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddToQueue}
            disabled={addToQueue.isPending}
          >
            {addToQueue.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ListPlus className="w-4 h-4 mr-2" />
            )}
            Add to Queue
          </Button>
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            <XCircle className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'templates' | 'instances')}>
        <TabsList className="bg-charcoal-black/50 border border-muted-gray/30">
          <TabsTrigger value="instances">Kit Instances ({instances.length})</TabsTrigger>
          <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="instances" className="mt-6">
          {instancesError ? (
            <ErrorState
              message={instancesError instanceof Error ? instancesError.message : 'Failed to load kit instances'}
              onRetry={() => refetchInstances()}
            />
          ) : instancesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : filteredInstances.length === 0 ? (
            <EmptyState
              title="No Kit Instances"
              description="Create kit instances from templates to group equipment together"
              action={
                <Button onClick={() => setIsCreateInstanceOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Kit
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredInstances.map((kit) => (
                <KitInstanceCard
                  key={kit.id}
                  kit={kit}
                  isSelected={selectedKits.has(kit.id)}
                  onToggle={toggleKit}
                  onEdit={() => setEditingInstanceId(kit.id)}
                  onVerify={() => setVerifyingKitId(kit.id)}
                  onView={() => setViewingKitId(kit.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          {templatesError ? (
            <ErrorState
              message={templatesError instanceof Error ? templatesError.message : 'Failed to load templates'}
              onRetry={() => refetchTemplates()}
            />
          ) : templatesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <EmptyState
              title="No Kit Templates"
              description="Create templates to define standard equipment groupings"
              action={
                <Button onClick={() => setIsCreateTemplateOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Template
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => (
                <KitTemplateCard key={template.id} template={template} onEdit={() => setEditingTemplateId(template.id)} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Template Modal */}
      <CreateTemplateModal
        isOpen={isCreateTemplateOpen}
        onClose={() => setIsCreateTemplateOpen(false)}
        orgId={orgId}
        onSubmit={async (data) => {
          await createTemplate.mutateAsync(data);
          setIsCreateTemplateOpen(false);
        }}
        isSubmitting={createTemplate.isPending}
      />

      {/* Create Instance Modal */}
      <CreateInstanceModal
        isOpen={isCreateInstanceOpen}
        onClose={() => setIsCreateInstanceOpen(false)}
        orgId={orgId}
        templates={templates}
        onSubmit={async (data) => {
          // Create the kit instance
          const result = await createInstance.mutateAsync({
            name: data.name,
            template_id: data.template_id,
          });
          // Add selected assets to the kit if any
          if (data.asset_ids && data.asset_ids.length > 0 && result?.instance?.id && session?.access_token) {
            const kitId = result.instance.id;
            for (const assetId of data.asset_ids) {
              try {
                await fetch(`/api/v1/gear/kits/instances/item/${kitId}/assets`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({ asset_id: assetId }),
                });
              } catch (e) {
                console.error('Failed to add asset to kit:', e);
              }
            }
            // Refetch to update the list with new contents
            refetchInstances();
          }
          setIsCreateInstanceOpen(false);
        }}
        isSubmitting={createInstance.isPending}
      />

      {/* Edit Instance Modal */}
      {editingInstanceId && (
        <EditInstanceModal
          instanceId={editingInstanceId}
          onClose={() => setEditingInstanceId(null)}
        />
      )}

      {/* Edit Template Modal */}
      {editingTemplateId && (
        <EditTemplateModal
          templateId={editingTemplateId}
          onClose={() => setEditingTemplateId(null)}
        />
      )}

      {/* Verify Contents Modal */}
      {verifyingKitId && (
        <VerifyContentsModal
          kitId={verifyingKitId}
          onClose={() => setVerifyingKitId(null)}
        />
      )}

      {/* Kit Detail Modal */}
      {viewingKitId && (
        <KitDetailModal
          kitId={viewingKitId}
          onClose={() => setViewingKitId(null)}
          onEdit={() => {
            setViewingKitId(null);
            setEditingInstanceId(viewingKitId);
          }}
          onVerify={() => {
            setViewingKitId(null);
            setVerifyingKitId(viewingKitId);
          }}
        />
      )}
    </div>
  );
}

function KitInstanceCard({
  kit,
  isSelected,
  onToggle,
  onEdit,
  onVerify,
  onView,
}: {
  kit: GearKitInstance;
  isSelected: boolean;
  onToggle: (kitId: string) => void;
  onEdit: () => void;
  onVerify: () => void;
  onView: () => void;
}) {
  const contentCount = kit.contents?.length ?? 0;
  const presentCount = kit.contents?.filter((c) => c.is_present).length ?? 0;

  return (
    <Card
      className={cn(
        'bg-charcoal-black/50 border-muted-gray/30 hover:border-accent-yellow/50 transition-colors cursor-pointer',
        isSelected && 'border-accent-yellow/50 bg-accent-yellow/5'
      )}
      onClick={onView}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggle(kit.id)}
              aria-label={`Select ${kit.name}`}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="w-10 h-10 rounded-lg bg-accent-yellow/20 flex items-center justify-center">
              <Layers className="w-5 h-5 text-accent-yellow" />
            </div>
            <div>
              <CardTitle className="text-bone-white text-base">{kit.name}</CardTitle>
              <code className="text-xs text-muted-gray">{kit.internal_id}</code>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Edit className="w-4 h-4 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onVerify(); }}>
                <CheckCircle2 className="w-4 h-4 mr-2" /> Verify Contents
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <Badge className={cn('border', STATUS_COLORS[kit.status])}>
            {kit.status.replace('_', ' ')}
          </Badge>
          <div className="flex items-center gap-1 text-sm text-muted-gray">
            <Package className="w-4 h-4" />
            <span>
              {presentCount}/{contentCount} items
            </span>
          </div>
        </div>
        {kit.template_name && (
          <p className="text-xs text-muted-gray mt-2">Template: {kit.template_name}</p>
        )}
      </CardContent>
    </Card>
  );
}

function KitTemplateCard({ template, onEdit }: { template: GearKitTemplate; onEdit: () => void }) {
  const itemCount = template.items?.length ?? 0;

  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30 hover:border-accent-yellow/50 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Copy className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-bone-white text-base">{template.name}</CardTitle>
              {template.category_name && (
                <p className="text-xs text-muted-gray">{template.category_name}</p>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="w-4 h-4 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Plus className="w-4 h-4 mr-2" /> Create Instance
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-gray">{itemCount} items in template</p>
        {template.description && (
          <p className="text-xs text-muted-gray mt-1 line-clamp-2">{template.description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Layers className="w-12 h-12 text-muted-gray mb-4" />
        <h3 className="text-lg font-semibold text-bone-white mb-2">{title}</h3>
        <p className="text-muted-gray text-center mb-4">{description}</p>
        {action}
      </CardContent>
    </Card>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className="bg-charcoal-black/50 border-red-500/30">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-bone-white mb-2">Error Loading Data</h3>
        <p className="text-muted-gray text-center mb-4 max-w-md">{message}</p>
        <Button onClick={onRetry} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </CardContent>
    </Card>
  );
}

function CreateTemplateModal({
  isOpen,
  onClose,
  orgId,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  onSubmit: (data: { name: string; description?: string }) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onSubmit({ name: name.trim(), description: description.trim() || undefined });
    setName('');
    setDescription('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Kit Template</DialogTitle>
          <DialogDescription>Define a template for grouping equipment</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Camera Package A"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateInstanceModal({
  isOpen,
  onClose,
  orgId,
  templates,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  templates: GearKitTemplate[];
  onSubmit: (data: { name: string; template_id?: string; asset_ids?: string[] }) => Promise<void>;
  isSubmitting: boolean;
}) {
  // Step management: 0=Details, 1=Assets, 2=Review
  const [step, setStep] = useState(0);

  // Step 1 state: Kit details
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [notes, setNotes] = useState('');

  // Step 2 state: Asset selection
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [assetSearch, setAssetSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Fetch assets and categories for Step 2
  const { assets, isLoading: assetsLoading } = useGearAssets({
    orgId,
    search: assetSearch || undefined,
    categoryId: categoryFilter || undefined,
    limit: 100,
    enabled: isOpen,
  });
  const { categories } = useGearCategories(orgId);

  // Filter to show available assets (not currently in other kits ideally)
  const availableAssets = assets || [];

  // Reset form when dialog closes
  React.useEffect(() => {
    if (!isOpen) {
      setStep(0);
      setName('');
      setTemplateId('');
      setNotes('');
      setSelectedAssetIds([]);
      setAssetSearch('');
      setCategoryFilter('');
    }
  }, [isOpen]);

  // Toggle asset selection
  const toggleAsset = (assetId: string) => {
    setSelectedAssetIds((prev) =>
      prev.includes(assetId) ? prev.filter((id) => id !== assetId) : [...prev, assetId]
    );
  };

  // Get selected asset objects for review step
  const selectedAssets = availableAssets.filter((a) => selectedAssetIds.includes(a.id));

  // Validation
  const canProceedStep1 = name.trim().length > 0;
  const canSubmit = canProceedStep1; // Assets are optional

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit({
      name: name.trim(),
      template_id: templateId || undefined,
      asset_ids: selectedAssetIds.length > 0 ? selectedAssetIds : undefined,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Create New Kit</span>
            <span className="text-sm font-normal text-muted-gray">
              Step {step + 1} of 3
            </span>
          </DialogTitle>
          <DialogDescription>
            {step === 0 && 'Enter kit details'}
            {step === 1 && 'Select assets to include in this kit'}
            {step === 2 && 'Review and create your kit'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Kit Details */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Kit Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Camera Package A-1"
              />
            </div>
            <div>
              <Label htmlFor="template">From Template (optional)</Label>
              <select
                id="template"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full p-2 bg-charcoal-black border border-muted-gray/30 rounded text-bone-white"
              >
                <option value="">No template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes..."
              />
            </div>
          </div>
        )}

        {/* Step 2: Select Assets */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Search and Filter */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-gray" />
                <Input
                  placeholder="Search assets..."
                  value={assetSearch}
                  onChange={(e) => setAssetSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-[140px] p-2 bg-charcoal-black border border-muted-gray/30 rounded text-bone-white text-sm"
              >
                <option value="">All Categories</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Asset List */}
            <ScrollArea className="h-[280px] border border-muted-gray/30 rounded-lg">
              {assetsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-gray" />
                </div>
              ) : availableAssets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-gray">
                  <Package className="h-8 w-8 mb-2" />
                  <p className="text-sm">No assets found</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {availableAssets.map((asset) => {
                    const isSelected = selectedAssetIds.includes(asset.id);
                    return (
                      <div
                        key={asset.id}
                        onClick={() => toggleAsset(asset.id)}
                        className={cn(
                          'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                          isSelected
                            ? 'bg-accent-yellow/20 border border-accent-yellow/50'
                            : 'hover:bg-white/5 border border-transparent'
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleAsset(asset.id)}
                          className="pointer-events-none"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-bone-white truncate">
                            {asset.name}
                          </p>
                          <p className="text-xs text-muted-gray truncate">
                            {asset.internal_id} • {asset.category_name || 'Uncategorized'}
                          </p>
                        </div>
                        {asset.status && (
                          <Badge
                            variant="outline"
                            className={cn('text-xs', STATUS_COLORS[asset.status as AssetStatus])}
                          >
                            {asset.status}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Selected count */}
            <p className="text-sm text-muted-gray">
              {selectedAssetIds.length} asset{selectedAssetIds.length !== 1 ? 's' : ''} selected
            </p>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-gray">Kit Name</p>
                <p className="text-bone-white font-medium">{name}</p>
              </div>
              {templateId && (
                <div>
                  <p className="text-xs text-muted-gray">Template</p>
                  <p className="text-bone-white">
                    {templates.find((t) => t.id === templateId)?.name || 'Unknown'}
                  </p>
                </div>
              )}
              {notes && (
                <div>
                  <p className="text-xs text-muted-gray">Notes</p>
                  <p className="text-bone-white text-sm">{notes}</p>
                </div>
              )}
            </div>

            {/* Selected Assets */}
            <div>
              <p className="text-sm font-medium text-muted-gray mb-2">
                Assets to Include ({selectedAssets.length})
              </p>
              {selectedAssets.length === 0 ? (
                <p className="text-sm text-muted-gray italic">No assets selected</p>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {selectedAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between p-2 bg-white/5 rounded"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-bone-white truncate">{asset.name}</p>
                        <p className="text-xs text-muted-gray">{asset.internal_id}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => toggleAsset(asset.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <DialogFooter className="flex gap-2 pt-4">
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              disabled={isSubmitting}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          {step === 0 && (
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          )}
          <div className="flex-1" />
          {step < 2 ? (
            <Button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 0 && !canProceedStep1}
            >
              Next
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Create Kit
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditInstanceModal({
  instanceId,
  onClose,
}: {
  instanceId: string;
  onClose: () => void;
}) {
  const { kit, isLoading, updateInstance } = useGearKitInstance(instanceId);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize form when kit data loads
  React.useEffect(() => {
    if (kit && !isInitialized) {
      setName(kit.name);
      setNotes(kit.notes ?? '');
      setIsInitialized(true);
    }
  }, [kit, isInitialized]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await updateInstance.mutateAsync({ name: name.trim(), notes: notes.trim() || undefined });
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Kit Instance</DialogTitle>
          <DialogDescription>Update kit details</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-gray" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Kit Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Kit name"
              />
            </div>
            <div>
              <Label htmlFor="edit-notes">Notes</Label>
              <Input
                id="edit-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateInstance.isPending || !name.trim()}>
                {updateInstance.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditTemplateModal({
  templateId,
  onClose,
}: {
  templateId: string;
  onClose: () => void;
}) {
  const { template, isLoading, updateTemplate } = useGearKitTemplate(templateId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize form when template data loads
  React.useEffect(() => {
    if (template && !isInitialized) {
      setName(template.name);
      setDescription(template.description ?? '');
      setIsInitialized(true);
    }
  }, [template, isInitialized]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await updateTemplate.mutateAsync({ name: name.trim(), description: description.trim() || undefined });
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Kit Template</DialogTitle>
          <DialogDescription>Update template details</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-gray" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-template-name">Template Name</Label>
              <Input
                id="edit-template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Template name"
              />
            </div>
            <div>
              <Label htmlFor="edit-template-description">Description</Label>
              <Input
                id="edit-template-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateTemplate.isPending || !name.trim()}>
                {updateTemplate.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function VerifyContentsModal({
  kitId,
  onClose,
}: {
  kitId: string;
  onClose: () => void;
}) {
  const { kit, isLoading, verifyContents, refetch } = useGearKitInstance(kitId);
  const [checkedAssets, setCheckedAssets] = useState<Set<string>>(new Set());
  const [verificationResult, setVerificationResult] = useState<{
    matched: string[];
    missing: string[];
    extra: string[];
    is_complete: boolean;
  } | null>(null);

  const contents = kit?.contents ?? [];

  const handleToggleAsset = (assetId: string) => {
    setCheckedAssets((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const allIds = contents.map((c) => c.asset_id);
    setCheckedAssets(new Set(allIds));
  };

  const handleClearAll = () => {
    setCheckedAssets(new Set());
  };

  const handleVerify = async () => {
    try {
      const result = await verifyContents.mutateAsync(Array.from(checkedAssets));
      setVerificationResult(result);
      refetch();
    } catch (error) {
      console.error('Verification failed:', error);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Verify Kit Contents</DialogTitle>
          <DialogDescription>
            {kit?.name} - Check off items that are present in the kit
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-gray" />
          </div>
        ) : verificationResult ? (
          <div className="space-y-4">
            <div
              className={cn(
                'p-4 rounded-lg border',
                verificationResult.is_complete
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-yellow-500/10 border-yellow-500/30'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                {verificationResult.is_complete ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                )}
                <span className="font-semibold text-bone-white">
                  {verificationResult.is_complete ? 'Kit Complete!' : 'Kit Incomplete'}
                </span>
              </div>
              <p className="text-sm text-muted-gray">
                {verificationResult.matched.length} items verified
                {verificationResult.missing.length > 0 &&
                  `, ${verificationResult.missing.length} missing`}
              </p>
            </div>

            {verificationResult.missing.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-bone-white mb-2">Missing Items:</h4>
                <ul className="text-sm text-red-400 space-y-1">
                  {verificationResult.missing.map((id) => {
                    const item = contents.find((c) => c.asset_id === id);
                    return (
                      <li key={id}>
                        {item?.asset_name || item?.asset_internal_id || id}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setVerificationResult(null)}>
                Verify Again
              </Button>
              <Button onClick={onClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-gray">
                {checkedAssets.size} of {contents.length} items checked
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={handleClearAll}>
                  Clear
                </Button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {contents.length === 0 ? (
                <p className="text-sm text-muted-gray text-center py-4">
                  No items in this kit yet
                </p>
              ) : (
                contents.map((item) => (
                  <label
                    key={item.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                      checkedAssets.has(item.asset_id)
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-charcoal-black/50 border-muted-gray/30 hover:border-muted-gray/50'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checkedAssets.has(item.asset_id)}
                      onChange={() => handleToggleAsset(item.asset_id)}
                      className="w-4 h-4 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-bone-white truncate">
                        {item.asset_name || 'Unnamed Asset'}
                      </p>
                      <code className="text-xs text-muted-gray">
                        {item.asset_internal_id}
                      </code>
                    </div>
                    {checkedAssets.has(item.asset_id) && (
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    )}
                  </label>
                ))
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleVerify}
                disabled={verifyContents.isPending || checkedAssets.size === 0}
              >
                {verifyContents.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Verify ({checkedAssets.size} items)
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function KitDetailModal({
  kitId,
  onClose,
  onEdit,
  onVerify,
}: {
  kitId: string;
  onClose: () => void;
  onEdit: () => void;
  onVerify: () => void;
}) {
  const { kit, isLoading } = useGearKitInstance(kitId);

  const contents = kit?.contents ?? [];
  const presentCount = contents.filter((c) => c.is_present).length;
  const totalCount = contents.length;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent-yellow/20 flex items-center justify-center">
              <Layers className="w-5 h-5 text-accent-yellow" />
            </div>
            <div>
              <span className="text-bone-white">{kit?.name || 'Loading...'}</span>
              {kit?.internal_id && (
                <code className="block text-xs text-muted-gray font-normal mt-0.5">
                  {kit.internal_id}
                </code>
              )}
            </div>
          </DialogTitle>
          <DialogDescription>
            {totalCount > 0 ? (
              <span className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                {presentCount}/{totalCount} items present
              </span>
            ) : (
              'No items in this kit'
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-gray" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Kit Info */}
            <div className="flex items-center gap-4">
              {kit?.status && (
                <Badge className={cn('border', STATUS_COLORS[kit.status])}>
                  {kit.status.replace('_', ' ')}
                </Badge>
              )}
              {kit?.template_name && (
                <span className="text-xs text-muted-gray">
                  Template: {kit.template_name}
                </span>
              )}
            </div>

            {/* Contents List */}
            {contents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Package className="w-12 h-12 text-muted-gray mb-3" />
                <p className="text-muted-gray">No items in this kit</p>
                <p className="text-xs text-muted-gray mt-1">
                  Edit the kit to add assets
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2 pr-4">
                  {contents.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border',
                        item.is_present
                          ? 'bg-green-500/5 border-green-500/20'
                          : 'bg-charcoal-black/50 border-muted-gray/30'
                      )}
                    >
                      <div
                        className={cn(
                          'w-8 h-8 rounded flex items-center justify-center flex-shrink-0',
                          item.is_present ? 'bg-green-500/20' : 'bg-muted-gray/20'
                        )}
                      >
                        {item.is_present ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <Package className="w-4 h-4 text-muted-gray" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-bone-white truncate">
                          {item.asset_name || 'Unnamed Asset'}
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-muted-gray">
                            {item.asset_internal_id}
                          </code>
                          {item.quantity && item.quantity > 1 && (
                            <Badge variant="outline" className="text-xs">
                              x{item.quantity}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {!item.is_present && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                        >
                          Missing
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Notes */}
            {kit?.notes && (
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-muted-gray mb-1">Notes</p>
                <p className="text-sm text-bone-white">{kit.notes}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="outline" onClick={onVerify}>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Verify
          </Button>
          <Button onClick={onEdit}>
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
