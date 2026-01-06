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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { useGearKitTemplates, useGearKitInstances, useGearCategories } from '@/hooks/gear';
import type { GearKitTemplate, GearKitInstance, AssetStatus } from '@/types/gear';
import { cn } from '@/lib/utils';

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
  const [activeTab, setActiveTab] = useState<'templates' | 'instances'>('instances');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateTemplateOpen, setIsCreateTemplateOpen] = useState(false);
  const [isCreateInstanceOpen, setIsCreateInstanceOpen] = useState(false);

  const { templates, isLoading: templatesLoading, createTemplate } = useGearKitTemplates(orgId);
  const { instances, isLoading: instancesLoading, createInstance } = useGearKitInstances(orgId);

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredInstances = instances.filter((i) =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'templates' | 'instances')}>
        <TabsList className="bg-charcoal-black/50 border border-muted-gray/30">
          <TabsTrigger value="instances">Kit Instances ({instances.length})</TabsTrigger>
          <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="instances" className="mt-6">
          {instancesLoading ? (
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
                <KitInstanceCard key={kit.id} kit={kit} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          {templatesLoading ? (
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
                <KitTemplateCard key={template.id} template={template} />
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
        templates={templates}
        onSubmit={async (data) => {
          await createInstance.mutateAsync(data);
          setIsCreateInstanceOpen(false);
        }}
        isSubmitting={createInstance.isPending}
      />
    </div>
  );
}

function KitInstanceCard({ kit }: { kit: GearKitInstance }) {
  const contentCount = kit.contents?.length ?? 0;
  const presentCount = kit.contents?.filter((c) => c.is_present).length ?? 0;

  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30 hover:border-accent-yellow/50 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent-yellow/20 flex items-center justify-center">
              <Layers className="w-5 h-5 text-accent-yellow" />
            </div>
            <div>
              <CardTitle className="text-bone-white text-base">{kit.name}</CardTitle>
              <code className="text-xs text-muted-gray">{kit.internal_id}</code>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Edit className="w-4 h-4 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
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

function KitTemplateCard({ template }: { template: GearKitTemplate }) {
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
              <DropdownMenuItem>
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
  templates,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  templates: GearKitTemplate[];
  onSubmit: (data: { name: string; template_id?: string }) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onSubmit({ name: name.trim(), template_id: templateId || undefined });
    setName('');
    setTemplateId('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Kit Instance</DialogTitle>
          <DialogDescription>Create a new kit to group equipment together</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Kit Name</Label>
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Kit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
