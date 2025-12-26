/**
 * Save As Template Checkbox - Option to save application as reusable template
 */
import React from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Save } from 'lucide-react';

interface SaveAsTemplateCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  templateName: string;
  onTemplateNameChange: (name: string) => void;
}

const SaveAsTemplateCheckbox: React.FC<SaveAsTemplateCheckboxProps> = ({
  checked,
  onCheckedChange,
  templateName,
  onTemplateNameChange,
}) => {
  return (
    <div className="space-y-3 p-4 bg-charcoal-black/30 border border-muted-gray/20 rounded-lg">
      <label className="flex items-center gap-3 cursor-pointer">
        <Checkbox
          checked={checked}
          onCheckedChange={(checked) => onCheckedChange(checked as boolean)}
        />
        <div className="flex items-center gap-2">
          <Save className="w-4 h-4 text-muted-gray" />
          <span className="text-bone-white">Save this application as a template</span>
        </div>
      </label>

      {checked && (
        <div className="pl-7 space-y-2">
          <Label htmlFor="template-name" className="text-sm text-muted-gray">
            Template Name
          </Label>
          <Input
            id="template-name"
            value={templateName}
            onChange={(e) => onTemplateNameChange(e.target.value)}
            placeholder="e.g., Standard DP Application"
            className="bg-charcoal-black/50 border-muted-gray/30 text-bone-white placeholder:text-muted-gray"
          />
          <p className="text-xs text-muted-gray">
            You can reuse this template for future applications to save time.
          </p>
        </div>
      )}
    </div>
  );
};

export default SaveAsTemplateCheckbox;
