/**
 * ClipDetailView - Detailed view of a single clip with playback and notes
 */
import React, { useState, useRef } from 'react';
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
  Play,
  Pause,
  Circle,
  Star,
  HardDrive,
  Cloud,
  Clock,
  Film,
  MessageSquare,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  Edit,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  useDailiesClip,
  useDailiesClipNotes,
  useDailiesClips,
} from '@/hooks/backlot';
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
}> = ({ note, canEdit, onResolve, onDelete, onSeek }) => {
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

  return (
    <div
      className={cn(
        'border rounded-lg p-3',
        note.is_resolved
          ? 'border-muted-gray/10 bg-charcoal-black/20'
          : 'border-muted-gray/30 bg-charcoal-black/50'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <Avatar className="w-8 h-8">
            <AvatarImage src={note.author?.avatar_url || ''} />
            <AvatarFallback className="text-xs">
              {(note.author?.display_name || 'U').slice(0, 1)}
            </AvatarFallback>
          </Avatar>
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
  // Fetch fresh clip data
  const { data: clip, isLoading: clipLoading } = useDailiesClip(initialClip.id);
  const { notes, addNote, resolveNote, deleteNote } = useDailiesClipNotes({
    clipId: initialClip.id,
  });
  const { clips: siblingClips, updateClip, toggleCircleTake, setRating } = useDailiesClips({
    cardId: initialClip.dailies_card_id,
  });

  // Video player ref
  const videoRef = useRef<HTMLVideoElement>(null);

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteCategory, setNoteCategory] = useState<DailiesClipNoteCategory | ''>('');
  const [noteAtTimestamp, setNoteAtTimestamp] = useState(true);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [metaForm, setMetaForm] = useState({
    scene_number: initialClip.scene_number || '',
    take_number: initialClip.take_number?.toString() || '',
    notes: initialClip.notes || '',
  });

  // Current clip data (prefer fresh data)
  const currentClip = clip || initialClip;

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

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      setCurrentTime(seconds);
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

  const handleSaveMeta = async () => {
    await updateClip.mutateAsync({
      id: currentClip.id,
      scene_number: metaForm.scene_number || null,
      take_number: metaForm.take_number ? parseInt(metaForm.take_number, 10) : null,
      notes: metaForm.notes || null,
    });
    setIsEditingMeta(false);
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
          <div className="aspect-video bg-charcoal-black rounded-lg overflow-hidden relative">
            {currentClip.storage_mode === 'cloud' && currentClip.cloud_url ? (
              <>
                <video
                  ref={videoRef}
                  src={currentClip.cloud_url}
                  className="w-full h-full object-contain"
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
                {/* Play button overlay */}
                <button
                  onClick={handlePlayPause}
                  className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
                >
                  {!isPlaying && (
                    <div className="w-16 h-16 rounded-full bg-accent-yellow/90 flex items-center justify-center">
                      <Play className="w-8 h-8 text-charcoal-black ml-1" />
                    </div>
                  )}
                </button>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
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
          </div>

          {/* Playback controls (for cloud clips) */}
          {currentClip.storage_mode === 'cloud' && currentClip.cloud_url && (
            <div className="flex items-center gap-4 bg-charcoal-black/50 rounded-lg p-3">
              <Button variant="ghost" size="icon" onClick={handlePlayPause}>
                {isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
              </Button>
              <div className="flex-1 bg-muted-gray/20 rounded-full h-2 cursor-pointer">
                <div
                  className="bg-accent-yellow h-full rounded-full"
                  style={{
                    width: `${
                      currentClip.duration_seconds
                        ? (currentTime / currentClip.duration_seconds) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
              <span className="text-sm text-muted-gray font-mono">
                {formatDuration(currentTime)} / {formatDuration(currentClip.duration_seconds)}
              </span>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex items-center justify-between bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
            <div className="flex items-center gap-4">
              {/* Circle Take */}
              <button
                onClick={handleToggleCircle}
                disabled={!canEdit}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
                  currentClip.is_circle_take
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-charcoal-black/50 text-muted-gray hover:text-bone-white'
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
                    disabled={!canEdit}
                    className="p-1 hover:scale-110 transition-transform"
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
            </div>

            {canEdit && (
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
              <h3 className="text-sm font-medium text-bone-white">Clip Info</h3>
              {canEdit && !isEditingMeta && (
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
                <div className="grid grid-cols-2 gap-3">
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
                {currentClip.duration_seconds && (
                  <div className="flex justify-between">
                    <span className="text-muted-gray">Duration</span>
                    <span className="text-bone-white">
                      {formatDuration(currentClip.duration_seconds)}
                    </span>
                  </div>
                )}
                {currentClip.timecode_start && (
                  <div className="flex justify-between">
                    <span className="text-muted-gray">Timecode</span>
                    <span className="text-bone-white font-mono text-xs">
                      {currentClip.timecode_start}
                    </span>
                  </div>
                )}
                {currentClip.resolution && (
                  <div className="flex justify-between">
                    <span className="text-muted-gray">Resolution</span>
                    <span className="text-bone-white">{currentClip.resolution}</span>
                  </div>
                )}
                {currentClip.codec && (
                  <div className="flex justify-between">
                    <span className="text-muted-gray">Codec</span>
                    <span className="text-bone-white">{currentClip.codec}</span>
                  </div>
                )}
                {currentClip.frame_rate && (
                  <div className="flex justify-between">
                    <span className="text-muted-gray">Frame Rate</span>
                    <span className="text-bone-white">{currentClip.frame_rate} fps</span>
                  </div>
                )}
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

          {/* Notes Section */}
          <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-bone-white">
                Notes ({notes.length})
              </h3>
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
                    value={noteCategory}
                    onValueChange={(v) =>
                      setNoteCategory(v as DailiesClipNoteCategory | '')
                    }
                  >
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No Category</SelectItem>
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
            {notes.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {notes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    canEdit={canEdit}
                    onResolve={handleResolveNote}
                    onDelete={handleDeleteNote}
                    onSeek={handleSeek}
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
    </div>
  );
};

export default ClipDetailView;
