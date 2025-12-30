/**
 * Order Stats Admin Tab
 * Display Order statistics and analytics
 */
import { useQuery } from '@tanstack/react-query';
import { orderAPI, OrderAdminStats, PRIMARY_TRACKS } from '@/lib/api/order';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { Users, Building, FileText, Briefcase, TrendingUp, MapPin } from 'lucide-react';

const StatCard = ({ icon, title, value, delay }: { icon: React.ReactNode; title: string; value: string | number; delay: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: delay * 0.1 }}
  >
    <Card className="bg-charcoal-black border-muted-gray">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-gray uppercase tracking-wider">{title}</p>
            <p className="text-3xl font-bold text-accent-yellow">{value}</p>
          </div>
          <div className="text-accent-yellow">{icon}</div>
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

export default function OrderStatsTab() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['orderAdminStats'],
    queryFn: () => orderAPI.getAdminStats(),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">Error loading stats</div>;
  }

  const trackData = Object.entries(stats?.members_by_track || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const cityData = Object.entries(stats?.members_by_city || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Users className="h-8 w-8" />} title="Total Members" value={stats?.total_members || 0} delay={0} />
        <StatCard icon={<TrendingUp className="h-8 w-8" />} title="Active Members" value={stats?.active_members || 0} delay={1} />
        <StatCard icon={<Users className="h-8 w-8" />} title="Probationary" value={stats?.probationary_members || 0} delay={2} />
        <StatCard icon={<FileText className="h-8 w-8" />} title="Pending Apps" value={stats?.pending_applications || 0} delay={3} />
        <StatCard icon={<Building className="h-8 w-8" />} title="Total Lodges" value={stats?.total_lodges || 0} delay={4} />
        <StatCard icon={<Building className="h-8 w-8" />} title="Active Lodges" value={stats?.active_lodges || 0} delay={5} />
        <StatCard icon={<Briefcase className="h-8 w-8" />} title="Active Jobs" value={stats?.active_jobs || 0} delay={6} />
        <StatCard icon={<Users className="h-8 w-8" />} title="Suspended" value={stats?.suspended_members || 0} delay={7} />
      </div>

      {/* Distribution Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Members by Track */}
        <Card className="bg-charcoal-black border-muted-gray">
          <CardHeader>
            <CardTitle className="text-bone-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent-yellow" />
              Members by Track
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trackData.length > 0 ? (
              <div className="space-y-3">
                {trackData.map(([track, count]) => {
                  const maxCount = trackData[0][1];
                  const percentage = (count / maxCount) * 100;
                  const trackLabel = PRIMARY_TRACKS.find(t => t.value === track)?.label || track;

                  return (
                    <div key={track}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="capitalize">{trackLabel}</span>
                        <span className="text-accent-yellow">{count}</span>
                      </div>
                      <div className="h-2 bg-muted-gray/30 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-accent-yellow"
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.5, delay: 0.2 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-gray py-4">No track data available</p>
            )}
          </CardContent>
        </Card>

        {/* Members by City */}
        <Card className="bg-charcoal-black border-muted-gray">
          <CardHeader>
            <CardTitle className="text-bone-white flex items-center gap-2">
              <MapPin className="h-5 w-5 text-accent-yellow" />
              Members by City
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cityData.length > 0 ? (
              <div className="space-y-3">
                {cityData.map(([city, count]) => {
                  const maxCount = cityData[0][1];
                  const percentage = (count / maxCount) * 100;

                  return (
                    <div key={city}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{city}</span>
                        <span className="text-accent-yellow">{count}</span>
                      </div>
                      <div className="h-2 bg-muted-gray/30 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-primary"
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.5, delay: 0.2 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-gray py-4">No city data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-charcoal-black border-muted-gray">
          <CardContent className="pt-6 text-center">
            <p className="text-5xl font-bold text-accent-yellow">
              {stats?.total_members ? Math.round((stats.active_members / stats.total_members) * 100) : 0}%
            </p>
            <p className="text-muted-gray mt-1">Active Rate</p>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray">
          <CardContent className="pt-6 text-center">
            <p className="text-5xl font-bold text-accent-yellow">
              {stats?.total_lodges ? Math.round(stats.total_members / stats.total_lodges) : 0}
            </p>
            <p className="text-muted-gray mt-1">Avg Members/Lodge</p>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray">
          <CardContent className="pt-6 text-center">
            <p className="text-5xl font-bold text-accent-yellow">
              {Object.keys(stats?.members_by_city || {}).length}
            </p>
            <p className="text-muted-gray mt-1">Cities Represented</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
