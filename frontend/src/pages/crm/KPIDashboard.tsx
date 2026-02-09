import { useState } from 'react';
import { useKPIOverview, useRepPerformance, useKPITrends } from '@/hooks/crm/useKPI';
import KPIMetricCard from '@/components/crm/KPIMetricCard';
import RepLeaderboard from '@/components/crm/RepLeaderboard';
import { Input } from '@/components/ui/input';
import {
  DollarSign, TrendingUp, Target, Users, Clock,
  BarChart3, Percent, Briefcase, Send, Inbox, Megaphone,
} from 'lucide-react';

const KPIDashboard = () => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const params = {
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  };

  const { data: kpi, isLoading: kpiLoading } = useKPIOverview(params);
  const { data: repData } = useRepPerformance(params);
  const { data: trendsData } = useKPITrends({ months_back: 6 });

  const reps = repData?.reps || [];
  const trends = trendsData?.trends || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading text-accent-yellow">KPI Dashboard</h1>
          <p className="text-muted-gray mt-1">Sales performance analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="From"
            className="w-40 bg-charcoal-black border-muted-gray text-bone-white"
          />
          <span className="text-muted-gray">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="To"
            className="w-40 bg-charcoal-black border-muted-gray text-bone-white"
          />
        </div>
      </div>

      {/* KPI Cards */}
      {kpiLoading ? (
        <div className="text-center py-8 text-muted-gray">Loading KPIs...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPIMetricCard
            title="Total Revenue"
            value={`$${((kpi?.total_revenue || 0) / 100).toLocaleString()}`}
            subtitle={`${kpi?.deals_won || 0} deals won`}
            icon={DollarSign}
          />
          <KPIMetricCard
            title="Win Rate"
            value={`${kpi?.win_rate || 0}%`}
            subtitle={`${kpi?.deals_lost || 0} lost`}
            icon={Percent}
          />
          <KPIMetricCard
            title="Open Pipeline"
            value={`$${((kpi?.open_pipeline_value || 0) / 100).toLocaleString()}`}
            subtitle={`${kpi?.open_deals || 0} deals`}
            icon={TrendingUp}
          />
          <KPIMetricCard
            title="Avg Deal Size"
            value={`$${((kpi?.avg_deal_size || 0) / 100).toLocaleString()}`}
            icon={Target}
          />
          <KPIMetricCard
            title="Avg Sales Cycle"
            value={`${kpi?.avg_cycle_days || 0} days`}
            icon={Clock}
          />
          <KPIMetricCard
            title="Active Contacts"
            value={kpi?.active_contacts || 0}
            icon={Users}
          />
          <KPIMetricCard
            title="New Contacts"
            value={kpi?.new_contacts || 0}
            subtitle="this period"
            icon={Users}
          />
          <KPIMetricCard
            title="Total Deals"
            value={kpi?.total_deals || 0}
            icon={Briefcase}
          />
          <KPIMetricCard
            title="Emails Sent"
            value={kpi?.total_emails_sent || 0}
            subtitle="this period"
            icon={Send}
          />
          <KPIMetricCard
            title="Emails Received"
            value={kpi?.total_emails_received || 0}
            subtitle="this period"
            icon={Inbox}
          />
          <KPIMetricCard
            title="Campaign Emails"
            value={kpi?.total_campaign_emails || 0}
            subtitle="this period"
            icon={Megaphone}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rep Performance Table */}
        <div className="lg:col-span-2 bg-charcoal-black border border-muted-gray/30 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-bone-white mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-accent-yellow" />
            Rep Performance
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-gray border-b border-muted-gray/20">
                  <th className="pb-2">Rep</th>
                  <th className="pb-2 text-right">Revenue</th>
                  <th className="pb-2 text-right">Won</th>
                  <th className="pb-2 text-right">Lost</th>
                  <th className="pb-2 text-right">Win %</th>
                  <th className="pb-2 text-right">Pipeline</th>
                  <th className="pb-2 text-right">Activities</th>
                  <th className="pb-2 text-right">Emails</th>
                </tr>
              </thead>
              <tbody>
                {reps.map((rep: any) => (
                  <tr key={rep.rep_id} className="border-b border-muted-gray/10">
                    <td className="py-2 text-bone-white">{rep.rep_name || 'Unknown'}</td>
                    <td className="py-2 text-right text-accent-yellow">${((rep.revenue || 0) / 100).toLocaleString()}</td>
                    <td className="py-2 text-right text-emerald-400">{rep.deals_won || 0}</td>
                    <td className="py-2 text-right text-red-400">{rep.deals_lost || 0}</td>
                    <td className="py-2 text-right text-bone-white">{rep.win_rate || 0}%</td>
                    <td className="py-2 text-right text-muted-gray">${((rep.open_pipeline || 0) / 100).toLocaleString()}</td>
                    <td className="py-2 text-right text-muted-gray">{rep.total_interactions || 0}</td>
                    <td className="py-2 text-right text-muted-gray">{(rep.emails_sent || 0) + (rep.emails_received || 0)}</td>
                  </tr>
                ))}
                {reps.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-gray">No data</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Leaderboard */}
        <RepLeaderboard dateFrom={dateFrom || undefined} dateTo={dateTo || undefined} />
      </div>

      {/* Trends */}
      {trends.length > 0 && (
        <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-bone-white mb-4">Monthly Trends</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-gray border-b border-muted-gray/20">
                  <th className="pb-2">Period</th>
                  <th className="pb-2 text-right">New Deals</th>
                  <th className="pb-2 text-right">Won</th>
                  <th className="pb-2 text-right">Lost</th>
                  <th className="pb-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {trends.map((t: any) => (
                  <tr key={t.period} className="border-b border-muted-gray/10">
                    <td className="py-2 text-bone-white">{t.period}</td>
                    <td className="py-2 text-right text-muted-gray">{t.new_deals}</td>
                    <td className="py-2 text-right text-emerald-400">{t.deals_won}</td>
                    <td className="py-2 text-right text-red-400">{t.deals_lost}</td>
                    <td className="py-2 text-right text-accent-yellow">${((t.revenue || 0) / 100).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default KPIDashboard;
