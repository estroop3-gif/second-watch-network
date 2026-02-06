/**
 * FileUploadModal - Multi-file upload modal for the Assets tab.
 * Supports drag-and-drop and click-to-browse with per-file progress tracking.
 */
import React, { useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Upload, X, CheckCircle2, AlertCircle, Loader2,
  FileVideo, Music, Image, FileText, Box, File,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface FileUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  folderId: string | null;
}

type FileUploadStatus = 'pending' | 'uploading' | 'complete' | 'error';

interface UploadFileEntry {
  id: string;
  file: File;
  status: FileUploadStatus;
  progress: number;
  error?: string;
}

function getFileIcon(file: File) {
  const type = file.type;
  const ext = file.name.rsplit?.('.', 1)?.[1]?.toLowerCase() ?? file.name.split('.').pop()?.toLowerCase() ?? '';

  if (type.startsWith('video/') || ['mp4', 'mov', 'avi', 'webm', 'mkv', 'mxf', 'r3d'].includes(ext))
    return <FileVideo className="w-5 h-5 text-blue-400" />;
  if (type.startsWith('audio/') || ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'].includes(ext))
    return <Music className="w-5 h-5 text-purple-400" />;
  if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff', 'tif', 'exr', 'dpx'].includes(ext))
    return <Image className="w-5 h-5 text-green-400" />;
  if (type === 'application/pdf' || type.startsWith('text/') || ['doc', 'docx', 'txt', 'rtf', 'pages', 'pdf'].includes(ext))
    return <FileText className="w-5 h-5 text-orange-400" />;
  if (['fbx', 'obj', 'gltf', 'glb', 'blend', 'usd', 'usdc', 'usdz', 'c4d', 'ma', 'mb'].includes(ext))
    return <Box className="w-5 h-5 text-cyan-400" />;
  if (['psd', 'ai', 'svg', 'eps', 'sketch', 'fig', 'xd'].includes(ext))
    return <Image className="w-5 h-5 text-pink-400" />;
  return <File className="w-5 h-5 text-muted-gray" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function uploadToS3(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.min((e.loaded / e.total) * 100, 99));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed with status ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(file);
  });
}

let entryCounter = 0;

export function FileUploadModal({ open, onOpenChange, projectId, folderId }: FileUploadModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<UploadFileEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newEntries: UploadFileEntry[] = Array.from(files).map((file) => ({
      id: `upload-${++entryCounter}`,
      file,
      status: 'pending' as const,
      progress: 0,
    }));
    setEntries((prev) => [...prev, ...newEntries]);
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const updateEntry = useCallback((id: string, updates: Partial<UploadFileEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = '';
    }
  }, [addFiles]);

  const uploadAll = useCallback(async () => {
    const pending = entries.filter((e) => e.status === 'pending' || e.status === 'error');
    if (pending.length === 0) return;

    setIsUploading(true);

    for (const entry of pending) {
      updateEntry(entry.id, { status: 'uploading', progress: 0, error: undefined });

      try {
        // 1. Get presigned URL (creates standalone asset record)
        const { upload_url } = await api.getAssetUploadUrl(projectId, {
          filename: entry.file.name,
          content_type: entry.file.type || 'application/octet-stream',
          folder_id: folderId,
        });

        // 2. Upload file to S3
        await uploadToS3(upload_url, entry.file, (pct) => {
          updateEntry(entry.id, { progress: pct });
        });

        updateEntry(entry.id, { status: 'complete', progress: 100 });
      } catch (err: any) {
        updateEntry(entry.id, {
          status: 'error',
          error: err?.message || 'Upload failed',
        });
      }
    }

    setIsUploading(false);

    // Invalidate asset queries so the grid refreshes
    queryClient.invalidateQueries({ queryKey: ['backlot-standalone-assets'] });
    queryClient.invalidateQueries({ queryKey: ['backlot-unified-assets'] });
  }, [entries, projectId, folderId, updateEntry, queryClient]);

  const handleClose = () => {
    if (!isUploading) {
      setEntries([]);
      onOpenChange(false);
    }
  };

  const allComplete = entries.length > 0 && entries.every((e) => e.status === 'complete');
  const hasPendingOrError = entries.some((e) => e.status === 'pending' || e.status === 'error');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl bg-charcoal-black border-muted-gray/20">
        <DialogHeader>
          <DialogTitle className="text-bone-white">Upload Files</DialogTitle>
          <DialogDescription className="text-muted-gray">
            Upload files to {folderId ? 'the current folder' : 'your project assets'}
          </DialogDescription>
        </DialogHeader>

        {/* Drop zone */}
        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
            isDragOver
              ? 'border-accent-yellow bg-accent-yellow/10'
              : 'border-muted-gray/30 hover:border-accent-yellow/50',
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-8 h-8 text-muted-gray mx-auto mb-2" />
          <p className="text-sm text-bone-white">Drag and drop files here</p>
          <p className="text-xs text-muted-gray mt-1">or click to browse</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {/* File list */}
        {entries.length > 0 && (
          <div className="max-h-64 overflow-y-auto space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 bg-charcoal-black/80 border border-muted-gray/20 rounded-lg px-3 py-2"
              >
                {getFileIcon(entry.file)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-bone-white truncate">{entry.file.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-gray">{formatFileSize(entry.file.size)}</span>
                    {entry.status === 'uploading' && (
                      <span className="text-xs text-accent-yellow">{Math.round(entry.progress)}%</span>
                    )}
                    {entry.status === 'error' && (
                      <span className="text-xs text-primary-red">{entry.error}</span>
                    )}
                  </div>
                  {entry.status === 'uploading' && (
                    <div className="w-full bg-muted-gray/20 rounded-full h-1 mt-1">
                      <div
                        className="bg-accent-yellow h-1 rounded-full transition-all"
                        style={{ width: `${entry.progress}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {entry.status === 'complete' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                  {entry.status === 'error' && <AlertCircle className="w-4 h-4 text-primary-red" />}
                  {entry.status === 'uploading' && <Loader2 className="w-4 h-4 text-accent-yellow animate-spin" />}
                  {entry.status === 'pending' && (
                    <button onClick={(e) => { e.stopPropagation(); removeEntry(entry.id); }} className="text-muted-gray hover:text-bone-white">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            {allComplete ? 'Done' : 'Cancel'}
          </Button>
          {hasPendingOrError && (
            <Button
              onClick={uploadAll}
              disabled={isUploading}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload {entries.filter((e) => e.status === 'pending' || e.status === 'error').length} file{entries.filter((e) => e.status === 'pending' || e.status === 'error').length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
