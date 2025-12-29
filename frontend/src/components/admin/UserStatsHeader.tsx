import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, UserPlus, Film, Shield, Crown, Ban } from 'lucide-react';
import { api } from '@/lib/api';

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: number;
  variant?: 'default' | 'warning' | 'danger';
  delay: number;
}

const StatCard = ({ icon, title, value, variant = 'default', delay }: StatCardProps) => {
  const borderColor = variant === 'danger'
    ? 'border-primary-red'
    : variant === 'warning'
    ? 'border-orange-500'
    : 'border-muted-gray';

  const valueColor = variant === 'danger'
    ? 'text-primary-red'
    : variant === 'warning'
    ? 'text-orange-500'
    : 'text-accent-yellow';

  return (
    <motion.div
      className={`bg-charcoal-black border-2 ${borderColor} p-4 text-center transform hover:scale-105 transition-transform`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.1 }}
    >
      <div className="flex justify-center mb-2">{icon}</div>
      <h3 className={`text-2xl font-heading ${valueColor}`}>{value.toLocaleString()}</h3>
      <p className="text-muted-gray text-xs uppercase tracking-wide">{title}</p>
    </motion.div>
  );
};

export const UserStatsHeader = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-user-stats'],
    queryFn: () => api.getUserStats(),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-charcoal-black border-2 border-muted-gray p-4 animate-pulse">
            <div className="h-8 w-8 bg-muted-gray/30 rounded mx-auto mb-2" />
            <div className="h-6 w-12 bg-muted-gray/30 rounded mx-auto mb-1" />
            <div className="h-3 w-16 bg-muted-gray/30 rounded mx-auto" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <StatCard
        icon={<Users className="h-8 w-8 text-accent-yellow" />}
        title="Total Users"
        value={stats?.total_users || 0}
        delay={0}
      />
      <StatCard
        icon={<UserPlus className="h-8 w-8 text-accent-yellow" />}
        title="New This Week"
        value={stats?.new_this_week || 0}
        delay={1}
      />
      <StatCard
        icon={<Film className="h-8 w-8 text-accent-yellow" />}
        title="Filmmakers"
        value={stats?.active_filmmakers || 0}
        delay={2}
      />
      <StatCard
        icon={<Shield className="h-8 w-8 text-accent-yellow" />}
        title="Order Members"
        value={stats?.order_members || 0}
        delay={3}
      />
      <StatCard
        icon={<Crown className="h-8 w-8 text-accent-yellow" />}
        title="Premium"
        value={stats?.premium_subscribers || 0}
        delay={4}
      />
      <StatCard
        icon={<Ban className="h-8 w-8 text-primary-red" />}
        title="Banned"
        value={stats?.banned_users || 0}
        variant="danger"
        delay={5}
      />
    </div>
  );
};

export default UserStatsHeader;
