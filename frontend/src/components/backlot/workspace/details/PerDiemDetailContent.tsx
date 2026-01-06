/**
 * PerDiemDetailContent - Read-only per diem entry detail view for approval dialog
 */
import React from 'react';
import { formatDate } from '@/lib/dateUtils';
import { Utensils, User, Calendar, DollarSign, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePerDiemEntry } from '@/hooks/backlot';
import { cn } from '@/lib/utils';

interface PerDiemDetailContentProps {
  projectId: string;
  perDiemId: string;
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  approved: { label: 'Approved', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  rejected: { label: 'Rejected', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  reimbursed: { label: 'Reimbursed', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  denied: { label: 'Denied', className: 'bg-red-600/20 text-red-500 border-red-600/30' },
} as const;

const MEAL_TYPE_CONFIG = {
  breakfast: { label: 'Breakfast', icon: '🌅', color: 'text-amber-400' },
  lunch: { label: 'Lunch', icon: '☀️', color: 'text-yellow-400' },
  dinner: { label: 'Dinner', icon: '🌙', color: 'text-indigo-400' },
  full_day: { label: 'Full Day', icon: '📅', color: 'text-green-400' },
} as const;

export default function PerDiemDetailContent({ projectId, perDiemId }: PerDiemDetailContentProps) {
  const { data: perDiem, isLoading } = usePerDiemEntry(projectId, perDiemId);

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

  if (!perDiem) {
    return (
      <div className="text-center py-8 text-muted-gray">
        Per diem entry not found
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[perDiem.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const mealConfig = MEAL_TYPE_CONFIG[perDiem.meal_type as keyof typeof MEAL_TYPE_CONFIG] || {
    label: perDiem.meal_type,
    icon: '🍽️',
    color: 'text-muted-gray',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-yellow-500/10">
            <Utensils className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-bone-white">
              Per Diem - {mealConfig.label}
            </h3>
            <p className="text-sm text-muted-gray">
              Submitted by {perDiem.user_name || 'Unknown'}
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
          <p className="text-xs text-muted-gray mb-1">Amount</p>
          <p className="text-xl font-semibold text-bone-white flex items-center gap-1">
            <DollarSign className="w-5 h-5" />
            {perDiem.amount.toFixed(2)}
          </p>
        </div>

        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <p className="text-xs text-muted-gray mb-1">Date</p>
          <p className="text-lg text-bone-white flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {formatDate(perDiem.date, 'MMMM d, yyyy')}
          </p>
        </div>
      </div>

      {/* Meal Type Details */}
      <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
        <h4 className="text-sm font-medium text-muted-gray mb-3">Meal Details</h4>
        <div className="flex items-center gap-4">
          <div className="text-4xl">{mealConfig.icon}</div>
          <div>
            <p className={cn('text-lg font-medium', mealConfig.color)}>
              {mealConfig.label}
            </p>
            <p className="text-sm text-muted-gray">
              {perDiem.meal_type === 'full_day'
                ? 'Covers all meals for the day'
                : `Single meal allowance`
              }
            </p>
          </div>
        </div>
      </div>

      {/* Location */}
      {perDiem.location && (
        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <h4 className="text-sm font-medium text-muted-gray mb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Location
          </h4>
          <p className="text-sm text-bone-white">{perDiem.location}</p>
        </div>
      )}

      {/* Notes */}
      {perDiem.notes && (
        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <h4 className="text-sm font-medium text-muted-gray mb-2">Notes</h4>
          <p className="text-sm text-bone-white whitespace-pre-wrap">{perDiem.notes}</p>
        </div>
      )}

      {/* Rejection Reason */}
      {perDiem.rejection_reason && perDiem.status === 'rejected' && (
        <div className="bg-red-500/5 rounded-lg p-4 border border-red-500/20">
          <h4 className="text-sm font-medium text-red-400 mb-2">Rejection Reason</h4>
          <p className="text-sm text-bone-white whitespace-pre-wrap">{perDiem.rejection_reason}</p>
        </div>
      )}
    </div>
  );
}
