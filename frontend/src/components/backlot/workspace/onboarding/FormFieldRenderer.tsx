/**
 * FormFieldRenderer - Dynamic form from JSON field schema
 */
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export interface FormFieldSchema {
  name: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'date' | 'address' | 'ssn' | 'textarea';
  required: boolean;
  placeholder?: string;
  save_to_profile?: boolean;
}

interface FormFieldRendererProps {
  fields: FormFieldSchema[];
  values: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  saveToProfileFields?: Set<string>;
  onToggleSaveToProfile?: (name: string, save: boolean) => void;
}

export function FormFieldRenderer({
  fields,
  values,
  onChange,
  saveToProfileFields,
  onToggleSaveToProfile,
}: FormFieldRendererProps) {
  const [ssnVisible, setSsnVisible] = useState<Record<string, boolean>>({});

  const renderField = (field: FormFieldSchema) => {
    const value = (values[field.name] as string) || '';

    switch (field.type) {
      case 'address':
        return (
          <div className="space-y-2">
            <Input
              placeholder="Street Address"
              value={(values[`${field.name}_street`] as string) || ''}
              onChange={(e) => onChange(`${field.name}_street`, e.target.value)}
            />
            <div className="grid grid-cols-3 gap-2">
              <Input
                placeholder="City"
                value={(values[`${field.name}_city`] as string) || ''}
                onChange={(e) => onChange(`${field.name}_city`, e.target.value)}
                className="col-span-1"
              />
              <Input
                placeholder="State"
                value={(values[`${field.name}_state`] as string) || ''}
                onChange={(e) => onChange(`${field.name}_state`, e.target.value)}
              />
              <Input
                placeholder="ZIP"
                value={(values[`${field.name}_zip`] as string) || ''}
                onChange={(e) => onChange(`${field.name}_zip`, e.target.value)}
              />
            </div>
          </div>
        );

      case 'ssn':
        return (
          <div className="relative">
            <Input
              type={ssnVisible[field.name] ? 'text' : 'password'}
              placeholder="XXX-XX-XXXX"
              value={value}
              onChange={(e) => onChange(field.name, e.target.value)}
              maxLength={11}
            />
            <button
              type="button"
              onClick={() => setSsnVisible(prev => ({ ...prev, [field.name]: !prev[field.name] }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              {ssnVisible[field.name] ? 'Hide' : 'Show'}
            </button>
          </div>
        );

      case 'textarea':
        return (
          <Textarea
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => onChange(field.name, e.target.value)}
            rows={3}
          />
        );

      default:
        return (
          <Input
            type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'date' ? 'date' : 'text'}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => onChange(field.name, e.target.value)}
          />
        );
    }
  };

  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <div key={field.name} className="space-y-1.5">
          <Label>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {renderField(field)}
          {field.save_to_profile && onToggleSaveToProfile && (
            <div className="flex items-center gap-2 mt-1">
              <Checkbox
                id={`save-${field.name}`}
                checked={saveToProfileFields?.has(field.name)}
                onCheckedChange={(checked) => onToggleSaveToProfile(field.name, !!checked)}
              />
              <label htmlFor={`save-${field.name}`} className="text-xs text-muted-foreground cursor-pointer">
                Save to profile for reuse
              </label>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
