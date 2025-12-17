/**
 * PersonCard - Shared component for displaying user profiles in a card format
 * Used by Community People directory and Backlot Add from Network modal
 */
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { CommunityProfile } from '@/types';
import { cn } from '@/lib/utils';

export interface PersonCardProps {
  profile: CommunityProfile;
  variant?: 'default' | 'compact';
  showProfileLink?: boolean;
  actions?: React.ReactNode;
  className?: string;
}

const PersonCard: React.FC<PersonCardProps> = ({
  profile,
  variant = 'default',
  showProfileLink = true,
  actions,
  className,
}) => {
  const name = profile.full_name || profile.display_name || profile.username || 'Member';
  const initials = (profile.full_name || profile.display_name || profile.username || 'M')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const username = profile.username || 'member';

  if (variant === 'compact') {
    return (
      <div className={cn(
        "flex items-center justify-between p-3 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg hover:border-muted-gray/40 transition-colors",
        className
      )}>
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 border-2 border-muted-gray">
            <AvatarImage src={profile.avatar_url || ''} alt={name} />
            <AvatarFallback className="bg-charcoal-black text-bone-white text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            {showProfileLink ? (
              <Link
                to={`/profile/${username}`}
                className="font-heading text-bone-white hover:text-accent-yellow transition-colors block truncate"
              >
                {name}
              </Link>
            ) : (
              <span className="font-heading text-bone-white block truncate">{name}</span>
            )}
            <p className="text-muted-gray text-xs truncate">@{username}</p>
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 ml-2 flex-shrink-0">{actions}</div>}
      </div>
    );
  }

  // Default variant - full card style matching Community
  return (
    <div className={cn(
      "bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-6 text-center flex flex-col items-center",
      className
    )}>
      {showProfileLink ? (
        <Link to={`/profile/${username}`} className="flex flex-col items-center">
          <Avatar className="w-24 h-24 mb-4 border-4 border-muted-gray">
            <AvatarImage src={profile.avatar_url || ''} alt={name} />
            <AvatarFallback className="bg-charcoal-black text-bone-white text-xl">
              {initials}
            </AvatarFallback>
          </Avatar>
          <h3 className="font-heading text-xl text-bone-white hover:text-accent-yellow transition-colors">
            {name}
          </h3>
        </Link>
      ) : (
        <>
          <Avatar className="w-24 h-24 mb-4 border-4 border-muted-gray">
            <AvatarImage src={profile.avatar_url || ''} alt={name} />
            <AvatarFallback className="bg-charcoal-black text-bone-white text-xl">
              {initials}
            </AvatarFallback>
          </Avatar>
          <h3 className="font-heading text-xl text-bone-white">{name}</h3>
        </>
      )}
      <p className="text-muted-gray text-sm mb-4">@{username}</p>

      {actions && (
        <div className="mt-auto flex flex-col gap-2 w-full pt-4">
          {actions}
        </div>
      )}

      {!actions && showProfileLink && (
        <div className="mt-auto flex flex-col gap-2 w-full pt-4">
          <Button asChild className="w-full bg-accent-yellow text-charcoal-black hover:bg-bone-white">
            <Link to={`/profile/${username}`}>View Profile</Link>
          </Button>
        </div>
      )}
    </div>
  );
};

export default PersonCard;
