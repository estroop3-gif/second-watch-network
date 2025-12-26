/**
 * AttachmentUploader - Drag and drop file upload for message attachments
 */
import React, { useCallback, useState, useRef } from 'react';
import { X, Paperclip, FileText, Image, Film, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export interface AttachmentFile {
  id: string;
  filename: string;
  original_filename: string;
  url: string;
  content_type: string;
  size: number;
  type: 'image' | 'video' | 'audio' | 'file';
  preview?: string;
}

interface AttachmentUploaderProps {
  conversationId?: string;
  attachments: AttachmentFile[];
  onAttachmentsChange: (attachments: AttachmentFile[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'
]);

const ALLOWED_FILE_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/zip',
  'application/x-rar-compressed',
]);

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;  // 50 MB

function getFileType(contentType: string): 'image' | 'video' | 'audio' | 'file' {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  return 'file';
}

function getFileIcon(type: string) {
  switch (type) {
    case 'image': return Image;
    case 'video': return Film;
    case 'audio': return Music;
    default: return FileText;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface UploadingFile {
  file: File;
  progress: number;
  error?: string;
}

export function AttachmentUploader({
  conversationId,
  attachments,
  onAttachmentsChange,
  maxFiles = 10,
  disabled = false,
}: AttachmentUploaderProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);

  const validateFile = useCallback((file: File): string | null => {
    const isImage = ALLOWED_IMAGE_TYPES.has(file.type);
    const isAllowedFile = ALLOWED_FILE_TYPES.has(file.type);

    if (!isImage && !isAllowedFile) {
      return `File type "${file.type || 'unknown'}" is not allowed`;
    }

    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
    if (file.size > maxSize) {
      return `File too large. Maximum size is ${formatFileSize(maxSize)}`;
    }

    return null;
  }, []);

  const uploadFile = useCallback(async (file: File): Promise<AttachmentFile | null> => {
    if (!user?.id) return null;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', user.id);
    if (conversationId) {
      formData.append('conversation_id', conversationId);
    }

    try {
      const response = await api.post('/uploads/message-attachment', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploading(prev =>
            prev.map(u => u.file === file ? { ...u, progress } : u)
          );
        },
      });

      const data = response.data;
      const fileType = getFileType(data.content_type);

      return {
        id: data.id,
        filename: data.filename,
        original_filename: data.original_filename,
        url: data.url,
        content_type: data.content_type,
        size: data.size,
        type: fileType,
        preview: fileType === 'image' ? data.url : undefined,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUploading(prev =>
        prev.map(u => u.file === file ? { ...u, error: errorMessage } : u)
      );
      return null;
    }
  }, [user?.id, conversationId]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    if (disabled) return;

    const fileArray = Array.from(files);
    const remainingSlots = maxFiles - attachments.length;
    const filesToUpload = fileArray.slice(0, remainingSlots);

    // Validate all files first
    const validFiles: File[] = [];
    for (const file of filesToUpload) {
      const error = validateFile(file);
      if (error) {
        console.error(`File ${file.name}: ${error}`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    // Start uploading
    setUploading(prev => [
      ...prev,
      ...validFiles.map(file => ({ file, progress: 0 }))
    ]);

    // Upload files concurrently
    const uploadPromises = validFiles.map(async (file) => {
      const result = await uploadFile(file);
      return { file, result };
    });

    const results = await Promise.all(uploadPromises);

    // Add successful uploads to attachments
    const successfulUploads = results
      .filter(r => r.result !== null)
      .map(r => r.result as AttachmentFile);

    if (successfulUploads.length > 0) {
      onAttachmentsChange([...attachments, ...successfulUploads]);
    }

    // Remove completed uploads from uploading state
    setUploading(prev =>
      prev.filter(u => !validFiles.includes(u.file) || u.error)
    );
  }, [disabled, maxFiles, attachments, validateFile, uploadFile, onAttachmentsChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      handleFiles(files);
    }
  }, [handleFiles]);

  const handleRemoveAttachment = useCallback((id: string) => {
    onAttachmentsChange(attachments.filter(a => a.id !== id));
  }, [attachments, onAttachmentsChange]);

  const handleButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = ''; // Reset input
    }
  }, [handleFiles]);

  const canAddMore = attachments.length < maxFiles && !disabled;

  return (
    <div
      onPaste={handlePaste}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={[...ALLOWED_IMAGE_TYPES, ...ALLOWED_FILE_TYPES].join(',')}
        className="hidden"
        onChange={handleFileInputChange}
        disabled={disabled}
      />

      {/* Drop zone overlay when dragging */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-blue-500/10 flex items-center justify-center pointer-events-none">
          <div className="bg-background border-2 border-dashed border-blue-500 rounded-lg p-8 text-center">
            <Paperclip className="h-12 w-12 mx-auto mb-4 text-blue-500" />
            <p className="text-lg font-medium">Drop files to upload</p>
            <p className="text-sm text-muted-foreground">
              Up to {maxFiles - attachments.length} more files
            </p>
          </div>
        </div>
      )}

      {/* Attachment previews - shows above the input */}
      {(attachments.length > 0 || uploading.length > 0) && (
        <div className="flex flex-wrap gap-2 p-3 pb-2">
          {/* Existing attachments */}
          {attachments.map(attachment => {
            const IconComponent = getFileIcon(attachment.type);
            return (
              <div
                key={attachment.id}
                className="relative group flex items-center gap-2 p-2 bg-muted rounded-md max-w-[200px]"
              >
                {attachment.type === 'image' && attachment.preview ? (
                  <img
                    src={attachment.preview}
                    alt={attachment.original_filename}
                    className="w-10 h-10 object-cover rounded"
                  />
                ) : (
                  <div className="w-10 h-10 flex items-center justify-center bg-background rounded">
                    <IconComponent className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {attachment.original_filename}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(attachment.id)}
                  className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}

          {/* Uploading files */}
          {uploading.map((upload, index) => (
            <div
              key={`uploading-${index}`}
              className="flex items-center gap-2 p-2 bg-muted rounded-md max-w-[200px]"
            >
              <div className="w-10 h-10 flex items-center justify-center bg-background rounded">
                <Paperclip className="h-5 w-5 text-muted-foreground animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{upload.file.name}</p>
                {upload.error ? (
                  <p className="text-xs text-destructive">{upload.error}</p>
                ) : (
                  <Progress value={upload.progress} className="h-1 mt-1" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Attachment button - inline with input */}
      <div className="px-3 pt-3 pb-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleButtonClick}
          disabled={!canAddMore}
          className="h-7 px-2 text-muted-foreground hover:text-foreground"
          title={canAddMore ? 'Add attachment' : `Maximum ${maxFiles} files`}
        >
          <Paperclip className="h-4 w-4 mr-1" />
          <span className="text-xs">Attach</span>
        </Button>
      </div>
    </div>
  );
}
