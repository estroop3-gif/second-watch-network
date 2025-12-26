/**
 * Application Template Selector - Dropdown to select from saved templates
 */
import React from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileText, Star } from 'lucide-react';
import type { ApplicationTemplate } from '@/types/applications';

interface ApplicationTemplateSelectorProps {
  templates: ApplicationTemplate[];
  value: string | null;
  onChange: (templateId: string | null, template?: ApplicationTemplate) => void;
  isLoading?: boolean;
}

const ApplicationTemplateSelector: React.FC<ApplicationTemplateSelectorProps> = ({
  templates,
  value,
  onChange,
  isLoading = false,
}) => {
  const handleChange = (templateId: string) => {
    if (templateId === 'none') {
      onChange(null);
    } else {
      const template = templates.find((t) => t.id === templateId);
      onChange(templateId, template);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label className="text-bone-white">Use a Saved Template</Label>
        <div className="text-muted-gray text-sm">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-bone-white">Use a Saved Template</Label>
      <Select value={value || 'none'} onValueChange={handleChange}>
        <SelectTrigger className="bg-charcoal-black/50 border-muted-gray/30 text-bone-white">
          <SelectValue placeholder="Select a template or start fresh" />
        </SelectTrigger>
        <SelectContent className="bg-charcoal-black border-muted-gray/30">
          <SelectItem value="none" className="text-bone-white hover:bg-muted-gray/20">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-gray" />
              <span>Start Fresh (No Template)</span>
            </div>
          </SelectItem>
          {templates.map((template) => (
            <SelectItem
              key={template.id}
              value={template.id}
              className="text-bone-white hover:bg-muted-gray/20"
            >
              <div className="flex items-center gap-2">
                {template.is_default ? (
                  <Star className="w-4 h-4 text-accent-yellow" />
                ) : (
                  <FileText className="w-4 h-4 text-muted-gray" />
                )}
                <span>{template.name}</span>
                {template.is_default && (
                  <Badge variant="outline" className="ml-2 text-xs border-accent-yellow/30 text-accent-yellow">
                    Default
                  </Badge>
                )}
                {template.use_count > 0 && (
                  <span className="text-xs text-muted-gray ml-2">
                    Used {template.use_count}x
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {templates.length === 0 && (
        <p className="text-xs text-muted-gray">
          No saved templates yet. Check "Save as template" below to save this application for reuse.
        </p>
      )}
    </div>
  );
};

export default ApplicationTemplateSelector;
