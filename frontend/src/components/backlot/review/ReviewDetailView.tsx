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
import { ReviewAsset, ReviewNote, ReviewVersion, formatTimecode } from '@/types/backlot';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

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

// Timeline with markers
const Timeline: React.FC<{
  currentTime: number;
  duration: number;
  notes: ReviewNote[];
  onSeek: (time: number) => void;
}> = ({ currentTime, duration, notes, onSeek }) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || duration <= 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    onSeek(percentage * duration);
  };

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
        className="relative h-2 bg-muted-gray/30 rounded-full cursor-pointer group"
        onClick={handleClick}
      >
        {/* Progress bar */}
        <div
          className="absolute h-full bg-accent-yellow rounded-full transition-all"
          style={{ width: `${progress}%` }}
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

        {/* Hover indicator */}
        <div className="absolute -top-1 left-0 right-0 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
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

  const [isMuted, setIsMuted] = useState(false);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [addNoteAtTimecode, setAddNoteAtTimecode] = useState<number | null>(null);
  const [showVersionPicker, setShowVersionPicker] = useState(false);

  // Hooks
  const {
    asset,
    versions,
    activeVersion,
    isLoading: assetLoading,
    createVersion,
    makeVersionActive,
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

  // Bind video element
  useEffect(() => {
    if (videoRef.current) {
      bindVideoElement(videoRef.current);
    }
  }, [bindVideoElement, activeVersion?.video_url]);

  // Highlight note when playhead is near it
  useEffect(() => {
    const nearbyNotes = getNotesAtTimecode(currentTime, 1);
    if (nearbyNotes.length > 0 && !activeNoteId) {
      setActiveNoteId(nearbyNotes[0].id);
    }
  }, [currentTime, getNotesAtTimecode, activeNoteId]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekRelative(-5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekRelative(5);
          break;
        case 'm':
          setIsMuted(!isMuted);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, seekRelative, isMuted]);

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
    seekTo(seconds);
    pause();
  };

  // Add note at current time
  const handleAddNoteAtCurrentTime = () => {
    pause();
    setAddNoteAtTimecode(currentTime);
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
            <video
              ref={videoRef}
              src={activeVersion.video_url}
              className="w-full h-full object-contain"
              muted={isMuted}
              onClick={togglePlay}
            />

            {/* Play/pause overlay on click */}
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
                  <Play className="w-8 h-8 text-white fill-white ml-1" />
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="px-4 py-3 bg-charcoal-black border-t border-muted-gray/20">
            {/* Timeline */}
            <Timeline
              currentTime={currentTime}
              duration={duration}
              notes={timecodedNotes}
              onSeek={seekTo}
            />

            {/* Control buttons */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => seekRelative(-5)}>
                  <SkipBack className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={togglePlay}>
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => seekRelative(5)}>
                  <SkipForward className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setIsMuted(!isMuted)}>
                  {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </Button>

                <span className="text-sm text-muted-gray font-mono ml-2">
                  {formatTimecode(currentTime)} / {formatTimecode(duration)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={handleAddNoteAtCurrentTime}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Add Note at {formatTimecode(currentTime)}
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
