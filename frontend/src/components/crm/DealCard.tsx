import { DollarSign, Calendar, User, ChevronLeft, ChevronRight, Pencil, Send } from 'lucide-react';

const STAGE_COLORS: Record<string, string> = {
  lead: 'bg-slate-600',
  contacted: 'bg-blue-600',
  qualified: 'bg-indigo-600',
  proposal: 'bg-purple-600',
  negotiation: 'bg-amber-600',
  closed_won: 'bg-emerald-600',
  closed_lost: 'bg-red-600',
};

const STAGES_ORDER = ['lead', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won'];

const PRODUCT_LABELS: Record<string, string> = {
  backlot_membership: 'Backlot',
  premium_membership: 'Premium',
  production_service: 'Production',
  gear_rental: 'Gear Rental',
  ad_deal: 'Ad Deal',
  sponsorship: 'Sponsorship',
  other: 'Other',
};

interface DealCardProps {
  deal: any;
  onClick?: () => void;
  compact?: boolean;
  onStageChange?: (dealId: string, newStage: string) => void;
  onEdit?: (deal: any) => void;
  onEmail?: (deal: any) => void;
}

const DealCard = ({ deal, onClick, compact, onStageChange, onEdit, onEmail }: DealCardProps) => {
  const amount = deal.amount_cents ? `$${(deal.amount_cents / 100).toLocaleString()}` : null;
  const contactName = [deal.contact_first_name, deal.contact_last_name].filter(Boolean).join(' ');

  const currentIndex = STAGES_ORDER.indexOf(deal.stage);
  const canGoBack = currentIndex > 0 && deal.stage !== 'closed_lost';
  const canGoForward = currentIndex >= 0 && currentIndex < STAGES_ORDER.length - 1 && deal.stage !== 'closed_lost';

  const handleStageNav = (e: React.MouseEvent, direction: 'back' | 'forward') => {
    e.stopPropagation();
    if (!onStageChange) return;
    const newIndex = direction === 'forward' ? currentIndex + 1 : currentIndex - 1;
    onStageChange(deal.id, STAGES_ORDER[newIndex]);
  };

  if (compact) {
    return (
      <div
        onClick={onClick}
        className="bg-charcoal-black border border-muted-gray/30 rounded-md p-3 cursor-pointer hover:border-accent-yellow/50 transition-colors"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-bone-white truncate flex-1">{deal.title}</p>
          <div className="flex items-center gap-0.5 ml-2 flex-shrink-0">
            {onEmail && deal.contact_email && (
              <button
                onClick={(e) => { e.stopPropagation(); onEmail(deal); }}
                className="p-1 text-muted-gray hover:text-accent-yellow transition-colors"
                title="Send email"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            )}
            {onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(deal); }}
                className="p-1 text-muted-gray hover:text-accent-yellow transition-colors"
                title="Edit deal"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-muted-gray">{contactName}</span>
          {amount && <span className="text-xs font-medium text-accent-yellow">{amount}</span>}
        </div>
        {deal.expected_close_date && (
          <p className="text-xs text-muted-gray mt-1">
            Close: {new Date(deal.expected_close_date).toLocaleDateString()}
          </p>
        )}
        {onStageChange && deal.stage !== 'closed_won' && deal.stage !== 'closed_lost' && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-muted-gray/20">
            <button
              onClick={(e) => handleStageNav(e, 'back')}
              disabled={!canGoBack}
              className="flex items-center gap-0.5 text-xs text-muted-gray hover:text-bone-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title={canGoBack ? `Move to ${STAGES_ORDER[currentIndex - 1]}` : undefined}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{canGoBack ? STAGES_ORDER[currentIndex - 1]?.replace('_', ' ') : ''}</span>
            </button>
            <button
              onClick={(e) => handleStageNav(e, 'forward')}
              disabled={!canGoForward}
              className="flex items-center gap-0.5 text-xs text-accent-yellow hover:text-accent-yellow/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title={canGoForward ? `Move to ${STAGES_ORDER[currentIndex + 1]}` : undefined}
            >
              <span className="hidden sm:inline">{canGoForward ? STAGES_ORDER[currentIndex + 1]?.replace('_', ' ') : ''}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-4 cursor-pointer hover:border-accent-yellow/50 transition-colors"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-semibold text-bone-white truncate flex-1">{deal.title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full text-white ${STAGE_COLORS[deal.stage] || 'bg-slate-600'}`}>
          {deal.stage?.replace('_', ' ')}
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-gray">
          <User className="h-3.5 w-3.5" />
          <span>{contactName || 'No contact'}</span>
        </div>
        {deal.contact_company && (
          <p className="text-xs text-muted-gray ml-5">{deal.contact_company}</p>
        )}
        {amount && (
          <div className="flex items-center gap-2 text-sm text-accent-yellow">
            <DollarSign className="h-3.5 w-3.5" />
            <span>{amount}</span>
            <span className="text-muted-gray text-xs">({deal.probability}%)</span>
          </div>
        )}
        {deal.expected_close_date && (
          <div className="flex items-center gap-2 text-xs text-muted-gray">
            <Calendar className="h-3.5 w-3.5" />
            <span>{new Date(deal.expected_close_date).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs px-2 py-0.5 rounded bg-muted-gray/30 text-bone-white">
          {PRODUCT_LABELS[deal.product_type] || deal.product_type}
        </span>
        {deal.assigned_rep_name && (
          <span className="text-xs text-muted-gray">{deal.assigned_rep_name}</span>
        )}
      </div>
    </div>
  );
};

export default DealCard;
