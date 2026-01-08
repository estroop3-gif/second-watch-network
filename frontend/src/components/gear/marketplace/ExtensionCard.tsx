/**
 * ExtensionCard.tsx
 * Card component for displaying extension requests
 */
import React from 'react';
import {
  Calendar,
  Clock,
  Check,
  X,
  CalendarPlus,
  ArrowRight,
  Store,
  User,
  AlertCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { GearRentalExtension, ExtensionStatus } from '@/types/gear';

interface ExtensionCardProps {
  extension: GearRentalExtension;
  viewMode: 'incoming' | 'outgoing';
  onApprove?: () => void;
  onDeny?: () => void;
  onViewDetails?: () => void;
}

const STATUS_CONFIG: Record<ExtensionStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: {
    label: 'Pending',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    icon: <Clock className="h-3 w-3" />,
  },
  approved: {
    label: 'Approved',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: <Check className="h-3 w-3" />,
  },
  denied: {
    label: 'Denied',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: <X className="h-3 w-3" />,
  },
  auto_approved: {
    label: 'Auto-Approved',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: <Check className="h-3 w-3" />,
  },
};

export function ExtensionCard({
  extension,
  viewMode,
  onApprove,
  onDeny,
  onViewDetails,
}: ExtensionCardProps) {
  const statusConfig = STATUS_CONFIG[extension.status];
  const isPending = extension.status === 'pending';

  // Format dates
  const originalEndDate = extension.original_end_date
    ? format(parseISO(extension.original_end_date), 'MMM d, yyyy')
    : 'N/A';
  const requestedEndDate = extension.requested_end_date
    ? format(parseISO(extension.requested_end_date), 'MMM d, yyyy')
    : 'N/A';
  const approvedEndDate = extension.approved_end_date
    ? format(parseISO(extension.approved_end_date), 'MMM d, yyyy')
    : null;

  return (
    <Card className="border-white/10 bg-white/5">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <CalendarPlus className="h-4 w-4 text-accent-yellow" />
              <span className="font-medium text-bone-white">Extension Request</span>
              <Badge variant="outline" className={cn('text-xs', statusConfig.color)}>
                {statusConfig.icon}
                <span className="ml-1">{statusConfig.label}</span>
              </Badge>
            </div>

            {/* Date Change */}
            <div className="flex items-center gap-2 text-sm mb-3">
              <span className="text-muted-gray">{originalEndDate}</span>
              <ArrowRight className="h-3 w-3 text-muted-gray" />
              <span className={cn(
                'font-medium',
                approvedEndDate ? 'text-green-400' : 'text-accent-yellow'
              )}>
                {approvedEndDate || requestedEndDate}
              </span>
              <Badge variant="outline" className="text-xs">
                +{extension.additional_days} {extension.additional_days === 1 ? 'day' : 'days'}
              </Badge>
            </div>

            {/* Details */}
            <div className="flex flex-wrap gap-3 text-xs text-muted-gray">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Requested {extension.requested_at
                  ? format(parseISO(extension.requested_at), 'MMM d, yyyy')
                  : 'N/A'}
              </span>
              {extension.additional_amount && extension.additional_amount > 0 && (
                <span className="flex items-center gap-1 text-accent-yellow">
                  +${extension.additional_amount.toLocaleString()}
                </span>
              )}
            </div>

            {/* Reason */}
            {extension.reason && (
              <div className="mt-2 pt-2 border-t border-white/10">
                <p className="text-sm text-muted-gray line-clamp-2">
                  {extension.reason}
                </p>
              </div>
            )}

            {/* Denial Reason */}
            {extension.status === 'denied' && extension.denial_reason && (
              <div className="mt-2 flex items-start gap-2 rounded bg-red-500/10 p-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-400" />
                <p className="text-sm text-red-300">{extension.denial_reason}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {viewMode === 'incoming' && isPending && (
              <>
                <Button
                  size="sm"
                  onClick={onApprove}
                  className="gap-1"
                >
                  <Check className="h-3 w-3" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDeny}
                  className="gap-1 text-red-400 hover:text-red-300"
                >
                  <X className="h-3 w-3" />
                  Deny
                </Button>
              </>
            )}
            {viewMode === 'outgoing' && isPending && (
              <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-500/30">
                Awaiting Response
              </Badge>
            )}
            {onViewDetails && (
              <Button variant="ghost" size="sm" onClick={onViewDetails}>
                View Details
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ExtensionCard;
