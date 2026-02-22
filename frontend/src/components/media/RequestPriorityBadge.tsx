import { ChevronDown, Minus, ChevronUp, AlertTriangle } from 'lucide-react';

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string; icon: any; animate?: string }> = {
  low: { bg: 'bg-slate-700/40', text: 'text-slate-300', label: 'Low', icon: ChevronDown },
  normal: { bg: 'bg-blue-900/40', text: 'text-blue-300', label: 'Normal', icon: Minus },
  high: { bg: 'bg-orange-900/40', text: 'text-orange-300', label: 'High', icon: ChevronUp },
  urgent: { bg: 'bg-red-900/40', text: 'text-red-400', label: 'Urgent', icon: AlertTriangle, animate: 'animate-pulse' },
};

interface RequestPriorityBadgeProps {
  priority: string;
}

const RequestPriorityBadge = ({ priority }: RequestPriorityBadgeProps) => {
  const style = PRIORITY_STYLES[priority] || PRIORITY_STYLES.normal;
  const Icon = style.icon;

  return (
    <span
      className={`${style.bg} ${style.text} ${style.animate || ''} inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium`}
    >
      <Icon className="h-3 w-3" />
      {style.label}
    </span>
  );
};

export default RequestPriorityBadge;
