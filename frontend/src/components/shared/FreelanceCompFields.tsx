/**
 * FreelanceCompFields - Compensation fields for freelance gigs
 * Shows day rate range and dates
 */
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DollarSign, Calendar } from 'lucide-react';

interface FreelanceCompFieldsProps {
  dayRateMin: number | null;
  dayRateMax: number | null;
  compensationType: string | null;
  startDate: string | null;
  endDate: string | null;
  onDayRateMinChange: (value: number | null) => void;
  onDayRateMaxChange: (value: number | null) => void;
  onCompensationTypeChange: (value: string) => void;
  onStartDateChange: (value: string | null) => void;
  onEndDateChange: (value: string | null) => void;
  disabled?: boolean;
}

const COMPENSATION_TYPES = [
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'deferred', label: 'Deferred Pay' },
  { value: 'negotiable', label: 'Negotiable' },
];

const FreelanceCompFields: React.FC<FreelanceCompFieldsProps> = ({
  dayRateMin,
  dayRateMax,
  compensationType,
  startDate,
  endDate,
  onDayRateMinChange,
  onDayRateMaxChange,
  onCompensationTypeChange,
  onStartDateChange,
  onEndDateChange,
  disabled = false,
}) => {
  return (
    <div className="space-y-4">
      {/* Compensation Type */}
      <div className="space-y-2">
        <Label className="text-bone-white">Compensation Type</Label>
        <Select
          value={compensationType || ''}
          onValueChange={onCompensationTypeChange}
          disabled={disabled}
        >
          <SelectTrigger className="bg-charcoal-black/50 border-muted-gray/30 text-bone-white">
            <SelectValue placeholder="Select type..." />
          </SelectTrigger>
          <SelectContent className="bg-charcoal-black border-muted-gray/30">
            {COMPENSATION_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Day Rate Range */}
      {compensationType === 'paid' && (
        <div className="space-y-2">
          <Label className="text-bone-white flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Day Rate Range
          </Label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
              <Input
                type="number"
                min={0}
                value={dayRateMin || ''}
                onChange={(e) => onDayRateMinChange(e.target.value ? parseInt(e.target.value) : null)}
                placeholder="Min"
                disabled={disabled}
                className="pl-7 bg-charcoal-black/50 border-muted-gray/30 text-bone-white"
              />
            </div>
            <span className="text-muted-gray">to</span>
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
              <Input
                type="number"
                min={0}
                value={dayRateMax || ''}
                onChange={(e) => onDayRateMaxChange(e.target.value ? parseInt(e.target.value) : null)}
                placeholder="Max"
                disabled={disabled}
                className="pl-7 bg-charcoal-black/50 border-muted-gray/30 text-bone-white"
              />
            </div>
            <span className="text-muted-gray text-sm">/day</span>
          </div>
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-bone-white flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Start Date
          </Label>
          <Input
            type="date"
            value={startDate || ''}
            onChange={(e) => onStartDateChange(e.target.value || null)}
            disabled={disabled}
            className="bg-charcoal-black/50 border-muted-gray/30 text-bone-white"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-bone-white">End Date</Label>
          <Input
            type="date"
            value={endDate || ''}
            onChange={(e) => onEndDateChange(e.target.value || null)}
            disabled={disabled}
            className="bg-charcoal-black/50 border-muted-gray/30 text-bone-white"
          />
        </div>
      </div>
    </div>
  );
};

export default FreelanceCompFields;
