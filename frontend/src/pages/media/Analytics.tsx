import { useState, useMemo } from 'react';
import {
  BarChart3, FileText, CheckCircle2, Clock, RotateCcw,
  Users, CalendarDays, MessageSquare, TrendingUp,
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useMediaAnalytics } from '@/hooks/media/useMediaAnalytics';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';

// --- Constants ---

const PERIOD_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All Time' },
];

const PIE_COLORS = [
  '#f59e0b', '#3b82f6', '#10b981', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
];

const STATUS_COLORS: Record<string, string> = {
  submitted: '#f59e0b',
  in_review: '#3b82f6',
  approved: '#10b981',
  in_production: '#8b5cf6',
  ready_for_review: '#ec4899',
  approved_final: '#06b6d4',
  scheduled: '#f97316',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  normal: '#3b82f6',
  low: '#6b7280',
};

// --- Helpers ---

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatWeekLabel(w: string) {
  const d = new Date(w + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// --- Components ---

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-charcoal-black border border-muted-gray/50 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-bone-white mb-1 font-medium">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
        </p>
      ))}
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) => (
  <div className="bg-muted-gray/20 border border-muted-gray/30 rounded-lg p-4">
    <div className="flex items-center gap-2 text-muted-gray text-xs mb-1">
      <Icon className="h-4 w-4" />
      {label}
    </div>
    <div className="text-2xl font-heading text-bone-white">{value}</div>
    {sub && <div className="text-xs text-muted-gray mt-0.5">{sub}</div>}
  </div>
);

