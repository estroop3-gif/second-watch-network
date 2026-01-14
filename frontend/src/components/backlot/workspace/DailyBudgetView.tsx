/**
 * DailyBudgetView - View and manage daily budgets per production day
 */
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Calendar,
  DollarSign,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Receipt,
  Lightbulb,
  CheckCircle2,
  Users,
  Clock,
  Briefcase,
  Film,
  MapPin,
  Package,
  Shirt,
  Car,
  FileText,
  ExternalLink,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';
import {
  useDailyBudgets,
  useDailyBudget,
  useDailyBudgetForDay,
  useUpdateDailyBudget,
  useSuggestedLineItems,
  useAutoPopulateDailyBudget,
  useDailyBudgetItems,
  useDailyBudgetItemMutations,
  useBudget,
  useBudgetLineItems,
  useProductionDays,
  useDailyLaborCosts,
  useDailySceneCosts,
  useDailyInvoices,
  useDailyGearCosts,
} from '@/hooks/backlot';
import {
  BacklotDailyBudget,
  BacklotDailyBudgetItem,
  BacklotBudgetLineItem,
  DailyBudgetSummary,
  DailyBudgetItemInput,
  LaborCostEntry,
  DailyLaborCosts,
  DailySceneCosts,
  SceneCostDetail,
  DailyInvoices,
  DailyInvoiceEntry,
} from '@/types/backlot';

interface DailyBudgetViewProps {
  projectId: string;
  canEdit: boolean;
}

