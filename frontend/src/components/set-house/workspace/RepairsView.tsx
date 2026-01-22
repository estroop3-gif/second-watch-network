/**
 * Repairs View
 * Manage repair and maintenance requests for Set House spaces
 */
import React, { useState } from 'react';
import {
  Wrench,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
  Home,
  Calendar,
  DollarSign,
  Loader2,
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

import { useSetHouseRepairs, useSetHouseSpaces, useSetHouseVendors } from '@/hooks/set-house';
import type { SetHouseRepair, RepairStatus, RepairPriority, CreateRepairInput } from '@/types/set-house';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const STATUS_CONFIG: Record<RepairStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: {
    label: 'Pending',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    icon: <Clock className="w-3 h-3" />,
  },
  approved: {
    label: 'Approved',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    icon: <Wrench className="w-3 h-3" />,
  },
  completed: {
    label: 'Completed',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    icon: <XCircle className="w-3 h-3" />,
  },
};

const PRIORITY_CONFIG: Record<RepairPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-blue-400' },
  medium: { label: 'Medium', color: 'text-yellow-400' },
  high: { label: 'High', color: 'text-orange-400' },
  urgent: { label: 'Urgent', color: 'text-red-400' },
};

interface RepairsViewProps {
  orgId: string;
}

export function RepairsView({ orgId }: RepairsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RepairStatus | 'all'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { repairs, isLoading, createRepair } = useSetHouseRepairs(orgId, {
    status: statusFilter === 'all' ? undefined : statusFilter,
  });
  const { spaces } = useSetHouseSpaces({ orgId });
  const { vendors } = useSetHouseVendors(orgId);

  const filteredRepairs = repairs.filter((r) =>
    r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const stats = {
    total: repairs.length,
    pending: repairs.filter(r => r.status === 'pending').length,
    inProgress: repairs.filter(r => r.status === 'in_progress').length,
    completed: repairs.filter(r => r.status === 'completed').length,
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Repairs" value={stats.total} icon={<Wrench className="w-5 h-5" />} />
        <StatCard label="Pending" value={stats.pending} icon={<Clock className="w-5 h-5" />} color="text-yellow-400" />
        <StatCard label="In Progress" value={stats.inProgress} icon={<Wrench className="w-5 h-5" />} color="text-purple-400" />
        <StatCard label="Completed" value={stats.completed} icon={<CheckCircle2 className="w-5 h-5" />} color="text-green-400" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
          <Input
            placeholder="Search repairs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as RepairStatus | 'all')}>
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
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Repair
        </Button>
      </div>

      {/* Repairs List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filteredRepairs.length === 0 ? (
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckCircle2 className="w-12 h-12 text-green-400 mb-4" />
            <h3 className="text-lg font-medium text-bone-white mb-2">No Repairs</h3>
            <p className="text-muted-gray text-center max-w-md">
              Everything is in good condition. No repairs needed at this time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <Table>
            <TableHeader>
              <TableRow className="border-muted-gray/30 hover:bg-transparent">
                <TableHead>Repair</TableHead>
                <TableHead>Space</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Est. Cost</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRepairs.map((repair) => (
                <RepairRow key={repair.id} repair={repair} />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create Repair Modal */}
      <CreateRepairModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        spaces={spaces}
        vendors={vendors}
        onSubmit={async (data) => {
          await createRepair.mutateAsync(data);
          setIsCreateModalOpen(false);
        }}
        isSubmitting={createRepair.isPending}
      />
    </div>
  );
}

// ============================================================================
// REPAIR ROW
// ============================================================================

function RepairRow({ repair }: { repair: SetHouseRepair }) {
  const statusConfig = STATUS_CONFIG[repair.status] || STATUS_CONFIG.pending;
  const priorityConfig = repair.priority ? PRIORITY_CONFIG[repair.priority] : null;

  return (
    <TableRow className="border-muted-gray/30 hover:bg-charcoal-black/30 cursor-pointer">
      <TableCell>
        <div>
          <p className="font-medium text-bone-white">{repair.title}</p>
          {repair.description && (
            <p className="text-xs text-muted-gray line-clamp-1">{repair.description}</p>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Home className="w-4 h-4 text-muted-gray" />
          <span className="text-muted-gray">{repair.space_name || '—'}</span>
        </div>
      </TableCell>
      <TableCell>
        {priorityConfig ? (
          <span className={priorityConfig.color}>{priorityConfig.label}</span>
        ) : (
          <span className="text-muted-gray">—</span>
        )}
      </TableCell>
      <TableCell>
        <Badge className={cn('border', statusConfig.color)}>
          {statusConfig.icon}
          <span className="ml-1">{statusConfig.label}</span>
        </Badge>
      </TableCell>
      <TableCell>
        {repair.estimated_cost ? (
          <div className="flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-muted-gray" />
            <span>{repair.estimated_cost.toLocaleString()}</span>
          </div>
        ) : (
          <span className="text-muted-gray">—</span>
        )}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Edit className="w-4 h-4 mr-2" />
              Edit
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
            <p className={cn('text-2xl font-bold', color || 'text-bone-white')}>{value}</p>
          </div>
          <div className={cn('opacity-50', color || 'text-muted-gray')}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// CREATE REPAIR MODAL
// ============================================================================

function CreateRepairModal({
  isOpen,
  onClose,
  spaces,
  vendors,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  spaces: Array<{ id: string; name: string }>;
  vendors: Array<{ id: string; name: string }>;
  onSubmit: (data: CreateRepairInput) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [priority, setPriority] = useState<RepairPriority>('medium');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Repair title is required');
      return;
    }
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        space_id: spaceId || undefined,
        priority,
        estimated_cost: estimatedCost ? parseFloat(estimatedCost) : undefined,
      });
      setTitle('');
      setDescription('');
      setSpaceId('');
      setPriority('medium');
      setEstimatedCost('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create repair');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Repair Request</DialogTitle>
          <DialogDescription>Create a new repair or maintenance request</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="repair-title">Title *</Label>
            <Input
              id="repair-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief description of the repair"
            />
          </div>
          <div>
            <Label htmlFor="repair-space">Related Space</Label>
            <Select value={spaceId} onValueChange={setSpaceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select space (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No specific space</SelectItem>
                {spaces.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="repair-priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as RepairPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_CONFIG).map(([value, config]) => (
                    <SelectItem key={value} value={value}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="repair-cost">Est. Cost</Label>
              <Input
                id="repair-cost"
                type="number"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="repair-description">Description</Label>
            <Textarea
              id="repair-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of the repair needed..."
              rows={4}
            />
          </div>
          {error && <div className="text-sm text-primary-red">{error}</div>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Repair'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
