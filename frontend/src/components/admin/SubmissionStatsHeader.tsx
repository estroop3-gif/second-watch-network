import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { FileText, Clock, CheckCircle, XCircle, Sparkles, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: number;
  variant?: 'default' | 'warning' | 'success' | 'danger';
  delay: number;
}

const StatCard = ({ icon, title, value, variant = 'default', delay }: StatCardProps) => {
  const borderColor = variant === 'danger'
    ? 'border-primary-red'
    : variant === 'warning'
    ? 'border-orange-500'
    : variant === 'success'
    ? 'border-green-500'
    : 'border-muted-gray';

  const valueColor = variant === 'danger'
    ? 'text-primary-red'
    : variant === 'warning'
    ? 'text-orange-500'
    : variant === 'success'
    ? 'text-green-500'
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

export const SubmissionStatsHeader = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-submission-stats'],
    queryFn: () => api.getSubmissionStats(),
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

  const totalSubmissions = (stats?.total_content || 0) + (stats?.total_greenroom || 0);
  const totalPending = (stats?.content_pending || 0) + (stats?.greenroom_pending || 0);
  const totalApproved = (stats?.content_approved || 0) + (stats?.greenroom_approved || 0);
  const totalRejected = (stats?.content_rejected || 0) + (stats?.greenroom_rejected || 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <StatCard
        icon={<FileText className="h-8 w-8 text-accent-yellow" />}
        title="Total Submissions"
        value={totalSubmissions}
        delay={0}
      />
      <StatCard
        icon={<Clock className="h-8 w-8 text-orange-500" />}
        title="Pending Review"
        value={totalPending}
        variant="warning"
        delay={1}
      />
      <StatCard
        icon={<Sparkles className="h-8 w-8 text-blue-400" />}
        title="In Review"
        value={stats?.content_in_review || 0}
        delay={2}
      />
      <StatCard
        icon={<CheckCircle className="h-8 w-8 text-green-500" />}
        title="Approved"
        value={totalApproved}
        variant="success"
        delay={3}
      />
      <StatCard
        icon={<XCircle className="h-8 w-8 text-primary-red" />}
        title="Rejected"
        value={totalRejected}
        variant="danger"
        delay={4}
      />
      <StatCard
        icon={<TrendingUp className="h-8 w-8 text-accent-yellow" />}
        title="New This Week"
        value={stats?.new_this_week || 0}
        delay={5}
      />
    </div>
  );
};

export default SubmissionStatsHeader;
