/**
 * Transactions View
 * Manage checkout, checkin, and transfer transactions
 */
import React, { useState } from 'react';
import {
  ArrowRightLeft,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  Package,
  User,
  Calendar,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

import { useGearTransactions, useGearMyCheckouts, useGearOverdue } from '@/hooks/gear';
import type { GearTransaction, TransactionType, TransactionStatus } from '@/types/gear';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const STATUS_CONFIG: Record<TransactionStatus, { label: string; color: string; icon: React.ReactNode }> = {
  draft: {
    label: 'Draft',
    color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    icon: <Clock className="w-3 h-3" />,
  },
  pending: {
    label: 'Pending',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    icon: <Clock className="w-3 h-3" />,
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: <ArrowRightLeft className="w-3 h-3" />,
  },
  completed: {
    label: 'Completed',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: <XCircle className="w-3 h-3" />,
  },
};

const TYPE_LABELS: Record<TransactionType, string> = {
  internal_checkout: 'Checkout',
  internal_checkin: 'Check-in',
  transfer: 'Transfer',
  rental_reservation: 'Rental Reservation',
  rental_pickup: 'Rental Pickup',
  rental_return: 'Rental Return',
  write_off: 'Write Off',
  maintenance_send: 'Send to Maintenance',
  maintenance_return: 'Return from Maintenance',
  inventory_adjustment: 'Inventory Adjustment',
  initial_intake: 'Initial Intake',
};

interface TransactionsViewProps {
  orgId: string;
}

export function TransactionsView({ orgId }: TransactionsViewProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'my-checkouts' | 'overdue'>('all');
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [isQuickCheckoutOpen, setIsQuickCheckoutOpen] = useState(false);

  const { transactions, isLoading, quickCheckout } = useGearTransactions({
    orgId,
    status: statusFilter === 'all' ? undefined : statusFilter,
    transactionType: typeFilter === 'all' ? undefined : typeFilter,
  });

  const { data: myCheckouts, isLoading: myCheckoutsLoading } = useGearMyCheckouts(orgId);
  const { data: overdueItems, isLoading: overdueLoading } = useGearOverdue(orgId);

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'my-checkouts' | 'overdue')}>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <TabsList className="bg-charcoal-black/50 border border-muted-gray/30">
            <TabsTrigger value="all">All Transactions</TabsTrigger>
            <TabsTrigger value="my-checkouts">
              My Checkouts
              {myCheckouts && myCheckouts.length > 0 && (
                <Badge className="ml-2 bg-accent-yellow/20 text-accent-yellow">
                  {myCheckouts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="overdue">
              Overdue
              {overdueItems && overdueItems.length > 0 && (
                <Badge className="ml-2 bg-red-500/20 text-red-400">{overdueItems.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <Button onClick={() => setIsQuickCheckoutOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Quick Checkout
          </Button>
        </div>

        <TabsContent value="all" className="mt-6">
          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TransactionStatus | 'all')}>
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
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TransactionType | 'all')}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <TransactionsTableSkeleton />
          ) : transactions.length === 0 ? (
            <EmptyState message="No transactions found" />
          ) : (
            <TransactionsTable transactions={transactions} />
          )}
        </TabsContent>

        <TabsContent value="my-checkouts" className="mt-6">
          {myCheckoutsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : !myCheckouts || myCheckouts.length === 0 ? (
            <EmptyState message="You don't have any items checked out" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myCheckouts.map((asset) => (
                <Card key={asset.id} className="bg-charcoal-black/50 border-muted-gray/30">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <Package className="w-5 h-5 text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-bone-white">{asset.name}</p>
                        <code className="text-xs text-muted-gray">{asset.internal_id}</code>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="overdue" className="mt-6">
          {overdueLoading ? (
            <TransactionsTableSkeleton />
          ) : !overdueItems || overdueItems.length === 0 ? (
            <EmptyState message="No overdue items" icon={<CheckCircle2 className="w-12 h-12 text-green-400" />} />
          ) : (
            <div className="space-y-4">
              {overdueItems.map((tx) => (
                <Card key={tx.id} className="bg-charcoal-black/50 border-red-500/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                          <AlertTriangle className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                          <p className="font-medium text-bone-white">
                            {tx.item_count} item{tx.item_count !== 1 ? 's' : ''} overdue
                          </p>
                          <p className="text-sm text-muted-gray">
                            <User className="w-3 h-3 inline mr-1" />
                            {tx.primary_custodian_name || 'Unknown'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-red-400">
                          Due: {tx.expected_return_at ? format(new Date(tx.expected_return_at), 'MMM d, yyyy') : '—'}
                        </p>
                        <p className="text-xs text-muted-gray">{tx.reference_number}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Quick Checkout Modal */}
      <QuickCheckoutModal
        isOpen={isQuickCheckoutOpen}
        onClose={() => setIsQuickCheckoutOpen(false)}
        onSubmit={async (data) => {
          await quickCheckout.mutateAsync(data);
          setIsQuickCheckoutOpen(false);
        }}
        isSubmitting={quickCheckout.isPending}
      />
    </div>
  );
}

function TransactionsTable({ transactions }: { transactions: GearTransaction[] }) {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <Table>
        <TableHeader>
          <TableRow className="border-muted-gray/30 hover:bg-transparent">
            <TableHead>Reference</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Custodian</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => {
            const statusConfig = STATUS_CONFIG[tx.status];
            return (
              <TableRow key={tx.id} className="border-muted-gray/30 hover:bg-charcoal-black/30">
                <TableCell>
                  <code className="text-sm">{tx.reference_number || tx.id.slice(0, 8)}</code>
                </TableCell>
                <TableCell>{TYPE_LABELS[tx.transaction_type]}</TableCell>
                <TableCell>
                  <Badge className={cn('border', statusConfig.color)}>
                    {statusConfig.icon}
                    <span className="ml-1">{statusConfig.label}</span>
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-muted-gray">{tx.primary_custodian_name || '—'}</span>
                </TableCell>
                <TableCell>{tx.item_count ?? 0}</TableCell>
                <TableCell>
                  <span className="text-sm text-muted-gray">
                    {format(new Date(tx.created_at), 'MMM d, yyyy')}
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

function TransactionsTableSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

function EmptyState({ message, icon }: { message: string; icon?: React.ReactNode }) {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <CardContent className="flex flex-col items-center justify-center py-12">
        {icon || <ArrowRightLeft className="w-12 h-12 text-muted-gray mb-4" />}
        <p className="text-muted-gray">{message}</p>
      </CardContent>
    </Card>
  );
}

function QuickCheckoutModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { asset_ids: string[]; custodian_user_id: string; notes?: string }) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [assetIds, setAssetIds] = useState('');
  const [custodianId, setCustodianId] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ids = assetIds.split(/[,\n]/).map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0 || !custodianId) return;
    await onSubmit({
      asset_ids: ids,
      custodian_user_id: custodianId,
      notes: notes.trim() || undefined,
    });
    setAssetIds('');
    setCustodianId('');
    setNotes('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick Checkout</DialogTitle>
          <DialogDescription>Quickly check out assets to a user</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="assets">Asset IDs (comma or newline separated)</Label>
            <textarea
              id="assets"
              value={assetIds}
              onChange={(e) => setAssetIds(e.target.value)}
              placeholder="Enter asset IDs or scan barcodes..."
              className="w-full p-2 bg-charcoal-black border border-muted-gray/30 rounded text-bone-white min-h-[80px]"
            />
          </div>
          <div>
            <Label htmlFor="custodian">Custodian User ID</Label>
            <Input
              id="custodian"
              value={custodianId}
              onChange={(e) => setCustodianId(e.target.value)}
              placeholder="User ID"
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !assetIds.trim() || !custodianId}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Checkout
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
