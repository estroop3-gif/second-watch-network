/**
 * GearView - Manage production gear/equipment
 */
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
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
  Package,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Loader2,
  Calendar,
  DollarSign,
  Tag,
  Link2,
  RefreshCw,
  HelpCircle,
  Truck,
  ClipboardList,
  Store,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useGear, useGearCosts, useSyncGearToBudget, useBudget, useBudgetLineItems, GEAR_CATEGORIES, useRentalOrderSummary, useMessageGearHouse } from '@/hooks/backlot';
import { MarketplaceRentalDialog } from './gear/MarketplaceRentalDialog';
import { MarketplaceBrowserSection } from './gear/MarketplaceBrowserSection';
import { RentalSummaryCard } from './gear/RentalSummaryCard';
import { RentalGearCard } from './gear/RentalGearCard';
import { GearDetailDrawer } from './gear/GearDetailDrawer';
import { useTaskLists, useCreateTaskFromSource } from '@/hooks/backlot/useTaskLists';
import { BacklotGearItem, GearItemInput, BacklotGearStatus, BacklotGearItemEnriched } from '@/types/backlot';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import { ListTodo } from 'lucide-react';
import { DialogFooter } from '@/components/ui/dialog';

interface GearViewProps {
  projectId: string;
  canEdit: boolean;
}

