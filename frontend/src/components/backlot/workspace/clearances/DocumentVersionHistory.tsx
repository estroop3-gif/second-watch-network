/**
 * DocumentVersionHistory - Version history panel for clearance documents
 * Shows all versions with ability to view/restore old versions
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  History,
  Eye,
  RotateCcw,
  User,
  Clock,
  FileText,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';
import {
  useClearanceDocumentVersions,
  useRestoreClearanceVersion,
} from '@/hooks/backlot/useClearances';
import { ClearanceDocumentVersion, getClearanceFileType } from '@/types/backlot';
import { ClearanceDocumentViewer } from './ClearanceDocumentViewer';

interface DocumentVersionHistoryProps {
  clearanceId: string;
  canEdit?: boolean;
}

export function DocumentVersionHistory({
  clearanceId,
  canEdit = false,
}: DocumentVersionHistoryProps) {
  const [viewingVersion, setViewingVersion] = useState<ClearanceDocumentVersion | null>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [versionToRestore, setVersionToRestore] = useState<ClearanceDocumentVersion | null>(null);

  const { data: versions, isLoading } = useClearanceDocumentVersions(clearanceId);
  const restoreMutation = useRestoreClearanceVersion();

  const handleRestore = async () => {
    if (!versionToRestore) return;

    try {
      await restoreMutation.mutateAsync({
        clearanceId,
        versionId: versionToRestore.id,
      });
      toast.success('Version restored', {
        description: `Restored to version ${versionToRestore.version_number}`,
      });
      setRestoreConfirmOpen(false);
      setVersionToRestore(null);
    } catch (error) {
      toast.error('Failed to restore version');
    }
  };

  const formatFileSize = (bytes: number | null | undefined): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <History className="h-4 w-4" />
          Version History
        </div>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!versions || versions.length === 0) {
    return null;
  }

  // Don't show version history if there's only one version
  if (versions.length === 1) {
    return null;
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <History className="h-4 w-4" />
          Version History ({versions.length})
        </div>

        <ScrollArea className="max-h-[300px]">
          <div className="space-y-2 pr-2">
            {versions.map((version) => {
              const fileType = getClearanceFileType(version.file_name);

              return (
                <div
                  key={version.id}
                  className="flex items-start gap-3 p-3 bg-muted-gray/10 rounded-lg border border-muted-gray/20"
                >
                  {/* Version indicator */}
                  <div className="flex-shrink-0">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium
                      ${version.is_current
                        ? 'bg-green-500/20 text-green-500 border-2 border-green-500'
                        : 'bg-muted-gray/20 text-muted-foreground border border-muted-gray/30'
                      }
                    `}>
                      v{version.version_number}
                    </div>
                  </div>

                  {/* Version info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate max-w-[200px]">
                        {version.file_name}
                      </span>
                      {version.is_current && (
                        <Badge className="bg-green-500 text-white text-xs px-1.5 py-0">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Current
                        </Badge>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                      {version.uploaded_by_name && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {version.uploaded_by_name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span title={format(new Date(version.created_at), 'PPpp')}>
                          {formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
                        </span>
                      </span>
                      {version.file_size && (
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {formatFileSize(version.file_size)}
                        </span>
                      )}
                    </div>

                    {/* Notes */}
                    {version.notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        {version.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setViewingVersion(version)}
                      title="View this version"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>

                    {canEdit && !version.is_current && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-orange-500 hover:text-orange-400"
                        onClick={() => {
                          setVersionToRestore(version);
                          setRestoreConfirmOpen(true);
                        }}
                        title="Restore this version"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Version viewer dialog */}
      <Dialog open={viewingVersion !== null} onOpenChange={(open) => !open && setViewingVersion(null)}>
        <DialogContent className="max-w-6xl h-[90vh] p-0 gap-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Version {viewingVersion?.version_number}
              {viewingVersion?.is_current && (
                <Badge className="bg-green-500">Current</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {viewingVersion?.file_name}
              {viewingVersion?.uploaded_by_name && ` - Uploaded by ${viewingVersion.uploaded_by_name}`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden border-t border-muted-gray/20 mt-2">
            {viewingVersion && (
              <ClearanceDocumentViewer
                fileUrl={viewingVersion.file_url}
                fileName={viewingVersion.file_name}
                fileSize={viewingVersion.file_size}
                contentType={viewingVersion.content_type}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore confirmation dialog */}
      <Dialog open={restoreConfirmOpen} onOpenChange={setRestoreConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Version?</DialogTitle>
            <DialogDescription>
              This will create a new version from version {versionToRestore?.version_number}.
              The current document will be preserved as a previous version.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="p-3 bg-muted-gray/10 rounded-lg border border-muted-gray/20">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">v{versionToRestore?.version_number}</Badge>
                <span className="text-sm font-medium">{versionToRestore?.file_name}</span>
              </div>
              {versionToRestore?.uploaded_by_name && (
                <p className="text-xs text-muted-foreground">
                  Uploaded by {versionToRestore.uploaded_by_name} on{' '}
                  {versionToRestore?.created_at && format(new Date(versionToRestore.created_at), 'PPp')}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRestore}
              disabled={restoreMutation.isPending}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {restoreMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restore Version
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
