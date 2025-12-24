/**
 * ComparisonTopSheet - Professional film budget Top Sheet comparison format
 */
import React from 'react';
import { cn } from '@/lib/utils';
import type { BudgetComparisonData } from '@/hooks/backlot';

interface ComparisonTopSheetProps {
  data: BudgetComparisonData;
}

export default function ComparisonTopSheet({ data }: ComparisonTopSheetProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatVariance = (variance: number) => {
    if (variance === 0) return '$0';
    const formatted = formatCurrency(Math.abs(variance));
    return variance < 0 ? `(${formatted})` : formatted;
  };

  const getVarianceClass = (variance: number) => {
    if (variance > 0) return 'text-red-400';
    if (variance < 0) return 'text-green-400';
    return 'text-muted-gray';
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Calculate running totals
  let runningEstimated = 0;
  let runningActual = 0;

  return (
    <div className="bg-charcoal-black/30 rounded-lg border border-muted-gray/10 overflow-hidden font-mono text-sm">
      {/* Header */}
      <div className="bg-rich-black/80 border-b border-muted-gray/20 p-6 text-center">
        <h2 className="text-xl font-bold text-bone-white tracking-wide uppercase">
          Production Budget Comparison
        </h2>
        <p className="text-amber-400 font-semibold mt-1">{data.budget.name}</p>
        <p className="text-muted-gray text-xs mt-2">As of: {currentDate}</p>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 bg-charcoal-black/50 border-b border-muted-gray/20 text-xs font-semibold text-muted-gray uppercase tracking-wider">
        <div className="col-span-1 px-4 py-3 text-center">Acct</div>
        <div className="col-span-5 px-4 py-3">Description</div>
        <div className="col-span-2 px-4 py-3 text-right">Estimated</div>
        <div className="col-span-2 px-4 py-3 text-right">Actual</div>
        <div className="col-span-2 px-4 py-3 text-right">Variance</div>
      </div>

      {/* Category Groups */}
      <div className="divide-y divide-muted-gray/10">
        {data.by_category_type.map((group) => {
          // Track running totals for this group
          const groupEstimated = group.estimated;
          const groupActual = group.actual;
          const groupVariance = group.variance;
          runningEstimated += groupEstimated;
          runningActual += groupActual;

          return (
            <div key={group.type}>
              {/* Group Header */}
              <div className="grid grid-cols-12 bg-rich-black/60 border-b border-muted-gray/10">
                <div className="col-span-12 px-4 py-2">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    {group.label}
                  </span>
                </div>
              </div>

              {/* Categories in this group */}
              {group.categories.map((category) => (
                <React.Fragment key={category.id}>
                  {/* Category Row */}
                  <div className="grid grid-cols-12 hover:bg-charcoal-black/20">
                    <div className="col-span-1 px-4 py-2 text-center text-muted-gray">
                      {category.code || ''}
                    </div>
                    <div className="col-span-5 px-4 py-2 text-bone-white font-medium">
                      {category.name}
                    </div>
                    <div className="col-span-2 px-4 py-2 text-right text-bone-white">
                      {formatCurrency(category.estimated_subtotal)}
                    </div>
                    <div className="col-span-2 px-4 py-2 text-right text-bone-white">
                      {formatCurrency(category.actual_subtotal)}
                    </div>
                    <div className={cn("col-span-2 px-4 py-2 text-right", getVarianceClass(category.variance))}>
                      {formatVariance(category.variance)}
                    </div>
                  </div>

                  {/* Line Items (indented) */}
                  {category.line_items.map((item) => (
                    <div key={item.id} className="grid grid-cols-12 text-xs hover:bg-charcoal-black/10">
                      <div className="col-span-1 px-4 py-1.5 text-center text-muted-gray/60">
                        {item.account_code || ''}
                      </div>
                      <div className="col-span-5 px-4 py-1.5 pl-8 text-muted-gray">
                        {item.description}
                      </div>
                      <div className="col-span-2 px-4 py-1.5 text-right text-muted-gray">
                        {formatCurrency(item.estimated_total)}
                      </div>
                      <div className="col-span-2 px-4 py-1.5 text-right text-muted-gray">
                        {formatCurrency(item.actual_total)}
                      </div>
                      <div className={cn("col-span-2 px-4 py-1.5 text-right", getVarianceClass(item.variance))}>
                        {formatVariance(item.variance)}
                      </div>
                    </div>
                  ))}
                </React.Fragment>
              ))}

              {/* Group Subtotal */}
              <div className="grid grid-cols-12 bg-charcoal-black/40 border-t border-muted-gray/10">
                <div className="col-span-1 px-4 py-2" />
                <div className="col-span-5 px-4 py-2 text-muted-gray font-medium">
                  {group.label} Subtotal
                </div>
                <div className="col-span-2 px-4 py-2 text-right text-bone-white font-medium border-t border-muted-gray/30">
                  {formatCurrency(groupEstimated)}
                </div>
                <div className="col-span-2 px-4 py-2 text-right text-bone-white font-medium border-t border-muted-gray/30">
                  {formatCurrency(groupActual)}
                </div>
                <div className={cn("col-span-2 px-4 py-2 text-right font-medium border-t border-muted-gray/30", getVarianceClass(groupVariance))}>
                  {formatVariance(groupVariance)}
                </div>
              </div>
            </div>
          );
        })}

        {/* Subtotal Before Contingency/Fringes */}
        <div className="grid grid-cols-12 bg-charcoal-black/60 border-t-2 border-muted-gray/20">
          <div className="col-span-1 px-4 py-3" />
          <div className="col-span-5 px-4 py-3 text-bone-white font-bold uppercase">
            Subtotal
          </div>
          <div className="col-span-2 px-4 py-3 text-right text-bone-white font-bold">
            {formatCurrency(runningEstimated)}
          </div>
          <div className="col-span-2 px-4 py-3 text-right text-bone-white font-bold">
            {formatCurrency(runningActual)}
          </div>
          <div className={cn("col-span-2 px-4 py-3 text-right font-bold", getVarianceClass(runningActual - runningEstimated))}>
            {formatVariance(runningActual - runningEstimated)}
          </div>
        </div>

        {/* Contingency */}
        {data.budget.contingency_amount > 0 && (
          <div className="grid grid-cols-12 bg-charcoal-black/40">
            <div className="col-span-1 px-4 py-2" />
            <div className="col-span-5 px-4 py-2 text-muted-gray">
              Contingency ({data.budget.contingency_percent}%)
            </div>
            <div className="col-span-2 px-4 py-2 text-right text-muted-gray">
              {formatCurrency(data.budget.contingency_amount)}
            </div>
            <div className="col-span-2 px-4 py-2 text-right text-muted-gray">
              --
            </div>
            <div className="col-span-2 px-4 py-2 text-right text-muted-gray">
              --
            </div>
          </div>
        )}

        {/* Fringes */}
        {data.budget.fringes_total > 0 && (
          <div className="grid grid-cols-12 bg-charcoal-black/40">
            <div className="col-span-1 px-4 py-2" />
            <div className="col-span-5 px-4 py-2 text-muted-gray">
              Fringes
            </div>
            <div className="col-span-2 px-4 py-2 text-right text-muted-gray">
              {formatCurrency(data.budget.fringes_total)}
            </div>
            <div className="col-span-2 px-4 py-2 text-right text-muted-gray">
              --
            </div>
            <div className="col-span-2 px-4 py-2 text-right text-muted-gray">
              --
            </div>
          </div>
        )}

        {/* Grand Total */}
        <div className="grid grid-cols-12 bg-amber-500/10 border-t-2 border-amber-500/30">
          <div className="col-span-1 px-4 py-4" />
          <div className="col-span-5 px-4 py-4 text-amber-400 font-bold text-base uppercase">
            Grand Total
          </div>
          <div className="col-span-2 px-4 py-4 text-right text-bone-white font-bold text-base border-t-2 border-b-2 border-amber-500/30">
            {formatCurrency(data.summary.estimated_total)}
          </div>
          <div className="col-span-2 px-4 py-4 text-right text-bone-white font-bold text-base border-t-2 border-b-2 border-amber-500/30">
            {formatCurrency(data.summary.actual_total)}
          </div>
          <div className={cn("col-span-2 px-4 py-4 text-right font-bold text-base border-t-2 border-b-2 border-amber-500/30", getVarianceClass(data.summary.variance))}>
            {formatVariance(data.summary.variance)}
          </div>
        </div>
      </div>

      {/* Footer - Expense Source Breakdown */}
      <div className="bg-rich-black/50 border-t border-muted-gray/20 p-4">
        <div className="text-xs text-muted-gray mb-2 uppercase tracking-wider">
          Actual Expense Sources
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-gray">Receipts:</span>
            <span className="text-bone-white ml-2">{formatCurrency(data.expense_breakdown.receipts)}</span>
          </div>
          <div>
            <span className="text-muted-gray">Mileage:</span>
            <span className="text-bone-white ml-2">{formatCurrency(data.expense_breakdown.mileage)}</span>
          </div>
          <div>
            <span className="text-muted-gray">Kit Rentals:</span>
            <span className="text-bone-white ml-2">{formatCurrency(data.expense_breakdown.kit_rentals)}</span>
          </div>
          <div>
            <span className="text-muted-gray">Per Diem:</span>
            <span className="text-bone-white ml-2">{formatCurrency(data.expense_breakdown.per_diem)}</span>
          </div>
        </div>
      </div>

      {/* Summary Box */}
      <div className="bg-charcoal-black/50 border-t border-muted-gray/20 p-4">
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
          <div className="text-center">
            <div className="text-xs text-muted-gray uppercase mb-1">Status</div>
            <div className={cn(
              "font-bold",
              data.summary.variance > 0 ? "text-red-400" :
              data.summary.variance < 0 ? "text-green-400" : "text-muted-gray"
            )}>
              {data.summary.variance > 0 ? 'OVER BUDGET' :
               data.summary.variance < 0 ? 'UNDER BUDGET' : 'ON BUDGET'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-gray uppercase mb-1">Variance %</div>
            <div className={cn(
              "font-bold",
              getVarianceClass(data.summary.variance)
            )}>
              {data.summary.variance_percent >= 0 ? '+' : ''}{data.summary.variance_percent.toFixed(1)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted-gray uppercase mb-1">Budget Status</div>
            <div className="text-bone-white font-medium capitalize">
              {data.budget.status.replace(/_/g, ' ')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
