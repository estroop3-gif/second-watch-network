/**
 * User Strike Card
 * Displays a user's strike summary in the strikes list
 */
import React from 'react';
import { format } from 'date-fns';
import { ChevronRight, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { EscalationStatusBadge } from './EscalationStatusBadge';
import type { UserStrikeSummary, StrikeSeverity } from '@/types/gear';

interface UserStrikeCardProps {
  user: UserStrikeSummary;
  onClick?: () => void;
  className?: string;
}

const severityColors: Record<StrikeSeverity, string> = {
  warning: 'text-blue-400',
  minor: 'text-yellow-400',
  major: 'text-orange-400',
  critical: 'text-red-400',
};

export function UserStrikeCard({ user, onClick, className }: UserStrikeCardProps) {
  const initials = user.user_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  return (
    <Card
      className={cn(
        'p-4 bg-charcoal-black/50 border-muted-gray/30 hover:border-muted-gray/50 transition-colors cursor-pointer',
        user.is_escalated && user.requires_manager_review && 'border-red-500/30 bg-red-500/5',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left: Avatar + User Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar className="w-10 h-10">
            <AvatarImage src={user.avatar_url} alt={user.user_name} />
            <AvatarFallback className="bg-muted-gray/20 text-bone-white">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-bone-white truncate">{user.user_name}</span>
              <EscalationStatusBadge
                isEscalated={user.is_escalated}
                requiresReview={user.requires_manager_review}
                reviewDecision={user.review_decision}
                activeStrikes={user.active_strikes}
              />
            </div>

            <div className="text-sm text-muted-gray mt-0.5">
              {user.active_strikes} active strike{user.active_strikes !== 1 ? 's' : ''} &bull;{' '}
              {user.active_points} point{user.active_points !== 1 ? 's' : ''}
              {user.lifetime_strikes > user.active_strikes && (
                <span className="text-muted-gray/60">
                  {' '}&bull; {user.lifetime_strikes} lifetime
                </span>
              )}
            </div>

            {user.latest_strike && (
              <div className="text-xs text-muted-gray/70 mt-1 truncate">
                Latest:{' '}
                <span className={cn('capitalize', severityColors[user.latest_strike.severity])}>
                  {user.latest_strike.severity}
                </span>
                {' - '}
                {user.latest_strike.reason}
                {' ('}
                {format(new Date(user.latest_strike.issued_at), 'MMM d, yyyy')}
                {')'}
              </div>
            )}
          </div>
        </div>

        {/* Right: Arrow */}
        <ChevronRight className="w-5 h-5 text-muted-gray flex-shrink-0" />
      </div>
    </Card>
  );
}

export default UserStrikeCard;
