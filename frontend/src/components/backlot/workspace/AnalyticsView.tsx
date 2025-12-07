/**
 * AnalyticsView - Producer Analytics Dashboard (READ-ONLY)
 * Displays cost vs budget, schedule health, and utilization metrics
 * No editing controls - purely visualization
 */
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  MapPin,
  Users,
  Film,
  Calendar,
  Target,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  FileText,
} from 'lucide-react';
import {
  useCostByDepartmentAnalytics,
  useTimeScheduleAnalytics,
  useUtilizationAnalytics,
  useAnalyticsOverview,
} from '@/hooks/backlot';
import {
  AnalyticsScheduleStatus,
  AnalyticsBudgetStatus,
  SCHEDULE_STATUS_LABELS,
  SCHEDULE_STATUS_COLORS,
  BUDGET_STATUS_LABELS,
  BUDGET_STATUS_COLORS,
} from '@/types/backlot';
import { cn } from '@/lib/utils';

interface AnalyticsViewProps {
  projectId: string;
}

// Format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Format percentage
const formatPercent = (value: number): string => {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

// Status badge component
const StatusBadge: React.FC<{
  status: AnalyticsScheduleStatus | AnalyticsBudgetStatus;
  type: 'schedule' | 'budget';
}> = ({ status, type }) => {
  const labels = type === 'schedule' ? SCHEDULE_STATUS_LABELS : BUDGET_STATUS_LABELS;
  const colors = type === 'schedule' ? SCHEDULE_STATUS_COLORS : BUDGET_STATUS_COLORS;

  return (
    <Badge variant="outline" className={cn('text-xs', colors[status as keyof typeof colors])}>
      {labels[status as keyof typeof labels]}
    </Badge>
  );
};

// Overview Cards Section
const OverviewSection: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { data: overview, isLoading } = useAnalyticsOverview(projectId);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  if (!overview) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Budget Overview */}
      <Card className="bg-charcoal-black/50 border-muted-gray/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-green-500/10">
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <StatusBadge status={overview.budget.budget_status} type="budget" />
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-bone-white">
              {overview.budget.has_budget ? formatCurrency(overview.budget.actual_total) : 'No Budget'}
            </div>
            <p className="text-xs text-muted-gray">
              {overview.budget.has_budget
                ? `of ${formatCurrency(overview.budget.estimated_total)} budget`
                : 'Create a budget to track costs'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Progress */}
      <Card className="bg-charcoal-black/50 border-muted-gray/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Film className="w-5 h-5 text-blue-400" />
            </div>
            <StatusBadge status={overview.schedule.schedule_status} type="schedule" />
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-bone-white">
              {overview.schedule.progress_percent}%
            </div>
            <p className="text-xs text-muted-gray">
              {overview.schedule.pages_shot} of {overview.schedule.total_pages} pages shot
            </p>
          </div>
          <Progress value={overview.schedule.progress_percent} className="mt-2 h-1.5" />
        </CardContent>
      </Card>

      {/* Shoot Days */}
      <Card className="bg-charcoal-black/50 border-muted-gray/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Calendar className="w-5 h-5 text-purple-400" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-bone-white">
              {overview.schedule.completed_days} / {overview.schedule.total_shoot_days}
            </div>
            <p className="text-xs text-muted-gray">shoot days completed</p>
          </div>
          <Progress
            value={overview.schedule.total_shoot_days > 0
              ? (overview.schedule.completed_days / overview.schedule.total_shoot_days) * 100
              : 0}
            className="mt-2 h-1.5"
          />
        </CardContent>
      </Card>

      {/* Team */}
      <Card className="bg-charcoal-black/50 border-muted-gray/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Users className="w-5 h-5 text-orange-400" />
            </div>
            {overview.team.open_roles > 0 && (
              <Badge variant="outline" className="text-xs bg-orange-500/20 text-orange-400 border-orange-500/30">
                {overview.team.open_roles} open
              </Badge>
            )}
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-bone-white">{overview.team.total_members}</div>
            <p className="text-xs text-muted-gray">
              team members ({overview.team.booked_roles} roles filled)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Cost by Department Section
