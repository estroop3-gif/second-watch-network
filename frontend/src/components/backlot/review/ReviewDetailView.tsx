/**
 * ReviewDetailView - Video player with notes sidebar and timeline markers (Frame.io-style)
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ArrowLeft,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  SkipBack,
  SkipForward,
  MessageSquare,
  Send,
  MoreVertical,
  Trash2,
  Check,
  CheckCircle2,
  Circle,
  Layers,
  ChevronDown,
  Loader2,
  ListTodo,
  Reply,
  X,
  Clock,
} from 'lucide-react';
import { useReviewAsset, useReviewNotes, useReviewPlayer } from '@/hooks/backlot/useReview';
import { useEmbeddedPlayer } from '@/hooks/backlot/useEmbeddedPlayer';
import { ReviewAsset, ReviewNote, ReviewVersion, ReviewVersionEnhanced, formatTimecode } from '@/types/backlot';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface ReviewDetailViewProps {
  assetId: string;
  projectId: string;
  canEdit: boolean;
  onBack: () => void;
}

// Note card component
const NoteCard: React.FC<{
  note: ReviewNote;
  isActive: boolean;
  canEdit: boolean;
  onSeekTo: (seconds: number) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onDelete: (id: string) => void;
  onReply: (noteId: string, content: string) => void;
  onDeleteReply: (replyId: string) => void;
  onCreateTask: (noteId: string) => void;
}> = ({ note, isActive, canEdit, onSeekTo, onResolve, onDelete, onReply, onDeleteReply, onCreateTask }) => {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitReply = async () => {
    if (!replyContent.trim()) return;
    setIsSubmitting(true);
    try {
      await onReply(note.id, replyContent);
      setReplyContent('');
      setShowReplyInput(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div
      className={cn(
        'border rounded-lg p-3 transition-colors',
        isActive
          ? 'border-accent-yellow bg-accent-yellow/10'
          : note.is_resolved
          ? 'border-muted-gray/10 bg-charcoal-black/30 opacity-60'
          : 'border-muted-gray/20 bg-charcoal-black/50 hover:border-muted-gray/30'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <Avatar className="h-7 w-7">
          <AvatarImage src={note.created_by_user?.avatar_url || undefined} />
          <AvatarFallback className="text-xs">
            {getInitials(note.created_by_user?.display_name || 'U')}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-bone-white truncate">
              {note.created_by_user?.display_name || 'Unknown'}
            </span>
            {note.timecode_seconds !== null && (
              <button
                onClick={() => onSeekTo(note.timecode_seconds!)}
                className="text-xs font-mono text-accent-yellow hover:underline"
              >
                {formatTimecode(note.timecode_seconds)}
              </button>
            )}
            {note.is_resolved && (
              <Badge variant="outline" className="text-xs bg-green-500/20 text-green-400 border-green-500/30">
                Resolved
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-gray">
            {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
          </p>
        </div>

        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onResolve(note.id, !note.is_resolved)}>
                {note.is_resolved ? (
                  <>
                    <Circle className="w-4 h-4 mr-2" />
                    Mark Unresolved
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Mark Resolved
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onCreateTask(note.id)}>
                <ListTodo className="w-4 h-4 mr-2" />
                Create Task
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(note.id)} className="text-red-400">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Note
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Content */}
      <p className="mt-2 text-sm text-bone-white whitespace-pre-wrap">{note.content}</p>

      {/* Linked task badge */}
      {note.linked_task_id && (
        <div className="mt-2">
          <Badge variant="outline" className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
            <ListTodo className="w-3 h-3 mr-1" />
            Task linked
          </Badge>
        </div>
      )}

      {/* Replies */}
      {note.replies && note.replies.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-muted-gray/20 pt-2">
          {note.replies.map((reply) => (
            <div key={reply.id} className="flex gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={reply.created_by_user?.avatar_url || undefined} />
                <AvatarFallback className="text-[10px]">
                  {getInitials(reply.created_by_user?.display_name || 'U')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-bone-white">
                    {reply.created_by_user?.display_name || 'Unknown'}
                  </span>
                  <span className="text-xs text-muted-gray">
                    {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-xs text-muted-gray whitespace-pre-wrap">{reply.content}</p>
              </div>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100"
                  onClick={() => onDeleteReply(reply.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      {showReplyInput ? (
        <div className="mt-3 flex gap-2">
          <Input
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write a reply..."
            className="flex-1 h-8 text-sm bg-charcoal-black border-muted-gray/30"
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmitReply()}
          />
          <Button
            size="sm"
            onClick={handleSubmitReply}
            disabled={!replyContent.trim() || isSubmitting}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowReplyInput(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          onClick={() => setShowReplyInput(true)}
          className="mt-2 text-xs text-muted-gray hover:text-bone-white flex items-center gap-1"
        >
          <Reply className="h-3 w-3" />
          Reply
        </button>
      )}
    </div>
  );
};

// Timeline with markers and drag-to-scrub
const Timeline: React.FC<{
  currentTime: number;
  duration: number;
  notes: ReviewNote[];
  onSeek: (time: number) => void;
}> = ({ currentTime, duration, notes, onSeek }) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const seekFromEvent = useCallback((clientX: number) => {
    if (!timelineRef.current || duration <= 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(percentage * duration);
  }, [duration, onSeek]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    seekFromEvent(e.clientX);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      seekFromEvent(e.clientX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, seekFromEvent]);

  // Get marker positions for timecoded notes
  const markers = notes
    .filter((n) => n.timecode_seconds !== null)
    .map((n) => ({
      id: n.id,
      position: ((n.timecode_seconds! / duration) * 100),
      resolved: n.is_resolved,
    }));

  return (
    <TooltipProvider>
      <div
        ref={timelineRef}
        className={cn(
          'relative bg-muted-gray/30 rounded-full group transition-all select-none',
          isDragging ? 'h-3 cursor-grabbing' : 'h-2 hover:h-3 cursor-pointer'
        )}
        onMouseDown={handleMouseDown}
      >
        {/* Progress bar */}
        <div
          className="absolute h-full bg-accent-yellow rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />

        {/* Playhead */}
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 rounded-full bg-accent-yellow transition-all',
            isDragging
              ? 'w-4 h-4 -ml-2 shadow-lg'
              : 'w-3 h-3 -ml-1.5 opacity-0 group-hover:opacity-100'
          )}
          style={{ left: `${progress}%` }}
        />

        {/* Note markers */}
        {markers.map((marker) => (
          <Tooltip key={marker.id}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full cursor-pointer transition-transform hover:scale-150',
                  marker.resolved ? 'bg-green-400' : 'bg-blue-400'
                )}
                style={{ left: `${marker.position}%`, marginLeft: '-4px' }}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>{formatTimecode(marker.position * duration / 100)}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
};

export const ReviewDetailView: React.FC<ReviewDetailViewProps> = ({
  assetId,
  projectId,
  canEdit,
  onBack,
}) => {
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [addNoteAtTimecode, setAddNoteAtTimecode] = useState<number | null>(null);
  const [showVersionPicker, setShowVersionPicker] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  // Hooks
  const {
    asset,
    versions,
    activeVersion,
    isLoading: assetLoading,
    createVersion,
    makeVersionActive,
    refetch: refetchAsset,
  } = useReviewAsset({ assetId });

  const {
    currentTime,
    duration,
    isPlaying,
    progress,
    bindVideoElement,
    play,
    pause,
    togglePlay,
    seekTo,
    seekRelative,
  } = useReviewPlayer();

  const {
    notes,
    sortedNotes,
    timecodedNotes,
    isLoading: notesLoading,
    createNote,
    updateNote,
    deleteNote,
    resolveNote,
    createReply,
    deleteReply,
    createTaskFromNote,
    getNotesAtTimecode,
  } = useReviewNotes({ versionId: activeVersion?.id || null });

  // Determine if this is an S3-stored version
  const enhancedVersion = activeVersion as ReviewVersionEnhanced | undefined;
  const isS3Storage = enhancedVersion?.storage_mode === 's3';
  const isTranscoding = enhancedVersion?.transcode_status === 'processing';
  const transcodeFailed = enhancedVersion?.transcode_status === 'failed';

  // Detect external video embeds
  const videoUrl = activeVersion?.video_url || (activeVersion as any)?.file_url || '';
  const ytMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  const vimeoMatch = videoUrl.match(/(?:vimeo\.com\/)(\d+)/);
  const isExternalEmbed = !isS3Storage && (!!ytMatch || !!vimeoMatch);
  const embedUrl = ytMatch
    ? `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=0&rel=0&enablejsapi=1&origin=${window.location.origin}`
    : vimeoMatch
    ? `https://player.vimeo.com/video/${vimeoMatch[1]}`
    : null;

  // Embedded player hook for YouTube/Vimeo timecode tracking
  const embeddedProvider = ytMatch ? 'youtube' : 'vimeo';
  const embeddedVideoId = ytMatch ? ytMatch[1] : vimeoMatch ? vimeoMatch[1] : '';
  const embeddedPlayer = useEmbeddedPlayer({
    provider: embeddedProvider as 'youtube' | 'vimeo',
    videoId: embeddedVideoId,
    iframeRef,
  });

  // Unified player state: use embedded player for external embeds, native player otherwise
  const playerTime = isExternalEmbed ? embeddedPlayer.currentTime : currentTime;
  const playerDuration = isExternalEmbed ? embeddedPlayer.duration : duration;
  const playerIsPlaying = isExternalEmbed ? embeddedPlayer.isPlaying : isPlaying;
  const playerSeekTo = isExternalEmbed ? embeddedPlayer.seekTo : seekTo;
  const playerTogglePlay = isExternalEmbed ? embeddedPlayer.togglePlay : togglePlay;
  const playerPlay = isExternalEmbed ? embeddedPlayer.play : play;
  const playerPause = isExternalEmbed ? embeddedPlayer.pause : pause;
  const playerSeekRelative = useCallback(
    (delta: number) => {
      if (isExternalEmbed) {
        embeddedPlayer.seekTo(embeddedPlayer.currentTime + delta);
      } else {
        seekRelative(delta);
      }
    },
    [isExternalEmbed, embeddedPlayer, seekRelative]
  );

  // Poll for asset data while transcoding is in progress
  useEffect(() => {
    if (!isTranscoding) return;
    const interval = setInterval(() => {
      refetchAsset();
    }, 5000);
    return () => clearInterval(interval);
  }, [isTranscoding, refetchAsset]);

  // Fetch presigned stream URL for S3 versions (only when transcode is done)
  useEffect(() => {
    if (!activeVersion) {
      setStreamUrl(null);
      return;
    }
    if (isTranscoding) {
      setStreamUrl(null);
      return;
    }
    if (isS3Storage && enhancedVersion?.s3_key) {
      api.getReviewVersionStreamUrl(activeVersion.id).then((res) => {
        setStreamUrl(res.url);
      }).catch((err) => {
        console.error('Failed to load stream URL:', err);
        setStreamUrl(activeVersion.video_url || null);
      });
    } else {
      // DB column is file_url, but TS type says video_url — handle both
      const url = (activeVersion as any).file_url || activeVersion.video_url || null;
      setStreamUrl(url);
    }
  }, [activeVersion?.id, isS3Storage, isTranscoding]);

  // Bind video element
  useEffect(() => {
    if (videoRef.current) {
      bindVideoElement(videoRef.current);
    }
  }, [bindVideoElement, streamUrl]);

  // Highlight note when playhead is near it
  useEffect(() => {
    const nearbyNotes = getNotesAtTimecode(playerTime, 1);
    if (nearbyNotes.length > 0 && !activeNoteId) {
      setActiveNoteId(nearbyNotes[0].id);
    }
  }, [playerTime, getNotesAtTimecode, activeNoteId]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          playerTogglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          playerSeekRelative(-5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          playerSeekRelative(5);
          break;
        case 'm':
          setIsMuted(!isMuted);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playerTogglePlay, playerSeekRelative, isMuted]);

  // Handle adding a note
  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return;

    await createNote.mutateAsync({
      content: newNoteContent,
      timecode_seconds: addNoteAtTimecode,
    });

    setNewNoteContent('');
    setAddNoteAtTimecode(null);
  };

  // Handle note actions
  const handleResolve = async (id: string, resolved: boolean) => {
    await resolveNote.mutateAsync({ id, is_resolved: resolved });
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm('Delete this note?')) return;
    await deleteNote.mutateAsync(id);
  };

  const handleReply = async (noteId: string, content: string) => {
    await createReply.mutateAsync({ noteId, content });
  };

  const handleDeleteReply = async (replyId: string) => {
    await deleteReply.mutateAsync(replyId);
  };

  const handleCreateTask = async (noteId: string) => {
    // TODO: Show task list picker modal
    alert('Task creation from notes will be implemented with task list selector');
  };

  // Handle seeking to a note
  const handleSeekToNote = (seconds: number) => {
    playerSeekTo(seconds);
    playerPause();
  };

  // Add note at current time
  const handleAddNoteAtCurrentTime = () => {
    playerPause();
    setAddNoteAtTimecode(playerTime);
  };

  // Handle version change
  const handleVersionChange = async (version: ReviewVersion) => {
    await makeVersionActive.mutateAsync(version.id);
    setShowVersionPicker(false);
  };

  if (assetLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-gray" />
      </div>
    );
  }

  if (!asset || !activeVersion) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <p className="text-muted-gray mb-4">Review asset not found</p>
        <Button onClick={onBack}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-charcoal-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-muted-gray/20">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="font-medium text-bone-white">{asset.name}</h2>
            {asset.description && (
              <p className="text-xs text-muted-gray">{asset.description}</p>
            )}
          </div>
        </div>

        {/* Version picker */}
        <DropdownMenu open={showVersionPicker} onOpenChange={setShowVersionPicker}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Layers className="h-4 w-4" />
              {activeVersion.name || `V${activeVersion.version_number}`}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {versions.map((v) => (
              <DropdownMenuItem
                key={v.id}
                onClick={() => handleVersionChange(v)}
                className={cn(v.id === activeVersion.id && 'bg-accent-yellow/20')}
              >
                <div className="flex items-center gap-2">
                  {v.id === activeVersion.id && <Check className="h-4 w-4 text-accent-yellow" />}
                  <span>{v.name || `V${v.version_number}`}</span>
                  <span className="text-xs text-muted-gray">
                    {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video player area */}
        <div className="flex-1 flex flex-col">
          {/* Video container */}
          <div ref={videoContainerRef} className="flex-1 bg-black relative">
            {isTranscoding ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
                <Loader2 className="w-10 h-10 animate-spin text-accent-yellow mb-4" />
                <p className="text-bone-white font-medium text-lg">Transcoding...</p>
                <p className="text-muted-gray text-sm mt-1">Your video is being processed. This may take a few minutes.</p>
              </div>
            ) : transcodeFailed ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
                <X className="w-10 h-10 text-primary-red mb-4" />
                <p className="text-bone-white font-medium text-lg">Transcoding Failed</p>
                <p className="text-muted-gray text-sm mt-1">
                  {(enhancedVersion as any)?.transcode_error || 'An error occurred during processing.'}
                </p>
              </div>
            ) : isExternalEmbed && embedUrl ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full max-h-full aspect-video">
                  <iframe
                    ref={iframeRef}
                    src={embedUrl}
                    className="w-full h-full"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    frameBorder="0"
                  />
                </div>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  src={streamUrl || undefined}
                  className="w-full h-full object-contain"
                  muted={isMuted}
                  onClick={playerTogglePlay}
                />

                {/* Play/pause overlay on click */}
                {!playerIsPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
                      <Play className="w-8 h-8 text-white fill-white ml-1" />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Controls */}
          <div className="px-4 py-3 bg-charcoal-black border-t border-muted-gray/20">
            {/* Timeline */}
            <Timeline
              currentTime={playerTime}
              duration={playerDuration}
              notes={timecodedNotes}
              onSeek={playerSeekTo}
            />

            {/* Control buttons */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => playerSeekRelative(-5)}>
                  <SkipBack className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={playerTogglePlay}>
                  {playerIsPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => playerSeekRelative(5)}>
                  <SkipForward className="h-5 w-5" />
                </Button>
                {!isExternalEmbed && (
                  <Button variant="ghost" size="icon" onClick={() => setIsMuted(!isMuted)}>
                    {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </Button>
                )}

                <span className="text-sm text-muted-gray font-mono ml-2">
                  {formatTimecode(playerTime)} / {formatTimecode(playerDuration)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={handleAddNoteAtCurrentTime}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Add Note at {formatTimecode(playerTime)}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Notes sidebar */}
        <div className="w-80 border-l border-muted-gray/20 flex flex-col bg-charcoal-black">
          {/* Notes header */}
          <div className="px-4 py-3 border-b border-muted-gray/20">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-bone-white flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Notes
              </h3>
              <Badge variant="outline">{notes.length}</Badge>
            </div>
          </div>

          {/* Add note input */}
          {canEdit && (
            <div className="p-4 border-b border-muted-gray/20">
              <Textarea
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder={
                  addNoteAtTimecode !== null
                    ? `Add note at ${formatTimecode(addNoteAtTimecode)}...`
                    : 'Add a general note...'
                }
                className="bg-charcoal-black border-muted-gray/30 min-h-[80px]"
              />
              <div className="flex items-center justify-between mt-2">
                {addNoteAtTimecode !== null && (
                  <Badge variant="outline" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {formatTimecode(addNoteAtTimecode)}
                    <button
                      onClick={() => setAddNoteAtTimecode(null)}
                      className="ml-1 hover:text-red-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={!newNoteContent.trim() || createNote.isPending}
                  className="ml-auto"
                >
                  {createNote.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Post Note
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Notes list */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {notesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-gray" />
                </div>
              ) : sortedNotes.length === 0 ? (
                <div className="text-center py-8 text-muted-gray">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No notes yet</p>
                  <p className="text-xs mt-1">Add a note to start the conversation</p>
                </div>
              ) : (
                sortedNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    isActive={activeNoteId === note.id}
                    canEdit={canEdit}
                    onSeekTo={handleSeekToNote}
                    onResolve={handleResolve}
                    onDelete={handleDeleteNote}
                    onReply={handleReply}
                    onDeleteReply={handleDeleteReply}
                    onCreateTask={handleCreateTask}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};

export default ReviewDetailView;
