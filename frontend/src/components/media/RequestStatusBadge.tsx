import { Check } from 'lucide-react';

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string; icon?: boolean }> = {
  submitted: { bg: 'bg-slate-700/40', text: 'text-slate-300', label: 'Submitted' },
  in_review: { bg: 'bg-blue-900/40', text: 'text-blue-300', label: 'In Review' },
  approved: { bg: 'bg-green-900/40', text: 'text-green-300', label: 'Approved' },
  in_production: { bg: 'bg-yellow-900/40', text: 'text-amber-300', label: 'In Production' },
  ready_for_review: { bg: 'bg-purple-900/40', text: 'text-purple-300', label: 'Ready For Review' },
  revision: { bg: 'bg-orange-900/40', text: 'text-orange-300', label: 'Revision' },
  approved_final: { bg: 'bg-emerald-900/40', text: 'text-emerald-300', label: 'Approved Final' },
  scheduled: { bg: 'bg-cyan-900/40', text: 'text-cyan-300', label: 'Scheduled' },
  posted: { bg: 'bg-green-900/40', text: 'text-green-300', label: 'Posted', icon: true },
  cancelled: { bg: 'bg-red-900/40', text: 'text-red-400', label: 'Cancelled' },
};

function formatStatusLabel(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

interface RequestStatusBadgeProps {
  status: string;
}

const RequestStatusBadge = ({ status }: RequestStatusBadgeProps) => {
  const style = STATUS_STYLES[status] || {
    bg: 'bg-muted-gray/30',
    text: 'text-bone-white',
    label: formatStatusLabel(status),
  };

  return (
    <span
      className={`${style.bg} ${style.text} inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium`}
    >
      {style.icon && <Check className="h-3 w-3" />}
      {style.label}
    </span>
  );
};

export default RequestStatusBadge;
