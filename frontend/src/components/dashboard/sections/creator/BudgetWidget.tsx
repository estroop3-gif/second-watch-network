/**
 * BudgetWidget
 * Shows budget health and pending approvals across all user's projects
 */

import { Link } from 'react-router-dom';
import { useBudgetSummaryWidget } from '@/hooks/backlot';
import { WidgetSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DollarSign, Receipt, FileText, AlertTriangle, ChevronRight, TrendingUp, AlertCircle } from 'lucide-react';
import type { SectionProps } from '@/components/dashboard/config/sectionRegistry';

// Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format compact currency for large numbers
function formatCompactCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return formatCurrency(amount);
}

export function BudgetWidget({ className = '' }: SectionProps) {
  const { data, isLoading, error } = useBudgetSummaryWidget();

  if (isLoading) {
    return <WidgetSkeleton className={className} />;
  }

  if (error) {
    return (
      <div className={`p-4 bg-charcoal-black border border-red-500/30 rounded-lg ${className}`}>
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span>Error loading budget: {error.message}</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`p-4 bg-charcoal-black border border-muted-gray/30 rounded-lg ${className}`}>
        <div className="flex items-center gap-2 text-muted-gray">
          <DollarSign className="w-5 h-5" />
          <span>No budget data</span>
        </div>
      </div>
    );
  }

  const { total_budget, total_spent, pending_invoices, pending_expenses, alerts } = data;

  // Calculate budget health
  const spentPercent = total_budget > 0
    ? Math.min((total_spent / total_budget) * 100, 100)
    : 0;
  const remaining = total_budget - total_spent;
  const isOverBudget = remaining < 0;
  const isWarning = spentPercent > 80 && !isOverBudget;

  // If no budget data and no pending items, don't show
  if (total_budget === 0 && pending_invoices === 0 && pending_expenses === 0) {
    return null;
  }

  return (
    <div className={`p-4 bg-charcoal-black border border-emerald-500/30 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-400" />
          <h3 className="font-heading text-bone-white">Budget Overview</h3>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/backlot">
            Details
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mb-4 space-y-2">
          {alerts.slice(0, 2).map((alert, index) => (
            <div
              key={index}
              className={`p-2 rounded-lg flex items-start gap-2 ${
                alert.severity === 'error'
                  ? 'bg-primary-red/10 border border-primary-red/30'
                  : 'bg-accent-yellow/10 border border-accent-yellow/30'
              }`}
            >
              <AlertTriangle
                className={`w-4 h-4 mt-0.5 ${
                  alert.severity === 'error' ? 'text-primary-red' : 'text-accent-yellow'
                }`}
              />
              <div>
                <p className="text-sm text-bone-white">{alert.project_name}</p>
                <p className={`text-xs ${
                  alert.severity === 'error' ? 'text-primary-red' : 'text-accent-yellow'
                }`}>
                  {alert.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Budget Progress */}
      {total_budget > 0 && (
        <div className="mb-4 p-3 bg-muted-gray/10 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-gray">Total Budget</span>
            <span className="text-sm font-medium text-bone-white">
              {formatCompactCurrency(total_budget)}
            </span>
          </div>
          <Progress
            value={spentPercent}
            className={`h-3 ${
              isOverBudget
                ? '[&>div]:bg-primary-red'
                : isWarning
                ? '[&>div]:bg-accent-yellow'
                : '[&>div]:bg-emerald-500'
            }`}
          />
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1">
              <TrendingUp className={`w-3 h-3 ${
                isOverBudget ? 'text-primary-red' : 'text-emerald-400'
              }`} />
              <span className={`text-xs ${
                isOverBudget ? 'text-primary-red' : 'text-muted-gray'
              }`}>
                {formatCompactCurrency(total_spent)} spent
              </span>
            </div>
            <span className={`text-xs font-medium ${
              isOverBudget
                ? 'text-primary-red'
                : isWarning
                ? 'text-accent-yellow'
                : 'text-emerald-400'
            }`}>
              {isOverBudget
                ? `${formatCompactCurrency(Math.abs(remaining))} over`
                : `${formatCompactCurrency(remaining)} left`}
            </span>
          </div>
        </div>
      )}

      {/* Pending Approvals */}
      {(pending_invoices > 0 || pending_expenses > 0) && (
        <div>
          <p className="text-xs text-muted-gray uppercase tracking-wider mb-2">Pending Approval</p>
          <div className="grid grid-cols-2 gap-3">
            {pending_invoices > 0 && (
              <Link
                to="/backlot?tab=invoices&status=pending"
                className="p-3 bg-muted-gray/10 rounded-lg hover:bg-muted-gray/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span className="text-xl font-bold text-bone-white">{pending_invoices}</span>
                </div>
                <p className="text-xs text-muted-gray mt-1">Invoice{pending_invoices !== 1 ? 's' : ''}</p>
              </Link>
            )}
            {pending_expenses > 0 && (
              <Link
                to="/backlot?tab=expenses&status=pending"
                className="p-3 bg-muted-gray/10 rounded-lg hover:bg-muted-gray/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-orange-400" />
                  <span className="text-xl font-bold text-bone-white">{pending_expenses}</span>
                </div>
                <p className="text-xs text-muted-gray mt-1">Expense{pending_expenses !== 1 ? 's' : ''}</p>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Empty state with CTA */}
      {total_budget === 0 && pending_invoices === 0 && pending_expenses === 0 && (
        <div className="text-center py-4">
          <p className="text-muted-gray text-sm mb-3">No active budgets</p>
          <Button variant="outline" size="sm" asChild>
            <Link to="/backlot/new">
              Create Budget
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export default BudgetWidget;
