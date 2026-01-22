/**
 * Spaces View
 * Main view for managing studio spaces and locations within an organization
 */
import React, { useState } from 'react';
import {
  Box,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  QrCode,
  History,
  CheckCircle2,
  Clock,
  Wrench,
  XCircle,
  Loader2,
  MapPin,
  Store,
  Camera,
  Home,
  Building2,
  DollarSign,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useSetHouseSpaces,
  useSetHouseSpace,
  useSetHouseCategories,
  useSetHouseLocations,
} from '@/hooks/set-house';
import type {
  SetHouseSpace,
  SpaceStatus,
  SpaceCondition,
  SpaceType,
  CreateSpaceInput,
} from '@/types/set-house';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============================================================================
// STATUS & CONDITION CONFIG
// ============================================================================

const STATUS_CONFIG: Record<SpaceStatus, { label: string; color: string; icon: React.ReactNode }> = {
  available: {
    label: 'Available',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  reserved: {
    label: 'Reserved',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: <Clock className="w-3 h-3" />,
  },
  booked: {
    label: 'Booked',
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    icon: <Home className="w-3 h-3" />,
  },
  under_maintenance: {
    label: 'Under Maintenance',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    icon: <Wrench className="w-3 h-3" />,
  },
  retired: {
    label: 'Retired',
    color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    icon: <XCircle className="w-3 h-3" />,
  },
};

const CONDITION_CONFIG: Record<SpaceCondition, { label: string; color: string }> = {
  excellent: { label: 'Excellent', color: 'text-green-400' },
  good: { label: 'Good', color: 'text-blue-400' },
  fair: { label: 'Fair', color: 'text-yellow-400' },
  poor: { label: 'Poor', color: 'text-orange-400' },
};

const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
  sound_stage: 'Sound Stage',
  studio: 'Studio',
  backlot: 'Backlot',
  location: 'Location',
  office: 'Office',
  warehouse: 'Warehouse',
  green_room: 'Green Room',
  control_room: 'Control Room',
  edit_suite: 'Edit Suite',
  other: 'Other',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface SpacesViewProps {
  orgId: string;
}

export function SpacesView({ orgId }: SpacesViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SpaceStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);

  const { categories } = useSetHouseCategories(orgId);
  const { spaces, isLoading, createSpace, refetch: refetchSpaces } = useSetHouseSpaces(orgId, {
    status: statusFilter === 'all' ? undefined : statusFilter,
    categoryId: categoryFilter === 'all' ? undefined : categoryFilter,
    search: searchTerm || undefined,
  });

  // Stats calculation
  const stats = {
    total: spaces.length,
    available: spaces.filter(s => s.status === 'available').length,
    booked: spaces.filter(s => s.status === 'booked').length,
    maintenance: spaces.filter(s => s.status === 'under_maintenance').length,
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Spaces"
          value={stats.total}
          icon={<Box className="w-5 h-5" />}
        />
        <StatCard
          label="Available"
          value={stats.available}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="text-green-400"
        />
        <StatCard
          label="Booked"
          value={stats.booked}
          icon={<Home className="w-5 h-5" />}
          color="text-purple-400"
        />
        <StatCard
          label="Maintenance"
          value={stats.maintenance}
          icon={<Wrench className="w-5 h-5" />}
          color="text-yellow-400"
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
          <Input
            placeholder="Search spaces..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SpaceStatus | 'all')}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([value, config]) => (
              <SelectItem key={value} value={value}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Space
        </Button>
      </div>

      {/* Spaces List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : spaces.length === 0 ? (
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Home className="w-12 h-12 text-muted-gray mb-4" />
            <h3 className="text-lg font-medium text-bone-white mb-2">No Spaces Yet</h3>
            <p className="text-muted-gray text-center max-w-md mb-4">
              Add your first space to start managing your studio locations
            </p>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Space
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <Table>
            <TableHeader>
              <TableRow className="border-muted-gray/30 hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {spaces.map((space) => (
                <SpaceRow
                  key={space.id}
                  space={space}
                  onSelect={() => setSelectedSpaceId(space.id)}
                />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create Space Modal */}
      <CreateSpaceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        orgId={orgId}
        categories={categories}
        onSubmit={async (data) => {
          await createSpace.mutateAsync(data);
          setIsCreateModalOpen(false);
          toast.success('Space created successfully');
        }}
        isSubmitting={createSpace.isPending}
      />

      {/* Space Detail Modal */}
      <SpaceDetailModal
        spaceId={selectedSpaceId}
        categories={categories}
        onClose={() => setSelectedSpaceId(null)}
        onUpdate={() => refetchSpaces()}
      />
    </div>
  );
}

// ============================================================================
// SPACE ROW
// ============================================================================

