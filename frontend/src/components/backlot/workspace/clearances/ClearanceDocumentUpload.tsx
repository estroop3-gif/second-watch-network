/**
 * ClearanceDocumentUpload - Drag-and-drop document upload for clearances
 * With inline viewing, version history, and spreadsheet support
 */
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useClearanceDocumentUpload, useClearanceDocumentRemove, useClearanceDocumentVersions } from '@/hooks/backlot/useClearances';
import { getClearanceFileType, getClearanceFileTypeLabel } from '@/types/backlot';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  FileSpreadsheet,
  Image,
  X,
  Download,
  Eye,
  Loader2,
  AlertCircle,
  CheckCircle,
  History,
} from 'lucide-react';
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
import { ClearanceDocumentViewer } from './ClearanceDocumentViewer';
import { DocumentVersionHistory } from './DocumentVersionHistory';

interface ClearanceDocumentUploadProps {
  clearanceId: string;
  currentFileUrl?: string | null;
  currentFileName?: string | null;
  isSensitive?: boolean;
  onUploadComplete?: (fileUrl: string, fileName: string) => void;
  onRemoveComplete?: () => void;
  disabled?: boolean;
}

export function ClearanceDocumentUpload({
  clearanceId,
  currentFileUrl,
  currentFileName,
  isSensitive = false,
  onUploadComplete,
  onRemoveComplete,
  disabled = false,
}: ClearanceDocumentUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const uploadMutation = useClearanceDocumentUpload();
  const removeMutation = useClearanceDocumentRemove();
  const { data: versions } = useClearanceDocumentVersions(clearanceId);

  const versionCount = versions?.length || 0;
  const fileType = currentFileName ? getClearanceFileType(currentFileName) : 'other';

  // Get appropriate icon for file type
  const FileIcon = fileType === 'spreadsheet' ? FileSpreadsheet : fileType === 'image' ? Image : FileText;

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0 || disabled) return;

      const file = acceptedFiles[0];

      // Validate file size (max 25MB)
      if (file.size > 25 * 1024 * 1024) {
        toast.error('File too large', {
          description: 'Maximum file size is 25MB',
        });
        return;
      }

      setIsUploading(true);
      setUploadProgress(10);

      try {
        // Simulate progress during upload
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 10, 90));
        }, 200);

        const result = await uploadMutation.mutateAsync({
          clearanceId,
          file,
        });

        clearInterval(progressInterval);
        setUploadProgress(100);

        toast.success('Document uploaded', {
          description: `${file.name} has been uploaded successfully`,
        });

        onUploadComplete?.(result.file_url, result.file_name);
      } catch (error) {
        toast.error('Upload failed', {
          description: error instanceof Error ? error.message : 'Failed to upload document',
        });
      } finally {
        setIsUploading(false);
        setTimeout(() => setUploadProgress(0), 500);
      }
    },
    [clearanceId, disabled, uploadMutation, onUploadComplete]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      // Spreadsheet types
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    disabled: disabled || isUploading,
  });

  const handleRemove = async () => {
    try {
      await removeMutation.mutateAsync(clearanceId);
      toast.success('Document removed');
      onRemoveComplete?.();
      setShowRemoveDialog(false);
    } catch (error) {
      toast.error('Failed to remove document', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleView = () => {
    if (currentFileUrl) {
      setViewerOpen(true);
    }
  };

  const handleDownload = () => {
    if (currentFileUrl && currentFileName) {
      const link = document.createElement('a');
      link.href = currentFileUrl;
      link.download = currentFileName;
      link.click();
    }
  };

  // If we have a file, show file info with actions
  if (currentFileUrl && currentFileName) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 bg-muted-gray/20 rounded-lg border border-muted-gray/30">
          <div className="h-10 w-10 rounded bg-primary-red/10 flex items-center justify-center flex-shrink-0">
            <FileIcon className="h-5 w-5 text-primary-red" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate">{currentFileName}</p>
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                {getClearanceFileTypeLabel(fileType)}
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span>Uploaded</span>
              {versionCount > 1 && (
                <>
                  <span className="mx-1">•</span>
                  <History className="h-3 w-3" />
                  <span>{versionCount} versions</span>
                </>
              )}
              {isSensitive && (
                <>
                  <span className="mx-1">•</span>
                  <AlertCircle className="h-3 w-3 text-yellow-500" />
                  <span>Sensitive</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleView}
              title="View document"
            >
              <Eye className="h-4 w-4" />
            </Button>
            {!isSensitive && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleDownload}
                title="Download document"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            {versionCount > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowVersionHistory(!showVersionHistory)}
                title="Version history"
              >
                <History className="h-4 w-4" />
              </Button>
            )}
            {!disabled && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setShowRemoveDialog(true)}
                title="Remove document"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Version history panel */}
        {showVersionHistory && versionCount > 1 && (
          <div className="p-3 bg-muted-gray/10 rounded-lg border border-muted-gray/20">
            <DocumentVersionHistory clearanceId={clearanceId} canEdit={!disabled} />
          </div>
        )}

        {/* Replace file dropzone (smaller) */}
        {!disabled && (
          <div
            {...getRootProps()}
            className="flex items-center justify-center gap-2 p-2 border border-dashed border-muted-gray/50 rounded-lg cursor-pointer hover:border-primary-red/50 transition-colors"
          >
            <input {...getInputProps()} />
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Upload new version</span>
          </div>
        )}

        {/* Document viewer dialog */}
        <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
          <DialogContent className="max-w-6xl h-[90vh] p-0 gap-0">
            <DialogHeader className="p-4 pb-0">
              <DialogTitle className="flex items-center gap-2">
                <FileIcon className="h-5 w-5" />
                {currentFileName}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden border-t border-muted-gray/20 mt-2">
              <ClearanceDocumentViewer
                fileUrl={currentFileUrl}
                fileName={currentFileName}
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Remove confirmation dialog */}
        <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Document</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove "{currentFileName}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemove}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {removeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Remove'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // No file - show upload dropzone
  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={`
          flex flex-col items-center justify-center gap-2 p-6
          border-2 border-dashed rounded-lg cursor-pointer
          transition-colors
          ${isDragActive ? 'border-primary-red bg-primary-red/5' : 'border-muted-gray/50 hover:border-primary-red/50'}
          ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        {isUploading ? (
          <>
            <Loader2 className="h-8 w-8 text-primary-red animate-spin" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
          </>
        ) : isDragActive ? (
          <>
            <Upload className="h-8 w-8 text-primary-red" />
            <p className="text-sm text-primary-red font-medium">Drop file here</p>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-muted-foreground">
              PDF, DOC, DOCX, XLS, XLSX, CSV, or images (max 25MB)
            </p>
          </>
        )}
      </div>

      {isUploading && (
        <Progress value={uploadProgress} className="h-1" />
      )}
    </div>
  );
}
