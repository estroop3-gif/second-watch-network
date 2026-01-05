/**
 * AdminStatsWidget
 * Quick platform statistics for staff
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { WidgetSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import { BarChart3, Users, Film, FileText, ChevronRight } from 'lucide-react';
import type { SectionProps } from '@/components/dashboard/config/sectionRegistry';

export function AdminStatsWidget({ className = '' }: SectionProps) {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['admin-quick-stats'],
    queryFn: () => api.getAdminDashboardStats(),
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return <WidgetSkeleton className={className} />;
  }

  if (error) {
    return null;
  }

  const statItems = [
    {
      label: 'Users',
      value: stats?.total_users || 0,
      icon: Users,
      href: '/admin/users',
    },
    {
      label: 'Worlds',
      value: stats?.total_worlds || 0,
      icon: Film,
      href: '/admin/worlds',
    },
    {
      label: 'Submissions',
      value: stats?.pending_submissions || 0,
      icon: FileText,
      href: '/admin/submissions',
      highlight: (stats?.pending_submissions || 0) > 0,
    },
  ];

  return (
    <div className={`p-4 bg-charcoal-black border border-primary-red/30 rounded-lg ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary-red" />
          <h3 className="font-heading text-bone-white">Platform Stats</h3>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin">
            Admin Panel
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {statItems.map(({ label, value, icon: Icon, href, highlight }) => (
          <Link
            key={label}
            to={href}
            className={`p-3 rounded-lg text-center hover:bg-muted-gray/10 transition-colors ${
              highlight ? 'bg-primary-red/10' : 'bg-muted-gray/5'
            }`}
          >
            <Icon className={`w-5 h-5 mx-auto mb-1 ${highlight ? 'text-primary-red' : 'text-muted-gray'}`} />
            <span className={`text-xl font-heading block ${highlight ? 'text-primary-red' : 'text-bone-white'}`}>
              {value.toLocaleString()}
            </span>
            <span className="text-muted-gray text-xs">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default AdminStatsWidget;
