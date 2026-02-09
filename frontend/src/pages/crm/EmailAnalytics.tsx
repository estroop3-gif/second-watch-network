import { useState } from 'react';
import {
  BarChart3, Mail, Send, Inbox, Clock,
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useEmailAnalytics } from '@/hooks/crm/useEmail';
import { usePermissions } from '@/hooks/usePermissions';
import KPIMetricCard from '@/components/crm/KPIMetricCard';
import RepEmailDetail from '@/components/crm/admin/RepEmailDetail';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';

const RANGE_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '60', label: 'Last 60 days' },
  { value: '90', label: 'Last 90 days' },
];

const formatResponseTime = (minutes: number | undefined | null): string => {
  if (!minutes && minutes !== 0) return '--';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-charcoal-black border border-muted-gray/50 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-bone-white mb-1 font-medium">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
};

const EmailAnalytics = () => {
  const { hasAnyRole } = usePermissions();
  const isAdmin = hasAnyRole(['admin', 'superadmin']);
  const [days, setDays] = useState('30');
  const [selectedRep, setSelectedRep] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useEmailAnalytics(Number(days));

  const stats = data?.stats || {};
  const dailyVolume = data?.daily_volume || [];
  const repBreakdown = data?.rep_breakdown || [];

  if (!isAdmin) {
    return (
      <div className="text-center py-12 text-muted-gray">
        Admin access required to view email analytics.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading text-accent-yellow flex items-center gap-3">
            <BarChart3 className="h-7 w-7" />
            Email Analytics
          </h1>
          <p className="text-muted-gray mt-1">
            Email activity overview across all reps
          </p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-48 bg-charcoal-black border-muted-gray/30 text-bone-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stat Cards */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-gray">Loading analytics...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KPIMetricCard
              title="Total Sent"
              value={stats.total_sent ?? 0}
              icon={Send}
              subtitle={`Last ${days} days`}
            />
            <KPIMetricCard
              title="Total Received"
              value={stats.total_received ?? 0}
              icon={Inbox}
              subtitle={`Last ${days} days`}
            />
            <KPIMetricCard
              title="Avg Response Time"
              value={formatResponseTime(stats.avg_response_time_minutes)}
              icon={Clock}
              subtitle="median across all threads"
            />
          </div>

          {/* Daily Volume Line Chart */}
          <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-bone-white mb-4 flex items-center gap-2">
              <Mail className="h-4 w-4 text-accent-yellow" />
              Daily Email Volume
            </h3>
            {dailyVolume.length === 0 ? (
              <div className="text-center py-12 text-muted-gray text-sm">
                No email data for this period.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyVolume}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#4C4C4C" opacity={0.3} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#4C4C4C', fontSize: 11 }}
                    axisLine={{ stroke: '#4C4C4C' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#4C4C4C', fontSize: 11 }}
                    axisLine={{ stroke: '#4C4C4C' }}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: '#F9F5EF' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sent"
                    name="Sent"
                    stroke="#FCDC58"
                    strokeWidth={2}
                    dot={{ fill: '#FCDC58', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="received"
                    name="Received"
                    stroke="#4C4C4C"
                    strokeWidth={2}
                    dot={{ fill: '#4C4C4C', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Emails by Rep Bar Chart */}
          <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-bone-white mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-accent-yellow" />
              Emails by Rep
            </h3>
            {repBreakdown.length === 0 ? (
              <div className="text-center py-12 text-muted-gray text-sm">
                No rep data for this period.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(300, repBreakdown.length * 45)}>
                <BarChart
                  data={repBreakdown}
                  layout="vertical"
                  onClick={(e) => {
                    if (e?.activePayload?.[0]?.payload) {
                      const rep = e.activePayload[0].payload;
                      if (rep.rep_id) {
                        setSelectedRep({ id: rep.rep_id, name: rep.rep_name });
                      }
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#4C4C4C" opacity={0.3} />
                  <XAxis
                    type="number"
                    tick={{ fill: '#4C4C4C', fontSize: 11 }}
                    axisLine={{ stroke: '#4C4C4C' }}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="rep_name"
                    tick={{ fill: '#F9F5EF', fontSize: 11 }}
                    axisLine={{ stroke: '#4C4C4C' }}
                    tickLine={false}
                    width={120}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: '#F9F5EF' }}
                  />
                  <Bar
                    dataKey="sent"
                    name="Sent"
                    fill="#FCDC58"
                    radius={[0, 4, 4, 0]}
                  />
                  <Bar
                    dataKey="received"
                    name="Received"
                    fill="#4C4C4C"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
            <p className="text-xs text-muted-gray mt-2">Click a rep to see their email details</p>
          </div>

          {/* Rep Drill-Down */}
          {selectedRep && (
            <RepEmailDetail
              repId={selectedRep.id}
              repName={selectedRep.name}
              days={Number(days)}
              onClose={() => setSelectedRep(null)}
            />
          )}
        </>
      )}
    </div>
  );
};

export default EmailAnalytics;
