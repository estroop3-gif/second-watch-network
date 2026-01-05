/**
 * Video Library Page
 * Manage uploaded videos - for creators
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { videoApi } from '@/lib/api/watch';
import { StreamLayout } from '@/components/watch';
import { VideoUploader } from '@/components/watch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Video,
  Plus,
  Search,
  MoreVertical,
  Film,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Play,
  FileVideo,
  Calendar,
  HardDrive,
} from 'lucide-react';
import type { VideoAssetSummary, ProcessingStatus } from '@/types/watch';

// Status badge colors
const statusColors: Record<ProcessingStatus, { bg: string; text: string }> = {
  pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-500' },
  validating: { bg: 'bg-blue-500/20', text: 'text-blue-500' },
  transcoding: { bg: 'bg-blue-500/20', text: 'text-blue-500' },
  packaging: { bg: 'bg-blue-500/20', text: 'text-blue-500' },
  qc: { bg: 'bg-purple-500/20', text: 'text-purple-500' },
  completed: { bg: 'bg-green-500/20', text: 'text-green-500' },
  failed: { bg: 'bg-red-500/20', text: 'text-red-500' },
  cancelled: { bg: 'bg-gray-500/20', text: 'text-gray-500' },
};

// Status display names
const statusLabels: Record<ProcessingStatus, string> = {
  pending: 'Pending',
  validating: 'Validating',
  transcoding: 'Transcoding',
  packaging: 'Packaging',
  qc: 'Quality Check',
  completed: 'Ready',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export function VideoLibrary() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  // Fetch videos
  const { data: videosData, isLoading } = useQuery({
    queryKey: ['video-assets', { limit: 50 }],
    queryFn: () => videoApi.listVideos({ limit: 50 }),
    staleTime: 30000,
  });

  const videos = videosData?.videos || [];

  // Filter videos by search
  const filteredVideos = videos.filter((video) =>
    video.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Format file size
  const formatSize = (bytes?: number): string => {
    if (!bytes) return '—';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // Format duration
  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Handle upload complete
  const handleUploadComplete = (videoAssetId: string) => {
    setShowUploadDialog(false);
    queryClient.invalidateQueries({ queryKey: ['video-assets'] });
  };

  // Render video card
  const renderVideoCard = (video: VideoAssetSummary) => {
    const status = video.processing_status;
    const statusColor = statusColors[status];
    const isProcessing = ['pending', 'validating', 'transcoding', 'packaging', 'qc'].includes(status);
    const isReady = status === 'completed';
    const isFailed = status === 'failed';

    return (
      <Card
        key={video.id}
        className="bg-charcoal-black/50 border-bone-white/10 hover:border-bone-white/20 transition-colors"
      >
        <div className="relative aspect-video rounded-t-lg overflow-hidden bg-muted-gray/20">
          {video.thumbnail_url ? (
            <img
              src={video.thumbnail_url}
              alt={video.title || 'Video'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FileVideo className="w-12 h-12 text-muted-gray" />
            </div>
          )}

          {/* Processing overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 text-accent-yellow animate-spin" />
              <span className="text-sm text-bone-white">
                {statusLabels[status]}
              </span>
              {video.processing_progress > 0 && (
                <span className="text-xs text-accent-yellow">
                  {video.processing_progress}%
                </span>
              )}
            </div>
          )}

          {/* Failed overlay */}
          {isFailed && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <span className="text-sm text-red-500">Processing Failed</span>
            </div>
          )}

          {/* Play button for ready videos */}
          {isReady && (
            <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              <Play className="w-12 h-12 text-white" />
            </div>
          )}

          {/* Duration badge */}
          {video.duration_seconds && isReady && (
            <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 rounded text-xs text-white">
              {formatDuration(video.duration_seconds)}
            </div>
          )}
        </div>

        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-bone-white truncate">
                {video.title || 'Untitled Video'}
              </h3>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-gray">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(video.created_at)}
                </span>
                {video.resolution_width && video.resolution_height && (
                  <span>{video.resolution_width}×{video.resolution_height}</span>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isReady && (
                  <DropdownMenuItem>
                    <Play className="w-4 h-4 mr-2" />
                    Preview
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem>
                  <Film className="w-4 h-4 mr-2" />
                  Attach to Episode
                </DropdownMenuItem>
                <DropdownMenuItem className="text-red-500">
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Status badge */}
          <div className="mt-3">
            <Badge className={`${statusColor.bg} ${statusColor.text} border-0`}>
              {isProcessing && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              {isReady && <CheckCircle className="w-3 h-3 mr-1" />}
              {isFailed && <AlertCircle className="w-3 h-3 mr-1" />}
              {statusLabels[status]}
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <StreamLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </StreamLayout>
    );
  }

  return (
    <StreamLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading text-bone-white flex items-center gap-3">
              <Video className="w-8 h-8 text-accent-yellow" />
              Video Library
            </h1>
            <p className="text-muted-gray mt-1">
              {videos.length} video{videos.length !== 1 ? 's' : ''} uploaded
            </p>
          </div>

          <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
            <DialogTrigger asChild>
              <Button className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
                <Plus className="w-4 h-4 mr-2" />
                Upload Video
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl bg-charcoal-black border-bone-white/10">
              <DialogHeader>
                <DialogTitle className="text-bone-white">Upload Video</DialogTitle>
                <DialogDescription>
                  Upload a video to your library. It will be automatically processed for streaming.
                </DialogDescription>
              </DialogHeader>
              <VideoUploader
                onUploadComplete={handleUploadComplete}
                onCancel={() => setShowUploadDialog(false)}
                className="border-0 shadow-none"
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
          <Input
            type="search"
            placeholder="Search videos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-charcoal-black/50 border-bone-white/10"
          />
        </div>

        {/* Empty state */}
        {videos.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-accent-yellow/10 flex items-center justify-center mx-auto mb-4">
              <Video className="w-10 h-10 text-accent-yellow" />
            </div>
            <h2 className="text-xl font-heading text-bone-white mb-2">
              No videos yet
            </h2>
            <p className="text-muted-gray mb-6 max-w-md mx-auto">
              Upload your first video to get started. Videos will be automatically
              transcoded for optimal streaming quality.
            </p>
            <Button
              onClick={() => setShowUploadDialog(true)}
              className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Upload Your First Video
            </Button>
          </div>
        )}

        {/* No results */}
        {videos.length > 0 && filteredVideos.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-gray">
              No videos match "{searchQuery}"
            </p>
          </div>
        )}

        {/* Video grid */}
        {filteredVideos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredVideos.map(renderVideoCard)}
          </div>
        )}
      </div>
    </StreamLayout>
  );
}

export default VideoLibrary;