const ChartCard = ({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) => (
  <div className={`bg-muted-gray/20 border border-muted-gray/30 rounded-lg p-4 ${className}`}>
    <h3 className="text-sm font-medium text-bone-white mb-3">{title}</h3>
    {children}
  </div>
);

const EmptyChart = () => (
  <div className="flex items-center justify-center h-48 text-muted-gray text-sm">No data</div>
);

const SectionHeader = ({ icon: Icon, title }: { icon: any; title: string }) => (
  <div className="flex items-center gap-2 mt-8 mb-4">
    <Icon className="h-5 w-5 text-accent-yellow" />
    <h2 className="text-lg font-heading text-bone-white">{title}</h2>
  </div>
);

// --- Main ---

const MediaAnalytics = () => {
  const [period, setPeriod] = useState('30');

  const params = useMemo(() => {
    if (period === 'all') return {};
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - Number(period));
    return {
      date_from: from.toISOString().split('T')[0],
      date_to: to.toISOString().split('T')[0],
    };
  }, [period]);

  const { data, isLoading } = useMediaAnalytics(params);

  const summary = data?.summary || {};
  const statusFunnel = data?.status_funnel || [];
  const stageDurations = data?.stage_durations || [];
  const contentTypeDist = data?.content_type_distribution || [];
  const platformDist = data?.platform_distribution || [];
  const priorityBreakdown = data?.priority_breakdown || [];
  const requestsOverTime = data?.requests_over_time || [];
  const turnaroundTrend = data?.turnaround_trend || [];
  const teamPerformance = data?.team_performance || [];
  const events = data?.events || {};
  const discussions = data?.discussions || {};

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent-yellow border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-heading text-accent-yellow flex items-center gap-3">
            <BarChart3 className="h-7 w-7" />
            Analytics
          </h1>
          <p className="text-muted-gray mt-1">Media Hub performance and KPIs</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-44 bg-muted-gray/20 border-muted-gray/30 text-bone-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Total Requests" value={summary.total ?? 0} sub={`${summary.active ?? 0} active`} />
        <StatCard icon={CheckCircle2} label="Completion Rate" value={`${summary.completion_rate ?? 0}%`} sub={`${summary.completed ?? 0} completed`} />
        <StatCard icon={Clock} label="Avg Turnaround" value={`${summary.avg_turnaround_days ?? '--'} days`} sub="Submitted to posted" />
        <StatCard icon={RotateCcw} label="Revision Rate" value={`${summary.revision_rate ?? 0}%`} sub={`${summary.cancelled ?? 0} cancelled`} />
      </div>

      {/* Section 1: Request Pipeline */}
      <SectionHeader icon={TrendingUp} title="Request Pipeline" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status Funnel */}
        <ChartCard title="Status Funnel">
          {statusFunnel.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusFunnel.map((r: any) => ({ ...r, name: formatStatus(r.status) }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                <XAxis type="number" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis type="category" dataKey="name" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} width={110} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Requests" radius={[0, 4, 4, 0]}>
                  {statusFunnel.map((entry: any, i: number) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.status] || PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Content Type Distribution */}
        <ChartCard title="Content Type">
          {contentTypeDist.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={contentTypeDist.map((r: any, i: number) => ({ name: formatStatus(r.content_type), value: r.count, fill: PIE_COLORS[i % PIE_COLORS.length] }))}
                  cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value"
                >
                  {contentTypeDist.map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Requests Over Time */}
        <ChartCard title="Requests Over Time">
          {requestsOverTime.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={requestsOverTime.map((r: any) => ({ ...r, week: formatWeekLabel(r.week) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="week" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                <Line type="monotone" dataKey="submitted" name="Submitted" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="completed" name="Completed" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Turnaround Trend */}
        <ChartCard title="Turnaround Trend">
          {turnaroundTrend.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={turnaroundTrend.map((r: any) => ({ ...r, week: formatWeekLabel(r.week) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="week" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" d" />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="avg_days" name="Avg Days" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Stage Durations */}
        <ChartCard title="Avg Time per Stage">
          {stageDurations.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stageDurations.map((r: any) => ({ ...r, name: formatStatus(r.status) }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                <XAxis type="number" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" d" />
                <YAxis type="category" dataKey="name" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} width={110} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avg_days" name="Avg Days" fill="#06b6d4" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Platform Distribution */}
        <ChartCard title="Platform Distribution">
          {platformDist.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={platformDist}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Requests" radius={[4, 4, 0, 0]}>
                  {platformDist.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.color || PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Priority Breakdown */}
        <ChartCard title="Priority Breakdown" className="lg:col-span-2">
          {priorityBreakdown.length === 0 ? <EmptyChart /> : (
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={priorityBreakdown.map((r: any) => ({ name: formatStatus(r.priority), value: r.count, fill: PRIORITY_COLORS[r.priority] || '#6b7280' }))}
                    cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} dataKey="value"
                  >
                    {priorityBreakdown.map((r: any, i: number) => (
                      <Cell key={i} fill={PRIORITY_COLORS[r.priority] || PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Section 2: Team Performance */}
      <SectionHeader icon={Users} title="Team Performance" />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Clock}
          label="Avg Response Time"
          value={summary.avg_response_hours != null ? `${summary.avg_response_hours} hrs` : '--'}
          sub="Submitted to in-review"
        />
        <div className="lg:col-span-3 bg-muted-gray/20 border border-muted-gray/30 rounded-lg p-4">
          <h3 className="text-sm font-medium text-bone-white mb-3">Leaderboard</h3>
          {teamPerformance.length === 0 ? (
            <div className="text-muted-gray text-sm py-4 text-center">No assignee data</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-gray border-b border-muted-gray/30">
                    <th className="pb-2 font-medium">Assignee</th>
                    <th className="pb-2 font-medium text-right">Completed</th>
                    <th className="pb-2 font-medium text-right">Active</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {teamPerformance.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-muted-gray/20">
                      <td className="py-2 text-bone-white">{row.assignee}</td>
                      <td className="py-2 text-right text-green-400">{row.completed}</td>
                      <td className="py-2 text-right text-blue-400">{row.active}</td>
                      <td className="py-2 text-right text-bone-white">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Events */}
      <SectionHeader icon={CalendarDays} title="Events" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard icon={CalendarDays} label="Total RSVPs" value={events.attendance?.total_rsvps ?? 0} />
        <StatCard icon={CheckCircle2} label="Acceptance Rate" value={`${events.attendance?.acceptance_rate ?? 0}%`} sub={`${events.attendance?.accepted ?? 0} accepted`} />
        <StatCard icon={Users} label="Tentative" value={events.attendance?.tentative ?? 0} />
        <StatCard icon={RotateCcw} label="Declined" value={events.attendance?.declined ?? 0} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Events by Type */}
        <ChartCard title="Events by Type">
          {(events.by_type || []).length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={(events.by_type || []).map((r: any) => ({ name: formatStatus(r.type), count: r.count }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Events" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Events Over Time */}
        <ChartCard title="Events Over Time">
          {(events.over_time || []).length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={(events.over_time || []).map((r: any) => ({ ...r, week: formatWeekLabel(r.week) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="week" stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="count" name="Events" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Section 4: Discussions */}
      <SectionHeader icon={MessageSquare} title="Discussions" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard icon={MessageSquare} label="Threads" value={discussions.threads ?? 0} />
        <StatCard icon={FileText} label="Replies" value={discussions.replies ?? 0} />
        <StatCard icon={TrendingUp} label="Avg Replies/Thread" value={discussions.avg_replies_per_thread ?? 0} />
        <StatCard icon={CheckCircle2} label="Resolution Rate" value={`${discussions.resolution_rate ?? 0}%`} />
      </div>
      <ChartCard title="By Category">
        {(discussions.by_category || []).length === 0 ? (
          <div className="text-muted-gray text-sm py-4 text-center">No categories yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-gray border-b border-muted-gray/30">
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 font-medium text-right">Threads</th>
                  <th className="pb-2 font-medium text-right">Replies</th>
                </tr>
              </thead>
              <tbody>
                {(discussions.by_category || []).map((row: any, i: number) => (
                  <tr key={i} className="border-b border-muted-gray/20">
                    <td className="py-2 text-bone-white">{row.category}</td>
                    <td className="py-2 text-right text-accent-yellow">{row.threads}</td>
                    <td className="py-2 text-right text-blue-400">{row.replies}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
};

export default MediaAnalytics;
