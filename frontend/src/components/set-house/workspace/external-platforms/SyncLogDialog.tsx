/**
 * Sync Log Dialog
 * View sync history for an external platform
 */
import React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

import type { ExternalSyncLog, ExternalPlatform } from '@/types/set-house';

const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  icon: React.ReactNode;
}> = {
  started: {
    label: 'In Progress',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  completed: {
    label: 'Completed',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  completed_with_errors: {
    label: 'Completed with Errors',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    icon: <AlertCircle className="w-3 h-3" />,
  },
  failed: {
    label: 'Failed',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: <XCircle className="w-3 h-3" />,
  },
};

interface SyncLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: ExternalPlatform | null;
  logs: ExternalSyncLog[];
  isLoading: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function SyncLogDialog({
  open,
  onOpenChange,
  platform,
  logs,
  isLoading,
  onLoadMore,
  hasMore,
}: SyncLogDialogProps) {
  const [expandedLogs, setExpandedLogs] = React.useState<Set<string>>(new Set());

  const toggleExpanded = (logId: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-charcoal-black border-muted-gray/30">
        <DialogHeader>
          <DialogTitle className="text-bone-white">
            Sync History
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            {platform ? `Sync history for ${platform.platform_name}` : 'Loading...'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {isLoading && logs.length === 0 ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="w-12 h-12 text-muted-gray mb-4" />
              <p className="text-bone-white font-medium">No sync history</p>
              <p className="text-sm text-muted-gray mt-1">
                This platform hasn't been synced yet
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => {
                const statusConfig = STATUS_CONFIG[log.status] || STATUS_CONFIG.completed;
                const isExpanded = expandedLogs.has(log.id);
                const hasDetails = log.sync_details && log.sync_details.length > 0;

                return (
                  <Collapsible
                    key={log.id}
                    open={isExpanded}
                    onOpenChange={() => hasDetails && toggleExpanded(log.id)}
                  >
                    <div className="rounded-lg border border-muted-gray/30 overflow-hidden">
                      <CollapsibleTrigger asChild disabled={!hasDetails}>
                        <div
                          className={`p-4 ${hasDetails ? 'cursor-pointer hover:bg-white/5' : ''}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className={statusConfig.color}>
                                {statusConfig.icon}
                                <span className="ml-1">{statusConfig.label}</span>
                              </Badge>
                              <Badge variant="outline" className="bg-charcoal-black/50 text-muted-gray border-muted-gray/30">
                                {log.sync_type}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-gray">
                              <span>
                                {format(new Date(log.started_at), 'MMM d, yyyy h:mm a')}
                              </span>
                              {hasDetails && (
                                isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )
                              )}
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-muted-gray">Found</p>
                              <p className="text-lg font-semibold text-bone-white">
                                {log.bookings_found}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-gray">Created</p>
                              <p className="text-lg font-semibold text-green-400">
                                {log.bookings_created}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-gray">Updated</p>
                              <p className="text-lg font-semibold text-blue-400">
                                {log.bookings_updated}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-gray">Skipped</p>
                              <p className="text-lg font-semibold text-muted-gray">
                                {log.bookings_skipped}
                              </p>
                            </div>
                          </div>

                          {log.error_message && (
                            <div className="mt-3 p-2 rounded bg-red-500/10 border border-red-500/30">
                              <p className="text-sm text-red-400">{log.error_message}</p>
                            </div>
                          )}

                          {log.duration_ms && (
                            <p className="mt-2 text-xs text-muted-gray">
                              Duration: {(log.duration_ms / 1000).toFixed(2)}s
                              {log.triggered_by_name && (
                                <> &bull; Triggered by {log.triggered_by_name}</>
                              )}
                            </p>
                          )}
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        {log.sync_details && log.sync_details.length > 0 && (
                          <div className="border-t border-muted-gray/30 p-4 bg-charcoal-black/50">
                            <p className="text-sm font-medium text-muted-gray mb-2">
                              Details ({log.sync_details.length} items)
                            </p>
                            <ScrollArea className="h-[200px]">
                              <div className="space-y-1">
                                {log.sync_details.map((detail, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center gap-2 text-sm py-1"
                                  >
                                    {detail.action === 'created' && (
                                      <CheckCircle2 className="w-3 h-3 text-green-400" />
                                    )}
                                    {detail.action === 'updated' && (
                                      <CheckCircle2 className="w-3 h-3 text-blue-400" />
                                    )}
                                    {detail.action === 'skipped' && (
                                      <Clock className="w-3 h-3 text-muted-gray" />
                                    )}
                                    {detail.action === 'error' && (
                                      <XCircle className="w-3 h-3 text-red-400" />
                                    )}
                                    <span className="text-muted-gray font-mono text-xs">
                                      {detail.external_id}
                                    </span>
                                    <span className={`
                                      ${detail.action === 'created' ? 'text-green-400' : ''}
                                      ${detail.action === 'updated' ? 'text-blue-400' : ''}
                                      ${detail.action === 'skipped' ? 'text-muted-gray' : ''}
                                      ${detail.action === 'error' ? 'text-red-400' : ''}
                                    `}>
                                      {detail.action}
                                    </span>
                                    {detail.reason && (
                                      <span className="text-muted-gray">
                                        ({detail.reason})
                                      </span>
                                    )}
                                    {detail.error && (
                                      <span className="text-red-400 truncate max-w-[200px]">
                                        {detail.error}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </div>
                        )}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}

              {hasMore && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    onClick={onLoadMore}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Load More
                  </Button>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default SyncLogDialog;
