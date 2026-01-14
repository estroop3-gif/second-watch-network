/**
 * MoodboardItemUploader - Drag-and-drop image upload for moodboard items
 * Automatically extracts color palette and aspect ratio from uploaded images.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import imageCompression from 'browser-image-compression';
import { Upload, Loader2, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMoodboardItemImageUpload, type AspectRatio } from '@/hooks/backlot';
import { analyzeImageFile } from '@/lib/colorExtraction';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MoodboardItemUploaderProps {
  /** Required for immediate upload mode, optional for staging mode */
  projectId?: string;
  /** Required for immediate upload mode, optional for staging mode */
  moodboardId?: string;
  currentImageUrl?: string | null;
  onImageUploaded?: (data: {
    url: string;
    colorPalette: string[];
    aspectRatio: AspectRatio;
  }) => void;
  onImageRemoved?: () => void;
  /** For staging mode before item creation - when provided, skips upload */
  onFileStaged?: (data: {
    file: File;
    previewUrl: string;
    colorPalette: string[];
    aspectRatio: AspectRatio;
  } | null) => void;
  stagedPreviewUrl?: string | null;
  disabled?: boolean;
  className?: string;
}

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  fileType: 'image/jpeg' as const,
};

export function MoodboardItemUploader({
  projectId,
  moodboardId,
  currentImageUrl,
  onImageUploaded,
  onImageRemoved,
  onFileStaged,
  stagedPreviewUrl,
  disabled = false,
  className,
}: MoodboardItemUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Staging mode: has onFileStaged callback (skips upload)
  const isStagingMode = !!onFileStaged;

  // Only initialize upload hook when not in staging mode and have required IDs
  const getUploadUrl = useMoodboardItemImageUpload(
    isStagingMode ? undefined : projectId,
    isStagingMode ? undefined : moodboardId
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0 || disabled) return;

      const originalFile = acceptedFiles[0];

      // Validate file type
      if (!originalFile.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }

      // Validate file size (max 20MB)
      if (originalFile.size > 20 * 1024 * 1024) {
        toast.error('Image must be smaller than 20MB');
        return;
      }

      setIsAnalyzing(true);

      try {
        // Compress the file
        let fileToProcess = originalFile;
        if (originalFile.size > 500 * 1024) {
          try {
            const compressed = await imageCompression(originalFile, COMPRESSION_OPTIONS);
            fileToProcess = new File([compressed], originalFile.name, { type: compressed.type });
          } catch (err) {
            console.warn('Image compression failed, using original file:', err);
            // Continue with original file
          }
        }

        // Analyze the image for colors and aspect ratio
        let colorPalette: string[] = [];
        let aspectRatio: AspectRatio = 'square';
        try {
          const analysis = await analyzeImageFile(fileToProcess);
          colorPalette = analysis.colorPalette;
          aspectRatio = analysis.aspectRatio;
        } catch (err) {
          console.warn('Image analysis failed, using defaults:', err);
          // Continue with default values
        }

        // Staging mode: save file for later
        if (isStagingMode) {
          const previewUrl = URL.createObjectURL(fileToProcess);
          onFileStaged({
            file: fileToProcess,
            previewUrl,
            colorPalette,
            aspectRatio,
          });
          setIsAnalyzing(false);
          toast.success('Image ready');
          return;
        }

        // Immediate upload mode - validate required props
        if (!projectId || !moodboardId) {
          toast.error('Cannot upload: moodboard not selected');
          setIsAnalyzing(false);
          return;
        }

        setIsAnalyzing(false);
        setIsUploading(true);
        setUploadProgress(20);

        // Get presigned URL
        let upload_url: string;
        let file_url: string;
        try {
          const result = await getUploadUrl.mutateAsync({
            file_name: fileToProcess.name,
            content_type: fileToProcess.type || 'image/jpeg',
            file_size: fileToProcess.size,
          });
          upload_url = result.upload_url;
          file_url = result.file_url;
        } catch (err: any) {
          throw new Error(err.message || 'Failed to get upload URL');
        }

        setUploadProgress(50);

        // Upload to S3
        try {
          const uploadResponse = await fetch(upload_url, {
            method: 'PUT',
            body: fileToProcess,
            headers: {
              'Content-Type': fileToProcess.type || 'image/jpeg',
            },
          });

          if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.status}`);
          }
        } catch (err: any) {
          if (err.message?.includes('Failed to fetch')) {
            throw new Error('Network error - please check your connection');
          }
          throw new Error(err.message || 'Failed to upload image');
        }

        setUploadProgress(100);

        if (onImageUploaded) {
          onImageUploaded({
            url: file_url,
            colorPalette,
            aspectRatio,
          });
        }

        toast.success('Image uploaded');
      } catch (err: any) {
        console.error('Upload error:', err);
        toast.error(err.message || 'Upload failed');
      } finally {
        setIsUploading(false);
        setIsAnalyzing(false);
        setTimeout(() => setUploadProgress(0), 500);
      }
    },
    [disabled, getUploadUrl, onImageUploaded, isStagingMode, onFileStaged, projectId, moodboardId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'] },
    maxFiles: 1,
    disabled: disabled || isUploading || isAnalyzing,
  });

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isStagingMode && onFileStaged) {
        onFileStaged(null);
      } else if (onImageRemoved) {
        onImageRemoved();
      }
    },
    [onImageRemoved, isStagingMode, onFileStaged]
  );

  const displayUrl = stagedPreviewUrl || currentImageUrl;

  // Show image preview if there's an image
  if (displayUrl) {
    return (
      <div className={cn('relative aspect-video rounded-lg overflow-hidden group', className)}>
        <img
          src={displayUrl}
          alt="Upload preview"
          className="w-full h-full object-contain bg-white/5"
        />
        {!disabled && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              {...getRootProps()}
              onClick={(e) => e.stopPropagation()}
            >
              <input {...getInputProps()} />
              Replace
            </Button>
            <Button variant="destructive" size="sm" onClick={handleRemove}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
        {(isUploading || isAnalyzing) && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p className="text-sm">
                {isAnalyzing ? 'Analyzing...' : `Uploading ${uploadProgress}%`}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Empty state - show dropzone
  return (
    <div
      {...getRootProps()}
      className={cn(
        'aspect-video border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors',
        isDragActive
          ? 'border-primary-red bg-primary-red/10'
          : 'border-white/20 hover:border-white/40',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <input {...getInputProps()} />
      {isUploading || isAnalyzing ? (
        <>
          <Loader2 className="w-8 h-8 animate-spin text-muted-gray" />
          <p className="text-sm text-muted-gray">
            {isAnalyzing ? 'Analyzing image...' : `Uploading ${uploadProgress}%`}
          </p>
        </>
      ) : isDragActive ? (
        <>
          <Upload className="w-8 h-8 text-primary-red" />
          <p className="text-sm text-primary-red">Drop image here</p>
        </>
      ) : (
        <>
          <ImageIcon className="w-8 h-8 text-muted-gray" />
          <p className="text-sm text-muted-gray">Drag & drop or click to upload</p>
          <p className="text-xs text-muted-gray/60">JPG, PNG, GIF, WebP</p>
        </>
      )}
    </div>
  );
}
