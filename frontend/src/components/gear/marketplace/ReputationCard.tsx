/**
 * ReputationCard.tsx
 * Card component for displaying detailed reputation information
 */
import React from 'react';
import {
  BadgeCheck,
  TrendingUp,
  Clock,
  AlertTriangle,
  DollarSign,
  Star,
  Target,
  ChevronRight,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { ReputationBadge } from './ReputationBadge';
import type { ReputationStats } from '@/hooks/gear/useGearMarketplace';

interface ReputationCardProps {
  reputation?: ReputationStats | null;
  isLoading?: boolean;
  showProgress?: boolean;
  compact?: boolean;
  className?: string;
}

export function ReputationCard({
  reputation,
  isLoading,
  showProgress = true,
  compact = false,
  className,
}: ReputationCardProps) {
  if (isLoading) {
    return (
      <Card className={cn('bg-charcoal-black/50 border-muted-gray/30', className)}>
        <CardContent className="p-4">
          <div className="space-y-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!reputation) {
    return (
      <Card className={cn('bg-charcoal-black/50 border-muted-gray/30', className)}>
        <CardContent className="p-4 text-center">
          <p className="text-muted-gray">No reputation data available</p>
        </CardContent>
      </Card>
    );
  }

  const progressToVerification = reputation.is_verified
    ? 100
    : Math.min(100, (reputation.successful_rentals / reputation.verification_threshold) * 100);

  if (compact) {
    return (
      <Card className={cn('bg-charcoal-black/50 border-muted-gray/30', className)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ReputationBadge reputation={reputation} size="md" />
              <div>
                <p className="text-sm font-medium text-bone-white">
                  {reputation.successful_rentals} successful rental{reputation.successful_rentals !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-muted-gray">
                  {reputation.success_rate}% success rate
                </p>
              </div>
            </div>
            {!reputation.is_verified && reputation.rentals_until_verified > 0 && (
              <div className="text-right">
                <p className="text-xs text-muted-gray">
                  {reputation.rentals_until_verified} until verified
                </p>
                <Progress value={progressToVerification} className="h-1 w-20 mt-1" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('bg-charcoal-black/50 border-muted-gray/30', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="w-4 h-4 text-accent-yellow" />
            Reputation
          </CardTitle>
          <ReputationBadge reputation={reputation} size="md" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Verification Progress */}
        {showProgress && !reputation.is_verified && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-gray">Progress to Verified</span>
              <span className="text-bone-white">
                {reputation.successful_rentals} / {reputation.verification_threshold}
              </span>
            </div>
            <Progress value={progressToVerification} className="h-2" />
            <p className="text-xs text-muted-gray">
              {reputation.rentals_until_verified} more successful rental{reputation.rentals_until_verified !== 1 ? 's' : ''} needed
            </p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Successful Rentals */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-gray">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-xs">Successful</span>
            </div>
            <p className="text-lg font-semibold text-green-400">
              {reputation.successful_rentals}
            </p>
          </div>

          {/* Success Rate */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-gray">
              <Target className="w-4 h-4 text-blue-400" />
              <span className="text-xs">Success Rate</span>
            </div>
            <p className="text-lg font-semibold text-blue-400">
              {reputation.success_rate}%
            </p>
          </div>

          {/* Late Returns */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-gray">
              <Clock className="w-4 h-4 text-yellow-400" />
              <span className="text-xs">Late Returns</span>
            </div>
            <p className={cn(
              'text-lg font-semibold',
              reputation.late_returns > 0 ? 'text-yellow-400' : 'text-muted-gray'
            )}>
              {reputation.late_returns}
            </p>
          </div>

          {/* Damage Incidents */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-gray">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-xs">Incidents</span>
            </div>
            <p className={cn(
              'text-lg font-semibold',
              reputation.damage_incidents > 0 ? 'text-red-400' : 'text-muted-gray'
            )}>
              {reputation.damage_incidents}
            </p>
          </div>
        </div>

        {/* Total Value */}
        {reputation.total_rental_value > 0 && (
          <div className="pt-3 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-gray flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Total Rental Value
              </span>
              <span className="text-sm font-medium text-bone-white">
                ${reputation.total_rental_value.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Verification Status */}
        {reputation.is_verified && reputation.verified_at && (
          <div className="pt-3 border-t border-white/10">
            <div className="flex items-center gap-2">
              <BadgeCheck className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-400">
                Verified since {new Date(reputation.verified_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Mini reputation summary for lists
 */
export function ReputationSummary({
  reputation,
  className,
}: {
  reputation?: ReputationStats | null;
  className?: string;
}) {
  if (!reputation) return null;

  return (
    <div className={cn('flex items-center gap-2 text-xs', className)}>
      <ReputationBadge reputation={reputation} size="sm" />
      {reputation.successful_rentals > 0 && (
        <span className="text-muted-gray">
          {reputation.successful_rentals} rental{reputation.successful_rentals !== 1 ? 's' : ''}
        </span>
      )}
      {reputation.late_returns > 0 && (
        <span className="text-yellow-400">
          {reputation.late_returns} late
        </span>
      )}
    </div>
  );
}

export default ReputationCard;
