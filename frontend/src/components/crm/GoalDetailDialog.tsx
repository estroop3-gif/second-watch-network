import { useState } from 'react';
import { Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useSetGoalOverride } from '@/hooks/crm/useGoals';
import { useToast } from '@/hooks/use-toast';

const GOAL_TYPE_LABELS: Record<string, string> = {
  revenue: 'Revenue',
  deals_closed: 'Deals Closed',
  calls_made: 'Calls Made',
  emails_sent: 'Emails Sent',
  meetings_held: 'Meetings Held',
  demos_given: 'Demos Given',
  new_contacts: 'New Contacts',
};

const GOAL_SOURCE_LABELS: Record<string, string> = {
  revenue: 'From closed-won deals',
  deals_closed: 'From closed-won deals',
  calls_made: 'From daily call tallies',
  emails_sent: 'From daily email tallies',
  meetings_held: 'From daily meeting tallies',
  demos_given: 'From daily demo tallies',
  new_contacts: 'From new contacts created',
};

const PERIOD_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

interface GoalDetailDialogProps {
  goal: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GoalDetailDialog = ({ goal, open, onOpenChange }: GoalDetailDialogProps) => {
  const { toast } = useToast();
  const setOverride = useSetGoalOverride();
  const [overrideInput, setOverrideInput] = useState('');

  if (!goal) return null;

  const isRevenue = goal.goal_type === 'revenue';
  const progress = goal.target_value > 0
    ? Math.min(100, Math.round((goal.actual_value / goal.target_value) * 100))
    : 0;

  const formatValue = (val: number) =>
    isRevenue ? `$${(val / 100).toLocaleString()}` : val.toLocaleString();

  const displayActual = formatValue(goal.actual_value);
  const displayTarget = formatValue(goal.target_value);
  const displayComputed = formatValue(goal.computed_value ?? 0);

  const barColor = progress >= 100
    ? 'bg-emerald-500'
    : progress >= 75
      ? 'bg-accent-yellow'
      : progress >= 50
        ? 'bg-blue-500'
        : 'bg-slate-500';

  const periodStart = new Date(goal.period_start);
  const periodEnd = new Date(goal.period_end);
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  const handleSetOverride = async () => {
    if (!overrideInput) return;
    try {
      const value = isRevenue
        ? Math.round(parseFloat(overrideInput) * 100)
        : parseInt(overrideInput);
      await setOverride.mutateAsync({ id: goal.id, manual_override: value });
      toast({ title: 'Override set' });
      setOverrideInput('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleClearOverride = async () => {
    try {
      await setOverride.mutateAsync({ id: goal.id, manual_override: null });
      toast({ title: 'Override cleared' });
      setOverrideInput('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-charcoal-black border-muted-gray text-bone-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-accent-yellow" />
            {GOAL_TYPE_LABELS[goal.goal_type] || goal.goal_type}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Progress */}
          <div>
            <div className="flex items-end justify-between mb-2">
              <span className="text-3xl font-bold text-bone-white">{displayActual}</span>
              <span className="text-sm text-muted-gray">/ {displayTarget}</span>
            </div>
            <div className="w-full bg-muted-gray/20 rounded-full h-3 mb-2">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${progress >= 100 ? 'text-emerald-400' : 'text-muted-gray'}`}>
                {progress}%
              </span>
              <div className="flex items-center gap-2">
                {goal.is_team_goal && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-400">Team</span>
                )}
                <span className="text-xs text-muted-gray">
                  {PERIOD_LABELS[goal.period_type] || goal.period_type}
                </span>
              </div>
            </div>
          </div>

          {/* Data source */}
          <div className="p-3 rounded-lg bg-muted-gray/10 border border-muted-gray/20">
            <div className="text-xs text-muted-gray mb-1">Data Source</div>
            <div className="text-sm text-bone-white">
              {GOAL_SOURCE_LABELS[goal.goal_type] || 'Manual tracking'}
            </div>
          </div>

          {/* Computed vs override */}
          {goal.is_overridden && (
            <div className="p-3 rounded-lg bg-amber-600/10 border border-amber-600/20">
              <div className="text-xs text-amber-400 mb-1">Manual Override Active</div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-bone-white">Override: {displayActual}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-gray">Computed: {displayComputed}</span>
                </div>
              </div>
            </div>
          )}

          {/* Period info */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-gray">
              {periodStart.toLocaleDateString()} - {periodEnd.toLocaleDateString()}
            </span>
            <span className="text-bone-white font-medium">
              {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left
            </span>
          </div>

          {/* Override controls */}
          <div className="border-t border-muted-gray/20 pt-4">
            <label className="text-sm text-muted-gray block mb-2">
              Override Value {isRevenue ? '($)' : ''}
            </label>
            <div className="flex gap-2">
              <Input
                type="number"
                step={isRevenue ? '0.01' : '1'}
                value={overrideInput}
                onChange={(e) => setOverrideInput(e.target.value)}
                placeholder={isRevenue ? 'e.g. 500.00' : 'e.g. 50'}
                className="bg-charcoal-black border-muted-gray text-bone-white flex-1"
              />
              <Button
                onClick={handleSetOverride}
                disabled={!overrideInput || setOverride.isPending}
                className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
              >
                Set
              </Button>
            </div>
            {goal.is_overridden && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearOverride}
                disabled={setOverride.isPending}
                className="mt-2 text-muted-gray border-muted-gray/30 hover:text-bone-white"
              >
                Clear Override
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GoalDetailDialog;
