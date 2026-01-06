/**
 * MileageDetailContent - Read-only mileage entry detail view for approval dialog
 */
import React from 'react';
import { formatDate } from '@/lib/dateUtils';
import { Car, User, Calendar, DollarSign, MapPin, Route, ArrowRightLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMileageEntry } from '@/hooks/backlot';
import { cn } from '@/lib/utils';

interface MileageDetailContentProps {
  projectId: string;
  mileageId: string;
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  approved: { label: 'Approved', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  rejected: { label: 'Rejected', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  reimbursed: { label: 'Reimbursed', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  denied: { label: 'Denied', className: 'bg-red-600/20 text-red-500 border-red-600/30' },
} as const;

export default function MileageDetailContent({ projectId, mileageId }: MileageDetailContentProps) {
  const { data: mileage, isLoading } = useMileageEntry(projectId, mileageId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
        <div className="grid grid-cols-2 gap-4 mt-6">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-20" />
      </div>
    );
  }

  if (!mileage) {
    return (
      <div className="text-center py-8 text-muted-gray">
        Mileage entry not found
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[mileage.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <Car className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-bone-white">
              Mileage Entry
            </h3>
            <p className="text-sm text-muted-gray">
              Submitted by {mileage.user_name || 'Unknown'}
            </p>
          </div>
        </div>
        <Badge className={cn('border', statusConfig.className)}>
          {statusConfig.label}
        </Badge>
      </div>

      {/* Amount and Date */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <p className="text-xs text-muted-gray mb-1">Total Amount</p>
          <p className="text-xl font-semibold text-bone-white flex items-center gap-1">
            <DollarSign className="w-5 h-5" />
            {mileage.total_amount?.toFixed(2) || (mileage.miles * mileage.rate_per_mile).toFixed(2)}
          </p>
        </div>

        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <p className="text-xs text-muted-gray mb-1">Date</p>
          <p className="text-lg text-bone-white flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {formatDate(mileage.date, 'MMMM d, yyyy')}
          </p>
        </div>
      </div>

      {/* Route Details */}
      <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
        <h4 className="text-sm font-medium text-muted-gray mb-4 flex items-center gap-2">
          <Route className="w-4 h-4" />
          Route Details
        </h4>

        <div className="flex items-center gap-4">
          {mileage.start_location && (
            <div className="flex-1">
              <p className="text-xs text-muted-gray mb-1">From</p>
              <p className="text-sm text-bone-white flex items-center gap-1">
                <MapPin className="w-3 h-3 text-green-400" />
                {mileage.start_location}
              </p>
            </div>
          )}

          <div className="flex flex-col items-center">
            <ArrowRightLeft className="w-5 h-5 text-muted-gray" />
            {mileage.is_round_trip && (
              <span className="text-xs text-muted-gray mt-1">Round Trip</span>
            )}
          </div>

          {mileage.end_location && (
            <div className="flex-1 text-right">
              <p className="text-xs text-muted-gray mb-1">To</p>
              <p className="text-sm text-bone-white flex items-center gap-1 justify-end">
                {mileage.end_location}
                <MapPin className="w-3 h-3 text-red-400" />
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mileage Details */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <p className="text-xs text-muted-gray mb-1">Miles</p>
          <p className="text-lg font-medium text-bone-white">{mileage.miles} mi</p>
        </div>

        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <p className="text-xs text-muted-gray mb-1">Rate per Mile</p>
          <p className="text-lg font-medium text-bone-white">${mileage.rate_per_mile.toFixed(3)}</p>
        </div>

        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <p className="text-xs text-muted-gray mb-1">Trip Type</p>
          <p className="text-lg font-medium text-bone-white">
            {mileage.is_round_trip ? 'Round Trip' : 'One Way'}
          </p>
        </div>
      </div>

      {/* Description */}
      {mileage.description && (
        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <h4 className="text-sm font-medium text-muted-gray mb-2">Description</h4>
          <p className="text-sm text-bone-white whitespace-pre-wrap">{mileage.description}</p>
        </div>
      )}

      {/* Purpose */}
      {mileage.purpose && (
        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <h4 className="text-sm font-medium text-muted-gray mb-2">Purpose</h4>
          <p className="text-sm text-bone-white whitespace-pre-wrap">{mileage.purpose}</p>
        </div>
      )}

      {/* Notes */}
      {mileage.notes && (
        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <h4 className="text-sm font-medium text-muted-gray mb-2">Notes</h4>
          <p className="text-sm text-bone-white whitespace-pre-wrap">{mileage.notes}</p>
        </div>
      )}

      {/* Rejection Reason */}
      {mileage.rejection_reason && mileage.status === 'rejected' && (
        <div className="bg-red-500/5 rounded-lg p-4 border border-red-500/20">
          <h4 className="text-sm font-medium text-red-400 mb-2">Rejection Reason</h4>
          <p className="text-sm text-bone-white whitespace-pre-wrap">{mileage.rejection_reason}</p>
        </div>
      )}
    </div>
  );
}
