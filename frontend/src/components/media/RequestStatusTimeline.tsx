import RequestStatusBadge from './RequestStatusBadge';

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface StatusHistoryEntry {
  old_status: string | null;
  new_status: string;
  changed_by_name: string;
  notes?: string;
  created_at: string;
}

interface RequestStatusTimelineProps {
  history: StatusHistoryEntry[];
}

const RequestStatusTimeline = ({ history }: RequestStatusTimelineProps) => {
  if (!history?.length) {
    return (
      <div className="text-center py-8 text-muted-gray">
        No status changes recorded yet.
      </div>
    );
  }

  return (
    <div className="relative">
      {history.map((entry, idx) => {
        const isLast = idx === history.length - 1;

        return (
          <div key={idx} className="flex gap-3 relative">
            {/* Vertical line + dot */}
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-accent-yellow border-2 border-accent-yellow/50 mt-1.5 flex-shrink-0 z-10" />
              {!isLast && (
                <div className="w-px flex-1 bg-muted-gray/30 min-h-[2rem]" />
              )}
            </div>

            {/* Content */}
            <div className="pb-6 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {entry.old_status && (
                  <>
                    <RequestStatusBadge status={entry.old_status} />
                    <span className="text-muted-gray text-xs">&rarr;</span>
                  </>
                )}
                <RequestStatusBadge status={entry.new_status} />
              </div>

              <div className="mt-1.5 text-xs text-muted-gray">
                <span>{entry.changed_by_name}</span>
                <span className="mx-1">&middot;</span>
                <span>{formatRelativeTime(entry.created_at)}</span>
              </div>

              {entry.notes && (
                <p className="mt-1.5 text-sm text-bone-white/70 bg-charcoal-black/50 border border-muted-gray/20 rounded-md px-3 py-2">
                  {entry.notes}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RequestStatusTimeline;
