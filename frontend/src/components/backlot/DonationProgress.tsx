/**
 * DonationProgress - Shows donation progress for a project
 * Includes progress bar (if goal set), total raised, and recent donors
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Heart, Users, Target, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DonationProgressProps {
  projectId: string;
  compact?: boolean;
  className?: string;
}

const formatCurrency = (cents: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
};

const DonationProgress: React.FC<DonationProgressProps> = ({
  projectId,
  compact = false,
  className,
}) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['donation-summary', projectId],
    queryFn: () => api.getDonationSummary(projectId),
    enabled: !!projectId,
    staleTime: 30000, // 30 seconds
  });

  if (isLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        <Skeleton className="h-4 w-24 bg-muted-gray/30" />
        <Skeleton className="h-2 w-full bg-muted-gray/30" />
        <Skeleton className="h-3 w-32 bg-muted-gray/30" />
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  // Don't show anything if donations are not enabled
  if (!data.donations_enabled) {
    return null;
  }

  const hasGoal = data.goal_cents && data.goal_cents > 0;
  const progressPercent = data.percent_of_goal || 0;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3 text-sm', className)}>
        <div className="flex items-center gap-1 text-primary-red">
          <Heart className="w-4 h-4" />
          <span className="font-medium">{formatCurrency(data.total_raised_cents)}</span>
        </div>
        {hasGoal && (
          <>
            <span className="text-muted-gray">/</span>
            <span className="text-muted-gray">{formatCurrency(data.goal_cents!)}</span>
          </>
        )}
        <span className="text-muted-gray">•</span>
        <span className="text-muted-gray">{data.donor_count} donors</span>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with total raised */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Heart className="w-5 h-5 text-primary-red" />
            <span className="text-2xl font-bold text-bone-white">
              {formatCurrency(data.total_raised_cents)}
            </span>
          </div>
          {hasGoal && (
            <p className="text-sm text-muted-gray">
              raised of {formatCurrency(data.goal_cents!)} goal
            </p>
          )}
          {!hasGoal && data.donation_count > 0 && (
            <p className="text-sm text-muted-gray">
              raised from {data.donor_count} supporter{data.donor_count !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {hasGoal && (
          <div className="text-right">
            <div className="flex items-center gap-1 text-primary-red">
              <Target className="w-4 h-4" />
              <span className="font-semibold">{progressPercent}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Progress bar (only if goal set) */}
      {hasGoal && (
        <Progress
          value={progressPercent}
          className="h-3 bg-muted-gray/30"
        />
      )}

      {/* Stats row */}
      <div className="flex items-center gap-4 text-sm text-muted-gray">
        <div className="flex items-center gap-1">
          <Users className="w-4 h-4" />
          <span>{data.donor_count} donor{data.donor_count !== 1 ? 's' : ''}</span>
        </div>
        {data.donation_count > data.donor_count && (
          <div className="flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            <span>{data.donation_count} donation{data.donation_count !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Recent donors */}
      {data.recent_donors.length > 0 && (
        <div className="border-t border-muted-gray/30 pt-3">
          <p className="text-xs text-muted-gray mb-2">Recent supporters:</p>
          <div className="space-y-1">
            {data.recent_donors.slice(0, 3).map((donor, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className="text-bone-white/80">{donor.name}</span>
                <span className="text-muted-gray">{formatCurrency(donor.amount_cents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom donation message */}
      {data.donation_message && (
        <div className="bg-muted-gray/10 p-3 rounded-lg text-sm text-bone-white/70 italic border border-muted-gray/20">
          "{data.donation_message}"
        </div>
      )}
    </div>
  );
};

export default DonationProgress;
