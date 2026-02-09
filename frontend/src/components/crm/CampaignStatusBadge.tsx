const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-muted-gray/30', text: 'text-bone-white', label: 'Draft' },
  scheduled: { bg: 'bg-blue-900/40', text: 'text-blue-300', label: 'Scheduled' },
  sending: { bg: 'bg-yellow-900/40', text: 'text-accent-yellow', label: 'Sending' },
  sent: { bg: 'bg-green-900/40', text: 'text-green-300', label: 'Sent' },
  cancelled: { bg: 'bg-red-900/40', text: 'text-red-400', label: 'Cancelled' },
};

interface CampaignStatusBadgeProps {
  status: string;
}

const CampaignStatusBadge = ({ status }: CampaignStatusBadgeProps) => {
  const style = STATUS_STYLES[status] || STATUS_STYLES.draft;
  return (
    <span className={`${style.bg} ${style.text} text-xs px-2 py-1 rounded-full`}>
      {style.label}
    </span>
  );
};

export default CampaignStatusBadge;
