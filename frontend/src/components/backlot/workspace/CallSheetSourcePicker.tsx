/**
 * CallSheetSourcePicker - Component for selecting a source to prefill a new call sheet
 * Shows recent call sheets from the current project and saved personal templates
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  Calendar,
  Clock,
  BookmarkPlus,
  History,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  Loader2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { BacklotCallSheet } from '@/types/backlot';
import { BacklotSavedCallSheetTemplate, useCallSheetTemplates } from '@/hooks/backlot';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface CallSheetSourcePickerProps {
  projectId: string;
  recentCallSheets: BacklotCallSheet[];
  isLoadingRecent: boolean;
  onSelectRecent: (callSheet: BacklotCallSheet) => void;
  onSelectTemplate: (template: BacklotSavedCallSheetTemplate) => void;
  onClear: () => void;
  selectedSource: { type: 'recent' | 'template'; id: string; name: string } | null;
}

export function CallSheetSourcePicker({
  projectId,
  recentCallSheets,
  isLoadingRecent,
  onSelectRecent,
  onSelectTemplate,
  onClear,
  selectedSource,
}: CallSheetSourcePickerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { templates: rawTemplates, isLoading: isLoadingTemplates, deleteTemplate } = useCallSheetTemplates();
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);

  // Ensure templates is always an array (defensive coding)
  const templates = Array.isArray(rawTemplates) ? rawTemplates : [];

  // Filter recent call sheets to only show ones from this project (up to 5 most recent)
  const projectCallSheets = recentCallSheets
    .filter(cs => cs.project_id === projectId)
    .slice(0, 5);

  const handleDeleteTemplate = async (templateId: string) => {
    setDeletingTemplateId(templateId);
    try {
      await deleteTemplate.mutateAsync(templateId);
    } finally {
      setDeletingTemplateId(null);
    }
  };

  // If a source is selected, show a condensed view
  if (selectedSource) {
    return (
      <div className="border border-accent/30 bg-accent/5 rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium">
              Starting from: <span className="text-accent">{selectedSource.name}</span>
            </span>
            <Badge variant="outline" className="text-xs">
              {selectedSource.type === 'recent' ? 'Recent' : 'Template'}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4 mr-1" />
            Clear
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border/50 rounded-lg mb-4 overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Start from previous call sheet or template</span>
          <span className="text-xs text-muted-foreground">(optional)</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="p-3 pt-2 space-y-4">
          {/* Recent Call Sheets from This Project */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-blue-500" />
              <h4 className="text-sm font-medium">Recent from This Project</h4>
            </div>

            {isLoadingRecent ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : projectCallSheets.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 pl-6">
                No call sheets in this project yet
              </p>
            ) : (
              <ScrollArea className="max-h-[160px]">
                <div className="space-y-1 pr-2">
                  {projectCallSheets.map((cs) => (
                    <button
                      key={cs.id}
                      onClick={() => onSelectRecent(cs)}
                      className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors text-left group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium truncate">
                            {cs.title || 'Untitled Call Sheet'}
                          </span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {cs.date ? format(parseISO(cs.date), 'MMM d, yyyy') : 'No date'}
                            </span>
                            {cs.general_call_time && (
                              <>
                                <Clock className="w-3 h-3 ml-1" />
                                <span>{cs.general_call_time}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronDown className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 rotate-[-90deg]" />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-border/50" />

          {/* Saved Templates */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BookmarkPlus className="w-4 h-4 text-amber-500" />
              <h4 className="text-sm font-medium">My Saved Templates</h4>
            </div>

            {isLoadingTemplates ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2 pl-6">
                No saved templates yet. Create a call sheet and save it as a template for quick reuse.
              </p>
            ) : (
              <ScrollArea className="max-h-[160px]">
                <div className="space-y-1 pr-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors group"
                    >
                      <button
                        onClick={() => onSelectTemplate(template)}
                        className="flex-1 flex items-center gap-3 min-w-0 text-left"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium truncate">
                            {template.name}
                          </span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {template.template_type && (
                              <Badge variant="outline" className="text-xs capitalize">
                                {template.template_type.replace('_', ' ')}
                              </Badge>
                            )}
                            {template.use_count > 0 && (
                              <span>Used {template.use_count}x</span>
                            )}
                            {template.description && (
                              <span className="truncate max-w-[150px]">{template.description}</span>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Delete button */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                            disabled={deletingTemplateId === template.id}
                          >
                            {deletingTemplateId === template.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Template</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{template.name}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteTemplate(template.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