const STATUS_CONFIG: Record<BacklotGearStatus, { label: string; color: string }> = {
  available: { label: 'Available', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  in_use: { label: 'In Use', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  reserved: { label: 'Reserved', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  maintenance: { label: 'Maintenance', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  retired: { label: 'Retired', color: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30' },
};

interface GearCostInfo {
  calculated_rental_cost: number;
  rental_days: number;
  daily_rate: number;
}

const GearCard: React.FC<{
  item: BacklotGearItem;
  costInfo?: GearCostInfo;
  canEdit: boolean;
  onEdit: (item: BacklotGearItem) => void;
  onDelete: (id: string) => void;
  onCreateTask?: (item: BacklotGearItem) => void;
  onClick?: (id: string) => void;
}> = ({ item, costInfo, canEdit, onEdit, onDelete, onCreateTask, onClick }) => {
  const statusConfig = STATUS_CONFIG[item.status];
  const totalCost = costInfo?.calculated_rental_cost || (item as any).purchase_cost || 0;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking on dropdown menu or buttons
    const target = e.target as HTMLElement;
    if (target.closest('[role="menuitem"]') || target.closest('button[type="button"]')) {
      return;
    }
    // Open detail drawer
    if (onClick) {
      onClick(item.id);
    }
  };

  return (
    <div
      className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4 hover:border-muted-gray/40 transition-colors cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Name & Category */}
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-accent-yellow shrink-0" />
            <h4 className="font-medium text-bone-white truncate">{item.name}</h4>
          </div>

          {/* Category & Status */}
          <div className="flex flex-wrap gap-2 mb-2">
            {item.category && (
              <Badge variant="outline" className="text-xs border-muted-gray/30">
                {item.category}
              </Badge>
            )}
            <Badge variant="outline" className={cn('text-xs', statusConfig.color)}>
              {statusConfig.label}
            </Badge>
            {item.is_owned ? (
              <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
                Owned
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">
                Rental
              </Badge>
            )}
            {(item as any).budget_line_item_id && (
              <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">
                <Link2 className="w-3 h-3 mr-1" />
                Budgeted
              </Badge>
            )}
          </div>

          {/* Description */}
          {item.description && (
            <p className="text-sm text-muted-gray line-clamp-1 mb-2">{item.description}</p>
          )}

          {/* Details */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-gray">
            {item.serial_number && (
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {item.serial_number}
              </span>
            )}
            {!item.is_owned && item.rental_house && (
              <span>{item.rental_house}</span>
            )}
            {!item.is_owned && item.rental_cost_per_day && (
              <span className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                ${item.rental_cost_per_day}/day
              </span>
            )}
            {item.pickup_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(parseLocalDate(item.pickup_date), 'MMM d')}
                {item.return_date && ` - ${format(parseLocalDate(item.return_date), 'MMM d')}`}
              </span>
            )}
          </div>

          {/* Total Cost */}
          {totalCost > 0 && (
            <div className="mt-2 pt-2 border-t border-muted-gray/20">
              <span className="text-sm font-medium text-accent-yellow">
                ${totalCost.toLocaleString()}
                {costInfo?.rental_days ? ` (${costInfo.rental_days} days)` : ' total'}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(item)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              {onCreateTask && (
                <DropdownMenuItem onClick={() => onCreateTask(item)}>
                  <ListTodo className="w-4 h-4 mr-2" />
                  Create Task
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-red-400" onClick={() => onDelete(item.id)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
};

// Extended form data to include budget fields
interface ExtendedFormData extends GearItemInput {
  budget_line_item_id?: string;
  purchase_cost?: number;
}

const GearView: React.FC<GearViewProps> = ({ projectId, canEdit }) => {
  const { toast } = useToast();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const { gear, isLoading, createGear, updateGear, deleteGear } = useGear({
    projectId,
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
  });

  // Gear costs data
  const { data: gearCosts, isLoading: costsLoading } = useGearCosts(projectId);
  const syncGearToBudget = useSyncGearToBudget();

  // Rental order summary
  const { data: rentalSummary } = useRentalOrderSummary(projectId);
  const messageGearHouse = useMessageGearHouse();

  // Get budget first, then line items using the budget ID
  const { data: budget } = useBudget(projectId);
  const { data: budgetLineItems } = useBudgetLineItems(budget?.id || null);

  // Create cost lookup map
  const costMap = useMemo(() => {
    if (!gearCosts?.items) return new Map<string, GearCostInfo>();
    return new Map(gearCosts.items.map(item => [item.id, {
      calculated_rental_cost: item.calculated_rental_cost,
      rental_days: item.rental_days,
      daily_rate: item.daily_rate,
    }]));
  }, [gearCosts?.items]);

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<BacklotGearItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Task creation state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskGearItem, setTaskGearItem] = useState<BacklotGearItem | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [selectedTaskListId, setSelectedTaskListId] = useState<string>('');

  // Task hooks
  const { taskLists } = useTaskLists({ projectId });
  const { createTaskFromSource } = useCreateTaskFromSource(projectId, selectedTaskListId);

  // Tips panel state
  const [showTipsPanel, setShowTipsPanel] = useState(false);

  // Marketplace rental state
  const [showMarketplaceDialog, setShowMarketplaceDialog] = useState(false);
  const [showMarketplaceBrowser, setShowMarketplaceBrowser] = useState(false);

  // Detail drawer state
  const [selectedGearId, setSelectedGearId] = useState<string | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  // Form state with extended fields
  const [formData, setFormData] = useState<ExtendedFormData>({
    name: '',
    category: '',
    description: '',
    serial_number: '',
    status: 'available',
    is_owned: false,
    rental_house: '',
    rental_cost_per_day: undefined,
    pickup_date: '',
    return_date: '',
    notes: '',
    budget_line_item_id: undefined,
    purchase_cost: undefined,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      description: '',
      serial_number: '',
      status: 'available',
      is_owned: false,
      rental_house: '',
      rental_cost_per_day: undefined,
      pickup_date: '',
      return_date: '',
      notes: '',
      budget_line_item_id: undefined,
      purchase_cost: undefined,
    });
  };

  const handleOpenForm = (item?: BacklotGearItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        category: item.category || '',
        description: item.description || '',
        serial_number: item.serial_number || '',
        status: item.status,
        is_owned: item.is_owned,
        rental_house: item.rental_house || '',
        rental_cost_per_day: item.rental_cost_per_day || undefined,
        pickup_date: item.pickup_date || '',
        return_date: item.return_date || '',
        notes: item.notes || '',
        budget_line_item_id: (item as any).budget_line_item_id || undefined,
        purchase_cost: (item as any).purchase_cost || undefined,
      });
    } else {
      setEditingItem(null);
      resetForm();
    }
    setShowForm(true);
  };

  const handleSyncToBudget = async () => {
    setIsSyncing(true);
    try {
      const result = await syncGearToBudget.mutateAsync({ projectId });
      toast({
        title: 'Gear synced to budget',
        description: `Created ${result.created} line items, updated ${result.updated} existing.`,
      });
    } catch (err) {
      toast({
        title: 'Sync failed',
        description: err instanceof Error ? err.message : 'Failed to sync gear to budget',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingItem) {
        await updateGear.mutateAsync({
          id: editingItem.id,
          ...formData,
        });
      } else {
        await createGear.mutateAsync({
          projectId,
          ...formData,
        });
      }
      setShowForm(false);
      resetForm();
    } catch (err) {
      console.error('Failed to save gear:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this gear item?')) {
      await deleteGear.mutateAsync(id);
    }
  };

  // Task creation handlers
  const handleOpenTaskModal = (item: BacklotGearItem) => {
    setTaskGearItem(item);
    setTaskTitle(`Gear task: ${item.name}`);
    setTaskDescription(`Category: ${item.category}\nStatus: ${item.status}\n${item.is_owned ? 'Owned' : `Rental: ${item.rental_house || 'N/A'}`}`);
    setSelectedTaskListId(taskLists[0]?.id || '');
    setShowTaskModal(true);
  };

  const handleCreateTask = async () => {
    if (!taskGearItem || !selectedTaskListId) {
      sonnerToast.error('Please select a task list');
      return;
    }

    try {
      await createTaskFromSource.mutateAsync({
        title: taskTitle,
        sourceType: 'gear',
        sourceId: taskGearItem.id,
        description: taskDescription,
      });
      sonnerToast.success('Task created successfully');
      setShowTaskModal(false);
      setTaskGearItem(null);
      setTaskTitle('');
      setTaskDescription('');
    } catch (error) {
      sonnerToast.error('Failed to create task');
    }
  };

  // Handle messaging gear house
  const handleMessageGearHouse = async (orgId: string) => {
    try {
      await messageGearHouse.mutateAsync({
        organization_id: orgId,
        subject: 'Inquiry about rental order',
        initial_message: 'Hello, I have a question about our rental order.',
        context_type: 'rental_order',
      });
      sonnerToast.success('Message sent to gear house');
    } catch (error) {
      sonnerToast.error('Failed to send message');
    }
  };

  // Handle viewing order (placeholder - could navigate to order detail)
  const handleViewOrder = (orderId: string) => {
    // TODO: Navigate to order detail page or open modal
    sonnerToast.info(`View order: ${orderId}`);
  };

  // Handler to open gear detail drawer
  const handleOpenGearDetail = (gearId: string) => {
    setSelectedGearId(gearId);
    setIsDetailDrawerOpen(true);
  };

  // Handler to close gear detail drawer
  const handleCloseGearDetail = () => {
    setIsDetailDrawerOpen(false);
    setSelectedGearId(null);
  };

  // Group gear by category for display
  const gearByCategory = gear.reduce((acc, item) => {
    const cat = item.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, BacklotGearItem[]>);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading text-bone-white">Gear</h2>
          <p className="text-sm text-muted-gray">Track your production equipment</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTipsPanel(true)}
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <HelpCircle className="w-4 h-4 mr-1" />
            Tips
          </Button>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40 bg-charcoal-black/50 border-muted-gray/30">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {GEAR_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canEdit && !showMarketplaceBrowser && (
            <Button
              variant="outline"
              onClick={() => setShowMarketplaceBrowser(true)}
              className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
            >
              <Store className="w-4 h-4 mr-2" />
              Rent from Marketplace
            </Button>
          )}
          {canEdit && gear.length > 0 && (
            <Button
              variant="outline"
              onClick={handleSyncToBudget}
              disabled={isSyncing}
              className="border-muted-gray/30"
            >
              {isSyncing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sync to Budget
            </Button>
          )}
          {canEdit && (
            <Button
              onClick={() => handleOpenForm()}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Gear
            </Button>
          )}
        </div>
      </div>

      {/* Cost Summary */}
      {gearCosts && gearCosts.total_cost > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
            <p className="text-xs text-muted-gray mb-1">Total Rental</p>
            <p className="text-xl font-bold text-accent-yellow">
              ${gearCosts.total_rental_cost.toLocaleString()}
            </p>
          </div>
          <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
            <p className="text-xs text-muted-gray mb-1">Owned Equipment</p>
            <p className="text-xl font-bold text-green-400">
              ${gearCosts.total_purchase_cost.toLocaleString()}
            </p>
          </div>
          <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
            <p className="text-xs text-muted-gray mb-1">Total Cost</p>
            <p className="text-xl font-bold text-bone-white">
              ${gearCosts.total_cost.toLocaleString()}
            </p>
          </div>
          <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
            <p className="text-xs text-muted-gray mb-1">Items</p>
            <p className="text-xl font-bold text-bone-white">
              {gear.length}
            </p>
          </div>
        </div>
      )}

      {/* Embedded Marketplace Browser */}
      {showMarketplaceBrowser && (
        <MarketplaceBrowserSection
          projectId={projectId}
          budgetLineItems={budgetLineItems || []}
          onClose={() => setShowMarketplaceBrowser(false)}
          onRequestSuccess={() => {
            // Optionally refresh gear list or show success message
          }}
        />
      )}

      {/* Rental Summary - Show if there are active rentals */}
      {rentalSummary && rentalSummary.active_rentals_count > 0 && (
        <RentalSummaryCard summary={rentalSummary} />
      )}

      {/* Gear List */}
      {gear.length > 0 ? (
        categoryFilter === 'all' ? (
          // Grouped by category
          <div className="space-y-6">
            {Object.entries(gearByCategory).map(([category, items]) => (
              <div key={category}>
                <h3 className="text-lg font-medium text-bone-white mb-3 flex items-center gap-2">
                  {category}
                  <Badge variant="outline" className="text-xs border-muted-gray/30">
                    {items.length}
                  </Badge>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((item) => {
                    const enrichedItem = item as BacklotGearItemEnriched;
                    // Check if this is a rental item
                    if (enrichedItem.gear_rental_order_item_id) {
                      return (
                        <RentalGearCard
                          key={item.id}
                          item={enrichedItem}
                          onViewOrder={handleViewOrder}
                          onMessage={handleMessageGearHouse}
                          onClick={handleOpenGearDetail}
                        />
                      );
                    }
                    // Regular gear item
                    return (
                      <GearCard
                        key={item.id}
                        item={item}
                        costInfo={costMap.get(item.id)}
                        canEdit={canEdit}
                        onEdit={handleOpenForm}
                        onDelete={handleDelete}
                        onCreateTask={handleOpenTaskModal}
                        onClick={handleOpenGearDetail}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Flat list for filtered view
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {gear.map((item) => {
              const enrichedItem = item as BacklotGearItemEnriched;
              // Check if this is a rental item
              if (enrichedItem.gear_rental_order_item_id) {
                return (
                  <RentalGearCard
                    key={item.id}
                    item={enrichedItem}
                    onViewOrder={handleViewOrder}
                    onMessage={handleMessageGearHouse}
                    onClick={handleOpenGearDetail}
                  />
                );
              }
              // Regular gear item
              return (
                <GearCard
                  key={item.id}
                  item={item}
                  costInfo={costMap.get(item.id)}
                  canEdit={canEdit}
                  onEdit={handleOpenForm}
                  onDelete={handleDelete}
                  onCreateTask={handleOpenTaskModal}
                  onClick={handleOpenGearDetail}
                />
              );
            })}
          </div>
        )
      ) : (
        <div className="text-center py-12 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
          <Package className="w-12 h-12 text-muted-gray/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-bone-white mb-2">No gear yet</h3>
          <p className="text-muted-gray mb-4">Add equipment you'll be using for the production.</p>
          {canEdit && (
            <Button
              onClick={() => handleOpenForm()}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Gear
            </Button>
          )}
        </div>
      )}

      {/* Gear Form Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Gear' : 'Add Gear'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g., RED Komodo 6K"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {GEAR_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v as BacklotGearStatus })}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                      <SelectItem key={value} value={value}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Details about the gear..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={isSubmitting}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="serial_number">Serial Number</Label>
              <Input
                id="serial_number"
                value={formData.serial_number}
                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            {/* Ownership */}
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="is_owned">Owned (not rental)</Label>
              <Switch
                id="is_owned"
                checked={formData.is_owned}
                onCheckedChange={(checked) => setFormData({ ...formData, is_owned: checked })}
                disabled={isSubmitting}
              />
            </div>

            {formData.is_owned ? (
              <div className="space-y-2">
                <Label htmlFor="purchase_cost">Purchase Cost ($)</Label>
                <Input
                  id="purchase_cost"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="e.g., 5000.00"
                  value={formData.purchase_cost || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      purchase_cost: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  disabled={isSubmitting}
                />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rental_house">Rental House</Label>
                    <Input
                      id="rental_house"
                      placeholder="e.g., Panavision"
                      value={formData.rental_house}
                      onChange={(e) => setFormData({ ...formData, rental_house: e.target.value })}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rental_cost">Cost/Day ($)</Label>
                    <Input
                      id="rental_cost"
                      type="number"
                      min={0}
                      step="0.01"
                      value={formData.rental_cost_per_day || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          rental_cost_per_day: e.target.value ? parseFloat(e.target.value) : undefined,
                        })
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pickup_date">Pickup Date</Label>
                    <Input
                      id="pickup_date"
                      type="date"
                      value={formData.pickup_date}
                      onChange={(e) => setFormData({ ...formData, pickup_date: e.target.value })}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="return_date">Return Date</Label>
                    <Input
                      id="return_date"
                      type="date"
                      value={formData.return_date}
                      onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Budget Link */}
            {budgetLineItems && budgetLineItems.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="budget_link">Link to Budget</Label>
                <Select
                  value={formData.budget_line_item_id || 'none'}
                  onValueChange={(v) => setFormData({ ...formData, budget_line_item_id: v === 'none' ? undefined : v })}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="budget_link">
                    <SelectValue placeholder="No budget link" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No budget link</SelectItem>
                    {budgetLineItems.map((li: any) => (
                      <SelectItem key={li.id} value={li.id}>
                        {li.description} (${li.estimated_total?.toLocaleString() || 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-gray">
                  Link this gear to an existing budget line item
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                disabled={isSubmitting}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.name.trim()}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : editingItem ? (
                  'Save Changes'
                ) : (
                  'Add Gear'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={showTaskModal} onOpenChange={setShowTaskModal}>
        <DialogContent className="bg-soft-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-primary" />
              Create Task from Gear
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Task List *</Label>
              <Select value={selectedTaskListId} onValueChange={setSelectedTaskListId}>
                <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                  <SelectValue placeholder="Select a task list" />
                </SelectTrigger>
                <SelectContent>
                  {taskLists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Task Title *</Label>
              <Input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="bg-charcoal-black border-muted-gray/30"
                placeholder="Enter task title"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                className="bg-charcoal-black border-muted-gray/30"
                placeholder="Enter task description"
                rows={3}
              />
            </div>
            {taskGearItem && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-xs text-muted-gray mb-1">Linked to gear:</p>
                <p className="text-sm text-bone-white font-medium">{taskGearItem.name}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateTask}
              disabled={!taskTitle || !selectedTaskListId || createTaskFromSource.isPending}
              className="bg-primary text-white hover:bg-primary/90"
            >
              {createTaskFromSource.isPending ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tips Panel Dialog */}
      <Dialog open={showTipsPanel} onOpenChange={setShowTipsPanel}>
        <DialogContent className="sm:max-w-lg bg-charcoal-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-bone-white">
              <HelpCircle className="w-5 h-5 text-amber-400" />
              Gear Tips
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-accent-yellow/10 rounded-lg">
                <Package className="w-5 h-5 text-accent-yellow" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Track Equipment</h4>
                <p className="text-sm text-muted-gray">
                  Add all production gear including cameras, lenses, lighting, grip,
                  and sound equipment. Mark items as owned or rental.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Truck className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Rental Management</h4>
                <p className="text-sm text-muted-gray">
                  Set pickup and return dates for rentals. The system calculates
                  rental days and total costs automatically.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Budget Sync</h4>
                <p className="text-sm text-muted-gray">
                  Use "Sync to Budget" to create or update budget line items based
                  on your gear list. Rental costs flow to your budget automatically.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <ClipboardList className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Status Tracking</h4>
                <p className="text-sm text-muted-gray">
                  Update gear status: Available, In Use, Reserved, Maintenance, or
                  Retired. Filter by category to find items quickly.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Tag className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Serial Numbers</h4>
                <p className="text-sm text-muted-gray">
                  Add serial numbers and rental house info for insurance and
                  tracking purposes. Essential for production reports.
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

      {/* Marketplace Rental Dialog */}
      <MarketplaceRentalDialog
        isOpen={showMarketplaceDialog}
        onClose={() => setShowMarketplaceDialog(false)}
        projectId={projectId}
        budgetLineItems={budgetLineItems || []}
      />

      {/* Gear Detail Drawer */}
      <GearDetailDrawer
        gearId={selectedGearId}
        isOpen={isDetailDrawerOpen}
        onClose={handleCloseGearDetail}
        onEdit={(gearId) => {
          // Close detail drawer and open edit form
          handleCloseGearDetail();
          const item = gear.find(g => g.id === gearId);
          if (item) {
            handleOpenForm(item);
          }
        }}
      />
    </div>
  );
};

export default GearView;
