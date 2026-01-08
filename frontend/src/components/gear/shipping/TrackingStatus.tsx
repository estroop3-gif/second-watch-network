/**
 * TrackingStatus
 * Display shipment tracking information with timeline
 */
import React from 'react';
import {
  Package,
  Truck,
  MapPin,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { TrackingInfo, TrackingEvent, ShipmentStatus, ShippingCarrier } from '@/types/gear';

interface TrackingStatusProps {
  trackingInfo: TrackingInfo | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  compact?: boolean;
  className?: string;
}

// Status configuration
const STATUS_CONFIG: Record<ShipmentStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: {
    label: 'Pending',
    color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    icon: <Clock className="w-4 h-4" />,
  },
  label_created: {
    label: 'Label Created',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: <Package className="w-4 h-4" />,
  },
  shipped: {
    label: 'Shipped',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: <Package className="w-4 h-4" />,
  },
  in_transit: {
    label: 'In Transit',
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    icon: <Truck className="w-4 h-4" />,
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: <Truck className="w-4 h-4" />,
  },
  delivered: {
    label: 'Delivered',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  returned: {
    label: 'Returned',
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    icon: <Package className="w-4 h-4" />,
  },
  exception: {
    label: 'Exception',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
};

// Carrier configuration
const CARRIER_CONFIG: Record<ShippingCarrier, { label: string; trackingUrl?: (tracking: string) => string }> = {
  usps: {
    label: 'USPS',
    trackingUrl: (t) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`,
  },
  ups: {
    label: 'UPS',
    trackingUrl: (t) => `https://www.ups.com/track?tracknum=${t}`,
  },
  fedex: {
    label: 'FedEx',
    trackingUrl: (t) => `https://www.fedex.com/apps/fedextrack/?tracknumbers=${t}`,
  },
  dhl: {
    label: 'DHL',
    trackingUrl: (t) => `https://www.dhl.com/en/express/tracking.html?AWB=${t}`,
  },
  other: { label: 'Other' },
};

function formatEventDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 24) {
    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} min ago`;
    }
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function TrackingStatus({
  trackingInfo,
  loading = false,
  error = null,
  onRefresh,
  refreshing = false,
  compact = false,
  className,
}: TrackingStatusProps) {
  if (loading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-20" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-4 rounded-lg bg-red-500/10 border border-red-500/30', className)}>
        <div className="flex items-start gap-2 text-red-400">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Unable to get tracking info</p>
            <p className="text-sm text-red-400/80 mt-1">{error}</p>
            {onRefresh && (
              <Button variant="ghost" size="sm" className="mt-2" onClick={onRefresh}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!trackingInfo) {
    return (
      <div className={cn('text-center text-muted-gray py-6', className)}>
        <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No tracking information available yet.</p>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[trackingInfo.status] || STATUS_CONFIG.pending;
  const carrierConfig = CARRIER_CONFIG[trackingInfo.carrier] || CARRIER_CONFIG.other;
  const trackingUrl =
    trackingInfo.tracking_url ||
    (carrierConfig.trackingUrl && trackingInfo.tracking_number
      ? carrierConfig.trackingUrl(trackingInfo.tracking_number)
      : null);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with status and refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className={cn('border', statusConfig.color)}>
            {statusConfig.icon}
            <span className="ml-1.5">{statusConfig.label}</span>
          </Badge>
          <span className="text-sm text-muted-gray">{carrierConfig.label}</span>
        </div>

        {onRefresh && (
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>

      {/* Tracking number */}
      {trackingInfo.tracking_number && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
          <div>
            <p className="text-xs text-muted-gray">Tracking Number</p>
            <p className="text-sm font-mono text-bone-white">{trackingInfo.tracking_number}</p>
          </div>
          {trackingUrl && (
            <a
              href={trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-accent-yellow hover:underline"
            >
              Track on {carrierConfig.label}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* Estimated/Actual delivery */}
      {(trackingInfo.estimated_delivery_date || trackingInfo.actual_delivery_date) && (
        <div className="p-3 rounded-lg bg-white/5">
          {trackingInfo.actual_delivery_date ? (
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                Delivered on{' '}
                {new Date(trackingInfo.actual_delivery_date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
          ) : trackingInfo.estimated_delivery_date ? (
            <div className="flex items-center gap-2 text-bone-white">
              <Clock className="w-4 h-4 text-muted-gray" />
              <span>
                Estimated delivery:{' '}
                <span className="font-medium">
                  {new Date(trackingInfo.estimated_delivery_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </span>
            </div>
          ) : null}
        </div>
      )}

      {/* Event timeline (if not compact) */}
      {!compact && trackingInfo.events && trackingInfo.events.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-bone-white mb-3">Tracking History</h4>
          <div className="space-y-0">
            {trackingInfo.events.map((event, index) => (
              <TrackingEventItem
                key={index}
                event={event}
                isFirst={index === 0}
                isLast={index === trackingInfo.events!.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      {/* Compact: Just show latest event */}
      {compact && trackingInfo.events && trackingInfo.events.length > 0 && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
          <MapPin className="w-4 h-4 text-muted-gray flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-bone-white">{trackingInfo.events[0].message}</p>
            <p className="text-xs text-muted-gray mt-0.5">
              {trackingInfo.events[0].location && `${trackingInfo.events[0].location} • `}
              {formatEventDate(trackingInfo.events[0].timestamp)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function TrackingEventItem({
  event,
  isFirst,
  isLast,
}: {
  event: TrackingEvent;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div className="flex gap-3">
      {/* Timeline indicator */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'w-2.5 h-2.5 rounded-full flex-shrink-0',
            isFirst ? 'bg-accent-yellow' : 'bg-muted-gray/50'
          )}
        />
        {!isLast && <div className="w-0.5 flex-1 bg-muted-gray/30 my-1" />}
      </div>

      {/* Event content */}
      <div className="flex-1 pb-4">
        <p className={cn('text-sm', isFirst ? 'text-bone-white font-medium' : 'text-muted-gray')}>
          {event.message}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-gray mt-0.5">
          {event.location && (
            <>
              <MapPin className="w-3 h-3" />
              <span>{event.location}</span>
              <span>•</span>
            </>
          )}
          <span>{formatEventDate(event.timestamp)}</span>
        </div>
      </div>
    </div>
  );
}

export default TrackingStatus;
