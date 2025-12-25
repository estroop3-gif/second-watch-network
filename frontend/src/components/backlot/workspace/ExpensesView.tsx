/**
 * ExpensesView - Container for all expense-related views with sub-tab navigation
 *
 * Contains:
 * - Receipts (existing receipt management)
 * - Mileage (mileage tracking)
 * - Kit Rentals (equipment rental declarations)
 * - Per Diem (meal allowances)
 * - Purchase Orders (budget requests)
 * - Summary (aggregate reporting)
 */
import React, { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Receipt,
  Car,
  Briefcase,
  Utensils,
  ShoppingCart,
  BarChart3,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import ReceiptsView from './ReceiptsView';
import MileageView from './MileageView';
import KitRentalsView from './KitRentalsView';
import PerDiemView from './PerDiemView';
import PurchaseOrdersView from './PurchaseOrdersView';
import ExpensesSummaryView from './ExpensesSummaryView';
import {
  useExpenseSummary,
  usePurchaseOrderSummary,
} from '@/hooks/backlot';

interface ExpensesViewProps {
  projectId: string;
  canEdit: boolean;
}

// Tab configuration
const EXPENSE_TABS = [
  {
    id: 'receipts',
    label: 'Receipts',
    icon: Receipt,
    description: 'Upload and manage receipts',
  },
  {
    id: 'mileage',
    label: 'Mileage',
    icon: Car,
    description: 'Track travel mileage',
  },
  {
    id: 'kit-rentals',
    label: 'Kit Rentals',
    icon: Briefcase,
    description: 'Declare equipment rentals',
  },
  {
    id: 'per-diem',
    label: 'Per Diem',
    icon: Utensils,
    description: 'Claim meal allowances',
  },
  {
    id: 'purchase-orders',
    label: 'Purchase Orders',
    icon: ShoppingCart,
    description: 'Budget requests and approvals',
  },
  {
    id: 'summary',
    label: 'Summary',
    icon: BarChart3,
    description: 'View expense reports',
  },
] as const;

type ExpenseTabId = typeof EXPENSE_TABS[number]['id'];

export default function ExpensesView({ projectId, canEdit }: ExpensesViewProps) {
  const [activeTab, setActiveTab] = useState<ExpenseTabId>('receipts');

  // Fetch summary for quick stats
  const { data: summaryData } = useExpenseSummary(projectId);
  const { data: poSummary } = usePurchaseOrderSummary(projectId);
  const summary = summaryData?.summary;

  // Calculate pending counts for badges
  const pendingCounts = useMemo(() => {
    if (!summary) return { receipts: 0, mileage: 0, kitRentals: 0, perDiem: 0, purchaseOrders: 0, total: 0 };

    return {
      receipts: summary.pending_receipts || 0,
      mileage: summary.pending_mileage || 0,
      kitRentals: summary.pending_kit_rentals || 0,
      perDiem: summary.pending_per_diem || 0,
      purchaseOrders: poSummary?.pending_count || 0,
      total: (summary.pending_receipts || 0) +
             (summary.pending_mileage || 0) +
             (summary.pending_kit_rentals || 0) +
             (summary.pending_per_diem || 0) +
             (poSummary?.pending_count || 0),
    };
  }, [summary, poSummary]);

  // Get pending count for a specific tab
  const getPendingCount = (tabId: ExpenseTabId): number => {
    switch (tabId) {
      case 'receipts': return pendingCounts.receipts;
      case 'mileage': return pendingCounts.mileage;
      case 'kit-rentals': return pendingCounts.kitRentals;
      case 'per-diem': return pendingCounts.perDiem;
      case 'purchase-orders': return pendingCounts.purchaseOrders;
      default: return 0;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Quick Stats Header */}
      {summary && (
        <div className="flex-shrink-0 mb-4">
          <Card className="bg-charcoal-black border-muted-gray/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Total Expenses</p>
                      <p className="text-lg font-semibold">
                        ${((summary.total_receipts || 0) +
                           (summary.total_mileage || 0) +
                           (summary.total_kit_rentals || 0) +
                           (summary.total_per_diem || 0)).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="h-8 w-px bg-border" />

                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Pending Approval</p>
                      <p className="text-lg font-semibold">
                        ${(summary.pending_amount || 0).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="h-8 w-px bg-border" />

                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Approved</p>
                      <p className="text-lg font-semibold">
                        ${(summary.approved_amount || 0).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </p>
                    </div>
                  </div>

                  {(summary.reimbursed_amount || 0) > 0 && (
                    <>
                      <div className="h-8 w-px bg-border" />

                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Reimbursed</p>
                          <p className="text-lg font-semibold">
                            ${(summary.reimbursed_amount || 0).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {pendingCounts.total > 0 && (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                    {pendingCounts.total} pending review
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as ExpenseTabId)}
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList className="flex-shrink-0 w-full justify-start h-auto p-1 bg-muted/50">
          {EXPENSE_TABS.map((tab) => {
            const Icon = tab.icon;
            const pendingCount = getPendingCount(tab.id);

            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-background"
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {pendingCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 h-5 min-w-5 px-1.5 text-xs bg-amber-500/20 text-amber-600"
                  >
                    {pendingCount}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Tab Content */}
        <div className="flex-1 min-h-0 mt-4">
          <TabsContent value="receipts" className="h-full m-0">
            <ReceiptsView projectId={projectId} canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="mileage" className="h-full m-0">
            <MileageView projectId={projectId} canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="kit-rentals" className="h-full m-0">
            <KitRentalsView projectId={projectId} canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="per-diem" className="h-full m-0">
            <PerDiemView projectId={projectId} canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="purchase-orders" className="h-full m-0">
            <PurchaseOrdersView projectId={projectId} canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="summary" className="h-full m-0">
            <ExpensesSummaryView projectId={projectId} canEdit={canEdit} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
