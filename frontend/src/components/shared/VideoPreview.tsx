/**
 * VideoPreview - Embeds videos from YouTube, Vimeo, or shows direct link button
 */
import React, { useMemo } from 'react';
import { ExternalLink, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VideoPreviewProps {
  url: string;
  label?: string;
  className?: string;
  compact?: boolean;
}

/**
 * Parses video URL to extract platform and video ID
 */
function parseVideoUrl(url: string): { platform: 'youtube' | 'vimeo' | 'other'; videoId?: string } {
  if (!url) return { platform: 'other' };

  // YouTube patterns
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
    /youtube\.com\/shorts\/([^&\s?]+)/,
  ];

  for (const pattern of youtubePatterns) {
    const match = url.match(pattern);
    if (match) {
      return { platform: 'youtube', videoId: match[1] };
    }
  }

  // Vimeo patterns
  const vimeoPatterns = [
    /vimeo\.com\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/,
  ];

  for (const pattern of vimeoPatterns) {
    const match = url.match(pattern);
    if (match) {
      return { platform: 'vimeo', videoId: match[1] };
    }
  }

  return { platform: 'other' };
}

const VideoPreview: React.FC<VideoPreviewProps> = ({
  url,
  label = 'Video',
  className = '',
  compact = false,
}) => {
  const { platform, videoId } = useMemo(() => parseVideoUrl(url), [url]);

  if (!url) {
    return null;
  }

  // Compact mode - just show a link button
  if (compact) {
    return (
      <Button
        variant="outline"
        size="sm"
        className={`border-muted-gray/30 text-muted-gray hover:text-bone-white ${className}`}
        onClick={() => window.open(url, '_blank')}
      >
        <Play className="w-3 h-3 mr-1" />
        {label}
      </Button>
    );
  }

  // YouTube embed
  if (platform === 'youtube' && videoId) {
    return (
      <div className={`relative w-full aspect-video rounded-lg overflow-hidden bg-charcoal-black ${className}`}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title={label}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    );
  }

  // Vimeo embed
  if (platform === 'vimeo' && videoId) {
    return (
      <div className={`relative w-full aspect-video rounded-lg overflow-hidden bg-charcoal-black ${className}`}>
        <iframe
          src={`https://player.vimeo.com/video/${videoId}`}
          title={label}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    );
  }

  // Fallback for other URLs - show external link button with thumbnail placeholder
  return (
    <div className={`relative w-full aspect-video rounded-lg overflow-hidden bg-charcoal-black/50 border border-muted-gray/20 ${className}`}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <Play className="w-12 h-12 text-muted-gray" />
        <p className="text-sm text-muted-gray">{label}</p>
        <Button
          variant="outline"
          size="sm"
          className="border-muted-gray/30 text-bone-white hover:bg-muted-gray/20"
          onClick={() => window.open(url, '_blank')}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Open Video
        </Button>
      </div>
    </div>
  );
};

export default VideoPreview;
