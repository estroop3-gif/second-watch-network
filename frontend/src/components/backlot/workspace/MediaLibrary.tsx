/**
 * MediaLibrary - Flat list view of all dailies clips with filtering and sorting
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Film,
  Calendar,
  HardDrive,
  Cloud,
  Circle,
  Star,
  Play,
  MessageSquare,
  Clock,
  Search,
  SlidersHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Filter,
  Loader2,
} from 'lucide-react';
import {
  useMediaLibrary,
  useProjectCameras,
  useProjectScenes,
  useDailiesDays,
  MediaLibraryFilters,
  MediaLibrarySortBy,
  MediaLibrarySortOrder,
  MediaLibraryClipWithContext,
} from '@/hooks/backlot';
import { BacklotDailiesClip } from '@/types/backlot';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface MediaLibraryProps {
  projectId: string;
  canEdit: boolean;
  onSelectClip: (clip: BacklotDailiesClip) => void;
}

// Clip Card for flat list view with auto-thumbnail capture
const MediaClipCard: React.FC<{
  clip: MediaLibraryClipWithContext;
  onSelect: () => void;
  onToggleCircle: (id: string, isCircle: boolean) => void;
  canEdit: boolean;
}> = ({ clip, onSelect, onToggleCircle, canEdit }) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(clip.thumbnail_url || null);
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Auto-capture thumbnail for cloud clips without one
  useEffect(() => {
    if (thumbnailUrl || !clip.cloud_url || clip.storage_mode !== 'cloud' || isCapturing || !canEdit) {
      return;
    }

    const captureThumb = async () => {
      setIsCapturing(true);
      try {
        const token = localStorage.getItem('access_token');
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

        // Get stream URL
        const streamRes = await fetch(
          `${apiUrl}/api/v1/backlot/dailies/clips/${clip.id}/stream-url`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!streamRes.ok) return;
        const { url: streamUrl } = await streamRes.json();

        // Load video and capture first frame
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        video.src = streamUrl;
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.preload = 'metadata';

        await new Promise<void>((resolve, reject) => {
          video.onloadeddata = () => resolve();
          video.onerror = () => reject(new Error('Video load failed'));
          video.load();
        });

        await new Promise(r => setTimeout(r, 200));
        if (video.videoWidth === 0) return;

        // Capture frame
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(b => b ? resolve(b) : reject(), 'image/jpeg', 0.85);
        });

        // Get upload URL
        const presignRes = await fetch(
          `${apiUrl}/api/v1/backlot/dailies/clips/${clip.id}/thumbnail-upload-url`,
          { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );
        if (!presignRes.ok) return;
        const { upload_url, thumbnail_url } = await presignRes.json();

        // Upload to S3
        const uploadRes = await fetch(upload_url, {
          method: 'PUT',
          body: blob,
          headers: { 'Content-Type': 'image/jpeg' }
        });
        if (!uploadRes.ok) return;

        // Update clip in DB
        await fetch(`${apiUrl}/api/v1/backlot/dailies/clips/${clip.id}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ thumbnail_url })
        });

        setThumbnailUrl(thumbnail_url);
        console.log('[MediaClipCard] Auto-captured thumbnail for:', clip.file_name);
      } catch (err) {
        console.error('[MediaClipCard] Thumbnail capture failed:', err);
      } finally {
        setIsCapturing(false);
        if (videoRef.current) videoRef.current.src = '';
      }
    };

    captureThumb();
  }, [clip.id, clip.cloud_url, clip.storage_mode, thumbnailUrl, isCapturing, canEdit]);

  return (
    <div
      className={cn(
        'bg-charcoal-black/50 border rounded-lg p-3 cursor-pointer hover:border-accent-yellow/50 transition-colors',
        clip.is_circle_take ? 'border-green-500/50' : 'border-muted-gray/20'
      )}
      onClick={onSelect}
    >
      {/* Hidden video/canvas for thumbnail capture */}
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />

      {/* Thumbnail area */}
      <div className="aspect-video bg-charcoal-black rounded mb-2 flex items-center justify-center relative overflow-hidden">
        {thumbnailUrl ? (
          <>
            <img
              src={thumbnailUrl}
              alt={clip.file_name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
              <Play className="w-8 h-8 text-bone-white" />
            </div>
          </>
        ) : clip.storage_mode === 'cloud' && clip.cloud_url ? (
          <div className="absolute inset-0 flex items-center justify-center">
            {isCapturing ? (
              <Loader2 className="w-6 h-6 text-muted-gray animate-spin" />
            ) : (
              <Play className="w-8 h-8 text-bone-white/50" />
            )}
          </div>
        ) : (
          <div className="text-center">
            <HardDrive className="w-8 h-8 text-muted-gray/30 mx-auto" />
            <span className="text-xs text-muted-gray/50 mt-1 block">Local</span>
          </div>
        )}
        {/* Duration badge */}
        <div className="absolute bottom-1 right-1 bg-black/70 text-xs text-bone-white px-1.5 py-0.5 rounded">
          {formatDuration(clip.duration_seconds)}
        </div>
        {/* Day badge */}
        {clip.day && (
          <div className="absolute top-1 left-1 bg-black/70 text-xs text-accent-yellow px-1.5 py-0.5 rounded">
            {clip.day.label}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-bone-white truncate flex-1">
            {clip.file_name}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-gray">
          {clip.card?.camera_label && (
            <Badge variant="outline" className="text-xs px-1 py-0 border-muted-gray/30">
              {clip.card.camera_label}
            </Badge>
          )}
          {clip.scene_number && <span>Sc. {clip.scene_number}</span>}
          {clip.take_number && <span>Tk. {clip.take_number}</span>}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {/* Circle take toggle */}
            {canEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCircle(clip.id, !clip.is_circle_take);
                }}
                className={cn(
                  'p-1 rounded hover:bg-muted-gray/20',
                  clip.is_circle_take ? 'text-green-400' : 'text-muted-gray'
                )}
                title={clip.is_circle_take ? 'Remove circle take' : 'Mark as circle take'}
              >
                <Circle className="w-4 h-4" fill={clip.is_circle_take ? 'currentColor' : 'none'} />
              </button>
            )}
            {/* Rating */}
            {clip.rating && clip.rating > 0 && (
              <div className="flex items-center gap-0.5">
                {Array.from({ length: clip.rating }).map((_, i) => (
                  <Star key={i} className="w-3 h-3 text-accent-yellow" fill="currentColor" />
                ))}
              </div>
            )}
          </div>
          {/* Note count */}
          {clip.note_count && clip.note_count > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-gray">
              <MessageSquare className="w-3 h-3" />
              {clip.note_count}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Sort options
const SORT_OPTIONS: { value: MediaLibrarySortBy; label: string }[] = [
  { value: 'created_at', label: 'Date Added' },
  { value: 'file_name', label: 'File Name' },
  { value: 'scene_number', label: 'Scene' },
  { value: 'take_number', label: 'Take' },
  { value: 'rating', label: 'Rating' },
  { value: 'duration_seconds', label: 'Duration' },
];

const MediaLibrary: React.FC<MediaLibraryProps> = ({ projectId, canEdit, onSelectClip }) => {
  // Filter state
  const [filters, setFilters] = useState<MediaLibraryFilters>({
    sortBy: 'created_at',
    sortOrder: 'desc',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 48;

  // Data hooks
  const { days } = useDailiesDays({ projectId });
  const { data: cameras = [] } = useProjectCameras(projectId);
  const { data: scenes = [] } = useProjectScenes(projectId);

  // Debounce search
  const debouncedSearch = useMemo(() => {
    return searchText.length >= 2 ? searchText : undefined;
  }, [searchText]);

  // Media library query
  const {
    clips,
    total,
    isLoading,
    isFetching,
    toggleCircleTake,
  } = useMediaLibrary({
    projectId,
    filters: {
      ...filters,
      textSearch: debouncedSearch,
    },
    offset: page * pageSize,
    limit: pageSize,
  });

  const totalPages = Math.ceil(total / pageSize);
  const hasActiveFilters = !!(
    filters.dayId ||
    filters.camera ||
    filters.sceneNumber ||
    filters.isCircleTake ||
    filters.ratingMin ||
    filters.hasNotes
  );

  const clearFilters = () => {
    setFilters({
      sortBy: 'created_at',
      sortOrder: 'desc',
    });
    setSearchText('');
    setPage(0);
  };

  const updateFilter = (key: keyof MediaLibraryFilters, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  };

  // Loading state
  if (isLoading && clips.length === 0) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
          <Input
            placeholder="Search clips by filename..."
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setPage(0);
            }}
            className="pl-9 bg-charcoal-black/50 border-muted-gray/20"
          />
          {searchText && (
            <button
              onClick={() => setSearchText('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-gray hover:text-bone-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'border-muted-gray/30',
            hasActiveFilters && 'border-accent-yellow/50 text-accent-yellow'
          )}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filters
          {hasActiveFilters && (
            <Badge className="ml-2 bg-accent-yellow/20 text-accent-yellow text-xs">
              Active
            </Badge>
          )}
        </Button>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <Select
            value={filters.sortBy || 'created_at'}
            onValueChange={(v) => updateFilter('sortBy', v as MediaLibrarySortBy)}
          >
            <SelectTrigger className="w-[140px] bg-charcoal-black/50 border-muted-gray/20">
              <ArrowUpDown className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')
            }
            className="h-10 w-10"
          >
            <ArrowUpDown
              className={cn(
                'w-4 h-4 transition-transform',
                filters.sortOrder === 'asc' && 'rotate-180'
              )}
            />
          </Button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {/* Day filter */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-gray">Day</Label>
              <Select
                value={filters.dayId || 'all'}
                onValueChange={(v) => updateFilter('dayId', v === 'all' ? null : v)}
              >
                <SelectTrigger className="bg-charcoal-black/50 border-muted-gray/20">
                  <SelectValue placeholder="All days" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All days</SelectItem>
                  {days.map((day) => (
                    <SelectItem key={day.id} value={day.id}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Camera filter */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-gray">Camera</Label>
              <Select
                value={filters.camera || 'all'}
                onValueChange={(v) => updateFilter('camera', v === 'all' ? null : v)}
              >
                <SelectTrigger className="bg-charcoal-black/50 border-muted-gray/20">
                  <SelectValue placeholder="All cameras" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cameras</SelectItem>
                  {cameras.map((cam) => (
                    <SelectItem key={cam} value={cam}>
                      Camera {cam}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Scene filter */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-gray">Scene</Label>
              <Select
                value={filters.sceneNumber || 'all'}
                onValueChange={(v) => updateFilter('sceneNumber', v === 'all' ? null : v)}
              >
                <SelectTrigger className="bg-charcoal-black/50 border-muted-gray/20">
                  <SelectValue placeholder="All scenes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All scenes</SelectItem>
                  {scenes.map((scene) => (
                    <SelectItem key={scene} value={scene}>
                      Scene {scene}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Rating filter */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-gray">Min Rating</Label>
              <Select
                value={filters.ratingMin?.toString() || 'any'}
                onValueChange={(v) =>
                  updateFilter('ratingMin', v === 'any' ? null : parseInt(v))
                }
              >
                <SelectTrigger className="bg-charcoal-black/50 border-muted-gray/20">
                  <SelectValue placeholder="Any rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any rating</SelectItem>
                  <SelectItem value="1">1+ stars</SelectItem>
                  <SelectItem value="2">2+ stars</SelectItem>
                  <SelectItem value="3">3+ stars</SelectItem>
                  <SelectItem value="4">4+ stars</SelectItem>
                  <SelectItem value="5">5 stars</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Circle takes checkbox */}
            <div className="space-y-1 flex flex-col justify-end">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="circle-only"
                  checked={filters.isCircleTake === true}
                  onCheckedChange={(checked) =>
                    updateFilter('isCircleTake', checked ? true : null)
                  }
                />
                <Label htmlFor="circle-only" className="text-sm cursor-pointer">
                  Circle takes only
                </Label>
              </div>
            </div>

            {/* Has notes checkbox */}
            <div className="space-y-1 flex flex-col justify-end">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="has-notes"
                  checked={filters.hasNotes === true}
                  onCheckedChange={(checked) =>
                    updateFilter('hasNotes', checked ? true : null)
                  }
                />
                <Label htmlFor="has-notes" className="text-sm cursor-pointer">
                  Has notes
                </Label>
              </div>
            </div>
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <div className="mt-4 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-gray hover:text-bone-white"
              >
                <X className="w-4 h-4 mr-1" />
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Results info */}
      <div className="flex items-center justify-between text-sm text-muted-gray">
        <span>
          Showing {clips.length} of {total} clips
          {isFetching && !isLoading && (
            <span className="ml-2 text-accent-yellow">Loading...</span>
          )}
        </span>
        {totalPages > 1 && (
          <span>
            Page {page + 1} of {totalPages}
          </span>
        )}
      </div>

      {/* Clips Grid */}
      {clips.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {clips.map((clip) => (
            <MediaClipCard
              key={clip.id}
              clip={clip}
              onSelect={() => onSelectClip(clip)}
              onToggleCircle={(id, isCircle) =>
                toggleCircleTake.mutate({ id, isCircle })
              }
              canEdit={canEdit}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
          <Film className="w-16 h-16 text-muted-gray/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-bone-white mb-2">No clips found</h3>
          <p className="text-muted-gray mb-4">
            {hasActiveFilters || searchText
              ? 'Try adjusting your filters or search terms'
              : 'No clips have been added yet'}
          </p>
          {(hasActiveFilters || searchText) && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="border-muted-gray/30"
            >
              Clear filters
            </Button>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="border-muted-gray/30"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i;
              } else if (page < 3) {
                pageNum = i;
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 5 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <Button
                  key={pageNum}
                  variant={page === pageNum ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    'w-8 h-8 p-0',
                    page === pageNum && 'bg-accent-yellow text-charcoal-black'
                  )}
                >
                  {pageNum + 1}
                </Button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="border-muted-gray/30"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default MediaLibrary;
