import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { UserPlus, ArrowRightLeft, UserMinus } from 'lucide-react';
import { formatDateTime } from '@/lib/dateUtils';
import { useContactAssignmentHistory } from '@/hooks/crm';

interface AssignmentHistoryTimelineProps {
  contactId: string;
}

const TYPE_CONFIG = {
  assign: { label: 'Assigned', icon: UserPlus, color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  transfer: { label: 'Transferred', icon: ArrowRightLeft, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  unassign: { label: 'Unassigned', icon: UserMinus, color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

const AssignmentHistoryTimeline = ({ contactId }: AssignmentHistoryTimelineProps) => {
  const { data, isLoading } = useContactAssignmentHistory(contactId);
  const history = data?.history || [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-gray text-sm">
        No assignment history
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Timeline line */}
      <div className="absolute left-4 top-2 bottom-2 w-px bg-muted-gray/30" />

      {history.map((entry: any, idx: number) => {
        const config = TYPE_CONFIG[entry.assignment_type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.assign;
        const Icon = config.icon;

        return (
          <div key={entry.id} className="relative flex gap-4 py-3">
            {/* Timeline dot */}
            <div className="relative z-10 flex-shrink-0 w-8 h-8 rounded-full bg-charcoal-black border border-muted-gray/30 flex items-center justify-center">
              <Icon className="h-3.5 w-3.5 text-muted-gray" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`text-xs ${config.color}`}>
                  {config.label}
                </Badge>
                <span className="text-xs text-muted-gray">
                  {formatDateTime(entry.assigned_at)}
                </span>
              </div>

              <div className="mt-1 text-sm text-bone-white">
                {entry.from_rep_name && (
                  <span className="text-muted-gray">{entry.from_rep_name}</span>
                )}
                {entry.from_rep_name && entry.to_rep_name && (
                  <span className="text-muted-gray mx-1.5">&rarr;</span>
                )}
                <span className="text-bone-white">{entry.to_rep_name}</span>
              </div>

              <div className="text-xs text-muted-gray mt-0.5">
                by {entry.assigned_by_name}
              </div>

              {entry.notes && (
                <div className="mt-1 text-xs text-muted-gray/80 italic">
                  {entry.notes}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AssignmentHistoryTimeline;
