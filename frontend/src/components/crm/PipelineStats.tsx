import { usePipelineStats } from '@/hooks/crm/useDeals';
import { DollarSign, TrendingUp, BarChart3 } from 'lucide-react';

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

const STAGE_BAR_COLORS: Record<string, string> = {
  lead: 'bg-slate-500',
  contacted: 'bg-blue-500',
  qualified: 'bg-indigo-500',
  proposal: 'bg-purple-500',
  negotiation: 'bg-amber-500',
  closed_won: 'bg-emerald-500',
  closed_lost: 'bg-red-500',
};

interface PipelineStatsProps {
  assignedRepId?: string;
}

const PipelineStats = ({ assignedRepId }: PipelineStatsProps) => {
  const { data, isLoading } = usePipelineStats(assignedRepId ? { assigned_rep_id: assignedRepId } : undefined);

  if (isLoading) {
    return <div className="text-muted-gray text-sm">Loading stats...</div>;
  }

  const stages = data?.stages || [];
  const totalValue = stages.reduce((sum: number, s: any) => sum + (s.total_value || 0), 0);
  const totalWeighted = stages.reduce((sum: number, s: any) => sum + (s.weighted_value || 0), 0);
  const totalDeals = stages.reduce((sum: number, s: any) => sum + (s.deal_count || 0), 0);
  const maxValue = Math.max(...stages.map((s: any) => s.total_value || 0), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-gray mb-1">
            <BarChart3 className="h-4 w-4" />
            <span className="text-xs">Total Deals</span>
          </div>
          <p className="text-2xl font-bold text-bone-white">{totalDeals}</p>
        </div>
        <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-gray mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs">Pipeline Value</span>
          </div>
          <p className="text-2xl font-bold text-bone-white">${(totalValue / 100).toLocaleString()}</p>
        </div>
        <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-gray mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs">Weighted Value</span>
          </div>
          <p className="text-2xl font-bold text-accent-yellow">${(totalWeighted / 100).toLocaleString()}</p>
        </div>
      </div>

      <div className="space-y-2">
        {stages.map((stage: any) => (
          <div key={stage.stage} className="flex items-center gap-3">
            <span className="text-xs text-muted-gray w-24 text-right">
              {STAGE_LABELS[stage.stage] || stage.stage}
            </span>
            <div className="flex-1 bg-muted-gray/20 rounded-full h-4 relative overflow-hidden">
              <div
                className={`h-full rounded-full ${STAGE_BAR_COLORS[stage.stage] || 'bg-slate-500'}`}
                style={{ width: `${(stage.total_value / maxValue) * 100}%` }}
              />
            </div>
            <div className="text-right w-28">
              <span className="text-xs text-bone-white">
                ${(stage.total_value / 100).toLocaleString()}
              </span>
              <span className="text-xs text-muted-gray ml-1">({stage.deal_count})</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PipelineStats;
