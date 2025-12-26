/**
 * FullTimeCompFields - Compensation fields for full-time positions
 * Shows salary range and benefits info
 */
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, Gift } from 'lucide-react';

interface FullTimeCompFieldsProps {
  salaryMin: number | null;
  salaryMax: number | null;
  benefitsInfo: string | null;
  onSalaryMinChange: (value: number | null) => void;
  onSalaryMaxChange: (value: number | null) => void;
  onBenefitsInfoChange: (value: string) => void;
  disabled?: boolean;
}

const FullTimeCompFields: React.FC<FullTimeCompFieldsProps> = ({
  salaryMin,
  salaryMax,
  benefitsInfo,
  onSalaryMinChange,
  onSalaryMaxChange,
  onBenefitsInfoChange,
  disabled = false,
}) => {
  // Format number with commas for display
  const formatSalary = (value: number | null): string => {
    if (value === null || value === 0) return '';
    return value.toLocaleString();
  };

  // Parse formatted number back to integer
  const parseSalary = (value: string): number | null => {
    const cleaned = value.replace(/,/g, '');
    const parsed = parseInt(cleaned);
    return isNaN(parsed) ? null : parsed;
  };

  return (
    <div className="space-y-4">
      {/* Annual Salary Range */}
      <div className="space-y-2">
        <Label className="text-bone-white flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          Annual Salary Range
        </Label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
            <Input
              type="text"
              inputMode="numeric"
              value={formatSalary(salaryMin)}
              onChange={(e) => onSalaryMinChange(parseSalary(e.target.value))}
              placeholder="50,000"
              disabled={disabled}
              className="pl-7 bg-charcoal-black/50 border-muted-gray/30 text-bone-white"
            />
          </div>
          <span className="text-muted-gray">to</span>
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
            <Input
              type="text"
              inputMode="numeric"
              value={formatSalary(salaryMax)}
              onChange={(e) => onSalaryMaxChange(parseSalary(e.target.value))}
              placeholder="75,000"
              disabled={disabled}
              className="pl-7 bg-charcoal-black/50 border-muted-gray/30 text-bone-white"
            />
          </div>
          <span className="text-muted-gray text-sm">/year</span>
        </div>
        <p className="text-xs text-muted-gray">
          Leave blank if salary is negotiable or not disclosed
        </p>
      </div>

      {/* Benefits Info */}
      <div className="space-y-2">
        <Label className="text-bone-white flex items-center gap-2">
          <Gift className="w-4 h-4" />
          Benefits & Perks
        </Label>
        <Textarea
          value={benefitsInfo || ''}
          onChange={(e) => onBenefitsInfoChange(e.target.value)}
          placeholder="Health insurance, 401k, PTO, remote work options, etc."
          disabled={disabled}
          className="min-h-[80px] bg-charcoal-black/50 border-muted-gray/30 text-bone-white placeholder:text-muted-gray"
        />
        <p className="text-xs text-muted-gray">
          List any benefits, perks, or additional compensation details
        </p>
      </div>
    </div>
  );
};

export default FullTimeCompFields;
