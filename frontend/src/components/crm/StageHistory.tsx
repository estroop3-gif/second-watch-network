import { ArrowRight, Clock } from 'lucide-react';

const STAGE_COLORS: Record<string, string> = {
  lead: 'text-slate-400',
  contacted: 'text-blue-400',
  qualified: 'text-indigo-400',
  proposal: 'text-purple-400',
  negotiation: 'text-amber-400',
  closed_won: 'text-emerald-400',
  closed_lost: 'text-red-400',
};

interface StageHistoryProps {
  history: any[];
}

const StageHistory = ({ history }: StageHistoryProps) => {
  if (!history || history.length === 0) {
    return <p className="text-muted-gray text-sm">No stage history yet.</p>;
  }

  return (
    <div className="space-y-3">
      {history.map((entry: any, index: number) => (
        <div key={entry.id || index} className="flex items-start gap-3 border-l-2 border-muted-gray/30 pl-4 pb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm">
              {entry.from_stage ? (
                <>
                  <span className={STAGE_COLORS[entry.from_stage] || 'text-muted-gray'}>
                    {entry.from_stage?.replace('_', ' ')}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-gray" />
                </>
              ) : null}
              <span className={`font-medium ${STAGE_COLORS[entry.to_stage] || 'text-bone-white'}`}>
                {entry.to_stage?.replace('_', ' ')}
              </span>
            </div>
            {entry.notes && (
              <p className="text-xs text-muted-gray mt-1">{entry.notes}</p>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-gray mt-1">
              <Clock className="h-3 w-3" />
              <span>{new Date(entry.changed_at).toLocaleString()}</span>
              {entry.changed_by_name && <span>by {entry.changed_by_name}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StageHistory;
