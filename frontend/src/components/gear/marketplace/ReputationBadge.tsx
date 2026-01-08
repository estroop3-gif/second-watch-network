/**
 * ReputationBadge.tsx
 * Visual badge showing organization verification and reputation status
 */
import React from 'react';
import {
  BadgeCheck,
  Shield,
  Star,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { ReputationStats } from '@/hooks/gear/useGearMarketplace';

interface ReputationBadgeProps {
  reputation?: ReputationStats | null;
  isVerified?: boolean;
  successfulRentals?: number;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  className?: string;
}

export function ReputationBadge({
  reputation,
  isVerified: isVerifiedProp,
  successfulRentals: successfulRentalsProp,
  size = 'md',
  showDetails = false,
  className,
}: ReputationBadgeProps) {
  // Use props or reputation data
  const isVerified = isVerifiedProp ?? reputation?.is_verified ?? false;
  const successfulRentals = successfulRentalsProp ?? reputation?.successful_rentals ?? 0;
  const totalRentals = reputation?.total_rentals ?? 0;
  const successRate = reputation?.success_rate ?? 0;
  const lateReturns = reputation?.late_returns ?? 0;
  const damageIncidents = reputation?.damage_incidents ?? 0;

  // Determine badge tier
  const getTier = () => {
    if (isVerified && successfulRentals >= 50) return 'platinum';
    if (isVerified && successfulRentals >= 25) return 'gold';
    if (isVerified) return 'verified';
    if (successfulRentals >= 3) return 'trusted';
    if (successfulRentals >= 1) return 'new';
    return 'none';
  };

  const tier = getTier();

  const tierConfig = {
    platinum: {
      label: 'Platinum',
      color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      icon: <Star className={cn('fill-purple-400', size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />,
    },
    gold: {
      label: 'Gold',
      color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      icon: <Star className={cn('fill-yellow-400', size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />,
    },
    verified: {
      label: 'Verified',
      color: 'bg-green-500/20 text-green-400 border-green-500/30',
      icon: <BadgeCheck className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />,
    },
    trusted: {
      label: 'Trusted',
      color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      icon: <Shield className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />,
    },
    new: {
      label: 'New',
      color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      icon: <TrendingUp className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />,
    },
    none: {
      label: '',
      color: '',
      icon: null,
    },
  };

  const config = tierConfig[tier];

  if (tier === 'none') {
    return null;
  }

  const badgeContent = (
    <Badge
      className={cn(
        'border gap-1',
        config.color,
        size === 'sm' && 'text-xs px-1.5 py-0',
        size === 'lg' && 'text-sm px-3 py-1',
        className
      )}
    >
      {config.icon}
      {config.label}
      {showDetails && successfulRentals > 0 && (
        <span className="ml-1 opacity-75">({successfulRentals})</span>
      )}
    </Badge>
  );

  // With tooltip for additional info
  if (reputation) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badgeContent}
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-2">
              <p className="font-medium">{config.label} Renter</p>
              <div className="text-xs space-y-1">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Successful Rentals</span>
                  <span>{successfulRentals}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Success Rate</span>
                  <span>{successRate}%</span>
                </div>
                {lateReturns > 0 && (
                  <div className="flex justify-between gap-4 text-yellow-400">
                    <span>Late Returns</span>
                    <span>{lateReturns}</span>
                  </div>
                )}
                {damageIncidents > 0 && (
                  <div className="flex justify-between gap-4 text-red-400">
                    <span>Damage Incidents</span>
                    <span>{damageIncidents}</span>
                  </div>
                )}
              </div>
              {!isVerified && reputation.rentals_until_verified > 0 && (
                <p className="text-xs text-muted-foreground pt-1 border-t border-white/10">
                  {reputation.rentals_until_verified} more successful rental{reputation.rentals_until_verified !== 1 ? 's' : ''} until verified
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badgeContent;
}

/**
 * Inline verified indicator (just the checkmark)
 */
export function VerifiedIndicator({
  isVerified,
  size = 'md',
  className,
}: {
  isVerified: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  if (!isVerified) return null;

  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <BadgeCheck className={cn('text-green-400', sizeClasses[size], className)} />
        </TooltipTrigger>
        <TooltipContent>
          <p>Verified Renter</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default ReputationBadge;
