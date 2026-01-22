/**
 * Platform Card Component
 * Displays an external platform connection with status and actions
 */
import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Calendar,
  RefreshCw,
  Settings,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Pause,
  Play,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import type { ExternalPlatform, SyncStatus, ExternalPlatformType } from '@/types/set-house';

// Platform configuration
const PLATFORM_CONFIG: Record<ExternalPlatformType, {
  label: string;
  color: string;
  icon: string;
  description: string;
}> = {
  peerspace: {
    label: 'Peerspace',
    color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    icon: 'PS',
    description: 'Import bookings from Peerspace calendar',
  },
  giggster: {
    label: 'Giggster',
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    icon: 'GG',
    description: 'Import bookings from Giggster calendar',
  },
  splacer: {
    label: 'Splacer',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: 'SP',
    description: 'Import bookings from Splacer calendar',
  },
  spacetoco: {
    label: 'Spacetoco',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: 'ST',
    description: 'Import bookings from Spacetoco calendar',
  },
  ical: {
    label: 'iCal Feed',
    color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    icon: 'iC',
    description: 'Generic iCal calendar feed',
  },
  csv: {
    label: 'CSV Import',
    color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    icon: 'CS',
    description: 'Manually imported from CSV',
  },
  manual: {
    label: 'Manual',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    icon: 'MN',
    description: 'Manually entered bookings',
  },
};

const SYNC_STATUS_CONFIG: Record<SyncStatus, {
  label: string;
  color: string;
  icon: React.ReactNode;
}> = {
  pending: {
    label: 'Pending',
    color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    icon: <Clock className="w-3 h-3" />,
  },
  syncing: {
    label: 'Syncing',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  success: {
    label: 'Synced',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  error: {
    label: 'Error',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: <AlertCircle className="w-3 h-3" />,
  },
};

interface PlatformCardProps {
  platform: ExternalPlatform;
  onSync: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewLogs: () => void;
  onToggleActive: () => void;
  isSyncing?: boolean;
}

export function PlatformCard({
  platform,
  onSync,
  onEdit,
  onDelete,
  onViewLogs,
  onToggleActive,
  isSyncing = false,
}: PlatformCardProps) {
  const platformConfig = PLATFORM_CONFIG[platform.platform_type] || PLATFORM_CONFIG.ical;
  const syncConfig = SYNC_STATUS_CONFIG[platform.last_sync_status] || SYNC_STATUS_CONFIG.pending;

  const lastSyncText = platform.last_sync_at
    ? formatDistanceToNow(new Date(platform.last_sync_at), { addSuffix: true })
    : 'Never synced';

  const canSync = platform.is_active && platform.ical_url && !isSyncing;

  return (
    <Card className={`bg-charcoal-black/50 border-muted-gray/30 ${!platform.is_active ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Platform Icon */}
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${platformConfig.color}`}>
              {platformConfig.icon}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-bone-white">{platform.platform_name}</h3>
                {!platform.is_active && (
                  <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                    <Pause className="w-3 h-3 mr-1" />
                    Paused
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-gray">{platformConfig.label}</p>
            </div>
          </div>

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-charcoal-black border-muted-gray/30">
              <DropdownMenuItem onClick={onEdit}>
                <Settings className="w-4 h-4 mr-2" />
                Edit Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onViewLogs}>
                <Calendar className="w-4 h-4 mr-2" />
                View Sync History
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onToggleActive}>
                {platform.is_active ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause Syncing
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Resume Syncing
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-red-400">
                <Trash2 className="w-4 h-4 mr-2" />
                Remove Connection
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Sync Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={syncConfig.color}>
              {syncConfig.icon}
              <span className="ml-1">{syncConfig.label}</span>
            </Badge>
            <span className="text-xs text-muted-gray">{lastSyncText}</span>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSync}
                  disabled={!canSync}
                  className="h-8"
                >
                  {isSyncing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span className="ml-2">Sync Now</span>
                </Button>
              </TooltipTrigger>
              {!canSync && (
                <TooltipContent>
                  {!platform.is_active
                    ? 'Platform is paused'
                    : !platform.ical_url
                    ? 'No iCal URL configured'
                    : 'Sync in progress'}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Stats */}
        {platform.last_sync_at && (
          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-muted-gray/20">
            <div>
              <p className="text-xs text-muted-gray">Found</p>
              <p className="text-lg font-semibold text-bone-white">
                {platform.last_sync_bookings_found ?? 0}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-gray">Created</p>
              <p className="text-lg font-semibold text-green-400">
                {platform.last_sync_bookings_created ?? 0}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-gray">Updated</p>
              <p className="text-lg font-semibold text-blue-400">
                {platform.last_sync_bookings_updated ?? 0}
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {platform.last_sync_status === 'error' && platform.last_sync_error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <p className="text-sm text-red-400">{platform.last_sync_error}</p>
          </div>
        )}

        {/* Default Space */}
        {platform.default_space_name && (
          <div className="text-xs text-muted-gray">
            Default space: <span className="text-bone-white">{platform.default_space_name}</span>
          </div>
        )}

        {/* External Link */}
        {platform.ical_url && (
          <div className="flex items-center gap-2 text-xs text-muted-gray truncate">
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{platform.ical_url}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PlatformCard;
