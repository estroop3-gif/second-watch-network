import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Download, FileText, FileCode, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { BacklotScript } from '@/types/backlot';
import { api } from '@/lib/api';
import { useSaveContinuityExport } from '@/hooks/backlot';

interface ScriptExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  script: BacklotScript;
}

type ContentOption = 'clean' | 'highlights' | 'notes' | 'both';
type FormatOption = 'pdf' | 'fdx' | 'fountain' | 'celtx';

const API_BASE = import.meta.env.VITE_API_URL || '';

export function ScriptExportModal({ isOpen, onClose, script }: ScriptExportModalProps) {
  const { toast } = useToast();
  const [contentOption, setContentOption] = useState<ContentOption>('clean');
  const [formatOption, setFormatOption] = useState<FormatOption>('pdf');
  const [isExporting, setIsExporting] = useState(false);

  // Hook to save PDF exports to continuity workspace
  const saveToContinuity = useSaveContinuityExport(script.project_id);

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const includeHighlights = contentOption === 'highlights' || contentOption === 'both';
      const includeNotes = contentOption === 'notes' || contentOption === 'both';

      // Build export URL based on format
      let exportUrl: string;

      if (formatOption === 'pdf') {
        // Use export-with-highlights endpoint for all PDF exports
        // Clean PDFs just have both flags set to false
        const params = new URLSearchParams();
        params.append('include_highlights', includeHighlights.toString());
        params.append('include_notes', includeNotes.toString());
        params.append('include_addendums', (contentOption !== 'clean').toString());
        exportUrl = `${API_BASE}/api/v1/backlot/scripts/${script.id}/export-with-highlights?${params}`;
      } else {
        // Non-PDF format exports
        const params = new URLSearchParams({
          format: formatOption,
          include_highlights: includeHighlights.toString(),
          include_notes: includeNotes.toString(),
        });
        exportUrl = `${API_BASE}/api/v1/backlot/scripts/${script.id}/export?${params}`;
      }

      const token = api.getToken();
      const response = await fetch(exportUrl, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Export failed');
      }

      // Extract scene mappings from response header (for PDF exports)
      const sceneMappingsHeader = response.headers.get('X-Scene-Mappings');
      let sceneMappings = null;
      if (sceneMappingsHeader) {
        try {
          sceneMappings = JSON.parse(sceneMappingsHeader);
        } catch {
          console.warn('Failed to parse scene mappings header');
        }
      }

      // Get the blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Determine file extension
      const extensions: Record<FormatOption, string> = {
        pdf: 'pdf',
        fdx: 'fdx',
        fountain: 'fountain',
        celtx: 'celtx',
      };

      // Build filename with appropriate suffix
      const baseName = script.title?.replace(/\.[^.]+$/, '') || 'script';
      let suffix = '';
      if (contentOption === 'both') {
        suffix = '_marked';
      } else if (contentOption === 'highlights') {
        suffix = '_highlights';
      } else if (contentOption === 'notes') {
        suffix = '_notes';
      }
      a.download = `${baseName}${suffix}.${extensions[formatOption]}`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Auto-save PDF exports to continuity workspace
      if (formatOption === 'pdf') {
        try {
          const versionLabel = `Export - ${new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}`;

          await saveToContinuity.mutateAsync({
            file: blob,
            scriptId: script.id,
            exportType: 'script',
            contentType: contentOption,
            versionLabel,
            sceneMappings,
          });

          toast({
            title: 'Export successful',
            description: 'Script exported and saved to Continuity workspace',
          });
        } catch (continuityError) {
          console.error('Failed to save to continuity:', continuityError);
          // Still show success for the download, but mention continuity failed
          toast({
            title: 'Export successful',
            description: `Script exported as ${formatOption.toUpperCase()}. (Note: Failed to save to Continuity)`,
          });
        }
      } else {
        toast({
          title: 'Export successful',
          description: `Script exported as ${formatOption.toUpperCase()}`,
        });
      }

      onClose();
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Failed to export script',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const contentOptions = [
    {
      value: 'clean' as ContentOption,
      label: 'Clean Script',
      description: 'No highlights or notes',
    },
    {
      value: 'highlights' as ContentOption,
      label: 'With Breakdown Highlights',
      description: 'Include colored breakdown highlights',
    },
    {
      value: 'notes' as ContentOption,
      label: 'With Notes',
      description: 'Include script notes and annotations',
    },
    {
      value: 'both' as ContentOption,
      label: 'With Highlights & Notes',
      description: 'Include both highlights and notes',
    },
  ];

  const formatOptions = [
    {
      value: 'pdf' as FormatOption,
      label: 'PDF',
      description: 'Portable Document Format',
      icon: FileText,
    },
    {
      value: 'fdx' as FormatOption,
      label: 'Final Draft (FDX)',
      description: 'Final Draft XML format',
      icon: FileCode,
    },
    {
      value: 'fountain' as FormatOption,
      label: 'Fountain',
      description: 'Plain text screenplay format',
      icon: FileText,
    },
    {
      value: 'celtx' as FormatOption,
      label: 'Celtx',
      description: 'Celtx screenplay format',
      icon: FileCode,
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Script
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Content Options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Content</Label>
            <RadioGroup
              value={contentOption}
              onValueChange={(value) => setContentOption(value as ContentOption)}
              className="space-y-2"
            >
              {contentOptions.map((option) => (
                <div
                  key={option.value}
                  className="flex items-start space-x-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                  onClick={() => setContentOption(option.value)}
                >
                  <RadioGroupItem value={option.value} id={`content-${option.value}`} className="mt-1" />
                  <div className="flex-1">
                    <Label
                      htmlFor={`content-${option.value}`}
                      className="font-medium cursor-pointer"
                    >
                      {option.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Format Options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Format</Label>
            <RadioGroup
              value={formatOption}
              onValueChange={(value) => setFormatOption(value as FormatOption)}
              className="grid grid-cols-2 gap-2"
            >
              {formatOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <div
                    key={option.value}
                    className={`flex items-start space-x-3 p-3 rounded-md border cursor-pointer transition-colors ${
                      formatOption === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                    onClick={() => setFormatOption(option.value)}
                  >
                    <RadioGroupItem
                      value={option.value}
                      id={`format-${option.value}`}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <Label
                          htmlFor={`format-${option.value}`}
                          className="font-medium cursor-pointer"
                        >
                          {option.label}
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* Info about format support */}
          {formatOption !== 'pdf' && contentOption !== 'clean' && (
            <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
              Note: Highlights and notes in {formatOption.toUpperCase()} format will be included as
              annotations or comments where supported by the format.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
