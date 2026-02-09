import { Target } from 'lucide-react';

const GOAL_TYPE_LABELS: Record<string, string> = {
  revenue: 'Revenue',
  deals_closed: 'Deals Closed',
  calls_made: 'Calls Made',
  emails_sent: 'Emails Sent',
  meetings_held: 'Meetings Held',
  demos_given: 'Demos Given',
  new_contacts: 'New Contacts',
};

const PERIOD_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

interface GoalProgressCardProps {
  goal: any;
  onClick?: () => void;
}

const GoalProgressCard = ({ goal, onClick }: GoalProgressCardProps) => {
  const progress = goal.target_value > 0
    ? Math.min(100, Math.round((goal.actual_value / goal.target_value) * 100))
    : 0;

  const isRevenue = goal.goal_type === 'revenue';
  const displayActual = isRevenue ? `$${(goal.actual_value / 100).toLocaleString()}` : goal.actual_value.toLocaleString();
  const displayTarget = isRevenue ? `$${(goal.target_value / 100).toLocaleString()}` : goal.target_value.toLocaleString();

  const barColor = progress >= 100
    ? 'bg-emerald-500'
    : progress >= 75
      ? 'bg-accent-yellow'
      : progress >= 50
        ? 'bg-blue-500'
        : 'bg-slate-500';

  return (
    <div
      className={`bg-charcoal-black border border-muted-gray/30 rounded-lg p-4${onClick ? ' cursor-pointer hover:border-muted-gray/60 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-accent-yellow" />
          <span className="text-sm font-medium text-bone-white">
            {GOAL_TYPE_LABELS[goal.goal_type] || goal.goal_type}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {goal.is_overridden && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-600/20 text-amber-400">Override</span>
          )}
          <span className="text-xs text-muted-gray">
            {PERIOD_LABELS[goal.period_type] || goal.period_type}
          </span>
          {goal.is_team_goal && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-400">Team</span>
          )}
        </div>
      </div>

      <div className="flex items-end justify-between mb-2">
        <span className="text-xl font-bold text-bone-white">{displayActual}</span>
        <span className="text-sm text-muted-gray">/ {displayTarget}</span>
      </div>

      <div className="w-full bg-muted-gray/20 rounded-full h-2 mb-1">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-gray">
          {new Date(goal.period_start).toLocaleDateString()} - {new Date(goal.period_end).toLocaleDateString()}
        </span>
        <span className={`text-xs font-medium ${progress >= 100 ? 'text-emerald-400' : 'text-muted-gray'}`}>
          {progress}%
        </span>
      </div>
    </div>
  );
};

export default GoalProgressCard;
