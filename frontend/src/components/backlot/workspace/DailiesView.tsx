/**
 * DailiesView - Main dailies management view with day/card/clip browsing
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Film,
  Plus,
  Calendar,
  CalendarPlus,
  HardDrive,
  Cloud,
  CloudUpload,
  Circle,
  Star,
  MoreVertical,
  Edit,
  Trash2,
  Loader2,
  ChevronRight,
  Play,
  MessageSquare,
  Clock,
  Folder,
  Search,
  SlidersHorizontal,
  Monitor,
  Apple,
  Terminal,
  Wifi,
  WifiOff,
  Link as LinkIcon,
  FolderOpen,
  Download,
  ExternalLink,
  MapPin,
  Check,
  LayoutGrid,
  List,
  Key,
  Upload,
  X,
  FileVideo,
  Globe,
  CheckCircle2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useDailiesDays,
  useDailiesCards,
  useDailiesClips,
  useDailiesSummary,
  useDesktopHelper,
  useUnlinkedProductionDays,
  useImportProductionDays,
  useDailiesProductionDayView,
  useEnsureDailiesDay,
  useProductionDayClips,
  useAssignClipsToDay,
  useUnassignClipsFromDay,
  useMediaLibrary,
  useProjectCameras,
  useProjectScenes,
  useStandaloneAssets,
  DailiesProductionDayView,
} from '@/hooks/backlot';
import {
  BacklotDailiesDay,
  BacklotDailiesCard,
  BacklotDailiesClip,
  DailiesDayInput,
  DailiesCardInput,
  DailiesStorageMode,
  DAILIES_STORAGE_MODE_LABELS,
  DAILIES_RATING_LABELS,
  StandaloneAsset,
} from '@/types/backlot';
import { formatDate } from '@/lib/dateUtils';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ClipDetailView from './ClipDetailView';
import LocalBrowser from './LocalBrowser';
import MediaLibrary from './MediaLibrary';

type DailiesViewMode = 'day' | 'all';

interface DailiesViewProps {
  projectId: string;
  canEdit: boolean;
}

// Summary Card Component
const SummaryCard: React.FC<{
  label: string;
  value: number;
  icon: React.ElementType;
  color?: string;
}> = ({ label, value, icon: Icon, color = 'text-accent-yellow' }) => (
  <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
    <div className="flex items-center gap-3">
      <div className={cn('p-2 rounded-lg bg-charcoal-black/50', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-bone-white">{value}</p>
        <p className="text-xs text-muted-gray">{label}</p>
      </div>
    </div>
  </div>
);

// Helper Connection Status Component
const HelperConnectionStatus: React.FC<{
  isConnected: boolean;
  version?: string;
  onBrowseLocal?: () => void;
}> = ({ isConnected, version, onBrowseLocal }) => (
  <div
    className={cn(
      'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm',
      isConnected
        ? 'border-green-500/30 bg-green-500/10 text-green-400'
        : 'border-muted-gray/20 bg-charcoal-black/50 text-muted-gray'
    )}
  >
    <Monitor className="w-4 h-4" />
    {isConnected ? (
      <>
        <Wifi className="w-3 h-3" />
        <span>Helper Connected</span>
        {version && <span className="text-xs opacity-70">v{version}</span>}
        {onBrowseLocal && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBrowseLocal}
            className="ml-2 h-6 px-2 text-xs hover:bg-green-500/20"
          >
            <FolderOpen className="w-3 h-3 mr-1" />
            Browse
          </Button>
        )}
      </>
    ) : (
      <>
        <WifiOff className="w-3 h-3" />
        <span>Helper Offline</span>
      </>
    )}
  </div>
);

// Clip Card Component with auto-thumbnail capture
const ClipCard: React.FC<{
  clip: BacklotDailiesClip;
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
        // Get stream URL
        const token = localStorage.getItem('access_token');
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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

        // Wait for first frame
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

        // Show the captured thumbnail immediately
        setThumbnailUrl(thumbnail_url);
        console.log('[ClipCard] Auto-captured thumbnail for:', clip.file_name);
      } catch (err) {
        console.error('[ClipCard] Thumbnail capture failed:', err);
      } finally {
        setIsCapturing(false);
        // Clean up video
        if (videoRef.current) {
          videoRef.current.src = '';
        }
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
      </div>

      {/* Info */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-bone-white truncate flex-1">
            {clip.file_name}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-gray">
          {clip.scene_number && (
            <span>Sc. {clip.scene_number}</span>
          )}
          {clip.take_number && (
            <span>Tk. {clip.take_number}</span>
          )}
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

