/**
 * SalePricingForm.tsx
 * Form component for configuring sale-specific pricing and details
 */
import React from 'react';
import { DollarSign, Info } from 'lucide-react';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type SaleCondition = 'new' | 'like_new' | 'good' | 'fair' | 'parts';

const CONDITION_OPTIONS: { value: SaleCondition; label: string; description: string }[] = [
  { value: 'new', label: 'New (Unused)', description: 'Never used, in original packaging' },
  { value: 'like_new', label: 'Like New', description: 'Excellent condition, minimal signs of use' },
  { value: 'good', label: 'Good', description: 'Normal wear, fully functional' },
  { value: 'fair', label: 'Fair', description: 'Shows wear, may have minor issues' },
  { value: 'parts', label: 'For Parts', description: 'Not fully functional, sold as-is' },
];

interface SalePricingFormProps {
  salePrice: string;
  setSalePrice: (value: string) => void;
  condition: SaleCondition | '';
  setCondition: (value: SaleCondition | '') => void;
  includes: string;
  setIncludes: (value: string) => void;
  negotiable: boolean;
  setNegotiable: (value: boolean) => void;
  disabled?: boolean;
}

export function SalePricingForm({
  salePrice,
  setSalePrice,
  condition,
  setCondition,
  includes,
  setIncludes,
  negotiable,
  setNegotiable,
  disabled = false,
}: SalePricingFormProps) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-bone-white flex items-center gap-2">
        Sale Details
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-muted-gray" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Set the price and condition for selling this gear permanently.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </h3>

      {/* Sale Price */}
      <div className="space-y-2">
        <Label htmlFor="sale-price">
          Asking Price <span className="text-primary-red">*</span>
        </Label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
          <Input
            id="sale-price"
            type="number"
            min="0"
            step="0.01"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            className="pl-8"
            placeholder="0.00"
            disabled={disabled}
          />
        </div>
      </div>

      {/* Condition */}
      <div className="space-y-2">
        <Label htmlFor="condition">
          Condition <span className="text-primary-red">*</span>
        </Label>
        <Select
          value={condition}
          onValueChange={(value) => setCondition(value as SaleCondition)}
          disabled={disabled}
        >
          <SelectTrigger id="condition">
            <SelectValue placeholder="Select condition" />
          </SelectTrigger>
          <SelectContent>
            {CONDITION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex flex-col">
                  <span>{opt.label}</span>
                  <span className="text-xs text-muted-gray">{opt.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* What's Included */}
      <div className="space-y-2">
        <Label htmlFor="includes">What's Included</Label>
        <Textarea
          id="includes"
          value={includes}
          onChange={(e) => setIncludes(e.target.value)}
          placeholder="Original box, battery, charger, strap, lens cap..."
          className="min-h-[80px]"
          disabled={disabled}
        />
        <p className="text-xs text-muted-gray">
          List accessories and items included with the sale
        </p>
      </div>

      {/* Negotiable */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="negotiable"
          checked={negotiable}
          onCheckedChange={(checked) => setNegotiable(checked === true)}
          disabled={disabled}
        />
        <Label
          htmlFor="negotiable"
          className="text-sm font-normal cursor-pointer"
        >
          Price is negotiable
        </Label>
      </div>
    </div>
  );
}

export default SalePricingForm;
