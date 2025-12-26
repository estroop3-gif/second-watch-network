/**
 * ProductionTypeSelect - Dropdown for selecting production type
 */
import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Film } from 'lucide-react';
import { ProductionType, PRODUCTION_TYPE_OPTIONS } from '@/types/productions';

interface ProductionTypeSelectProps {
  value: ProductionType | null;
  onChange: (type: ProductionType | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

const ProductionTypeSelect: React.FC<ProductionTypeSelectProps> = ({
  value,
  onChange,
  placeholder = 'Select production type',
  disabled = false,
}) => {
  const handleChange = (newValue: string) => {
    if (newValue === '__none__') {
      onChange(null);
    } else {
      onChange(newValue as ProductionType);
    }
  };

  return (
    <Select
      value={value || '__none__'}
      onValueChange={handleChange}
      disabled={disabled}
    >
      <SelectTrigger className="bg-charcoal-black/50 border-muted-gray/30 text-bone-white">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-muted-gray" />
          <SelectValue placeholder={placeholder} />
        </div>
      </SelectTrigger>
      <SelectContent className="bg-charcoal-black border-muted-gray/30">
        <SelectItem value="__none__" className="text-muted-gray">
          Select type...
        </SelectItem>
        {PRODUCTION_TYPE_OPTIONS.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="text-bone-white"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default ProductionTypeSelect;