// Card Row Component
const CardRow: React.FC<{
  card: BacklotDailiesCard;
  projectId: string;
  canEdit: boolean;
  onSelectClip: (clip: BacklotDailiesClip) => void;
  onEditCard: (card: BacklotDailiesCard) => void;
  onDeleteCard: (id: string) => void;
}> = ({ card, projectId, canEdit, onSelectClip, onEditCard, onDeleteCard }) => {
  const { clips, toggleCircleTake } = useDailiesClips({ cardId: card.id });

  return (
    <div className="border border-muted-gray/20 rounded-lg overflow-hidden">
      {/* Card Header */}
      <div className="bg-charcoal-black/30 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={cn(
              'border-muted-gray/30',
              card.storage_mode === 'cloud' ? 'text-blue-400' : 'text-orange-400'
            )}
          >
            {card.storage_mode === 'cloud' ? (
              <Cloud className="w-3 h-3 mr-1" />
            ) : (
              <HardDrive className="w-3 h-3 mr-1" />
            )}
            {card.camera_label}
          </Badge>
          <span className="text-sm font-medium text-bone-white">{card.roll_name}</span>
          <span className="text-xs text-muted-gray">
            {card.clip_count || clips.length} clips
          </span>
        </div>

        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEditCard(card)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Card
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-400"
                onClick={() => onDeleteCard(card.id)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Card
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Clips Grid */}
      <div className="p-4">
        {clips.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {clips.map((clip) => (
              <ClipCard
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
          <div className="text-center py-8 text-muted-gray">
            <Film className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No clips in this card</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Day Section Component
const DaySection: React.FC<{
  day: BacklotDailiesDay;
  projectId: string;
  canEdit: boolean;
  onSelectClip: (clip: BacklotDailiesClip) => void;
  onEditDay: (day: BacklotDailiesDay) => void;
  onDeleteDay: (id: string) => void;
  onEditCard: (card: BacklotDailiesCard) => void;
  onDeleteCard: (id: string) => void;
  onAddCard: (dayId: string) => void;
}> = ({
  day,
  projectId,
  canEdit,
  onSelectClip,
  onEditDay,
  onDeleteDay,
  onEditCard,
  onDeleteCard,
  onAddCard,
}) => {
  const { cards } = useDailiesCards({ dayId: day.id });

  const formatDuration = (seconds: number | undefined) => {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <AccordionItem value={day.id} className="border border-muted-gray/20 rounded-lg mb-4">
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-charcoal-black/30">
        <div className="flex items-center justify-between w-full pr-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-accent-yellow" />
              <span className="font-medium text-bone-white">{day.label}</span>
            </div>
            <span className="text-sm text-muted-gray">
              {formatDate(day.shoot_date, 'MMMM d, yyyy')}
            </span>
            {day.unit && (
              <Badge variant="outline" className="border-muted-gray/30 text-muted-gray">
                {day.unit}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-gray">
            <span>{day.card_count || cards.length} cards</span>
            <span>{day.clip_count || 0} clips</span>
            {day.circle_take_count && day.circle_take_count > 0 && (
              <span className="text-green-400">{day.circle_take_count} circles</span>
            )}
            <span>{formatDuration(day.total_duration_seconds)}</span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-4">
          {/* Day Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {canEdit && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAddCard(day.id)}
                    className="border-muted-gray/30"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Card
                  </Button>
                </>
              )}
            </div>
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEditDay(day)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Day
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-400"
                    onClick={() => onDeleteDay(day.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Day
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Cards */}
          {cards.length > 0 ? (
            <div className="space-y-4">
              {cards.map((card) => (
                <CardRow
                  key={card.id}
                  card={card}
                  projectId={projectId}
                  canEdit={canEdit}
                  onSelectClip={onSelectClip}
                  onEditCard={onEditCard}
                  onDeleteCard={onDeleteCard}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-charcoal-black/30 rounded-lg">
              <Folder className="w-8 h-8 text-muted-gray/30 mx-auto mb-2" />
              <p className="text-sm text-muted-gray">No cards for this day</p>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 border-muted-gray/30"
                  onClick={() => onAddCard(day.id)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Card
                </Button>
              )}
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

// Add Footage Modal Component
const AddFootageModal: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  productionDayId: string;
  existingClipIds: Set<string>;
  onSubmit: (clipIds: string[]) => void;
  isSubmitting: boolean;
}> = ({ open, onOpenChange, projectId, productionDayId, existingClipIds, onSubmit, isSubmitting }) => {
  const [searchText, setSearchText] = useState('');
  const [cameraFilter, setCameraFilter] = useState<string | null>(null);
  const [sceneFilter, setSceneFilter] = useState<string | null>(null);
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set());

  const { clips, isLoading } = useMediaLibrary({
    projectId,
    filters: {
      textSearch: searchText || undefined,
      camera: cameraFilter || undefined,
      sceneNumber: sceneFilter || undefined,
    },
    limit: 200,
    enabled: open,
  });

  const { data: cameras = [] } = useProjectCameras(open ? projectId : null);
  const { data: scenes = [] } = useProjectScenes(open ? projectId : null);

  // Reset selection when modal opens
  useEffect(() => {
    if (open) {
      setSelectedClipIds(new Set());
      setSearchText('');
      setCameraFilter(null);
      setSceneFilter(null);
    }
  }, [open]);

  const toggleClip = (clipId: string) => {
    setSelectedClipIds((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) {
        next.delete(clipId);
      } else {
        next.add(clipId);
      }
      return next;
    });
  };

  const handleSubmit = () => {
    onSubmit(Array.from(selectedClipIds));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="w-5 h-5 text-accent-yellow" />
            Add Footage
          </DialogTitle>
        </DialogHeader>

        {/* Search & Filters */}
        <div className="flex items-center gap-3 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
            <Input
              placeholder="Search clips..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={cameraFilter || '__all__'} onValueChange={(v) => setCameraFilter(v === '__all__' ? null : v)}>
            <SelectTrigger className="w-[130px] bg-charcoal-black/50 border-muted-gray/30">
              <SelectValue placeholder="Camera" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Cameras</SelectItem>
              {cameras.map((cam) => (
                <SelectItem key={cam} value={cam}>{cam}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sceneFilter || '__all__'} onValueChange={(v) => setSceneFilter(v === '__all__' ? null : v)}>
            <SelectTrigger className="w-[130px] bg-charcoal-black/50 border-muted-gray/30">
              <SelectValue placeholder="Scene" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Scenes</SelectItem>
              {scenes.map((sc) => (
                <SelectItem key={sc} value={sc}>Sc. {sc}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Clip Grid */}
        <div className="flex-1 overflow-y-auto min-h-0 pb-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-accent-yellow animate-spin" />
            </div>
          ) : clips.length === 0 ? (
            <div className="text-center py-12">
              <Film className="w-12 h-12 text-muted-gray/30 mx-auto mb-3" />
              <p className="text-muted-gray">No clips found</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {clips.map((clip) => {
                const alreadyAssigned = existingClipIds.has(clip.id);
                const isSelected = selectedClipIds.has(clip.id);
                return (
                  <div
                    key={clip.id}
                    className={cn(
                      'relative bg-charcoal-black/50 border rounded-lg p-2 cursor-pointer transition-colors',
                      alreadyAssigned
                        ? 'border-muted-gray/10 opacity-50 cursor-not-allowed'
                        : isSelected
                          ? 'border-accent-yellow ring-1 ring-accent-yellow/50'
                          : 'border-muted-gray/20 hover:border-accent-yellow/30'
                    )}
                    onClick={() => !alreadyAssigned && toggleClip(clip.id)}
                  >
                    {/* Checkbox overlay */}
                    <div className="absolute top-1 left-1 z-10">
                      <div
                        className={cn(
                          'w-5 h-5 rounded border-2 flex items-center justify-center',
                          alreadyAssigned
                            ? 'border-muted-gray/30 bg-muted-gray/20'
                            : isSelected
                              ? 'border-accent-yellow bg-accent-yellow'
                              : 'border-muted-gray/50 bg-charcoal-black/70'
                        )}
                      >
                        {(isSelected || alreadyAssigned) && (
                          <Check className="w-3 h-3 text-charcoal-black" />
                        )}
                      </div>
                    </div>

                    {/* Thumbnail */}
                    <div className="aspect-video bg-charcoal-black rounded mb-1 flex items-center justify-center overflow-hidden">
                      {clip.thumbnail_url ? (
                        <img src={clip.thumbnail_url} alt={clip.file_name} className="w-full h-full object-cover" />
                      ) : (
                        <Film className="w-6 h-6 text-muted-gray/30" />
                      )}
                    </div>

                    {/* Info */}
                    <p className="text-xs text-bone-white truncate">{clip.file_name}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-gray">
                      {clip.scene_number && <span>Sc.{clip.scene_number}</span>}
                      {clip.take_number && <span>Tk.{clip.take_number}</span>}
                    </div>
                    {alreadyAssigned && (
                      <p className="text-xs text-muted-gray/70 italic">Already added</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-muted-gray/20">
          <span className="text-sm text-muted-gray">
            {selectedClipIds.size > 0 ? `${selectedClipIds.size} selected` : 'Select clips to add'}
          </span>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={selectedClipIds.size === 0 || isSubmitting}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add to Day
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Production Day Section Component (Auto-imported from Schedule)
const ProductionDaySection: React.FC<{
  prodDay: DailiesProductionDayView;
  projectId: string;
  canEdit: boolean;
  onSelectClip: (clip: BacklotDailiesClip) => void;
  onOpenAddFootage: (productionDayId: string) => void;
  isExpanded: boolean;
}> = ({
  prodDay,
  projectId,
  canEdit,
  onSelectClip,
  onOpenAddFootage,
  isExpanded,
}) => {
  const { data: dayClips = [], isLoading: loadingClips } = useProductionDayClips(projectId, prodDay.production_day_id);
  const unassignClips = useUnassignClipsFromDay();

  const formatDuration = (seconds: number | undefined) => {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const dayLabel = prodDay.title && !prodDay.title.match(/^Day\s+\d+$/)
    ? `Day ${prodDay.day_number} - ${prodDay.title}`
    : `Day ${prodDay.day_number}`;

  const handleToggleCircle = async (clipId: string, isCircle: boolean) => {
    const token = api.getToken();
    if (!token) return;
    const apiBase = import.meta.env.VITE_API_URL || '';
    try {
      await fetch(`${apiBase}/api/v1/backlot/dailies/clips/${clipId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_circle_take: isCircle }),
      });
    } catch (err) {
      console.error('Failed to toggle circle take:', err);
    }
  };

  return (
    <AccordionItem value={prodDay.production_day_id} className="border border-muted-gray/20 rounded-lg mb-4">
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-charcoal-black/30">
        <div className="flex items-center justify-between w-full pr-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-accent-yellow" />
              <span className="font-medium text-bone-white">{dayLabel}</span>
            </div>
            <span className="text-sm text-muted-gray">
              {formatDate(prodDay.date, 'MMMM d, yyyy')}
            </span>
            {prodDay.location_name && (
              <Badge variant="outline" className="border-muted-gray/30 text-muted-gray">
                <MapPin className="w-3 h-3 mr-1" />
                {prodDay.location_name}
              </Badge>
            )}
            {prodDay.is_completed && (
              <Badge className="bg-green-500/20 text-green-400 text-xs">
                <Check className="w-3 h-3 mr-1" />
                Shot
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-gray">
            {prodDay.scene_count > 0 && (
              <span>{prodDay.scene_count} scenes</span>
            )}
            {prodDay.clip_count > 0 ? (
              <>
                <span>{prodDay.clip_count} clips</span>
                {prodDay.circle_take_count > 0 && (
                  <span className="text-green-400">{prodDay.circle_take_count} circles</span>
                )}
                <span>{formatDuration(prodDay.total_duration_seconds)}</span>
              </>
            ) : (
              <span className="text-muted-gray/50 italic">No footage yet</span>
            )}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-4">
          {/* Day Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenAddFootage(prodDay.production_day_id)}
                  className="border-muted-gray/30"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Footage
                </Button>
              )}
            </div>
          </div>

          {/* Clips Grid */}
          {loadingClips ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-accent-yellow animate-spin" />
            </div>
          ) : dayClips.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {dayClips.map((clip) => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  onSelect={() => onSelectClip(clip)}
                  onToggleCircle={(id, isCircle) => handleToggleCircle(id, isCircle)}
                  canEdit={canEdit}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-charcoal-black/30 rounded-lg">
              <Film className="w-8 h-8 text-muted-gray/30 mx-auto mb-2" />
              <p className="text-sm text-muted-gray">No footage for this day</p>
              <p className="text-xs text-muted-gray/50 mt-1">
                Use "Add Footage" to assign clips from the media library
              </p>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 border-muted-gray/30"
                  onClick={() => onOpenAddFootage(prodDay.production_day_id)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Footage
                </Button>
              )}
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

// Main Component
const DailiesView: React.FC<DailiesViewProps> = ({ projectId, canEdit }) => {
  const queryClient = useQueryClient();
  const { days, isLoading: loadingLegacyDays, createDay, updateDay, deleteDay } = useDailiesDays({ projectId });
  const { data: summary } = useDailiesSummary(projectId);
  const { isConnected: helperConnected, status: helperStatus } = useDesktopHelper();

  // Production day view (auto-imported from schedule)
  const { data: productionDays = [], isLoading: loadingProductionDays } = useDailiesProductionDayView(projectId);
  const ensureDailiesDay = useEnsureDailiesDay();

  // State
  const [viewMode, setViewMode] = useState<DailiesViewMode>('day');
  const [selectedClip, setSelectedClip] = useState<BacklotDailiesClip | null>(null);
  const [showDayForm, setShowDayForm] = useState(false);
  const [editingDay, setEditingDay] = useState<BacklotDailiesDay | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [editingCard, setEditingCard] = useState<BacklotDailiesCard | null>(null);
  const [cardDayId, setCardDayId] = useState<string | null>(null);
  const [cardProductionDayId, setCardProductionDayId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLocalBrowser, setShowLocalBrowser] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedProductionDays, setSelectedProductionDays] = useState<string[]>([]);
  const [createFootageAssets, setCreateFootageAssets] = useState(false);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [showAddFootageModal, setShowAddFootageModal] = useState(false);
  const [addFootageTargetDayId, setAddFootageTargetDayId] = useState<string | null>(null);
  const [isAssigningClips, setIsAssigningClips] = useState(false);

  // Embed Asset state
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [embedSearchQuery, setEmbedSearchQuery] = useState('');
  const [selectedEmbedAsset, setSelectedEmbedAsset] = useState<StandaloneAsset | null>(null);
  const [isEmbedding, setIsEmbedding] = useState(false);

  const { assets: standaloneAssetsForEmbed = [], isLoading: embedAssetsLoading } = useStandaloneAssets({
    projectId: showEmbedModal ? projectId : null,
  });

  const filteredEmbedAssets = standaloneAssetsForEmbed.filter((a) => {
    if (!embedSearchQuery) return true;
    const q = embedSearchQuery.toLowerCase();
    return a.name.toLowerCase().includes(q) || a.source_url?.toLowerCase().includes(q);
  });

  const handleEmbedAsset = async () => {
    if (!selectedEmbedAsset) return;
    setIsEmbedding(true);
    try {
      // Create a dailies clip linked to the standalone asset
      await api.completeDailiesBrowserUpload({
        standalone_asset_id: selectedEmbedAsset.id,
        project_id: projectId,
      });

      queryClient.invalidateQueries({ queryKey: ['dailies-clips'] });
      queryClient.invalidateQueries({ queryKey: ['media-library'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-standalone-assets'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-unified-assets'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-production-day-view'] });

      toast.success('Asset embedded as dailies clip');
      setShowEmbedModal(false);
      setSelectedEmbedAsset(null);
      setEmbedSearchQuery('');
    } catch (error) {
      console.error('Error embedding asset:', error);
      toast.error('Failed to embed asset');
    } finally {
      setIsEmbedding(false);
    }
  };

  // Browser upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const uploadFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'complete' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const resetUpload = () => {
    setUploadFile(null);
    setUploadStatus('idle');
    setUploadProgress(0);
    setUploadError(null);
    if (uploadFileInputRef.current) uploadFileInputRef.current.value = '';
  };

  const handleUploadFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Please select a valid video file (MP4, MOV, AVI, WebM, MKV)');
      return;
    }
    setUploadFile(file);
    setUploadError(null);
  };

  const handleUploadDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      setUploadFile(file);
      setUploadError(null);
    }
  };

  const uploadToS3 = (url: string, file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.min((e.loaded / e.total) * 100, 99));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed with status ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(file);
    });
  };

  const handleBrowserUploadSubmit = async () => {
    if (!uploadFile) return;
    try {
      setUploadStatus('uploading');
      setUploadProgress(0);

      // 1. Get presigned URL (creates standalone asset)
      const { upload_url, standalone_asset_id } = await api.getDailiesBrowserUploadUrl(
        projectId,
        uploadFile.name,
        uploadFile.type || 'video/mp4',
      );

      // 2. Upload to S3
      await uploadToS3(upload_url, uploadFile);

      // 3. Create dailies clip linked to standalone asset
      setUploadStatus('processing');
      setUploadProgress(100);
      await api.completeDailiesBrowserUpload({
        standalone_asset_id,
        project_id: projectId,
      });

      setUploadStatus('complete');

      // Invalidate queries so media library and clips refresh
      queryClient.invalidateQueries({ queryKey: ['media-library'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-clips'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-standalone-assets'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-unified-assets'] });

      setShowUploadModal(false);
      resetUpload();
    } catch (error) {
      setUploadStatus('error');
      setUploadError('Upload failed. Please try again.');
    }
  };

  // Production day clips hooks
  const assignClips = useAssignClipsToDay();
  const { data: addFootageTargetClips = [] } = useProductionDayClips(
    projectId,
    addFootageTargetDayId
  );
  const existingClipIds = useMemo(
    () => new Set(addFootageTargetClips.map((c) => c.id)),
    [addFootageTargetClips]
  );

  // Determine if we should use production day view (if there are production days from schedule)
  const useProductionDayView = productionDays.length > 0;
  const isLoading = loadingLegacyDays || loadingProductionDays;

  // Production day import hooks
  const { data: unlinkedDays = [], isLoading: loadingUnlinkedDays } = useUnlinkedProductionDays(projectId);
  const importDays = useImportProductionDays();

  // Dailies Helper download URLs (authenticated)
  const { data: helperDownloads, isLoading: loadingDownloads } = useQuery({
    queryKey: ['dailies-helper-downloads'],
    queryFn: () => api.get('/api/v1/downloads/dailies-helper'),
    staleTime: 1000 * 60 * 60, // 1 hour (matches presigned URL expiry)
  });

  // Detect user's platform for download recommendation
  const userPlatform = useMemo((): 'windows' | 'mac' | 'linux' => {
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('win')) return 'windows';
    if (platform.includes('mac')) return 'mac';
    return 'linux';
  }, []);

  // Platform icons and labels
  const platformConfig = {
    windows: { icon: Monitor, label: 'Windows', ext: '.exe' },
    mac: { icon: Apple, label: 'macOS', ext: '.dmg' },
    linux: { icon: Terminal, label: 'Linux', ext: '.AppImage' },
  };

  // Day form state
  const [dayForm, setDayForm] = useState<DailiesDayInput>({
    shoot_date: format(new Date(), 'yyyy-MM-dd'),
    label: '',
    unit: '',
    notes: '',
  });

  // Card form state
  const [cardForm, setCardForm] = useState<DailiesCardInput>({
    camera_label: '',
    roll_name: '',
    storage_mode: 'local_drive',
    media_root_path: '',
    storage_location: '',
    notes: '',
  });

  // Get cards hook for card mutations
  const { createCard, updateCard, deleteCard } = useDailiesCards({ dayId: cardDayId });

  // Handlers
  const handleOpenDayForm = (day?: BacklotDailiesDay) => {
    if (day) {
      setEditingDay(day);
      setDayForm({
        shoot_date: day.shoot_date,
        label: day.label,
        unit: day.unit || '',
        notes: day.notes || '',
      });
    } else {
      setEditingDay(null);
      setDayForm({
        shoot_date: format(new Date(), 'yyyy-MM-dd'),
        label: `Day ${days.length + 1}`,
        unit: '',
        notes: '',
      });
    }
    setShowDayForm(true);
  };

  const handleSubmitDay = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingDay) {
        await updateDay.mutateAsync({ id: editingDay.id, ...dayForm });
      } else {
        await createDay.mutateAsync({ projectId, ...dayForm });
      }
      setShowDayForm(false);
    } catch (err) {
      console.error('Failed to save day:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDay = async (id: string) => {
    if (confirm('Are you sure? This will delete all cards and clips for this day.')) {
      await deleteDay.mutateAsync(id);
    }
  };

  const handleOpenCardForm = (dayId: string, card?: BacklotDailiesCard) => {
    setCardDayId(dayId);
    setCardProductionDayId(null);
    if (card) {
      setEditingCard(card);
      setCardForm({
        camera_label: card.camera_label,
        roll_name: card.roll_name,
        storage_mode: card.storage_mode,
        media_root_path: card.media_root_path || '',
        storage_location: card.storage_location || '',
        notes: card.notes || '',
      });
    } else {
      setEditingCard(null);
      setCardForm({
        camera_label: 'A',
        roll_name: '',
        storage_mode: 'local_drive',
        media_root_path: '',
        storage_location: '',
        notes: '',
      });
    }
    setShowCardForm(true);
  };

  // Handle opening card form for production day (creates dailies day on-demand)
  const handleOpenCardFormForProductionDay = (dailiesDayId: string, productionDayId: string, card?: BacklotDailiesCard) => {
    setCardDayId(dailiesDayId || null);
    setCardProductionDayId(productionDayId);
    if (card) {
      setEditingCard(card);
      setCardForm({
        camera_label: card.camera_label,
        roll_name: card.roll_name,
        storage_mode: card.storage_mode,
        media_root_path: card.media_root_path || '',
        storage_location: card.storage_location || '',
        notes: card.notes || '',
      });
    } else {
      setEditingCard(null);
      setCardForm({
        camera_label: 'A',
        roll_name: '',
        storage_mode: 'local_drive',
        media_root_path: '',
        storage_location: '',
        notes: '',
      });
    }
    setShowCardForm(true);
  };

  const handleSubmitCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let dayIdToUse = cardDayId;

      // If no dailies day exists but we have a production day, create one on-demand
      if (!dayIdToUse && cardProductionDayId) {
        const result = await ensureDailiesDay.mutateAsync({
          projectId,
          productionDayId: cardProductionDayId,
        });
        dayIdToUse = result.day.id;
        setCardDayId(dayIdToUse);
      }

      if (!dayIdToUse) {
        console.error('No day ID available for card creation');
        return;
      }

      if (editingCard) {
        await updateCard.mutateAsync({ id: editingCard.id, ...cardForm });
      } else {
        await createCard.mutateAsync({ dayId: dayIdToUse, projectId, ...cardForm });
      }
      setShowCardForm(false);
      setCardProductionDayId(null);
    } catch (err) {
      console.error('Failed to save card:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCard = async (id: string) => {
    if (confirm('Are you sure? This will delete all clips in this card.')) {
      await deleteCard.mutateAsync(id);
    }
  };

  const handleImportProductionDays = async () => {
    if (selectedProductionDays.length === 0) return;
    setIsSubmitting(true);
    try {
      await importDays.mutateAsync({
        projectId,
        productionDayIds: selectedProductionDays,
        createFootageAssets,
      });
      setShowImportDialog(false);
      setSelectedProductionDays([]);
      setCreateFootageAssets(false);
    } catch (err) {
      console.error('Failed to import days:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleProductionDaySelection = (dayId: string) => {
    setSelectedProductionDays((prev) =>
      prev.includes(dayId) ? prev.filter((id) => id !== dayId) : [...prev, dayId]
    );
  };

  const selectAllProductionDays = () => {
    if (selectedProductionDays.length === unlinkedDays.length) {
      setSelectedProductionDays([]);
    } else {
      setSelectedProductionDays(unlinkedDays.map((d) => d.id));
    }
  };

  const handleOpenAddFootage = (productionDayId: string) => {
    setAddFootageTargetDayId(productionDayId);
    setShowAddFootageModal(true);
  };

  const handleAssignClips = async (clipIds: string[]) => {
    if (!addFootageTargetDayId || clipIds.length === 0) return;
    setIsAssigningClips(true);
    try {
      await assignClips.mutateAsync({
        projectId,
        productionDayId: addFootageTargetDayId,
        clipIds,
      });
      setShowAddFootageModal(false);
      setAddFootageTargetDayId(null);
    } catch (err) {
      console.error('Failed to assign clips:', err);
    } finally {
      setIsAssigningClips(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  // Clip detail view
  if (selectedClip) {
    return (
      <ClipDetailView
        clip={selectedClip}
        projectId={projectId}
        canEdit={canEdit}
        onBack={() => setSelectedClip(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading text-bone-white">Dailies</h2>
          <p className="text-sm text-muted-gray">
            Review footage from set, mark circle takes, and add notes
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Helper Connection Status */}
          <HelperConnectionStatus
            isConnected={helperConnected}
            version={helperStatus.version}
            onBrowseLocal={helperConnected ? () => setShowLocalBrowser(true) : undefined}
          />
          {/* API Key Button */}
          <Link to="/account?tab=api-keys">
            <Button
              variant="outline"
              size="sm"
              className="border-muted-gray/30 text-muted-gray hover:text-bone-white hover:border-accent-yellow/50"
            >
              <Key className="w-4 h-4 mr-2" />
              API Key
            </Button>
          </Link>
          {/* Download Helper Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDownloadModal(true)}
            className="border-muted-gray/30 text-muted-gray hover:text-bone-white hover:border-accent-yellow/50"
          >
            <Download className="w-4 h-4 mr-2" />
            Get Desktop Helper
          </Button>
          {/* Browser Upload Button */}
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { resetUpload(); setShowUploadModal(true); }}
              className="border-accent-yellow/30 text-accent-yellow hover:bg-accent-yellow/10 hover:border-accent-yellow/50"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
          )}
          {/* Embed Asset Button */}
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEmbedModal(true)}
              className="border-accent-yellow/30 text-accent-yellow hover:bg-accent-yellow/10 hover:border-accent-yellow/50"
            >
              <LinkIcon className="w-4 h-4 mr-2" />
              Embed Asset
            </Button>
          )}
          {/* Only show import button when NOT using production day view and there are unlinked days */}
          {canEdit && !useProductionDayView && unlinkedDays.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportDialog(true)}
              className="border-accent-yellow/30 text-accent-yellow hover:bg-accent-yellow/10 hover:border-accent-yellow/50"
            >
              <CalendarPlus className="w-4 h-4 mr-2" />
              Import from Schedule
              <Badge variant="secondary" className="ml-2 bg-accent-yellow/20 text-accent-yellow text-xs">
                {unlinkedDays.length}
              </Badge>
            </Button>
          )}
          {/* Only show Add Shoot Day when NOT using production day view */}
          {canEdit && !useProductionDayView && (
            <Button
              onClick={() => handleOpenDayForm()}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Shoot Day
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="Shoot Days" value={summary.total_days} icon={Calendar} />
          <SummaryCard
            label="Total Clips"
            value={summary.total_clips}
            icon={Film}
            color="text-blue-400"
          />
          <SummaryCard
            label="Circle Takes"
            value={summary.circle_takes}
            icon={Circle}
            color="text-green-400"
          />
          <SummaryCard
            label="Unresolved Notes"
            value={summary.unresolved_notes}
            icon={MessageSquare}
            color="text-orange-400"
          />
        </div>
      )}

      {/* View Toggle and Day Selector */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-gray">View:</span>
          <div className="flex bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('day')}
              className={cn(
                'h-8 px-3 gap-2',
                viewMode === 'day'
                  ? 'bg-accent-yellow/20 text-accent-yellow'
                  : 'text-muted-gray hover:text-bone-white'
              )}
            >
              <Calendar className="w-4 h-4" />
              By Day
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('all')}
              className={cn(
                'h-8 px-3 gap-2',
                viewMode === 'all'
                  ? 'bg-accent-yellow/20 text-accent-yellow'
                  : 'text-muted-gray hover:text-bone-white'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
              All Clips
            </Button>
          </div>
        </div>

        {/* Day Selector Dropdown (only for day view with production days) */}
        {viewMode === 'day' && useProductionDayView && productionDays.length > 5 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-gray">Jump to:</span>
            <Select
              value={selectedDayId || ''}
              onValueChange={(value) => {
                setSelectedDayId(value || null);
                // Scroll to the selected day
                if (value) {
                  const element = document.getElementById(`day-${value}`);
                  element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
            >
              <SelectTrigger className="w-[200px] h-8 bg-charcoal-black/50 border-muted-gray/30">
                <SelectValue placeholder="Select a day..." />
              </SelectTrigger>
              <SelectContent>
                {productionDays.map((day) => (
                  <SelectItem key={day.production_day_id} value={day.production_day_id}>
                    Day {day.day_number} - {formatDate(day.date, 'MMM d')}
                    {day.has_footage && ' ✓'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Content based on view mode */}
      {viewMode === 'all' ? (
        <MediaLibrary
          projectId={projectId}
          canEdit={canEdit}
          onSelectClip={setSelectedClip}
        />
      ) : useProductionDayView ? (
        /* Production Day View - Auto-imported from Schedule */
        productionDays.length > 0 ? (
          <Accordion
            type="multiple"
            defaultValue={productionDays
              .filter((d) => d.has_footage)
              .slice(0, 2)
              .map((d) => d.production_day_id)}
          >
            {productionDays.map((prodDay) => (
              <div key={prodDay.production_day_id} id={`day-${prodDay.production_day_id}`}>
                <ProductionDaySection
                  prodDay={prodDay}
                  projectId={projectId}
                  canEdit={canEdit}
                  onSelectClip={setSelectedClip}
                  onOpenAddFootage={handleOpenAddFootage}
                  isExpanded={prodDay.has_footage}
                />
              </div>
            ))}
          </Accordion>
        ) : (
          <div className="text-center py-16 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
            <Calendar className="w-16 h-16 text-muted-gray/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-bone-white mb-2">No production days scheduled</h3>
            <p className="text-muted-gray mb-6 max-w-md mx-auto">
              Add production days in the Schedule tab to start organizing your dailies.
              Days from your schedule will automatically appear here.
            </p>
          </div>
        )
      ) : days.length > 0 ? (
        /* Legacy Day View - Manual dailies days */
        <Accordion type="multiple" defaultValue={days.slice(0, 2).map((d) => d.id)}>
          {days.map((day) => (
            <DaySection
              key={day.id}
              day={day}
              projectId={projectId}
              canEdit={canEdit}
              onSelectClip={setSelectedClip}
              onEditDay={handleOpenDayForm}
              onDeleteDay={handleDeleteDay}
              onEditCard={(card) => handleOpenCardForm(day.id, card)}
              onDeleteCard={handleDeleteCard}
              onAddCard={(dayId) => handleOpenCardForm(dayId)}
            />
          ))}
        </Accordion>
      ) : (
        <div className="text-center py-16 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
          <Film className="w-16 h-16 text-muted-gray/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-bone-white mb-2">No dailies yet</h3>
          <p className="text-muted-gray mb-6 max-w-md mx-auto">
            Add shoot days to start organizing your dailies, or add production days to the Schedule tab
            to have them automatically appear here.
          </p>
          {canEdit && (
            <Button
              onClick={() => handleOpenDayForm()}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add First Shoot Day
            </Button>
          )}
        </div>
      )}

      {/* Day Form Modal */}
      <Dialog open={showDayForm} onOpenChange={setShowDayForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDay ? 'Edit Shoot Day' : 'Add Shoot Day'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitDay} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shoot_date">Date *</Label>
                <Input
                  id="shoot_date"
                  type="date"
                  value={dayForm.shoot_date}
                  onChange={(e) => setDayForm({ ...dayForm, shoot_date: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="label">Label *</Label>
                <Input
                  id="label"
                  placeholder="Day 1, Pick-ups, etc."
                  value={dayForm.label}
                  onChange={(e) => setDayForm({ ...dayForm, label: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unit (optional)</Label>
              <Input
                id="unit"
                placeholder="Main Unit, 2nd Unit, etc."
                value={dayForm.unit || ''}
                onChange={(e) => setDayForm({ ...dayForm, unit: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setShowDayForm(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !dayForm.shoot_date || !dayForm.label}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : editingDay ? (
                  'Save Changes'
                ) : (
                  'Add Day'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Card Form Modal */}
      <Dialog open={showCardForm} onOpenChange={setShowCardForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCard ? 'Edit Card' : 'Add Card/Roll'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitCard} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="camera_label">Camera *</Label>
                <Input
                  id="camera_label"
                  placeholder="A, B, C..."
                  value={cardForm.camera_label}
                  onChange={(e) => setCardForm({ ...cardForm, camera_label: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="roll_name">Roll Name *</Label>
                <Input
                  id="roll_name"
                  placeholder="A001, B002..."
                  value={cardForm.roll_name}
                  onChange={(e) => setCardForm({ ...cardForm, roll_name: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Storage Mode</Label>
              <Select
                value={cardForm.storage_mode}
                onValueChange={(v) =>
                  setCardForm({ ...cardForm, storage_mode: v as DailiesStorageMode })
                }
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local_drive">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4" />
                      Local Drive
                    </div>
                  </SelectItem>
                  <SelectItem value="cloud">
                    <div className="flex items-center gap-2">
                      <Cloud className="w-4 h-4" />
                      Cloud Storage
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-gray">
                {cardForm.storage_mode === 'local_drive'
                  ? 'Metadata only - media stays on physical drives'
                  : 'Upload proxies to cloud for remote playback'}
              </p>
            </div>
            {cardForm.storage_mode === 'local_drive' && (
              <div className="space-y-2">
                <Label htmlFor="storage_location">Storage Location</Label>
                <Input
                  id="storage_location"
                  placeholder="RAID A, SSD-01, etc."
                  value={cardForm.storage_location || ''}
                  onChange={(e) =>
                    setCardForm({ ...cardForm, storage_location: e.target.value })
                  }
                  disabled={isSubmitting}
                />
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setShowCardForm(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !cardForm.camera_label || !cardForm.roll_name}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : editingCard ? (
                  'Save Changes'
                ) : (
                  'Add Card'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Local File Browser Dialog */}
      <Dialog open={showLocalBrowser} onOpenChange={setShowLocalBrowser}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-accent-yellow" />
              Browse Local Drives
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 overflow-y-auto max-h-[calc(85vh-120px)]">
            {helperConnected ? (
              <LocalBrowser
                projectId={projectId}
                onSelectClip={(file, driveName) => {
                  console.log('Selected clip:', file, 'from drive:', driveName);
                  // TODO: Add clip to dailies
                }}
                onPlayFile={(streamUrl, fileName) => {
                  // Open video in new tab for playback
                  window.open(streamUrl, '_blank');
                }}
              />
            ) : (
              <div className="text-center py-8">
                <WifiOff className="w-12 h-12 text-muted-gray/30 mx-auto mb-3" />
                <p className="text-muted-gray mb-2">Desktop Helper not connected</p>
                <p className="text-sm text-muted-gray/70">
                  Install and run the SWN Desktop Helper to browse local drives.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowLocalBrowser(false);
                    setShowDownloadModal(true);
                  }}
                  className="mt-4 border-accent-yellow/50 text-accent-yellow hover:bg-accent-yellow/20"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Get Desktop Helper
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Download Helper Dialog */}
      <Dialog open={showDownloadModal} onOpenChange={setShowDownloadModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-accent-yellow" />
              Download SWN Dailies Helper
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-gray">
              The SWN Dailies Helper is a desktop app that helps you:
            </p>
            <ul className="text-sm text-muted-gray space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-accent-yellow">•</span>
                Offload footage from camera cards with checksum verification
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent-yellow">•</span>
                Copy to multiple drives simultaneously
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent-yellow">•</span>
                Generate H.264 proxy files for faster review
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent-yellow">•</span>
                Upload proxies to cloud for remote dailies review
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent-yellow">•</span>
                Browse local drives from this web interface
              </li>
            </ul>

            {/* Download Buttons */}
            <div className="pt-4 space-y-3">
              {loadingDownloads ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-accent-yellow" />
                  <span className="ml-2 text-sm text-muted-gray">Loading downloads...</span>
                </div>
              ) : helperDownloads?.downloads && Object.keys(helperDownloads.downloads).length > 0 ? (
                <>
                  {/* Available platforms */}
                  {(() => {
                    const availablePlatforms = Object.keys(helperDownloads.downloads) as ('windows' | 'mac' | 'linux')[];
                    const userPlatformAvailable = availablePlatforms.includes(userPlatform);
                    const primaryPlatform = userPlatformAvailable ? userPlatform : availablePlatforms[0];
                    const otherPlatforms = availablePlatforms.filter(p => p !== primaryPlatform);

                    return (
                      <>
                        {/* Primary download button */}
                        {primaryPlatform && helperDownloads.downloads[primaryPlatform] && (
                          <Button
                            onClick={() => window.open(helperDownloads.downloads[primaryPlatform].url, '_blank')}
                            className="w-full bg-accent-yellow text-charcoal-black hover:bg-bone-white font-medium"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download for {platformConfig[primaryPlatform].label} ({platformConfig[primaryPlatform].ext})
                          </Button>
                        )}

                        {/* Other available platforms */}
                        {otherPlatforms.length > 0 && (
                          <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="other-platforms" className="border-muted-gray/20">
                              <AccordionTrigger className="text-sm text-muted-gray hover:text-bone-white py-2">
                                Other platforms ({otherPlatforms.length})
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="flex flex-col gap-2 pt-2">
                                  {otherPlatforms.map(platform => {
                                    const config = platformConfig[platform];
                                    const download = helperDownloads.downloads[platform];
                                    const Icon = config.icon;
                                    return (
                                      <Button
                                        key={platform}
                                        variant="outline"
                                        onClick={() => window.open(download?.url, '_blank')}
                                        className="w-full justify-start border-muted-gray/30 text-bone-white hover:bg-muted-gray/10"
                                      >
                                        <Icon className="w-4 h-4 mr-2" />
                                        {config.label} ({config.ext})
                                      </Button>
                                    );
                                  })}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        )}

                        {/* Note if user's platform not available */}
                        {!userPlatformAvailable && (
                          <p className="text-xs text-amber-400 text-center">
                            {platformConfig[userPlatform].label} version coming soon
                          </p>
                        )}
                      </>
                    );
                  })()}

                  {helperDownloads.version && (
                    <p className="text-xs text-muted-gray text-center">
                      Version {helperDownloads.version}
                    </p>
                  )}
                </>
              ) : (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <p className="text-sm text-red-400 text-center">
                    Downloads unavailable. Please try again later.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 flex flex-col items-center gap-3">
              <Link
                to="/account?tab=api-keys"
                className="inline-flex items-center gap-2 px-4 py-2 border border-accent-yellow/50 text-accent-yellow rounded-lg hover:bg-accent-yellow/10 transition-colors font-medium text-sm"
              >
                <Key className="w-4 h-4" />
                Create API Key
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Footage Modal */}
      {addFootageTargetDayId && (
        <AddFootageModal
          open={showAddFootageModal}
          onOpenChange={(open) => {
            setShowAddFootageModal(open);
            if (!open) setAddFootageTargetDayId(null);
          }}
          projectId={projectId}
          productionDayId={addFootageTargetDayId}
          existingClipIds={existingClipIds}
          onSubmit={handleAssignClips}
          isSubmitting={isAssigningClips}
        />
      )}

      {/* Browser Upload Dialog */}
      <Dialog open={showUploadModal} onOpenChange={(open) => { setShowUploadModal(open); if (!open) resetUpload(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CloudUpload className="w-5 h-5 text-accent-yellow" />
              Upload Footage
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {uploadStatus === 'idle' || uploadStatus === 'error' ? (
              <>
                {/* Drop zone */}
                <div
                  className={cn(
                    'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                    uploadFile
                      ? 'border-accent-yellow/50 bg-accent-yellow/5'
                      : 'border-muted-gray/30 hover:border-accent-yellow/30 hover:bg-charcoal-black/50'
                  )}
                  onDrop={handleUploadDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => uploadFileInputRef.current?.click()}
                >
                  <input
                    ref={uploadFileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleUploadFileSelect}
                    className="hidden"
                  />
                  {uploadFile ? (
                    <div className="space-y-2">
                      <FileVideo className="w-10 h-10 text-accent-yellow mx-auto" />
                      <p className="text-sm text-bone-white font-medium">{uploadFile.name}</p>
                      <p className="text-xs text-muted-gray">
                        {(uploadFile.size / (1024 * 1024)).toFixed(1)} MB
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); resetUpload(); }}
                        className="text-muted-gray hover:text-red-400"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-10 h-10 text-muted-gray/50 mx-auto" />
                      <p className="text-sm text-muted-gray">
                        Drag and drop a video file, or click to browse
                      </p>
                      <p className="text-xs text-muted-gray/50">
                        MP4, MOV, AVI, WebM, MKV
                      </p>
                    </div>
                  )}
                </div>

                {uploadError && (
                  <p className="text-sm text-red-400">{uploadError}</p>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => { setShowUploadModal(false); resetUpload(); }}
                    className="text-muted-gray"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleBrowserUploadSubmit}
                    disabled={!uploadFile}
                    className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-4 py-4">
                <div className="text-center space-y-2">
                  {uploadStatus === 'complete' ? (
                    <Check className="w-10 h-10 text-green-400 mx-auto" />
                  ) : (
                    <Loader2 className="w-10 h-10 text-accent-yellow mx-auto animate-spin" />
                  )}
                  <p className="text-sm text-bone-white font-medium">
                    {uploadStatus === 'uploading' ? 'Uploading...' :
                     uploadStatus === 'processing' ? 'Processing...' :
                     'Upload complete'}
                  </p>
                  {uploadFile && (
                    <p className="text-xs text-muted-gray">{uploadFile.name}</p>
                  )}
                </div>
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-muted-gray text-center">
                  {Math.round(uploadProgress)}%
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Import from Schedule Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="w-5 h-5 text-accent-yellow" />
              Import Production Days
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-gray">
              Select production days from your schedule to import as dailies days.
            </p>

            {loadingUnlinkedDays ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-accent-yellow animate-spin" />
              </div>
            ) : unlinkedDays.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-muted-gray/30 mx-auto mb-3" />
                <p className="text-muted-gray">All production days have been imported</p>
              </div>
            ) : (
              <>
                {/* Select All */}
                <div className="flex items-center justify-between p-3 bg-charcoal-black/50 rounded-lg border border-muted-gray/20">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="select-all"
                      checked={selectedProductionDays.length === unlinkedDays.length}
                      onCheckedChange={() => selectAllProductionDays()}
                    />
                    <Label htmlFor="select-all" className="text-sm text-bone-white cursor-pointer">
                      Select all ({unlinkedDays.length} days)
                    </Label>
                  </div>
                  {selectedProductionDays.length > 0 && (
                    <Badge className="bg-accent-yellow/20 text-accent-yellow">
                      {selectedProductionDays.length} selected
                    </Badge>
                  )}
                </div>

                {/* Day List */}
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {unlinkedDays.map((day) => (
                    <div
                      key={day.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                        selectedProductionDays.includes(day.id)
                          ? 'bg-accent-yellow/10 border-accent-yellow/30'
                          : 'bg-charcoal-black/30 border-muted-gray/20 hover:border-muted-gray/40'
                      )}
                      onClick={() => toggleProductionDaySelection(day.id)}
                    >
                      <Checkbox
                        checked={selectedProductionDays.includes(day.id)}
                        onCheckedChange={() => toggleProductionDaySelection(day.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-bone-white">
                            Day {day.day_number}
                          </span>
                          <span className="text-sm text-muted-gray">
                            {formatDate(day.date)}
                          </span>
                          {day.is_completed && (
                            <Badge className="bg-green-500/20 text-green-400 text-xs">
                              <Check className="w-3 h-3 mr-1" />
                              Shot
                            </Badge>
                          )}
                        </div>
                        {(day.title || day.location_name) && (
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-gray">
                            {day.title && <span>{day.title}</span>}
                            {day.location_name && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {day.location_name}
                              </span>
                            )}
                          </div>
                        )}
                        {day.scene_count > 0 && (
                          <span className="text-xs text-muted-gray mt-1 block">
                            {day.scene_count} scene{day.scene_count !== 1 ? 's' : ''} scheduled
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Create Footage Assets Checkbox */}
                <div className="flex items-center gap-3 p-3 bg-charcoal-black/30 rounded-lg border border-muted-gray/20">
                  <Checkbox
                    id="create-footage"
                    checked={createFootageAssets}
                    onCheckedChange={(checked) => setCreateFootageAssets(checked === true)}
                  />
                  <div>
                    <Label htmlFor="create-footage" className="text-sm text-bone-white cursor-pointer">
                      Create footage assets for each day
                    </Label>
                    <p className="text-xs text-muted-gray mt-0.5">
                      Adds a "Raw Footage" asset in the Assets tab for each imported day
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowImportDialog(false);
                  setSelectedProductionDays([]);
                }}
                className="border-muted-gray/30"
              >
                Cancel
              </Button>
              <Button
                onClick={handleImportProductionDays}
                disabled={selectedProductionDays.length === 0 || isSubmitting}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <CalendarPlus className="w-4 h-4 mr-2" />
                    Import {selectedProductionDays.length} Day{selectedProductionDays.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Embed Asset Dialog */}
      <Dialog open={showEmbedModal} onOpenChange={(open) => { setShowEmbedModal(open); if (!open) { setSelectedEmbedAsset(null); setEmbedSearchQuery(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-accent-yellow" />
              Embed Asset
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-gray">
              Select a standalone asset to embed as a dailies clip.
            </p>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
              <Input
                value={embedSearchQuery}
                onChange={(e) => setEmbedSearchQuery(e.target.value)}
                placeholder="Search assets..."
                className="pl-10"
              />
            </div>

            {/* Asset list */}
            <div className="max-h-[300px] overflow-y-auto space-y-2 border border-muted-gray/20 rounded-lg p-2">
              {embedAssetsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-accent-yellow animate-spin" />
                </div>
              ) : filteredEmbedAssets.length === 0 ? (
                <div className="text-center py-8 text-muted-gray text-sm">
                  No assets found. Add assets in the Assets tab first.
                </div>
              ) : (
                filteredEmbedAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                      selectedEmbedAsset?.id === asset.id
                        ? 'bg-accent-yellow/10 border border-accent-yellow/50'
                        : 'hover:bg-charcoal-black/50 border border-transparent'
                    )}
                    onClick={() => setSelectedEmbedAsset(asset)}
                  >
                    <div className="w-10 h-10 rounded bg-charcoal-black flex items-center justify-center shrink-0">
                      {asset.source_url ? (
                        <Globe className="w-5 h-5 text-accent-yellow" />
                      ) : asset.thumbnail_url ? (
                        <img src={asset.thumbnail_url} alt="" className="w-full h-full object-cover rounded" />
                      ) : (
                        <Film className="w-5 h-5 text-muted-gray" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-bone-white truncate">{asset.name}</p>
                      <p className="text-xs text-muted-gray truncate">
                        {asset.source_url ? (
                          <span className="flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                            {asset.video_provider || 'Link'}
                          </span>
                        ) : (
                          asset.file_name || asset.asset_type
                        )}
                      </p>
                    </div>
                    {selectedEmbedAsset?.id === asset.id && (
                      <CheckCircle2 className="w-5 h-5 text-accent-yellow shrink-0" />
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEmbedModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleEmbedAsset}
                disabled={!selectedEmbedAsset || isEmbedding}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {isEmbedding ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Embedding...
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-4 h-4 mr-2" />
                    Embed Asset
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DailiesView;
