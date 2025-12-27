/**
 * ClipDetailView - Detailed view of a single clip with playback and notes
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Circle,
  Star,
  HardDrive,
  Cloud,
  MessageSquare,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  Edit,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Camera,
  Lock,
  Unlock,
  Download,
  Film,
  Loader2 as TranscodeLoader,
} from 'lucide-react';
import { VideoPlayer } from './video-player';
import {
  useDailiesClip,
  useDailiesClipNotes,
  useDailiesClips,
} from '@/hooks/backlot';
import ThumbnailPickerModal from './ThumbnailPickerModal';
import { DEFAULT_MARKER_COLORS, getDefaultColorForUser } from './TimelineMarkers';
import {
  BacklotDailiesClip,
  BacklotDailiesClipNote,
  DailiesClipNoteCategory,
  DAILIES_CLIP_NOTE_CATEGORY_LABELS,
  DAILIES_CLIP_NOTE_CATEGORIES,
  DAILIES_RATING_LABELS,
} from '@/types/backlot';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

type NoteSortOption = 'timeline' | 'newest' | 'author';

interface ClipDetailViewProps {
  clip: BacklotDailiesClip;
  projectId: string;
  canEdit: boolean;
  onBack: () => void;
}

// Note Card Component
const NoteCard: React.FC<{
  note: BacklotDailiesClipNote;
  canEdit: boolean;
  onResolve: (id: string, resolved: boolean) => void;
  onDelete: (id: string) => void;
  onSeek?: (seconds: number) => void;
  isHighlighted?: boolean;
  onColorClick?: () => void;
}> = ({ note, canEdit, onResolve, onDelete, onSeek, isHighlighted, onColorClick }) => {
  const formatTimestamp = (seconds: number | null | undefined) => {
    if (seconds === null || seconds === undefined) return null;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const categoryColor = {
    performance: 'text-purple-400 border-purple-400/30',
    camera: 'text-blue-400 border-blue-400/30',
    sound: 'text-green-400 border-green-400/30',
    technical: 'text-red-400 border-red-400/30',
    continuity: 'text-orange-400 border-orange-400/30',
    vfx: 'text-cyan-400 border-cyan-400/30',
    general: 'text-muted-gray border-muted-gray/30',
  };

  // Get marker color for this author
  const markerColor = note.author?.marker_color || getDefaultColorForUser(note.author_user_id);

  return (
    <div
      className={cn(
        'border rounded-lg p-3 transition-all duration-300',
        note.is_resolved
          ? 'border-muted-gray/10 bg-charcoal-black/20'
          : 'border-muted-gray/30 bg-charcoal-black/50',
        isHighlighted && 'ring-2 ring-accent-yellow/50 border-accent-yellow/50'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="relative">
            <Avatar className="w-8 h-8">
              <AvatarImage src={note.author?.avatar_url || ''} />
              <AvatarFallback className="text-xs">
                {(note.author?.display_name || 'U').slice(0, 1)}
              </AvatarFallback>
            </Avatar>
            {/* Color indicator dot */}
            <div
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-charcoal-black cursor-pointer hover:scale-110 transition-transform"
              style={{ backgroundColor: markerColor }}
              onClick={onColorClick}
              title="Click to change your color"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className={cn(
                  'text-sm font-medium',
                  note.is_resolved ? 'text-muted-gray' : 'text-bone-white'
                )}
              >
                {note.author?.display_name ||
                  note.author?.full_name ||
                  note.author?.username ||
                  'Team Member'}
              </span>
              {note.time_seconds !== null && note.time_seconds !== undefined && (
                <button
                  onClick={() => onSeek?.(note.time_seconds!)}
                  className="text-xs text-accent-yellow hover:underline"
                >
                  @{formatTimestamp(note.time_seconds)}
                </button>
              )}
              {note.category && (
                <Badge
                  variant="outline"
                  className={cn('text-xs', categoryColor[note.category])}
                >
                  {DAILIES_CLIP_NOTE_CATEGORY_LABELS[note.category]}
                </Badge>
              )}
              {note.is_resolved && (
                <Badge
                  variant="outline"
                  className="text-xs text-green-400 border-green-400/30"
                >
                  <Check className="w-3 h-3 mr-1" />
                  Resolved
                </Badge>
              )}
            </div>
            <p
              className={cn(
                'text-sm whitespace-pre-wrap',
                note.is_resolved ? 'text-muted-gray/70' : 'text-muted-gray'
              )}
            >
              {note.note_text}
            </p>
            <span className="text-xs text-muted-gray/50 mt-1 block">
              {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onResolve(note.id, !note.is_resolved)}
              title={note.is_resolved ? 'Mark as unresolved' : 'Mark as resolved'}
            >
              {note.is_resolved ? (
                <RotateCcw className="w-3.5 h-3.5 text-muted-gray" />
              ) : (
                <Check className="w-3.5 h-3.5 text-green-400" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-400 hover:text-red-300"
              onClick={() => onDelete(note.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

// Main Component
const ClipDetailView: React.FC<ClipDetailViewProps> = ({
  clip: initialClip,
  projectId,
  canEdit,
  onBack,
}) => {
  const { toast } = useToast();

  // Fetch fresh clip data
  const { data: clip, isLoading: clipLoading } = useDailiesClip(initialClip.id);
  const { notes, addNote, resolveNote, deleteNote, refetch: refetchNotes } = useDailiesClipNotes({
    clipId: initialClip.id,
  });
  const { clips: siblingClips, updateClip, toggleCircleTake, setRating } = useDailiesClips({
    cardId: initialClip.dailies_card_id,
  });

  // Canvas ref for thumbnail capture
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // State
  const [isAutoCapturingThumbnail, setIsAutoCapturingThumbnail] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamUrlLoading, setStreamUrlLoading] = useState(false);
  const [videoQuality, setVideoQuality] = useState<'auto' | '4k' | '1080p' | '720p' | '480p'>('auto');
  const [actualQuality, setActualQuality] = useState<string>('1080p');
  const [availableRenditions, setAvailableRenditions] = useState<string[]>([]);
  const [isTranscoding, setIsTranscoding] = useState(false);
  const [transcodeStatus, setTranscodeStatus] = useState<string | null>(null);

  const [noteText, setNoteText] = useState('');
  const [noteCategory, setNoteCategory] = useState<DailiesClipNoteCategory | ''>('');
  const [noteAtTimestamp, setNoteAtTimestamp] = useState(true);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [showThumbnailPicker, setShowThumbnailPicker] = useState(false);
  const [highlightedNoteId, setHighlightedNoteId] = useState<string | null>(null);
  const [noteSort, setNoteSort] = useState<NoteSortOption>('timeline');
  const [showColorPickerModal, setShowColorPickerModal] = useState(false);
  const [currentUserColor, setCurrentUserColor] = useState<string | null>(null);
  const [metaForm, setMetaForm] = useState({
    file_name: initialClip.file_name || '',
    scene_number: initialClip.scene_number || '',
    take_number: initialClip.take_number?.toString() || '',
    camera_label: initialClip.camera_label || '',
    timecode_start: initialClip.timecode_start || '',
    notes: initialClip.notes || '',
  });

  // Current clip data (prefer fresh data)
  const currentClip = clip || initialClip;

  // Sync metaForm when clip data is refetched
  useEffect(() => {
    if (clip && !isEditingMeta) {
      setMetaForm({
        file_name: clip.file_name || '',
        scene_number: clip.scene_number || '',
        take_number: clip.take_number?.toString() || '',
        camera_label: clip.camera_label || '',
        timecode_start: clip.timecode_start || '',
        notes: clip.notes || '',
      });
    }
  }, [clip, isEditingMeta]);

  // Sort notes based on selected option
  const sortedNotes = useMemo(() => {
    if (!notes) return [];
    const sorted = [...notes];
    switch (noteSort) {
      case 'timeline':
        // Notes with timestamps first, sorted by time; then notes without timestamps
        return sorted.sort((a, b) => {
          const aTime = a.time_seconds ?? Infinity;
          const bTime = b.time_seconds ?? Infinity;
          return aTime - bTime;
        });
      case 'newest':
        return sorted.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      case 'author':
        return sorted.sort((a, b) =>
          (a.author?.full_name ?? a.author?.display_name ?? '').localeCompare(
            b.author?.full_name ?? b.author?.display_name ?? ''
          )
        );
      default:
        return sorted;
    }
  }, [notes, noteSort]);

  // Fetch presigned stream URL for cloud clips
  const fetchStreamUrlWithQuality = async (quality: string) => {
    if (currentClip.storage_mode !== 'cloud' || !currentClip.cloud_url) {
      console.log('[ClipDetail] Not a cloud clip, skipping stream URL fetch');
      setStreamUrl(null);
      return;
    }

    setStreamUrlLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      console.log('[ClipDetail] Fetching stream URL from:', apiUrl, 'quality:', quality);

      const response = await fetch(
        `${apiUrl}/api/v1/backlot/dailies/clips/${currentClip.id}/stream-url?quality=${quality}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('[ClipDetail] Got stream URL - requested:', quality, 'actual:', data.quality, 'available:', data.available_renditions, 'transcoding_queued:', data.transcoding_queued);
        setStreamUrl(data.url);
        setActualQuality(data.quality || 'original');
        // Filter out 'original' from renditions - we use named quality levels only
        const renditions = (data.available_renditions || []).filter((r: string) => r !== 'original');
        setAvailableRenditions(renditions);

        // Show notification if transcoding was auto-queued
        if (data.transcoding_queued) {
          setTranscodeStatus('pending');
          toast({
            title: 'Transcoding Started',
            description: `${quality} quality is being generated. Playing original quality for now.`,
          });
        }
      } else {
        console.error('[ClipDetail] Failed to fetch stream URL:', response.status);
        setStreamUrl(null);
        setActualQuality('1080p');
        setAvailableRenditions([]);
      }
    } catch (error) {
      console.error('[ClipDetail] Error fetching stream URL:', error);
      setStreamUrl(null);
    } finally {
      setStreamUrlLoading(false);
    }
  };

  useEffect(() => {
    console.log('[ClipDetail] Clip info:', {
      id: currentClip.id,
      storage_mode: currentClip.storage_mode,
      has_cloud_url: !!currentClip.cloud_url,
      has_thumbnail: !!currentClip.thumbnail_url
    });

    fetchStreamUrlWithQuality(videoQuality);
  }, [currentClip.id, currentClip.storage_mode, currentClip.cloud_url]);

  // Handle quality change
  const handleQualityChange = async (quality: 'auto' | '1080p' | '720p' | '480p' | 'original') => {
    setVideoQuality(quality);
    // Preserve current playback position
    const wasPlaying = document.querySelector('video')?.paused === false;
    await fetchStreamUrlWithQuality(quality);
    // The video element will reload with the new URL
    // We could try to restore position but the new URL might have different timing
    console.log('[ClipDetail] Quality changed to:', quality);
  };

  // Navigation
  const currentIndex = siblingClips.findIndex((c) => c.id === currentClip.id);
  const prevClip = currentIndex > 0 ? siblingClips[currentIndex - 1] : null;
  const nextClip = currentIndex < siblingClips.length - 1 ? siblingClips[currentIndex + 1] : null;

  // Handlers
  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (seconds: number) => {
    setCurrentTime(seconds);
  };

  // Update clip metadata (duration, thumbnail, etc.)
  const updateClipMetadata = async (metadata: { duration_seconds?: number; thumbnail_url?: string }) => {
    try {
      await updateClip.mutateAsync({
        id: currentClip.id,
        ...metadata,
      });
    } catch (err) {
      console.error('Failed to update clip metadata:', err);
    }
  };

  // Auto-capture first frame as thumbnail when video loads
  const autoCaptureThumbnail = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || isAutoCapturingThumbnail) {
      console.log('[Thumbnail] Skipping auto-capture:', {
        hasVideo: !!video,
        hasCanvas: !!canvas,
        isCapturing: isAutoCapturingThumbnail
      });
      return;
    }

    console.log('[Thumbnail] Starting auto-capture for clip:', currentClip.id);
    setIsAutoCapturingThumbnail(true);

    try {
      // Wait a small moment for the first frame to render
      await new Promise((r) => setTimeout(r, 200));

      // Check video dimensions
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.error('[Thumbnail] Video dimensions are 0, cannot capture');
        return;
      }

      console.log('[Thumbnail] Capturing frame:', video.videoWidth, 'x', video.videoHeight);

      // Capture frame
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('[Thumbnail] Failed to get canvas context');
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error('Failed to create blob'));
          },
          'image/jpeg',
          0.85
        );
      });

      console.log('[Thumbnail] Created blob, size:', blob.size);

      // Get presigned upload URL
      const token = localStorage.getItem('access_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      console.log('[Thumbnail] Getting presigned URL from:', apiUrl);

      const presignedResponse = await fetch(
        `${apiUrl}/api/v1/backlot/dailies/clips/${currentClip.id}/thumbnail-upload-url`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!presignedResponse.ok) {
        const errorText = await presignedResponse.text();
        console.error('[Thumbnail] Failed to get upload URL:', presignedResponse.status, errorText);
        return;
      }

      const { upload_url, thumbnail_url } = await presignedResponse.json();
      console.log('[Thumbnail] Got presigned URL, uploading to S3...');

      // Upload to S3
      const uploadResponse = await fetch(upload_url, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': 'image/jpeg',
        },
      });

      if (!uploadResponse.ok) {
        console.error('[Thumbnail] S3 upload failed:', uploadResponse.status);
        return;
      }

      console.log('[Thumbnail] S3 upload successful, updating clip metadata...');

      // Update clip metadata with thumbnail URL
      await updateClipMetadata({ thumbnail_url });
      console.log('[Thumbnail] Auto-captured thumbnail successfully:', thumbnail_url);
    } catch (err) {
      console.error('[Thumbnail] Failed to auto-capture:', err);
    } finally {
      setIsAutoCapturingThumbnail(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setIsSubmittingNote(true);
    try {
      await addNote.mutateAsync({
        clipId: currentClip.id,
        note_text: noteText,
        category: noteCategory || null,
        time_seconds: noteAtTimestamp ? Math.floor(currentTime) : null,
      });
      setNoteText('');
      setNoteCategory('');
      setShowNoteForm(false);
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleResolveNote = async (id: string, resolved: boolean) => {
    await resolveNote.mutateAsync({ id, resolved });
  };

  const handleDeleteNote = async (id: string) => {
    if (confirm('Delete this note?')) {
      await deleteNote.mutateAsync(id);
    }
  };

  const handleChangeMarkerColor = async (color: string) => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      toast({
        title: 'Authentication Error',
        description: 'Please log in again to change your marker color.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(
        `${apiUrl}/api/v1/backlot/projects/${projectId}/members/marker-color`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ marker_color: color }),
        }
      );

      if (response.ok) {
        setCurrentUserColor(color);
        setShowColorPickerModal(false);
        // Refetch notes to get updated colors
        await refetchNotes();
        toast({
          title: 'Color Updated',
          description: 'Your marker color has been changed.',
        });
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        toast({
          title: 'Failed to Update Color',
          description: errorData.detail || `Server error: ${response.status}`,
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('[MarkerColor] Failed to update marker color:', err);
      toast({
        title: 'Network Error',
        description: 'Could not connect to the server. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveMeta = async () => {
    await updateClip.mutateAsync({
      id: currentClip.id,
      file_name: metaForm.file_name || currentClip.file_name,
      scene_number: metaForm.scene_number || null,
      take_number: metaForm.take_number ? parseInt(metaForm.take_number, 10) : null,
      camera_label: metaForm.camera_label || null,
      timecode_start: metaForm.timecode_start || null,
      notes: metaForm.notes || null,
    });
    setIsEditingMeta(false);
  };

  // Format file size for display
  const formatFileSize = (bytes: number | null | undefined): string => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const handleSetRating = async (rating: number) => {
    await setRating.mutateAsync({
      id: currentClip.id,
      rating: currentClip.rating === rating ? null : rating,
    });
  };

  const handleToggleCircle = async () => {
    await toggleCircleTake.mutateAsync({
      id: currentClip.id,
      isCircle: !currentClip.is_circle_take,
    });
  };

  const handleToggleLock = async () => {
    try {
      await updateClip.mutateAsync({
        id: currentClip.id,
        is_locked: !currentClip.is_locked,
      });
      toast({
        title: currentClip.is_locked ? 'Clip Unlocked' : 'Clip Locked',
        description: currentClip.is_locked
          ? 'Clip info can now be edited.'
          : 'Clip info is now protected from edits.',
      });
    } catch (err) {
      toast({
        title: 'Failed to update lock status',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = async () => {
    if (!streamUrl) return;

    try {
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = streamUrl;
      link.download = currentClip.file_name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Download Started',
        description: `Downloading ${currentClip.file_name}`,
      });
    } catch (err) {
      toast({
        title: 'Download Failed',
        description: 'Could not start download. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Handle transcoding request
  const handleTranscode = async () => {
    if (isTranscoding) return;

    setIsTranscoding(true);
    setTranscodeStatus('Queuing...');

    try {
      const token = localStorage.getItem('access_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

      const response = await fetch(
        `${apiUrl}/api/v1/backlot/dailies/clips/${currentClip.id}/transcode`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            qualities: ['720p', '480p'],
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTranscodeStatus(data.status === 'pending' ? 'Queued' : data.status);
        toast({
          title: 'Transcoding Queued',
          description: 'Your clip will be transcoded to 720p and 480p. This may take a few minutes.',
        });
      } else {
        const error = await response.json();
        toast({
          title: 'Transcoding Failed',
          description: error.detail || 'Could not start transcoding.',
          variant: 'destructive',
        });
        setTranscodeStatus(null);
      }
    } catch (err) {
      toast({
        title: 'Transcoding Failed',
        description: 'Could not start transcoding. Please try again.',
        variant: 'destructive',
      });
      setTranscodeStatus(null);
    } finally {
      setIsTranscoding(false);
    }
  };

  // Check transcoding status on mount
  const checkTranscodeStatus = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

      const response = await fetch(
        `${apiUrl}/api/v1/backlot/dailies/clips/${currentClip.id}/transcode-status`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.job) {
          setTranscodeStatus(data.job.status);
        }
        // Update available renditions from transcoding status (filter out 'original')
        if (data.renditions && Object.keys(data.renditions).length > 0) {
          const renditions = Object.keys(data.renditions).filter(r => r !== 'original');
          setAvailableRenditions(renditions);
        }
      }
    } catch (err) {
      console.error('Failed to check transcode status:', err);
    }
  };

  useEffect(() => {
    if (currentClip.storage_mode === 'cloud') {
      checkTranscodeStatus();
    }
  }, [currentClip.id]);

  if (clipLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="aspect-video w-full" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-xl font-medium text-bone-white">{currentClip.file_name}</h2>
            <div className="flex items-center gap-3 text-sm text-muted-gray">
              {currentClip.card && (
                <span>
                  {currentClip.card.camera_label} - {currentClip.card.roll_name}
                </span>
              )}
              {currentClip.scene_number && <span>Scene {currentClip.scene_number}</span>}
              {currentClip.take_number && <span>Take {currentClip.take_number}</span>}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={!prevClip}
            onClick={() => prevClip && onBack()} // Would navigate to prev
            className="border-muted-gray/30"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-gray px-2">
            {currentIndex + 1} / {siblingClips.length}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={!nextClip}
            onClick={() => nextClip && onBack()} // Would navigate to next
            className="border-muted-gray/30"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Player / Placeholder */}
        <div className="lg:col-span-2 space-y-4">
          {/* Video Player */}
          {currentClip.storage_mode === 'cloud' && currentClip.cloud_url ? (
            <>
              {streamUrlLoading ? (
                <div className="aspect-video bg-charcoal-black rounded-lg flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-muted-gray animate-spin" />
                </div>
              ) : streamUrl ? (
                <VideoPlayer
                  streamUrl={streamUrl}
                  clip={currentClip}
                  notes={notes}
                  onTimeUpdate={(time) => setCurrentTime(time)}
                  onNoteClick={(note) => {
                    if (note.time_seconds !== null && note.time_seconds !== undefined) {
                      handleSeek(note.time_seconds);
                    }
                    setHighlightedNoteId(note.id);
                    setTimeout(() => setHighlightedNoteId(null), 2000);
                  }}
                  onAddNote={() => setShowNoteForm(true)}
                  onQualityChange={handleQualityChange}
                  quality={videoQuality}
                  actualQuality={actualQuality}
                  availableRenditions={availableRenditions}
                  canEdit={canEdit && !currentClip.is_locked}
                  autoSize={true}
                  maxHeight="70vh"
                />
              ) : (
                <div className="aspect-video bg-charcoal-black rounded-lg flex items-center justify-center">
                  <p className="text-muted-gray">Unable to load video</p>
                </div>
              )}
            </>
          ) : (
            <div className="aspect-video bg-charcoal-black rounded-lg flex items-center justify-center">
              <div className="text-center">
                <HardDrive className="w-16 h-16 text-muted-gray/30 mx-auto mb-4" />
                <p className="text-lg text-bone-white mb-2">Local Drive Media</p>
                <p className="text-sm text-muted-gray max-w-sm">
                  This clip is stored on a local drive. Connect to the drive or use the desktop
                  companion app to play it.
                </p>
                {currentClip.relative_path && (
                  <p className="text-xs text-muted-gray/50 mt-4 font-mono">
                    {currentClip.relative_path}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex items-center justify-between bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
            <div className="flex items-center gap-4">
              {/* Circle Take */}
              <button
                onClick={handleToggleCircle}
                disabled={!canEdit || currentClip.is_locked}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
                  currentClip.is_circle_take
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-charcoal-black/50 text-muted-gray hover:text-bone-white',
                  currentClip.is_locked && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Circle
                  className="w-5 h-5"
                  fill={currentClip.is_circle_take ? 'currentColor' : 'none'}
                />
                <span className="text-sm font-medium">Circle Take</span>
              </button>

              {/* Rating */}
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    onClick={() => handleSetRating(rating)}
                    disabled={!canEdit || currentClip.is_locked}
                    className={cn(
                      'p-1 hover:scale-110 transition-transform',
                      currentClip.is_locked && 'opacity-50 cursor-not-allowed hover:scale-100'
                    )}
                  >
                    <Star
                      className={cn(
                        'w-5 h-5',
                        rating <= (currentClip.rating || 0)
                          ? 'text-accent-yellow'
                          : 'text-muted-gray/30'
                      )}
                      fill={rating <= (currentClip.rating || 0) ? 'currentColor' : 'none'}
                    />
                  </button>
                ))}
              </div>

              {/* Set Thumbnail */}
              {currentClip.storage_mode === 'cloud' && streamUrl && canEdit && !currentClip.is_locked && (
                <button
                  onClick={() => setShowThumbnailPicker(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors bg-charcoal-black/50 text-muted-gray hover:text-bone-white"
                  title="Select thumbnail from video"
                >
                  <Camera className="w-5 h-5" />
                  <span className="text-sm font-medium">Set Thumbnail</span>
                </button>
              )}

              {/* Lock/Unlock */}
              {canEdit && (
                <button
                  onClick={handleToggleLock}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
                    currentClip.is_locked
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-charcoal-black/50 text-muted-gray hover:text-bone-white'
                  )}
                  title={currentClip.is_locked ? 'Unlock clip info' : 'Lock clip info'}
                >
                  {currentClip.is_locked ? (
                    <Lock className="w-5 h-5" />
                  ) : (
                    <Unlock className="w-5 h-5" />
                  )}
                  <span className="text-sm font-medium">{currentClip.is_locked ? 'Locked' : 'Lock'}</span>
                </button>
              )}

              {/* Download */}
              {currentClip.storage_mode === 'cloud' && streamUrl && (
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors bg-charcoal-black/50 text-muted-gray hover:text-bone-white"
                  title="Download clip"
                >
                  <Download className="w-5 h-5" />
                  <span className="text-sm font-medium">Download</span>
                </button>
              )}

            </div>

            {canEdit && !currentClip.is_locked && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNoteForm(true)}
                className="border-muted-gray/30"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Note
              </Button>
            )}
          </div>
        </div>

        {/* Sidebar - Metadata & Notes */}
        <div className="space-y-6">
          {/* Metadata */}
          <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-bone-white flex items-center gap-2">
                Clip Info
                {currentClip.is_locked && (
                  <Lock className="w-3.5 h-3.5 text-red-400" />
                )}
              </h3>
              {canEdit && !isEditingMeta && !currentClip.is_locked && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setIsEditingMeta(true)}
                >
                  <Edit className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>

            {isEditingMeta ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">File Name</Label>
                  <Input
                    placeholder="clip_001.mov"
                    value={metaForm.file_name}
                    onChange={(e) =>
                      setMetaForm({ ...metaForm, file_name: e.target.value })
                    }
                    className="h-8"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Scene</Label>
                    <Input
                      placeholder="1A"
                      value={metaForm.scene_number}
                      onChange={(e) =>
                        setMetaForm({ ...metaForm, scene_number: e.target.value })
                      }
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Take</Label>
                    <Input
                      type="number"
                      placeholder="1"
                      value={metaForm.take_number}
                      onChange={(e) =>
                        setMetaForm({ ...metaForm, take_number: e.target.value })
                      }
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Camera</Label>
                    <Input
                      placeholder="A Cam"
                      value={metaForm.camera_label}
                      onChange={(e) =>
                        setMetaForm({ ...metaForm, camera_label: e.target.value })
                      }
                      className="h-8"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Timecode Start</Label>
                  <Input
                    placeholder="00:00:00:00"
                    value={metaForm.timecode_start}
                    onChange={(e) =>
                      setMetaForm({ ...metaForm, timecode_start: e.target.value })
                    }
                    className="h-8 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    placeholder="Clip notes..."
                    value={metaForm.notes}
                    onChange={(e) => setMetaForm({ ...metaForm, notes: e.target.value })}
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingMeta(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveMeta}
                    className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                {/* File Name */}
                <div className="pb-2 border-b border-muted-gray/20">
                  <span className="text-muted-gray block text-xs mb-1">File Name</span>
                  <span className="text-bone-white font-medium break-all">
                    {currentClip.file_name}
                  </span>
                </div>

                {/* Scene/Take/Camera Row */}
                <div className="grid grid-cols-3 gap-2 py-2 border-b border-muted-gray/20">
                  <div className="text-center">
                    <span className="text-muted-gray block text-xs">Scene</span>
                    <span className="text-bone-white font-medium">
                      {currentClip.scene_number || '—'}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-muted-gray block text-xs">Take</span>
                    <span className="text-bone-white font-medium">
                      {currentClip.take_number || '—'}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-muted-gray block text-xs">Camera</span>
                    <span className="text-bone-white font-medium">
                      {currentClip.camera_label || currentClip.card?.camera_label || '—'}
                    </span>
                  </div>
                </div>

                {/* Storage */}
                <div className="flex justify-between">
                  <span className="text-muted-gray">Storage</span>
                  <span className="text-bone-white flex items-center gap-1">
                    {currentClip.storage_mode === 'cloud' ? (
                      <>
                        <Cloud className="w-4 h-4 text-blue-400" />
                        Cloud
                      </>
                    ) : (
                      <>
                        <HardDrive className="w-4 h-4 text-orange-400" />
                        Local
                      </>
                    )}
                  </span>
                </div>

                {/* Duration */}
                {currentClip.duration_seconds && (
                  <div className="flex justify-between">
                    <span className="text-muted-gray">Duration</span>
                    <span className="text-bone-white">
                      {formatDuration(currentClip.duration_seconds)}
                    </span>
                  </div>
                )}

                {/* Timecode */}
                {currentClip.timecode_start && (
                  <div className="flex justify-between">
                    <span className="text-muted-gray">Timecode</span>
                    <span className="text-bone-white font-mono text-xs">
                      {currentClip.timecode_start}
                    </span>
                  </div>
                )}

                {/* Resolution */}
                {currentClip.resolution && (
                  <div className="flex justify-between">
                    <span className="text-muted-gray">Resolution</span>
                    <span className="text-bone-white">{currentClip.resolution}</span>
                  </div>
                )}

                {/* Frame Rate */}
                {currentClip.frame_rate && (
                  <div className="flex justify-between">
                    <span className="text-muted-gray">Frame Rate</span>
                    <span className="text-bone-white">{currentClip.frame_rate} fps</span>
                  </div>
                )}

                {/* Codec */}
                {currentClip.codec && (
                  <div className="flex justify-between">
                    <span className="text-muted-gray">Codec</span>
                    <span className="text-bone-white">{currentClip.codec}</span>
                  </div>
                )}

                {/* File Size */}
                {currentClip.file_size_bytes && (
                  <div className="flex justify-between">
                    <span className="text-muted-gray">File Size</span>
                    <span className="text-bone-white">{formatFileSize(currentClip.file_size_bytes)}</span>
                  </div>
                )}

                {/* File Path (for local clips) */}
                {currentClip.relative_path && (
                  <div className="pt-2 border-t border-muted-gray/20">
                    <span className="text-muted-gray block text-xs mb-1">File Path</span>
                    <span className="text-bone-white/70 text-xs font-mono break-all">
                      {currentClip.relative_path}
                    </span>
                  </div>
                )}

                {/* Created Date */}
                <div className="flex justify-between pt-2 border-t border-muted-gray/20">
                  <span className="text-muted-gray">Added</span>
                  <span className="text-bone-white/70 text-xs">
                    {new Date(currentClip.created_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>

                {/* Notes */}
                {currentClip.notes && (
                  <div className="pt-2 border-t border-muted-gray/20">
                    <span className="text-muted-gray block mb-1">Notes</span>
                    <p className="text-bone-white whitespace-pre-wrap">
                      {currentClip.notes}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes/Comments Section */}
          <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-bone-white">
                Comments ({notes.length})
              </h3>
              {notes.length > 1 && (
                <Select value={noteSort} onValueChange={(v) => setNoteSort(v as NoteSortOption)}>
                  <SelectTrigger className="w-28 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="timeline">Timeline</SelectItem>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="author">Author</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Note Form */}
            {showNoteForm && (
              <form onSubmit={handleAddNote} className="mb-4 space-y-3">
                <Textarea
                  placeholder="Add a note..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={2}
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <Select
                    value={noteCategory || 'none'}
                    onValueChange={(v) =>
                      setNoteCategory(v === 'none' ? '' : v as DailiesClipNoteCategory)
                    }
                  >
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Category</SelectItem>
                      {DAILIES_CLIP_NOTE_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {DAILIES_CLIP_NOTE_CATEGORY_LABELS[cat]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {currentClip.storage_mode === 'cloud' && (
                    <label className="flex items-center gap-1 text-xs text-muted-gray cursor-pointer">
                      <input
                        type="checkbox"
                        checked={noteAtTimestamp}
                        onChange={(e) => setNoteAtTimestamp(e.target.checked)}
                        className="rounded"
                      />
                      At {formatDuration(currentTime)}
                    </label>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowNoteForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmittingNote || !noteText.trim()}
                    className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                  >
                    {isSubmittingNote ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Add Note'
                    )}
                  </Button>
                </div>
              </form>
            )}

            {/* Notes List */}
            {sortedNotes.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {sortedNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    canEdit={canEdit}
                    onResolve={handleResolveNote}
                    onDelete={handleDeleteNote}
                    onSeek={handleSeek}
                    isHighlighted={note.id === highlightedNoteId}
                    onColorClick={() => setShowColorPickerModal(true)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-gray">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No notes yet</p>
                {canEdit && !showNoteForm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => setShowNoteForm(true)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add First Note
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Thumbnail Picker Modal */}
      {streamUrl && currentClip.duration_seconds && (
        <ThumbnailPickerModal
          isOpen={showThumbnailPicker}
          onClose={() => setShowThumbnailPicker(false)}
          clipId={currentClip.id}
          streamUrl={streamUrl}
          duration={currentClip.duration_seconds}
          onThumbnailSelected={(thumbnailUrl) => {
            updateClipMetadata({ thumbnail_url: thumbnailUrl });
          }}
        />
      )}

      {/* Color Picker Modal */}
      {showColorPickerModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setShowColorPickerModal(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" />
          {/* Modal Content */}
          <div
            className="relative border border-muted-gray/30 rounded-lg p-6 shadow-2xl"
            style={{ backgroundColor: '#1a1a1a' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium text-bone-white mb-4">Choose Your Marker Color</h3>
            <div className="flex gap-3">
              {DEFAULT_MARKER_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => handleChangeMarkerColor(color)}
                  className={cn(
                    'w-10 h-10 rounded-full transition-transform hover:scale-110 ring-2 ring-transparent hover:ring-white/50',
                    currentUserColor === color && 'ring-white'
                  )}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            <button
              onClick={() => setShowColorPickerModal(false)}
              className="absolute top-2 right-2 text-muted-gray hover:text-bone-white p-1"
            >
              <span className="sr-only">Close</span>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Hidden canvas for thumbnail capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default ClipDetailView;
