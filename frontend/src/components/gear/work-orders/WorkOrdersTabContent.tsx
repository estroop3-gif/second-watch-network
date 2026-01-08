/**
 * Work Orders Tab Content
 * Main content for the Work Orders tab in TransactionsView
 */
import React, { useState } from 'react';
import {
  Plus,
  ClipboardList,
  Clock,
  CheckCircle2,
  Package,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useWorkOrders, useWorkOrderCounts } from '@/hooks/gear/useGearWorkOrders';
import type { GearWorkOrder, WorkOrderStatus, GearWorkOrderCounts } from '@/types/gear';
import { WorkOrderCard } from './WorkOrderCard';
import { WorkOrderDialog } from './WorkOrderDialog';
import { WorkOrderDetailDialog } from './WorkOrderDetailDialog';

interface WorkOrdersTabContentProps {
  orgId: string;
}

const STATUS_FILTERS: Array<{ value: WorkOrderStatus | 'all'; label: string; icon: React.ReactNode }> = [
  { value: 'all', label: 'All', icon: <ClipboardList className="w-4 h-4" /> },
  { value: 'draft', label: 'Draft', icon: <ClipboardList className="w-4 h-4" /> },
  { value: 'in_progress', label: 'In Progress', icon: <Clock className="w-4 h-4" /> },
  { value: 'ready', label: 'Ready', icon: <CheckCircle2 className="w-4 h-4" /> },
  { value: 'checked_out', label: 'Checked Out', icon: <Package className="w-4 h-4" /> },
];

export function WorkOrdersTabContent({ orgId }: WorkOrdersTabContentProps) {
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);

  // Hooks
  const { workOrders, total, isLoading, error } = useWorkOrders(orgId, {
    status: statusFilter !== 'all' ? statusFilter : undefined,
    search: searchQuery || undefined,
    limit: 50,
  });
  const { counts, isLoading: countsLoading } = useWorkOrderCounts(orgId);

  // Filter work orders client-side for search
  const filteredWorkOrders = searchQuery
    ? workOrders.filter(
        (wo) =>
          wo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          wo.reference_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          wo.custodian_user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          wo.assigned_to_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : workOrders;

  return (
    <div className="space-y-6">
      {/* Header with counts */}
      <div className="flex items-center gap-4">
        <h3 className="text-lg font-medium text-bone-white">Work Orders</h3>
        {!countsLoading && (
          <div className="flex items-center gap-2">
            <StatusBadge label="Draft" count={counts.draft} color="gray" />
            <StatusBadge label="In Progress" count={counts.in_progress} color="blue" />
            <StatusBadge label="Ready" count={counts.ready} color="green" />
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search work orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-charcoal-black/50 border-muted-gray/30"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as WorkOrderStatus | 'all')}
        >
          <SelectTrigger className="w-[180px] bg-charcoal-black/50 border-muted-gray/30">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-charcoal-black border-muted-gray/30">
            {STATUS_FILTERS.map((filter) => (
              <SelectItem key={filter.value} value={filter.value}>
                <div className="flex items-center gap-2">
                  {filter.icon}
                  {filter.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : error ? (
        <Card className="bg-charcoal-black/50 border-red-500/30">
          <CardContent className="p-6 text-center">
            <p className="text-red-400">Failed to load work orders</p>
            <p className="text-sm text-muted-gray mt-1">{error.message}</p>
          </CardContent>
        </Card>
      ) : filteredWorkOrders.length === 0 ? (
        <EmptyState
          hasFilters={statusFilter !== 'all' || !!searchQuery}
          onCreateNew={() => setIsCreateDialogOpen(true)}
        />
      ) : (
        <div className="space-y-3">
          {filteredWorkOrders.map((workOrder) => (
            <WorkOrderCard
              key={workOrder.id}
              workOrder={workOrder}
              onClick={() => setSelectedWorkOrderId(workOrder.id)}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <WorkOrderDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        orgId={orgId}
      />

      {/* Detail Dialog */}
      <WorkOrderDetailDialog
        isOpen={!!selectedWorkOrderId}
        onClose={() => setSelectedWorkOrderId(null)}
        orgId={orgId}
        workOrderId={selectedWorkOrderId}
      />
    </div>
  );
}

function StatusBadge({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: 'gray' | 'blue' | 'green' | 'purple';
}) {
  const colorClasses = {
    gray: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };

  if (count === 0) return null;

  return (
    <Badge className={cn('border text-xs', colorClasses[color])}>
      {label}: {count}
    </Badge>
  );
}

function EmptyState({
  hasFilters,
  onCreateNew,
}: {
  hasFilters: boolean;
  onCreateNew: () => void;
}) {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="text-muted-gray mb-4">
          <ClipboardList className="w-12 h-12" />
        </div>
        <h3 className="text-lg font-medium text-bone-white mb-2">
          {hasFilters ? 'No work orders found' : 'No work orders yet'}
        </h3>
        <p className="text-muted-gray text-center max-w-md mb-4">
          {hasFilters
            ? 'Try adjusting your filters to see more results.'
            : 'Work orders help you prepare equipment for checkout. Create one to get started.'}
        </p>
        {!hasFilters && (
          <Button onClick={onCreateNew}>
            <Plus className="w-4 h-4 mr-2" />
            Create Work Order
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default WorkOrdersTabContent;
