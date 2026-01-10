/**
 * ContinuityView - Continuity Workspace with PDF Version History
 *
 * Wraps ScriptyWorkspace with a version selector for exported PDFs.
 * Shows version history dropdown and allows switching between exports.
 */
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  FileText,
  History,
  Download,
  Trash2,
  MoreVertical,
  Star,
  Clock,
  User,
  FileWarning,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useContinuityExports,
  useDeleteContinuityExport,
  useUpdateContinuityExport,
  ContinuityExport,
} from '@/hooks/backlot';
import { useToast } from '@/hooks/use-toast';
import ScriptyWorkspace from './ScriptyWorkspace';

interface ContinuityViewProps {
  projectId: string;
  canEdit: boolean;
}

const ContinuityView: React.FC<ContinuityViewProps> = ({ projectId, canEdit }) => {
  const { toast } = useToast();
  const [selectedExportId, setSelectedExportId] = useState<string | null>(null);
  const [deleteExportId, setDeleteExportId] = useState<string | null>(null);

  // Fetch continuity exports
  const { data: exports, isLoading, refetch } = useContinuityExports(projectId);
  const deleteExport = useDeleteContinuityExport(projectId);
  const updateExport = useUpdateContinuityExport(projectId);

  // Select current/latest export by default
  useEffect(() => {
    if (exports?.length && !selectedExportId) {
      const current = exports.find((e) => e.is_current) || exports[0];
      setSelectedExportId(current.id);
    }
  }, [exports, selectedExportId]);

  // Get the selected export
  const selectedExport = exports?.find((e) => e.id === selectedExportId);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Format file size
  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Handle download
  const handleDownload = (exp: ContinuityExport) => {
    if (exp.signed_url) {
      const link = document.createElement('a');
      link.href = exp.signed_url;
      link.download = exp.file_name || 'export.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Handle set as current
  const handleSetCurrent = async (exportId: string) => {
    try {
      await updateExport.mutateAsync({ exportId, isCurrent: true });
      toast({
        title: 'Updated',
        description: 'Export marked as current version',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update export',
        variant: 'destructive',
      });
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteExportId) return;
    try {
      await deleteExport.mutateAsync(deleteExportId);
      setDeleteExportId(null);
      // If we deleted the selected export, select another
      if (selectedExportId === deleteExportId) {
        const remaining = exports?.filter((e) => e.id !== deleteExportId);
        if (remaining?.length) {
          setSelectedExportId(remaining[0].id);
        } else {
          setSelectedExportId(null);
        }
      }
      toast({
        title: 'Deleted',
        description: 'Export removed from version history',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete export',
        variant: 'destructive',
      });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex flex-col gap-4 p-4">
        <Skeleton className="h-12 w-full bg-muted-gray/20" />
        <Skeleton className="h-96 w-full bg-muted-gray/20" />
      </div>
    );
  }

  // No exports state
  if (!exports?.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8">
        <div className="rounded-full bg-muted-gray/10 p-6">
          <FileWarning className="w-12 h-12 text-muted-gray" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-medium text-bone-white">No Continuity PDFs</h3>
          <p className="text-muted-gray max-w-md">
            Export a script as PDF to view it here. PDFs are automatically saved to your continuity
            workspace when you export from the Script tab.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Version Selector Toolbar */}
      <div className="flex items-center gap-4 p-4 border-b border-muted-gray/20 bg-charcoal-black/50">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-muted-gray" />
          <span className="text-sm text-muted-gray">Version:</span>
        </div>

        <Select
          value={selectedExportId ?? ''}
          onValueChange={setSelectedExportId}
        >
          <SelectTrigger className="w-[300px] bg-rich-black border-muted-gray/30">
            <SelectValue placeholder="Select a version" />
          </SelectTrigger>
          <SelectContent className="bg-rich-black border-muted-gray/30">
            {exports.map((exp) => (
              <SelectItem key={exp.id} value={exp.id}>
                <div className="flex items-center gap-2">
                  {exp.is_current && <Star className="w-3 h-3 text-accent-yellow" />}
                  <span>
                    {exp.version_label || `Version ${exp.version_number}`}
                  </span>
                  <span className="text-muted-gray text-xs">
                    {formatDate(exp.created_at)}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Export count badge */}
        <Badge variant="outline" className="text-muted-gray border-muted-gray/30">
          {exports.length} {exports.length === 1 ? 'version' : 'versions'}
        </Badge>

        {/* Selected export info */}
        {selectedExport && (
          <div className="flex items-center gap-4 ml-auto text-sm text-muted-gray">
            {selectedExport.page_count && (
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {selectedExport.page_count} pages
              </span>
            )}
            {selectedExport.file_size && (
              <span>{formatSize(selectedExport.file_size)}</span>
            )}
            {selectedExport.created_by_profile && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {selectedExport.created_by_profile.display_name ||
                  selectedExport.created_by_profile.full_name}
              </span>
            )}
            {selectedExport.content_type && (
              <Badge variant="secondary" className="text-xs">
                {selectedExport.content_type}
              </Badge>
            )}
          </div>
        )}

        {/* Actions dropdown */}
        {selectedExport && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-rich-black border-muted-gray/30">
              <DropdownMenuItem onClick={() => handleDownload(selectedExport)}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </DropdownMenuItem>
              {!selectedExport.is_current && (
                <DropdownMenuItem onClick={() => handleSetCurrent(selectedExport.id)}>
                  <Star className="w-4 h-4 mr-2" />
                  Set as Current
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {canEdit && (
                <DropdownMenuItem
                  onClick={() => setDeleteExportId(selectedExport.id)}
                  className="text-red-400"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* ScriptyWorkspace with selected PDF */}
      <div className="flex-1 min-h-0">
        <ScriptyWorkspace
          projectId={projectId}
          canEdit={canEdit}
          continuityPdfUrl={selectedExport?.signed_url}
          sceneMappings={selectedExport?.scene_mappings}
          continuityExportId={selectedExport?.id}
          showAnnotationToolbar={true}
        />
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteExportId} onOpenChange={() => setDeleteExportId(null)}>
        <AlertDialogContent className="bg-rich-black border-muted-gray/30">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Export?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this PDF from your version history.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ContinuityView;
