/**
 * ScheduleView - Manage production days/schedule
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Calendar,
  Plus,
  Clock,
  MapPin,
  Check,
  MoreVertical,
  Edit,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProductionDays } from '@/hooks/backlot';
import { BacklotProductionDay, ProductionDayInput } from '@/types/backlot';
import { format, isAfter, isBefore } from 'date-fns';

interface ScheduleViewProps {
  projectId: string;
  canEdit: boolean;
}

const DayCard: React.FC<{
  day: BacklotProductionDay;
  canEdit: boolean;
  onEdit: (day: BacklotProductionDay) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}> = ({ day, canEdit, onEdit, onToggleComplete, onDelete }) => {
  const today = new Date();
  const dayDate = new Date(day.date);
  const isPast = isBefore(dayDate, today) && !day.is_completed;
  const isToday = format(dayDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');

  return (
    <div
      className={`bg-charcoal-black/50 border rounded-lg p-4 transition-colors ${
        day.is_completed
          ? 'border-green-500/30 bg-green-500/5'
          : isToday
          ? 'border-accent-yellow/50'
          : isPast
          ? 'border-orange-500/30'
          : 'border-muted-gray/20 hover:border-muted-gray/40'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          {/* Day Number & Title */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold text-accent-yellow">Day {day.day_number}</span>
            {day.is_completed && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                <Check className="w-3 h-3 mr-1" />
                Complete
              </Badge>
            )}
            {isToday && !day.is_completed && (
              <Badge className="bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30">
                Today
              </Badge>
            )}
            {isPast && (
              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                Past Due
              </Badge>
            )}
          </div>

          {/* Title */}
          {day.title && <h4 className="font-medium text-bone-white mb-2">{day.title}</h4>}

          {/* Date & Time */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-gray">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {format(new Date(day.date), 'EEEE, MMMM d, yyyy')}
            </div>
            {day.general_call_time && (
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Call: {day.general_call_time}
                {day.wrap_time && ` - Wrap: ${day.wrap_time}`}
              </div>
            )}
          </div>

          {/* Location */}
          {(day.location_name || day.location_address) && (
            <div className="flex items-center gap-1 text-sm text-muted-gray mt-2">
              <MapPin className="w-4 h-4" />
              {day.location_name}
              {day.location_address && ` • ${day.location_address}`}
            </div>
          )}

          {/* Description */}
          {day.description && (
            <p className="text-sm text-muted-gray mt-2 line-clamp-2">{day.description}</p>
          )}
        </div>

        {/* Actions */}
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(day)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleComplete(day.id, !day.is_completed)}>
                <Check className="w-4 h-4 mr-2" />
                {day.is_completed ? 'Mark Incomplete' : 'Mark Complete'}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-400" onClick={() => onDelete(day.id)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
};

const ScheduleView: React.FC<ScheduleViewProps> = ({ projectId, canEdit }) => {
  const { days, isLoading, createDay, updateDay, markCompleted, deleteDay } =
    useProductionDays(projectId);

  const [showForm, setShowForm] = useState(false);
  const [editingDay, setEditingDay] = useState<BacklotProductionDay | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState<ProductionDayInput>({
    day_number: 1,
    date: format(new Date(), 'yyyy-MM-dd'),
    title: '',
    description: '',
    general_call_time: '',
    wrap_time: '',
    location_name: '',
    location_address: '',
    notes: '',
  });

  const resetForm = () => {
    setFormData({
      day_number: days.length + 1,
      date: format(new Date(), 'yyyy-MM-dd'),
      title: '',
      description: '',
      general_call_time: '',
      wrap_time: '',
      location_name: '',
      location_address: '',
      notes: '',
    });
  };

  const handleOpenForm = (day?: BacklotProductionDay) => {
    if (day) {
      setEditingDay(day);
      setFormData({
        day_number: day.day_number,
        date: day.date,
        title: day.title || '',
        description: day.description || '',
        general_call_time: day.general_call_time || '',
        wrap_time: day.wrap_time || '',
        location_name: day.location_name || '',
        location_address: day.location_address || '',
        notes: day.notes || '',
      });
    } else {
      setEditingDay(null);
      resetForm();
    }
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingDay) {
        await updateDay.mutateAsync({
          id: editingDay.id,
          ...formData,
        });
      } else {
        await createDay.mutateAsync({
          projectId,
          ...formData,
        });
      }
      setShowForm(false);
      resetForm();
    } catch (err) {
      console.error('Failed to save day:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this production day?')) {
      await deleteDay.mutateAsync(id);
    }
  };

  const handleToggleComplete = async (id: string, completed: boolean) => {
    await markCompleted.mutateAsync({ id, completed });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading text-bone-white">Schedule</h2>
          <p className="text-sm text-muted-gray">Manage your production days</p>
        </div>
        {canEdit && (
          <Button
            onClick={() => handleOpenForm()}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Day
          </Button>
        )}
      </div>

      {/* Days List */}
      {days.length > 0 ? (
        <div className="space-y-4">
          {days.map((day) => (
            <DayCard
              key={day.id}
              day={day}
              canEdit={canEdit}
              onEdit={handleOpenForm}
              onToggleComplete={handleToggleComplete}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
          <Calendar className="w-12 h-12 text-muted-gray/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-bone-white mb-2">No production days yet</h3>
          <p className="text-muted-gray mb-4">Add your first shoot day to get started.</p>
          {canEdit && (
            <Button
              onClick={() => handleOpenForm()}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Day
            </Button>
          )}
        </div>
      )}

      {/* Day Form Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingDay ? `Edit Day ${editingDay.day_number}` : 'Add Production Day'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="day_number">Day Number *</Label>
                <Input
                  id="day_number"
                  type="number"
                  min={1}
                  value={formData.day_number}
                  onChange={(e) =>
                    setFormData({ ...formData, day_number: parseInt(e.target.value) || 1 })
                  }
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g., EXT. BEACH - Day Scene"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="call_time">Call Time</Label>
                <Input
                  id="call_time"
                  type="time"
                  value={formData.general_call_time}
                  onChange={(e) => setFormData({ ...formData, general_call_time: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wrap_time">Wrap Time</Label>
                <Input
                  id="wrap_time"
                  type="time"
                  value={formData.wrap_time}
                  onChange={(e) => setFormData({ ...formData, wrap_time: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location_name">Location Name</Label>
              <Input
                id="location_name"
                placeholder="e.g., Malibu Beach"
                value={formData.location_name}
                onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location_address">Location Address</Label>
              <Input
                id="location_address"
                placeholder="Full address..."
                value={formData.location_address}
                onChange={(e) => setFormData({ ...formData, location_address: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What's happening this day..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={isSubmitting}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
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
    </div>
  );
};

export default ScheduleView;
