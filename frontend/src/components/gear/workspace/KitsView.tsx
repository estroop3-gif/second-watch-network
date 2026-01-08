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
  Link,
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
  const [activeTab, setActiveTab] = useState<'packages' | 'assembled' | 'templates'>('assembled');
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

  // Fetch equipment packages (assets with accessories)
  const { assets: allPackageAssets, isLoading: packagesLoading, error: packagesError, refetch: refetchPackages } = useGearAssets({
    orgId,
    parentAssetId: 'none', // Root assets only
    includeAccessoryCount: true,
    limit: 200,
  });

  // Filter to only equipment packages (assets with is_equipment_package = true)
  const equipmentPackages = (allPackageAssets ?? []).filter((a) => a.is_equipment_package);

  const filteredTemplates = (templates ?? []).filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredInstances = (instances ?? []).filter((i) =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredPackages = equipmentPackages.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
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
        {activeTab !== 'packages' && (
          <Button
            variant="outline"
            onClick={() =>
              activeTab === 'templates' ? setIsCreateTemplateOpen(true) : setIsCreateInstanceOpen(true)
            }
          >
            <Plus className="w-4 h-4 mr-2" />
            {activeTab === 'templates' ? 'New Template' : 'New Kit'}
          </Button>
        )}
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
      {selectedKits.size > 0 && activeTab === 'assembled' && (
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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'packages' | 'assembled' | 'templates')}>
        <TabsList className="bg-charcoal-black/50 border border-muted-gray/30">
          <TabsTrigger value="packages">Equipment Packages ({equipmentPackages.length})</TabsTrigger>
          <TabsTrigger value="assembled">Assembled Kits ({instances.length})</TabsTrigger>
          <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>
        </TabsList>

        {/* Equipment Packages Tab */}
        <TabsContent value="packages" className="mt-6">
          {packagesError ? (
            <ErrorState
              message={packagesError instanceof Error ? packagesError.message : 'Failed to load equipment packages'}
              onRetry={() => refetchPackages()}
            />
          ) : packagesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : filteredPackages.length === 0 ? (
            <EmptyState
              title="No Equipment Packages"
              description="Equipment packages group accessories with main assets. Create them from the Assets tab."
              action={
                <p className="text-sm text-muted-gray">
                  To create an equipment package, select an asset and use "Convert to Equipment Package"
                </p>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPackages.map((pkg) => (
                <EquipmentPackageCard
                  key={pkg.id}
                  package={pkg}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Assembled Kits Tab */}
        <TabsContent value="assembled" className="mt-6">
          {instancesError ? (
            <ErrorState
              message={instancesError instanceof Error ? instancesError.message : 'Failed to load assembled kits'}
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
              title="No Assembled Kits"
              description="Create assembled kits from templates to group equipment together"
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
  const subKitCount = kit.contents?.filter((c) => c.nested_kit_id).length ?? 0;
  const assetCount = kit.contents?.filter((c) => c.asset_id && c.is_present).length ?? 0;

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
          <div className="flex items-center gap-3 text-sm text-muted-gray">
            {subKitCount > 0 && (
              <div className="flex items-center gap-1">
                <Layers className="w-4 h-4 text-accent-yellow" />
                <span>{subKitCount} nested kit{subKitCount !== 1 ? 's' : ''}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Package className="w-4 h-4" />
              <span>{assetCount} item{assetCount !== 1 ? 's' : ''}</span>
            </div>
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

function EquipmentPackageCard({ package: pkg }: { package: GearAsset }) {
  const accessoryCount = (pkg as any).accessory_count ?? 0;

  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30 hover:border-accent-yellow/50 transition-colors cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent-yellow/20 flex items-center justify-center">
            <Package className="w-5 h-5 text-accent-yellow" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-bone-white truncate">{pkg.name}</h3>
            <p className="text-sm text-muted-gray">
              {pkg.manufacturer || pkg.make}{pkg.model && ` • ${pkg.model}`}
            </p>
            <code className="text-xs text-muted-gray">{pkg.internal_id}</code>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4 text-sm">
          <Badge className={cn('border', STATUS_COLORS[pkg.status as AssetStatus])}>
            {pkg.status.replace('_', ' ')}
          </Badge>
          <span className="flex items-center gap-1 text-muted-gray">
            <Link className="w-4 h-4 text-accent-yellow" />
            {accessoryCount} accessor{accessoryCount === 1 ? 'y' : 'ies'}
          </span>
        </div>
        {pkg.category_name && (
          <p className="text-xs text-muted-gray mt-2">{pkg.category_name}</p>
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
  const { kit, isLoading, updateInstance, addNestedKit, removeNestedKit, refetch } = useGearKitInstance(instanceId);
  const [activeTab, setActiveTab] = useState<'details' | 'subkits'>('details');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedKitToAdd, setSelectedKitToAdd] = useState('');

  // Get organization ID from the kit for fetching available kits
  const orgId = kit?.organization_id ?? '';

  // Fetch all kit instances to find available sub-kits
  const { instances: allKits } = useGearKitInstances(orgId);

  // Current sub-kits
  const currentSubKits = kit?.contents?.filter((c) => c.nested_kit_id) ?? [];
  const currentSubKitIds = new Set(currentSubKits.map((c) => c.nested_kit_id));

  // Filter available kits to add as sub-kits:
  // - Not the current kit itself
  // - Not already a sub-kit of this kit
  // - Kit must not have any sub-kits of its own (2-level limit)
  // - Kit must not already be nested inside another kit
  const availableKitsToAdd = (allKits ?? []).filter((k) => {
    if (k.id === instanceId) return false; // Can't add self
    if (currentSubKitIds.has(k.id)) return false; // Already a sub-kit
    // Check if this kit has sub-kits (would exceed 2-level limit)
    const hasSubKits = k.contents?.some((c) => c.nested_kit_id);
    if (hasSubKits) return false;
    return true;
  });

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

  const handleAddSubKit = async () => {
    if (!selectedKitToAdd) return;
    try {
      await addNestedKit.mutateAsync({ nested_kit_id: selectedKitToAdd });
      setSelectedKitToAdd('');
      refetch();
    } catch (error) {
      console.error('Failed to add sub-kit:', error);
    }
  };

  const handleRemoveSubKit = async (nestedKitId: string) => {
    try {
      await removeNestedKit.mutateAsync(nestedKitId);
      refetch();
    } catch (error) {
      console.error('Failed to remove sub-kit:', error);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Kit Instance</DialogTitle>
          <DialogDescription>
            {kit?.name} - {kit?.internal_id}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-gray" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'details' | 'subkits')}>
            <TabsList className="bg-charcoal-black/50 border border-muted-gray/30 mb-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="subkits">
                Nested Kits ({currentSubKits.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details">
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
            </TabsContent>

            <TabsContent value="subkits">
              <div className="space-y-4">
                {/* Add Nested Kit Section */}
                <div className="space-y-2">
                  <Label>Add Nested Kit</Label>
                  <div className="flex gap-2">
                    <select
                      value={selectedKitToAdd}
                      onChange={(e) => setSelectedKitToAdd(e.target.value)}
                      className="flex-1 p-2 bg-charcoal-black border border-muted-gray/30 rounded text-bone-white text-sm"
                    >
                      <option value="">Select a kit to add...</option>
                      {availableKitsToAdd.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.name} ({k.internal_id})
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      onClick={handleAddSubKit}
                      disabled={!selectedKitToAdd || addNestedKit.isPending}
                    >
                      {addNestedKit.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  {availableKitsToAdd.length === 0 && (
                    <p className="text-xs text-muted-gray">
                      No kits available to add. Kits that already contain nested kits cannot be nested.
                    </p>
                  )}
                </div>

                {/* Current Nested Kits List */}
                <div className="space-y-2">
                  <Label>Current Nested Kits</Label>
                  {currentSubKits.length === 0 ? (
                    <div className="text-center py-6 text-muted-gray">
                      <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No nested kits added yet</p>
                      <p className="text-xs mt-1">
                        Nested kits allow you to group kits together
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[250px] overflow-y-auto">
                      {currentSubKits.map((subKit) => (
                        <div
                          key={subKit.id}
                          className="flex items-center gap-3 p-3 rounded-lg border border-accent-yellow/30 bg-accent-yellow/5"
                        >
                          <div className="w-8 h-8 rounded flex items-center justify-center bg-accent-yellow/20 flex-shrink-0">
                            <Layers className="w-4 h-4 text-accent-yellow" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-bone-white truncate">
                              {subKit.nested_kit_name || 'Unnamed Kit'}
                            </p>
                            <div className="flex items-center gap-2">
                              <code className="text-xs text-muted-gray">
                                {subKit.nested_kit_internal_id}
                              </code>
                              {subKit.nested_kit_status && (
                                <Badge className={cn('text-xs border', STATUS_COLORS[subKit.nested_kit_status])}>
                                  {subKit.nested_kit_status.replace('_', ' ')}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => handleRemoveSubKit(subKit.nested_kit_id!)}
                            disabled={removeNestedKit.isPending}
                          >
                            {removeNestedKit.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Done
                  </Button>
                </DialogFooter>
              </div>
            </TabsContent>
          </Tabs>
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
  const { template, isLoading, updateTemplate, addTemplateItem, removeTemplateItem, refetch } = useGearKitTemplate(templateId);
  const [activeTab, setActiveTab] = useState<'details' | 'subtemplates'>('details');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedTemplateToAdd, setSelectedTemplateToAdd] = useState('');

  // Get organization ID from template for fetching available templates
  const orgId = template?.organization_id ?? '';

  // Fetch all templates to find available sub-templates
  const { templates: allTemplates } = useGearKitTemplates(orgId);

  // Current sub-templates (items with nested_template_id)
  const currentSubTemplates = template?.items?.filter((item) => item.nested_template_id) ?? [];
  const currentSubTemplateIds = new Set(currentSubTemplates.map((item) => item.nested_template_id));

  // Regular items (non-nested template items)
  const regularItems = template?.items?.filter((item) => !item.nested_template_id) ?? [];

  // Filter available templates to add as sub-templates:
  // - Not the current template itself
  // - Not already a sub-template of this template
  const availableTemplatesToAdd = (allTemplates ?? []).filter((t) => {
    if (t.id === templateId) return false; // Can't add self
    if (currentSubTemplateIds.has(t.id)) return false; // Already a sub-template
    return true;
  });

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

  const handleAddSubTemplate = async () => {
    if (!selectedTemplateToAdd) return;
    try {
      await addTemplateItem.mutateAsync({
        nested_template_id: selectedTemplateToAdd,
        quantity: 1,
        is_required: true,
      });
      setSelectedTemplateToAdd('');
      refetch();
    } catch (error) {
      console.error('Failed to add sub-template:', error);
    }
  };

  const handleRemoveSubTemplate = async (itemId: string) => {
    try {
      await removeTemplateItem.mutateAsync(itemId);
      refetch();
    } catch (error) {
      console.error('Failed to remove sub-template:', error);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Kit Template</DialogTitle>
          <DialogDescription>
            {template?.name} - {regularItems.length} items, {currentSubTemplates.length} sub-templates
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-gray" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'details' | 'subtemplates')}>
            <TabsList className="bg-charcoal-black/50 border border-muted-gray/30 mb-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="subtemplates">
                Sub-Templates ({currentSubTemplates.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details">
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

                {/* Show current items summary */}
                {regularItems.length > 0 && (
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-muted-gray mb-2">Template Items ({regularItems.length})</p>
                    <div className="space-y-1 max-h-[120px] overflow-y-auto">
                      {regularItems.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 text-sm">
                          <Package className="w-3 h-3 text-muted-gray" />
                          <span className="text-bone-white truncate">
                            {item.item_description || item.category_name || 'Item'}
                          </span>
                          {item.quantity > 1 && (
                            <span className="text-xs text-muted-gray">x{item.quantity}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
            </TabsContent>

            <TabsContent value="subtemplates">
              <div className="space-y-4">
                {/* Add Sub-Template Section */}
                <div className="space-y-2">
                  <Label>Add Sub-Template</Label>
                  <div className="flex gap-2">
                    <select
                      value={selectedTemplateToAdd}
                      onChange={(e) => setSelectedTemplateToAdd(e.target.value)}
                      className="flex-1 p-2 bg-charcoal-black border border-muted-gray/30 rounded text-bone-white text-sm"
                    >
                      <option value="">Select a template to add...</option>
                      {availableTemplatesToAdd.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.items?.length ?? 0} items)
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      onClick={handleAddSubTemplate}
                      disabled={!selectedTemplateToAdd || addTemplateItem.isPending}
                    >
                      {addTemplateItem.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-gray">
                    Sub-templates define expected nested kits that should be included when creating instances from this template.
                  </p>
                </div>

                {/* Current Sub-Templates List */}
                <div className="space-y-2">
                  <Label>Current Sub-Templates</Label>
                  {currentSubTemplates.length === 0 ? (
                    <div className="text-center py-6 text-muted-gray">
                      <Copy className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No sub-templates added yet</p>
                      <p className="text-xs mt-1">
                        Add templates that should be included as nested kits
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[250px] overflow-y-auto">
                      {currentSubTemplates.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-3 rounded-lg border border-blue-500/30 bg-blue-500/5"
                        >
                          <div className="w-8 h-8 rounded flex items-center justify-center bg-blue-500/20 flex-shrink-0">
                            <Copy className="w-4 h-4 text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-bone-white truncate">
                              {item.nested_template_name || 'Unknown Template'}
                            </p>
                            <div className="flex items-center gap-2">
                              {item.quantity > 1 && (
                                <span className="text-xs text-muted-gray">
                                  Quantity: {item.quantity}
                                </span>
                              )}
                              {item.is_required && (
                                <Badge variant="outline" className="text-xs">
                                  Required
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => handleRemoveSubTemplate(item.id)}
                            disabled={removeTemplateItem.isPending}
                          >
                            {removeTemplateItem.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Done
                  </Button>
                </DialogFooter>
              </div>
            </TabsContent>
          </Tabs>
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
  const [expandedSubKits, setExpandedSubKits] = useState<Set<string>>(new Set());
  const [verificationResult, setVerificationResult] = useState<{
    matched: string[];
    missing: string[];
    extra: string[];
    is_complete: boolean;
  } | null>(null);

  const contents = kit?.contents ?? [];

  // Separate direct assets from nested kits
  const directAssets = contents.filter((c) => c.asset_id && !c.nested_kit_id);
  const nestedKits = contents.filter((c) => c.nested_kit_id);

  // Get all asset IDs including from nested kits
  const getAllAssetIds = (): string[] => {
    const ids: string[] = [];
    // Direct assets
    directAssets.forEach((c) => {
      if (c.asset_id) ids.push(c.asset_id);
    });
    // Assets from nested kits
    nestedKits.forEach((nk) => {
      (nk.nested_kit_contents ?? []).forEach((item: any) => {
        if (item.asset_id) ids.push(item.asset_id);
      });
    });
    return ids;
  };

  const allAssetIds = getAllAssetIds();
  const totalItemCount = allAssetIds.length;

  // Build a lookup map for finding asset info by ID (including nested)
  const assetLookup = new Map<string, { name: string; internal_id: string; source: string }>();
  directAssets.forEach((c) => {
    if (c.asset_id) {
      assetLookup.set(c.asset_id, {
        name: c.asset_name || 'Unnamed Asset',
        internal_id: c.asset_internal_id || '',
        source: 'Direct',
      });
    }
  });
  nestedKits.forEach((nk) => {
    (nk.nested_kit_contents ?? []).forEach((item: any) => {
      if (item.asset_id) {
        assetLookup.set(item.asset_id, {
          name: item.asset_name || 'Unnamed Asset',
          internal_id: item.asset_internal_id || '',
          source: nk.nested_kit_name || 'Nested Kit',
        });
      }
    });
  });

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
    setCheckedAssets(new Set(allAssetIds));
  };

  const handleClearAll = () => {
    setCheckedAssets(new Set());
  };

  const toggleSubKitExpanded = (kitId: string) => {
    setExpandedSubKits((prev) => {
      const next = new Set(prev);
      if (next.has(kitId)) {
        next.delete(kitId);
      } else {
        next.add(kitId);
      }
      return next;
    });
  };

  // Check all items in a nested kit
  const handleCheckAllInSubKit = (nestedKit: any) => {
    const subKitAssetIds = (nestedKit.nested_kit_contents ?? [])
      .filter((item: any) => item.asset_id)
      .map((item: any) => item.asset_id);
    setCheckedAssets((prev) => {
      const next = new Set(prev);
      subKitAssetIds.forEach((id: string) => next.add(id));
      return next;
    });
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
                    const asset = assetLookup.get(id);
                    return (
                      <li key={id} className="flex items-center gap-2">
                        <span>{asset?.name || id}</span>
                        {asset?.source && asset.source !== 'Direct' && (
                          <span className="text-xs text-muted-gray">
                            (from {asset.source})
                          </span>
                        )}
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
                {checkedAssets.size} of {totalItemCount} items checked
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

            <ScrollArea className="h-[300px]">
              <div className="space-y-3 pr-4">
                {totalItemCount === 0 ? (
                  <p className="text-sm text-muted-gray text-center py-4">
                    No items in this kit yet
                  </p>
                ) : (
                  <>
                    {/* Nested Kits Section */}
                    {nestedKits.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium text-muted-gray uppercase tracking-wide flex items-center gap-2">
                          <Layers className="w-3 h-3" />
                          Nested Kits
                        </h4>
                        {nestedKits.map((nk) => {
                          const subKitContents = nk.nested_kit_contents ?? [];
                          const subKitAssetIds = subKitContents
                            .filter((item: any) => item.asset_id)
                            .map((item: any) => item.asset_id);
                          const checkedCount = subKitAssetIds.filter((id: string) =>
                            checkedAssets.has(id)
                          ).length;
                          const isExpanded = expandedSubKits.has(nk.nested_kit_id!);

                          return (
                            <div
                              key={nk.id}
                              className="border border-accent-yellow/30 rounded-lg overflow-hidden"
                            >
                              {/* Nested kit header */}
                              <div className="flex items-center gap-2 p-3 bg-accent-yellow/10">
                                <button
                                  onClick={() => toggleSubKitExpanded(nk.nested_kit_id!)}
                                  className="flex items-center gap-2 flex-1 text-left"
                                >
                                  <div className="w-6 h-6 rounded flex items-center justify-center bg-accent-yellow/20">
                                    <Layers className="w-3 h-3 text-accent-yellow" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-bone-white truncate">
                                      {nk.nested_kit_name || 'Nested Kit'}
                                    </p>
                                    <code className="text-[10px] text-muted-gray">
                                      {checkedCount}/{subKitAssetIds.length} checked
                                    </code>
                                  </div>
                                  {isExpanded ? (
                                    <X className="w-4 h-4 text-muted-gray" />
                                  ) : (
                                    <ArrowRight className="w-4 h-4 text-muted-gray" />
                                  )}
                                </button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => handleCheckAllInSubKit(nk)}
                                >
                                  Check All
                                </Button>
                              </div>

                              {/* Nested kit contents */}
                              {isExpanded && (
                                <div className="border-t border-accent-yellow/20 bg-charcoal-black/30 p-2 space-y-1">
                                  {subKitContents.length === 0 ? (
                                    <p className="text-xs text-muted-gray text-center py-2">
                                      No items in this nested kit
                                    </p>
                                  ) : (
                                    subKitContents.map((item: any) => (
                                      <label
                                        key={item.id}
                                        className={cn(
                                          'flex items-center gap-2 p-2 rounded-lg ml-2 border-l-2 cursor-pointer transition-colors',
                                          checkedAssets.has(item.asset_id)
                                            ? 'border-l-green-500/50 bg-green-500/10'
                                            : 'border-l-muted-gray/30 bg-charcoal-black/20 hover:bg-charcoal-black/40'
                                        )}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checkedAssets.has(item.asset_id)}
                                          onChange={() => handleToggleAsset(item.asset_id)}
                                          className="w-3 h-3 rounded"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-medium text-bone-white truncate">
                                            {item.asset_name || 'Unnamed Asset'}
                                          </p>
                                          <code className="text-[10px] text-muted-gray">
                                            {item.asset_internal_id}
                                          </code>
                                        </div>
                                        {checkedAssets.has(item.asset_id) && (
                                          <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                                        )}
                                      </label>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Direct Assets Section */}
                    {directAssets.length > 0 && (
                      <div className="space-y-2">
                        {nestedKits.length > 0 && (
                          <h4 className="text-xs font-medium text-muted-gray uppercase tracking-wide flex items-center gap-2 mt-3">
                            <Package className="w-3 h-3" />
                            Direct Items
                          </h4>
                        )}
                        {directAssets.map((item) => (
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
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>

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

// Helper component to display nested kit contents
function NestedKitSection({
  membership,
  isExpanded,
  onToggle,
}: {
  membership: any;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const nestedContents = membership.nested_kit_contents ?? [];
  const presentCount = nestedContents.filter((c: any) => c.is_present).length;
  const totalCount = nestedContents.length;

  return (
    <div className="border border-accent-yellow/30 rounded-lg overflow-hidden">
      {/* Nested kit header - clickable to expand/collapse */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 bg-accent-yellow/10 hover:bg-accent-yellow/15 transition-colors"
      >
        <div className="w-8 h-8 rounded flex items-center justify-center bg-accent-yellow/20 flex-shrink-0">
          <Layers className="w-4 h-4 text-accent-yellow" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium text-bone-white truncate">
            {membership.nested_kit_name || 'Unnamed Nested Kit'}
          </p>
          <div className="flex items-center gap-2">
            <code className="text-xs text-muted-gray">
              {membership.nested_kit_internal_id}
            </code>
            {membership.nested_kit_status && (
              <Badge className={cn('text-xs border', STATUS_COLORS[membership.nested_kit_status])}>
                {membership.nested_kit_status.replace('_', ' ')}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-gray">
          <Package className="w-3 h-3" />
          <span>{presentCount}/{totalCount}</span>
          {isExpanded ? (
            <X className="w-4 h-4 text-muted-gray" />
          ) : (
            <ArrowRight className="w-4 h-4 text-muted-gray" />
          )}
        </div>
      </button>

      {/* Nested kit contents (collapsible) */}
      {isExpanded && (
        <div className="border-t border-accent-yellow/20 bg-charcoal-black/30">
          {nestedContents.length === 0 ? (
            <p className="text-xs text-muted-gray text-center py-3">
              No items in this nested kit
            </p>
          ) : (
            <div className="p-2 space-y-1">
              {nestedContents.map((item: any) => (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-lg ml-2 border-l-2',
                    item.is_present
                      ? 'border-l-green-500/50 bg-green-500/5'
                      : 'border-l-muted-gray/30 bg-charcoal-black/20'
                  )}
                >
                  <div
                    className={cn(
                      'w-6 h-6 rounded flex items-center justify-center flex-shrink-0',
                      item.is_present ? 'bg-green-500/20' : 'bg-muted-gray/20'
                    )}
                  >
                    {item.is_present ? (
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                    ) : (
                      <Package className="w-3 h-3 text-muted-gray" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-bone-white truncate">
                      {item.asset_name || 'Unnamed Asset'}
                    </p>
                    <code className="text-[10px] text-muted-gray">
                      {item.asset_internal_id}
                    </code>
                  </div>
                  {!item.is_present && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                    >
                      Missing
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
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
  const [expandedSubKits, setExpandedSubKits] = useState<Set<string>>(new Set());

  const contents = kit?.contents ?? [];

  // Separate regular assets from nested kits
  const regularAssets = contents.filter((c) => c.asset_id && !c.nested_kit_id);
  const nestedKits = contents.filter((c) => c.nested_kit_id);

  const presentAssetCount = regularAssets.filter((c) => c.is_present).length;
  const totalAssetCount = regularAssets.length;

  const toggleSubKit = (kitId: string) => {
    setExpandedSubKits((prev) => {
      const next = new Set(prev);
      if (next.has(kitId)) {
        next.delete(kitId);
      } else {
        next.add(kitId);
      }
      return next;
    });
  };

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
            <span className="flex items-center gap-4">
              {nestedKits.length > 0 && (
                <span className="flex items-center gap-1">
                  <Layers className="w-4 h-4 text-accent-yellow" />
                  {nestedKits.length} nested kit{nestedKits.length !== 1 ? 's' : ''}
                </span>
              )}
              {totalAssetCount > 0 && (
                <span className="flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  {presentAssetCount}/{totalAssetCount} items present
                </span>
              )}
              {nestedKits.length === 0 && totalAssetCount === 0 && (
                <span>No items in this kit</span>
              )}
            </span>
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
                  Edit the kit to add assets or nested kits
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-3 pr-4">
                  {/* Nested Kits Section */}
                  {nestedKits.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-gray uppercase tracking-wide flex items-center gap-2">
                        <Layers className="w-3 h-3" />
                        Nested Kits ({nestedKits.length})
                      </h4>
                      {nestedKits.map((item) => (
                        <NestedKitSection
                          key={item.id}
                          membership={item}
                          isExpanded={expandedSubKits.has(item.nested_kit_id!)}
                          onToggle={() => toggleSubKit(item.nested_kit_id!)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Regular Assets Section */}
                  {regularAssets.length > 0 && (
                    <div className="space-y-2">
                      {nestedKits.length > 0 && (
                        <h4 className="text-xs font-medium text-muted-gray uppercase tracking-wide flex items-center gap-2 mt-4">
                          <Package className="w-3 h-3" />
                          Direct Items ({regularAssets.length})
                        </h4>
                      )}
                      {regularAssets.map((item) => (
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
                  )}
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
