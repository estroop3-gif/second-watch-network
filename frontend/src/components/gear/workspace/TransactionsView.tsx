/**
 * Transactions View - 6-Tab Structure
 * Updated: 2026-01-13 14:17
 *
 * Tabs:
 * - Outgoing: Our gear currently rented/checked out to others
 * - Incoming: Gear we're renting from other organizations
 * - Requests: Pending quotes, approvals, and extensions
 * - History: Completed transactions
 * - Overdue: Late returns requiring attention
 * - Work Orders: Pre-checkout staging
 */
import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  ArrowDownLeft,
  MessageSquare,
  History,
  AlertTriangle,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Package,
  User,
  Building2,
  Calendar,
  DollarSign,
  Loader2,
  ChevronRight,
  FileText,
  ClipboardList,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
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

import {
  useTransactionsTab,
  useTransactionRequests,
} from '@/hooks/gear/useGearMarketplace';
import type {
  TransactionTab,
  OutgoingTransaction,
  IncomingTransaction,
  HistoryTransaction,
  RentalRequestStatus,
  ExtensionStatus,
} from '@/types/gear';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { CheckoutDialog, TransactionDetailDialog } from '@/components/gear/checkout';
import { CheckinDialog } from '@/components/gear/checkin';
import { ExtensionResponseDialog, ExtensionCard, IncomingQuoteRequestDialog } from '@/components/gear/marketplace';
import { WorkOrdersTabContent, WorkOrderDialog } from '@/components/gear/work-orders';
import { WorkOrderRequestsSection } from './WorkOrderRequestsSection';
import { useWorkOrderCounts } from '@/hooks/gear/useGearWorkOrders';
import { useIncomingRequestCounts } from '@/hooks/gear/useWorkOrderRequests';
import type { GearRentalExtension } from '@/types/gear';

// Tab configuration
const TABS: Array<{
  id: TransactionTab;
  label: string;
  icon: React.ReactNode;
  description: string;
}> = [
  {
    id: 'outgoing',
    label: 'Outgoing',
    icon: <ArrowUpRight className="w-4 h-4" />,
    description: 'Our gear rented out',
  },
  {
    id: 'incoming',
    label: 'Incoming',
    icon: <ArrowDownLeft className="w-4 h-4" />,
    description: "Gear we're renting",
  },
  {
    id: 'requests',
    label: 'Requests',
    icon: <MessageSquare className="w-4 h-4" />,
    description: 'Pending approvals',
  },
  {
    id: 'history',
    label: 'History',
    icon: <History className="w-4 h-4" />,
    description: 'Completed rentals',
  },
  {
    id: 'overdue',
    label: 'Overdue',
    icon: <AlertTriangle className="w-4 h-4" />,
    description: 'Late returns',
  },
  {
    id: 'work_orders',
    label: 'Work Orders',
    icon: <ClipboardList className="w-4 h-4" />,
    description: 'Pre-checkout staging',
  },
];

