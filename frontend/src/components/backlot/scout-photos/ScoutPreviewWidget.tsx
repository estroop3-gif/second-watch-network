/**
 * ScoutPreviewWidget - Compact preview of scout photos for call sheet view
 * Shows primary photo, practical summary, and derived tags
 */
import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Camera,
  Sun,
  Volume2,
  Zap,
  Car,
  DoorOpen,
  AlertTriangle,
  ImageIcon,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { useScoutSummary } from '@/hooks/backlot';

interface ScoutPreviewWidgetProps {
  locationId: string;
  locationName?: string;
  onViewPhotos?: () => void;
  className?: string;
}

export function ScoutPreviewWidget({
  locationId,
  locationName,
  onViewPhotos,
  className = '',
}: ScoutPreviewWidgetProps) {
  const { data: summary, isLoading, error } = useScoutSummary(locationId);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-4 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin text-muted-gray" />
      </div>
    );
  }

  if (error || !summary) {
    return null;
  }

  if (!summary.has_scout_photos) {
    return (
      <div className={`flex items-center gap-2 text-sm text-muted-gray/60 py-2 ${className}`}>
        <Camera className="w-4 h-4" />
        <span>No scout photos</span>
      </div>
    );
  }

  // Derive icon for practical notes indicators
  const hasLightInfo = summary.practical_summary?.includes('Light') ||
                       summary.practical_summary?.includes('Natural') ||
                       summary.practical_summary?.includes('Window');
  const hasSoundInfo = summary.practical_summary?.includes('Quiet') ||
                       summary.practical_summary?.includes('Sound') ||
                       summary.practical_summary?.includes('Noisy');
  const hasPowerInfo = summary.practical_summary?.includes('Power') ||
                       summary.practical_summary?.includes('Tie-in');
  const hasParkingInfo = summary.practical_summary?.includes('Parking') ||
                         summary.practical_summary?.includes('Vehicle');
  const hasAccessInfo = summary.practical_summary?.includes('Access') ||
                        summary.practical_summary?.includes('Truck') ||
                        summary.practical_summary?.includes('Elevator');
  const hasRestrictions = summary.practical_summary?.includes('Restrict') ||
                          summary.practical_summary?.includes('Permit') ||
                          summary.practical_summary?.includes('No ');

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-accent-yellow" />
          <span className="text-sm font-medium text-bone-white">Scout Photos</span>
          <Badge variant="outline" className="text-xs border-muted-gray/30">
            {summary.photo_count}
          </Badge>
        </div>
        {onViewPhotos && (
          <button
            onClick={onViewPhotos}
            className="text-xs text-accent-yellow hover:underline flex items-center gap-1"
          >
            View All
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="flex gap-3">
        {/* Primary Photo Thumbnail */}
        {summary.primary_photo && (
          <div className="w-24 h-20 shrink-0 rounded-md overflow-hidden border border-muted-gray/20 bg-muted-gray/10">
            <img
              src={summary.primary_photo.thumbnail_url || summary.primary_photo.image_url}
              alt={summary.primary_photo.angle_label || 'Primary scout photo'}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Info Section */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Tags */}
          {summary.tags && summary.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {summary.tags.slice(0, 6).map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-xs py-0 border-muted-gray/30 text-muted-gray"
                >
                  {tag}
                </Badge>
              ))}
              {summary.tags.length > 6 && (
                <span className="text-xs text-muted-gray/60">+{summary.tags.length - 6}</span>
              )}
            </div>
          )}

          {/* Practical Notes Indicators */}
          <div className="flex items-center gap-2">
            {hasLightInfo && (
              <Sun className="w-3.5 h-3.5 text-amber-400" title="Light notes available" />
            )}
            {hasSoundInfo && (
              <Volume2 className="w-3.5 h-3.5 text-blue-400" title="Sound notes available" />
            )}
            {hasPowerInfo && (
              <Zap className="w-3.5 h-3.5 text-yellow-400" title="Power notes available" />
            )}
            {hasParkingInfo && (
              <Car className="w-3.5 h-3.5 text-green-400" title="Parking notes available" />
            )}
            {hasAccessInfo && (
              <DoorOpen className="w-3.5 h-3.5 text-purple-400" title="Access notes available" />
            )}
            {hasRestrictions && (
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" title="Restrictions noted" />
            )}
          </div>

          {/* Practical Summary */}
          {summary.practical_summary && (
            <p className="text-xs text-muted-gray line-clamp-2">
              {summary.practical_summary}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScoutPreviewWidget;
