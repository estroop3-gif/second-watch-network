/**
 * ComparisonTable - Table view of budget estimated vs actual
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BudgetComparisonData, BudgetComparisonCategory } from '@/hooks/backlot';

interface ComparisonTableProps {
  data: BudgetComparisonData;
}

export default function ComparisonTable({ data }: ComparisonTableProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (categoryId: string) => {
    const next = new Set(expandedCategories);
    if (next.has(categoryId)) {
      next.delete(categoryId);
    } else {
      next.add(categoryId);
    }
    setExpandedCategories(next);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (percent: number) => {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(1)}%`;
  };

  const getVarianceIcon = (variance: number) => {
    if (variance > 0) return <TrendingUp className="w-4 h-4 text-red-400" />;
    if (variance < 0) return <TrendingDown className="w-4 h-4 text-green-400" />;
    return <Minus className="w-4 h-4 text-muted-gray" />;
  };

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'text-red-400';
    if (variance < 0) return 'text-green-400';
    return 'text-muted-gray';
  };

  const renderCategoryRow = (category: BudgetComparisonCategory, level: number = 0) => {
    const isExpanded = expandedCategories.has(category.id);
    const hasLineItems = category.line_items && category.line_items.length > 0;

    return (
      <React.Fragment key={category.id}>
        <tr
          className={cn(
            "border-b border-muted-gray/10 hover:bg-charcoal-black/30 cursor-pointer",
            level === 0 && "bg-charcoal-black/20"
          )}
          onClick={() => hasLineItems && toggleCategory(category.id)}
        >
          <td className="px-4 py-3">
            <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 16}px` }}>
              {hasLineItems ? (
                isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-muted-gray" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-gray" />
                )
              ) : (
                <span className="w-4" />
              )}
              <span className={cn(
                level === 0 ? "font-semibold text-bone-white" : "text-muted-gray"
              )}>
                {category.code && (
                  <span className="font-mono text-xs text-muted-gray mr-2">
                    {category.code}
                  </span>
                )}
                {category.name}
              </span>
            </div>
          </td>
          <td className="px-4 py-3 text-right text-bone-white">
            {formatCurrency(category.estimated_subtotal)}
          </td>
          <td className="px-4 py-3 text-right text-bone-white">
            {formatCurrency(category.actual_subtotal)}
          </td>
          <td className={cn("px-4 py-3 text-right", getVarianceColor(category.variance))}>
            {category.variance >= 0 ? '+' : ''}{formatCurrency(category.variance)}
          </td>
          <td className={cn("px-4 py-3 text-right", getVarianceColor(category.variance))}>
            {formatPercent(category.variance_percent)}
          </td>
          <td className="px-4 py-3 text-center">
            {getVarianceIcon(category.variance)}
          </td>
        </tr>

        {/* Line Items */}
        {isExpanded && category.line_items.map((item) => (
          <tr
            key={item.id}
            className="border-b border-muted-gray/5 hover:bg-charcoal-black/20"
          >
            <td className="px-4 py-2">
              <div className="flex items-center gap-2" style={{ paddingLeft: '32px' }}>
                <span className="text-sm text-muted-gray">
                  {item.account_code && (
                    <span className="font-mono text-xs mr-2">{item.account_code}</span>
                  )}
                  {item.description}
                </span>
              </div>
            </td>
            <td className="px-4 py-2 text-right text-sm text-muted-gray">
              {formatCurrency(item.estimated_total)}
            </td>
            <td className="px-4 py-2 text-right text-sm text-muted-gray">
              {formatCurrency(item.actual_total)}
            </td>
            <td className={cn("px-4 py-2 text-right text-sm", getVarianceColor(item.variance))}>
              {item.variance >= 0 ? '+' : ''}{formatCurrency(item.variance)}
            </td>
            <td className={cn("px-4 py-2 text-right text-sm", getVarianceColor(item.variance))}>
              {formatPercent(item.variance_percent)}
            </td>
            <td className="px-4 py-2 text-center">
              {item.expenses.length > 0 && (
                <span className="text-xs text-muted-gray bg-charcoal-black/50 px-1.5 py-0.5 rounded">
                  {item.expenses.length}
                </span>
              )}
            </td>
          </tr>
        ))}
      </React.Fragment>
    );
  };

  return (
    <div className="bg-charcoal-black/30 rounded-lg border border-muted-gray/10 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-muted-gray/20 bg-rich-black/50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-gray uppercase tracking-wider">
              Category
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-gray uppercase tracking-wider">
              Estimated
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-gray uppercase tracking-wider">
              Actual
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-gray uppercase tracking-wider">
              Variance
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-gray uppercase tracking-wider">
              % Var
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-muted-gray uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {data.by_category_type.map((typeGroup) => (
            <React.Fragment key={typeGroup.type}>
              {/* Category Type Header */}
              <tr className="bg-rich-black/80">
                <td colSpan={6} className="px-4 py-2">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    {typeGroup.label}
                  </span>
                </td>
              </tr>

              {/* Categories in this type */}
              {typeGroup.categories.map((category) => renderCategoryRow(category))}

              {/* Type Subtotal */}
              <tr className="bg-charcoal-black/40 border-b-2 border-muted-gray/20">
                <td className="px-4 py-2 text-sm font-medium text-muted-gray">
                  {typeGroup.label} Subtotal
                </td>
                <td className="px-4 py-2 text-right text-sm font-medium text-bone-white">
                  {formatCurrency(typeGroup.estimated)}
                </td>
                <td className="px-4 py-2 text-right text-sm font-medium text-bone-white">
                  {formatCurrency(typeGroup.actual)}
                </td>
                <td className={cn("px-4 py-2 text-right text-sm font-medium", getVarianceColor(typeGroup.variance))}>
                  {typeGroup.variance >= 0 ? '+' : ''}{formatCurrency(typeGroup.variance)}
                </td>
                <td className={cn("px-4 py-2 text-right text-sm font-medium", getVarianceColor(typeGroup.variance))}>
                  {formatPercent(typeGroup.variance_percent)}
                </td>
                <td className="px-4 py-2 text-center">
                  {getVarianceIcon(typeGroup.variance)}
                </td>
              </tr>
            </React.Fragment>
          ))}

          {/* Grand Total */}
          <tr className="bg-amber-500/10 border-t-2 border-amber-500/30">
            <td className="px-4 py-3 text-base font-bold text-amber-400">
              TOTAL
            </td>
            <td className="px-4 py-3 text-right text-base font-bold text-bone-white">
              {formatCurrency(data.summary.estimated_total)}
            </td>
            <td className="px-4 py-3 text-right text-base font-bold text-bone-white">
              {formatCurrency(data.summary.actual_total)}
            </td>
            <td className={cn("px-4 py-3 text-right text-base font-bold", getVarianceColor(data.summary.variance))}>
              {data.summary.variance >= 0 ? '+' : ''}{formatCurrency(data.summary.variance)}
            </td>
            <td className={cn("px-4 py-3 text-right text-base font-bold", getVarianceColor(data.summary.variance))}>
              {formatPercent(data.summary.variance_percent)}
            </td>
            <td className="px-4 py-3 text-center">
              {getVarianceIcon(data.summary.variance)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Legend */}
      <div className="px-4 py-3 bg-rich-black/30 border-t border-muted-gray/10 flex items-center gap-6 text-xs text-muted-gray">
        <div className="flex items-center gap-1.5">
          <TrendingDown className="w-3 h-3 text-green-400" />
          <span>Under Budget</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Minus className="w-3 h-3 text-muted-gray" />
          <span>On Budget</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3 text-red-400" />
          <span>Over Budget</span>
        </div>
      </div>
    </div>
  );
}
