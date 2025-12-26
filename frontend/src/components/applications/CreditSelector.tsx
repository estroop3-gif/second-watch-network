/**
 * Credit Selector - Multi-select for filmography credits
 */
import React from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Film, Award, X } from 'lucide-react';
import type { SelectableCredit } from '@/types/applications';

interface CreditSelectorProps {
  credits: SelectableCredit[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  isLoading?: boolean;
  maxSelections?: number;
}

const CreditSelector: React.FC<CreditSelectorProps> = ({
  credits,
  selectedIds,
  onChange,
  isLoading = false,
  maxSelections = 5,
}) => {
  const handleToggle = (creditId: string) => {
    if (selectedIds.includes(creditId)) {
      onChange(selectedIds.filter((id) => id !== creditId));
    } else if (selectedIds.length < maxSelections) {
      onChange([...selectedIds, creditId]);
    }
  };

  const handleRemove = (creditId: string) => {
    onChange(selectedIds.filter((id) => id !== creditId));
  };

  const selectedCredits = credits.filter((c) => selectedIds.includes(c.id));

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label className="text-bone-white">Select Credits to Include</Label>
        <div className="text-muted-gray text-sm">Loading your credits...</div>
      </div>
    );
  }

  if (credits.length === 0) {
    return (
      <div className="space-y-2">
        <Label className="text-bone-white">Select Credits to Include</Label>
        <div className="p-4 bg-charcoal-black/30 border border-muted-gray/20 rounded-lg text-center">
          <Film className="w-8 h-8 text-muted-gray mx-auto mb-2" />
          <p className="text-muted-gray text-sm">
            No credits found. Add credits to your profile to include them in applications.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-bone-white">Select Credits to Include</Label>
        <span className="text-xs text-muted-gray">
          {selectedIds.length}/{maxSelections} selected
        </span>
      </div>

      {/* Selected Credits Preview */}
      {selectedCredits.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 bg-charcoal-black/30 border border-muted-gray/20 rounded-lg">
          {selectedCredits.map((credit) => (
            <Badge
              key={credit.id}
              variant="secondary"
              className="bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30 pr-1"
            >
              <span className="mr-1">{credit.project_title}</span>
              <button
                type="button"
                onClick={() => handleRemove(credit.id)}
                className="hover:bg-accent-yellow/30 rounded p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Credit List */}
      <div className="max-h-48 overflow-y-auto space-y-1 border border-muted-gray/20 rounded-lg p-2 bg-charcoal-black/30">
        {credits.map((credit) => {
          const isSelected = selectedIds.includes(credit.id);
          const isDisabled = !isSelected && selectedIds.length >= maxSelections;

          return (
            <label
              key={credit.id}
              className={`flex items-start gap-3 p-2 rounded cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-accent-yellow/10 border border-accent-yellow/30'
                  : isDisabled
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-muted-gray/10'
              }`}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => handleToggle(credit.id)}
                disabled={isDisabled}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-bone-white truncate">
                    {credit.project_title}
                  </span>
                  {credit.year && (
                    <span className="text-xs text-muted-gray">({credit.year})</span>
                  )}
                </div>
                <div className="text-sm text-muted-gray">
                  {credit.role}
                  {credit.department && ` - ${credit.department}`}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <p className="text-xs text-muted-gray">
        Select up to {maxSelections} credits to highlight in your application
      </p>
    </div>
  );
};

export default CreditSelector;
