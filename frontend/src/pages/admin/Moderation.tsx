import React from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Flag, AlertTriangle, Radio, VolumeX, CheckCircle } from 'lucide-react';
import ReportsTab from '@/components/admin/moderation/ReportsTab';
import UserModerationTab from '@/components/admin/moderation/UserModerationTab';
import BroadcastsTab from '@/components/admin/moderation/BroadcastsTab';

const StatCard = ({ icon, title, value, variant, delay }: {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  variant?: 'warning' | 'danger';
  delay: number;
}) => (
  <motion.div
    className={`bg-charcoal-black border-2 p-4 text-center transform hover:scale-105 transition-transform ${
      variant === 'danger' ? 'border-primary-red' : variant === 'warning' ? 'border-orange-500' : 'border-muted-gray'
    }`}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: delay * 0.1 }}
  >
    <div className="flex justify-center mb-2">{icon}</div>
    <h3 className={`text-2xl font-heading ${
      variant === 'danger' ? 'text-primary-red' : variant === 'warning' ? 'text-orange-500' : 'text-accent-yellow'
    }`}>{value}</h3>
    <p className="text-muted-gray text-xs uppercase tracking-wide">{title}</p>
  </motion.div>
);

const Moderation = () => {
  const { data: reportStats } = useQuery({
    queryKey: ['report-stats'],
    queryFn: () => api.getReportStats(),
  });

  const { data: mutedUsers } = useQuery({
    queryKey: ['admin-active-mutes'],
    queryFn: () => api.listActiveMutes(),
  });

  const { data: broadcasts } = useQuery({
    queryKey: ['admin-broadcasts'],
    queryFn: () => api.listBroadcastsAdmin(),
  });

  const activeBroadcasts = broadcasts?.filter((b: any) => b.is_active)?.length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl md:text-5xl font-heading tracking-tighter">
          Content <span className="text-accent-yellow">Moderation</span>
        </h1>
        <p className="text-muted-gray mt-1">Manage reported content, user moderation, and platform broadcasts</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Flag className="h-8 w-8 text-primary-red" />}
          title="Pending Reports"
          value={reportStats?.pending || 0}
          variant="danger"
          delay={0}
        />
        <StatCard
          icon={<VolumeX className="h-8 w-8 text-orange-500" />}
          title="Muted Users"
          value={mutedUsers?.length || 0}
          variant="warning"
          delay={1}
        />
        <StatCard
          icon={<CheckCircle className="h-8 w-8 text-accent-yellow" />}
          title="Resolved Reports"
          value={reportStats?.resolved || 0}
          delay={2}
        />
        <StatCard
          icon={<Radio className="h-8 w-8 text-accent-yellow" />}
          title="Active Broadcasts"
          value={activeBroadcasts}
          delay={3}
        />
      </div>

      <Tabs defaultValue="reports" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-charcoal-black border border-muted-gray">
          <TabsTrigger value="reports" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Flag className="h-4 w-4" />
            <span className="hidden sm:inline">Reports</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <VolumeX className="h-4 w-4" />
            <span className="hidden sm:inline">User Actions</span>
          </TabsTrigger>
          <TabsTrigger value="broadcasts" className="flex items-center gap-2 data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Radio className="h-4 w-4" />
            <span className="hidden sm:inline">Broadcasts</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="mt-6">
          <ReportsTab />
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <UserModerationTab />
        </TabsContent>

        <TabsContent value="broadcasts" className="mt-6">
          <BroadcastsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Moderation;
