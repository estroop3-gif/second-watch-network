/**
 * CreatorSubmissionsSection
 * Shows the filmmaker's submissions status
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WidgetSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import { Upload, Clock, CheckCircle, XCircle, MessageSquare } from 'lucide-react';
import type { SectionProps } from '@/components/dashboard/config/sectionRegistry';

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: 'Pending', icon: Clock, className: 'bg-muted-gray/20 text-muted-gray' },
  under_review: { label: 'Under Review', icon: Clock, className: 'bg-blue-500/20 text-blue-400' },
  approved: { label: 'Approved', icon: CheckCircle, className: 'bg-green-500/20 text-green-400' },
  rejected: { label: 'Not Selected', icon: XCircle, className: 'bg-red-500/20 text-red-400' },
  greenroom: { label: 'In Green Room', icon: MessageSquare, className: 'bg-accent-yellow/20 text-accent-yellow' },
};

export function CreatorSubmissionsSection({ className = '' }: SectionProps) {
  const { data: submissions, isLoading, error } = useQuery({
    queryKey: ['my-submissions'],
    queryFn: () => api.getMySubmissions(),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return <WidgetSkeleton className={className} />;
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-xl text-bone-white">Submissions</h2>
        <Button variant="outline" size="sm" asChild>
          <Link to="/submit">
            <Upload className="w-4 h-4 mr-2" />
            New Submission
          </Link>
        </Button>
      </div>

      {error ? (
        <p className="text-muted-gray text-sm">Could not load submissions</p>
      ) : !submissions || submissions.length === 0 ? (
        <div className="border border-dashed border-muted-gray/30 rounded-lg p-6 text-center">
          <Upload className="w-10 h-10 mx-auto text-muted-gray mb-3" />
          <p className="text-muted-gray text-sm mb-3">No submissions yet</p>
          <Button size="sm" asChild>
            <Link to="/submit">Submit Your Work</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.slice(0, 3).map((submission: any) => {
            const statusConfig = STATUS_CONFIG[submission.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConfig.icon;

            return (
              <Link
                key={submission.id}
                to={`/submissions/${submission.id}`}
                className="group flex items-center justify-between p-3 bg-charcoal-black border border-muted-gray/20 rounded-lg hover:border-accent-yellow/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-bone-white group-hover:text-accent-yellow transition-colors line-clamp-1 text-sm">
                    {submission.title}
                  </h3>
                  <p className="text-muted-gray text-xs">
                    {submission.format || 'Film'} &middot;{' '}
                    {new Date(submission.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="outline" className={`ml-3 ${statusConfig.className}`}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {statusConfig.label}
                </Badge>
              </Link>
            );
          })}
        </div>
      )}

      {submissions && submissions.length > 3 && (
        <div className="mt-3 text-center">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/my-submissions">View All ({submissions.length})</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export default CreatorSubmissionsSection;
