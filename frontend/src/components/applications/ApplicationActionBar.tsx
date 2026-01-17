/**
 * ApplicationActionBar - Action toolbar for application detail view
 */
import React, { useState } from 'react';
import {
  MessageSquare,
  Calendar,
  Star,
  StickyNote,
  UserCheck,
  UserX,
  Send,
  ChevronDown,
  Clock,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import BookingWizard from './BookingWizard';
import { useApplicationSchedule, useApplicationBooking } from '@/hooks/applications/useApplicationBooking';

interface ApplicationActionBarProps {
  applicationId: string;
  applicantName: string;
  applicantId: string;
  collabTitle: string;
  collabType: string;
  collabOwnerId: string;
  currentStatus: string;
  rateExpectation?: string;
  interviewScheduledAt?: string;
  callbackScheduledAt?: string;
  isCastRole?: boolean;
  characters?: Array<{ id: string; name: string }>;
  onStatusChange: (status: string, notes?: string) => Promise<void>;
  onRatingChange?: (rating: number) => Promise<void>;
  onNotesChange?: (notes: string) => Promise<void>;
  onMessageClick?: () => void;
  onHistoryClick?: () => void;
  className?: string;
}

const STATUS_OPTIONS = [
  { value: 'applied', label: 'Applied', color: 'text-blue-400' },
  { value: 'viewed', label: 'Viewed', color: 'text-muted-gray' },
  { value: 'shortlisted', label: 'Shortlisted', color: 'text-accent-yellow' },
  { value: 'interview', label: 'Interview', color: 'text-purple-400' },
  { value: 'offered', label: 'Offered', color: 'text-green-400' },
  { value: 'booked', label: 'Booked', color: 'text-green-500' },
  { value: 'rejected', label: 'Rejected', color: 'text-red-400' },
];

const ApplicationActionBar: React.FC<ApplicationActionBarProps> = ({
  applicationId,
  applicantName,
  applicantId,
  collabTitle,
  collabType,
  collabOwnerId,
  currentStatus,
  rateExpectation,
  interviewScheduledAt,
  callbackScheduledAt,
  isCastRole = false,
  characters = [],
  onStatusChange,
  onRatingChange,
  onNotesChange,
  onMessageClick,
  onHistoryClick,
  className,
}) => {
  const [showBookingWizard, setShowBookingWizard] = useState(false);
  const [schedulePopoverOpen, setSchedulePopoverOpen] = useState(false);
  const [notesPopoverOpen, setNotesPopoverOpen] = useState(false);
  const [ratingPopoverOpen, setRatingPopoverOpen] = useState(false);
  const [interviewDate, setInterviewDate] = useState(interviewScheduledAt || '');
  const [callbackDate, setCallbackDate] = useState(callbackScheduledAt || '');
  const [internalNotes, setInternalNotes] = useState('');
  const [selectedRating, setSelectedRating] = useState<number>(0);

  const { updateSchedule } = useApplicationSchedule(applicationId);
  const { unbookApplicant } = useApplicationBooking(applicationId);

  const currentStatusOption = STATUS_OPTIONS.find((s) => s.value === currentStatus);

  const handleStatusChange = async (status: string) => {
    if (status === 'booked') {
      setShowBookingWizard(true);
      return;
    }

    try {
      await onStatusChange(status);
      toast.success(`Status updated to ${STATUS_OPTIONS.find((s) => s.value === status)?.label}`);
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleUnbook = async () => {
    const reason = window.prompt('Please provide a reason for unbooking:');
    if (!reason) return;

    try {
      await unbookApplicant.mutateAsync({ reason });
      toast.success(`${applicantName} has been unbooked`);
    } catch (error) {
      console.error('Failed to unbook:', error);
      toast.error('Failed to unbook applicant');
    }
  };

  const handleScheduleSave = async () => {
    try {
      await updateSchedule.mutateAsync({
        interview_scheduled_at: interviewDate || null,
        callback_scheduled_at: callbackDate || null,
      });
      setSchedulePopoverOpen(false);
      toast.success('Schedule updated');
    } catch (error) {
      console.error('Failed to update schedule:', error);
      toast.error('Failed to update schedule');
    }
  };

  const handleRatingSave = async () => {
    if (onRatingChange && selectedRating > 0) {
      try {
        await onRatingChange(selectedRating);
        setRatingPopoverOpen(false);
        toast.success('Rating saved');
      } catch (error) {
        console.error('Failed to save rating:', error);
        toast.error('Failed to save rating');
      }
    }
  };

  const handleNotesSave = async () => {
    if (onNotesChange && internalNotes.trim()) {
      try {
        await onNotesChange(internalNotes);
        setNotesPopoverOpen(false);
        toast.success('Notes saved');
      } catch (error) {
        console.error('Failed to save notes:', error);
        toast.error('Failed to save notes');
      }
    }
  };

  return (
    <>
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        {/* Message button */}
        {onMessageClick && (
          <Button
            variant="outline"
            size="sm"
            onClick={onMessageClick}
            className="border-muted-gray/30 text-bone-white hover:bg-muted-gray/20"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Message
          </Button>
        )}

        {/* Status dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="border-muted-gray/30 text-bone-white hover:bg-muted-gray/20"
            >
              <span className={cn('mr-2', currentStatusOption?.color)}>
                {currentStatusOption?.label || currentStatus}
              </span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {STATUS_OPTIONS.filter((s) => s.value !== 'booked').map((status) => (
              <DropdownMenuItem
                key={status.value}
                onClick={() => handleStatusChange(status.value)}
                className={cn(status.color, status.value === currentStatus && 'font-bold')}
              >
                {status.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Book button (only if not already booked) */}
        {currentStatus !== 'booked' && (
          <Button
            size="sm"
            onClick={() => setShowBookingWizard(true)}
            className="bg-accent-yellow hover:bg-accent-yellow/90 text-charcoal-black"
          >
            <UserCheck className="h-4 w-4 mr-2" />
            Book
          </Button>
        )}

        {/* Unbook button (only if booked) */}
        {currentStatus === 'booked' && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleUnbook}
          >
            <UserX className="h-4 w-4 mr-2" />
            Unbook
          </Button>
        )}

        {/* Schedule popover */}
        <Popover open={schedulePopoverOpen} onOpenChange={setSchedulePopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'border-muted-gray/30 text-bone-white hover:bg-muted-gray/20',
                (interviewDate || callbackDate) && 'border-purple-400/50'
              )}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Schedule
              {(interviewDate || callbackDate) && (
                <Clock className="h-3 w-3 ml-1 text-purple-400" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 bg-charcoal-black border-muted-gray/30">
            <div className="space-y-4">
              <div>
                <Label htmlFor="interviewDate" className="text-sm text-bone-white">
                  Interview Date/Time
                </Label>
                <Input
                  id="interviewDate"
                  type="datetime-local"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  className="mt-1 bg-charcoal-black/50 border-muted-gray/30 text-bone-white"
                />
              </div>
              <div>
                <Label htmlFor="callbackDate" className="text-sm text-bone-white">
                  Callback Date/Time
                </Label>
                <Input
                  id="callbackDate"
                  type="datetime-local"
                  value={callbackDate}
                  onChange={(e) => setCallbackDate(e.target.value)}
                  className="mt-1 bg-charcoal-black/50 border-muted-gray/30 text-bone-white"
                />
              </div>
              <Button
                size="sm"
                onClick={handleScheduleSave}
                disabled={updateSchedule.isPending}
                className="w-full bg-accent-yellow hover:bg-accent-yellow/90 text-charcoal-black"
              >
                Save Schedule
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Rating popover */}
        {onRatingChange && (
          <Popover open={ratingPopoverOpen} onOpenChange={setRatingPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-muted-gray/30 text-bone-white hover:bg-muted-gray/20"
              >
                <Star className="h-4 w-4 mr-2" />
                Rate
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 bg-charcoal-black border-muted-gray/30">
              <div className="space-y-3">
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setSelectedRating(star)}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={cn(
                          'h-6 w-6',
                          star <= selectedRating
                            ? 'fill-accent-yellow text-accent-yellow'
                            : 'text-muted-gray'
                        )}
                      />
                    </button>
                  ))}
                </div>
                <Button
                  size="sm"
                  onClick={handleRatingSave}
                  disabled={selectedRating === 0}
                  className="w-full bg-accent-yellow hover:bg-accent-yellow/90 text-charcoal-black"
                >
                  Save Rating
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Notes popover */}
        {onNotesChange && (
          <Popover open={notesPopoverOpen} onOpenChange={setNotesPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-muted-gray/30 text-bone-white hover:bg-muted-gray/20"
              >
                <StickyNote className="h-4 w-4 mr-2" />
                Notes
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 bg-charcoal-black border-muted-gray/30">
              <div className="space-y-3">
                <Label htmlFor="notes" className="text-sm text-bone-white">
                  Internal Notes
                </Label>
                <Textarea
                  id="notes"
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Add notes about this applicant..."
                  className="bg-charcoal-black/50 border-muted-gray/30 text-bone-white min-h-[100px]"
                />
                <Button
                  size="sm"
                  onClick={handleNotesSave}
                  disabled={!internalNotes.trim()}
                  className="w-full bg-accent-yellow hover:bg-accent-yellow/90 text-charcoal-black"
                >
                  Save Notes
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* History button */}
        {onHistoryClick && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onHistoryClick}
            className="text-muted-gray hover:text-bone-white"
          >
            <History className="h-4 w-4 mr-2" />
            History
          </Button>
        )}
      </div>

      {/* Booking Wizard Modal */}
      <BookingWizard
        open={showBookingWizard}
        onClose={() => setShowBookingWizard(false)}
        applicationId={applicationId}
        applicantName={applicantName}
        collabTitle={collabTitle}
        collabType={collabType}
        rateExpectation={rateExpectation}
        isCastRole={isCastRole}
        characters={characters}
      />
    </>
  );
};

export default ApplicationActionBar;
