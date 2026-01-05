/**
 * Video Uploader Component
 * Multipart upload with progress tracking for creators
 */

import React, { useState, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { videoApi } from '@/lib/api/watch';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Upload,
  Video,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Film,
  FileVideo,
} from 'lucide-react';

// Chunk size for multipart upload (100MB)
const CHUNK_SIZE = 100 * 1024 * 1024;

interface VideoUploaderProps {
  worldId?: string;
  onUploadComplete?: (videoAssetId: string) => void;
  onCancel?: () => void;
  className?: string;
}

type UploadStatus = 'idle' | 'preparing' | 'uploading' | 'completing' | 'transcoding' | 'complete' | 'error';

interface UploadState {
  status: UploadStatus;
  progress: number;
  videoAssetId?: string;
  error?: string;
  transcodingProgress?: number;
}

export function VideoUploader({
  worldId,
  onUploadComplete,
  onCancel,
  className,
}: VideoUploaderProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
  });

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.type.startsWith('video/')) {
      setUploadState({
        status: 'error',
        progress: 0,
        error: 'Please select a video file',
      });
      return;
    }

    setFile(selectedFile);
    setTitle(selectedFile.name.replace(/\.[^/.]+$/, '')); // Remove extension for title
    setUploadState({ status: 'idle', progress: 0 });
  }, []);

  // Upload file in chunks
  const uploadFile = async () => {
    if (!file) return;

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      // Step 1: Initiate upload
      setUploadState({ status: 'preparing', progress: 0 });

      const initResponse = await videoApi.initiateUpload(file.name, file.size, {
        contentType: file.type,
        worldId,
        title: title || file.name,
        description,
      });

      const { session_id, video_asset_id, part_urls } = initResponse;

      if (signal.aborted) throw new Error('Upload cancelled');

      // Step 2: Upload parts
      setUploadState({ status: 'uploading', progress: 0, videoAssetId: video_asset_id });

      const uploadedParts: { part_number: number; etag: string; size: number }[] = [];
      const totalParts = part_urls.length;

      for (let i = 0; i < totalParts; i++) {
        if (signal.aborted) throw new Error('Upload cancelled');

        const partInfo = part_urls[i];
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const response = await fetch(partInfo.upload_url, {
          method: 'PUT',
          body: chunk,
          headers: {
            'Content-Type': file.type,
          },
          signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to upload part ${i + 1}`);
        }

        const etag = response.headers.get('ETag')?.replace(/"/g, '') || '';

        uploadedParts.push({
          part_number: partInfo.part_number,
          etag,
          size: chunk.size,
        });

        // Update progress
        const progress = Math.round(((i + 1) / totalParts) * 100);
        setUploadState((prev) => ({ ...prev, progress }));
      }

      // Step 3: Complete upload
      setUploadState((prev) => ({ ...prev, status: 'completing' }));

      await videoApi.completeUpload(session_id, uploadedParts);

      // Step 4: Transcoding starts automatically
      setUploadState({
        status: 'transcoding',
        progress: 100,
        videoAssetId: video_asset_id,
        transcodingProgress: 0,
      });

      // Poll for transcoding status
      let transcodeComplete = false;
      while (!transcodeComplete && !signal.aborted) {
        await new Promise((resolve) => setTimeout(resolve, 3000)); // Poll every 3 seconds

        try {
          const status = await videoApi.getTranscodeStatus(video_asset_id);

          if (status.status === 'completed') {
            transcodeComplete = true;
            setUploadState({
              status: 'complete',
              progress: 100,
              videoAssetId: video_asset_id,
              transcodingProgress: 100,
            });
            onUploadComplete?.(video_asset_id);
          } else if (status.status === 'failed') {
            throw new Error('Transcoding failed');
          } else {
            setUploadState((prev) => ({
              ...prev,
              transcodingProgress: status.progress,
            }));
          }
        } catch (err) {
          // Ignore errors during polling, will retry
        }
      }

      // Invalidate video queries
      queryClient.invalidateQueries({ queryKey: ['video-assets'] });
    } catch (error) {
      if ((error as Error).message === 'Upload cancelled') {
        setUploadState({ status: 'idle', progress: 0 });
      } else {
        setUploadState({
          status: 'error',
          progress: 0,
          error: (error as Error).message || 'Upload failed',
        });
      }
    }
  };

  // Cancel upload
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setFile(null);
    setTitle('');
    setDescription('');
    setUploadState({ status: 'idle', progress: 0 });
    onCancel?.();
  };

  // Reset and start new upload
  const handleReset = () => {
    setFile(null);
    setTitle('');
    setDescription('');
    setUploadState({ status: 'idle', progress: 0 });
  };

  // Render drop zone
  const renderDropZone = () => (
    <div
      className={cn(
        'border-2 border-dashed border-bone-white/20 rounded-lg p-8',
        'hover:border-accent-yellow/50 transition-colors cursor-pointer',
        'flex flex-col items-center justify-center gap-4'
      )}
      onClick={() => fileInputRef.current?.click()}
    >
      <div className="w-16 h-16 rounded-full bg-accent-yellow/10 flex items-center justify-center">
        <Upload className="w-8 h-8 text-accent-yellow" />
      </div>
      <div className="text-center">
        <p className="text-bone-white font-medium">Click to upload video</p>
        <p className="text-sm text-muted-gray mt-1">
          MP4, MOV, MKV, or AVI up to 50GB
        </p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );

  // Render file preview
  const renderFilePreview = () => {
    if (!file) return null;

    return (
      <div className="space-y-4">
        {/* File Info */}
        <div className="flex items-center gap-4 p-4 rounded-lg bg-charcoal-black/50 border border-bone-white/10">
          <div className="w-12 h-12 rounded-lg bg-accent-yellow/10 flex items-center justify-center flex-shrink-0">
            <FileVideo className="w-6 h-6 text-accent-yellow" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-bone-white truncate">{file.name}</p>
            <p className="text-sm text-muted-gray">{formatSize(file.size)}</p>
          </div>
          {uploadState.status === 'idle' && (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-gray hover:text-bone-white"
              onClick={handleReset}
            >
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>

        {/* Metadata Form */}
        {uploadState.status === 'idle' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter video title"
                className="bg-charcoal-black/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter video description"
                className="bg-charcoal-black/50 min-h-[100px]"
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render upload progress
  const renderProgress = () => {
    const { status, progress, transcodingProgress, error } = uploadState;

    if (status === 'error') {
      return (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-red-500">Upload Failed</p>
            <p className="text-sm text-red-400">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset}>
            Try Again
          </Button>
        </div>
      );
    }

    if (status === 'complete') {
      return (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-green-500">Upload Complete</p>
            <p className="text-sm text-green-400">
              Your video is ready for use
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset}>
            Upload Another
          </Button>
        </div>
      );
    }

    if (status === 'preparing') {
      return (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-accent-yellow/10">
          <Loader2 className="w-5 h-5 text-accent-yellow animate-spin" />
          <p className="text-bone-white">Preparing upload...</p>
        </div>
      );
    }

    if (status === 'uploading') {
      return (
        <div className="space-y-3 p-4 rounded-lg bg-charcoal-black/50 border border-bone-white/10">
          <div className="flex items-center justify-between">
            <p className="font-medium text-bone-white">Uploading...</p>
            <span className="text-sm text-accent-yellow">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-gray">
            {formatSize(Math.round((file?.size || 0) * (progress / 100)))} of{' '}
            {formatSize(file?.size || 0)}
          </p>
        </div>
      );
    }

    if (status === 'completing') {
      return (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-accent-yellow/10">
          <Loader2 className="w-5 h-5 text-accent-yellow animate-spin" />
          <p className="text-bone-white">Finalizing upload...</p>
        </div>
      );
    }

    if (status === 'transcoding') {
      return (
        <div className="space-y-3 p-4 rounded-lg bg-charcoal-black/50 border border-bone-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Film className="w-5 h-5 text-accent-yellow" />
              <p className="font-medium text-bone-white">Processing video...</p>
            </div>
            <span className="text-sm text-accent-yellow">
              {transcodingProgress || 0}%
            </span>
          </div>
          <Progress value={transcodingProgress || 0} className="h-2" />
          <p className="text-sm text-muted-gray">
            Creating quality variants for streaming. This may take a few minutes.
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <Card className={cn('bg-charcoal-black border-bone-white/10', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-bone-white">
          <Video className="w-5 h-5 text-accent-yellow" />
          Upload Video
        </CardTitle>
        <CardDescription>
          Upload a video to use in your World's episodes or companion content
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Drop Zone or File Preview */}
        {!file ? renderDropZone() : renderFilePreview()}

        {/* Progress Display */}
        {file && renderProgress()}

        {/* Actions */}
        {file && uploadState.status === 'idle' && (
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              onClick={uploadFile}
              disabled={!title.trim()}
              className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
            >
              <Upload className="w-4 h-4 mr-2" />
              Start Upload
            </Button>
          </div>
        )}

        {/* Cancel during upload */}
        {(uploadState.status === 'uploading' || uploadState.status === 'preparing') && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleCancel}>
              Cancel Upload
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default VideoUploader;
