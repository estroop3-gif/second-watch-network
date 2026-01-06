/**
 * ReviewTimelineView - Timeline visualization of review assets
 * Shows assets organized by date with version history
 */
import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ReviewAsset,
  ReviewAssetEnhanced,
  ReviewAssetStatus,
  formatTimecode,
} from '@/types/backlot';
import {
  Film,
  MessageSquare,
  Play,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isWithinInterval, isSameDay } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';

// Status configuration
const STATUS_CONFIG: Record<ReviewAssetStatus, { label: string; color: string; bgColor: string }> = {
  draft: { label: 'Draft', color: 'text-muted-gray', bgColor: 'bg-muted-gray/20' },
  in_review: { label: 'In Review', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  changes_requested: { label: 'Changes', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  approved: { label: 'Approved', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  final: { label: 'Final', color: 'text-accent-yellow', bgColor: 'bg-accent-yellow/20' },
};

interface ReviewTimelineViewProps {
  assets: (ReviewAsset | ReviewAssetEnhanced)[];
  canEdit: boolean;
  onView: (asset: ReviewAsset) => void;
  onStatusChange?: (assetId: string, status: ReviewAssetStatus) => void;
}

// Timeline card component
const TimelineCard: React.FC<{
  asset: ReviewAsset | ReviewAssetEnhanced;
  onView: (asset: ReviewAsset) => void;
}> = ({ asset, onView }) => {
  const enhanced = asset as ReviewAssetEnhanced;
  const status = enhanced.status || 'draft';
  const config = STATUS_CONFIG[status];
  const duration = asset.active_version?.duration_seconds;

  return (
    <div
      className="bg-charcoal-black border border-muted-gray/20 rounded-lg overflow-hidden cursor-pointer hover:border-muted-gray/40 transition-all group"
      onClick={() => onView(asset)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-charcoal-dark">
        {asset.thumbnail_url ? (
          <img
            src={asset.thumbnail_url}
            alt={asset.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="w-8 h-8 text-muted-gray/50" />
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
          </div>
        </div>

        {/* Duration badge */}
        {duration !== null && duration !== undefined && (
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 rounded text-xs text-white font-mono">
            {formatTimecode(duration)}
          </div>
        )}

        {/* Status badge */}
        <div className={cn(
          'absolute top-1 left-1 px-1.5 py-0.5 rounded text-xs font-medium',
          config.bgColor,
          config.color
        )}>
          {config.label}
        </div>
      </div>

      {/* Info */}
      <div className="p-2">
        <h4 className="text-sm font-medium text-bone-white truncate">
          {asset.name}
        </h4>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-gray">
          {asset.version_count !== undefined && asset.version_count > 1 && (
            <div className="flex items-center gap-1">
              <Layers className="w-3 h-3" />
              v{asset.version_count}
            </div>
          )}
          {asset.note_count !== undefined && asset.note_count > 0 && (
            <div className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {asset.note_count}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Day column component
const DayColumn: React.FC<{
  date: Date;
  assets: (ReviewAsset | ReviewAssetEnhanced)[];
  onView: (asset: ReviewAsset) => void;
  isToday: boolean;
}> = ({ date, assets, onView, isToday }) => {
  const dayName = format(date, 'EEE');
  const dayNumber = format(date, 'd');
  const monthName = format(date, 'MMM');

  return (
    <div className="flex-shrink-0 w-48 flex flex-col">
      {/* Day Header */}
      <div className={cn(
        'text-center py-2 rounded-t-lg border-b',
        isToday
          ? 'bg-accent-yellow/20 border-accent-yellow/30'
          : 'bg-charcoal-dark/30 border-white/10'
      )}>
        <div className={cn(
          'text-xs uppercase tracking-wide',
          isToday ? 'text-accent-yellow' : 'text-muted-gray'
        )}>
          {dayName}
        </div>
        <div className={cn(
          'text-lg font-semibold',
          isToday ? 'text-accent-yellow' : 'text-bone-white'
        )}>
          {dayNumber}
        </div>
        <div className="text-xs text-muted-gray">
          {monthName}
        </div>
      </div>

      {/* Assets for this day */}
      <div className="flex-1 bg-charcoal-dark/10 rounded-b-lg p-2 space-y-2 min-h-[200px]">
        {assets.map((asset) => (
          <TimelineCard
            key={asset.id}
            asset={asset}
            onView={onView}
          />
        ))}
        {assets.length === 0 && (
          <div className="text-center py-4 text-muted-gray text-xs">
            No assets
          </div>
        )}
      </div>
    </div>
  );
};

export const ReviewTimelineView: React.FC<ReviewTimelineViewProps> = ({
  assets,
  canEdit,
  onView,
}) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const today = new Date();

  // Generate array of days for the current week
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(currentWeekStart);
      day.setDate(currentWeekStart.getDate() + i);
      days.push(day);
    }
    return days;
  }, [currentWeekStart]);

  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });

  // Group assets by date (using due_date if available, otherwise updated_at)
  const assetsByDate = useMemo(() => {
    const grouped: Map<string, (ReviewAsset | ReviewAssetEnhanced)[]> = new Map();

    assets.forEach((asset) => {
      const enhanced = asset as ReviewAssetEnhanced;
      // Use due_date if available, otherwise fall back to updated_at
      const dateStr = enhanced.due_date || asset.updated_at;
      const date = parseLocalDate(dateStr);

      // Only include if within current week
      if (isWithinInterval(date, { start: currentWeekStart, end: weekEnd })) {
        const key = format(date, 'yyyy-MM-dd');
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(asset);
      }
    });

    return grouped;
  }, [assets, currentWeekStart, weekEnd]);

  // Count assets outside current week view
  const assetsOutsideWeek = useMemo(() => {
    return assets.filter((asset) => {
      const enhanced = asset as ReviewAssetEnhanced;
      const dateStr = enhanced.due_date || asset.updated_at;
      const date = parseLocalDate(dateStr);
      return !isWithinInterval(date, { start: currentWeekStart, end: weekEnd });
    }).length;
  }, [assets, currentWeekStart, weekEnd]);

  const goToPreviousWeek = () => {
    setCurrentWeekStart((prev) => subWeeks(prev, 1));
  };

  const goToNextWeek = () => {
    setCurrentWeekStart((prev) => addWeeks(prev, 1));
  };

  const goToToday = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Timeline Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goToNextWeek}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday}>
            <Calendar className="w-4 h-4 mr-2" />
            Today
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <h3 className="text-lg font-medium text-bone-white">
            {format(currentWeekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
          </h3>
          {assetsOutsideWeek > 0 && (
            <span className="text-sm text-muted-gray">
              {assetsOutsideWeek} asset{assetsOutsideWeek !== 1 ? 's' : ''} outside this week
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-gray">
          <Clock className="w-3.5 h-3.5" />
          <span>Showing by: {assets.some((a) => (a as ReviewAssetEnhanced).due_date) ? 'Due Date' : 'Last Updated'}</span>
        </div>
      </div>

      {/* Week Grid */}
      <div className="flex gap-2 overflow-x-auto pb-4 flex-1">
        {weekDays.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayAssets = assetsByDate.get(key) || [];
          const isToday = isSameDay(day, today);

          return (
            <DayColumn
              key={key}
              date={day}
              assets={dayAssets}
              onView={onView}
              isToday={isToday}
            />
          );
        })}
      </div>

      {/* Empty State */}
      {assets.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-muted-gray/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-bone-white mb-2">No assets to display</h3>
          <p className="text-sm text-muted-gray">
            Add assets with due dates to see them on the timeline
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 py-4 border-t border-white/10">
        {(Object.entries(STATUS_CONFIG) as [ReviewAssetStatus, typeof STATUS_CONFIG[ReviewAssetStatus]][]).map(([status, config]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={cn('w-3 h-3 rounded', config.bgColor)} />
            <span className="text-xs text-muted-gray">{config.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReviewTimelineView;
