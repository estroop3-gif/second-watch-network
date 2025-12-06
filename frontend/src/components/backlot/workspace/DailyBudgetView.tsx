/**
 * DailyBudgetView - View and manage daily budgets per production day
 */
import React, { useState } from 'react';
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
  ArrowLeft,
  Receipt,
  Lightbulb,
  CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';
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
} from '@/hooks/backlot';
import {
  BacklotDailyBudget,
  BacklotDailyBudgetItem,
  BacklotBudgetLineItem,
  DailyBudgetSummary,
  DailyBudgetItemInput,
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
            {format(new Date(summary.date), 'EEEE, MMMM d, yyyy')}
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
            {format(new Date(dailyBudget.date), 'EEEE, MMMM d, yyyy')}
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
  const { days } = useProductionDays(projectId);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const { data: selectedDailyBudget } = useDailyBudgetForDay(selectedDayId);

  const currency = budget?.currency || 'USD';

  // Calculate totals
  const totals = (summaries || []).reduce(
    (acc, s) => ({
      estimated: acc.estimated + s.estimated_total,
      actual: acc.actual + s.actual_total,
      variance: acc.variance + s.variance,
    }),
    { estimated: 0, actual: 0, variance: 0 }
  );

  if (isLoading) {
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
  if (selectedDayId && selectedDailyBudget) {
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
      {summaries && summaries.length > 0 && (
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

      {/* Daily Budget List */}
      {summaries && summaries.length > 0 ? (
        <div className="space-y-3">
          {summaries.map((summary) => (
            <DailyBudgetCard
              key={summary.id}
              summary={summary}
              currency={currency}
              onClick={() => {
                // Find the production day ID from days list
                const day = days.find((d) =>
                  d.day_number === summary.production_day_number &&
                  d.date === summary.date
                );
                if (day) {
                  setSelectedDayId(day.id);
                }
              }}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
          <Calendar className="w-12 h-12 text-muted-gray/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-bone-white mb-2">No daily budgets yet</h3>
          <p className="text-muted-gray max-w-md mx-auto">
            Daily budgets are automatically created when you add production days.
            Visit the Schedule tab to add your first shoot day.
          </p>
        </div>
      )}
    </div>
  );
};

export default DailyBudgetView;
