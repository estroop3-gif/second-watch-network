/**
 * KitRentalDetailContent - Read-only kit rental detail view for approval dialog
 */
import React from 'react';
import { differenceInDays, format } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';
import { Briefcase, User, Calendar, DollarSign, CalendarRange, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useKitRental } from '@/hooks/backlot';
import { cn } from '@/lib/utils';

interface KitRentalDetailContentProps {
  projectId: string;
  kitRentalId: string;
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  approved: { label: 'Approved', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  rejected: { label: 'Rejected', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  active: { label: 'Active', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  completed: { label: 'Completed', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  reimbursed: { label: 'Reimbursed', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  denied: { label: 'Denied', className: 'bg-red-600/20 text-red-500 border-red-600/30' },
} as const;

const RENTAL_TYPE_LABELS = {
  daily: 'Daily Rate',
  weekly: 'Weekly Rate',
  flat: 'Flat Rate',
} as const;

export default function KitRentalDetailContent({ projectId, kitRentalId }: KitRentalDetailContentProps) {
  const { data: kitRental, isLoading } = useKitRental(projectId, kitRentalId);

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

  if (!kitRental) {
    return (
      <div className="text-center py-8 text-muted-gray">
        Kit rental not found
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[kitRental.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const rentalTypeLabel = RENTAL_TYPE_LABELS[kitRental.rental_type as keyof typeof RENTAL_TYPE_LABELS] || kitRental.rental_type;

  // Calculate days
  const startDate = parseLocalDate(kitRental.start_date);
  const endDate = kitRental.end_date ? parseLocalDate(kitRental.end_date) : new Date();
  const daysUsed = kitRental.days_used || differenceInDays(endDate, startDate) + 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/10">
            <Briefcase className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-bone-white">
              {kitRental.kit_name}
            </h3>
            <p className="text-sm text-muted-gray">
              Submitted by {kitRental.user_name || 'Unknown'}
            </p>
          </div>
        </div>
        <Badge className={cn('border', statusConfig.className)}>
          {statusConfig.label}
        </Badge>
      </div>

      {/* Total Amount and Rental Period */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <p className="text-xs text-muted-gray mb-1">Total Amount</p>
          <p className="text-xl font-semibold text-bone-white flex items-center gap-1">
            <DollarSign className="w-5 h-5" />
            {kitRental.total_amount?.toFixed(2) || (kitRental.daily_rate * daysUsed).toFixed(2)}
          </p>
        </div>

        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <p className="text-xs text-muted-gray mb-1">Rental Period</p>
          <p className="text-lg text-bone-white flex items-center gap-2">
            <CalendarRange className="w-4 h-4" />
            {daysUsed} {daysUsed === 1 ? 'day' : 'days'}
          </p>
        </div>
      </div>

      {/* Date Range */}
      <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
        <h4 className="text-sm font-medium text-muted-gray mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Rental Dates
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-gray mb-1">Start Date</p>
            <p className="text-sm text-bone-white">
              {format(startDate, 'MMMM d, yyyy')}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-gray mb-1">End Date</p>
            <p className="text-sm text-bone-white">
              {kitRental.end_date
                ? format(endDate, 'MMMM d, yyyy')
                : 'Ongoing'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Rate Details */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <p className="text-xs text-muted-gray mb-1">Rate Type</p>
          <p className="text-sm font-medium text-bone-white flex items-center gap-1">
            <Tag className="w-3 h-3" />
            {rentalTypeLabel}
          </p>
        </div>

        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <p className="text-xs text-muted-gray mb-1">Daily Rate</p>
          <p className="text-sm font-medium text-bone-white">
            ${kitRental.daily_rate.toFixed(2)}/day
          </p>
        </div>

        {kitRental.weekly_rate && (
          <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
            <p className="text-xs text-muted-gray mb-1">Weekly Rate</p>
            <p className="text-sm font-medium text-bone-white">
              ${kitRental.weekly_rate.toFixed(2)}/week
            </p>
          </div>
        )}
      </div>

      {/* Kit Description */}
      {kitRental.kit_description && (
        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <h4 className="text-sm font-medium text-muted-gray mb-2">Kit Description</h4>
          <p className="text-sm text-bone-white whitespace-pre-wrap">{kitRental.kit_description}</p>
        </div>
      )}

      {/* Notes */}
      {kitRental.notes && (
        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <h4 className="text-sm font-medium text-muted-gray mb-2">Notes</h4>
          <p className="text-sm text-bone-white whitespace-pre-wrap">{kitRental.notes}</p>
        </div>
      )}

      {/* Rejection Reason */}
      {kitRental.rejection_reason && kitRental.status === 'rejected' && (
        <div className="bg-red-500/5 rounded-lg p-4 border border-red-500/20">
          <h4 className="text-sm font-medium text-red-400 mb-2">Rejection Reason</h4>
          <p className="text-sm text-bone-white whitespace-pre-wrap">{kitRental.rejection_reason}</p>
        </div>
      )}
    </div>
  );
}
