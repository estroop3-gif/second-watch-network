import { useState } from 'react';
import { useMyGoals } from '@/hooks/crm/useGoals';
import { useCreateGoal, useDeleteGoal } from '@/hooks/crm/useGoals';
import { usePermissions } from '@/hooks/usePermissions';
import GoalProgressCard from '@/components/crm/GoalProgressCard';
import GoalDetailDialog from '@/components/crm/GoalDetailDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Target } from 'lucide-react';

const GOAL_TYPES = [
  { value: 'revenue', label: 'Revenue ($)' },
  { value: 'deals_closed', label: 'Deals Closed' },
  { value: 'calls_made', label: 'Calls Made' },
  { value: 'emails_sent', label: 'Emails Sent' },
  { value: 'meetings_held', label: 'Meetings Held' },
  { value: 'demos_given', label: 'Demos Given' },
  { value: 'new_contacts', label: 'New Contacts' },
];

const PERIOD_TYPES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
];

const Goals = () => {
  const { hasAnyRole } = usePermissions();
  const isAdmin = hasAnyRole(['admin', 'superadmin', 'sales_admin']);
  const { toast } = useToast();

  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [goalType, setGoalType] = useState('revenue');
  const [periodType, setPeriodType] = useState('monthly');
  const [targetValue, setTargetValue] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const { data, isLoading } = useMyGoals(periodFilter !== 'all' ? { period_type: periodFilter } : undefined);
  const createGoal = useCreateGoal();
  const deleteGoal = useDeleteGoal();

  const goals = data?.goals || [];
  const activeGoals = goals.filter((g: any) => new Date(g.period_end) >= new Date());

  const handleCreateGoal = async () => {
    if (!targetValue || !periodStart || !periodEnd) return;
    try {
      const target = goalType === 'revenue'
        ? Math.round(parseFloat(targetValue) * 100)
        : parseInt(targetValue);
      await createGoal.mutateAsync({
        goal_type: goalType,
        period_type: periodType,
        target_value: target,
        period_start: periodStart,
        period_end: periodEnd,
      });
      toast({ title: 'Goal created' });
      setShowCreate(false);
      setTargetValue('');
      setPeriodStart('');
      setPeriodEnd('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('Delete this goal?')) return;
    try {
      await deleteGoal.mutateAsync(goalId);
      toast({ title: 'Goal deleted' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading text-accent-yellow flex items-center gap-3">
            <Target className="h-8 w-8" />
            Goals
          </h1>
          <p className="text-muted-gray mt-1">Track your progress toward targets</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-36 bg-charcoal-black border-muted-gray text-bone-white">
              <SelectValue placeholder="All Periods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Periods</SelectItem>
              {PERIOD_TYPES.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button
              onClick={() => setShowCreate(true)}
              className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Goal
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-gray">Loading goals...</div>
      ) : activeGoals.length === 0 ? (
        <div className="text-center py-12">
          <Target className="h-12 w-12 text-muted-gray mx-auto mb-3" />
          <p className="text-muted-gray">No active goals. {isAdmin ? 'Create one to get started.' : 'Check with your admin.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeGoals.map((goal: any) => (
            <div key={goal.id} className="relative group">
              <GoalProgressCard goal={goal} onClick={() => setSelectedGoal(goal)} />
              {isAdmin && (
                <button
                  onClick={() => handleDeleteGoal(goal.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 transition-opacity"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-charcoal-black border-muted-gray text-bone-white max-w-md">
          <DialogHeader>
            <DialogTitle>Create Goal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-gray block mb-2">Goal Type</label>
              <Select value={goalType} onValueChange={setGoalType}>
                <SelectTrigger className="bg-charcoal-black border-muted-gray text-bone-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_TYPES.map((g) => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-gray block mb-2">Period</label>
              <Select value={periodType} onValueChange={setPeriodType}>
                <SelectTrigger className="bg-charcoal-black border-muted-gray text-bone-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_TYPES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-gray block mb-2">
                Target {goalType === 'revenue' ? '($)' : ''}
              </label>
              <Input
                type="number"
                step={goalType === 'revenue' ? '0.01' : '1'}
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder={goalType === 'revenue' ? 'e.g. 500.00' : 'e.g. 50'}
                className="bg-charcoal-black border-muted-gray text-bone-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-gray block mb-2">Start Date</label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="bg-charcoal-black border-muted-gray text-bone-white"
                />
              </div>
              <div>
                <label className="text-sm text-muted-gray block mb-2">End Date</label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="bg-charcoal-black border-muted-gray text-bone-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button
                onClick={handleCreateGoal}
                disabled={!targetValue || !periodStart || !periodEnd || createGoal.isPending}
                className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
              >
                {createGoal.isPending ? 'Creating...' : 'Create Goal'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <GoalDetailDialog
        goal={selectedGoal}
        open={!!selectedGoal}
        onOpenChange={(open) => { if (!open) setSelectedGoal(null); }}
      />
    </div>
  );
};

export default Goals;
