/**
 * ApplicantSidebar - Left sidebar with profile summary and actions
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApplicantProfileSnapshot, ApplicationStatus } from '@/types/applications';
import {
  ExternalLink,
  Mail,
  MessageSquare,
  MapPin,
  Briefcase,
  Star,
  Loader2,
} from 'lucide-react';

interface ApplicantSidebarProps {
  profile: ApplicantProfileSnapshot | undefined;
  location?: string;
  experienceLevel?: string;
  status: ApplicationStatus;
  rating: number | null;
  internalNotes: string | null;
  isUpdating: boolean;
  onStatusChange: (status: ApplicationStatus) => void;
  onRatingChange: (rating: number) => void;
  onNotesChange: (notes: string) => void;
  onMessage: () => void;
  onEmail?: () => void;
}

const STATUS_OPTIONS: { id: ApplicationStatus; label: string; color: string }[] = [
  { id: 'applied', label: 'Applied', color: 'bg-muted-gray/20' },
  { id: 'viewed', label: 'Viewed', color: 'bg-blue-500/20' },
  { id: 'shortlisted', label: 'Shortlisted', color: 'bg-yellow-500/20' },
  { id: 'interview', label: 'Interview', color: 'bg-purple-500/20' },
  { id: 'offered', label: 'Offered', color: 'bg-green-500/20' },
  { id: 'booked', label: 'Booked', color: 'bg-green-600/20' },
  { id: 'rejected', label: 'Rejected', color: 'bg-red-500/20' },
];

export function ApplicantSidebar({
  profile,
  location,
  experienceLevel,
  status,
  rating,
  internalNotes,
  isUpdating,
  onStatusChange,
  onRatingChange,
  onNotesChange,
  onMessage,
  onEmail,
}: ApplicantSidebarProps) {
  const [notes, setNotes] = useState(internalNotes || '');
  const [notesTimer, setNotesTimer] = useState<NodeJS.Timeout | null>(null);

  // Sync internal notes from props
  useEffect(() => {
    setNotes(internalNotes || '');
  }, [internalNotes]);

  // Debounced notes save
  const handleNotesChange = useCallback(
    (value: string) => {
      setNotes(value);

      // Clear previous timer
      if (notesTimer) {
        clearTimeout(notesTimer);
      }

      // Set new timer for auto-save (1.5 seconds after last keystroke)
      const timer = setTimeout(() => {
        onNotesChange(value);
      }, 1500);

      setNotesTimer(timer);
    },
    [notesTimer, onNotesChange]
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (notesTimer) {
        clearTimeout(notesTimer);
      }
    };
  }, [notesTimer]);

  const displayName =
    profile?.full_name || profile?.display_name || profile?.username || 'Unknown';

  return (
    <div className="w-80 shrink-0 border-r border-muted-gray/30 bg-charcoal-black/50 p-6 overflow-y-auto">
      {/* Profile Header */}
      <div className="flex flex-col items-center text-center mb-6">
        <Avatar className="h-24 w-24 mb-4">
          <AvatarImage src={profile?.avatar_url} />
          <AvatarFallback className="text-2xl">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <h2 className="text-xl font-semibold text-bone-white">{displayName}</h2>
        {profile?.is_order_member && (
          <Badge className="mt-2 bg-accent-yellow text-charcoal-black">
            Order Member
          </Badge>
        )}
        {profile?.username && (
          <Link
            to={`/profile/${profile.username}`}
            className="mt-2 text-sm text-accent-yellow hover:underline flex items-center gap-1"
          >
            View Full Profile <ExternalLink className="w-3 h-3" />
          </Link>
        )}
      </div>

      {/* Quick Stats */}
      {(location || experienceLevel) && (
        <div className="space-y-2 mb-6 pb-6 border-b border-muted-gray/30">
          {location && (
            <div className="flex items-center gap-2 text-sm text-muted-gray">
              <MapPin className="w-4 h-4" />
              <span>{location}</span>
            </div>
          )}
          {experienceLevel && (
            <div className="flex items-center gap-2 text-sm text-muted-gray">
              <Briefcase className="w-4 h-4" />
              <span className="capitalize">{experienceLevel.replace(/_/g, ' ')}</span>
            </div>
          )}
        </div>
      )}

      {/* Status Dropdown */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-muted-gray mb-2">Status</label>
        <Select
          value={status}
          onValueChange={(value) => onStatusChange(value as ApplicationStatus)}
          disabled={isUpdating}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${opt.color}`} />
                  {opt.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Rating */}
      <div className="mb-6 pb-6 border-b border-muted-gray/30">
        <label className="block text-xs font-medium text-muted-gray mb-2">Rating</label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => onRatingChange(star)}
              disabled={isUpdating}
              className="p-1 hover:scale-110 transition-transform disabled:opacity-50"
              title={`Rate ${star} star${star !== 1 ? 's' : ''}`}
            >
              <Star
                className={`w-6 h-6 ${
                  rating && rating >= star
                    ? 'text-accent-yellow fill-accent-yellow'
                    : 'text-muted-gray hover:text-accent-yellow/50'
                }`}
              />
            </button>
          ))}
          {rating && (
            <button
              onClick={() => onRatingChange(0)}
              disabled={isUpdating}
              className="ml-2 text-xs text-muted-gray hover:text-bone-white"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-6 pb-6 border-b border-muted-gray/30">
        <Button
          variant="outline"
          className="flex-1 border-muted-gray/30"
          onClick={onMessage}
        >
          <MessageSquare className="w-4 h-4 mr-2" />
          Message
        </Button>
        {onEmail && (
          <Button
            variant="outline"
            className="flex-1 border-muted-gray/30"
            onClick={onEmail}
          >
            <Mail className="w-4 h-4 mr-2" />
            Email
          </Button>
        )}
      </div>

      {/* Internal Notes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-muted-gray">Internal Notes</label>
          {isUpdating && <Loader2 className="w-3 h-3 animate-spin text-muted-gray" />}
        </div>
        <Textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Add private notes about this applicant..."
          className="min-h-[120px] resize-none bg-charcoal-black/50 border-muted-gray/30"
        />
        <p className="text-xs text-muted-gray mt-1">Auto-saves after you stop typing</p>
      </div>
    </div>
  );
}
