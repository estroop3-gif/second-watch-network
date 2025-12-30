/**
 * Order Management Admin Page
 * Comprehensive management of The Second Watch Order
 */
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  Building,
  Briefcase,
  BarChart3,
  FileText,
  Crown,
  Scale,
  Hammer,
  Heart,
} from 'lucide-react';
import { orderAPI } from '@/lib/api/order';

// Tab Components
import OrderApplicationsTab from '@/components/admin/OrderApplicationsTab';
import {
  OrderMembersTab,
  OrderLodgesTab,
  OrderGovernanceTab,
  OrderCraftHousesTab,
  OrderFellowshipsTab,
  OrderJobsTab,
  OrderStatsTab,
} from '@/components/admin/order';

const StatCard = ({ icon, title, value, delay }: { icon: React.ReactNode; title: string; value: string | number; delay: number }) => (
  <motion.div
    className="bg-charcoal-black border-2 border-muted-gray p-4 text-center transform hover:scale-105 transition-transform"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: delay * 0.1 }}
  >
    <div className="flex justify-center mb-2">{icon}</div>
    <h3 className="text-2xl font-heading text-accent-yellow">{value}</h3>
    <p className="text-muted-gray text-xs uppercase tracking-wide">{title}</p>
  </motion.div>
);

const OrderManagement = () => {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['orderAdminStats'],
    queryFn: () => orderAPI.getAdminStats(),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl md:text-5xl font-heading tracking-tighter">
          The <span className="text-accent-yellow">Order</span>
        </h1>
        <p className="text-muted-gray mt-1">Manage Second Watch Order members, lodges, governance, and more</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsLoading ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : (
          <>
            <StatCard icon={<Users className="h-8 w-8 text-accent-yellow" />} title="Members" value={stats?.total_members || 0} delay={0} />
            <StatCard icon={<Building className="h-8 w-8 text-accent-yellow" />} title="Lodges" value={stats?.total_lodges || 0} delay={1} />
            <StatCard icon={<FileText className="h-8 w-8 text-accent-yellow" />} title="Pending Apps" value={stats?.pending_applications || 0} delay={2} />
            <StatCard icon={<Briefcase className="h-8 w-8 text-accent-yellow" />} title="Active Jobs" value={stats?.active_jobs || 0} delay={3} />
          </>
        )}
      </div>

      <Tabs defaultValue="applications" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 bg-charcoal-black border border-muted-gray">
          <TabsTrigger value="applications" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Apps</span>
          </TabsTrigger>
          <TabsTrigger value="members" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Members</span>
          </TabsTrigger>
          <TabsTrigger value="lodges" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Building className="h-4 w-4" />
            <span className="hidden sm:inline">Lodges</span>
          </TabsTrigger>
          <TabsTrigger value="governance" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Scale className="h-4 w-4" />
            <span className="hidden sm:inline">Gov</span>
          </TabsTrigger>
          <TabsTrigger value="craft-houses" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Hammer className="h-4 w-4" />
            <span className="hidden sm:inline">Crafts</span>
          </TabsTrigger>
          <TabsTrigger value="fellowships" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Heart className="h-4 w-4" />
            <span className="hidden sm:inline">Fellows</span>
          </TabsTrigger>
          <TabsTrigger value="jobs" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Jobs</span>
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Stats</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="mt-6">
          <Card className="bg-charcoal-black border-2 border-muted-gray">
            <CardHeader>
              <CardTitle className="text-bone-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-accent-yellow" />
                Order Applications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OrderApplicationsTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <Card className="bg-charcoal-black border-2 border-muted-gray">
            <CardHeader>
              <CardTitle className="text-bone-white flex items-center gap-2">
                <Users className="h-5 w-5 text-accent-yellow" />
                Order Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OrderMembersTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lodges" className="mt-6">
          <Card className="bg-charcoal-black border-2 border-muted-gray">
            <CardHeader>
              <CardTitle className="text-bone-white flex items-center gap-2">
                <Building className="h-5 w-5 text-accent-yellow" />
                Lodges
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OrderLodgesTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="governance" className="mt-6">
          <OrderGovernanceTab />
        </TabsContent>

        <TabsContent value="craft-houses" className="mt-6">
          <Card className="bg-charcoal-black border-2 border-muted-gray">
            <CardHeader>
              <CardTitle className="text-bone-white flex items-center gap-2">
                <Hammer className="h-5 w-5 text-accent-yellow" />
                Craft Houses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OrderCraftHousesTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fellowships" className="mt-6">
          <Card className="bg-charcoal-black border-2 border-muted-gray">
            <CardHeader>
              <CardTitle className="text-bone-white flex items-center gap-2">
                <Heart className="h-5 w-5 text-accent-yellow" />
                Fellowships
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OrderFellowshipsTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jobs" className="mt-6">
          <Card className="bg-charcoal-black border-2 border-muted-gray">
            <CardHeader>
              <CardTitle className="text-bone-white flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-accent-yellow" />
                Job Postings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OrderJobsTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="mt-6">
          <OrderStatsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrderManagement;