// Format currency
const formatCurrency = (amount: number, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Daily Budget Card (in list view)
const DailyBudgetCard: React.FC<{
  summary: DailyBudgetSummary;
  currency: string;
  onClick: () => void;
}> = ({ summary, currency, onClick }) => {
  const isOverBudget = summary.variance > 0;
  const progressPercent = summary.estimated_total > 0
    ? Math.min((summary.actual_total / summary.estimated_total) * 100, 100)
    : 0;

  return (
    <div
      onClick={onClick}
      className={`bg-charcoal-black/50 border rounded-lg p-4 cursor-pointer transition-all hover:border-accent-yellow/50 ${
        isOverBudget ? 'border-red-500/30' : 'border-muted-gray/20'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Day info */}
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30">
              Day {summary.production_day_number}
            </Badge>
            {summary.has_call_sheet && (
              <Badge variant="outline" className="text-xs">
                Has Call Sheet
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-gray mb-2">
            <Calendar className="w-4 h-4" />
            {format(parseLocalDate(summary.date), 'EEEE, MMMM d, yyyy')}
          </div>
          {summary.production_day_title && (
            <p className="text-bone-white font-medium">{summary.production_day_title}</p>
          )}

          {/* Progress */}
          <div className="mt-3">
            <Progress
              value={progressPercent}
              className={`h-1.5 ${isOverBudget ? '[&>div]:bg-red-500' : '[&>div]:bg-green-500'}`}
            />
            <div className="flex justify-between mt-1 text-xs text-muted-gray">
              <span>{summary.item_count} items</span>
              <span>{summary.receipt_count} receipts</span>
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="text-right space-y-1 min-w-[120px]">
          <div>
            <div className="text-xs text-muted-gray">Estimated</div>
            <div className="font-medium text-bone-white">
              {formatCurrency(summary.estimated_total, currency)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-gray">Actual</div>
            <div className="font-medium text-bone-white">
              {formatCurrency(summary.actual_total, currency)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-gray">Variance</div>
            <div
              className={`font-medium flex items-center justify-end gap-1 ${
                isOverBudget ? 'text-red-400' : 'text-green-400'
              }`}
            >
              {isOverBudget ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {formatCurrency(Math.abs(summary.variance), currency)}
            </div>
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-muted-gray self-center" />
      </div>
    </div>
  );
};

// Daily Budget Item Row
const DailyBudgetItemRow: React.FC<{
  item: BacklotDailyBudgetItem;
  currency: string;
  canEdit: boolean;
  onEdit: (item: BacklotDailyBudgetItem) => void;
  onDelete: (id: string) => void;
}> = ({ item, currency, canEdit, onEdit, onDelete }) => {
  const variance = item.actual_amount - item.estimated_amount;
  const isOverBudget = variance > 0;

  return (
    <div className="flex items-center justify-between py-3 px-4 bg-charcoal-black/40 rounded-lg hover:bg-charcoal-black/60 transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-bone-white">{item.label}</span>
          {item.is_ad_hoc && (
            <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/30">
              Ad-hoc
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-gray flex items-center gap-2">
          {item.category_name && <span>{item.category_name}</span>}
          {item.vendor_name && (
            <>
              <span>•</span>
              <span>{item.vendor_name}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right min-w-[90px]">
          <div className="text-sm text-bone-white">
            {formatCurrency(item.estimated_amount, currency)}
          </div>
          <div className="text-xs text-muted-gray">estimated</div>
        </div>
        <div className="text-right min-w-[90px]">
          <div className="text-sm text-bone-white">
            {formatCurrency(item.actual_amount, currency)}
          </div>
          <div className="text-xs text-muted-gray">actual</div>
        </div>
        <div className="text-right min-w-[70px]">
          <div
            className={`text-sm ${
              isOverBudget ? 'text-red-400' : variance < 0 ? 'text-green-400' : 'text-muted-gray'
            }`}
          >
            {variance !== 0 && (isOverBudget ? '+' : '')}
            {formatCurrency(variance, currency)}
          </div>
        </div>

        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(item)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-400" onClick={() => onDelete(item.id)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
};

// Labor Costs Section (from timecards)
const LaborCostsSection: React.FC<{
  laborCosts: DailyLaborCosts | undefined;
  isLoading: boolean;
  currency: string;
}> = ({ laborCosts, isLoading, currency }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  if (!laborCosts || laborCosts.entries.length === 0) {
    return null;
  }

  const formatHours = (hours: number) => {
    if (hours === 0) return '-';
    return `${hours.toFixed(1)}h`;
  };

  const getRateSourceBadge = (source: string) => {
    switch (source) {
      case 'crew_rate':
        return (
          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/30">
            Day Rate
          </Badge>
        );
      case 'entry':
        return (
          <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
            Timecard
          </Badge>
        );
      case 'budget':
        return (
          <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/30">
            Budget
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <button
        className="flex items-center gap-2 w-full text-left"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-muted-gray" />
        ) : (
          <ChevronRight className="w-5 h-5 text-muted-gray" />
        )}
        <h3 className="text-lg font-medium text-bone-white flex items-center gap-2">
          <Users className="w-5 h-5 text-accent-yellow" />
          Labor Costs
        </h3>
        <Badge className="ml-2 bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30">
          {laborCosts.entries.length} crew
        </Badge>
        <div className="ml-auto text-bone-white font-medium">
          {formatCurrency(laborCosts.grand_total, currency)}
        </div>
      </button>

      {isExpanded && (
        <div className="space-y-3">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-charcoal-black/40 rounded-lg p-3">
              <div className="text-xs text-muted-gray mb-1">Base Pay</div>
              <div className="text-lg font-semibold text-bone-white">
                {formatCurrency(laborCosts.total_base_pay, currency)}
              </div>
            </div>
            <div className="bg-charcoal-black/40 rounded-lg p-3">
              <div className="text-xs text-muted-gray mb-1">Overtime</div>
              <div className="text-lg font-semibold text-amber-400">
                {formatCurrency(laborCosts.total_overtime_pay, currency)}
              </div>
            </div>
            <div className="bg-charcoal-black/40 rounded-lg p-3">
              <div className="text-xs text-muted-gray mb-1">Double Time</div>
              <div className="text-lg font-semibold text-red-400">
                {formatCurrency(laborCosts.total_double_time_pay, currency)}
              </div>
            </div>
            <div className="bg-charcoal-black/40 rounded-lg p-3">
              <div className="text-xs text-muted-gray mb-1">Allowances</div>
              <div className="text-lg font-semibold text-blue-400">
                {formatCurrency(laborCosts.total_allowances, currency)}
              </div>
            </div>
          </div>

          {/* Crew List */}
          <div className="space-y-2">
            {laborCosts.entries.map((entry: LaborCostEntry) => (
              <div
                key={entry.user_id || entry.timecard_entry_id}
                className="flex items-center justify-between py-3 px-4 bg-charcoal-black/40 rounded-lg hover:bg-charcoal-black/60 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {entry.user_avatar ? (
                    <img
                      src={entry.user_avatar}
                      alt={entry.user_name || 'Crew'}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted-gray/30 flex items-center justify-center">
                      <Users className="w-4 h-4 text-muted-gray" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-medium text-bone-white truncate">
                      {entry.user_name || 'Unknown'}
                    </div>
                    <div className="text-xs text-muted-gray flex items-center gap-2">
                      {entry.role_title && <span>{entry.role_title}</span>}
                      {entry.department && (
                        <>
                          <span>•</span>
                          <span>{entry.department}</span>
                        </>
                      )}
                      {getRateSourceBadge(entry.rate_source)}
                    </div>
                  </div>
                </div>

                {/* Hours breakdown */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center min-w-[50px]">
                    <div className="text-bone-white">{formatHours(entry.hours_worked)}</div>
                    <div className="text-xs text-muted-gray">Regular</div>
                  </div>
                  {entry.overtime_hours > 0 && (
                    <div className="text-center min-w-[50px]">
                      <div className="text-amber-400">{formatHours(entry.overtime_hours)}</div>
                      <div className="text-xs text-muted-gray">OT</div>
                    </div>
                  )}
                  {entry.double_time_hours > 0 && (
                    <div className="text-center min-w-[50px]">
                      <div className="text-red-400">{formatHours(entry.double_time_hours)}</div>
                      <div className="text-xs text-muted-gray">DT</div>
                    </div>
                  )}
                </div>

                {/* Rate and total */}
                <div className="flex items-center gap-4">
                  <div className="text-right min-w-[80px]">
                    <div className="text-sm text-bone-white">
                      {formatCurrency(entry.rate_amount, currency)}
                    </div>
                    <div className="text-xs text-muted-gray">
                      /{entry.rate_type === 'hourly' ? 'hr' : entry.rate_type === 'daily' ? 'day' : entry.rate_type}
                    </div>
                  </div>
                  <div className="text-right min-w-[90px]">
                    <div className="font-medium text-bone-white">
                      {formatCurrency(entry.total_pay, currency)}
                    </div>
                    {(entry.kit_rental > 0 || entry.car_allowance > 0 || entry.phone_allowance > 0) && (
                      <div className="text-xs text-blue-400">
                        +{formatCurrency(entry.kit_rental + entry.car_allowance + entry.phone_allowance, currency)} kit/allow
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pending indicator */}
          {laborCosts.entries.some((e) => e.timecard_status === 'pending' || e.timecard_status === 'submitted') && (
            <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
              <Clock className="w-4 h-4" />
              Some timecards are pending approval. Totals may change.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Scene Costs Section (from scene breakdown items and linked expenses)
const SceneCostsSection: React.FC<{
  sceneCosts: DailySceneCosts | undefined;
  isLoading: boolean;
  currency: string;
}> = ({ sceneCosts, isLoading, currency }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  if (!sceneCosts || sceneCosts.scenes.length === 0) {
    return null;
  }

  const toggleSceneExpanded = (sceneId: string) => {
    setExpandedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(sceneId)) {
        next.delete(sceneId);
      } else {
        next.add(sceneId);
      }
      return next;
    });
  };

  const getExpenseTypeIcon = (type: string) => {
    switch (type) {
      case 'receipt':
        return <Receipt className="w-3 h-3" />;
      case 'mileage':
        return <Car className="w-3 h-3" />;
      case 'kit_rental':
        return <Briefcase className="w-3 h-3" />;
      case 'per_diem':
        return <DollarSign className="w-3 h-3" />;
      case 'invoice_line_item':
        return <Receipt className="w-3 h-3" />;
      default:
        return <DollarSign className="w-3 h-3" />;
    }
  };

  const getBreakdownTypeIcon = (type: string) => {
    switch (type) {
      case 'wardrobe':
        return <Shirt className="w-3 h-3" />;
      case 'prop':
        return <Package className="w-3 h-3" />;
      case 'vehicle':
        return <Car className="w-3 h-3" />;
      default:
        return <Package className="w-3 h-3" />;
    }
  };

  const formatExpenseType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="space-y-4">
      <button
        className="flex items-center gap-2 w-full text-left"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-muted-gray" />
        ) : (
          <ChevronRight className="w-5 h-5 text-muted-gray" />
        )}
        <h3 className="text-lg font-medium text-bone-white flex items-center gap-2">
          <Film className="w-5 h-5 text-accent-yellow" />
          Scene Costs
        </h3>
        <Badge className="ml-2 bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30">
          {sceneCosts.scenes.length} {sceneCosts.scenes.length === 1 ? 'scene' : 'scenes'}
        </Badge>
        <div className="ml-auto text-bone-white font-medium">
          {formatCurrency(sceneCosts.grand_total, currency)}
        </div>
      </button>

      {isExpanded && (
        <div className="space-y-3">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-charcoal-black/40 rounded-lg p-3">
              <div className="text-xs text-muted-gray mb-1">Breakdown Items</div>
              <div className="text-lg font-semibold text-bone-white">
                {formatCurrency(sceneCosts.total_breakdown_costs, currency)}
              </div>
              <div className="text-xs text-muted-gray">Props, wardrobe, etc.</div>
            </div>
            <div className="bg-charcoal-black/40 rounded-lg p-3">
              <div className="text-xs text-muted-gray mb-1">Linked Expenses</div>
              <div className="text-lg font-semibold text-blue-400">
                {formatCurrency(sceneCosts.total_expense_costs, currency)}
              </div>
              <div className="text-xs text-muted-gray">Receipts, mileage, etc.</div>
            </div>
          </div>

          {/* Scene List */}
          <div className="space-y-2">
            {sceneCosts.scenes.map((scene: SceneCostDetail) => {
              const isSceneExpanded = expandedScenes.has(scene.scene_id);
              const hasItems = scene.breakdown_items.length > 0 || scene.expenses.length > 0;

              return (
                <div
                  key={scene.scene_id}
                  className="bg-charcoal-black/40 rounded-lg overflow-hidden"
                >
                  {/* Scene Header */}
                  <button
                    className="w-full flex items-center justify-between py-3 px-4 hover:bg-charcoal-black/60 transition-colors"
                    onClick={() => hasItems && toggleSceneExpanded(scene.scene_id)}
                    disabled={!hasItems}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {hasItems ? (
                        isSceneExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-gray flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-gray flex-shrink-0" />
                        )
                      ) : (
                        <div className="w-4 h-4" />
                      )}
                      <div className="min-w-0 text-left">
                        <div className="font-medium text-bone-white flex items-center gap-2">
                          <span className="bg-accent-yellow/20 text-accent-yellow px-1.5 py-0.5 rounded text-xs font-mono">
                            {scene.scene_number || 'SC'}
                          </span>
                          <span className="truncate">
                            {scene.scene_name || 'Untitled Scene'}
                          </span>
                        </div>
                        <div className="text-xs text-muted-gray flex items-center gap-2 mt-0.5">
                          {scene.int_ext && <span>{scene.int_ext}</span>}
                          {scene.location && (
                            <>
                              <span>•</span>
                              <MapPin className="w-3 h-3" />
                              <span className="truncate">{scene.location}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {scene.breakdown_items.length > 0 && (
                        <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/30">
                          {scene.breakdown_items.length} items
                        </Badge>
                      )}
                      {scene.expenses.length > 0 && (
                        <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
                          {scene.expenses.length} expenses
                        </Badge>
                      )}
                      <div className="font-medium text-bone-white min-w-[80px] text-right">
                        {formatCurrency(scene.scene_total, currency)}
                      </div>
                    </div>
                  </button>

                  {/* Scene Details */}
                  {isSceneExpanded && hasItems && (
                    <div className="px-4 pb-4 space-y-3">
                      {/* Breakdown Items */}
                      {scene.breakdown_items.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs text-muted-gray font-medium uppercase tracking-wide mb-2">
                            Breakdown Items
                          </div>
                          {scene.breakdown_items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between py-2 px-3 bg-charcoal-black/60 rounded"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {getBreakdownTypeIcon(item.item_type)}
                                <span className="text-sm text-bone-white truncate">
                                  {item.description}
                                </span>
                                {item.quantity > 1 && (
                                  <Badge variant="outline" className="text-xs">
                                    x{item.quantity}
                                  </Badge>
                                )}
                              </div>
                              <span className="text-sm text-purple-400 font-medium">
                                {formatCurrency(item.estimated_cost * item.quantity, currency)}
                              </span>
                            </div>
                          ))}
                          <div className="flex justify-end pt-1">
                            <span className="text-xs text-muted-gray">
                              Subtotal: {formatCurrency(scene.breakdown_subtotal, currency)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Expenses */}
                      {scene.expenses.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs text-muted-gray font-medium uppercase tracking-wide mb-2">
                            Linked Expenses
                          </div>
                          {scene.expenses.map((expense) => (
                            <div
                              key={expense.id}
                              className="flex items-center justify-between py-2 px-3 bg-charcoal-black/60 rounded"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {getExpenseTypeIcon(expense.expense_type)}
                                <span className="text-sm text-bone-white truncate">
                                  {expense.description || formatExpenseType(expense.expense_type)}
                                </span>
                                {expense.vendor && (
                                  <span className="text-xs text-muted-gray">
                                    ({expense.vendor})
                                  </span>
                                )}
                                {expense.user_name && (
                                  <span className="text-xs text-muted-gray">
                                    • {expense.user_name}
                                  </span>
                                )}
                              </div>
                              <span className="text-sm text-blue-400 font-medium">
                                {formatCurrency(expense.amount, currency)}
                              </span>
                            </div>
                          ))}
                          <div className="flex justify-end pt-1">
                            <span className="text-xs text-muted-gray">
                              Subtotal: {formatCurrency(scene.expenses_subtotal, currency)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// Invoices Section (for production day)
const InvoicesSection: React.FC<{
  invoices: DailyInvoices | undefined;
  isLoading: boolean;
  currency: string;
}> = ({ invoices, isLoading, currency }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  if (!invoices || invoices.invoices.length === 0) {
    return null;
  }

  const toggleInvoiceExpanded = (invoiceId: string) => {
    setExpandedInvoices((prev) => {
      const next = new Set(prev);
      if (next.has(invoiceId)) {
        next.delete(invoiceId);
      } else {
        next.add(invoiceId);
      }
      return next;
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
      case 'sent':
      case 'paid':
        return (
          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/30">
            {status === 'paid' ? 'Paid' : status === 'sent' ? 'Sent' : 'Approved'}
          </Badge>
        );
      case 'pending_approval':
        return (
          <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/30">
            Pending
          </Badge>
        );
      case 'draft':
        return (
          <Badge variant="outline" className="text-xs bg-gray-500/10 text-gray-500 border-gray-500/30">
            Draft
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {status}
          </Badge>
        );
    }
  };

  const getLinkTypeBadge = (linkType: string) => {
    if (linkType === 'production_day') {
      return (
        <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
          Day Linked
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/30">
          Service Date
        </Badge>
      );
    }
  };

  return (
    <div className="space-y-4">
      <button
        className="flex items-center gap-2 w-full text-left"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-muted-gray" />
        ) : (
          <ChevronRight className="w-5 h-5 text-muted-gray" />
        )}
        <h3 className="text-lg font-medium text-bone-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-accent-yellow" />
          Invoices
        </h3>
        <Badge className="ml-2 bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30">
          {invoices.invoice_count} {invoices.invoice_count === 1 ? 'invoice' : 'invoices'}
        </Badge>
        <div className="ml-auto text-bone-white font-medium">
          {formatCurrency(invoices.total_amount, currency)}
        </div>
      </button>

      {isExpanded && (
        <div className="space-y-3">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-charcoal-black/40 rounded-lg p-3">
              <div className="text-xs text-muted-gray mb-1">Approved</div>
              <div className="text-lg font-semibold text-green-400">
                {formatCurrency(invoices.approved_total, currency)}
              </div>
              <div className="text-xs text-muted-gray">
                {invoices.approved_count} {invoices.approved_count === 1 ? 'invoice' : 'invoices'}
              </div>
            </div>
            <div className="bg-charcoal-black/40 rounded-lg p-3">
              <div className="text-xs text-muted-gray mb-1">Pending</div>
              <div className="text-lg font-semibold text-amber-400">
                {formatCurrency(invoices.pending_total, currency)}
              </div>
              <div className="text-xs text-muted-gray">
                {invoices.pending_count} {invoices.pending_count === 1 ? 'invoice' : 'invoices'}
              </div>
            </div>
          </div>

          {/* Invoice List */}
          <div className="space-y-2">
            {invoices.invoices.map((invoice: DailyInvoiceEntry) => {
              const isInvoiceExpanded = expandedInvoices.has(invoice.id);
              const hasLineItems = invoice.line_items.length > 0;

              return (
                <div
                  key={invoice.id}
                  className="bg-charcoal-black/40 rounded-lg overflow-hidden"
                >
                  {/* Invoice Header */}
                  <button
                    className="w-full flex items-center justify-between py-3 px-4 hover:bg-charcoal-black/60 transition-colors"
                    onClick={() => hasLineItems && toggleInvoiceExpanded(invoice.id)}
                    disabled={!hasLineItems}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {hasLineItems ? (
                        isInvoiceExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-gray flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-gray flex-shrink-0" />
                        )
                      ) : (
                        <div className="w-4 h-4" />
                      )}
                      <div className="min-w-0 text-left">
                        <div className="font-medium text-bone-white flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-gray" />
                          <span className="truncate">
                            {invoice.vendor_name || 'Unknown Vendor'}
                          </span>
                          {invoice.invoice_number && (
                            <span className="text-xs text-muted-gray font-mono">
                              #{invoice.invoice_number}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-gray flex items-center gap-2 mt-0.5">
                          {invoice.invoice_date && (
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="w-3 h-3" />
                              {format(parseLocalDate(invoice.invoice_date), 'MMM d, yyyy')}
                            </span>
                          )}
                          {invoice.due_date && (
                            <>
                              <span>•</span>
                              <span>Due {format(parseLocalDate(invoice.due_date), 'MMM d')}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(invoice.status)}
                      {getLinkTypeBadge(invoice.link_type)}
                      <div className="font-medium text-bone-white min-w-[90px] text-right">
                        {formatCurrency(invoice.total_amount, currency)}
                      </div>
                    </div>
                  </button>

                  {/* Invoice Details */}
                  {isInvoiceExpanded && hasLineItems && (
                    <div className="px-4 pb-4 space-y-2">
                      <div className="text-xs text-muted-gray font-medium uppercase tracking-wide mb-2">
                        Line Items
                      </div>
                      {invoice.line_items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between py-2 px-3 bg-charcoal-black/60 rounded"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-sm text-bone-white truncate">
                              {item.description || 'Line item'}
                            </span>
                            {item.quantity > 1 && (
                              <span className="text-xs text-muted-gray">
                                x{item.quantity}
                              </span>
                            )}
                            {item.scene_number && (
                              <Badge variant="outline" className="text-xs bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30">
                                Sc. {item.scene_number}
                              </Badge>
                            )}
                            {item.service_date && (
                              <span className="text-xs text-muted-gray">
                                • {format(parseLocalDate(item.service_date), 'MMM d')}
                              </span>
                            )}
                          </div>
                          <span className="text-sm text-bone-white font-medium">
                            {formatCurrency(item.amount, currency)}
                          </span>
                        </div>
                      ))}
                      {invoice.tax_amount > 0 && (
                        <div className="flex justify-between text-sm pt-2 border-t border-muted-gray/20">
                          <span className="text-muted-gray">Tax</span>
                          <span className="text-bone-white">
                            {formatCurrency(invoice.tax_amount, currency)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// Suggestions Panel
const SuggestionsPanel: React.FC<{
  productionDayId: string;
  dailyBudgetId: string;
  currency: string;
  onClose: () => void;
}> = ({ productionDayId, dailyBudgetId, currency, onClose }) => {
  const { data: suggestions, isLoading } = useSuggestedLineItems(productionDayId);
  const autoPopulate = useAutoPopulateDailyBudget();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleApply = async () => {
    if (selectedIds.length === 0) return;
    setIsApplying(true);
    try {
      await autoPopulate.mutateAsync({
        dailyBudgetId,
        lineItemIds: selectedIds,
      });
      onClose();
    } catch (err) {
      console.error('Failed to auto-populate:', err);
    } finally {
      setIsApplying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  if (!suggestions || suggestions.suggestions.length === 0) {
    return (
      <div className="text-center py-8">
        <Lightbulb className="w-10 h-10 text-muted-gray/30 mx-auto mb-3" />
        <p className="text-muted-gray">No suggestions available</p>
        <p className="text-sm text-muted-gray/70">
          Add line items to your budget or link crew to the call sheet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {suggestions.suggestions.map(({ line_item, match_reason, suggested_share }) => (
          <div
            key={line_item.id}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
              selectedIds.includes(line_item.id)
                ? 'bg-accent-yellow/10 border-accent-yellow/50'
                : 'bg-charcoal-black/40 border-muted-gray/20 hover:border-muted-gray/40'
            }`}
            onClick={() => toggleSelection(line_item.id)}
          >
            <Checkbox
              checked={selectedIds.includes(line_item.id)}
              onCheckedChange={() => toggleSelection(line_item.id)}
            />
            <div className="flex-1">
              <div className="font-medium text-bone-white">{line_item.description}</div>
              <div className="text-xs text-muted-gray">{match_reason}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-bone-white">
                {formatCurrency(suggested_share, currency)}
              </div>
              <div className="text-xs text-muted-gray">suggested</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleApply}
          disabled={selectedIds.length === 0 || isApplying}
          className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
        >
          {isApplying ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Add {selectedIds.length} Item{selectedIds.length !== 1 ? 's' : ''}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

// Detail View for a single daily budget
const DailyBudgetDetail: React.FC<{
  dailyBudget: BacklotDailyBudget;
  productionDayId: string;
  currency: string;
  canEdit: boolean;
  projectId: string;
  onBack: () => void;
}> = ({ dailyBudget, productionDayId, currency, canEdit, projectId, onBack }) => {
  const { data: items, isLoading: itemsLoading } = useDailyBudgetItems(dailyBudget.id);
  const { createItem, updateItem, deleteItem } = useDailyBudgetItemMutations(
    dailyBudget.id,
    projectId
  );
  const { data: budget } = useBudget(projectId);
  const { data: allLineItems } = useBudgetLineItems(budget?.id || null);
  const { data: laborCosts, isLoading: laborCostsLoading } = useDailyLaborCosts(dailyBudget.id, {
    includePending: true,
  });
  const { data: sceneCosts, isLoading: sceneCostsLoading } = useDailySceneCosts(dailyBudget.id);
  const { data: dailyInvoices, isLoading: invoicesLoading } = useDailyInvoices(dailyBudget.id, {
    includePending: true,
  });
  const { data: gearCosts, isLoading: gearCostsLoading } = useDailyGearCosts(dailyBudget.id);

  const [showItemModal, setShowItemModal] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingItem, setEditingItem] = useState<BacklotDailyBudgetItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [itemForm, setItemForm] = useState<DailyBudgetItemInput>({
    label: '',
    category_name: '',
    estimated_amount: 0,
    actual_amount: 0,
    vendor_name: '',
    notes: '',
    is_ad_hoc: true,
  });

  const isOverBudget = dailyBudget.variance > 0;
  const progressPercent = dailyBudget.estimated_total > 0
    ? Math.min((dailyBudget.actual_total / dailyBudget.estimated_total) * 100, 100)
    : 0;

  const handleOpenItemModal = (item?: BacklotDailyBudgetItem) => {
    if (item) {
      setEditingItem(item);
      setItemForm({
        label: item.label,
        category_name: item.category_name || '',
        estimated_amount: item.estimated_amount,
        actual_amount: item.actual_amount,
        vendor_name: item.vendor_name || '',
        notes: item.notes || '',
        is_ad_hoc: item.is_ad_hoc,
        budget_line_item_id: item.budget_line_item_id || undefined,
      });
    } else {
      setEditingItem(null);
      setItemForm({
        label: '',
        category_name: '',
        estimated_amount: 0,
        actual_amount: 0,
        vendor_name: '',
        notes: '',
        is_ad_hoc: true,
      });
    }
    setShowItemModal(true);
  };

  const handleSaveItem = async () => {
    setIsSubmitting(true);
    try {
      if (editingItem) {
        await updateItem.mutateAsync({
          itemId: editingItem.id,
          input: itemForm,
        });
      } else {
        await createItem.mutateAsync(itemForm);
      }
      setShowItemModal(false);
    } catch (err) {
      console.error('Failed to save item:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Delete this item?')) return;
    try {
      await deleteItem.mutateAsync(id);
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-heading text-bone-white">
              Day {dailyBudget.production_day?.day_number || '?'} Budget
            </h2>
            {isOverBudget && (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Over Budget
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-gray">
            {format(parseLocalDate(dailyBudget.date), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
          <div className="text-sm text-muted-gray mb-1">Estimated</div>
          <div className="text-2xl font-bold text-bone-white">
            {formatCurrency(dailyBudget.estimated_total, currency)}
          </div>
        </div>
        <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
          <div className="text-sm text-muted-gray mb-1">Actual</div>
          <div className="text-2xl font-bold text-bone-white">
            {formatCurrency(dailyBudget.actual_total, currency)}
          </div>
        </div>
        <div
          className={`bg-charcoal-black/50 border rounded-lg p-4 ${
            isOverBudget ? 'border-red-500/30' : 'border-green-500/30'
          }`}
        >
          <div className="text-sm text-muted-gray mb-1">Variance</div>
          <div
            className={`text-2xl font-bold flex items-center gap-2 ${
              isOverBudget ? 'text-red-400' : 'text-green-400'
            }`}
          >
            {isOverBudget ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            {formatCurrency(Math.abs(dailyBudget.variance), currency)}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-muted-gray">Spending Progress</span>
          <span className="text-sm text-bone-white">{progressPercent.toFixed(0)}%</span>
        </div>
        <Progress
          value={progressPercent}
          className={`h-2 ${isOverBudget ? '[&>div]:bg-red-500' : '[&>div]:bg-green-500'}`}
        />
      </div>

      {/* Items Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-bone-white">Budget Items</h3>
          {canEdit && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSuggestions(true)}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Smart Suggestions
              </Button>
              <Button
                size="sm"
                onClick={() => handleOpenItemModal()}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>
          )}
        </div>

        {itemsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : items && items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item) => (
              <DailyBudgetItemRow
                key={item.id}
                item={item}
                currency={currency}
                canEdit={canEdit}
                onEdit={handleOpenItemModal}
                onDelete={handleDeleteItem}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
            <DollarSign className="w-10 h-10 text-muted-gray/30 mx-auto mb-3" />
            <p className="text-muted-gray mb-2">No items yet</p>
            {canEdit && (
              <div className="space-x-2">
                <Button
                  variant="link"
                  className="text-accent-yellow"
                  onClick={() => setShowSuggestions(true)}
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  Use Smart Suggestions
                </Button>
                <span className="text-muted-gray">or</span>
                <Button
                  variant="link"
                  className="text-accent-yellow"
                  onClick={() => handleOpenItemModal()}
                >
                  Add Manually
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Labor Costs Section */}
      <LaborCostsSection
        laborCosts={laborCosts}
        isLoading={laborCostsLoading}
        currency={currency}
      />

      {/* Scene Costs Section */}
      <SceneCostsSection
        sceneCosts={sceneCosts}
        isLoading={sceneCostsLoading}
        currency={currency}
      />

      {/* Invoices Section */}
      <InvoicesSection
        invoices={dailyInvoices}
        isLoading={invoicesLoading}
        currency={currency}
      />

      {/* Gear Costs Section */}
      {gearCostsLoading ? (
        <Skeleton className="h-24" />
      ) : gearCosts && gearCosts.items.length > 0 && (
        <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-accent-yellow" />
              <h4 className="font-medium text-bone-white">
                Gear Costs
              </h4>
              <Badge variant="outline" className="text-xs">
                {gearCosts.items.length} items
              </Badge>
            </div>
            <span className="text-lg font-bold text-accent-yellow">
              {formatCurrency(gearCosts.gear_total, currency)}/day
            </span>
          </div>
          <div className="space-y-2">
            {gearCosts.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-2 border-b border-muted-gray/10 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-bone-white">{item.name}</span>
                  {item.category && (
                    <Badge variant="outline" className="text-xs">
                      {item.category}
                    </Badge>
                  )}
                  {item.source === 'manual_assignment' && (
                    <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">
                      Assigned
                    </Badge>
                  )}
                </div>
                <span className="text-sm text-muted-gray">
                  {formatCurrency(item.daily_cost, currency)}/day
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {dailyBudget.notes && (
        <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
          <h4 className="text-sm font-medium text-bone-white mb-2">Notes</h4>
          <p className="text-sm text-muted-gray whitespace-pre-wrap">{dailyBudget.notes}</p>
        </div>
      )}

      {/* Suggestions Dialog */}
      <Dialog open={showSuggestions} onOpenChange={setShowSuggestions}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent-yellow" />
              Smart Suggestions
            </DialogTitle>
            <DialogDescription>
              Based on your budget and call sheet, here are suggested items for this day.
            </DialogDescription>
          </DialogHeader>
          <SuggestionsPanel
            productionDayId={productionDayId}
            dailyBudgetId={dailyBudget.id}
            currency={currency}
            onClose={() => setShowSuggestions(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Item Modal */}
      <Dialog open={showItemModal} onOpenChange={setShowItemModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'Add Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Link to budget line item */}
            {allLineItems && allLineItems.length > 0 && (
              <div className="space-y-2">
                <Label>Link to Budget Line Item</Label>
                <Select
                  value={itemForm.budget_line_item_id || 'none'}
                  onValueChange={(v) => {
                    if (v === 'none') {
                      setItemForm({ ...itemForm, budget_line_item_id: undefined, is_ad_hoc: true });
                    } else {
                      const lineItem = allLineItems.find((li) => li.id === v);
                      if (lineItem) {
                        setItemForm({
                          ...itemForm,
                          budget_line_item_id: v,
                          is_ad_hoc: false,
                          label: lineItem.description,
                          category_name: lineItem.category?.name || '',
                          vendor_name: lineItem.vendor_name || '',
                        });
                      }
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select line item (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Ad-hoc item)</SelectItem>
                    {allLineItems.map((li) => (
                      <SelectItem key={li.id} value={li.id}>
                        {li.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="item-label">Label *</Label>
              <Input
                id="item-label"
                value={itemForm.label}
                onChange={(e) => setItemForm({ ...itemForm, label: e.target.value })}
                placeholder="e.g., Catering Lunch"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="estimated">Estimated</Label>
                <Input
                  id="estimated"
                  type="number"
                  min={0}
                  step={0.01}
                  value={itemForm.estimated_amount}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, estimated_amount: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actual">Actual</Label>
                <Input
                  id="actual"
                  type="number"
                  min={0}
                  step={0.01}
                  value={itemForm.actual_amount}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, actual_amount: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category-name">Category</Label>
                <Input
                  id="category-name"
                  value={itemForm.category_name}
                  onChange={(e) => setItemForm({ ...itemForm, category_name: e.target.value })}
                  placeholder="e.g., Catering"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor</Label>
                <Input
                  id="vendor"
                  value={itemForm.vendor_name}
                  onChange={(e) => setItemForm({ ...itemForm, vendor_name: e.target.value })}
                  placeholder="e.g., Local Deli"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-notes">Notes</Label>
              <Textarea
                id="item-notes"
                value={itemForm.notes}
                onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setShowItemModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveItem}
                disabled={isSubmitting || !itemForm.label}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : editingItem ? (
                  'Save Changes'
                ) : (
                  'Add Item'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Main Daily Budget View
const DailyBudgetView: React.FC<DailyBudgetViewProps> = ({ projectId, canEdit }) => {
  const { data: summaries, isLoading } = useDailyBudgets(projectId);
  const { data: budget } = useBudget(projectId);
  const { days, isLoading: daysLoading } = useProductionDays(projectId);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const { data: selectedDailyBudget, isLoading: dailyBudgetLoading, error: dailyBudgetError } = useDailyBudgetForDay(selectedDayId);

  const currency = budget?.currency || 'USD';

  // Merge production days with their daily budget summaries
  // This ensures we show ALL production days, not just ones with existing daily budgets
  const mergedDays = useMemo(() => {
    if (!days || days.length === 0) return [];

    // Create a map of existing daily budget summaries by production day
    const summaryMap = new Map<string, DailyBudgetSummary>();
    (summaries || []).forEach(s => {
      // Match by day_number and date
      const key = `${s.production_day_number}-${s.date}`;
      summaryMap.set(key, s);
    });

    // Map production days to display items, merging with existing summaries
    return days
      .filter(day => day.date) // Only show days with dates
      .sort((a, b) => parseLocalDate(a.date!).getTime() - parseLocalDate(b.date!).getTime())
      .map(day => {
        const key = `${day.day_number}-${day.date}`;
        const existingSummary = summaryMap.get(key);

        if (existingSummary) {
          return { ...existingSummary, productionDayId: day.id };
        }

        // Create a placeholder summary for days without daily budgets
        return {
          id: `placeholder-${day.id}`,
          date: day.date!,
          production_day_number: day.day_number,
          production_day_title: day.title,
          estimated_total: 0,
          actual_total: 0,
          variance: 0,
          variance_percent: 0,
          item_count: 0,
          receipt_count: 0,
          has_call_sheet: !!day.call_sheet_id,
          productionDayId: day.id,
          isPlaceholder: true,
        };
      });
  }, [days, summaries]);

  // Calculate totals from merged days (only count non-placeholders)
  const totals = mergedDays.reduce(
    (acc, s) => ({
      estimated: acc.estimated + s.estimated_total,
      actual: acc.actual + s.actual_total,
      variance: acc.variance + s.variance,
    }),
    { estimated: 0, actual: 0, variance: 0 }
  );

  if (isLoading || daysLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  // Show detail view if a day is selected
  if (selectedDayId) {
    // Loading state while fetching/creating daily budget
    if (dailyBudgetLoading) {
      return (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => setSelectedDayId(null)} className="mb-4">
            ← Back to Daily Budgets
          </Button>
          <div className="flex justify-between items-center">
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      );
    }

    // Error state
    if (dailyBudgetError) {
      return (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => setSelectedDayId(null)} className="mb-4">
            ← Back to Daily Budgets
          </Button>
          <div className="text-center py-12 bg-charcoal-black/50 border border-red-500/30 rounded-lg">
            <h3 className="text-lg font-medium text-bone-white mb-2">Failed to load daily budget</h3>
            <p className="text-muted-gray">
              {dailyBudgetError instanceof Error ? dailyBudgetError.message : 'An error occurred'}
            </p>
            <p className="text-sm text-muted-gray mt-2">
              Make sure a budget exists for this project first.
            </p>
          </div>
        </div>
      );
    }

    // Show detail if we have the daily budget
    if (selectedDailyBudget) {
      return (
        <DailyBudgetDetail
          dailyBudget={selectedDailyBudget}
          productionDayId={selectedDayId}
          currency={currency}
          canEdit={canEdit}
          projectId={projectId}
          onBack={() => setSelectedDayId(null)}
        />
      );
    }

    // Fallback - waiting for data or it returned null
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setSelectedDayId(null)} className="mb-4">
          ← Back to Daily Budgets
        </Button>
        <div className="text-center py-12 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
          <h3 className="text-lg font-medium text-bone-white mb-2">No daily budget available</h3>
          <p className="text-muted-gray">
            Create a main budget for this project first to enable daily budget tracking.
          </p>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-heading text-bone-white">Daily Budgets</h2>
        <p className="text-sm text-muted-gray">
          Track spending for each production day
        </p>
      </div>

      {/* Summary Cards */}
      {mergedDays.length > 0 && (totals.estimated > 0 || totals.actual > 0) && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
            <div className="text-sm text-muted-gray mb-1">Total Estimated</div>
            <div className="text-2xl font-bold text-bone-white">
              {formatCurrency(totals.estimated, currency)}
            </div>
          </div>
          <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
            <div className="text-sm text-muted-gray mb-1">Total Actual</div>
            <div className="text-2xl font-bold text-bone-white">
              {formatCurrency(totals.actual, currency)}
            </div>
          </div>
          <div
            className={`bg-charcoal-black/50 border rounded-lg p-4 ${
              totals.variance > 0 ? 'border-red-500/30' : 'border-green-500/30'
            }`}
          >
            <div className="text-sm text-muted-gray mb-1">Total Variance</div>
            <div
              className={`text-2xl font-bold ${
                totals.variance > 0 ? 'text-red-400' : 'text-green-400'
              }`}
            >
              {totals.variance >= 0 ? '+' : ''}
              {formatCurrency(totals.variance, currency)}
            </div>
          </div>
        </div>
      )}

      {/* Daily Budget List - shows all production days */}
      {mergedDays.length > 0 ? (
        <div className="space-y-3">
          {mergedDays.map((summary) => (
            <DailyBudgetCard
              key={summary.id}
              summary={summary as DailyBudgetSummary}
              currency={currency}
              onClick={() => {
                // Use the productionDayId we attached to the merged item
                const dayId = (summary as any).productionDayId;
                if (dayId) {
                  setSelectedDayId(dayId);
                }
              }}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
          <Calendar className="w-12 h-12 text-muted-gray/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-bone-white mb-2">No production days yet</h3>
          <p className="text-muted-gray max-w-md mx-auto">
            Add production days in the Schedule tab to track daily budgets.
          </p>
        </div>
      )}
    </div>
  );
};

export default DailyBudgetView;
