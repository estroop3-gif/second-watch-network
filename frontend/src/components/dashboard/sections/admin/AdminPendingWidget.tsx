/**
 * AdminPendingWidget
 * Shows items awaiting review/approval
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WidgetSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import { AlertCircle, FileText, Users, Film, ChevronRight } from 'lucide-react';
import type { SectionProps } from '@/components/dashboard/config/sectionRegistry';

export function AdminPendingWidget({ className = '' }: SectionProps) {
  const { data: submissionStats, isLoading: loadingSubmissions } = useQuery({
    queryKey: ['admin-submission-stats'],
    queryFn: () => api.getSubmissionStats(),
    staleTime: 2 * 60 * 1000,
  });

  if (loadingSubmissions) {
    return <WidgetSkeleton className={className} />;
  }

  const pendingItems = [
    {
      label: 'Submissions',
      count: submissionStats?.new_this_week || 0,
      icon: FileText,
      href: '/admin/submissions?status=pending',
    },
    {
      label: 'Green Room',
      count: submissionStats?.greenroom_pending || 0,
      icon: Film,
      href: '/admin/greenroom',
    },
    {
      label: 'Connection Requests',
      count: 0, // Would come from separate endpoint
      icon: Users,
      href: '/admin/connections',
    },
  ];

  const totalPending = pendingItems.reduce((sum, item) => sum + item.count, 0);

  if (totalPending === 0) {
    return null; // Don't show if nothing pending
  }

  return (
    <div className={`p-4 bg-charcoal-black border border-primary-red/30 rounded-lg ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-primary-red" />
          <h3 className="font-heading text-bone-white">Pending Review</h3>
          <Badge variant="default" className="bg-primary-red text-white text-xs">
            {totalPending}
          </Badge>
        </div>
      </div>

      <div className="space-y-2">
        {pendingItems.filter(item => item.count > 0).map(({ label, count, icon: Icon, href }) => (
          <Link
            key={label}
            to={href}
            className="flex items-center justify-between p-3 bg-primary-red/5 rounded-lg hover:bg-primary-red/10 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Icon className="w-4 h-4 text-primary-red" />
              <span className="text-bone-white text-sm">{label}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-primary-red/30 text-primary-red">
                {count}
              </Badge>
              <ChevronRight className="w-4 h-4 text-muted-gray group-hover:text-primary-red transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default AdminPendingWidget;
