/**
 * UnionRequirements - Multi-select checkboxes for union requirements
 */
import React from 'react';
import { Label } from '@/components/ui/label';
import { HelpCircle, Check } from 'lucide-react';
import { UnionType, UNION_OPTIONS } from '@/types/productions';

interface UnionRequirementsProps {
  value: UnionType[];
  onChange: (unions: UnionType[]) => void;
  disabled?: boolean;
}

const UnionRequirements: React.FC<UnionRequirementsProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const handleToggle = (e: React.MouseEvent, union: UnionType) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    if (value.includes(union)) {
      onChange(value.filter((u) => u !== union));
    } else {
      onChange([...value, union]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label className="text-bone-white font-medium">Union Requirements</Label>
        <HelpCircle
          className="w-4 h-4 text-muted-gray cursor-help"
          title="Select which unions this position requires membership in. This helps applicants know if they qualify for the role."
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {UNION_OPTIONS.map((option) => {
          const isSelected = value.includes(option.value);
          return (
            <div
              key={option.value}
              role="checkbox"
              aria-checked={isSelected}
              tabIndex={disabled ? -1 : 0}
              className={`flex items-center gap-2 p-3 rounded-lg border transition-colors cursor-pointer select-none ${
                isSelected
                  ? 'border-accent-yellow bg-accent-yellow/10'
                  : 'border-muted-gray/30 hover:border-muted-gray/50'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={(e) => handleToggle(e, option.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleToggle(e as unknown as React.MouseEvent, option.value);
                }
              }}
              title={option.description}
            >
              <div
                className={`flex items-center justify-center h-4 w-4 shrink-0 rounded-sm border-2 transition-colors ${
                  isSelected
                    ? 'bg-accent-yellow border-accent-yellow'
                    : 'border-muted-gray/50 bg-transparent'
                }`}
              >
                {isSelected && <Check className="h-3 w-3 text-charcoal-black stroke-[3]" />}
              </div>
              <span
                className={`text-sm ${
                  isSelected ? 'text-accent-yellow' : 'text-bone-white'
                }`}
              >
                {option.label}
              </span>
            </div>
          );
        })}
      </div>

      {value.length > 0 && (
        <p className="text-xs text-muted-gray">
          Selected: {value.map((u) => UNION_OPTIONS.find((o) => o.value === u)?.label).join(', ')}
        </p>
      )}
    </div>
  );
};

export default UnionRequirements;
