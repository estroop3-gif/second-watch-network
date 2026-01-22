/**
 * Packages View
 * Manage package templates and instances for Set House
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
  Home,
  DollarSign,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { useSetHousePackageTemplates, useSetHousePackageInstances, useSetHousePackageInstance, useSetHouseSpaces } from '@/hooks/set-house';
import { toast } from 'sonner';
import type { SetHousePackageTemplate, SetHousePackageInstance, SetHouseSpace, SpaceStatus } from '@/types/set-house';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<SpaceStatus, string> = {
  available: 'bg-green-500/20 text-green-400 border-green-500/30',
  reserved: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  booked: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  under_maintenance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  retired: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

interface PackagesViewProps {
  orgId: string;
}

export function PackagesView({ orgId }: PackagesViewProps) {
  const [activeTab, setActiveTab] = useState<'instances' | 'templates'>('instances');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateTemplateOpen, setIsCreateTemplateOpen] = useState(false);
  const [isCreateInstanceOpen, setIsCreateInstanceOpen] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const { templates, isLoading: templatesLoading, createTemplate } = useSetHousePackageTemplates(orgId);
  const { instances, isLoading: instancesLoading, createInstance, refetch: refetchInstances, addSpaceToInstance, removeSpaceFromInstance, updateInstance } = useSetHousePackageInstances(orgId);
  const { spaces } = useSetHouseSpaces(orgId);

  const selectedTemplate = selectedTemplateId ? templates.find(t => t.id === selectedTemplateId) : null;

  const filteredTemplates = (templates ?? []).filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredInstances = (instances ?? []).filter((i) =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
          <Input
            placeholder="Search packages..."
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
          {activeTab === 'templates' ? 'New Template' : 'New Package'}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'instances' | 'templates')}>
        <TabsList className="bg-charcoal-black/50 border border-muted-gray/30">
          <TabsTrigger value="instances">Packages ({instances.length})</TabsTrigger>
          <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>
        </TabsList>

        {/* Package Instances Tab */}
        <TabsContent value="instances" className="mt-6">
          {instancesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : filteredInstances.length === 0 ? (
            <EmptyState
              title="No Packages"
              description="Create packages from templates to group spaces together"
              action={
                <Button onClick={() => setIsCreateInstanceOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Package
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredInstances.map((pkg) => (
                <PackageInstanceCard
                  key={pkg.id}
                  package={pkg}
                  onSelect={() => setSelectedInstanceId(pkg.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="mt-6">
          {templatesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <EmptyState
              title="No Package Templates"
              description="Create templates to define standard space groupings"
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
                <PackageTemplateCard
                  key={template.id}
                  template={template}
                  onSelect={() => setSelectedTemplateId(template.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Template Modal */}
      <CreateTemplateModal
        isOpen={isCreateTemplateOpen}
        onClose={() => setIsCreateTemplateOpen(false)}
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
        templates={templates}
        onSubmit={async (data) => {
          await createInstance.mutateAsync(data);
          setIsCreateInstanceOpen(false);
        }}
        isSubmitting={createInstance.isPending}
      />

      {/* Package Instance Detail Modal */}
      <PackageInstanceDetailModal
        orgId={orgId}
        instanceId={selectedInstanceId}
        spaces={spaces}
        onClose={() => setSelectedInstanceId(null)}
        onUpdate={() => refetchInstances()}
        onUpdateInstance={async (instanceId, data) => {
          await updateInstance.mutateAsync({ instanceId, data });
          toast.success('Package updated');
        }}
        onAddSpace={async (spaceId) => {
          if (selectedInstanceId) {
            await addSpaceToInstance.mutateAsync({ instanceId: selectedInstanceId, spaceId });
            toast.success('Space added to package');
          }
        }}
        onRemoveSpace={async (spaceId) => {
          if (selectedInstanceId) {
            await removeSpaceFromInstance.mutateAsync({ instanceId: selectedInstanceId, spaceId });
            toast.success('Space removed from package');
          }
        }}
      />

      {/* Package Template Detail Modal */}
      <PackageTemplateDetailModal
        template={selectedTemplate}
        onClose={() => setSelectedTemplateId(null)}
      />
    </div>
  );
}

// ============================================================================
// PACKAGE INSTANCE CARD
// ============================================================================

function PackageInstanceCard({
  package: pkg,
  onSelect,
}: {
  package: SetHousePackageInstance;
  onSelect: () => void;
}) {
  return (
    <Card
      className="bg-charcoal-black/50 border-muted-gray/30 hover:border-accent-yellow/50 transition-colors cursor-pointer"
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent-yellow/20 flex items-center justify-center">
              <Layers className="w-5 h-5 text-accent-yellow" />
            </div>
            <div>
              <CardTitle className="text-bone-white">{pkg.name}</CardTitle>
              {pkg.template_name && (
                <p className="text-xs text-muted-gray">From: {pkg.template_name}</p>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onSelect}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-400">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm text-muted-gray">
          <div className="flex items-center gap-1">
            <Home className="w-4 h-4" />
            <span>{pkg.space_count || 0} spaces</span>
          </div>
        </div>
        {pkg.status && (
          <Badge className={cn('mt-2 border', STATUS_COLORS[pkg.status] || STATUS_COLORS.available)}>
            {pkg.status.replace('_', ' ')}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// PACKAGE TEMPLATE CARD
// ============================================================================

function PackageTemplateCard({
  template,
  onSelect,
}: {
  template: SetHousePackageTemplate;
  onSelect: () => void;
}) {
  return (
    <Card
      className="bg-charcoal-black/50 border-muted-gray/30 hover:border-accent-yellow/50 transition-colors cursor-pointer"
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Copy className="w-5 h-5 text-purple-400" />
            </div>
            <CardTitle className="text-bone-white">{template.name}</CardTitle>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onSelect}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Package className="w-4 h-4 mr-2" />
                Create Package
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-400">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        {template.description && (
          <p className="text-sm text-muted-gray mb-2 line-clamp-2">{template.description}</p>
        )}
        <div className="flex items-center gap-4 text-sm text-muted-gray">
          <div className="flex items-center gap-1">
            <Home className="w-4 h-4" />
            <span>{template.item_count || 0} items</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <Layers className="w-12 h-12 text-muted-gray mb-4" />
        <h3 className="text-lg font-medium text-bone-white mb-2">{title}</h3>
        <p className="text-muted-gray text-center max-w-md mb-4">{description}</p>
        {action}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// CREATE TEMPLATE MODAL
// ============================================================================

function CreateTemplateModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description?: string }) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }
    setError(null);
    try {
      await onSubmit({ name: name.trim(), description: description.trim() || undefined });
      setName('');
      setDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Package Template</DialogTitle>
          <DialogDescription>
            Define a template for grouping spaces together
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="template-name">Template Name *</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full Production Package"
            />
          </div>
          <div>
            <Label htmlFor="template-desc">Description</Label>
            <Input
              id="template-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Includes stage, offices, and green room"
            />
          </div>
          {error && <div className="text-sm text-primary-red max-h-32 overflow-y-auto whitespace-pre-wrap">{error}</div>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// CREATE INSTANCE MODAL
// ============================================================================

function CreateInstanceModal({
  isOpen,
  onClose,
  templates,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  templates: SetHousePackageTemplate[];
  onSubmit: (data: { name: string; template_id?: string }) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Package name is required');
      return;
    }
    setError(null);
    try {
      await onSubmit({ name: name.trim(), template_id: templateId || undefined });
      setName('');
      setTemplateId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create package');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Package</DialogTitle>
          <DialogDescription>
            Create a new package to group spaces together
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="pkg-name">Package Name *</Label>
            <Input
              id="pkg-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production A Package"
            />
          </div>
          {templates.length > 0 && (
            <div>
              <Label htmlFor="pkg-template">From Template (optional)</Label>
              <select
                id="pkg-template"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">No template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {error && <div className="text-sm text-primary-red max-h-32 overflow-y-auto whitespace-pre-wrap">{error}</div>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// PACKAGE INSTANCE DETAIL MODAL
// ============================================================================

function PackageInstanceDetailModal({
  orgId,
  instanceId,
  spaces,
  onClose,
  onUpdate,
  onUpdateInstance,
  onAddSpace,
  onRemoveSpace,
}: {
  orgId: string;
  instanceId: string | null;
  spaces: SetHouseSpace[];
  onClose: () => void;
  onUpdate?: () => void;
  onUpdateInstance: (instanceId: string, data: {
    name?: string;
    hourly_rate?: number | null;
    half_day_rate?: number | null;
    daily_rate?: number | null;
    weekly_rate?: number | null;
    monthly_rate?: number | null;
    discount_percent?: number | null;
  }) => Promise<void>;
  onAddSpace: (spaceId: string) => Promise<void>;
  onRemoveSpace: (spaceId: string) => Promise<void>;
}) {
  const { instance, isLoading: instanceLoading, refetch: refetchInstance } = useSetHousePackageInstance(orgId, instanceId);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editHourlyRate, setEditHourlyRate] = useState('');
  const [editHalfDayRate, setEditHalfDayRate] = useState('');
  const [editDailyRate, setEditDailyRate] = useState('');
  const [editWeeklyRate, setEditWeeklyRate] = useState('');
  const [editMonthlyRate, setEditMonthlyRate] = useState('');
  const [editDiscountPercent, setEditDiscountPercent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddSpace, setShowAddSpace] = useState(false);
  const [addingSpaceId, setAddingSpaceId] = useState<string | null>(null);
  const [removingSpaceId, setRemovingSpaceId] = useState<string | null>(null);

  // Get spaces that are in this package (from contents)
  const packageSpaceIds = instance?.contents?.map(c => c.space_id).filter(Boolean) || [];
  const packageSpaces = spaces.filter(s => packageSpaceIds.includes(s.id));
  const availableSpaces = spaces.filter(s => !packageSpaceIds.includes(s.id) && s.status === 'available');

  // Initialize edit form when entering edit mode
  const startEditing = () => {
    if (instance) {
      setEditName(instance.name);
      setEditHourlyRate(instance.hourly_rate?.toString() || '');
      setEditHalfDayRate(instance.half_day_rate?.toString() || '');
      setEditDailyRate(instance.daily_rate?.toString() || '');
      setEditWeeklyRate(instance.weekly_rate?.toString() || '');
      setEditMonthlyRate(instance.monthly_rate?.toString() || '');
      setEditDiscountPercent(instance.discount_percent?.toString() || '');
      setError(null);
      setIsEditing(true);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditName('');
    setEditHourlyRate('');
    setEditHalfDayRate('');
    setEditDailyRate('');
    setEditWeeklyRate('');
    setEditMonthlyRate('');
    setEditDiscountPercent('');
    setError(null);
  };

  const handleSave = async () => {
    if (!instance || !instanceId || !editName.trim()) {
      setError('Package name is required');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const updateData: {
        name?: string;
        hourly_rate?: number | null;
        half_day_rate?: number | null;
        daily_rate?: number | null;
        weekly_rate?: number | null;
        monthly_rate?: number | null;
        discount_percent?: number | null;
      } = {
        name: editName.trim(),
      };

      // Only include pricing fields if they have values
      if (editHourlyRate) updateData.hourly_rate = parseFloat(editHourlyRate);
      if (editHalfDayRate) updateData.half_day_rate = parseFloat(editHalfDayRate);
      if (editDailyRate) updateData.daily_rate = parseFloat(editDailyRate);
      if (editWeeklyRate) updateData.weekly_rate = parseFloat(editWeeklyRate);
      if (editMonthlyRate) updateData.monthly_rate = parseFloat(editMonthlyRate);
      if (editDiscountPercent) updateData.discount_percent = parseFloat(editDiscountPercent);

      await onUpdateInstance(instanceId, updateData);
      await refetchInstance();
      setIsEditing(false);
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update package');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSpace = async (spaceId: string) => {
    setAddingSpaceId(spaceId);
    try {
      await onAddSpace(spaceId);
      await refetchInstance();
      onUpdate?.();
    } catch (err) {
      console.error('Failed to add space:', err);
    } finally {
      setAddingSpaceId(null);
      setShowAddSpace(false);
    }
  };

  const handleRemoveSpace = async (spaceId: string) => {
    setRemovingSpaceId(spaceId);
    try {
      await onRemoveSpace(spaceId);
      await refetchInstance();
      onUpdate?.();
    } catch (err) {
      console.error('Failed to remove space:', err);
    } finally {
      setRemovingSpaceId(null);
    }
  };

  if (!instanceId) return null;

  return (
    <Dialog open={!!instanceId} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent-yellow/20 flex items-center justify-center">
              <Layers className="w-5 h-5 text-accent-yellow" />
            </div>
            {instanceLoading ? 'Loading...' : isEditing ? 'Edit Package' : instance?.name || 'Package'}
          </DialogTitle>
          {!isEditing && instance?.template_name && (
            <DialogDescription>
              Created from template: {instance.template_name}
            </DialogDescription>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {instanceLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : isEditing ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-pkg-name">Package Name *</Label>
                <Input
                  id="edit-pkg-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Package name"
                />
              </div>

              {/* Pricing Fields */}
              <div className="border-t border-muted-gray/30 pt-4">
                <Label className="text-sm font-medium text-bone-white flex items-center gap-2 mb-3">
                  <DollarSign className="w-4 h-4" />
                  Package Pricing
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit-hourly-rate" className="text-xs text-muted-gray">Hourly Rate</Label>
                    <Input
                      id="edit-hourly-rate"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editHourlyRate}
                      onChange={(e) => setEditHourlyRate(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-half-day-rate" className="text-xs text-muted-gray">Half-Day Rate</Label>
                    <Input
                      id="edit-half-day-rate"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editHalfDayRate}
                      onChange={(e) => setEditHalfDayRate(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-daily-rate" className="text-xs text-muted-gray">Daily Rate</Label>
                    <Input
                      id="edit-daily-rate"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editDailyRate}
                      onChange={(e) => setEditDailyRate(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-weekly-rate" className="text-xs text-muted-gray">Weekly Rate</Label>
                    <Input
                      id="edit-weekly-rate"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editWeeklyRate}
                      onChange={(e) => setEditWeeklyRate(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-monthly-rate" className="text-xs text-muted-gray">Monthly Rate</Label>
                    <Input
                      id="edit-monthly-rate"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editMonthlyRate}
                      onChange={(e) => setEditMonthlyRate(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-discount" className="text-xs text-muted-gray">Discount %</Label>
                    <Input
                      id="edit-discount"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={editDiscountPercent}
                      onChange={(e) => setEditDiscountPercent(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="text-sm text-primary-red max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {error}
                </div>
              )}
            </div>
          ) : instance ? (
            <div className="space-y-6">
              {/* Status */}
              <div className="flex items-center gap-4">
                {instance.status && (
                  <Badge className={cn('border', STATUS_COLORS[instance.status] || STATUS_COLORS.available)}>
                    {instance.status.replace('_', ' ')}
                  </Badge>
                )}
                {instance.internal_id && (
                  <span className="text-sm text-muted-gray font-mono">{instance.internal_id}</span>
                )}
              </div>

              {/* Spaces Section */}
              <div className="border-t border-muted-gray/30 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-medium text-bone-white flex items-center gap-2">
                    <Home className="w-4 h-4" />
                    Spaces in Package ({packageSpaces.length})
                  </Label>
                  <Button variant="outline" size="sm" onClick={() => setShowAddSpace(!showAddSpace)}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Space
                  </Button>
                </div>

                {/* Add Space Dropdown */}
                {showAddSpace && (
                  <div className="mb-4 p-3 bg-charcoal-black/30 rounded-lg border border-muted-gray/30">
                    <Label className="text-xs text-muted-gray mb-2 block">Select a space to add:</Label>
                    {availableSpaces.length === 0 ? (
                      <p className="text-sm text-muted-gray">No available spaces to add</p>
                    ) : (
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {availableSpaces.map((space) => (
                          <button
                            key={space.id}
                            onClick={() => handleAddSpace(space.id)}
                            disabled={addingSpaceId === space.id}
                            className="w-full flex items-center justify-between p-2 text-left hover:bg-muted-gray/20 rounded transition-colors disabled:opacity-50"
                          >
                            <div>
                              <p className="text-sm text-bone-white">{space.name}</p>
                              {space.internal_id && (
                                <p className="text-xs text-muted-gray font-mono">{space.internal_id}</p>
                              )}
                            </div>
                            {addingSpaceId === space.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Plus className="w-4 h-4 text-muted-gray" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Current Spaces List */}
                {packageSpaces.length === 0 ? (
                  <div className="text-center py-6 bg-charcoal-black/30 rounded-lg">
                    <Home className="w-8 h-8 mx-auto text-muted-gray mb-2" />
                    <p className="text-sm text-muted-gray">No spaces in this package yet</p>
                    <p className="text-xs text-muted-gray mt-1">Click "Add Space" to add spaces</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {packageSpaces.map((space) => (
                      <div
                        key={space.id}
                        className="flex items-center justify-between p-3 bg-charcoal-black/30 rounded-lg border border-muted-gray/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-accent-yellow/20 flex items-center justify-center">
                            <Home className="w-4 h-4 text-accent-yellow" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-bone-white">{space.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-gray">
                              {space.internal_id && <code>{space.internal_id}</code>}
                              {space.square_footage && (
                                <>
                                  <span>•</span>
                                  <span>{space.square_footage.toLocaleString()} sq ft</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveSpace(space.id)}
                          disabled={removingSpaceId === space.id}
                          className="text-muted-gray hover:text-red-400"
                        >
                          {removingSpaceId === space.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pricing Section */}
              <div className="border-t border-muted-gray/30 pt-4">
                <Label className="text-sm font-medium text-bone-white flex items-center gap-2 mb-3">
                  <DollarSign className="w-4 h-4" />
                  Package Pricing
                </Label>
                {(instance.hourly_rate || instance.half_day_rate || instance.daily_rate ||
                  instance.weekly_rate || instance.monthly_rate || instance.discount_percent) ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {instance.hourly_rate != null && (
                      <div className="p-2 bg-charcoal-black/30 rounded-lg">
                        <p className="text-xs text-muted-gray">Hourly</p>
                        <p className="text-bone-white font-medium">${Number(instance.hourly_rate).toFixed(2)}</p>
                      </div>
                    )}
                    {instance.half_day_rate != null && (
                      <div className="p-2 bg-charcoal-black/30 rounded-lg">
                        <p className="text-xs text-muted-gray">Half-Day</p>
                        <p className="text-bone-white font-medium">${Number(instance.half_day_rate).toFixed(2)}</p>
                      </div>
                    )}
                    {instance.daily_rate != null && (
                      <div className="p-2 bg-charcoal-black/30 rounded-lg">
                        <p className="text-xs text-muted-gray">Daily</p>
                        <p className="text-bone-white font-medium">${Number(instance.daily_rate).toFixed(2)}</p>
                      </div>
                    )}
                    {instance.weekly_rate != null && (
                      <div className="p-2 bg-charcoal-black/30 rounded-lg">
                        <p className="text-xs text-muted-gray">Weekly</p>
                        <p className="text-bone-white font-medium">${Number(instance.weekly_rate).toFixed(2)}</p>
                      </div>
                    )}
                    {instance.monthly_rate != null && (
                      <div className="p-2 bg-charcoal-black/30 rounded-lg">
                        <p className="text-xs text-muted-gray">Monthly</p>
                        <p className="text-bone-white font-medium">${Number(instance.monthly_rate).toFixed(2)}</p>
                      </div>
                    )}
                    {instance.discount_percent != null && Number(instance.discount_percent) > 0 && (
                      <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                        <p className="text-xs text-green-400">Discount</p>
                        <p className="text-green-400 font-medium">{Number(instance.discount_percent).toFixed(1)}%</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-gray">No pricing set. Click Edit to add rates.</p>
                )}
              </div>

              {/* Created Date */}
              {instance.created_at && (
                <div className="border-t border-muted-gray/30 pt-4">
                  <Label className="text-muted-gray text-xs">Created</Label>
                  <p className="text-bone-white">
                    {new Date(instance.created_at).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-gray">Package not found</p>
          )}
        </ScrollArea>

        <DialogFooter>
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button onClick={startEditing}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Package
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// PACKAGE TEMPLATE DETAIL MODAL
// ============================================================================

function PackageTemplateDetailModal({
  template,
  onClose,
  onUpdate,
}: {
  template: SetHousePackageTemplate | null;
  onClose: () => void;
  onUpdate?: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize edit form when entering edit mode
  const startEditing = () => {
    if (template) {
      setEditName(template.name);
      setEditDescription(template.description || '');
      setError(null);
      setIsEditing(true);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditName('');
    setEditDescription('');
    setError(null);
  };

  const handleSave = async () => {
    if (!template || !editName.trim()) {
      setError('Template name is required');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      // TODO: Add updateTemplate mutation to the hook and call it here
      // For now, just close edit mode
      setIsEditing(false);
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template');
    } finally {
      setIsSaving(false);
    }
  };

  if (!template) return null;

  return (
    <Dialog open={!!template} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Copy className="w-5 h-5 text-purple-400" />
            </div>
            {isEditing ? 'Edit Template' : template.name}
          </DialogTitle>
          {!isEditing && (
            <DialogDescription>
              Package template definition
            </DialogDescription>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-tmpl-name">Template Name *</Label>
                <Input
                  id="edit-tmpl-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Template name"
                />
              </div>
              <div>
                <Label htmlFor="edit-tmpl-desc">Description</Label>
                <Textarea
                  id="edit-tmpl-desc"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Describe this template..."
                  rows={3}
                />
              </div>
              {error && (
                <div className="text-sm text-primary-red max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {error}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Description */}
              {template.description && (
                <div>
                  <Label className="text-muted-gray text-xs">Description</Label>
                  <p className="text-bone-white mt-1">{template.description}</p>
                </div>
              )}

              {/* Item Count */}
              <div>
                <Label className="text-muted-gray text-xs">Template Items</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Home className="w-4 h-4 text-muted-gray" />
                  <span className="text-bone-white">{template.item_count || 0} items defined</span>
                </div>
              </div>

              {/* Category */}
              {template.category_name && (
                <div>
                  <Label className="text-muted-gray text-xs">Category</Label>
                  <p className="text-bone-white">{template.category_name}</p>
                </div>
              )}

              {/* Active Status */}
              <div>
                <Label className="text-muted-gray text-xs">Status</Label>
                <Badge className={cn(
                  'mt-1 border',
                  template.is_active
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                )}>
                  {template.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              {/* Created Date */}
              {template.created_at && (
                <div>
                  <Label className="text-muted-gray text-xs">Created</Label>
                  <p className="text-bone-white">
                    {new Date(template.created_at).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button onClick={startEditing}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Template
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
