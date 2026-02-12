import { Mail, Clock, Send, Ban, FileEdit, Users } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-muted-gray/30', text: 'text-bone-white', label: 'Draft' },
  scheduled: { bg: 'bg-blue-900/40', text: 'text-blue-300', label: 'Scheduled' },
  sending: { bg: 'bg-yellow-900/40', text: 'text-accent-yellow', label: 'Sending' },
  sent: { bg: 'bg-green-900/40', text: 'text-green-300', label: 'Sent' },
  cancelled: { bg: 'bg-red-900/40', text: 'text-red-400', label: 'Cancelled' },
};

const SEND_TYPE_LABELS: Record<string, string> = {
  manual: 'Manual',
  scheduled: 'Scheduled',
  drip: 'Drip',
};

interface CampaignCardProps {
  campaign: any;
  onClick?: () => void;
}

const CampaignCard = ({ campaign, onClick }: CampaignCardProps) => {
  const status = STATUS_STYLES[campaign.status] || STATUS_STYLES.draft;

  return (
    <div
      onClick={onClick}
      className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-4 hover:border-accent-yellow/50 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-bone-white font-medium truncate">{campaign.name}</h3>
          {campaign.description && (
            <p className="text-muted-gray text-sm mt-1 line-clamp-2">{campaign.description}</p>
          )}
        </div>
        <span className={`${status.bg} ${status.text} text-xs px-2 py-1 rounded-full ml-3 whitespace-nowrap`}>
          {status.label}
        </span>
      </div>

      <div className="text-sm text-muted-gray mb-3">
        <span className="inline-flex items-center gap-1 mr-4">
          <Mail className="h-3.5 w-3.5" />
          {campaign.subject_template}
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-gray">
        <span className="inline-flex items-center gap-1">
          <FileEdit className="h-3 w-3" />
          {SEND_TYPE_LABELS[campaign.send_type] || campaign.send_type}
        </span>

        {campaign.total_sent > 0 && (
          <>
            <span className="inline-flex items-center gap-1">
              <Send className="h-3 w-3" />
              {campaign.total_sent} sent
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {campaign.total_opened} opened
            </span>
          </>
        )}

        {campaign.target_temperature?.length > 0 && (
          <span className="inline-flex items-center gap-1">
            Target: {campaign.target_temperature.join(', ')}
          </span>
        )}

        {campaign.scheduled_at && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(campaign.scheduled_at)}
          </span>
        )}
      </div>

      {campaign.total_sent > 0 && (
        <div className="mt-3 grid grid-cols-5 gap-2 text-center text-xs">
          <div>
            <div className="text-bone-white font-medium">{campaign.total_sent}</div>
            <div className="text-muted-gray">Sent</div>
          </div>
          <div>
            <div className="text-green-300 font-medium">{campaign.total_delivered}</div>
            <div className="text-muted-gray">Delivered</div>
          </div>
          <div>
            <div className="text-blue-300 font-medium">{campaign.total_opened}</div>
            <div className="text-muted-gray">Opened</div>
          </div>
          <div>
            <div className="text-accent-yellow font-medium">{campaign.total_clicked}</div>
            <div className="text-muted-gray">Clicked</div>
          </div>
          <div>
            <div className="text-red-400 font-medium">{campaign.total_bounced}</div>
            <div className="text-muted-gray">Bounced</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignCard;
