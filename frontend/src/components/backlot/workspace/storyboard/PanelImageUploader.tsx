/**
 * PanelImageUploader - Drag-and-drop image upload for storyboard panels
 * Supports two modes:
 * 1. With panelId: Uploads immediately to S3
 * 2. Without panelId: Stages file for upload after panel creation
 */
import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import imageCompression from 'browser-image-compression';
import { Upload, Loader2, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePanelImageUpload } from '@/hooks/backlot';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PanelImageUploaderProps {
  projectId: string;
  storyboardId: string;
  panelId?: string | null;
  currentImageUrl?: string | null;
  onImageUploaded?: (url: string) => void;
  onImageRemoved?: () => void;
  /** Called when a file is selected (for staging before panel creation) */
  onFileSelected?: (file: File | null) => void;
  /** Preview URL for staged file (from URL.createObjectURL) */
  stagedPreviewUrl?: string | null;
  disabled?: boolean;
  /** Read-only mode: just display image, no upload/remove controls */
  readOnly?: boolean;
  className?: string;
}

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  fileType: 'image/jpeg' as const,
};

export function PanelImageUploader({
  projectId,
  storyboardId,
  panelId,
  currentImageUrl,
  onImageUploaded,
  onImageRemoved,
  onFileSelected,
  stagedPreviewUrl,
  disabled = false,
  readOnly = false,
  className,
}: PanelImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [optimisticImageUrl, setOptimisticImageUrl] = useState<string | null>(null);
  const uploadImage = usePanelImageUpload(projectId, storyboardId);

  // Determine if we're in staging mode (no panelId, has onFileSelected callback)
  const isStagingMode = !panelId && !!onFileSelected;

  // Reset optimistic URL when currentImageUrl changes
  useEffect(() => {
    if (currentImageUrl && optimisticImageUrl && currentImageUrl !== optimisticImageUrl) {
      setOptimisticImageUrl(null);
    }
  }, [currentImageUrl, optimisticImageUrl]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0 || disabled) return;

      const file = acceptedFiles[0];

      // Compress the file first
      let fileToProcess = file;
      if (file.size > 500 * 1024) {
        try {
          const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
          fileToProcess = new File([compressed], file.name, { type: compressed.type });
        } catch (err) {
          console.error('Compression failed, using original:', err);
        }
      }

      // Staging mode: just save the file for later upload
      if (isStagingMode) {
        onFileSelected(fileToProcess);
        return;
      }

      // Immediate upload mode (has panelId)
      if (!panelId) return;

      setIsUploading(true);
      setUploadProgress(10);

      try {
        setUploadProgress(50);
        const result = await uploadImage.mutateAsync({ panelId, file: fileToProcess });
        setUploadProgress(100);

        // Set optimistic URL immediately for instant feedback
        setOptimisticImageUrl(result.file_url);

        if (onImageUploaded) {
          onImageUploaded(result.file_url);
        }
        toast.success('Image uploaded');
      } catch (err: any) {
        toast.error(err.message || 'Upload failed');
        setOptimisticImageUrl(null);
      } finally {
        setIsUploading(false);
        setTimeout(() => setUploadProgress(0), 500);
      }
    },
    [panelId, disabled, uploadImage, onImageUploaded, isStagingMode, onFileSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'] },
    maxFiles: 1,
    disabled: disabled || isUploading,
  });

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isStagingMode && onFileSelected) {
        onFileSelected(null);
      } else {
        // Clear optimistic URL immediately for instant feedback
        setOptimisticImageUrl(null);
        if (onImageRemoved) {
          onImageRemoved();
        }
      }
    },
    [onImageRemoved, isStagingMode, onFileSelected]
  );

  // Display URL: use optimistic URL if available, otherwise fall back to staged preview or current URL
  const displayUrl = optimisticImageUrl || stagedPreviewUrl || currentImageUrl;

  // Show image preview if there's an image to display
  if (displayUrl) {
    // Read-only mode: just show the image, no controls
    if (readOnly) {
      return (
        <div className={cn('relative', className)}>
          <img
            src={displayUrl}
            alt="Panel reference"
            className="w-full h-full object-cover rounded"
          />
        </div>
      );
    }

    // Edit mode: show image with hover controls
    return (
      <div className={cn('relative group', className)}>
        <img
          src={displayUrl}
          alt="Panel reference"
          className="w-full h-full object-cover rounded"
        />
        {!disabled && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-2 pr-2">
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              <Button size="sm" variant="secondary" className="gap-1">
                <Upload className="w-4 h-4" />
                Replace
              </Button>
            </div>
            <Button
              size="sm"
              variant="destructive"
              className="gap-1"
              onClick={handleRemove}
            >
              <X className="w-4 h-4" />
              Remove
            </Button>
          </div>
        )}
        {isStagingMode && stagedPreviewUrl && (
          <div className="absolute bottom-1 left-1 bg-black/70 text-xs text-accent-yellow px-2 py-0.5 rounded">
            Will upload on save
          </div>
        )}
      </div>
    );
  }

  // Read-only mode with no image: show placeholder
  if (readOnly) {
    return (
      <div
        className={cn(
          'w-full h-full min-h-[80px] border border-white/10 rounded flex flex-col items-center justify-center bg-white/5',
          className
        )}
      >
        <ImageIcon className="w-6 h-6 text-muted-gray" />
      </div>
    );
  }

  // Show upload dropzone
  return (
    <div
      {...getRootProps()}
      className={cn(
        'w-full h-full min-h-[80px] border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer transition-colors',
        isDragActive
          ? 'border-accent-yellow bg-accent-yellow/10'
          : 'border-white/20 hover:border-white/40',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <input {...getInputProps()} />
      {isUploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-muted-gray" />
          <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-yellow transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      ) : (
        <>
          <ImageIcon className="w-8 h-8 text-muted-gray mb-2" />
          <p className="text-xs text-muted-gray text-center px-2">
            {isDragActive ? 'Drop image here' : 'Drop image or click to upload'}
          </p>
        </>
      )}
    </div>
  );
}

export default PanelImageUploader;
