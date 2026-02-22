const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-slate-700/40', text: 'text-slate-300', label: 'Draft' },
  confirmed: { bg: 'bg-blue-900/40', text: 'text-blue-300', label: 'Confirmed' },
  in_progress: { bg: 'bg-amber-900/40', text: 'text-amber-300', label: 'In Progress' },
  completed: { bg: 'bg-green-900/40', text: 'text-green-300', label: 'Completed' },
  cancelled: { bg: 'bg-red-900/40', text: 'text-red-400', label: 'Cancelled' },
};

const EventStatusBadge = ({ status }: { status: string }) => {
  const style = STATUS_STYLES[status] || {
    bg: 'bg-muted-gray/30',
    text: 'text-bone-white',
    label: status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
  };

  return (
    <span className={`${style.bg} ${style.text} inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium`}>
      {style.label}
    </span>
  );
};

export default EventStatusBadge;