const REQUEST_STATUS_CONFIG: Record<RentalRequestStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  submitted: { label: 'Submitted', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  quoted: { label: 'Quoted', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  approved: { label: 'Approved', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  converted: { label: 'Converted', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
};

const EXTENSION_STATUS_CONFIG: Record<ExtensionStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  approved: { label: 'Approved', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  denied: { label: 'Denied', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  auto_approved: { label: 'Auto-Approved', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
};

interface TransactionsViewProps {
  orgId: string;
  orgType?: string;
}

export function TransactionsView({ orgId, orgType }: TransactionsViewProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TransactionTab>('outgoing');
  const [isQuickCheckoutOpen, setIsQuickCheckoutOpen] = useState(false);
  const [isWorkOrderDialogOpen, setIsWorkOrderDialogOpen] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [checkinTransactionId, setCheckinTransactionId] = useState<string | null>(null);
  const [selectedExtension, setSelectedExtension] = useState<GearRentalExtension | null>(null);

  const tabData = useTransactionsTab(orgId, activeTab);
  const { counts: workOrderCounts } = useWorkOrderCounts(orgId);
  const { counts: workOrderRequestCounts } = useIncomingRequestCounts(orgId);

  // Calculate badge counts
  const outgoingCount = tabData.outgoing.total;
  const incomingCount = tabData.incoming.total;
  const requestsCount = tabData.requests.totals.incoming_quotes +
                        tabData.requests.totals.outgoing_quotes +
                        tabData.requests.totals.extensions +
                        (workOrderRequestCounts.pending || 0);
  const overdueCount = tabData.overdue.transactions.length;
  const workOrdersTotalCount = (workOrderCounts.draft || 0) +
                                (workOrderCounts.in_progress || 0) +
                                (workOrderCounts.ready || 0) +
                                (workOrderCounts.checked_out || 0);

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TransactionTab)}>
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <TabsList className="bg-charcoal-black/50 border border-muted-gray/30 flex-wrap h-auto">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-2 data-[state=active]:bg-accent-yellow/20"
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.id === 'outgoing' && outgoingCount > 0 && (
                  <Badge className="ml-1 bg-blue-500/20 text-blue-400 text-xs">
                    {outgoingCount}
                  </Badge>
                )}
                {tab.id === 'incoming' && incomingCount > 0 && (
                  <Badge className="ml-1 bg-purple-500/20 text-purple-400 text-xs">
                    {incomingCount}
                  </Badge>
                )}
                {tab.id === 'requests' && requestsCount > 0 && (
                  <Badge className="ml-1 bg-yellow-500/20 text-yellow-400 text-xs">
                    {requestsCount}
                  </Badge>
                )}
                {tab.id === 'overdue' && overdueCount > 0 && (
                  <Badge className="ml-1 bg-red-500/20 text-red-400 text-xs">
                    {overdueCount}
                  </Badge>
                )}
                {tab.id === 'work_orders' && workOrdersTotalCount > 0 && (
                  <Badge className="ml-1 bg-orange-500/20 text-orange-400 text-xs">
                    {workOrdersTotalCount}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsWorkOrderDialogOpen(true)}>
              <ClipboardList className="w-4 h-4 mr-2" />
              New Work Order
            </Button>
            <Button onClick={() => setIsQuickCheckoutOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Checkout
            </Button>
          </div>
        </div>

        {/* Outgoing Tab */}
        <TabsContent value="outgoing" className="mt-6">
          <OutgoingTabContent
            transactions={tabData.outgoing.transactions}
            total={tabData.outgoing.total}
            isLoading={tabData.outgoing.isLoading}
            onSelect={setSelectedTransactionId}
          />
        </TabsContent>

        {/* Incoming Tab */}
        <TabsContent value="incoming" className="mt-6">
          <IncomingTabContent
            transactions={tabData.incoming.transactions}
            total={tabData.incoming.total}
            isLoading={tabData.incoming.isLoading}
            onSelect={setSelectedTransactionId}
          />
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests" className="mt-6">
          <RequestsTabContent
            orgId={orgId}
            incomingQuotes={tabData.requests.incomingQuotes}
            outgoingQuotes={tabData.requests.outgoingQuotes}
            extensions={tabData.requests.extensions}
            isLoading={tabData.requests.isLoading}
            onExtensionAction={(ext) => setSelectedExtension(ext as GearRentalExtension)}
          />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-6">
          <HistoryTabContent
            transactions={tabData.history.transactions}
            total={tabData.history.total}
            isLoading={tabData.history.isLoading}
            onSelect={setSelectedTransactionId}
          />
        </TabsContent>

        {/* Overdue Tab */}
        <TabsContent value="overdue" className="mt-6">
          <OverdueTabContent
            transactions={tabData.overdue.transactions}
            isLoading={tabData.overdue.isLoading}
            onSelect={setSelectedTransactionId}
            onStartCheckin={(txId) => {
              setSelectedTransactionId(null);
              setCheckinTransactionId(txId);
            }}
          />
        </TabsContent>

        {/* Work Orders Tab */}
        <TabsContent value="work_orders" className="mt-6">
          <WorkOrdersTabContent orgId={orgId} />
        </TabsContent>
      </Tabs>

      {/* Checkout Dialog */}
      <CheckoutDialog
        isOpen={isQuickCheckoutOpen}
        onClose={() => setIsQuickCheckoutOpen(false)}
        orgId={orgId}
        orgType={orgType}
      />

      {/* Work Order Dialog */}
      <WorkOrderDialog
        isOpen={isWorkOrderDialogOpen}
        onClose={() => setIsWorkOrderDialogOpen(false)}
        orgId={orgId}
        onSuccess={() => {
          // Switch to work orders tab on success
          setActiveTab('work_orders');
        }}
      />

      {/* Transaction Detail Dialog */}
      <TransactionDetailDialog
        isOpen={!!selectedTransactionId}
        onClose={() => setSelectedTransactionId(null)}
        transactionId={selectedTransactionId}
        onStartCheckin={(txId) => {
          setSelectedTransactionId(null);
          setCheckinTransactionId(txId);
        }}
      />

      {/* Check-in Dialog */}
      <CheckinDialog
        isOpen={!!checkinTransactionId}
        onClose={() => setCheckinTransactionId(null)}
        orgId={orgId}
        transactionId={checkinTransactionId || ''}
      />

      {/* Extension Response Dialog */}
      <ExtensionResponseDialog
        extension={selectedExtension}
        orgId={orgId}
        isOpen={!!selectedExtension}
        onClose={() => setSelectedExtension(null)}
        onResponded={() => {
          setSelectedExtension(null);
          tabData.requests.refetch?.();
        }}
      />
    </div>
  );
}

// ============================================================================
// OUTGOING TAB
// ============================================================================

function OutgoingTabContent({
  transactions,
  total,
  isLoading,
  onSelect,
}: {
  transactions: OutgoingTransaction[];
  total: number;
  isLoading: boolean;
  onSelect: (id: string) => void;
}) {
  if (isLoading) {
    return <TableSkeleton />;
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={<ArrowUpRight className="w-12 h-12" />}
        title="No outgoing rentals"
        description="Gear you check out or rent to others will appear here"
      />
    );
  }

  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-gray">
          {total} Active Checkout{total !== 1 ? 's' : ''}
        </CardTitle>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow className="border-muted-gray/30 hover:bg-transparent">
            <TableHead>Reference</TableHead>
            <TableHead>Custodian / Renter</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow
              key={tx.id}
              className="border-muted-gray/30 hover:bg-charcoal-black/30 cursor-pointer"
              onClick={() => onSelect(tx.id)}
            >
              <TableCell>
                <code className="text-sm">{tx.reference_number || tx.id.slice(0, 8)}</code>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {tx.renter_org_name ? (
                    <>
                      <Building2 className="w-4 h-4 text-muted-gray" />
                      <span>{tx.renter_org_name}</span>
                    </>
                  ) : (
                    <>
                      <User className="w-4 h-4 text-muted-gray" />
                      <span>{tx.primary_custodian_name || tx.custodian_contact_name || '—'}</span>
                    </>
                  )}
                </div>
                {tx.contact_company && (
                  <p className="text-xs text-muted-gray">{tx.contact_company}</p>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-gray" />
                  <span>{tx.item_count ?? 0}</span>
                </div>
              </TableCell>
              <TableCell>
                {tx.expected_return_at ? (
                  <div className={cn(
                    "text-sm",
                    tx.is_overdue && "text-red-400"
                  )}>
                    {format(new Date(tx.expected_return_at), 'MMM d, yyyy')}
                    {tx.is_overdue && (
                      <Badge className="ml-2 bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                        Overdue
                      </Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-gray">—</span>
                )}
              </TableCell>
              <TableCell>
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                  Out
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// ============================================================================
// INCOMING TAB
// ============================================================================

function IncomingTabContent({
  transactions,
  total,
  isLoading,
  onSelect,
}: {
  transactions: IncomingTransaction[];
  total: number;
  isLoading: boolean;
  onSelect: (id: string) => void;
}) {
  if (isLoading) {
    return <TableSkeleton />;
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={<ArrowDownLeft className="w-12 h-12" />}
        title="No incoming rentals"
        description="Gear you rent from other organizations will appear here"
      />
    );
  }

  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-gray">
          {total} Active Rental{total !== 1 ? 's' : ''}
        </CardTitle>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow className="border-muted-gray/30 hover:bg-transparent">
            <TableHead>Order</TableHead>
            <TableHead>Rental House</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Return Date</TableHead>
            <TableHead>Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow
              key={tx.id}
              className="border-muted-gray/30 hover:bg-charcoal-black/30 cursor-pointer"
              onClick={() => onSelect(tx.id)}
            >
              <TableCell>
                <code className="text-sm">{tx.order_number || tx.reference_number || tx.id.slice(0, 8)}</code>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-gray" />
                  <span>{tx.rental_house_name || '—'}</span>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-muted-gray">{tx.project_name || '—'}</span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-gray" />
                  <span>{tx.item_count ?? 0}</span>
                </div>
              </TableCell>
              <TableCell>
                {tx.rental_end_date ? (
                  <div className={cn(
                    "text-sm",
                    tx.is_overdue && "text-red-400"
                  )}>
                    {format(new Date(tx.rental_end_date), 'MMM d, yyyy')}
                    {tx.is_overdue && (
                      <Badge className="ml-2 bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                        Overdue
                      </Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-gray">—</span>
                )}
              </TableCell>
              <TableCell>
                {tx.rental_total ? (
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-muted-gray" />
                    <span>{tx.rental_total.toLocaleString()}</span>
                  </div>
                ) : (
                  <span className="text-muted-gray">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// ============================================================================
// REQUESTS TAB
// ============================================================================

interface ExtensionData {
  request_type: 'extension';
  id: string;
  status: ExtensionStatus;
  extension_type: string;
  original_end_date: string;
  requested_end_date: string;
  additional_days: number;
  additional_amount?: number;
  created_at: string;
  reason?: string;
  rental_house_org_id: string;
  renter_org_id?: string;
  direction: 'incoming' | 'outgoing';
  requester_name?: string;
}

function RequestsTabContent({
  orgId,
  incomingQuotes,
  outgoingQuotes,
  extensions,
  isLoading,
  onExtensionAction,
}: {
  orgId: string;
  incomingQuotes: Array<{
    request_type: 'incoming_quote';
    id: string;
    request_number?: string;
    title: string;
    status: RentalRequestStatus;
    rental_start_date: string;
    rental_end_date: string;
    created_at: string;
    counterparty_org_id: string;
    counterparty_name: string;
    requester_name?: string;
    item_count: number;
  }>;
  outgoingQuotes: Array<{
    request_type: 'outgoing_quote';
    id: string;
    request_number?: string;
    title: string;
    status: RentalRequestStatus;
    rental_start_date: string;
    rental_end_date: string;
    created_at: string;
    counterparty_org_id: string;
    counterparty_name: string;
    quoted_total?: number;
    quote_expires_at?: string;
    item_count: number;
  }>;
  extensions: ExtensionData[];
  isLoading: boolean;
  onExtensionAction?: (extension: ExtensionData) => void;
}) {
  const [selectedIncomingRequestId, setSelectedIncomingRequestId] = useState<string | null>(null);
  const [selectedOutgoingRequestId, setSelectedOutgoingRequestId] = useState<string | null>(null);

  // Find the selected request data
  const selectedIncomingRequest = incomingQuotes.find(q => q.id === selectedIncomingRequestId);
  const selectedOutgoingRequest = outgoingQuotes.find(q => q.id === selectedOutgoingRequestId);

  if (isLoading) {
    return <TableSkeleton />;
  }

  const hasNoRequests = incomingQuotes.length === 0 && outgoingQuotes.length === 0 && extensions.length === 0;

  // Note: Even if there are no quote/extension requests, there might be work order requests
  // So we show the WorkOrderRequestsSection first and only show empty state if truly empty

  return (
    <div className="space-y-6">
      {/* Work Order Requests (from cart submissions) */}
      <WorkOrderRequestsSection orgId={orgId} />

      {/* Show empty state only if no quote requests AND no work order requests section showed content */}
      {hasNoRequests && (
        <EmptyState
          icon={<MessageSquare className="w-12 h-12" />}
          title="No other pending requests"
          description="Quote requests, approvals, and extensions will appear here"
        />
      )}

      {/* Incoming Quote Requests */}
      {incomingQuotes.length > 0 && (
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowDownLeft className="w-4 h-4 text-purple-400" />
              Incoming Quote Requests
              <Badge className="ml-2 bg-purple-500/20 text-purple-400">{incomingQuotes.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {incomingQuotes.map((req) => {
              const statusConfig = REQUEST_STATUS_CONFIG[req.status];
              return (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-charcoal-black/30 hover:bg-charcoal-black/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedIncomingRequestId(req.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium text-bone-white">{req.title}</p>
                      <p className="text-sm text-muted-gray">
                        From {req.requester_name || req.counterparty_name} • {req.item_count} items
                      </p>
                      <p className="text-xs text-muted-gray">
                        {format(new Date(req.rental_start_date), 'MMM d')} - {format(new Date(req.rental_end_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={cn('border', statusConfig.color)}>
                      {statusConfig.label}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-muted-gray" />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Incoming Request Detail Dialog */}
      <IncomingQuoteRequestDialog
        requestId={selectedIncomingRequestId}
        orgId={orgId}
        open={!!selectedIncomingRequestId}
        onClose={() => setSelectedIncomingRequestId(null)}
        onActionComplete={() => {
          setSelectedIncomingRequestId(null);
        }}
      />

      {/* Outgoing Quote Requests */}
      {outgoingQuotes.length > 0 && (
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-blue-400" />
              Our Quote Requests
              <Badge className="ml-2 bg-blue-500/20 text-blue-400">{outgoingQuotes.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {outgoingQuotes.map((req) => {
              const statusConfig = REQUEST_STATUS_CONFIG[req.status];
              return (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-charcoal-black/30 hover:bg-charcoal-black/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedOutgoingRequestId(req.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-bone-white">{req.title}</p>
                      <p className="text-sm text-muted-gray">
                        To {req.counterparty_name} • {req.item_count} items
                      </p>
                      {req.quoted_total && (
                        <p className="text-sm text-green-400">
                          Quoted: ${req.quoted_total.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={cn('border', statusConfig.color)}>
                      {statusConfig.label}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-muted-gray" />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Outgoing Request Detail Dialog */}
      {selectedOutgoingRequest && (
        <Dialog open={!!selectedOutgoingRequestId} onOpenChange={(open) => !open && setSelectedOutgoingRequestId(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedOutgoingRequest.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">To</p>
                <p className="font-medium">{selectedOutgoingRequest.counterparty_name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Start Date</p>
                  <p className="font-medium">{format(new Date(selectedOutgoingRequest.rental_start_date), 'PPP')}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">End Date</p>
                  <p className="font-medium">{format(new Date(selectedOutgoingRequest.rental_end_date), 'PPP')}</p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Items Requested</p>
                <p className="font-medium">{selectedOutgoingRequest.item_count} item{selectedOutgoingRequest.item_count !== 1 ? 's' : ''}</p>
              </div>
              {selectedOutgoingRequest.quoted_total && (
                <div className="flex justify-between items-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <span className="text-sm font-medium">Quoted Total</span>
                  <span className="text-lg font-semibold text-green-400">
                    ${selectedOutgoingRequest.quoted_total.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <span className="text-sm font-medium">Status</span>
                <Badge className={cn('border', REQUEST_STATUS_CONFIG[selectedOutgoingRequest.status].color)}>
                  {REQUEST_STATUS_CONFIG[selectedOutgoingRequest.status].label}
                </Badge>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setSelectedOutgoingRequestId(null)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Extensions */}
      {extensions.length > 0 && (
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-yellow-400" />
              Extension Requests
              <Badge className="ml-2 bg-yellow-500/20 text-yellow-400">{extensions.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {extensions.map((ext) => {
              const statusConfig = EXTENSION_STATUS_CONFIG[ext.status];
              const isPending = ext.status === 'pending';
              const isIncoming = ext.direction === 'incoming';
              return (
                <div
                  key={ext.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-charcoal-black/30 hover:bg-charcoal-black/50 cursor-pointer transition-colors"
                  onClick={() => onExtensionAction?.(ext)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div>
                      <p className="font-medium text-bone-white">
                        {isIncoming ? 'Extension Request' : 'Our Extension Request'}
                      </p>
                      <p className="text-sm text-muted-gray">
                        {ext.additional_days} additional day{ext.additional_days !== 1 ? 's' : ''} requested
                      </p>
                      <p className="text-xs text-muted-gray">
                        {format(new Date(ext.original_end_date), 'MMM d')} → {format(new Date(ext.requested_end_date), 'MMM d, yyyy')}
                      </p>
                      {ext.reason && (
                        <p className="text-xs text-muted-gray italic mt-1">"{ext.reason}"</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {ext.additional_amount && (
                      <span className="text-sm text-green-400">+${ext.additional_amount}</span>
                    )}
                    <Badge className={cn('border', statusConfig.color)}>
                      {statusConfig.label}
                    </Badge>
                    {isPending && isIncoming && (
                      <Badge className="bg-accent-yellow text-charcoal-black">
                        Action Required
                      </Badge>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-gray" />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// HISTORY TAB
// ============================================================================

function HistoryTabContent({
  transactions,
  total,
  isLoading,
  onSelect,
}: {
  transactions: HistoryTransaction[];
  total: number;
  isLoading: boolean;
  onSelect: (id: string) => void;
}) {
  if (isLoading) {
    return <TableSkeleton />;
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={<History className="w-12 h-12" />}
        title="No transaction history"
        description="Completed checkouts and rentals will appear here"
      />
    );
  }

  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-gray">
          {total} Completed Transaction{total !== 1 ? 's' : ''}
        </CardTitle>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow className="border-muted-gray/30 hover:bg-transparent">
            <TableHead>Reference</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Counterparty</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Date Range</TableHead>
            <TableHead>Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow
              key={tx.id}
              className="border-muted-gray/30 hover:bg-charcoal-black/30 cursor-pointer"
              onClick={() => onSelect(tx.id)}
            >
              <TableCell>
                <code className="text-sm">{tx.reference_number || tx.id.slice(0, 8)}</code>
              </TableCell>
              <TableCell>
                {tx.renter_org_name ? (
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Rental Out</Badge>
                ) : tx.rental_house_org_name ? (
                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Rental In</Badge>
                ) : (
                  <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Internal</Badge>
                )}
              </TableCell>
              <TableCell>
                <span className="text-muted-gray">
                  {tx.renter_org_name || tx.rental_house_org_name || tx.primary_custodian_name || '—'}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-gray" />
                  <span>{tx.item_count ?? 0}</span>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-gray">
                  {tx.rental_start_date && tx.rental_end_date ? (
                    <>
                      {format(new Date(tx.rental_start_date), 'MMM d')} - {format(new Date(tx.rental_end_date), 'MMM d')}
                    </>
                  ) : tx.created_at ? (
                    format(new Date(tx.created_at), 'MMM d, yyyy')
                  ) : (
                    '—'
                  )}
                </span>
              </TableCell>
              <TableCell>
                {tx.rental_total ? (
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-muted-gray" />
                    <span>{tx.rental_total.toLocaleString()}</span>
                  </div>
                ) : (
                  <span className="text-muted-gray">—</span>
                )}
                {tx.late_fee_amount && tx.late_fee_amount > 0 && (
                  <p className="text-xs text-red-400">+${tx.late_fee_amount} late fee</p>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// ============================================================================
// OVERDUE TAB
// ============================================================================

function OverdueTabContent({
  transactions,
  isLoading,
  onSelect,
  onStartCheckin,
}: {
  transactions: OutgoingTransaction[];
  isLoading: boolean;
  onSelect: (id: string) => void;
  onStartCheckin: (id: string) => void;
}) {
  if (isLoading) {
    return <TableSkeleton />;
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 className="w-12 h-12 text-green-400" />}
        title="No overdue items"
        description="All rentals are on schedule"
      />
    );
  }

  return (
    <div className="space-y-4">
      {transactions.map((tx) => (
        <Card
          key={tx.id}
          className="bg-charcoal-black/50 border-red-500/30 hover:bg-charcoal-black/70 transition-colors"
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div
                className="flex items-center gap-4 flex-1 cursor-pointer"
                onClick={() => onSelect(tx.id)}
              >
                <div className="w-12 h-12 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <p className="font-medium text-bone-white">
                    {tx.item_count} item{tx.item_count !== 1 ? 's' : ''} overdue
                  </p>
                  <p className="text-sm text-muted-gray">
                    <User className="w-3 h-3 inline mr-1" />
                    {tx.primary_custodian_name || tx.custodian_contact_name || 'Unknown'}
                    {tx.renter_org_name && (
                      <span className="ml-2">
                        <Building2 className="w-3 h-3 inline mr-1" />
                        {tx.renter_org_name}
                      </span>
                    )}
                  </p>
                  {tx.expected_return_at && (
                    <p className="text-sm text-red-400">
                      Due: {format(new Date(tx.expected_return_at), 'MMM d, yyyy')} (
                      {formatDistanceToNow(new Date(tx.expected_return_at), { addSuffix: true })})
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <code className="text-xs text-muted-gray">{tx.reference_number}</code>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartCheckin(tx.id);
                  }}
                >
                  Check In
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="text-muted-gray mb-4">{icon}</div>
        <h3 className="text-lg font-medium text-bone-white mb-2">{title}</h3>
        <p className="text-muted-gray text-center max-w-md">{description}</p>
      </CardContent>
    </Card>
  );
}
