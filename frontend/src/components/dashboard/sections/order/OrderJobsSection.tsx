/**
 * OrderJobsSection
 * Shows available production jobs for Order members
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WidgetSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import { Briefcase, MapPin, Clock, ChevronRight } from 'lucide-react';
import type { SectionProps } from '@/components/dashboard/config/sectionRegistry';

export function OrderJobsSection({ className = '' }: SectionProps) {
  const { data: jobs, isLoading, error } = useQuery({
    queryKey: ['order-jobs-preview'],
    queryFn: async () => {
      // This would fetch from the Order jobs endpoint
      // For now, return empty to show the placeholder state
      return [];
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return <WidgetSkeleton className={className} />;
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-muted-gray" />
          <h3 className="font-heading text-bone-white">Job Board</h3>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/order/jobs">
            View All
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>

      {!jobs || jobs.length === 0 ? (
        <div className="border border-dashed border-muted-gray/30 rounded-lg p-6 text-center">
          <Briefcase className="w-8 h-8 mx-auto text-muted-gray mb-2" />
          <p className="text-muted-gray text-sm">No open positions right now</p>
          <p className="text-muted-gray/60 text-xs mt-1">Check back soon for new opportunities</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(jobs as any[]).slice(0, 3).map((job: any) => (
            <Link
              key={job.id}
              to={`/order/jobs/${job.id}`}
              className="block p-3 bg-charcoal-black border border-muted-gray/20 rounded-lg hover:border-accent-yellow/50 transition-colors group"
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-bone-white group-hover:text-accent-yellow transition-colors text-sm">
                  {job.title}
                </h4>
                <Badge variant="outline" className="text-xs">
                  {job.department}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-muted-gray text-xs">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {job.location || 'Remote'}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {job.type || 'Contract'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default OrderJobsSection;
