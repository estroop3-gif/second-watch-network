import { useState } from 'react';
import { useLeaderboard } from '@/hooks/crm/useKPI';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Trophy, Medal } from 'lucide-react';

interface RepLeaderboardProps {
  dateFrom?: string;
  dateTo?: string;
}

const METRIC_LABELS: Record<string, string> = {
  revenue: 'Revenue',
  deals_won: 'Deals Won',
  interactions: 'Interactions',
  contacts: 'Contacts',
};

const RepLeaderboard = ({ dateFrom, dateTo }: RepLeaderboardProps) => {
  const [metric, setMetric] = useState('revenue');
  const { data, isLoading } = useLeaderboard({ metric, date_from: dateFrom, date_to: dateTo });

  const formatValue = (val: number) => {
    if (metric === 'revenue') return `$${(val / 100).toLocaleString()}`;
    return val.toLocaleString();
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-amber-400" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-slate-300" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    return <span className="text-sm text-muted-gray w-5 text-center">{rank}</span>;
  };

  return (
    <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-bone-white flex items-center gap-2">
          <Trophy className="h-4 w-4 text-accent-yellow" />
          Leaderboard
        </h3>
        <Select value={metric} onValueChange={setMetric}>
          <SelectTrigger className="w-36 h-8 bg-charcoal-black border-muted-gray text-bone-white text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(METRIC_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-gray">Loading...</p>
      ) : (
        <div className="space-y-2">
          {(data?.leaderboard || []).map((entry: any) => (
            <div key={entry.rep_id} className="flex items-center gap-3 py-2 border-b border-muted-gray/10 last:border-0">
              <div className="w-6 flex justify-center">
                {getRankIcon(entry.rank)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-bone-white truncate">{entry.rep_name || 'Unknown'}</p>
              </div>
              <span className="text-sm font-medium text-accent-yellow">
                {formatValue(entry.value || 0)}
              </span>
            </div>
          ))}
          {(!data?.leaderboard || data.leaderboard.length === 0) && (
            <p className="text-sm text-muted-gray text-center py-4">No data yet</p>
          )}
        </div>
      )}
    </div>
  );
};

export default RepLeaderboard;
