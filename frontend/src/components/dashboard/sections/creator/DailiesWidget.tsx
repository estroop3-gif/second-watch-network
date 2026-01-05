/**
 * DailiesWidget
 * Shows recent dailies uploads and storage usage across projects
 */

import { Link } from 'react-router-dom';
import { useDailiesSummaryWidget } from '@/hooks/backlot';
import { WidgetSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Video, HardDrive, CircleDot, Loader2, ChevronRight, Play, AlertCircle } from 'lucide-react';
import type { SectionProps } from '@/components/dashboard/config/sectionRegistry';

// Format duration in seconds to mm:ss
function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Format date to relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function DailiesWidget({ className = '' }: SectionProps) {
  const { data, isLoading, error } = useDailiesSummaryWidget();

  if (isLoading) {
    return <WidgetSkeleton className={className} />;
  }

  if (error) {
    return (
      <div className={`p-4 bg-charcoal-black border border-red-500/30 rounded-lg ${className}`}>
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span>Error loading dailies: {error.message}</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`p-4 bg-charcoal-black border border-muted-gray/30 rounded-lg ${className}`}>
        <div className="flex items-center gap-2 text-muted-gray">
          <Video className="w-5 h-5" />
          <span>No dailies data</span>
        </div>
      </div>
    );
  }

  const {
    recent_uploads,
    processing_count,
    storage_used_gb,
    storage_limit_gb,
    circle_takes_count,
  } = data;

  const storagePercent = storage_limit_gb > 0
    ? Math.min((storage_used_gb / storage_limit_gb) * 100, 100)
    : 0;
  const isStorageHigh = storagePercent > 80;

  // If no recent uploads and no processing, show empty state
  if (recent_uploads.length === 0 && processing_count === 0) {
    return (
      <div className={`p-4 bg-charcoal-black border border-purple-500/30 rounded-lg ${className}`}>
        <div className="flex items-center gap-2 mb-2">
          <Video className="w-5 h-5 text-purple-400" />
          <h3 className="font-heading text-bone-white">Dailies</h3>
        </div>
        <p className="text-sm text-muted-gray">No recent footage uploads.</p>
        <Button variant="outline" size="sm" className="mt-3" asChild>
          <Link to="/backlot">Upload Dailies</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={`p-4 bg-charcoal-black border border-purple-500/30 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Video className="w-5 h-5 text-purple-400" />
          <h3 className="font-heading text-bone-white">Dailies</h3>
          {processing_count > 0 && (
            <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/30 gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              {processing_count} processing
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/backlot">
            View All
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>

      {/* Storage Bar */}
      <div className="mb-4 p-3 bg-muted-gray/10 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm">
            <HardDrive className="w-4 h-4 text-muted-gray" />
            <span className="text-muted-gray">Storage</span>
          </div>
          <span className={`text-sm font-medium ${isStorageHigh ? 'text-primary-red' : 'text-bone-white'}`}>
            {storage_used_gb.toFixed(1)} / {storage_limit_gb} GB
          </span>
        </div>
        <Progress
          value={storagePercent}
          className={`h-2 ${isStorageHigh ? '[&>div]:bg-primary-red' : '[&>div]:bg-purple-500'}`}
        />
      </div>

      {/* Circle Takes Badge */}
      {circle_takes_count > 0 && (
        <div className="flex items-center gap-2 mb-4 p-2 bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg">
          <CircleDot className="w-4 h-4 text-accent-yellow" />
          <span className="text-sm text-bone-white">
            <strong className="text-accent-yellow">{circle_takes_count}</strong> circled takes ready for review
          </span>
        </div>
      )}

      {/* Recent Uploads Grid */}
      {recent_uploads.length > 0 && (
        <div>
          <p className="text-xs text-muted-gray uppercase tracking-wider mb-2">Recent Uploads</p>
          <div className="grid grid-cols-3 gap-2">
            {recent_uploads.slice(0, 6).map(clip => (
              <Link
                key={clip.id}
                to={`/backlot/${clip.project_slug}/dailies`}
                className="group relative aspect-video rounded-lg overflow-hidden bg-muted-gray/20"
              >
                {/* Thumbnail */}
                {clip.thumbnail_url ? (
                  <img
                    src={clip.thumbnail_url}
                    alt={clip.clip_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-muted-gray/20">
                    <Video className="w-6 h-6 text-muted-gray" />
                  </div>
                )}

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Play button on hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Play className="w-4 h-4 text-white fill-white" />
                  </div>
                </div>

                {/* Duration badge */}
                <div className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/70 rounded text-xs text-white">
                  {formatDuration(clip.duration_seconds)}
                </div>

                {/* Scene badge */}
                {clip.scene_number && (
                  <div className="absolute top-1 left-1 px-1 py-0.5 bg-purple-500/80 rounded text-xs text-white">
                    Sc {clip.scene_number}
                  </div>
                )}
              </Link>
            ))}
          </div>

          {/* Project attribution */}
          {recent_uploads[0] && (
            <p className="mt-2 text-xs text-muted-gray">
              Latest from <span className="text-bone-white">{recent_uploads[0].project_name}</span>
              {' · '}
              {formatRelativeTime(recent_uploads[0].created_at)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default DailiesWidget;
