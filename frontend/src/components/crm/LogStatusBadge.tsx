const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-600 text-white',
  in_progress: 'bg-amber-600 text-white',
  resolved: 'bg-emerald-600 text-white',
  closed: 'bg-slate-600 text-white',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-slate-400',
  normal: 'text-muted-gray',
  high: 'text-amber-400',
  urgent: 'text-red-400',
};

interface LogStatusBadgeProps {
  status: string;
  priority?: string;
}

const LogStatusBadge = ({ status, priority }: LogStatusBadgeProps) => {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[status] || 'bg-slate-600 text-white'}`}>
        {status?.replace('_', ' ')}
      </span>
      {priority && priority !== 'normal' && (
        <span className={`text-xs font-medium ${PRIORITY_COLORS[priority] || ''}`}>
          {priority}
        </span>
      )}
    </div>
  );
};

export default LogStatusBadge;
