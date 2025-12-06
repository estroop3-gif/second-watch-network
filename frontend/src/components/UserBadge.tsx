/**
 * UserBadge Component
 * Displays the user's primary role badge with appropriate styling.
 */
import { cn } from '@/lib/utils';
import {
  getPrimaryBadge,
  getAllBadges,
  type ProfileWithRoles,
  type BadgeConfig,
} from '@/lib/badges';

interface UserBadgeProps {
  profile: ProfileWithRoles | null;
  showAll?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Displays the user's primary badge or all badges.
 */
export function UserBadge({ profile, showAll = false, className, size = 'sm' }: UserBadgeProps) {
  if (!profile) {
    return null;
  }

  const badges = showAll ? getAllBadges(profile) : [getPrimaryBadge(profile)];

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {badges.map((badge) => (
        <span
          key={badge.role}
          className={cn(
            'rounded-[4px] transform -rotate-3 uppercase whitespace-nowrap',
            sizeClasses[size],
            badge.cssClass
          )}
          title={badge.description}
        >
          {badge.shortLabel}
        </span>
      ))}
    </div>
  );
}

interface BadgeDisplayProps {
  badge: BadgeConfig;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  rotate?: boolean;
}

/**
 * Displays a single badge.
 */
export function BadgeDisplay({ badge, className, size = 'sm', rotate = true }: BadgeDisplayProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <span
      className={cn(
        'rounded-[4px] uppercase whitespace-nowrap',
        rotate && 'transform -rotate-3',
        sizeClasses[size],
        badge.cssClass,
        className
      )}
      title={badge.description}
    >
      {badge.shortLabel}
    </span>
  );
}

export default UserBadge;