const CostByDepartmentSection: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { data, isLoading } = useCostByDepartmentAnalytics(projectId);

  if (isLoading) {
    return (
      <Card className="bg-charcoal-black/50 border-muted-gray/20">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  if (!data?.has_budget) {
    return (
      <Card className="bg-charcoal-black/50 border-muted-gray/20">
        <CardHeader>
          <CardTitle className="text-bone-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Cost vs Budget by Department
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <DollarSign className="w-12 h-12 text-muted-gray mb-4" />
            <h3 className="text-lg font-medium text-bone-white mb-2">No Budget Data</h3>
            <p className="text-muted-gray text-sm">
              Create a budget to see cost breakdowns by department
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Find max for scaling
  const maxAmount = Math.max(...data.departments.map((d) => Math.max(d.budgeted_amount, d.actual_amount)));

  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/20">
      <CardHeader>
        <CardTitle className="text-bone-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Cost vs Budget by Department
        </CardTitle>
        <CardDescription className="text-muted-gray">
          {data.budget_name} - Comparing budgeted vs actual costs
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-muted-gray/5 rounded-lg">
          <div>
            <p className="text-xs text-muted-gray">Budgeted</p>
            <p className="text-lg font-semibold text-bone-white">{formatCurrency(data.totals.budgeted)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-gray">Actual</p>
            <p className="text-lg font-semibold text-bone-white">{formatCurrency(data.totals.actual)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-gray">Variance</p>
            <p className={cn(
              'text-lg font-semibold',
              data.totals.variance > 0 ? 'text-red-400' : data.totals.variance < 0 ? 'text-green-400' : 'text-bone-white'
            )}>
              {data.totals.variance > 0 ? '+' : ''}{formatCurrency(data.totals.variance)}
            </p>
          </div>
        </div>

        {/* Department bars */}
        <div className="space-y-4">
          {data.departments.slice(0, 10).map((dept) => (
            <div key={dept.department} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-bone-white font-medium truncate">{dept.department}</span>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-xs',
                    dept.variance > 0 ? 'text-red-400' : dept.variance < 0 ? 'text-green-400' : 'text-muted-gray'
                  )}>
                    {formatPercent(dept.variance_percent)}
                  </span>
                  {dept.variance > 0 ? (
                    <TrendingUp className="w-3 h-3 text-red-400" />
                  ) : dept.variance < 0 ? (
                    <TrendingDown className="w-3 h-3 text-green-400" />
                  ) : null}
                </div>
              </div>
              <div className="flex gap-1 h-4">
                {/* Budgeted bar */}
                <div
                  className="bg-blue-500/50 rounded-sm"
                  style={{ width: `${(dept.budgeted_amount / maxAmount) * 100}%` }}
                  title={`Budgeted: ${formatCurrency(dept.budgeted_amount)}`}
                />
              </div>
              <div className="flex gap-1 h-4">
                {/* Actual bar */}
                <div
                  className={cn(
                    'rounded-sm',
                    dept.variance > 0 ? 'bg-red-500/50' : 'bg-green-500/50'
                  )}
                  style={{ width: `${(dept.actual_amount / maxAmount) * 100}%` }}
                  title={`Actual: ${formatCurrency(dept.actual_amount)}`}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-gray">
                <span>Budget: {formatCurrency(dept.budgeted_amount)}</span>
                <span>Actual: {formatCurrency(dept.actual_amount)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-6 pt-4 border-t border-muted-gray/20">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-blue-500/50" />
            <span className="text-xs text-muted-gray">Budgeted</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-green-500/50" />
            <span className="text-xs text-muted-gray">Under Budget</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-red-500/50" />
            <span className="text-xs text-muted-gray">Over Budget</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Time & Schedule Section
const TimeScheduleSection: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { data, isLoading } = useTimeScheduleAnalytics(projectId);

  if (isLoading) {
    return (
      <Card className="bg-charcoal-black/50 border-muted-gray/20">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { summary, pages_by_status, daily_trend } = data;

  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-bone-white flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Time & Schedule Health
          </CardTitle>
          <StatusBadge status={summary.schedule_status} type="schedule" />
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-3 bg-muted-gray/5 rounded-lg">
            <div className="flex items-center gap-2 text-muted-gray text-xs mb-1">
              <FileText className="w-3 h-3" />
              Total Pages
            </div>
            <p className="text-xl font-bold text-bone-white">{summary.total_pages}</p>
          </div>
          <div className="p-3 bg-muted-gray/5 rounded-lg">
            <div className="flex items-center gap-2 text-muted-gray text-xs mb-1">
              <CheckCircle2 className="w-3 h-3" />
              Pages Shot
            </div>
            <p className="text-xl font-bold text-green-400">{summary.pages_shot}</p>
          </div>
          <div className="p-3 bg-muted-gray/5 rounded-lg">
            <div className="flex items-center gap-2 text-muted-gray text-xs mb-1">
              <Target className="w-3 h-3" />
              Target/Day
            </div>
            <p className="text-xl font-bold text-bone-white">{summary.target_pages_per_day}</p>
          </div>
          <div className="p-3 bg-muted-gray/5 rounded-lg">
            <div className="flex items-center gap-2 text-muted-gray text-xs mb-1">
              <TrendingUp className="w-3 h-3" />
              Avg/Day
            </div>
            <p className={cn(
              'text-xl font-bold',
              summary.avg_pages_per_day >= summary.target_pages_per_day ? 'text-green-400' : 'text-orange-400'
            )}>
              {summary.avg_pages_per_day}
            </p>
          </div>
        </div>

        {/* Pages by Status */}
        <div className="mb-6">
          <p className="text-sm text-muted-gray mb-2">Pages by Status</p>
          <div className="flex h-6 rounded-lg overflow-hidden bg-muted-gray/10">
            {pages_by_status.shot > 0 && (
              <div
                className="bg-green-500/70 flex items-center justify-center text-xs text-white"
                style={{ width: `${(pages_by_status.shot / summary.total_pages) * 100}%` }}
                title={`Shot: ${pages_by_status.shot} pages`}
              >
                {pages_by_status.shot > summary.total_pages * 0.1 && pages_by_status.shot}
              </div>
            )}
            {pages_by_status.scheduled > 0 && (
              <div
                className="bg-blue-500/70 flex items-center justify-center text-xs text-white"
                style={{ width: `${(pages_by_status.scheduled / summary.total_pages) * 100}%` }}
                title={`Scheduled: ${pages_by_status.scheduled} pages`}
              >
                {pages_by_status.scheduled > summary.total_pages * 0.1 && pages_by_status.scheduled}
              </div>
            )}
            {pages_by_status.needs_pickup > 0 && (
              <div
                className="bg-orange-500/70 flex items-center justify-center text-xs text-white"
                style={{ width: `${(pages_by_status.needs_pickup / summary.total_pages) * 100}%` }}
                title={`Needs Pickup: ${pages_by_status.needs_pickup} pages`}
              />
            )}
            {pages_by_status.not_scheduled > 0 && (
              <div
                className="bg-muted-gray/50 flex items-center justify-center text-xs text-white"
                style={{ width: `${(pages_by_status.not_scheduled / summary.total_pages) * 100}%` }}
                title={`Not Scheduled: ${pages_by_status.not_scheduled} pages`}
              />
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-gray">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500/70" /> Shot ({pages_by_status.shot})
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500/70" /> Scheduled ({pages_by_status.scheduled})
            </span>
            {pages_by_status.needs_pickup > 0 && (
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-orange-500/70" /> Pickup ({pages_by_status.needs_pickup})
              </span>
            )}
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-muted-gray/50" /> Not Scheduled ({pages_by_status.not_scheduled})
            </span>
          </div>
        </div>

        {/* Daily Trend */}
        {daily_trend.length > 0 && (
          <div>
            <p className="text-sm text-muted-gray mb-2">Daily Progress</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-muted-gray/20">
                    <th className="text-left py-2 text-muted-gray font-medium">Day</th>
                    <th className="text-left py-2 text-muted-gray font-medium">Date</th>
                    <th className="text-right py-2 text-muted-gray font-medium">Planned</th>
                    <th className="text-right py-2 text-muted-gray font-medium">Shot</th>
                    <th className="text-right py-2 text-muted-gray font-medium">Cumulative</th>
                    <th className="text-center py-2 text-muted-gray font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {daily_trend.slice(0, 10).map((day) => (
                    <tr key={day.day_number} className="border-b border-muted-gray/10">
                      <td className="py-2 text-bone-white">Day {day.day_number}</td>
                      <td className="py-2 text-muted-gray">
                        {day.date ? new Date(day.date).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-2 text-right text-bone-white">{day.pages_planned}</td>
                      <td className="py-2 text-right text-green-400">{day.pages_shot}</td>
                      <td className="py-2 text-right text-muted-gray">{day.cumulative_shot}</td>
                      <td className="py-2 text-center">
                        {day.is_completed ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400 mx-auto" />
                        ) : (
                          <Clock className="w-4 h-4 text-muted-gray mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Utilization Section
const UtilizationSection: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { data, isLoading } = useUtilizationAnalytics(projectId);

  if (isLoading) {
    return (
      <Card className="bg-charcoal-black/50 border-muted-gray/20">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/20">
      <CardHeader>
        <CardTitle className="text-bone-white flex items-center gap-2">
          <Target className="w-5 h-5" />
          Resource Utilization
        </CardTitle>
        <CardDescription className="text-muted-gray">
          Location and crew/cast usage across production days
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-3 bg-muted-gray/5 rounded-lg">
            <div className="flex items-center gap-2 text-muted-gray text-xs mb-1">
              <MapPin className="w-3 h-3" />
              Locations
            </div>
            <p className="text-xl font-bold text-bone-white">{data.summary.unique_locations}</p>
          </div>
          <div className="p-3 bg-muted-gray/5 rounded-lg">
            <div className="flex items-center gap-2 text-muted-gray text-xs mb-1">
              <Users className="w-3 h-3" />
              Cast
            </div>
            <p className="text-xl font-bold text-bone-white">{data.summary.total_cast_booked}</p>
          </div>
          <div className="p-3 bg-muted-gray/5 rounded-lg">
            <div className="flex items-center gap-2 text-muted-gray text-xs mb-1">
              <Users className="w-3 h-3" />
              Crew
            </div>
            <p className="text-xl font-bold text-bone-white">{data.summary.total_crew_booked}</p>
          </div>
          <div className="p-3 bg-muted-gray/5 rounded-lg">
            <div className="flex items-center gap-2 text-muted-gray text-xs mb-1">
              <AlertTriangle className="w-3 h-3" />
              Open Roles
            </div>
            <p className={cn(
              'text-xl font-bold',
              data.summary.open_roles > 0 ? 'text-orange-400' : 'text-green-400'
            )}>
              {data.summary.open_roles}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Locations Table */}
          <div>
            <p className="text-sm font-medium text-bone-white mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Location Usage
            </p>
            {data.locations.length === 0 ? (
              <p className="text-sm text-muted-gray">No locations scheduled yet</p>
            ) : (
              <div className="space-y-2">
                {data.locations.slice(0, 8).map((loc, i) => (
                  <div
                    key={loc.location_id || `loc-${i}`}
                    className="flex items-center justify-between p-2 bg-muted-gray/5 rounded"
                  >
                    <span className="text-sm text-bone-white truncate flex-1">{loc.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-gray">
                        {loc.days_completed}/{loc.days_scheduled} days
                      </span>
                      <div className="w-16 h-1.5 bg-muted-gray/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500"
                          style={{ width: `${(loc.days_completed / loc.days_scheduled) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cast/Crew Table */}
          <div>
            <p className="text-sm font-medium text-bone-white mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Key Personnel Usage
            </p>
            {data.cast.length === 0 && data.crew.length === 0 ? (
              <p className="text-sm text-muted-gray">No personnel assigned yet</p>
            ) : (
              <div className="space-y-2">
                {/* Show top cast */}
                {data.cast.slice(0, 4).map((person, i) => (
                  <div
                    key={`cast-${i}`}
                    className="flex items-center justify-between p-2 bg-muted-gray/5 rounded"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-bone-white truncate block">{person.name}</span>
                      <span className="text-xs text-muted-gray">{person.role}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/30">
                        Cast
                      </Badge>
                      <span className="text-xs text-muted-gray">{person.days_worked}/{person.days_scheduled}</span>
                    </div>
                  </div>
                ))}
                {/* Show top crew */}
                {data.crew.slice(0, 4).map((person, i) => (
                  <div
                    key={`crew-${i}`}
                    className="flex items-center justify-between p-2 bg-muted-gray/5 rounded"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-bone-white truncate block">{person.name}</span>
                      <span className="text-xs text-muted-gray">{person.role || person.department}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
                        Crew
                      </Badge>
                      <span className="text-xs text-muted-gray">{person.days_worked}/{person.days_scheduled}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Main Analytics View Component
const AnalyticsView: React.FC<AnalyticsViewProps> = ({ projectId }) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-heading text-bone-white">Producer Analytics</h2>
        <p className="text-muted-gray text-sm">
          Read-only dashboard showing budget, schedule, and resource metrics
        </p>
      </div>

      {/* Overview Cards */}
      <OverviewSection projectId={projectId} />

      {/* Main Analytics Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Cost by Department */}
        <CostByDepartmentSection projectId={projectId} />

        {/* Time & Schedule */}
        <TimeScheduleSection projectId={projectId} />
      </div>

      {/* Utilization */}
      <UtilizationSection projectId={projectId} />
    </div>
  );
};

export default AnalyticsView;
