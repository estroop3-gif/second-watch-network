/**
 * ReviewVideoPlayer - Adapter component that maps Review assets to the Dailies video player
 * Supports both external video sources (Vimeo/YouTube) and S3-hosted videos
 */
import React, { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import VideoPlayer from '../workspace/video-player/VideoPlayer';
import {
  ReviewAsset,
  ReviewVersion,
  ReviewVersionEnhanced,
  ReviewNote,
} from '@/types/backlot';
import { BacklotDailiesClip, BacklotDailiesClipNote } from '@/types/backlot';
import { api } from '@/lib/api';
import { Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type QualityValue = 'auto' | '4k' | '1080p' | '720p' | '480p' | 'original';

interface ReviewVideoPlayerProps {
  asset: ReviewAsset;
  version: ReviewVersion;
  notes?: ReviewNote[];
  onTimeUpdate?: (time: number) => void;
  onNoteClick?: (note: ReviewNote) => void;
  onAddNote?: () => void;
  canEdit?: boolean;
  className?: string;
}

// Convert ReviewNote to BacklotDailiesClipNote format
const convertNoteToClipNote = (note: ReviewNote): BacklotDailiesClipNote => ({
  id: note.id,
  clip_id: note.version_id,
  time_seconds: note.timecode_seconds,
  note_text: note.content,
  drawing_data: note.drawing_data,
  is_resolved: note.is_resolved,
  author_user_id: note.created_by_user_id,
  created_at: note.created_at,
  author: note.created_by_user ? {
    id: note.created_by_user.id,
    display_name: note.created_by_user.display_name,
    avatar_url: note.created_by_user.avatar_url,
  } : undefined,
});

// Convert ReviewAsset + ReviewVersion to BacklotDailiesClip format
const convertToClipFormat = (
  asset: ReviewAsset,
  version: ReviewVersion
): BacklotDailiesClip => ({
  id: version.id,
  session_id: asset.project_id,
  reel: asset.name,
  file_name: asset.name,
  file_path: version.video_url,
  thumbnail_url: version.thumbnail_url || asset.thumbnail_url,
  duration_seconds: version.duration_seconds,
  frame_rate: null,
  codec: null,
  resolution: null,
  file_size_bytes: null,
  created_at: version.created_at,
  updated_at: version.created_at,
  storage_mode: 'external',
  s3_key: null,
  transcode_status: null,
  metadata: {},
});

export const ReviewVideoPlayer: React.FC<ReviewVideoPlayerProps> = ({
  asset,
  version,
  notes = [],
  onTimeUpdate,
  onNoteClick,
  onAddNote,
  canEdit = false,
  className,
}) => {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quality, setQuality] = useState<QualityValue>('auto');
  const [actualQuality, setActualQuality] = useState<string>('original');
  const [availableRenditions, setAvailableRenditions] = useState<string[]>(['original']);

  const enhancedVersion = version as ReviewVersionEnhanced;
  const isS3Storage = enhancedVersion.storage_mode === 's3';

  // Convert ReviewAsset to clip format for the player
  const clipData = useMemo(() => convertToClipFormat(asset, version), [asset, version]);

  // Convert notes to clip note format
  const clipNotes = useMemo(() => notes.map(convertNoteToClipNote), [notes]);

  // Handle note click - convert back to ReviewNote
  const handleNoteClick = (clipNote: BacklotDailiesClipNote) => {
    const originalNote = notes.find(n => n.id === clipNote.id);
    if (originalNote && onNoteClick) {
      onNoteClick(originalNote);
    }
  };

  // Get stream URL based on storage mode
  useEffect(() => {
    const loadStreamUrl = async () => {
      setIsLoading(true);
      setError(null);

      try {
        if (isS3Storage && enhancedVersion.s3_key) {
          // S3-hosted video - get presigned URL
          const qualityKey = quality === 'auto' ? getAutoQuality() : quality;
          const response = await api.getReviewVersionStreamUrl(version.id, qualityKey);
          setStreamUrl(response.url);
          setActualQuality(response.quality || 'original');

          // Set available renditions from version data
          const renditions = Object.keys(enhancedVersion.renditions || {});
          if (renditions.length > 0) {
            setAvailableRenditions(['original', ...renditions]);
          }
        } else {
          // External video (Vimeo/YouTube/direct link)
          setStreamUrl(version.video_url);
          setActualQuality('external');
          setAvailableRenditions(['original']);
        }
      } catch (err) {
        console.error('Failed to load stream URL:', err);
        setError('Failed to load video stream');
        // Fallback to direct URL
        setStreamUrl(version.video_url);
      } finally {
        setIsLoading(false);
      }
    };

    loadStreamUrl();
  }, [version.id, version.video_url, quality, isS3Storage, enhancedVersion]);

  // Auto quality selection based on connection/screen
  const getAutoQuality = (): string => {
    // Simple heuristic - could be enhanced with actual bandwidth detection
    const screenWidth = window.innerWidth;
    if (screenWidth >= 2560) return '4k';
    if (screenWidth >= 1920) return '1080p';
    if (screenWidth >= 1280) return '720p';
    return '480p';
  };

  // Handle quality change
  const handleQualityChange = (newQuality: QualityValue) => {
    setQuality(newQuality);
  };

  // Render external video embed (Vimeo/YouTube) if applicable
  const isVimeo = version.video_url?.includes('vimeo.com') ||
                  version.video_url?.includes('player.vimeo.com');
  const isYouTube = version.video_url?.includes('youtube.com') ||
                   version.video_url?.includes('youtu.be');

  if (error && !streamUrl) {
    return (
      <div className={cn(
        'aspect-video bg-charcoal-black rounded-lg flex flex-col items-center justify-center gap-4',
        className
      )}>
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-red-400">{error}</p>
        {version.video_url && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(version.video_url, '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in New Tab
          </Button>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn(
        'aspect-video bg-charcoal-black rounded-lg flex items-center justify-center',
        className
      )}>
        <Loader2 className="w-12 h-12 text-accent-yellow animate-spin" />
      </div>
    );
  }

  // For Vimeo videos, we could embed the Vimeo player directly
  // For now, we'll try to use our player for all sources
  // (Vimeo private videos would need the Vimeo SDK)

  return (
    <div className={cn('relative', className)}>
      <VideoPlayer
        streamUrl={streamUrl}
        clip={clipData}
        notes={clipNotes}
        onTimeUpdate={onTimeUpdate}
        onNoteClick={handleNoteClick}
        onAddNote={onAddNote}
        onQualityChange={handleQualityChange}
        quality={quality}
        actualQuality={actualQuality}
        availableRenditions={availableRenditions}
        canEdit={canEdit}
        autoSize
      />

      {/* External video indicator */}
      {!isS3Storage && (
        <div className="absolute top-4 right-4 bg-black/60 px-2 py-1 rounded text-xs text-white/60">
          {isVimeo ? 'Vimeo' : isYouTube ? 'YouTube' : 'External'}
        </div>
      )}

      {/* Transcode status for S3 videos */}
      {isS3Storage && enhancedVersion.transcode_status === 'processing' && (
        <div className="absolute top-4 left-4 bg-blue-500/80 px-3 py-1.5 rounded text-sm text-white flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Transcoding...
        </div>
      )}

      {isS3Storage && enhancedVersion.transcode_status === 'failed' && (
        <div className="absolute top-4 left-4 bg-red-500/80 px-3 py-1.5 rounded text-sm text-white flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Transcode failed
        </div>
      )}
    </div>
  );
};

export default ReviewVideoPlayer;
