/**
 * DailiesView - Main dailies management view with day/card/clip browsing
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
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
  HardDrive,
  Cloud,
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
  Wifi,
  WifiOff,
  Link,
  FolderOpen,
  Download,
  ExternalLink,
} from 'lucide-react';
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
} from '@/types/backlot';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import ClipDetailView from './ClipDetailView';

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

// Clip Card Component
const ClipCard: React.FC<{
  clip: BacklotDailiesClip;
  onSelect: () => void;
  onToggleCircle: (id: string, isCircle: boolean) => void;
  canEdit: boolean;
}> = ({ clip, onSelect, onToggleCircle, canEdit }) => {
  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={cn(
        'bg-charcoal-black/50 border rounded-lg p-3 cursor-pointer hover:border-accent-yellow/50 transition-colors',
        clip.is_circle_take ? 'border-green-500/50' : 'border-muted-gray/20'
      )}
      onClick={onSelect}
    >
      {/* Thumbnail area */}
      <div className="aspect-video bg-charcoal-black rounded mb-2 flex items-center justify-center relative">
        {clip.storage_mode === 'cloud' && clip.cloud_url ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Play className="w-8 h-8 text-bone-white/50" />
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
              {format(parseISO(day.shoot_date), 'MMMM d, yyyy')}
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

// Main Component
const DailiesView: React.FC<DailiesViewProps> = ({ projectId, canEdit }) => {
  const { days, isLoading, createDay, updateDay, deleteDay } = useDailiesDays({ projectId });
  const { data: summary } = useDailiesSummary(projectId);
  const { isConnected: helperConnected, status: helperStatus } = useDesktopHelper();

  // State
  const [selectedClip, setSelectedClip] = useState<BacklotDailiesClip | null>(null);
  const [showDayForm, setShowDayForm] = useState(false);
  const [editingDay, setEditingDay] = useState<BacklotDailiesDay | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [editingCard, setEditingCard] = useState<BacklotDailiesCard | null>(null);
  const [cardDayId, setCardDayId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLocalBrowser, setShowLocalBrowser] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

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
    if (!cardDayId) return;
    setIsSubmitting(true);
    try {
      if (editingCard) {
        await updateCard.mutateAsync({ id: editingCard.id, ...cardForm });
      } else {
        await createCard.mutateAsync({ dayId: cardDayId, projectId, ...cardForm });
      }
      setShowCardForm(false);
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
          {canEdit && (
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

      {/* Days List */}
      {days.length > 0 ? (
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
            Add shoot days to start organizing your dailies. You can upload clips to the cloud
            or register local drive footage for review.
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
        <DialogContent className="sm:max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-accent-yellow" />
              Browse Local Drives
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {helperConnected ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-gray">
                  Browse files on your local drives through the SWN Desktop Helper.
                  Select clips to add them to your dailies.
                </p>
                <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-8 text-center">
                  <Monitor className="w-12 h-12 text-muted-gray/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-gray mb-2">
                    Local file browser coming soon
                  </p>
                  <p className="text-xs text-muted-gray/70">
                    Use the Desktop Helper app to offload and ingest footage directly.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <WifiOff className="w-12 h-12 text-muted-gray/30 mx-auto mb-3" />
                <p className="text-muted-gray mb-2">Desktop Helper not connected</p>
                <p className="text-sm text-muted-gray/70">
                  Install and run the SWN Desktop Helper to browse local drives.
                </p>
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

            <div className="pt-4 space-y-3">
              <div className="bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg p-4">
                <p className="text-sm font-medium text-bone-white mb-2 text-center">
                  Alpha Release Available
                </p>
                <p className="text-xs text-muted-gray text-center mb-3">
                  Compiled binaries coming soon. For now, install from source:
                </p>
                <div className="bg-charcoal-black rounded p-3 font-mono text-xs text-muted-gray">
                  <p>pip install git+https://github.com/estroop3-gif/swn-dailies-helper.git</p>
                  <p className="mt-1">swn-helper</p>
                </div>
              </div>
            </div>

            <div className="pt-4 text-center">
              <a
                href="https://github.com/estroop3-gif/swn-dailies-helper/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-accent-yellow text-charcoal-black rounded-lg hover:bg-bone-white transition-colors font-medium text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                View on GitHub
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DailiesView;
