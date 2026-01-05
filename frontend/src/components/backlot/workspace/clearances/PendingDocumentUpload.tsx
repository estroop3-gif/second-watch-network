/**
 * PendingDocumentUpload - Pre-creation file picker for clearance documents
 * Stores File object locally, uploads after clearance is created
 */
import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  FileSpreadsheet,
  Image,
  X,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { getClearanceFileType, getClearanceFileTypeLabel } from '@/types/backlot';
import { cn } from '@/lib/utils';

interface PendingDocumentUploadProps {
  file: File | null;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PendingDocumentUpload({
  file,
  onFileSelect,
  onRemove,
  disabled = false,
}: PendingDocumentUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);

  // Generate image preview URL
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreview(null);
    }
  }, [file]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0 || disabled) return;

      const selectedFile = acceptedFiles[0];

      // Validate file size (max 25MB)
      if (selectedFile.size > 25 * 1024 * 1024) {
        toast.error('File too large', {
          description: 'Maximum file size is 25MB',
        });
        return;
      }

      onFileSelect(selectedFile);
    },
    [disabled, onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    disabled,
  });

  // Get appropriate icon and color for file type
  const getFileIconConfig = (fileName: string) => {
    const fileType = getClearanceFileType(fileName);
    if (fileType === 'spreadsheet') {
      return { icon: FileSpreadsheet, color: 'text-green-400', bg: 'bg-green-500/20' };
    }
    if (fileType === 'image') {
      return { icon: Image, color: 'text-blue-400', bg: 'bg-blue-500/20' };
    }
    if (fileName.toLowerCase().endsWith('.pdf')) {
      return { icon: FileText, color: 'text-red-400', bg: 'bg-red-500/20' };
    }
    return { icon: FileText, color: 'text-gray-500', bg: 'bg-gray-500/20' };
  };

  // If we have a file, show file info with remove option
  if (file) {
    const iconConfig = getFileIconConfig(file.name);
    const FileIcon = iconConfig.icon;
    const fileType = getClearanceFileType(file.name);

    return (
      <div className="space-y-2">
        {/* Image preview for image files */}
        {preview && (
          <div className="relative w-full h-32 rounded-lg overflow-hidden bg-muted-gray/20">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-contain"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
          </div>
        )}

        {/* File info */}
        <div className="flex items-center gap-3 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
          <div className={cn('h-10 w-10 rounded flex items-center justify-center flex-shrink-0', iconConfig.bg)}>
            <FileIcon className={cn('h-5 w-5', iconConfig.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-bone-white truncate">{file.name}</p>
              <Badge variant="outline" className="text-xs px-1.5 py-0 border-green-500/30 text-green-400">
                {getClearanceFileTypeLabel(fileType)}
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span>Ready to upload ({formatFileSize(file.size)})</span>
            </div>
          </div>
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-red-400"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              title="Remove file"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // No file - show upload dropzone
  return (
    <div
      {...getRootProps()}
      className={cn(
        'flex flex-col items-center justify-center gap-2 p-6',
        'border-2 border-dashed rounded-lg cursor-pointer',
        'transition-all duration-200',
        isDragActive && !isDragReject && 'border-primary-red bg-primary-red/10 scale-[1.02]',
        isDragReject && 'border-red-500 bg-red-500/10',
        !isDragActive && !isDragReject && 'border-muted-gray/50 hover:border-primary-red/50 hover:bg-primary-red/5',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <input {...getInputProps()} />
      {isDragReject ? (
        <>
          <AlertCircle className="h-8 w-8 text-red-400" />
          <span className="text-sm text-red-400 font-medium">File type not supported</span>
          <span className="text-xs text-muted-foreground">
            Use PDF, images, Word, or Excel files
          </span>
        </>
      ) : isDragActive ? (
        <>
          <Upload className="h-8 w-8 text-primary-red animate-bounce" />
          <span className="text-sm text-primary-red font-medium">Drop file here</span>
        </>
      ) : (
        <>
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="text-sm text-muted-foreground text-center">
            <span className="font-medium text-foreground">Click to upload</span> or drag and drop
          </div>
          <span className="text-xs text-muted-foreground">
            PDF, Images, Word, Excel (max 25MB)
          </span>
        </>
      )}
    </div>
  );
}
