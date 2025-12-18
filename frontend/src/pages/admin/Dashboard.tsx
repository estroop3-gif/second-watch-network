import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Users, FileText, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import NewlyAvailableFilmmakers from '@/components/admin/NewlyAvailableFilmmakers';
import AdminNotificationsFeed from '@/components/admin/AdminNotificationsFeed';

const StatCard = ({ icon, title, value, linkTo, delay }: { icon: React.ReactNode, title: string, value: string | number, linkTo: string, delay: number }) => (
  <Link to={linkTo}>
    <motion.div
      className="bg-charcoal-black border-2 border-muted-gray p-6 text-center transform -rotate-2 hover:rotate-[-3deg] hover:scale-105 transition-transform"
      initial={{ opacity: 0, y: 50, rotate: -10 }}
      whileInView={{ opacity: 1, y: 0, rotate: (delay * 15 - 5) }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ type: 'spring', stiffness: 120, delay }}
    >
      <div className="flex justify-center mb-4">{icon}</div>
      <h3 className="text-4xl font-heading text-accent-yellow">{value}</h3>
      <p className="text-muted-gray font-sans normal-case uppercase">{title}</p>
    </motion.div>
  </Link>
);

const StatCardSkeleton = ({ delay }: { delay: number }) => (
    <motion.div
      className="bg-charcoal-black border-2 border-muted-gray p-6 text-center transform -rotate-2"
      initial={{ opacity: 0, y: 50, rotate: -10 }}
      whileInView={{ opacity: 1, y: 0, rotate: (delay * 15 - 5) }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ type: 'spring', stiffness: 120, delay }}
    >
        <div className="flex justify-center mb-4">
            <Skeleton className="w-12 h-12 rounded-full" />
        </div>
        <Skeleton className="h-10 w-1/4 mx-auto mb-2" />
        <Skeleton className="h-4 w-3/4 mx-auto" />
    </motion.div>
);

const AdminDashboard = () => {
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['adminDashboardStats'],
    queryFn: () => api.getAdminDashboardStats(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: newlyAvailable } = useQuery({
    queryKey: ['newlyAvailableFilmmakers'],
    queryFn: () => api.getNewlyAvailableFilmmakers(48),
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = statsLoading;
  const error = statsError;

  return (
    <div>
      <h1 className="text-4xl md:text-6xl font-heading tracking-tighter mb-12 -rotate-1">
        Admin <span className="font-spray text-accent-yellow">Dashboard</span>
      </h1>
      <div className="grid md:grid-cols-3 gap-8">
        {isLoading ? (
          <>
            <StatCardSkeleton delay={0} />
            <StatCardSkeleton delay={0.2} />
            <StatCardSkeleton delay={0.4} />
          </>
        ) : error ? (
            <div className="md:col-span-3 text-center text-red-500 p-8 border-2 border-dashed border-red-500/50 transform -rotate-1">
                <h2 className="text-2xl font-heading">Could not load dashboard stats.</h2>
                <p className="text-muted-gray">Please try refreshing the page.</p>
            </div>
        ) : (
          <>
            <StatCard
              icon={<FileText className="w-12 h-12 text-accent-yellow" />}
              title="Pending Submissions"
              value={stats?.pending_submissions ?? 0}
              linkTo="/admin/submissions?status=pending"
              delay={0}
            />
            <StatCard
              icon={<Users className="w-12 h-12 text-accent-yellow" />}
              title="Total Users"
              value={stats?.total_users ?? 0}
              linkTo="/admin/users"
              delay={0.2}
            />
            <StatCard
              icon={<AlertCircle className="w-12 h-12 text-accent-yellow" />}
              title="Open Reports"
              value={0}
              linkTo="#"
              delay={0.4}
            />
          </>
        )}
      </div>
      <div className="mt-16 p-8 border-2 border-dashed border-muted-gray transform -rotate-1">
        <h2 className="text-3xl font-heading mb-4">Quick Links</h2>
        <div className="flex flex-wrap gap-4">
            <Link to="/admin/submissions" className="text-accent-yellow hover:underline font-bold">Review Submissions</Link>
            <Link to="/admin/users" className="text-accent-yellow hover:underline font-bold">Manage Users</Link>
            <Link to="#" className="text-muted-gray cursor-not-allowed">Update Homepage</Link>
        </div>
      </div>
      <div className="mt-16">
        <AdminNotificationsFeed />
      </div>
      <NewlyAvailableFilmmakers filmmakers={newlyAvailable} />
    </div>
  );
};

export default AdminDashboard;
