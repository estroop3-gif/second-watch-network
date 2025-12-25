/**
 * SyncStatusBadge - Shows sync status between production day and linked call sheet
 */
import React from 'react';
import { RefreshCw, Check, AlertTriangle, Link2Off } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSyncStatus, useBidirectionalSync } from '@/hooks/backlot';
import { cn } from '@/lib/utils';

interface SyncStatusBadgeProps {
  dayId: string;
  onSyncClick?: () => void;
  showQuickSync?: boolean;
  className?: string;
}

export function SyncStatusBadge({
  dayId,
  onSyncClick,
  showQuickSync = true,
  className,
}: SyncStatusBadgeProps) {
  const { syncStatus, isLoading } = useSyncStatus(dayId);
  const { sync, isLoading: isSyncing } = useBidirectionalSync(dayId);

  if (isLoading) {
    return (
      <Badge variant="outline" className={cn('text-xs gap-1', className)}>
        <RefreshCw className="h-3 w-3 animate-spin" />
        Checking...
      </Badge>
    );
  }

  if (!syncStatus) {
    return null;
  }

  // No linked call sheet
  if (!syncStatus.has_linked_call_sheet) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={cn(
                'text-xs gap-1 bg-slate-500/10 text-slate-400 border-slate-500/30',
                className
              )}
            >
              <Link2Off className="h-3 w-3" />
              No Call Sheet
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>No call sheet is linked to this production day</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // In sync
  if (syncStatus.is_in_sync) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={cn(
                'text-xs gap-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
                className
              )}
            >
              <Check className="h-3 w-3" />
              In Sync
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Production day and call sheet are synchronized</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Out of sync
  const handleQuickSync = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSyncClick) {
      onSyncClick();
    } else {
      // Auto-sync with most recent wins
      sync({});
    }
  };

  const staleLabel =
    syncStatus.stale_entity === 'call_sheet'
      ? 'Schedule is newer'
      : 'Call Sheet is newer';

  const fieldsLabel = syncStatus.fields_differ
    .map((f) => {
      switch (f) {
        case 'date':
          return 'Date';
        case 'day_number':
          return 'Day #';
        case 'call_time':
          return 'Call Time';
        case 'wrap_time':
          return 'Wrap Time';
        case 'location_name':
          return 'Location';
        case 'location_address':
          return 'Address';
        case 'title':
          return 'Title';
        default:
          return f;
      }
    })
    .join(', ');

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-1', className)}>
            <Badge
              variant="outline"
              className="text-xs gap-1 bg-amber-500/10 text-amber-400 border-amber-500/30"
            >
              <AlertTriangle className="h-3 w-3" />
              Out of Sync
            </Badge>
            {showQuickSync && (
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/20"
                onClick={handleQuickSync}
                disabled={isSyncing}
              >
                <RefreshCw className={cn('h-3 w-3', isSyncing && 'animate-spin')} />
              </Button>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <p className="font-medium">{staleLabel}</p>
            <p className="text-muted-foreground">Differs: {fieldsLabel}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
