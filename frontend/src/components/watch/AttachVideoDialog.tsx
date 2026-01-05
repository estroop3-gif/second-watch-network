/**
 * Attach Video Dialog
 * Select a video from the library to attach to an episode
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { videoApi } from '@/lib/api/watch';
import { useAttachVideoToEpisode } from '@/hooks/watch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  Video,
  FileVideo,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VideoAssetSummary, ProcessingStatus } from '@/types/watch';
import { toast } from 'sonner';

interface AttachVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  episodeId: string;
  episodeTitle: string;
  currentVideoId?: string;
  onAttached?: (videoAssetId: string) => void;
}

// Status colors
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

export function AttachVideoDialog({
  open,
  onOpenChange,
  episodeId,
  episodeTitle,
  currentVideoId,
  onAttached,
}: AttachVideoDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(
    currentVideoId || null
  );

  // Fetch videos
  const { data: videosData, isLoading } = useQuery({
    queryKey: ['video-assets', { limit: 100 }],
    queryFn: () => videoApi.listVideos({ limit: 100 }),
    enabled: open,
    staleTime: 30000,
  });

  const attachMutation = useAttachVideoToEpisode();

  // Filter to only ready videos
  const readyVideos = (videosData?.videos || []).filter(
    (v) => v.processing_status === 'completed'
  );

  // Filter by search
  const filteredVideos = readyVideos.filter((video) =>
    video.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Format duration
  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0)
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Handle attach
  const handleAttach = async () => {
    if (!selectedVideoId) return;

    try {
      await attachMutation.mutateAsync({
        episodeId,
        videoAssetId: selectedVideoId,
      });
      toast.success('Video attached to episode');
      onAttached?.(selectedVideoId);
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to attach video');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-charcoal-black border-bone-white/10">
        <DialogHeader>
          <DialogTitle className="text-bone-white flex items-center gap-2">
            <Video className="w-5 h-5 text-accent-yellow" />
            Attach Video to Episode
          </DialogTitle>
          <DialogDescription>
            Select a video from your library to attach to "{episodeTitle}"
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
          <Input
            type="search"
            placeholder="Search videos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-charcoal-black/50 border-bone-white/10"
          />
        </div>

        {/* Video List */}
        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex gap-3 p-3">
                  <Skeleton className="w-24 h-14 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="text-center py-12">
              <FileVideo className="w-12 h-12 text-muted-gray mx-auto mb-3" />
              <p className="text-muted-gray">
                {searchQuery ? 'No videos match your search' : 'No ready videos available'}
              </p>
              <p className="text-sm text-muted-gray/70 mt-1">
                Upload and process a video first
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredVideos.map((video) => {
                const isSelected = selectedVideoId === video.id;
                const isCurrent = currentVideoId === video.id;

                return (
                  <button
                    key={video.id}
                    onClick={() => setSelectedVideoId(video.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left',
                      isSelected
                        ? 'bg-accent-yellow/20 border border-accent-yellow/50'
                        : 'bg-charcoal-black/30 hover:bg-bone-white/5 border border-transparent'
                    )}
                  >
                    {/* Thumbnail */}
                    <div className="relative w-24 h-14 rounded overflow-hidden bg-muted-gray/20 flex-shrink-0">
                      {video.thumbnail_url ? (
                        <img
                          src={video.thumbnail_url}
                          alt={video.title || 'Video'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileVideo className="w-6 h-6 text-muted-gray" />
                        </div>
                      )}
                      {/* Duration */}
                      {video.duration_seconds && (
                        <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 rounded text-[10px] text-white">
                          {formatDuration(video.duration_seconds)}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4
                          className={cn(
                            'font-medium truncate',
                            isSelected ? 'text-accent-yellow' : 'text-bone-white'
                          )}
                        >
                          {video.title || 'Untitled Video'}
                        </h4>
                        {isCurrent && (
                          <Badge className="bg-green-500/20 text-green-500 text-xs border-0">
                            Current
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-gray mt-1">
                        {video.resolution_width && video.resolution_height && (
                          <span>
                            {video.resolution_width}×{video.resolution_height}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          Ready
                        </span>
                      </div>
                    </div>

                    {/* Selection indicator */}
                    {isSelected && (
                      <CheckCircle className="w-5 h-5 text-accent-yellow flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAttach}
            disabled={!selectedVideoId || attachMutation.isPending}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
          >
            {attachMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Attaching...
              </>
            ) : (
              <>
                <Video className="w-4 h-4 mr-2" />
                Attach Video
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AttachVideoDialog;
