/**
 * BudgetView - Main budget management view for Backlot projects
 * Professional film/TV budget with Top Sheet, Detail, and Daily Budget sync
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  DollarSign,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Loader2,
  TrendingUp,
  TrendingDown,
  Lock,
  FileText,
  FolderOpen,
  Receipt,
  Calculator,
  Download,
  RefreshCw,
  FileSpreadsheet,
  CalendarDays,
  Layers,
  AlertCircle,
  CheckCircle2,
  Package,
  HelpCircle,
  BarChart3,
  Car,
  Briefcase,
  Utensils,
  FileCheck,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  Eye,
  StickyNote,
  Copy,
  GitCompareArrows,
} from 'lucide-react';
import { DialogFooter } from '@/components/ui/dialog';
import {
  useBudget,
  useBudgetSummary,
  useBudgetStats,
  useCreateBudget,
  useUpdateBudget,
  useLockBudget,
  useProjectBudgets,
  useDeleteBudget,
  useBudgetCategories,
  useBudgetCategoryMutations,
  useBudgetLineItems,
  useLineItemMutations,
  useBudgetTemplateTypes,
  useBudgetTemplatePreview,
  useCreateBudgetFromTemplate,
  useTopSheet,
  useComputeTopSheet,
  useSyncBudgetToDaily,
  useExportBudgetPdf,
  useExportBudgetHtml,
  useGearCosts,
  useSyncGearToBudget,
  useBudgetActuals,
  useTypedBudgets,
  useCloneBudget,
  type BudgetActual,
  type BudgetActualSourceDetails,
} from '@/hooks/backlot';
import { saveDraft, loadDraft, clearDraft as clearDraftStorage, buildDraftKey } from '@/lib/formDraftStorage';
import { BudgetCreationModal } from './BudgetCreationModal';
import BudgetDiffView from './BudgetDiffView';
import { BudgetDeleteConfirmDialog } from './BudgetDeleteConfirmDialog';
import { ActualDetailModal } from './ActualDetailModal';
import {
  BacklotBudget,
  BacklotBudgetCategory,
  BacklotBudgetLineItem,
  BacklotBudgetStatus,
  BacklotLineItemRateType,
  BacklotBudgetProjectType,
  BacklotCategoryType,
  BudgetInput,
  BudgetCategoryInput,
  BudgetLineItemInput,
  BUDGET_PROJECT_TYPE_LABELS,
  CATEGORY_TYPE_LABELS,
} from '@/types/backlot';

interface BudgetViewProps {
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

// Format percentage
const formatPercent = (value: number) => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

// Status badge colors
const getStatusBadge = (status: BacklotBudgetStatus) => {
  const styles: Record<BacklotBudgetStatus, string> = {
    draft: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30',
    pending_approval: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    approved: 'bg-green-500/20 text-green-400 border-green-500/30',
    locked: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    archived: 'bg-gray-500/20 text-gray-500 border-gray-500/30',
  };
  const labels: Record<BacklotBudgetStatus, string> = {
    draft: 'Draft',
    pending_approval: 'Pending Approval',
    approved: 'Approved',
    locked: 'Locked',
    archived: 'Archived',
  };
  return { style: styles[status], label: labels[status] };
};

// Rate type labels
const RATE_TYPE_LABELS: Record<BacklotLineItemRateType, string> = {
  flat: 'Flat',
  daily: 'Daily',
  weekly: 'Weekly',
  hourly: 'Hourly',
  per_unit: 'Per Unit',
};

// Top Sheet Section Component
const TopSheetSection: React.FC<{
  title: string;
  total: number;
  categories: Array<{ code: string | null; name: string; estimated: number; actual: number; variance: number }>;
  currency: string;
  isExpanded?: boolean;
}> = ({ title, total, categories, currency, isExpanded = true }) => {
  return (
    <div className="border border-muted-gray/20 rounded-lg overflow-hidden">
      <div className="bg-charcoal-black/50 px-4 py-3 flex items-center justify-between">
        <span className="font-medium text-bone-white">{title}</span>
        <span className="font-bold text-bone-white">{formatCurrency(total, currency)}</span>
      </div>
      {isExpanded && categories.length > 0 && (
        <div className="divide-y divide-muted-gray/10">
          {categories.map((cat, idx) => {
            const isOverBudget = cat.variance > 0;
            return (
              <div key={idx} className="px-4 py-2 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {cat.code && <span className="text-muted-gray">{cat.code}</span>}
                  <span className="text-bone-white">{cat.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-muted-gray">{formatCurrency(cat.estimated, currency)}</span>
                  <span
                    className={`min-w-[80px] text-right ${
                      isOverBudget ? 'text-red-400' : cat.variance < 0 ? 'text-green-400' : 'text-muted-gray'
                    }`}
                  >
                    {cat.variance !== 0 ? formatCurrency(cat.variance, currency) : '-'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Category Card
const CategoryCard: React.FC<{
  category: BacklotBudgetCategory;
  lineItems: BacklotBudgetLineItem[];
  currency: string;
  canEdit: boolean;
  isLocked: boolean;
  onEditCategory: (cat: BacklotBudgetCategory) => void;
  onDeleteCategory: (id: string) => void;
  onAddLineItem: (categoryId: string) => void;
  onEditLineItem: (item: BacklotBudgetLineItem) => void;
  onDeleteLineItem: (id: string) => void;
  onViewLineItemDetails: (item: BacklotBudgetLineItem) => void;
}> = ({
  category,
  lineItems,
  currency,
  canEdit,
  isLocked,
  onEditCategory,
  onDeleteCategory,
  onAddLineItem,
  onEditLineItem,
  onDeleteLineItem,
  onViewLineItemDetails,
}) => {
  const variance = category.actual_subtotal - category.estimated_subtotal;
  const variancePercent =
    category.estimated_subtotal > 0 ? (variance / category.estimated_subtotal) * 100 : 0;
  const isOverBudget = variance > 0;
  const progressPercent = category.estimated_subtotal > 0
    ? Math.min((category.actual_subtotal / category.estimated_subtotal) * 100, 100)
    : 0;

  return (
    <AccordionItem value={category.id} className="border-muted-gray/20">
      <AccordionTrigger className="hover:no-underline py-4 px-4 bg-charcoal-black/30 rounded-t-lg">
        <div className="flex items-center justify-between w-full pr-4">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: category.color || '#6b7280' }}
            />
            <div className="text-left">
              <h4 className="font-medium text-bone-white">{category.name}</h4>
              <div className="flex items-center gap-2 text-xs text-muted-gray">
                {category.code && <span>{category.code}</span>}
                {category.category_type && (
                  <Badge variant="outline" className="text-xs py-0">
                    {CATEGORY_TYPE_LABELS[category.category_type]}
                  </Badge>
                )}
                {category.is_taxable && (
                  <Badge variant="outline" className="text-xs py-0 text-accent-yellow border-accent-yellow/50">
                    +{((category.tax_rate || 0) * 100).toFixed(2)}% tax
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6 text-right">
            <div>
              <div className="text-sm text-muted-gray">Estimated</div>
              <div className="font-medium text-bone-white">
                {formatCurrency(category.estimated_subtotal, currency)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-gray">Actual</div>
              <div className="font-medium text-bone-white">
                {formatCurrency(category.actual_subtotal, currency)}
              </div>
            </div>
            <div className="min-w-[80px]">
              <div className="text-sm text-muted-gray">Variance</div>
              <div
                className={`font-medium ${
                  isOverBudget ? 'text-red-400' : variance < 0 ? 'text-green-400' : 'text-bone-white'
                }`}
              >
                {formatCurrency(variance, currency)}
              </div>
            </div>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="border-x border-b border-muted-gray/20 rounded-b-lg">
        {/* Progress bar */}
        <div className="px-4 py-2 bg-charcoal-black/20">
          <Progress
            value={progressPercent}
            className={`h-1.5 ${isOverBudget ? '[&>div]:bg-red-500' : '[&>div]:bg-green-500'}`}
          />
          <div className="flex justify-between mt-1 text-xs text-muted-gray">
            <span>{progressPercent.toFixed(0)}% spent</span>
            {isOverBudget && (
              <span className="text-red-400">
                {formatPercent(variancePercent)} over
              </span>
            )}
          </div>
        </div>

        {/* Line Items */}
        <div className="p-4 space-y-2">
          {lineItems.length > 0 ? (
            lineItems.map((item) => (
              <LineItemRow
                key={item.id}
                item={item}
                currency={currency}
                canEdit={canEdit && !isLocked}
                onEdit={onEditLineItem}
                onDelete={onDeleteLineItem}
                onViewDetails={onViewLineItemDetails}
              />
            ))
          ) : (
            <div className="text-center py-4 text-muted-gray text-sm">
              No line items in this category
            </div>
          )}

          {/* Add Line Item Button */}
          {canEdit && !isLocked && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full border border-dashed border-muted-gray/30 text-muted-gray hover:text-bone-white hover:border-muted-gray/50"
              onClick={() => onAddLineItem(category.id)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Line Item
            </Button>
          )}
        </div>

        {/* Category Actions */}
        {canEdit && !isLocked && (
          <div className="px-4 pb-4 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEditCategory(category)}
            >
              <Edit className="w-4 h-4 mr-1" />
              Edit Category
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-400 hover:text-red-300"
              onClick={() => onDeleteCategory(category.id)}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
};

// Line Item Row
const LineItemRow: React.FC<{
  item: BacklotBudgetLineItem;
  currency: string;
  canEdit: boolean;
  onEdit: (item: BacklotBudgetLineItem) => void;
  onDelete: (id: string) => void;
  onViewDetails: (item: BacklotBudgetLineItem) => void;
}> = ({ item, currency, canEdit, onEdit, onDelete, onViewDetails }) => {
  const variance = item.actual_total - item.estimated_total;
  const isOverBudget = variance > 0;
  const isTaxLineItem = item.is_tax_line_item;

  return (
    <div className={`flex items-center justify-between py-2 px-3 bg-charcoal-black/40 rounded-lg hover:bg-charcoal-black/60 transition-colors group ${isTaxLineItem ? 'opacity-75 border-l-2 border-accent-yellow/50' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isTaxLineItem ? (
            <div className="flex items-center gap-2 italic text-muted-gray">
              <Receipt className="w-3 h-3" />
              <span className="truncate">{item.description}</span>
              <span className="text-xs">(Auto-calculated)</span>
            </div>
          ) : (
            <>
              <span className="font-medium text-bone-white truncate">{item.description}</span>
              {item.is_locked && (
                <Lock className="w-3 h-3 text-muted-gray" />
              )}
              {item.account_code && (
                <Badge variant="outline" className="text-xs">
                  {item.account_code}
                </Badge>
              )}
            </>
          )}
        </div>
        {!isTaxLineItem && (
          <div className="text-xs text-muted-gray flex items-center gap-2">
            <span>
              {formatCurrency(item.rate_amount, currency)} × {item.quantity}{' '}
              {item.units || RATE_TYPE_LABELS[item.rate_type]}
            </span>
            {item.vendor_name && (
              <>
                <span>•</span>
                <span>{item.vendor_name}</span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right min-w-[100px]">
          <div className="text-sm text-bone-white">
            {formatCurrency(item.estimated_total, currency)}
          </div>
          <div className="text-xs text-muted-gray">estimated</div>
        </div>
        <div className="text-right min-w-[100px]">
          <div className="text-sm text-bone-white">
            {formatCurrency(item.actual_total, currency)}
          </div>
          <div className="text-xs text-muted-gray">actual</div>
        </div>
        <div className="text-right min-w-[80px]">
          <div
            className={`text-sm ${
              isOverBudget ? 'text-red-400' : variance < 0 ? 'text-green-400' : 'text-muted-gray'
            }`}
          >
            {variance !== 0 && (isOverBudget ? '+' : '')}
            {formatCurrency(variance, currency)}
          </div>
        </div>

        {/* Hide edit/delete menu for tax line items */}
        {canEdit && !isTaxLineItem && (
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
              <DropdownMenuItem onClick={() => onViewDetails(item)}>
                <Eye className="w-4 h-4 mr-2" />
                See Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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

// Source type icons
const getSourceIcon = (sourceType: string) => {
  switch (sourceType) {
    case 'mileage':
      return <Car className="w-4 h-4" />;
    case 'kit_rental':
      return <Briefcase className="w-4 h-4" />;
    case 'per_diem':
      return <Utensils className="w-4 h-4" />;
    case 'receipt':
      return <Receipt className="w-4 h-4" />;
    case 'purchase_order':
      return <FileCheck className="w-4 h-4" />;
    case 'invoice_line_item':
      return <FileText className="w-4 h-4" />;
    default:
      return <DollarSign className="w-4 h-4" />;
  }
};

// Source type labels
const SOURCE_TYPE_LABELS: Record<string, string> = {
  mileage: 'Mileage',
  kit_rental: 'Kit Rental',
  per_diem: 'Per Diem',
  receipt: 'Receipt',
  purchase_order: 'Purchase Order',
  invoice_line_item: 'Invoice Line Item',
  manual: 'Manual Entry',
};

// Actual Budget Item Row - shows individual actuals with source details
const ActualBudgetItemRow: React.FC<{
  actual: BudgetActual;
  currency: string;
  onViewSource: (actual: BudgetActual) => void;
}> = ({ actual, currency, onViewSource }) => {
  const sourceDetails = actual.source_details;

  // Build description based on source type
  const getSourceDescription = () => {
    if (!sourceDetails) return actual.description || 'No description';

    switch (actual.source_type) {
      case 'mileage':
        return `${sourceDetails.origin || ''} → ${sourceDetails.destination || ''} (${sourceDetails.miles || 0} mi)`;
      case 'kit_rental':
        return sourceDetails.kit_name || 'Kit Rental';
      case 'per_diem':
        return `${sourceDetails.per_diem_type || 'Per Diem'} - ${sourceDetails.days || 1} day(s)`;
      case 'receipt':
        return sourceDetails.vendor_name || actual.description || 'Receipt';
      case 'purchase_order':
        return `PO #${sourceDetails.po_number || 'N/A'} - ${sourceDetails.vendor || ''}`;
      case 'invoice_line_item':
        return `Invoice #${sourceDetails.invoice_number || 'N/A'} - ${sourceDetails.line_item_description || ''}`;
      default:
        return actual.description || 'Manual Entry';
    }
  };

  // Get crew member or vendor info
  const getSecondaryInfo = () => {
    if (!sourceDetails) return null;

    if (sourceDetails.crew_member_name) {
      return sourceDetails.crew_member_name;
    }
    if (sourceDetails.vendor_name) {
      return sourceDetails.vendor_name;
    }
    if (sourceDetails.vendor) {
      return sourceDetails.vendor;
    }
    return null;
  };

  return (
    <div className="flex items-center justify-between py-3 px-4 bg-charcoal-black/40 rounded-lg hover:bg-charcoal-black/60 transition-colors group">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`p-2 rounded-lg ${
          actual.source_type === 'mileage' ? 'bg-blue-500/20 text-blue-400' :
          actual.source_type === 'kit_rental' ? 'bg-purple-500/20 text-purple-400' :
          actual.source_type === 'per_diem' ? 'bg-green-500/20 text-green-400' :
          actual.source_type === 'receipt' ? 'bg-yellow-500/20 text-yellow-400' :
          actual.source_type === 'purchase_order' ? 'bg-orange-500/20 text-orange-400' :
          actual.source_type === 'invoice_line_item' ? 'bg-pink-500/20 text-pink-400' :
          'bg-muted-gray/20 text-muted-gray'
        }`}>
          {getSourceIcon(actual.source_type)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-bone-white truncate">{getSourceDescription()}</span>
            <Badge variant="outline" className="text-xs shrink-0">
              {SOURCE_TYPE_LABELS[actual.source_type] || actual.source_type}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-gray">
            {getSecondaryInfo() && <span>{getSecondaryInfo()}</span>}
            {actual.category_name && (
              <>
                {getSecondaryInfo() && <span>•</span>}
                <span>{actual.category_name}</span>
              </>
            )}
            <span>•</span>
            <span>{new Date(actual.recorded_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="font-medium text-bone-white">{formatCurrency(actual.amount, currency)}</div>
        </div>
        {actual.source_id && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100"
            onClick={() => onViewSource(actual)}
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

// Detailed Expense Row - shows full rate information from source
const DetailedExpenseRow: React.FC<{
  actual: BudgetActual;
  currency: string;
  onViewDetail?: (actualId: string) => void;
}> = ({ actual, currency, onViewDetail }) => {
  const sourceDetails = actual.source_details;

  // Format rate info based on source type
  const getRateDisplay = () => {
    if (!sourceDetails) return null;

    switch (actual.source_type) {
      case 'mileage':
        return {
          rate: `${formatCurrency(sourceDetails.rate_per_mile || 0, currency)}/mile`,
          quantity: `${sourceDetails.miles || 0} miles`,
          extra: sourceDetails.origin && sourceDetails.destination
            ? `${sourceDetails.origin} → ${sourceDetails.destination}`
            : null,
        };
      case 'kit_rental':
        const dailyRate = sourceDetails.daily_rate;
        const weeklyRate = sourceDetails.weekly_rate;
        const rentalType = sourceDetails.rental_type || 'daily';
        const days = sourceDetails.rental_days;
        const startDate = sourceDetails.start_date || sourceDetails.rental_start_date;
        const endDate = sourceDetails.end_date || sourceDetails.rental_end_date;

        // Build rate display based on rental type
        let rateStr: string | null = null;
        if (rentalType === 'flat') {
          rateStr = 'Flat rate';
        } else if (rentalType === 'weekly' && weeklyRate) {
          rateStr = `${formatCurrency(weeklyRate, currency)}/week`;
        } else if (dailyRate) {
          rateStr = `${formatCurrency(dailyRate, currency)}/day`;
        }

        return {
          rate: rateStr,
          quantity: days ? `${days} day(s)` : null,
          extra: rentalType === 'daily' && weeklyRate && weeklyRate > 0
            ? `Weekly: ${formatCurrency(weeklyRate, currency)}`
            : null,
          dates: startDate && endDate
            ? `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`
            : null,
        };
      case 'per_diem':
        return {
          rate: sourceDetails.daily_amount ? `${formatCurrency(sourceDetails.daily_amount, currency)}/day` : null,
          quantity: `${sourceDetails.days || 1} day(s)`,
          extra: sourceDetails.per_diem_type ? `Type: ${sourceDetails.per_diem_type}` : null,
        };
      case 'receipt':
        return {
          rate: null,
          quantity: null,
          extra: sourceDetails.vendor_name || null,
          dates: sourceDetails.purchase_date ? new Date(sourceDetails.purchase_date).toLocaleDateString() : null,
        };
      case 'purchase_order':
        return {
          rate: null,
          quantity: null,
          extra: sourceDetails.po_number ? `PO #${sourceDetails.po_number}` : null,
          dates: sourceDetails.order_date ? new Date(sourceDetails.order_date).toLocaleDateString() : null,
        };
      default:
        return null;
    }
  };

  const rateInfo = getRateDisplay();
  const description = sourceDetails?.kit_name || sourceDetails?.kit_description ||
    sourceDetails?.description || sourceDetails?.vendor_name ||
    actual.description || 'Expense';

  return (
    <div
      className={`flex items-center justify-between py-2 px-3 bg-charcoal-black/30 rounded hover:bg-charcoal-black/40 transition-colors text-sm ${
        onViewDetail ? 'cursor-pointer' : ''
      }`}
      onClick={() => onViewDetail?.(actual.id)}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`p-1.5 rounded ${
          actual.source_type === 'mileage' ? 'bg-blue-500/20 text-blue-400' :
          actual.source_type === 'kit_rental' ? 'bg-purple-500/20 text-purple-400' :
          actual.source_type === 'per_diem' ? 'bg-green-500/20 text-green-400' :
          actual.source_type === 'receipt' ? 'bg-yellow-500/20 text-yellow-400' :
          actual.source_type === 'purchase_order' ? 'bg-orange-500/20 text-orange-400' :
          'bg-muted-gray/20 text-muted-gray'
        }`}>
          {getSourceIcon(actual.source_type)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-bone-white truncate">{description}</div>
          <div className="flex items-center gap-2 text-xs text-muted-gray">
            {rateInfo?.rate && <span>{rateInfo.rate}</span>}
            {rateInfo?.rate && rateInfo?.quantity && <span>×</span>}
            {rateInfo?.quantity && <span>{rateInfo.quantity}</span>}
            {rateInfo?.dates && (
              <>
                {(rateInfo.rate || rateInfo.quantity) && <span>•</span>}
                <span>{rateInfo.dates}</span>
              </>
            )}
            {rateInfo?.extra && (
              <>
                <span>•</span>
                <span className="truncate">{rateInfo.extra}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="font-medium text-bone-white shrink-0 ml-2">
        {formatCurrency(actual.amount, currency)}
      </div>
    </div>
  );
};

// Submitter Actuals Group - groups expenses by submitter with "See Details" functionality
const SubmitterActualsGroup: React.FC<{
  submitterName: string;
  sourceType: string;
  actuals: BudgetActual[];
  currency: string;
  onViewActualDetail?: (actualId: string) => void;
}> = ({ submitterName, sourceType, actuals, currency, onViewActualDetail }) => {
  const [expanded, setExpanded] = useState(false);
  const totalAmount = actuals.reduce((sum, a) => sum + a.amount, 0);
  const displayName = submitterName.toLowerCase() === 'unknown' ? 'Unknown Submitter' : submitterName;
  const typeLabel = SOURCE_TYPE_LABELS[sourceType] || sourceType;

  // Get a summary description
  const getSummary = () => {
    if (actuals.length === 1) {
      const a = actuals[0];
      const sd = a.source_details;
      if (sd) {
        if (sourceType === 'kit_rental') {
          const parts = [];
          if (sd.kit_name) parts.push(sd.kit_name);
          // Show rate info
          if (sd.rental_type === 'flat') {
            parts.push('Flat rate');
          } else if (sd.daily_rate) {
            parts.push(`$${sd.daily_rate}/day`);
          }
          if (sd.rental_days) {
            parts.push(`${sd.rental_days} days`);
          }
          return parts.join(' • ') || 'Kit Rental';
        }
        if (sourceType === 'mileage') {
          return `${sd.miles || 0} miles @ $${sd.rate_per_mile || 0}/mi`;
        }
        if (sourceType === 'per_diem' && sd.per_diem_type) {
          return `${sd.per_diem_type} - ${sd.days || 1} day(s)`;
        }
      }
      return a.description || typeLabel;
    }
    // Multiple actuals - show total
    const totalDays = actuals.reduce((sum, a) => {
      if (sourceType === 'per_diem' && a.source_details?.days) {
        return sum + a.source_details.days;
      }
      return sum;
    }, 0);
    if (sourceType === 'per_diem' && totalDays > 0) {
      return `${totalDays} total day(s)`;
    }
    return `${actuals.length} ${typeLabel.toLowerCase()}${actuals.length > 1 ? 's' : ''}`;
  };

  return (
    <div className="border border-muted-gray/10 rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between py-3 px-4 bg-charcoal-black/30 cursor-pointer hover:bg-charcoal-black/40 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`p-2 rounded-lg ${
            sourceType === 'mileage' ? 'bg-blue-500/20 text-blue-400' :
            sourceType === 'kit_rental' ? 'bg-purple-500/20 text-purple-400' :
            sourceType === 'per_diem' ? 'bg-green-500/20 text-green-400' :
            sourceType === 'receipt' ? 'bg-yellow-500/20 text-yellow-400' :
            sourceType === 'purchase_order' ? 'bg-orange-500/20 text-orange-400' :
            sourceType === 'invoice_line_item' ? 'bg-pink-500/20 text-pink-400' :
            'bg-muted-gray/20 text-muted-gray'
          }`}>
            {getSourceIcon(sourceType)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-bone-white">
                {displayName}'s {typeLabel}
              </span>
              {actuals.length > 1 && (
                <Badge variant="outline" className="text-xs">
                  {actuals.length} entries
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-gray truncate">{getSummary()}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="font-medium text-bone-white">
            {formatCurrency(totalAmount, currency)}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-gray hover:text-bone-white"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            <Eye className="w-3 h-3 mr-1" />
            {expanded ? 'Hide' : 'See Details'}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="p-2 space-y-1 bg-charcoal-black/20">
          {actuals.map((actual) => (
            <DetailedExpenseRow
              key={actual.id}
              actual={actual}
              currency={currency}
              onViewDetail={onViewActualDetail}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Comparison Stats Component - shows estimated vs actual at top
const BudgetComparisonStats: React.FC<{
  estimatedTotal: number;
  actualTotal: number;
  currency: string;
  bySourceType?: Record<string, number>;
}> = ({ estimatedTotal, actualTotal, currency, bySourceType }) => {
  const variance = actualTotal - estimatedTotal;
  const variancePercent = estimatedTotal > 0 ? (variance / estimatedTotal) * 100 : 0;
  const isOverBudget = variance > 0;
  const spentPercent = estimatedTotal > 0 ? Math.min((actualTotal / estimatedTotal) * 100, 100) : 0;

  return (
    <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-bone-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-accent-yellow" />
          Budget Comparison
        </h3>
      </div>

      {/* Main comparison stats */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="bg-charcoal-black/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-gray mb-1">
            <Calculator className="w-4 h-4" />
            <span className="text-sm">Estimated Budget</span>
          </div>
          <div className="text-2xl font-bold text-bone-white">
            {formatCurrency(estimatedTotal, currency)}
          </div>
        </div>

        <div className="bg-charcoal-black/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-gray mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm">Actual Spent</span>
          </div>
          <div className="text-2xl font-bold text-bone-white">
            {formatCurrency(actualTotal, currency)}
          </div>
        </div>

        <div className={`rounded-lg p-4 ${
          isOverBudget ? 'bg-red-500/10 border border-red-500/30' : 'bg-green-500/10 border border-green-500/30'
        }`}>
          <div className="flex items-center gap-2 text-muted-gray mb-1">
            {isOverBudget ? (
              <TrendingUp className="w-4 h-4 text-red-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-green-400" />
            )}
            <span className="text-sm">Variance</span>
          </div>
          <div className={`text-2xl font-bold ${isOverBudget ? 'text-red-400' : 'text-green-400'}`}>
            {variance >= 0 ? '+' : ''}{formatCurrency(variance, currency)}
          </div>
          <div className="text-xs text-muted-gray mt-1">
            {formatPercent(variancePercent)} {isOverBudget ? 'over' : 'under'} budget
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-muted-gray mb-1">
          <span>Budget Utilization</span>
          <span>{spentPercent.toFixed(1)}%</span>
        </div>
        <Progress
          value={spentPercent}
          className={`h-2 ${isOverBudget ? '[&>div]:bg-red-500' : '[&>div]:bg-green-500'}`}
        />
      </div>

      {/* Breakdown by source type */}
      {bySourceType && Object.keys(bySourceType).length > 0 && (
        <div className="border-t border-muted-gray/20 pt-4 mt-4">
          <h4 className="text-sm font-medium text-muted-gray mb-3">Actual Spend by Type</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(bySourceType).map(([type, amount]) => (
              <div key={type} className="flex items-center gap-2 bg-charcoal-black/30 rounded-lg p-2">
                <span className="text-muted-gray">{getSourceIcon(type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-gray truncate">{SOURCE_TYPE_LABELS[type] || type}</div>
                  <div className="text-sm font-medium text-bone-white">{formatCurrency(amount, currency)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Budget Stats Cards
const BudgetStatsCards: React.FC<{
  budget: BacklotBudget;
  categories: BacklotBudgetCategory[];
  stats: {
    estimated_total: number;
    actual_total: number;
    variance: number;
    variance_percent: number;
    receipt_total: number;
    unmapped_receipt_total: number;
    categories_over_budget: number;
    categories_under_budget: number;
  } | null;
}> = ({ budget, categories, stats }) => {
  // Compute estimated total from categories for LIVE updates
  const computedEstimatedTotal = useMemo(() => {
    return categories.reduce((sum, cat) => sum + (cat.estimated_subtotal || 0), 0);
  }, [categories]);

  // Compute actual total from categories for LIVE updates
  const computedActualTotal = useMemo(() => {
    return categories.reduce((sum, cat) => sum + (cat.actual_subtotal || 0), 0);
  }, [categories]);

  // Use computed values for live updates
  const estimatedTotal = computedEstimatedTotal || budget.estimated_total;
  const actualTotal = computedActualTotal || budget.actual_total;

  // Compute contingency amount dynamically from the computed estimated total
  const contingencyPercent = budget.contingency_percent || 0;
  const contingencyAmount = estimatedTotal * (contingencyPercent / 100);

  const variance = actualTotal - estimatedTotal;
  const variancePercent = estimatedTotal > 0 ? (variance / estimatedTotal) * 100 : 0;
  const isOverBudget = variance > 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Estimated Total */}
      <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
        <div className="flex items-center gap-2 text-muted-gray mb-1">
          <Calculator className="w-4 h-4" />
          <span className="text-sm">Estimated</span>
        </div>
        <div className="text-2xl font-bold text-bone-white">
          {formatCurrency(estimatedTotal, budget.currency)}
        </div>
        {contingencyPercent > 0 && (
          <div className="text-xs text-muted-gray mt-1">
            +{contingencyPercent}% contingency ({formatCurrency(contingencyAmount, budget.currency)})
          </div>
        )}
      </div>

      {/* Actual Total */}
      <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
        <div className="flex items-center gap-2 text-muted-gray mb-1">
          <DollarSign className="w-4 h-4" />
          <span className="text-sm">Actual Spent</span>
        </div>
        <div className="text-2xl font-bold text-bone-white">
          {formatCurrency(actualTotal, budget.currency)}
        </div>
        {stats && stats.unmapped_receipt_total > 0 && (
          <div className="text-xs text-yellow-400 mt-1">
            +{formatCurrency(stats.unmapped_receipt_total)} unmapped
          </div>
        )}
      </div>

      {/* Variance */}
      <div
        className={`bg-charcoal-black/50 border rounded-lg p-4 ${
          isOverBudget ? 'border-red-500/30' : 'border-green-500/30'
        }`}
      >
        <div className="flex items-center gap-2 text-muted-gray mb-1">
          {isOverBudget ? (
            <TrendingUp className="w-4 h-4 text-red-400" />
          ) : (
            <TrendingDown className="w-4 h-4 text-green-400" />
          )}
          <span className="text-sm">Variance</span>
        </div>
        <div
          className={`text-2xl font-bold ${
            isOverBudget ? 'text-red-400' : 'text-green-400'
          }`}
        >
          {variance >= 0 ? '+' : ''}
          {formatCurrency(variance, budget.currency)}
        </div>
        <div className="text-xs text-muted-gray mt-1">
          {formatPercent(variancePercent)} {isOverBudget ? 'over' : 'under'} budget
        </div>
      </div>

      {/* Receipts */}
      <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
        <div className="flex items-center gap-2 text-muted-gray mb-1">
          <Receipt className="w-4 h-4" />
          <span className="text-sm">Receipts</span>
        </div>
        <div className="text-2xl font-bold text-bone-white">
          {formatCurrency(stats?.receipt_total || 0, budget.currency)}
        </div>
        {stats && stats.categories_over_budget > 0 && (
          <div className="text-xs text-red-400 mt-1">
            {stats.categories_over_budget} categories over budget
          </div>
        )}
      </div>
    </div>
  );
};

// Main Budget View Component
const BudgetView: React.FC<BudgetViewProps> = ({ projectId, canEdit }) => {
  const { data: budget, isLoading: budgetLoading, refetch: refetchBudget } = useBudget(projectId);
  const { data: summary, refetch: refetchSummary } = useBudgetSummary(projectId);
  const { data: stats, refetch: refetchStats } = useBudgetStats(projectId);
  const { data: topSheet, isLoading: topSheetLoading, refetch: refetchTopSheet } = useTopSheet(projectId);
  const { data: templateTypes } = useBudgetTemplateTypes();
  const { data: gearCosts } = useGearCosts(projectId);
  const syncGearToBudget = useSyncGearToBudget();

  // Multiple budgets support
  const { data: allBudgets } = useProjectBudgets(projectId);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);

  // Use selected budget or first available - fallback to allBudgets if budget is null
  const activeBudget = selectedBudgetId
    ? allBudgets?.find((b) => b.id === selectedBudgetId) || budget
    : (budget || allBudgets?.[0] || null);

  // Use activeBudget.id for queries to match the mutation invalidation keys
  const { data: categories, isLoading: categoriesLoading, refetch: refetchCategories } = useBudgetCategories(activeBudget?.id || null);
  const { data: lineItems, isLoading: lineItemsLoading, refetch: refetchLineItems } = useBudgetLineItems(activeBudget?.id || null);

  // Budget actuals with source details for Actual view
  const { data: budgetActualsData, isLoading: actualsLoading } = useBudgetActuals(projectId, {
    includeSourceDetails: true,
  });

  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const lockBudget = useLockBudget();
  const deleteBudget = useDeleteBudget();
  const createFromTemplate = useCreateBudgetFromTemplate();
  const computeTopSheet = useComputeTopSheet();
  const syncToDaily = useSyncBudgetToDaily();
  const exportPdf = useExportBudgetPdf();
  const exportHtml = useExportBudgetHtml();
  const { createCategory, updateCategory, deleteCategory } = useBudgetCategoryMutations(
    activeBudget?.id || null,
    projectId
  );
  const { createLineItem, updateLineItem, deleteLineItem } = useLineItemMutations(
    activeBudget?.id || null,
    projectId
  );

  // Typed budgets (estimate/actual/drafts)
  const { data: typedBudgets } = useTypedBudgets(projectId);
  const cloneBudget = useCloneBudget();
  const [showDiffView, setShowDiffView] = useState(false);

  // Modal states
  const [activeTab, setActiveTab] = useState('detail');
  const [budgetViewMode, setBudgetViewMode] = useState<'estimated' | 'actual'>('estimated');
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showLineItemModal, setShowLineItemModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showCreationModal, setShowCreationModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<BacklotBudgetCategory | null>(null);
  const [editingLineItem, setEditingLineItem] = useState<BacklotBudgetLineItem | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showTipsPanel, setShowTipsPanel] = useState(false);
  const [showLineItemDetailsModal, setShowLineItemDetailsModal] = useState(false);
  const [detailsLineItem, setDetailsLineItem] = useState<BacklotBudgetLineItem | null>(null);
  const [selectedActualId, setSelectedActualId] = useState<string | null>(null);
  const [showBudgetNotesModal, setShowBudgetNotesModal] = useState(false);
  const [budgetNotesForm, setBudgetNotesForm] = useState('');

  // Form states
  const [budgetForm, setBudgetForm] = useState<BudgetInput>({
    name: '',
    description: '',
    currency: 'USD',
    contingency_percent: 10,
    notes: '',
  });

  const [templateForm, setTemplateForm] = useState<{
    projectType: BacklotBudgetProjectType | '';
    shootDays: number;
    prepDays: number;
    wrapDays: number;
  }>({
    projectType: '',
    shootDays: 10,
    prepDays: 5,
    wrapDays: 2,
  });

  const [categoryForm, setCategoryForm] = useState<BudgetCategoryInput>({
    name: '',
    code: '',
    description: '',
    color: '#6b7280',
    is_taxable: false,
    tax_rate: 0,
  });

  const [lineItemForm, setLineItemForm] = useState<BudgetLineItemInput>({
    description: '',
    rate_type: 'flat',
    rate_amount: 0,
    quantity: 1,
    units: '',
    vendor_name: '',
    account_code: '',
    notes: '',
  });

  const isLocked = budget?.status === 'locked';

  // ── Draft persistence for category and line item forms ──
  const categoryDraftKey = buildDraftKey('backlot', 'budget-category', projectId);
  const lineItemDraftKey = buildDraftKey('backlot', 'budget-line-item', projectId);

  const categoryDefaults: BudgetCategoryInput = { name: '', code: '', description: '', color: '#6b7280', is_taxable: false, tax_rate: 0 };
  const lineItemDefaults: BudgetLineItemInput = { description: '', rate_type: 'flat', rate_amount: 0, quantity: 1, units: '', vendor_name: '', account_code: '', notes: '' };

  // Auto-save category form draft when modal is open in create mode
  useEffect(() => {
    if (!showCategoryModal || editingCategory) return;
    const isDefault = JSON.stringify(categoryForm) === JSON.stringify(categoryDefaults);
    if (isDefault) { clearDraftStorage(categoryDraftKey); return; }
    const timer = setTimeout(() => saveDraft(categoryDraftKey, categoryForm), 500);
    return () => clearTimeout(timer);
  }, [categoryForm, showCategoryModal, editingCategory]);

  // Auto-save line item form draft when modal is open in create mode
  useEffect(() => {
    if (!showLineItemModal || editingLineItem) return;
    const isDefault = JSON.stringify(lineItemForm) === JSON.stringify(lineItemDefaults);
    if (isDefault) { clearDraftStorage(lineItemDraftKey); return; }
    const timer = setTimeout(() => saveDraft(lineItemDraftKey, lineItemForm), 500);
    return () => clearTimeout(timer);
  }, [lineItemForm, showLineItemModal, editingLineItem]);

  // Create budget from template handler
  const handleCreateFromTemplate = async () => {
    if (!templateForm.projectType) return;
    setIsSubmitting(true);
    try {
      await createFromTemplate.mutateAsync({
        projectId,
        input: {
          project_id: projectId,
          project_type: templateForm.projectType,
          shoot_days: templateForm.shootDays,
          prep_days: templateForm.prepDays,
          wrap_days: templateForm.wrapDays,
        },
      });
      setShowTemplateModal(false);
    } catch (err) {
      console.error('Failed to create budget from template:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create budget handler
  const handleCreateBudget = async () => {
    setIsSubmitting(true);
    try {
      await createBudget.mutateAsync({ projectId, input: budgetForm });
      setShowBudgetModal(false);
    } catch (err) {
      console.error('Failed to create budget:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update budget handler
  const handleUpdateBudget = async () => {
    if (!activeBudget) return;
    setIsSubmitting(true);
    try {
      await updateBudget.mutateAsync({ projectId, budgetId: activeBudget.id, input: budgetForm });
      setShowBudgetModal(false);
    } catch (err) {
      console.error('Failed to update budget:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Lock budget handler
  const handleLockBudget = async () => {
    if (!confirm('Are you sure you want to lock this budget? This cannot be undone.')) return;
    try {
      await lockBudget.mutateAsync({ projectId });
    } catch (err) {
      console.error('Failed to lock budget:', err);
    }
  };

  // Delete budget handler (called from triple-confirmation dialog)
  const handleDeleteBudget = async () => {
    if (!activeBudget) return;
    setIsDeleting(true);
    try {
      await deleteBudget.mutateAsync({ budgetId: activeBudget.id, projectId });
      // Reset selected budget if we deleted it
      if (selectedBudgetId === activeBudget.id) {
        setSelectedBudgetId(null);
      }
    } catch (err) {
      console.error('Failed to delete budget:', err);
      throw err; // Re-throw so dialog can handle error state
    } finally {
      setIsDeleting(false);
    }
  };

  // Compute Top Sheet handler
  const handleComputeTopSheet = async () => {
    try {
      await computeTopSheet.mutateAsync({ projectId });
    } catch (err) {
      console.error('Failed to compute top sheet:', err);
    }
  };

  // Sync to daily budgets handler
  const handleSyncToDaily = async () => {
    setIsSubmitting(true);
    setSyncResult(null);
    try {
      const result = await syncToDaily.mutateAsync({
        projectId,
        config: { sync_mode: 'full', split_method: 'equal' },
      });
      setSyncResult({
        success: true,
        message: `Synced ${result.total_days_synced} days: ${result.total_items_created} items created, ${result.total_items_updated} updated`,
      });
    } catch (err) {
      setSyncResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to sync',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export handlers
  const handleExportPdf = async () => {
    if (!activeBudget) return;
    try {
      await exportPdf.mutateAsync({
        projectId,
        budgetId: activeBudget.id,
        options: {
          include_top_sheet: true,
          include_detail: true,
          show_actuals: true,
          show_variance: true,
        },
      });
    } catch (err) {
      console.error('Failed to export PDF:', err);
    }
  };

  const handleExportHtml = async () => {
    if (!activeBudget) return;
    try {
      await exportHtml.mutateAsync({
        projectId,
        budgetId: activeBudget.id,
        options: {
          include_top_sheet: true,
          include_detail: true,
          show_actuals: true,
          show_variance: true,
        },
      });
    } catch (err) {
      console.error('Failed to export HTML:', err);
    }
  };

  // Category handlers
  const handleOpenCategoryModal = (cat?: BacklotBudgetCategory) => {
    if (cat) {
      setEditingCategory(cat);
      setCategoryForm({
        name: cat.name,
        code: cat.code || '',
        description: cat.description || '',
        color: cat.color || '#6b7280',
        category_type: cat.category_type,
        is_taxable: cat.is_taxable || false,
        tax_rate: cat.tax_rate || 0,
      });
    } else {
      setEditingCategory(null);
      // Restore draft if available, otherwise use defaults
      const draft = loadDraft<BudgetCategoryInput>(categoryDraftKey);
      setCategoryForm(draft ? draft.data : { name: '', code: '', description: '', color: '#6b7280', is_taxable: false, tax_rate: 0 });
    }
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async () => {
    setIsSubmitting(true);
    try {
      if (editingCategory) {
        await updateCategory.mutateAsync({
          categoryId: editingCategory.id,
          input: categoryForm,
        });
      } else {
        await createCategory.mutateAsync(categoryForm);
      }
      clearDraftStorage(categoryDraftKey);
      setShowCategoryModal(false);
    } catch (err) {
      console.error('Failed to save category:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category and all its line items?')) return;
    try {
      await deleteCategory.mutateAsync(id);
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  };

  // Line item handlers
  const handleOpenLineItemModal = (categoryId: string, item?: BacklotBudgetLineItem) => {
    setSelectedCategoryId(categoryId);
    if (item) {
      setEditingLineItem(item);
      setLineItemForm({
        description: item.description,
        rate_type: item.rate_type,
        rate_amount: item.rate_amount,
        quantity: item.quantity,
        units: item.units || '',
        vendor_name: item.vendor_name || '',
        account_code: item.account_code || '',
        notes: item.notes || '',
      });
    } else {
      setEditingLineItem(null);
      // Restore draft if available, otherwise use defaults
      const draft = loadDraft<BudgetLineItemInput>(lineItemDraftKey);
      setLineItemForm(draft ? draft.data : {
        description: '',
        rate_type: 'flat',
        rate_amount: 0,
        quantity: 1,
        units: '',
        vendor_name: '',
        account_code: '',
        notes: '',
      });
    }
    setShowLineItemModal(true);
  };

  const handleSaveLineItem = async () => {
    setIsSubmitting(true);
    try {
      if (editingLineItem) {
        await updateLineItem.mutateAsync({
          lineItemId: editingLineItem.id,
          input: lineItemForm,
        });
      } else {
        await createLineItem.mutateAsync({
          ...lineItemForm,
          category_id: selectedCategoryId || undefined,
        });
      }
      // Force refetch all budget data to get updated totals
      await Promise.all([
        refetchCategories(),
        refetchLineItems(),
        refetchBudget(),
        refetchSummary(),
        refetchStats(),
        refetchTopSheet(),
      ]);
      clearDraftStorage(lineItemDraftKey);
      setShowLineItemModal(false);
    } catch (err) {
      console.error('Failed to save line item:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLineItem = async (id: string) => {
    if (!confirm('Delete this line item?')) return;
    try {
      await deleteLineItem.mutateAsync(id);
      // Force refetch all budget data to get updated totals
      await Promise.all([
        refetchCategories(),
        refetchLineItems(),
        refetchBudget(),
        refetchSummary(),
        refetchStats(),
        refetchTopSheet(),
      ]);
    } catch (err) {
      console.error('Failed to delete line item:', err);
    }
  };

  // Group line items by category, with tax line items always at the bottom
  const lineItemsByCategory = (categories || []).reduce((acc, cat) => {
    const categoryItems = (lineItems || []).filter((item) => item.category_id === cat.id);
    // Sort: regular items first (by sort_order), then tax line items at the end
    categoryItems.sort((a, b) => {
      if (a.is_tax_line_item && !b.is_tax_line_item) return 1;
      if (!a.is_tax_line_item && b.is_tax_line_item) return -1;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
    acc[cat.id] = categoryItems;
    return acc;
  }, {} as Record<string, BacklotBudgetLineItem[]>);

  // Sort categories alphabetically by name for stable display order
  const sortedCategories = useMemo(() => {
    return [...(categories || [])].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );
  }, [categories]);

  // Group categories by type for Top Sheet view
  const categoriesByType = (categories || []).reduce((acc, cat) => {
    const type = cat.category_type || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(cat);
    return acc;
  }, {} as Record<BacklotCategoryType, BacklotBudgetCategory[]>);

  // Show loading skeleton while budget or its dependent data is loading
  const isInitialLoading = budgetLoading || (budget && (categoriesLoading || lineItemsLoading));

  if (isInitialLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  // No budget yet - show create prompt (check activeBudget which includes allBudgets fallback)
  if (!activeBudget) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
          <DollarSign className="w-12 h-12 text-muted-gray/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-bone-white mb-2">No budget yet</h3>
          <p className="text-muted-gray mb-6 max-w-md mx-auto">
            Create a budget to track your production costs. Start from scratch, use department bundles,
            or select core essentials to get started quickly.
          </p>
          {canEdit && (
            <Button
              onClick={() => setShowCreationModal(true)}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Budget
            </Button>
          )}
        </div>

        {/* Budget Creation Modal - intentional flow with department bundles */}
        <BudgetCreationModal
          projectId={projectId}
          isOpen={showCreationModal}
          onClose={() => setShowCreationModal(false)}
          onSuccess={() => {
            setBudgetViewMode('estimated');
            setShowCreationModal(false);
          }}
        />

        {/* Template Selection Modal */}
        <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Budget from Template</DialogTitle>
              <DialogDescription>
                Choose a project type to get started with industry-standard budget categories.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="project-type">Project Type</Label>
                <Select
                  value={templateForm.projectType}
                  onValueChange={(v) => setTemplateForm({ ...templateForm, projectType: v as BacklotBudgetProjectType })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(templateTypes || ['feature', 'episodic', 'documentary', 'music_video', 'commercial', 'short']).map((type) => (
                      <SelectItem key={type} value={type}>
                        {BUDGET_PROJECT_TYPE_LABELS[type as BacklotBudgetProjectType] || type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shoot-days">Shoot Days</Label>
                  <Input
                    id="shoot-days"
                    type="number"
                    min={1}
                    value={templateForm.shootDays}
                    onChange={(e) => setTemplateForm({ ...templateForm, shootDays: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prep-days">Prep Days</Label>
                  <Input
                    id="prep-days"
                    type="number"
                    min={0}
                    value={templateForm.prepDays}
                    onChange={(e) => setTemplateForm({ ...templateForm, prepDays: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wrap-days">Wrap Days</Label>
                  <Input
                    id="wrap-days"
                    type="number"
                    min={0}
                    value={templateForm.wrapDays}
                    onChange={(e) => setTemplateForm({ ...templateForm, wrapDays: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="ghost" onClick={() => setShowTemplateModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateFromTemplate}
                  disabled={isSubmitting || !templateForm.projectType}
                  className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Budget'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Budget Modal */}
        <Dialog open={showBudgetModal} onOpenChange={setShowBudgetModal}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Budget</DialogTitle>
              <DialogDescription>
                Set up your production budget manually.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="budget-name">Budget Name</Label>
                <Input
                  id="budget-name"
                  value={budgetForm.name}
                  onChange={(e) => setBudgetForm({ ...budgetForm, name: e.target.value })}
                  placeholder="Production Budget"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={budgetForm.currency}
                    onValueChange={(v) => setBudgetForm({ ...budgetForm, currency: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="CAD">CAD ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contingency">Contingency %</Label>
                  <Input
                    id="contingency"
                    type="number"
                    min={0}
                    max={100}
                    value={budgetForm.contingency_percent}
                    onChange={(e) =>
                      setBudgetForm({ ...budgetForm, contingency_percent: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget-description">Description</Label>
                <Textarea
                  id="budget-description"
                  value={budgetForm.description}
                  onChange={(e) => setBudgetForm({ ...budgetForm, description: e.target.value })}
                  placeholder="Budget notes..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="ghost" onClick={() => setShowBudgetModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateBudget}
                  disabled={isSubmitting || !budgetForm.name}
                  className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Budget'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const statusBadge = getStatusBadge(activeBudget.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            {/* Budget selector when multiple budgets exist */}
            {allBudgets && allBudgets.length > 1 ? (
              <Select
                value={activeBudget.id}
                onValueChange={(id) => setSelectedBudgetId(id)}
              >
                <SelectTrigger className="w-auto min-w-[200px] h-auto py-1 text-2xl font-heading text-bone-white border-none bg-transparent hover:bg-muted-gray/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allBudgets.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <h2 className="text-2xl font-heading text-bone-white">{activeBudget.name}</h2>
            )}
            <Badge className={statusBadge.style}>{statusBadge.label}</Badge>
            {activeBudget.budget_type && (
              <Badge className={
                activeBudget.budget_type === 'actual' ? 'bg-green-600/20 text-green-400' :
                activeBudget.budget_type === 'draft' ? 'bg-zinc-600/20 text-zinc-400' :
                'bg-blue-600/20 text-blue-400'
              }>
                {activeBudget.budget_type === 'estimate' || activeBudget.budget_type === 'estimated' ? 'Estimate' :
                 activeBudget.budget_type === 'actual' ? 'Actual' : 'Draft'}
              </Badge>
            )}
            {activeBudget.project_type_template && activeBudget.project_type_template !== 'custom' && (
              <Badge variant="outline" className="text-xs">
                {BUDGET_PROJECT_TYPE_LABELS[activeBudget.project_type_template]}
              </Badge>
            )}
            {isLocked && <Lock className="w-4 h-4 text-blue-400" />}
            {allBudgets && allBudgets.length > 1 && (
              <Badge variant="outline" className="text-xs text-muted-gray">
                {allBudgets.length} budgets
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-gray">
            {activeBudget.description || 'Track and manage your production budget'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTipsPanel(true)}
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <HelpCircle className="w-4 h-4 mr-1" />
            Tips
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={exportPdf.isPending || exportHtml.isPending}
              >
                {(exportPdf.isPending || exportHtml.isPending) ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportPdf}>
                <FileText className="w-4 h-4 mr-2" />
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportHtml}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export as HTML
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canEdit && !isLocked && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBudgetForm({
                    name: activeBudget.name,
                    description: activeBudget.description || '',
                    currency: activeBudget.currency,
                    contingency_percent: activeBudget.contingency_percent,
                    notes: activeBudget.notes || '',
                    status: activeBudget.status,
                  });
                  setShowBudgetModal(true);
                }}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleOpenCategoryModal()}>
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Add Category
                  </DropdownMenuItem>
                  {/* Hidden for now - Daily Budgets sync
                  <DropdownMenuItem onClick={() => setShowSyncModal(true)}>
                    <CalendarDays className="w-4 h-4 mr-2" />
                    Sync to Daily Budgets
                  </DropdownMenuItem>
                  */}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowCreationModal(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Budget
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      if (activeBudget?.id) {
                        cloneBudget.mutate({ budgetId: activeBudget.id });
                      }
                    }}
                    disabled={cloneBudget.isPending}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    {cloneBudget.isPending ? 'Cloning...' : 'Clone Budget'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowDiffView(!showDiffView)}>
                    <GitCompareArrows className="w-4 h-4 mr-2" />
                    Compare Budgets
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLockBudget}
                    className="text-blue-400"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Lock Budget
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteModal(true)}
                    className="text-red-400 focus:text-red-400"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Budget
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <BudgetStatsCards budget={activeBudget} categories={categories || []} stats={stats || null} />

      {/* Budget Diff View */}
      {showDiffView && (
        <BudgetDiffView
          projectId={projectId}
          initialBudgetAId={typedBudgets?.estimate?.id}
          initialBudgetBId={typedBudgets?.actual?.id}
          onClose={() => setShowDiffView(false)}
        />
      )}

      {/* Gear Costs Section */}
      {gearCosts && gearCosts.total_cost > 0 && (
        <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-accent-yellow" />
              <h3 className="text-lg font-medium text-bone-white">Gear Costs</h3>
            </div>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await syncGearToBudget.mutateAsync({ projectId });
                  } catch (err) {
                    console.error('Failed to sync gear:', err);
                  }
                }}
                disabled={syncGearToBudget.isPending}
              >
                {syncGearToBudget.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Sync to Budget
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-gray">Rental Total</span>
              <p className="text-bone-white font-medium">${gearCosts.total_rental_cost.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-muted-gray">Owned Equipment</span>
              <p className="text-bone-white font-medium">${gearCosts.total_purchase_cost.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-muted-gray">Total Gear Cost</span>
              <p className="text-accent-yellow font-medium">${gearCosts.total_cost.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-muted-gray">Items</span>
              <p className="text-bone-white font-medium">{gearCosts.items.length} items</p>
            </div>
          </div>
          {Object.keys(gearCosts.by_category).length > 0 && (
            <div className="mt-3 pt-3 border-t border-muted-gray/20">
              <span className="text-xs text-muted-gray">By Category:</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {Object.entries(gearCosts.by_category).map(([cat, data]) => (
                  <Badge key={cat} variant="outline" className="text-xs">
                    {cat}: ${(data.rental_cost + data.purchase_cost).toLocaleString()} ({data.count})
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList className="bg-charcoal-black/50 border border-muted-gray/20">
            <TabsTrigger value="detail" className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
              <Layers className="w-4 h-4 mr-2" />
              Detail
            </TabsTrigger>
            <TabsTrigger value="top-sheet" className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
              <FileText className="w-4 h-4 mr-2" />
              Top Sheet
            </TabsTrigger>
          </TabsList>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setBudgetNotesForm(activeBudget?.notes || '');
              setShowBudgetNotesModal(true);
            }}
            className={activeBudget?.notes ? 'border-accent-yellow/50 text-accent-yellow' : ''}
          >
            <StickyNote className="w-4 h-4 mr-2" />
            Budget Notes
            {activeBudget?.notes && <span className="ml-1 text-xs">(has notes)</span>}
          </Button>
        </div>

        {/* Detail Tab */}
        <TabsContent value="detail" className="space-y-4 mt-4">
          {/* View Toggle - Estimated vs Actual */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-muted-gray/20 p-1 bg-charcoal-black/50">
                <Button
                  variant={budgetViewMode === 'estimated' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setBudgetViewMode('estimated')}
                  className={budgetViewMode === 'estimated'
                    ? 'bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90'
                    : 'text-muted-gray hover:text-bone-white'}
                >
                  <Calculator className="w-4 h-4 mr-2" />
                  Estimated
                </Button>
                <Button
                  variant={budgetViewMode === 'actual' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setBudgetViewMode('actual')}
                  className={budgetViewMode === 'actual'
                    ? 'bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90'
                    : 'text-muted-gray hover:text-bone-white'}
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Actual
                </Button>
              </div>
              <span className="text-sm text-muted-gray">
                {budgetViewMode === 'actual' ? 'Synced expenses and spending' : 'Planned budget categories and line items'}
              </span>
            </div>
            {canEdit && !isLocked && budgetViewMode === 'estimated' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenCategoryModal()}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Category
              </Button>
            )}
          </div>

          {/* Estimated Budget View - categories and line items you create */}
          {budgetViewMode === 'estimated' && (
            <>
              {sortedCategories && sortedCategories.length > 0 ? (
                <Accordion type="multiple" className="space-y-2">
                  {sortedCategories.map((cat) => (
                    <CategoryCard
                      key={cat.id}
                      category={cat}
                      lineItems={lineItemsByCategory[cat.id] || []}
                      currency={activeBudget.currency}
                      canEdit={canEdit}
                      isLocked={isLocked}
                      onEditCategory={handleOpenCategoryModal}
                      onDeleteCategory={handleDeleteCategory}
                      onAddLineItem={(catId) => handleOpenLineItemModal(catId)}
                      onEditLineItem={(item) => handleOpenLineItemModal(item.category_id || '', item)}
                      onDeleteLineItem={handleDeleteLineItem}
                      onViewLineItemDetails={(item) => {
                        setDetailsLineItem(item);
                        setShowLineItemDetailsModal(true);
                      }}
                    />
                  ))}
                </Accordion>
              ) : (
                <div className="text-center py-8 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
                  <FolderOpen className="w-10 h-10 text-muted-gray/30 mx-auto mb-3" />
                  <p className="text-muted-gray">No categories yet</p>
                  {canEdit && !isLocked && (
                    <Button
                      variant="link"
                      className="text-accent-yellow"
                      onClick={() => handleOpenCategoryModal()}
                    >
                      Add your first category
                    </Button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Actual Budget View - shows expenses with source details */}
          {budgetViewMode === 'actual' && (
            <>
              {actualsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : budgetActualsData?.actuals && budgetActualsData.actuals.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm text-muted-gray">
                      {budgetActualsData.actuals.length} expense{budgetActualsData.actuals.length !== 1 ? 's' : ''} recorded
                    </h4>
                    <div className="text-sm text-bone-white font-medium">
                      Total: {formatCurrency(budgetActualsData.total_amount, activeBudget.currency)}
                    </div>
                  </div>

                  {/* Group actuals by category > submitter > source_type */}
                  {(() => {
                    // Group by category, then by submitter+source_type within each category
                    type SubmitterGroup = {
                      submitterName: string;
                      sourceType: string;
                      actuals: BudgetActual[];
                    };
                    type CategoryGroup = {
                      categoryName: string;
                      totalAmount: number;
                      submitterGroups: SubmitterGroup[];
                    };

                    const categoryMap = new Map<string, CategoryGroup>();

                    budgetActualsData.actuals.forEach((actual) => {
                      const catName = actual.category_name || 'Uncategorized';
                      const submitterName = actual.submitter_full_name || actual.submitter_name || 'Unknown';
                      const sourceType = actual.source_type || 'manual';
                      const groupKey = `${submitterName}:${sourceType}`;

                      if (!categoryMap.has(catName)) {
                        categoryMap.set(catName, {
                          categoryName: catName,
                          totalAmount: 0,
                          submitterGroups: [],
                        });
                      }

                      const category = categoryMap.get(catName)!;
                      category.totalAmount += actual.amount;

                      let submitterGroup = category.submitterGroups.find(
                        (g) => g.submitterName === submitterName && g.sourceType === sourceType
                      );

                      if (!submitterGroup) {
                        submitterGroup = { submitterName, sourceType, actuals: [] };
                        category.submitterGroups.push(submitterGroup);
                      }

                      submitterGroup.actuals.push(actual);
                    });

                    const categories = Array.from(categoryMap.values());

                    return categories.map((category) => (
                      <div key={category.categoryName} className="border border-muted-gray/20 rounded-lg overflow-hidden">
                        <div className="bg-charcoal-black/50 px-4 py-3 flex items-center justify-between">
                          <span className="font-medium text-bone-white">{category.categoryName}</span>
                          <span className="font-medium text-bone-white">
                            {formatCurrency(category.totalAmount, activeBudget.currency)}
                          </span>
                        </div>
                        <div className="p-2 space-y-2">
                          {category.submitterGroups.map((group) => (
                            <SubmitterActualsGroup
                              key={`${group.submitterName}:${group.sourceType}`}
                              submitterName={group.submitterName}
                              sourceType={group.sourceType}
                              actuals={group.actuals}
                              currency={activeBudget.currency}
                              onViewActualDetail={setSelectedActualId}
                            />
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <div className="text-center py-8 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
                  <Receipt className="w-10 h-10 text-muted-gray/30 mx-auto mb-3" />
                  <p className="text-muted-gray mb-2">No actual expenses recorded yet</p>
                  <p className="text-xs text-muted-gray max-w-md mx-auto">
                    Expenses are automatically recorded when receipts, mileage, kit rentals, per diem,
                    purchase orders, and invoices are approved.
                  </p>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Top Sheet Tab */}
        <TabsContent value="top-sheet" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-bone-white">Top Sheet Summary</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={handleComputeTopSheet}
              disabled={computeTopSheet.isPending}
            >
              {computeTopSheet.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>

          {topSheetLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          ) : topSheet ? (
            <div className="space-y-4">
              {topSheet.is_stale && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-center gap-2 text-yellow-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  Top sheet may be out of date. Click Refresh to update.
                </div>
              )}

              <TopSheetSection
                title="ABOVE THE LINE"
                total={topSheet.above_the_line.total}
                categories={topSheet.above_the_line.categories}
                currency={activeBudget.currency}
              />

              <TopSheetSection
                title="PRODUCTION"
                total={topSheet.production.total}
                categories={topSheet.production.categories}
                currency={activeBudget.currency}
              />

              <TopSheetSection
                title="POST-PRODUCTION"
                total={topSheet.post.total}
                categories={topSheet.post.categories}
                currency={activeBudget.currency}
              />

              <TopSheetSection
                title="OTHER / INDIRECT"
                total={topSheet.other.total}
                categories={topSheet.other.categories}
                currency={activeBudget.currency}
              />

              {/* Totals */}
              <div className="border border-muted-gray/30 rounded-lg overflow-hidden">
                <div className="bg-charcoal-black/70 px-4 py-3 flex items-center justify-between">
                  <span className="text-muted-gray">SUBTOTAL</span>
                  <span className="font-bold text-bone-white">{formatCurrency(topSheet.subtotal, activeBudget.currency)}</span>
                </div>
                <div className="px-4 py-2 flex items-center justify-between text-sm border-t border-muted-gray/20">
                  <span className="text-muted-gray">Contingency ({topSheet.contingency_percent}%)</span>
                  <span className="text-bone-white">{formatCurrency(topSheet.contingency_amount, activeBudget.currency)}</span>
                </div>
                {topSheet.fringes_total > 0 && (
                  <div className="px-4 py-2 flex items-center justify-between text-sm border-t border-muted-gray/20">
                    <span className="text-muted-gray">Fringes</span>
                    <span className="text-bone-white">{formatCurrency(topSheet.fringes_total, activeBudget.currency)}</span>
                  </div>
                )}
                <div className="bg-accent-yellow px-4 py-3 flex items-center justify-between">
                  <span className="font-bold text-charcoal-black">GRAND TOTAL</span>
                  <span className="font-bold text-charcoal-black text-lg">{formatCurrency(topSheet.grand_total, activeBudget.currency)}</span>
                </div>
              </div>

              <div className="text-xs text-muted-gray text-right">
                Last computed: {new Date(topSheet.last_computed).toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
              <FileText className="w-10 h-10 text-muted-gray/30 mx-auto mb-3" />
              <p className="text-muted-gray mb-4">No top sheet data yet</p>
              <Button
                variant="outline"
                onClick={handleComputeTopSheet}
                disabled={computeTopSheet.isPending}
              >
                {computeTopSheet.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Generate Top Sheet
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Budget Modal */}
      <Dialog open={showBudgetModal} onOpenChange={setShowBudgetModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Budget</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="budget-name">Budget Name</Label>
              <Input
                id="budget-name"
                value={budgetForm.name}
                onChange={(e) => setBudgetForm({ ...budgetForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={budgetForm.currency}
                  onValueChange={(v) => setBudgetForm({ ...budgetForm, currency: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="CAD">CAD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contingency">Contingency %</Label>
                <Input
                  id="contingency"
                  type="number"
                  min={0}
                  max={100}
                  value={budgetForm.contingency_percent}
                  onChange={(e) =>
                    setBudgetForm({ ...budgetForm, contingency_percent: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={budgetForm.status}
                onValueChange={(v) => setBudgetForm({ ...budgetForm, status: v as BacklotBudgetStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending_approval">Pending Approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget-description">Description</Label>
              <Textarea
                id="budget-description"
                value={budgetForm.description}
                onChange={(e) => setBudgetForm({ ...budgetForm, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setShowBudgetModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdateBudget}
                disabled={isSubmitting}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Modal */}
      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Edit Category' : 'Add Category'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4 overflow-y-auto flex-1 pr-2">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Name *</Label>
              <Input
                id="cat-name"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="e.g., Talent"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cat-code">Code</Label>
                <Input
                  id="cat-code"
                  value={categoryForm.code}
                  onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })}
                  placeholder="e.g., 100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-type">Category Type</Label>
                <Select
                  value={categoryForm.category_type || ''}
                  onValueChange={(v) => setCategoryForm({ ...categoryForm, category_type: v as BacklotCategoryType })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="above_the_line">Above the Line</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="post">Post-Production</SelectItem>
                    <SelectItem value="other">Other/Indirect</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-color">Color</Label>
              <Input
                id="cat-color"
                type="color"
                value={categoryForm.color}
                onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                className="h-10 px-2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">Description</Label>
              <Textarea
                id="cat-desc"
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                rows={2}
              />
            </div>
            {/* Sales Tax Section */}
            <div className="space-y-3 pt-3 border-t border-muted-gray/20">
              <div className="flex items-center justify-between">
                <Label htmlFor="cat-taxable" className="text-sm">Include Sales Tax</Label>
                <Switch
                  id="cat-taxable"
                  checked={categoryForm.is_taxable || false}
                  onCheckedChange={(checked) => setCategoryForm({
                    ...categoryForm,
                    is_taxable: checked,
                    tax_rate: checked ? (categoryForm.tax_rate || 0.0825) : 0
                  })}
                />
              </div>

              {categoryForm.is_taxable && (
                <div className="space-y-2">
                  <Label htmlFor="cat-tax-rate">Tax Rate (%)</Label>
                  <Input
                    id="cat-tax-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={((categoryForm.tax_rate || 0) * 100).toFixed(2)}
                    onChange={(e) => setCategoryForm({
                      ...categoryForm,
                      tax_rate: parseFloat(e.target.value) / 100 || 0
                    })}
                    placeholder="e.g., 8.25"
                  />
                  <p className="text-xs text-muted-gray">
                    Tax will be calculated on the sum of all line items
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setShowCategoryModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveCategory}
                disabled={isSubmitting || !categoryForm.name}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : editingCategory ? (
                  'Save Changes'
                ) : (
                  'Add Category'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Line Item Modal */}
      <Dialog open={showLineItemModal} onOpenChange={setShowLineItemModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingLineItem ? 'Edit Line Item' : 'Add Line Item'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="item-desc">Description *</Label>
              <Input
                id="item-desc"
                value={lineItemForm.description}
                onChange={(e) => setLineItemForm({ ...lineItemForm, description: e.target.value })}
                placeholder="e.g., Lead Actor"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rate-type">Rate Type</Label>
                <Select
                  value={lineItemForm.rate_type}
                  onValueChange={(v) =>
                    setLineItemForm({ ...lineItemForm, rate_type: v as BacklotLineItemRateType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RATE_TYPE_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rate-amount">Rate</Label>
                <Input
                  id="rate-amount"
                  type="number"
                  min={0}
                  step={0.01}
                  value={lineItemForm.rate_amount === 0 ? '' : lineItemForm.rate_amount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLineItemForm({ ...lineItemForm, rate_amount: val === '' ? 0 : parseFloat(val) || 0 });
                  }}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={0}
                  step={0.5}
                  value={lineItemForm.quantity === 0 ? '' : lineItemForm.quantity}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLineItemForm({ ...lineItemForm, quantity: val === '' ? 0 : parseFloat(val) || 0 });
                  }}
                  placeholder="1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="units">Units</Label>
                <Input
                  id="units"
                  value={lineItemForm.units}
                  onChange={(e) => setLineItemForm({ ...lineItemForm, units: e.target.value })}
                  placeholder="e.g., days, hours"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-code">Account Code</Label>
                <Input
                  id="account-code"
                  value={lineItemForm.account_code}
                  onChange={(e) => setLineItemForm({ ...lineItemForm, account_code: e.target.value })}
                  placeholder="e.g., 101-01"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor</Label>
              <Input
                id="vendor"
                value={lineItemForm.vendor_name}
                onChange={(e) => setLineItemForm({ ...lineItemForm, vendor_name: e.target.value })}
                placeholder="e.g., Talent Agency LLC"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-notes">Notes</Label>
              <Textarea
                id="item-notes"
                value={lineItemForm.notes}
                onChange={(e) => setLineItemForm({ ...lineItemForm, notes: e.target.value })}
                rows={2}
              />
            </div>

            {/* Estimated total preview */}
            <div className="bg-charcoal-black/30 rounded-lg p-3 flex justify-between items-center">
              <span className="text-muted-gray">Estimated Total</span>
              <span className="text-lg font-bold text-bone-white">
                {formatCurrency(
                  (lineItemForm.rate_amount || 0) * (lineItemForm.quantity || 1),
                  activeBudget.currency
                )}
              </span>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setShowLineItemModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveLineItem}
                disabled={isSubmitting || !lineItemForm.description}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : editingLineItem ? (
                  'Save Changes'
                ) : (
                  'Add Line Item'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Line Item Details Modal */}
      <Dialog open={showLineItemDetailsModal} onOpenChange={setShowLineItemDetailsModal}>
        <DialogContent className="bg-deep-black border-muted-gray/30 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-bone-white">
              {detailsLineItem?.description || 'Line Item Details'}
            </DialogTitle>
          </DialogHeader>

          {detailsLineItem && activeBudget && (
            <div className="space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Financial Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-charcoal-black/50 p-4 rounded-lg">
                  <div className="text-sm text-muted-gray">Estimated</div>
                  <div className="text-xl font-bold text-bone-white">
                    {formatCurrency(detailsLineItem.estimated_total, activeBudget.currency)}
                  </div>
                </div>
                <div className="bg-charcoal-black/50 p-4 rounded-lg">
                  <div className="text-sm text-muted-gray">Actual</div>
                  <div className="text-xl font-bold text-bone-white">
                    {formatCurrency(detailsLineItem.actual_total, activeBudget.currency)}
                  </div>
                </div>
                <div className="bg-charcoal-black/50 p-4 rounded-lg">
                  <div className="text-sm text-muted-gray">Variance</div>
                  <div className={`text-xl font-bold ${
                    detailsLineItem.actual_total > detailsLineItem.estimated_total
                      ? 'text-red-400'
                      : detailsLineItem.actual_total < detailsLineItem.estimated_total
                        ? 'text-green-400'
                        : 'text-bone-white'
                  }`}>
                    {formatCurrency(detailsLineItem.actual_total - detailsLineItem.estimated_total, activeBudget.currency)}
                  </div>
                </div>
              </div>

              {/* Rate Details */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-gray">Rate Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-bone-white">
                    <span className="text-muted-gray">Rate Type: </span>
                    {RATE_TYPE_LABELS[detailsLineItem.rate_type] || detailsLineItem.rate_type}
                  </div>
                  <div className="text-bone-white">
                    <span className="text-muted-gray">Rate: </span>
                    {formatCurrency(detailsLineItem.rate_amount, activeBudget.currency)}
                  </div>
                  <div className="text-bone-white">
                    <span className="text-muted-gray">Quantity: </span>
                    {detailsLineItem.quantity} {detailsLineItem.units || RATE_TYPE_LABELS[detailsLineItem.rate_type]}
                  </div>
                  {detailsLineItem.vendor_name && (
                    <div className="text-bone-white">
                      <span className="text-muted-gray">Vendor: </span>
                      {detailsLineItem.vendor_name}
                    </div>
                  )}
                </div>
              </div>

              {/* References */}
              {(detailsLineItem.po_number || detailsLineItem.invoice_reference || detailsLineItem.account_code) && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-gray">References</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {detailsLineItem.account_code && (
                      <div className="text-bone-white">
                        <span className="text-muted-gray">Account: </span>
                        {detailsLineItem.account_code}
                      </div>
                    )}
                    {detailsLineItem.po_number && (
                      <div className="text-bone-white">
                        <span className="text-muted-gray">PO #: </span>
                        {detailsLineItem.po_number}
                      </div>
                    )}
                    {detailsLineItem.invoice_reference && (
                      <div className="text-bone-white">
                        <span className="text-muted-gray">Invoice: </span>
                        {detailsLineItem.invoice_reference}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {(detailsLineItem.notes || detailsLineItem.internal_notes) && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-gray">Notes</h4>
                  {detailsLineItem.notes && (
                    <p className="text-sm text-bone-white">{detailsLineItem.notes}</p>
                  )}
                  {detailsLineItem.internal_notes && (
                    <p className="text-sm text-muted-gray italic">{detailsLineItem.internal_notes}</p>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLineItemDetailsModal(false)}>
              Close
            </Button>
            {canEdit && !isLocked && detailsLineItem && (
              <Button
                onClick={() => {
                  setShowLineItemDetailsModal(false);
                  handleOpenLineItemModal(detailsLineItem.category_id || '', detailsLineItem);
                }}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Budget Notes Modal */}
      <Dialog open={showBudgetNotesModal} onOpenChange={setShowBudgetNotesModal}>
        <DialogContent className="bg-deep-black border-muted-gray/30 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-bone-white flex items-center gap-2">
              <StickyNote className="w-5 h-5 text-accent-yellow" />
              Budget Notes
            </DialogTitle>
            <DialogDescription>
              Add notes for this budget. These notes will appear in the Notes Addendum when exporting to PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={budgetNotesForm}
              onChange={(e) => setBudgetNotesForm(e.target.value)}
              placeholder="Enter budget-level notes here..."
              className="min-h-[200px] bg-charcoal-black/50 border-muted-gray/30 text-bone-white placeholder:text-muted-gray"
            />
            <p className="text-xs text-muted-gray">
              These notes will appear at the top of the Notes Addendum section in PDF exports, before any line item notes.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBudgetNotesModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!activeBudget) return;
                try {
                  await updateBudget.mutateAsync({
                    projectId,
                    budgetId: activeBudget.id,
                    input: { notes: budgetNotesForm }
                  });
                  setShowBudgetNotesModal(false);
                } catch (err) {
                  console.error('Failed to save budget notes:', err);
                }
              }}
              disabled={updateBudget.isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {updateBudget.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Notes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sync to Daily Budgets Modal */}
      <Dialog open={showSyncModal} onOpenChange={setShowSyncModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sync to Daily Budgets</DialogTitle>
            <DialogDescription>
              Automatically distribute budget line items across your production days based on phase and calculation mode.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {syncResult && (
              <div
                className={`rounded-lg p-3 flex items-center gap-2 text-sm ${
                  syncResult.success
                    ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}
              >
                {syncResult.success ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                {syncResult.message}
              </div>
            )}

            <div className="bg-charcoal-black/30 rounded-lg p-4 space-y-2 text-sm">
              <p className="text-bone-white font-medium">This will:</p>
              <ul className="text-muted-gray space-y-1 list-disc list-inside">
                <li>Create daily budgets for each production day</li>
                <li>Distribute line items based on their phase (prep/production/wrap)</li>
                <li>Calculate daily allocations based on rate type</li>
                <li>Update existing items and remove stale ones</li>
              </ul>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setShowSyncModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSyncToDaily}
                disabled={isSubmitting}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync Now
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Budget Creation Modal - always rendered so it works from dropdown menu */}
      <BudgetCreationModal
        projectId={projectId}
        isOpen={showCreationModal}
        onClose={() => setShowCreationModal(false)}
        onSuccess={() => {
          setBudgetViewMode('estimated');
          setShowCreationModal(false);
        }}
      />

      {/* Delete Budget Confirmation Dialog - Triple confirmation */}
      <BudgetDeleteConfirmDialog
        budget={budget}
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirmDelete={handleDeleteBudget}
        isDeleting={isDeleting}
      />

      {/* Tips Panel Dialog */}
      <Dialog open={showTipsPanel} onOpenChange={setShowTipsPanel}>
        <DialogContent className="sm:max-w-lg bg-charcoal-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-bone-white">
              <HelpCircle className="w-5 h-5 text-amber-400" />
              Budget Tips
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-accent-yellow/10 rounded-lg">
                <Layers className="w-5 h-5 text-accent-yellow" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Top Sheet vs Detail</h4>
                <p className="text-sm text-muted-gray">
                  Use "Top Sheet" for executive summary by department. Use "Detail"
                  for full line-item breakdown with actuals tracking.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <FolderOpen className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Categories</h4>
                <p className="text-sm text-muted-gray">
                  Organize budget into categories by department. Each category tracks
                  estimated vs. actual spending with variance.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <CalendarDays className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Daily Sync</h4>
                <p className="text-sm text-muted-gray">
                  Sync budget to daily views to automatically distribute costs
                  across production days based on phase.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Package className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Gear Integration</h4>
                <p className="text-sm text-muted-gray">
                  Sync gear rental costs to budget automatically. Equipment tab
                  entries flow into the appropriate budget category.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <BarChart3 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Variance Tracking</h4>
                <p className="text-sm text-muted-gray">
                  Red indicates over budget, green under. Lock the budget when
                  approved to prevent further changes.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowTipsPanel(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Actual Detail Modal */}
      <ActualDetailModal
        projectId={projectId}
        actualId={selectedActualId}
        open={!!selectedActualId}
        onClose={() => setSelectedActualId(null)}
        canEdit={canEdit}
      />
    </div>
  );
};

export default BudgetView;
