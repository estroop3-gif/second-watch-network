/**
 * BudgetLineItemSelect - Dropdown to select a budget line item within a category
 */
import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useBudgetLineItems } from '@/hooks/backlot';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText } from 'lucide-react';

interface BudgetLineItemSelectProps {
  budgetId: string | null;
  categoryId: string | null;
  value: string | null;
  onChange: (lineItemId: string | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function BudgetLineItemSelect({
  budgetId,
  categoryId,
  value,
  onChange,
  label = 'Budget Line Item',
  placeholder = 'Select line item (optional)',
  disabled = false,
  className,
}: BudgetLineItemSelectProps) {
  const { data: lineItems, isLoading } = useBudgetLineItems(budgetId, categoryId || undefined);

  // Filter line items by category if categoryId is provided
  const filteredLineItems = categoryId
    ? (lineItems || []).filter(item => item.category_id === categoryId)
    : lineItems || [];

  if (!budgetId) {
    return (
      <div className={className}>
        {label && <Label className="text-muted-gray text-xs mb-1.5 block">{label}</Label>}
        <div className="flex items-center gap-2 text-muted-gray text-sm p-2 border border-muted-gray/20 rounded-md bg-charcoal-black/30">
          <FileText className="w-4 h-4" />
          <span>Select a category first</span>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={className}>
        {label && <Label className="text-muted-gray text-xs mb-1.5 block">{label}</Label>}
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!filteredLineItems || filteredLineItems.length === 0) {
    return (
      <div className={className}>
        {label && <Label className="text-muted-gray text-xs mb-1.5 block">{label}</Label>}
        <div className="flex items-center gap-2 text-muted-gray text-sm p-2 border border-muted-gray/20 rounded-md bg-charcoal-black/30">
          <FileText className="w-4 h-4" />
          <span>No line items in this category</span>
        </div>
      </div>
    );
  }

  const formatAmount = (amount: number | null | undefined) => {
    if (amount == null) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className={className}>
      {label && <Label className="text-muted-gray text-xs mb-1.5 block">{label}</Label>}
      <Select
        value={value || 'none'}
        onValueChange={(val) => onChange(val === 'none' ? null : val)}
        disabled={disabled || !categoryId}
      >
        <SelectTrigger className="bg-charcoal-black border-muted-gray/20 text-bone-white">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-rich-black border-muted-gray/20 max-h-[300px]">
          <SelectItem value="none" className="text-muted-gray">
            {placeholder}
          </SelectItem>
          {filteredLineItems.map((item) => (
            <SelectItem
              key={item.id}
              value={item.id}
              className="text-bone-white hover:bg-charcoal-black"
            >
              <div className="flex items-center justify-between gap-4 w-full">
                <div className="flex items-center gap-2">
                  {item.account_code && (
                    <span className="text-muted-gray font-mono text-xs">
                      {item.account_code}
                    </span>
                  )}
                  <span className="truncate max-w-[200px]">{item.description}</span>
                </div>
                {item.estimated_total != null && item.estimated_total > 0 && (
                  <span className="text-xs text-muted-gray">
                    {formatAmount(item.estimated_total)}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
