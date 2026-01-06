/**
 * Repairs View
 * Manage repair tickets and vendors
 */
import React, { useState } from 'react';
import {
  Wrench,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  DollarSign,
  Calendar,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useGearRepairs, useGearRepairStats, useGearVendors } from '@/hooks/gear';
import type { GearRepairTicket, RepairStatus, RepairPriority } from '@/types/gear';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const STATUS_CONFIG: Record<RepairStatus, { label: string; color: string }> = {
  open: { label: 'Open', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  diagnosing: { label: 'Diagnosing', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  awaiting_approval: { label: 'Awaiting Approval', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  in_repair: { label: 'In Repair', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  ready_for_qc: { label: 'Ready for QC', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  closed: { label: 'Closed', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

const PRIORITY_CONFIG: Record<RepairPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-gray-400' },
  normal: { label: 'Normal', color: 'text-blue-400' },
  high: { label: 'High', color: 'text-orange-400' },
  urgent: { label: 'Urgent', color: 'text-red-400' },
};

interface RepairsViewProps {
  orgId: string;
}

export function RepairsView({ orgId }: RepairsViewProps) {
  const [statusFilter, setStatusFilter] = useState<RepairStatus | 'all'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { tickets, isLoading, createTicket } = useGearRepairs({
    orgId,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const { data: stats } = useGearRepairStats(orgId);
  const { vendors } = useGearVendors(orgId);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Open Tickets"
          value={stats?.by_status?.open ?? 0}
          icon={<Wrench className="w-5 h-5" />}
          color="text-blue-400"
        />
        <StatCard
          label="In Repair"
          value={stats?.by_status?.in_repair ?? 0}
          icon={<Wrench className="w-5 h-5" />}
          color="text-purple-400"
        />
        <StatCard
          label="Total Cost"
          value={`$${(stats?.costs?.total_cost ?? 0).toLocaleString()}`}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          label="Avg Days to Close"
          value={stats?.avg_days_to_close?.toFixed(1) ?? '—'}
          icon={<Calendar className="w-5 h-5" />}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as RepairStatus | 'all')}>
          <SelectTrigger className="w-48">
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
        <div className="flex-1" />
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Repair Ticket
        </Button>
      </div>

      {/* Tickets Table */}
      {isLoading ? (
        <TableSkeleton />
      ) : tickets.length === 0 ? (
        <EmptyState />
      ) : (
        <RepairsTable tickets={tickets} />
      )}

      {/* Create Ticket Modal */}
      <CreateRepairModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        vendors={vendors}
        onSubmit={async (data) => {
          await createTicket.mutateAsync(data);
          setIsCreateModalOpen(false);
        }}
        isSubmitting={createTicket.isPending}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
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
          <div className={cn('p-2 rounded-lg bg-muted-gray/20', color)}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function RepairsTable({ tickets }: { tickets: GearRepairTicket[] }) {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <Table>
        <TableHeader>
          <TableRow className="border-muted-gray/30 hover:bg-transparent">
            <TableHead>Ticket</TableHead>
            <TableHead>Asset</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Cost</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((ticket) => {
            const statusConfig = STATUS_CONFIG[ticket.status];
            const priorityConfig = PRIORITY_CONFIG[ticket.priority];

            return (
              <TableRow key={ticket.id} className="border-muted-gray/30 hover:bg-charcoal-black/30 cursor-pointer">
                <TableCell>
                  <div>
                    <code className="text-sm">{ticket.ticket_number}</code>
                    <p className="text-xs text-muted-gray truncate max-w-[200px]">{ticket.title}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-muted-gray">{ticket.asset_name || ticket.asset_internal_id || '—'}</span>
                </TableCell>
                <TableCell>
                  <Badge className={cn('border', statusConfig.color)}>{statusConfig.label}</Badge>
                </TableCell>
                <TableCell>
                  <span className={priorityConfig.color}>{priorityConfig.label}</span>
                </TableCell>
                <TableCell>
                  <span className="text-muted-gray">{ticket.vendor_name || '—'}</span>
                </TableCell>
                <TableCell>
                  {ticket.total_cost ? `$${ticket.total_cost.toLocaleString()}` : '—'}
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-gray">
                    {format(new Date(ticket.created_at), 'MMM d, yyyy')}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <CheckCircle2 className="w-12 h-12 text-green-400 mb-4" />
        <p className="text-muted-gray">No repair tickets</p>
      </CardContent>
    </Card>
  );
}

function CreateRepairModal({
  isOpen,
  onClose,
  vendors,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  vendors: Array<{ id: string; name: string }>;
  onSubmit: (data: {
    asset_id: string;
    title: string;
    description?: string;
    priority?: RepairPriority;
    vendor_id?: string;
  }) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [assetId, setAssetId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<RepairPriority>('normal');
  const [vendorId, setVendorId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetId || !title) return;
    await onSubmit({
      asset_id: assetId,
      title,
      description: description || undefined,
      priority,
      vendor_id: vendorId || undefined,
    });
    // Reset
    setAssetId('');
    setTitle('');
    setDescription('');
    setPriority('normal');
    setVendorId('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Repair Ticket</DialogTitle>
          <DialogDescription>Create a new repair ticket for an asset</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Asset ID *</Label>
            <Input
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              placeholder="Scan or enter asset ID"
            />
          </div>

          <div>
            <Label>Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief description of issue"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Priority</Label>
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
              <Label>Vendor</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !assetId || !title}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Ticket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