function SpaceRow({
  space,
  onSelect,
}: {
  space: SetHouseSpace;
  onSelect: () => void;
}) {
  const statusConfig = STATUS_CONFIG[space.status] || STATUS_CONFIG.available;
  const conditionConfig = space.current_condition
    ? CONDITION_CONFIG[space.current_condition]
    : null;

  return (
    <TableRow
      className="border-muted-gray/30 hover:bg-charcoal-black/30 cursor-pointer"
      onClick={onSelect}
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent-yellow/20 flex items-center justify-center">
            <Home className="w-5 h-5 text-accent-yellow" />
          </div>
          <div>
            <p className="font-medium text-bone-white">{space.name}</p>
            {space.internal_id && (
              <p className="text-xs text-muted-gray">{space.internal_id}</p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-muted-gray">
          {space.space_type ? SPACE_TYPE_LABELS[space.space_type] : '—'}
        </span>
      </TableCell>
      <TableCell>
        <Badge className={cn('border', statusConfig.color)}>
          {statusConfig.icon}
          <span className="ml-1">{statusConfig.label}</span>
        </Badge>
      </TableCell>
      <TableCell>
        {conditionConfig ? (
          <span className={conditionConfig.color}>{conditionConfig.label}</span>
        ) : (
          <span className="text-muted-gray">—</span>
        )}
      </TableCell>
      <TableCell>
        {space.square_footage ? (
          <span className="text-muted-gray">{space.square_footage.toLocaleString()} sq ft</span>
        ) : (
          <span className="text-muted-gray">—</span>
        )}
      </TableCell>
      <TableCell>
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
              <History className="w-4 h-4 mr-2" />
              View History
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Store className="w-4 h-4 mr-2" />
              Create Listing
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

// ============================================================================
// STAT CARD
// ============================================================================

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-gray">{label}</p>
            <p className={cn('text-2xl font-bold', color || 'text-bone-white')}>
              {value}
            </p>
          </div>
          <div className={cn('opacity-50', color || 'text-muted-gray')}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// CREATE SPACE MODAL
// ============================================================================

interface CreateSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  categories: Array<{ id: string; name: string }>;
  onSubmit: (data: CreateSpaceInput) => Promise<void>;
  isSubmitting: boolean;
}

function CreateSpaceModal({
  isOpen,
  onClose,
  orgId,
  categories,
  onSubmit,
  isSubmitting,
}: CreateSpaceModalProps) {
  const [name, setName] = useState('');
  const [internalId, setInternalId] = useState('');
  const [spaceType, setSpaceType] = useState<SpaceType>('studio');
  const [categoryId, setCategoryId] = useState<string>('none');
  const [squareFootage, setSquareFootage] = useState('');
  const [description, setDescription] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [halfDayRate, setHalfDayRate] = useState('');
  const [dailyRate, setDailyRate] = useState('');
  const [weeklyRate, setWeeklyRate] = useState('');
  const [monthlyRate, setMonthlyRate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Space name is required');
      return;
    }

    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        internal_id: internalId.trim() || undefined,
        space_type: spaceType,
        category_id: categoryId && categoryId !== 'none' ? categoryId : undefined,
        square_footage: squareFootage ? parseInt(squareFootage, 10) : undefined,
        description: description.trim() || undefined,
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : undefined,
        half_day_rate: halfDayRate ? parseFloat(halfDayRate) : undefined,
        daily_rate: dailyRate ? parseFloat(dailyRate) : undefined,
        weekly_rate: weeklyRate ? parseFloat(weeklyRate) : undefined,
        monthly_rate: monthlyRate ? parseFloat(monthlyRate) : undefined,
      });
      // Reset form
      setName('');
      setInternalId('');
      setSpaceType('studio');
      setCategoryId('none');
      setSquareFootage('');
      setDescription('');
      setHourlyRate('');
      setHalfDayRate('');
      setDailyRate('');
      setWeeklyRate('');
      setMonthlyRate('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create space');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Space</DialogTitle>
          <DialogDescription>
            Add a new studio space or location to your organization
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Space Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Stage A"
              />
            </div>

            <div>
              <Label htmlFor="internal-id">Internal ID</Label>
              <Input
                id="internal-id"
                value={internalId}
                onChange={(e) => setInternalId(e.target.value)}
                placeholder="STG-001"
              />
            </div>

            <div>
              <Label htmlFor="space-type">Space Type</Label>
              <Select value={spaceType} onValueChange={(v) => setSpaceType(v as SpaceType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SPACE_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="square-footage">Square Footage</Label>
              <Input
                id="square-footage"
                type="number"
                value={squareFootage}
                onChange={(e) => setSquareFootage(e.target.value)}
                placeholder="10000"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the space..."
                rows={3}
              />
            </div>
          </div>

          {/* Pricing Section */}
          <div className="border-t border-muted-gray/30 pt-4">
            <Label className="text-sm font-medium text-muted-gray mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Rental Rates (optional)
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="hourly-rate" className="text-xs text-muted-gray">Hourly</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                  <Input
                    id="hourly-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="half-day-rate" className="text-xs text-muted-gray">Half-Day</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                  <Input
                    id="half-day-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={halfDayRate}
                    onChange={(e) => setHalfDayRate(e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="daily-rate" className="text-xs text-muted-gray">Daily</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                  <Input
                    id="daily-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={dailyRate}
                    onChange={(e) => setDailyRate(e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="weekly-rate" className="text-xs text-muted-gray">Weekly</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                  <Input
                    id="weekly-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={weeklyRate}
                    onChange={(e) => setWeeklyRate(e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
              </div>
              <div className="col-span-2">
                <Label htmlFor="monthly-rate" className="text-xs text-muted-gray">Monthly</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                  <Input
                    id="monthly-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={monthlyRate}
                    onChange={(e) => setMonthlyRate(e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
              </div>
            </div>
          </div>

          {error && <div className="text-sm text-primary-red">{error}</div>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Space'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// SPACE DETAIL MODAL
// ============================================================================

interface SpaceDetailModalProps {
  spaceId: string | null;
  categories: Array<{ id: string; name: string }>;
  onClose: () => void;
  onUpdate: () => void;
}

function SpaceDetailModal({ spaceId, categories, onClose, onUpdate }: SpaceDetailModalProps) {
  const { space, isLoading, updateSpace } = useSetHouseSpace(spaceId);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<SetHouseSpace>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize edit form when space loads or edit mode is entered
  const startEditing = () => {
    if (space) {
      setEditForm({
        name: space.name,
        internal_id: space.internal_id,
        description: space.description,
        space_type: space.space_type,
        category_id: space.category_id,
        square_footage: space.square_footage,
        ceiling_height_feet: space.ceiling_height_feet,
        max_occupancy: space.max_occupancy,
        daily_rate: space.daily_rate,
        half_day_rate: space.half_day_rate,
        hourly_rate: space.hourly_rate,
        weekly_rate: space.weekly_rate,
        monthly_rate: space.monthly_rate,
      });
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (!space) return;
    setIsSaving(true);
    try {
      await updateSpace.mutateAsync(editForm);
      setIsEditing(false);
      onUpdate();
      toast.success('Space updated successfully');
    } catch (error) {
      console.error('Failed to update space:', error);
      toast.error('Failed to update space');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditForm({});
  };

  if (!spaceId) return null;

  return (
    <Dialog open={!!spaceId} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{space?.name || 'Loading...'}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : space ? (
            <div className="space-y-6">
              {/* Status & Condition */}
              <div className="flex items-center gap-4">
                <Badge className={cn('border', (STATUS_CONFIG[space.status] || STATUS_CONFIG.available).color)}>
                  {(STATUS_CONFIG[space.status] || STATUS_CONFIG.available).icon}
                  <span className="ml-1">{(STATUS_CONFIG[space.status] || STATUS_CONFIG.available).label}</span>
                </Badge>
                {space.current_condition && (
                  <span className={cn('text-sm', CONDITION_CONFIG[space.current_condition]?.color || 'text-muted-gray')}>
                    {CONDITION_CONFIG[space.current_condition]?.label || 'Unknown'} condition
                  </span>
                )}
              </div>

              {/* Details Grid or Edit Form */}
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="edit-name">Name</Label>
                    <Input
                      id="edit-name"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-internal-id">Internal ID</Label>
                      <Input
                        id="edit-internal-id"
                        value={editForm.internal_id || ''}
                        onChange={(e) => setEditForm({ ...editForm, internal_id: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-space-type">Space Type</Label>
                      <Select
                        value={editForm.space_type || 'studio'}
                        onValueChange={(v) => setEditForm({ ...editForm, space_type: v as SpaceType })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(SPACE_TYPE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="edit-category">Category</Label>
                    <Select
                      value={editForm.category_id || 'none'}
                      onValueChange={(v) => setEditForm({ ...editForm, category_id: v === 'none' ? undefined : v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="edit-description">Description</Label>
                    <Textarea
                      id="edit-description"
                      value={editForm.description || ''}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={3}
                    />
                  </div>

                  {/* Physical Attributes */}
                  <div className="border-t border-muted-gray/30 pt-4">
                    <Label className="text-sm font-medium text-muted-gray mb-3 block">Physical Attributes</Label>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="edit-sqft">Square Footage</Label>
                        <Input
                          id="edit-sqft"
                          type="number"
                          value={editForm.square_footage ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, square_footage: e.target.value ? parseInt(e.target.value) : undefined })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-ceiling">Ceiling Height (ft)</Label>
                        <Input
                          id="edit-ceiling"
                          type="number"
                          value={editForm.ceiling_height_feet ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, ceiling_height_feet: e.target.value ? parseInt(e.target.value) : undefined })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-occupancy">Max Occupancy</Label>
                        <Input
                          id="edit-occupancy"
                          type="number"
                          value={editForm.max_occupancy ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, max_occupancy: e.target.value ? parseInt(e.target.value) : undefined })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Rental Rates */}
                  <div className="border-t border-muted-gray/30 pt-4">
                    <Label className="text-sm font-medium text-muted-gray mb-3 block">Rental Rates</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit-hourly">Hourly Rate</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                          <Input
                            id="edit-hourly"
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.hourly_rate ?? ''}
                            onChange={(e) => setEditForm({ ...editForm, hourly_rate: e.target.value ? parseFloat(e.target.value) : undefined })}
                            className="pl-7"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="edit-half-day">Half-Day Rate</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                          <Input
                            id="edit-half-day"
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.half_day_rate ?? ''}
                            onChange={(e) => setEditForm({ ...editForm, half_day_rate: e.target.value ? parseFloat(e.target.value) : undefined })}
                            className="pl-7"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="edit-daily">Daily Rate</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                          <Input
                            id="edit-daily"
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.daily_rate ?? ''}
                            onChange={(e) => setEditForm({ ...editForm, daily_rate: e.target.value ? parseFloat(e.target.value) : undefined })}
                            className="pl-7"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="edit-weekly">Weekly Rate</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                          <Input
                            id="edit-weekly"
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.weekly_rate ?? ''}
                            onChange={(e) => setEditForm({ ...editForm, weekly_rate: e.target.value ? parseFloat(e.target.value) : undefined })}
                            className="pl-7"
                          />
                        </div>
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor="edit-monthly">Monthly Rate</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                          <Input
                            id="edit-monthly"
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.monthly_rate ?? ''}
                            onChange={(e) => setEditForm({ ...editForm, monthly_rate: e.target.value ? parseFloat(e.target.value) : undefined })}
                            className="pl-7"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <DetailItem label="Internal ID" value={space.internal_id} mono />
                    <DetailItem label="Category" value={space.category_name} />
                    <DetailItem label="Space Type" value={SPACE_TYPE_LABELS[space.space_type]} />
                    <DetailItem label="Location" value={space.location_name} />
                  </div>

                  {/* Physical Attributes */}
                  {(space.square_footage || space.ceiling_height_feet || space.max_occupancy) && (
                    <div className="border-t border-muted-gray/30 pt-4">
                      <Label className="text-sm font-medium text-muted-gray mb-3 block">Physical Attributes</Label>
                      <div className="grid grid-cols-3 gap-4">
                        {space.square_footage && (
                          <DetailItem label="Square Footage" value={`${space.square_footage.toLocaleString()} sq ft`} />
                        )}
                        {space.ceiling_height_feet && (
                          <DetailItem label="Ceiling Height" value={`${space.ceiling_height_feet} ft`} />
                        )}
                        {space.max_occupancy && (
                          <DetailItem label="Max Occupancy" value={`${space.max_occupancy} people`} />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Rental Rates */}
                  {(space.hourly_rate || space.half_day_rate || space.daily_rate || space.weekly_rate || space.monthly_rate) && (
                    <div className="border-t border-muted-gray/30 pt-4">
                      <Label className="text-sm font-medium text-muted-gray mb-3 block">Rental Rates</Label>
                      <div className="grid grid-cols-2 gap-4">
                        {space.hourly_rate && (
                          <DetailItem label="Hourly" value={`$${space.hourly_rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
                        )}
                        {space.half_day_rate && (
                          <DetailItem label="Half-Day" value={`$${space.half_day_rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
                        )}
                        {space.daily_rate && (
                          <DetailItem label="Daily" value={`$${space.daily_rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
                        )}
                        {space.weekly_rate && (
                          <DetailItem label="Weekly" value={`$${space.weekly_rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
                        )}
                        {space.monthly_rate && (
                          <DetailItem label="Monthly" value={`$${space.monthly_rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {space.description && (
                    <div className="border-t border-muted-gray/30 pt-4">
                      <Label className="text-muted-gray">Description</Label>
                      <p className="text-bone-white mt-1">{space.description}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <p className="text-muted-gray">Space not found</p>
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
                Edit Space
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// DETAIL ITEM
// ============================================================================

function DetailItem({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div>
      <Label className="text-muted-gray text-xs">{label}</Label>
      <p className={cn('text-bone-white', mono && 'font-mono text-sm')}>{value || '—'}</p>
    </div>
  );
}
