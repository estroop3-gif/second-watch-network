/**
 * Filmmaker Pro Analytics — Profile view trends, sources, and recent viewers.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Users, Search, TrendingUp, TrendingDown } from 'lucide-react';
import {
  useProAnalyticsOverview,
  useProAnalyticsTrends,
  useProRecentViewers,
  useProViewSources,
} from '@/hooks/useFilmmakerPro';
import { useEnrichedProfile } from '@/context/EnrichedProfileContext';
import ProUpgradePrompt from '@/components/filmmaker-pro/ProUpgradePrompt';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts';

const PERIOD_OPTIONS = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
];

const Analytics = () => {
  const { profile } = useEnrichedProfile();
  const [days, setDays] = useState(30);
  const { data: overview } = useProAnalyticsOverview(days);
  const { data: trendsData } = useProAnalyticsTrends(days);
  const { data: viewersData } = useProRecentViewers(20);
  const { data: sourcesData } = useProViewSources(days);

  if (!profile?.is_filmmaker_pro) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-heading text-bone-white mb-6">Profile Analytics</h1>
        <ProUpgradePrompt feature="Profile Analytics" />
      </div>
    );
  }

  const trends = trendsData?.trends || [];
  const viewers = viewersData?.viewers || [];
  const sources = sourcesData?.sources || [];

  const getChangeIndicator = (current: number, previous: number) => {
    if (previous === 0) return null;
    const pct = Math.round(((current - previous) / previous) * 100);
    if (pct > 0) return <span className="text-green-400 text-xs flex items-center gap-1"><TrendingUp className="h-3 w-3" />+{pct}%</span>;
    if (pct < 0) return <span className="text-red-400 text-xs flex items-center gap-1"><TrendingDown className="h-3 w-3" />{pct}%</span>;
    return <span className="text-muted-gray text-xs">0%</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading text-bone-white">Analytics</h1>
        <div className="flex gap-1 bg-muted-gray/20 rounded-lg p-1">
          {PERIOD_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={days === opt.value ? 'default' : 'ghost'}
              className={days === opt.value ? 'bg-amber-500 text-charcoal-black' : 'text-muted-gray'}
              onClick={() => setDays(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-charcoal-black border-muted-gray">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-muted-gray">Profile Views</span>
            </div>
            <p className="text-3xl font-bold text-bone-white">{overview?.views ?? 0}</p>
            {overview && getChangeIndicator(overview.views, overview.prev_views)}
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-green-400" />
              <span className="text-xs text-muted-gray">Unique Visitors</span>
            </div>
            <p className="text-3xl font-bold text-bone-white">{overview?.unique_viewers ?? 0}</p>
            {overview && getChangeIndicator(overview.unique_viewers, overview.prev_unique_viewers)}
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Search className="h-4 w-4 text-purple-400" />
              <span className="text-xs text-muted-gray">Search Appearances</span>
            </div>
            <p className="text-3xl font-bold text-bone-white">{overview?.search_appearances ?? 0}</p>
            {overview && getChangeIndicator(overview.search_appearances, overview.prev_search_appearances)}
          </CardContent>
        </Card>
      </div>

      {/* Views Trend Chart */}
      <Card className="bg-charcoal-black border-muted-gray">
        <CardHeader>
          <CardTitle className="text-bone-white">Views Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trends}>
                <XAxis dataKey="date" stroke="#4C4C4C" tick={{ fill: '#4C4C4C', fontSize: 12 }}
                  tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                <YAxis stroke="#4C4C4C" tick={{ fill: '#4C4C4C', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #4C4C4C', borderRadius: '8px' }}
                  labelStyle={{ color: '#F9F5EF' }}
                />
                <Line type="monotone" dataKey="views_count" stroke="#60a5fa" strokeWidth={2} dot={false} name="Views" />
                <Line type="monotone" dataKey="unique_viewers" stroke="#34d399" strokeWidth={2} dot={false} name="Unique" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-gray py-12">No data yet. Views will appear here as people visit your profile.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* View Sources */}
        <Card className="bg-charcoal-black border-muted-gray">
          <CardHeader>
            <CardTitle className="text-bone-white">View Sources</CardTitle>
          </CardHeader>
          <CardContent>
            {sources.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={sources} layout="vertical">
                  <XAxis type="number" stroke="#4C4C4C" tick={{ fill: '#4C4C4C', fontSize: 12 }} />
                  <YAxis dataKey="source" type="category" stroke="#4C4C4C" tick={{ fill: '#F9F5EF', fontSize: 12 }} width={80} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #4C4C4C', borderRadius: '8px' }} />
                  <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-gray py-8">No source data yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Viewers */}
        <Card className="bg-charcoal-black border-muted-gray">
          <CardHeader>
            <CardTitle className="text-bone-white">Recent Viewers</CardTitle>
          </CardHeader>
          <CardContent>
            {viewers.length > 0 ? (
              <div className="space-y-3 max-h-[250px] overflow-y-auto">
                {viewers.map((v: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <img
                      src={v.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${v.username}`}
                      alt="" className="h-8 w-8 rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-bone-white truncate">{v.display_name || v.full_name || v.username}</p>
                      <p className="text-xs text-muted-gray">{v.source}</p>
                    </div>
                    <p className="text-xs text-muted-gray shrink-0">
                      {new Date(v.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-gray py-8">No viewers recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;
