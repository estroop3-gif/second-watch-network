/**
 * BudgetDiffView - Compare two budgets side by side
 *
 * Shows line-item-level differences between any two budgets with
 * green/red color coding for savings/overruns and category groupings.
 */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { GitCompareArrows, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useBudgetDiff, useTypedBudgets } from '@/hooks/backlot';
import type { BacklotBudget } from '@/types/backlot';

interface Props {
  projectId: string;
  initialBudgetAId?: string;
  initialBudgetBId?: string;
  onClose?: () => void;
}

function getBudgetTypeColor(type?: string) {
  switch (type) {
    case 'estimate':
    case 'estimated':
      return 'bg-blue-600/20 text-blue-400';
    case 'actual':
      return 'bg-green-600/20 text-green-400';
    case 'draft':
      return 'bg-zinc-600/20 text-zinc-400';
    default:
      return 'bg-zinc-600/20 text-zinc-400';
  }
}

function formatDelta(delta: number) {
  const formatted = Math.abs(delta).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (delta > 0) return `+$${formatted}`;
  if (delta < 0) return `-$${formatted}`;
  return '$0.00';
}

function DeltaCell({ delta, deltaPct }: { delta: number; deltaPct: number }) {
  const color = delta > 0 ? 'text-red-400' : delta < 0 ? 'text-green-400' : 'text-zinc-500';
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;

  return (
    <div className={`flex items-center gap-1 justify-end ${color}`}>
      <Icon className="h-3 w-3" />
      <span>{formatDelta(delta)}</span>
      {deltaPct !== 0 && (
        <span className="text-xs opacity-70">({deltaPct > 0 ? '+' : ''}{deltaPct}%)</span>
      )}
    </div>
  );
}

export default function BudgetDiffView({ projectId, initialBudgetAId, initialBudgetBId, onClose }: Props) {
  const [budgetAId, setBudgetAId] = useState(initialBudgetAId || '');
  const [budgetBId, setBudgetBId] = useState(initialBudgetBId || '');

  const { data: typed, isLoading: typedLoading } = useTypedBudgets(projectId);
  const { data: diff, isLoading: diffLoading } = useBudgetDiff(
    budgetAId || null,
    budgetBId || null
  );

  // Collect all available budgets
  const allBudgets: BacklotBudget[] = [];
  if (typed) {
    if (typed.estimate) allBudgets.push(typed.estimate);
    if (typed.actual) allBudgets.push(typed.actual);
    if (typed.drafts) allBudgets.push(...typed.drafts);
  }

  if (typedLoading) {
    return (
      <Card className="bg-zinc-900 border-zinc-700">
        <CardContent className="p-6">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-bone-white flex items-center gap-2 text-lg">
          <GitCompareArrows className="h-5 w-5 text-blue-400" />
          Compare Budgets
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Budget Selectors */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-xs text-zinc-400 mb-1 block">Budget A</label>
            <Select value={budgetAId} onValueChange={setBudgetAId}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-bone-white">
                <SelectValue placeholder="Select budget..." />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                {allBudgets.map((b) => (
                  <SelectItem key={b.id} value={b.id} className="text-bone-white">
                    {b.name}
                    <Badge className={`ml-2 text-xs ${getBudgetTypeColor(b.budget_type)}`}>
                      {b.budget_type || 'estimate'}
                    </Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-zinc-500 pt-5">vs</div>
          <div className="flex-1">
            <label className="text-xs text-zinc-400 mb-1 block">Budget B</label>
            <Select value={budgetBId} onValueChange={setBudgetBId}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-bone-white">
                <SelectValue placeholder="Select budget..." />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                {allBudgets.filter((b) => b.id !== budgetAId).map((b) => (
                  <SelectItem key={b.id} value={b.id} className="text-bone-white">
                    {b.name}
                    <Badge className={`ml-2 text-xs ${getBudgetTypeColor(b.budget_type)}`}>
                      {b.budget_type || 'estimate'}
                    </Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Loading */}
        {diffLoading && budgetAId && budgetBId && (
          <div className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        )}

        {/* Diff Results */}
        {diff && (
          <>
            {/* Total Summary */}
            <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
              <div className="text-sm text-zinc-300">
                <span className="font-medium">{diff.budget_a.name}</span>
                <span className="text-zinc-500 mx-2">${diff.budget_a.estimated_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                <span className="text-zinc-500">vs</span>
                <span className="text-zinc-500 mx-2">${diff.budget_b.estimated_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                <span className="font-medium">{diff.budget_b.name}</span>
              </div>
              <DeltaCell delta={diff.total_delta} deltaPct={diff.total_delta_pct} />
            </div>

            {/* Category-Level Diff */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-zinc-400 border-b border-zinc-700">
                    <th className="text-left py-2 px-2">Description</th>
                    <th className="text-right py-2 px-2">{diff.budget_a.name}</th>
                    <th className="text-right py-2 px-2">{diff.budget_b.name}</th>
                    <th className="text-right py-2 px-2">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.category_summaries?.map((cat: any) => (
                    <React.Fragment key={cat.category}>
                      {/* Category Header */}
                      <tr className="bg-zinc-800/50">
                        <td className="py-2 px-2 font-semibold text-bone-white">{cat.category}</td>
                        <td className="py-2 px-2 text-right font-medium text-zinc-300">
                          ${cat.budget_a_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-2 text-right font-medium text-zinc-300">
                          ${cat.budget_b_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-2">
                          <DeltaCell delta={cat.delta} deltaPct={cat.delta_pct} />
                        </td>
                      </tr>
                      {/* Line Items in Category */}
                      {diff.line_items
                        ?.filter((item: any) => item.category === cat.category)
                        .map((item: any, idx: number) => (
                          <tr key={`${cat.category}-${idx}`} className="border-b border-zinc-800/50">
                            <td className="py-1.5 px-2 pl-6 text-zinc-400">{item.description}</td>
                            <td className="py-1.5 px-2 text-right text-zinc-400">
                              ${item.budget_a_estimated.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-1.5 px-2 text-right text-zinc-400">
                              ${item.budget_b_estimated.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-1.5 px-2">
                              <DeltaCell delta={item.delta} deltaPct={item.delta_pct} />
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* No Diff Available */}
        {!diff && !diffLoading && budgetAId && budgetBId && (
          <div className="text-center py-8 text-zinc-500">
            Select two budgets to compare
          </div>
        )}
      </CardContent>
    </Card>
  );
}
