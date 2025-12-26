/**
 * CoverLetterSection - Cover letter with template selection and save functionality
 */
import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  ChevronDown,
  Plus,
  Loader2,
  Trash2,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

import {
  useCoverLetterTemplates,
  useCoverLetterTemplateMutations,
} from '@/hooks/applications';
import type { CoverLetterTemplate } from '@/types/applications';

interface CoverLetterSectionProps {
  value: string;
  onChange: (value: string) => void;
  selectedTemplateId: string | null;
  onTemplateSelect: (templateId: string | null, content?: string) => void;
  saveAsTemplate: boolean;
  onSaveAsTemplateChange: (checked: boolean) => void;
  templateName: string;
  onTemplateNameChange: (name: string) => void;
}

const CoverLetterSection: React.FC<CoverLetterSectionProps> = ({
  value,
  onChange,
  selectedTemplateId,
  onTemplateSelect,
  saveAsTemplate,
  onSaveAsTemplateChange,
  templateName,
  onTemplateNameChange,
}) => {
  const [showTemplates, setShowTemplates] = useState(false);

  const { data: templates, isLoading: templatesLoading } = useCoverLetterTemplates();
  const { createTemplate, deleteTemplate } = useCoverLetterTemplateMutations();

  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    if (templateId === 'none') {
      onTemplateSelect(null);
      return;
    }

    const template = templates?.find((t) => t.id === templateId);
    if (template) {
      onTemplateSelect(template.id, template.content);
      onChange(template.content);
    }
  };

  // Handle delete template
  const handleDeleteTemplate = async (e: React.MouseEvent, templateId: string) => {
    e.stopPropagation();
    e.preventDefault();

    if (!confirm('Delete this cover letter template?')) return;

    try {
      await deleteTemplate.mutateAsync(templateId);
      toast.success('Template deleted');
      if (selectedTemplateId === templateId) {
        onTemplateSelect(null);
      }
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  // Sorted templates - default first, then by use count
  const sortedTemplates = [...(templates || [])].sort((a, b) => {
    if (a.is_default && !b.is_default) return -1;
    if (!a.is_default && b.is_default) return 1;
    return (b.use_count || 0) - (a.use_count || 0);
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="cover-note" className="text-bone-white flex items-center gap-2">
          <FileText className="w-4 h-4 text-accent-yellow" />
          Cover Letter / Why You
        </Label>

        {/* Template Selector */}
        <Select
          value={selectedTemplateId || 'none'}
          onValueChange={handleTemplateSelect}
        >
          <SelectTrigger className="w-48 bg-charcoal-black/50 border-muted-gray/30 text-bone-white text-sm h-8">
            <SelectValue placeholder="Use a template..." />
          </SelectTrigger>
          <SelectContent className="bg-charcoal-black border-muted-gray/30">
            <SelectItem value="none" className="text-muted-gray">
              Write from scratch
            </SelectItem>
            {templatesLoading && (
              <div className="flex items-center justify-center p-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-gray" />
              </div>
            )}
            {sortedTemplates.map((template) => (
              <SelectItem
                key={template.id}
                value={template.id}
                className="text-bone-white hover:bg-muted-gray/20"
              >
                <div className="flex items-center gap-2 w-full">
                  {template.is_default && (
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  )}
                  <span className="truncate">{template.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cover Letter Textarea */}
      <Textarea
        id="cover-note"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          // Clear template selection when user types
          if (selectedTemplateId) {
            onTemplateSelect(null);
          }
        }}
        placeholder="Tell them why you're the right fit for this opportunity..."
        className="min-h-40 bg-charcoal-black/50 border-muted-gray/30 text-bone-white placeholder:text-muted-gray resize-y"
      />

      {/* Save as Template */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="save-cover-letter-template"
            checked={saveAsTemplate}
            onCheckedChange={(checked) => onSaveAsTemplateChange(!!checked)}
            className="border-muted-gray/50 data-[state=checked]:bg-accent-yellow data-[state=checked]:border-accent-yellow"
          />
          <label
            htmlFor="save-cover-letter-template"
            className="text-sm text-muted-gray cursor-pointer"
          >
            Save this cover letter as a template for future use
          </label>
        </div>

        {saveAsTemplate && (
          <Input
            value={templateName}
            onChange={(e) => onTemplateNameChange(e.target.value)}
            placeholder="Template name (e.g., 'DP Application', 'General Crew')"
            className="bg-charcoal-black/50 border-muted-gray/30 text-bone-white placeholder:text-muted-gray"
          />
        )}
      </div>

      {/* Existing Templates List */}
      {templates && templates.length > 0 && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowTemplates(!showTemplates)}
            className="text-xs text-muted-gray hover:text-bone-white flex items-center gap-1"
          >
            <ChevronDown
              className={cn(
                'w-3 h-3 transition-transform',
                showTemplates && 'rotate-180'
              )}
            />
            {templates.length} saved template{templates.length !== 1 ? 's' : ''}
          </button>

          {showTemplates && (
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {sortedTemplates.map((template) => (
                <div
                  key={template.id}
                  className={cn(
                    'flex items-center justify-between p-2 rounded text-sm',
                    'bg-charcoal-black/30 border border-muted-gray/10',
                    selectedTemplateId === template.id && 'border-accent-yellow/50'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleTemplateSelect(template.id)}
                    className="flex items-center gap-2 text-left flex-1 min-w-0"
                  >
                    {template.is_default && (
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />
                    )}
                    <span className="text-bone-white truncate">{template.name}</span>
                    {template.use_count > 0 && (
                      <span className="text-[10px] text-muted-gray">
                        (used {template.use_count}x)
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteTemplate(e, template.id)}
                    className="p-1 text-muted-gray hover:text-red-400 flex-shrink-0"
                    disabled={deleteTemplate.isPending}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CoverLetterSection;
