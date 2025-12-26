/**
 * ApplicationCard - Individual application card for Kanban board
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Star,
  StarOff,
  Sparkles,
  Shield,
  Clock,
  FileText,
  MapPin,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { CollabApplication } from '@/types/applications';

interface ApplicationCardProps {
  application: CollabApplication;
  onClick: () => void;
  onRatingChange?: (rating: number | null) => void;
}

const ApplicationCard: React.FC<ApplicationCardProps> = ({
  application,
  onClick,
  onRatingChange,
}) => {
  const profile = application.current_profile || application.applicant_profile_snapshot;
  const displayName = profile?.display_name || profile?.full_name || profile?.username || 'Anonymous';
  const initials = displayName.slice(0, 1).toUpperCase();
  const role = profile?.role || 'Member';

  // Quick star rating
  const handleStarClick = (e: React.MouseEvent, rating: number) => {
    e.stopPropagation();
    if (onRatingChange) {
      onRatingChange(application.rating === rating ? null : rating);
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-charcoal-black border border-muted-gray/30 rounded-lg p-4 cursor-pointer transition-all',
        'hover:border-accent-yellow/50 hover:shadow-lg hover:shadow-accent-yellow/5',
        application.is_promoted && 'ring-1 ring-amber-400/30'
      )}
    >
      {/* Promoted Badge */}
      {application.is_promoted && (
        <div className="flex items-center gap-1 text-amber-400 text-xs mb-2">
          <Sparkles className="w-3 h-3" />
          <span>Promoted</span>
        </div>
      )}

      {/* Header with Avatar */}
      <div className="flex items-start gap-3 mb-3">
        <Avatar className="w-10 h-10">
          <AvatarImage src={profile?.avatar_url || ''} alt={displayName} />
          <AvatarFallback className="text-sm">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-medium text-bone-white truncate">{displayName}</span>
            {profile?.is_order_member && (
              <Shield className="w-3 h-3 text-emerald-400 flex-shrink-0" />
            )}
          </div>
          <div className="text-xs text-muted-gray truncate">{role}</div>
        </div>
      </div>

      {/* Elevator Pitch */}
      {application.elevator_pitch && (
        <p className="text-sm text-muted-gray mb-3 line-clamp-2">
          "{application.elevator_pitch}"
        </p>
      )}

      {/* Attachments */}
      <div className="flex flex-wrap gap-1 mb-3">
        {application.resume_url && (
          <Badge variant="outline" className="text-[10px] border-green-400/30 text-green-400 py-0">
            <FileText className="w-2.5 h-2.5 mr-0.5" />
            Resume
          </Badge>
        )}
        {application.local_hire_confirmed && (
          <Badge variant="outline" className="text-[10px] border-amber-400/30 text-amber-400 py-0">
            <MapPin className="w-2.5 h-2.5 mr-0.5" />
            Local
          </Badge>
        )}
      </div>

      {/* Credits Count */}
      {application.selected_credit_ids && application.selected_credit_ids.length > 0 && (
        <div className="text-xs text-muted-gray mb-3">
          {application.selected_credit_ids.length} credit{application.selected_credit_ids.length !== 1 ? 's' : ''} attached
        </div>
      )}

      {/* Footer with Time and Rating */}
      <div className="flex items-center justify-between pt-2 border-t border-muted-gray/20">
        <div className="flex items-center gap-1 text-[10px] text-muted-gray">
          <Clock className="w-3 h-3" />
          {formatDistanceToNow(new Date(application.created_at), { addSuffix: true })}
        </div>

        {/* Quick Rating */}
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={(e) => handleStarClick(e, star)}
              className="p-0.5 hover:scale-110 transition-transform"
            >
              {application.rating && application.rating >= star ? (
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              ) : (
                <StarOff className="w-3.5 h-3.5 text-muted-gray/50 hover:text-muted-gray" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ApplicationCard;
