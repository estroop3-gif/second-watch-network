/**
 * BudgetComparisonView - Main view for comparing estimated vs actual budget
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Table2, BarChart3, FileText, RefreshCcw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useBudgetComparison } from '@/hooks/backlot';
import ComparisonTable from './comparison/ComparisonTable';
import ComparisonCharts from './comparison/ComparisonCharts';
import ComparisonTopSheet from './comparison/ComparisonTopSheet';
import { cn } from '@/lib/utils';

type ViewMode = 'table' | 'charts' | 'topsheet';

export default function BudgetComparisonView() {
  const { projectId } = useParams<{ projectId: string }>();
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  const { data, isLoading, refetch, isRefetching } = useBudgetComparison(projectId || null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-muted-gray mx-auto mb-4" />
          <h3 className="text-lg font-medium text-bone-white mb-2">No Budget Found</h3>
          <p className="text-muted-gray">
            Create a budget first to see the comparison view.
          </p>
        </div>
      </div>
    );
  }

  const { summary, expense_breakdown, budget } = data;
  const isOverBudget = summary.variance > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-bone-white">Budget Comparison</h2>
          <p className="text-sm text-muted-gray">
            {budget.name} - Estimated vs Actual Analysis
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="border-muted-gray/20 text-muted-gray hover:text-bone-white"
          >
            <RefreshCcw className={cn("w-4 h-4 mr-2", isRefetching && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-muted-gray/20 text-muted-gray hover:text-bone-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Estimated */}
        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <p className="text-xs text-muted-gray mb-1">Estimated Budget</p>
          <p className="text-2xl font-bold text-bone-white">
            {formatCurrency(summary.estimated_total)}
          </p>
          {budget.contingency_amount > 0 && (
            <p className="text-xs text-muted-gray mt-1">
              +{formatCurrency(budget.contingency_amount)} contingency
            </p>
          )}
        </div>

        {/* Actual */}
        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <p className="text-xs text-muted-gray mb-1">Actual Spent</p>
          <p className="text-2xl font-bold text-bone-white">
            {formatCurrency(summary.actual_total)}
          </p>
          <p className="text-xs text-muted-gray mt-1">
            from {expense_breakdown.total > 0 ? 'linked expenses' : 'no linked expenses'}
          </p>
        </div>

        {/* Variance */}
        <div className={cn(
          "rounded-lg p-4 border",
          isOverBudget
            ? "bg-red-500/10 border-red-500/20"
            : summary.variance < 0
              ? "bg-green-500/10 border-green-500/20"
              : "bg-charcoal-black/50 border-muted-gray/10"
        )}>
          <p className="text-xs text-muted-gray mb-1">Variance</p>
          <p className={cn(
            "text-2xl font-bold",
            isOverBudget ? "text-red-400" : summary.variance < 0 ? "text-green-400" : "text-bone-white"
          )}>
            {summary.variance >= 0 ? '+' : ''}{formatCurrency(summary.variance)}
          </p>
          <p className={cn(
            "text-xs mt-1",
            isOverBudget ? "text-red-400" : summary.variance < 0 ? "text-green-400" : "text-muted-gray"
          )}>
            {summary.variance_percent >= 0 ? '+' : ''}{summary.variance_percent.toFixed(1)}%
            {isOverBudget ? ' over budget' : summary.variance < 0 ? ' under budget' : ' on budget'}
          </p>
        </div>

        {/* Expense Breakdown */}
        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <p className="text-xs text-muted-gray mb-1">Expense Sources</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-gray">Receipts</span>
              <span className="text-bone-white">{formatCurrency(expense_breakdown.receipts)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-gray">Mileage</span>
              <span className="text-bone-white">{formatCurrency(expense_breakdown.mileage)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-gray">Kit Rentals</span>
              <span className="text-bone-white">{formatCurrency(expense_breakdown.kit_rentals)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-gray">Per Diem</span>
              <span className="text-bone-white">{formatCurrency(expense_breakdown.per_diem)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* View Mode Toggle */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
        <TabsList className="bg-charcoal-black/50 border border-muted-gray/10">
          <TabsTrigger value="table" className="data-[state=active]:bg-rich-black">
            <Table2 className="w-4 h-4 mr-2" />
            Table
          </TabsTrigger>
          <TabsTrigger value="charts" className="data-[state=active]:bg-rich-black">
            <BarChart3 className="w-4 h-4 mr-2" />
            Charts
          </TabsTrigger>
          <TabsTrigger value="topsheet" className="data-[state=active]:bg-rich-black">
            <FileText className="w-4 h-4 mr-2" />
            Top Sheet
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* View Content */}
      <div className="min-h-[400px]">
        {viewMode === 'table' && <ComparisonTable data={data} />}
        {viewMode === 'charts' && <ComparisonCharts data={data} />}
        {viewMode === 'topsheet' && <ComparisonTopSheet data={data} />}
      </div>
    </div>
  );
}
