/**
 * BudgetCategorySelect - Dropdown to select a budget category
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
import { useBudgetCategories, useBudget } from '@/hooks/backlot';
import { Skeleton } from '@/components/ui/skeleton';
import { FolderOpen } from 'lucide-react';

interface BudgetCategorySelectProps {
  projectId: string;
  value: string | null;
  onChange: (categoryId: string | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function BudgetCategorySelect({
  projectId,
  value,
  onChange,
  label = 'Budget Category',
  placeholder = 'Select category (optional)',
  disabled = false,
  className,
}: BudgetCategorySelectProps) {
  // First get the budget to get the budgetId
  const { data: budget, isLoading: budgetLoading } = useBudget(projectId);
  const budgetId = budget?.id || null;

  const { data: categories, isLoading: categoriesLoading } = useBudgetCategories(budgetId);

  const isLoading = budgetLoading || categoriesLoading;

  if (isLoading) {
    return (
      <div className={className}>
        {label && <Label className="text-muted-gray text-xs mb-1.5 block">{label}</Label>}
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <div className={className}>
        {label && <Label className="text-muted-gray text-xs mb-1.5 block">{label}</Label>}
        <div className="flex items-center gap-2 text-muted-gray text-sm p-2 border border-muted-gray/20 rounded-md bg-charcoal-black/30">
          <FolderOpen className="w-4 h-4" />
          <span>No budget categories available</span>
        </div>
      </div>
    );
  }

  // Group categories by type
  const categoryTypes = ['above_the_line', 'production', 'post', 'other'];
  const typeLabels: Record<string, string> = {
    above_the_line: 'Above the Line',
    production: 'Production',
    post: 'Post-Production',
    other: 'Other',
  };

  const groupedCategories = categoryTypes.map(type => ({
    type,
    label: typeLabels[type] || type,
    categories: categories.filter(c => c.category_type === type),
  })).filter(g => g.categories.length > 0);

  return (
    <div className={className}>
      {label && <Label className="text-muted-gray text-xs mb-1.5 block">{label}</Label>}
      <Select
        value={value || 'none'}
        onValueChange={(val) => onChange(val === 'none' ? null : val)}
        disabled={disabled}
      >
        <SelectTrigger className="bg-charcoal-black border-muted-gray/20 text-bone-white">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-rich-black border-muted-gray/20 max-h-[300px]">
          <SelectItem value="none" className="text-muted-gray">
            {placeholder}
          </SelectItem>
          {groupedCategories.map((group) => (
            <React.Fragment key={group.type}>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-gray bg-charcoal-black/50 sticky top-0">
                {group.label}
              </div>
              {group.categories.map((category) => (
                <SelectItem
                  key={category.id}
                  value={category.id}
                  className="text-bone-white hover:bg-charcoal-black"
                >
                  <div className="flex items-center gap-2">
                    {category.code && (
                      <span className="text-muted-gray font-mono text-xs">
                        {category.code}
                      </span>
                    )}
                    <span>{category.name}</span>
                  </div>
                </SelectItem>
              ))}
            </React.Fragment>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
