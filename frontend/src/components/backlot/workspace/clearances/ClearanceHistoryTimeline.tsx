/**
 * ClearanceHistoryTimeline - Audit trail timeline for clearance changes
 */
import { useClearanceHistory } from '@/hooks/backlot/useClearances';
import { ClearanceHistoryAction, CLEARANCE_STATUS_LABELS } from '@/types/backlot';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Clock,
  User,
  FileUp,
  FileX,
  UserPlus,
  UserMinus,
  RefreshCw,
  XCircle,
  Bell,
  AlertTriangle,
  CheckCircle,
  Edit,
  Flag,
} from 'lucide-react';

interface ClearanceHistoryTimelineProps {
  clearanceId: string;
  maxHeight?: string;
}

const ACTION_CONFIG: Record<ClearanceHistoryAction, {
  icon: typeof Clock;
  label: string;
  color: string;
}> = {
  created: { icon: CheckCircle, label: 'Created', color: 'text-green-500' },
  status_changed: { icon: RefreshCw, label: 'Status Changed', color: 'text-blue-500' },
  assigned: { icon: UserPlus, label: 'Assigned', color: 'text-purple-500' },
  unassigned: { icon: UserMinus, label: 'Unassigned', color: 'text-gray-500' },
  file_uploaded: { icon: FileUp, label: 'Document Uploaded', color: 'text-green-500' },
  file_removed: { icon: FileX, label: 'Document Removed', color: 'text-orange-500' },
  edited: { icon: Edit, label: 'Edited', color: 'text-blue-500' },
  rejected: { icon: XCircle, label: 'Rejected', color: 'text-red-500' },
  reminder_sent: { icon: Bell, label: 'Reminder Sent', color: 'text-yellow-500' },
  expired: { icon: AlertTriangle, label: 'Expired', color: 'text-orange-500' },
  reviewed: { icon: CheckCircle, label: 'Reviewed', color: 'text-green-500' },
  usage_rights_updated: { icon: Flag, label: 'Rights Updated', color: 'text-purple-500' },
  eo_flagged: { icon: Flag, label: 'E&O Flagged', color: 'text-red-500' },
};

export function ClearanceHistoryTimeline({
  clearanceId,
  maxHeight = '400px',
}: ClearanceHistoryTimelineProps) {
  const { data: history, isLoading, error } = useClearanceHistory(clearanceId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <p>Failed to load history</p>
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Clock className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No history yet</p>
      </div>
    );
  }

  return (
    <ScrollArea style={{ maxHeight }} className="pr-4">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-muted-gray/30" />

        {/* Timeline items */}
        <div className="space-y-4">
          {history.map((entry, index) => {
            const config = ACTION_CONFIG[entry.action] || ACTION_CONFIG.edited;
            const Icon = config.icon;

            return (
              <div key={entry.id} className="relative flex gap-3 pl-0">
                {/* Icon */}
                <div
                  className={`
                    relative z-10 h-8 w-8 rounded-full flex items-center justify-center
                    bg-background border-2 border-muted-gray/30 flex-shrink-0
                  `}
                >
                  <Icon className={`h-4 w-4 ${config.color}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{config.label}</span>
                    {entry.old_status && entry.new_status && (
                      <div className="flex items-center gap-1 text-xs">
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          {CLEARANCE_STATUS_LABELS[entry.old_status as keyof typeof CLEARANCE_STATUS_LABELS] || entry.old_status}
                        </Badge>
                        <span className="text-muted-foreground">→</span>
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          {CLEARANCE_STATUS_LABELS[entry.new_status as keyof typeof CLEARANCE_STATUS_LABELS] || entry.new_status}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {entry.notes && (
                    <p className="text-sm text-muted-foreground mt-1">{entry.notes}</p>
                  )}

                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {entry.user_name && (
                      <>
                        <User className="h-3 w-3" />
                        <span>{entry.user_name}</span>
                        <span>•</span>
                      </>
                    )}
                    <span title={format(new Date(entry.created_at), 'PPpp')}>
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}
