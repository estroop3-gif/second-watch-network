/**
 * CollabApplicationsView - Kanban board for managing collab applications
 */
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Users,
  Eye,
  Star,
  Calendar,
  ThumbsUp,
  Award,
  CheckCircle,
  XCircle,
  Loader2,
  LayoutGrid,
  List,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

import ApplicationCard from './ApplicationCard';
import ApplicationDetailModal from './ApplicationDetailModal';

import {
  useCollabApplications,
  useUpdateCollabApplicationStatus,
} from '@/hooks/applications';
import type { CollabApplication, ApplicationStatus } from '@/types/applications';
import type { CommunityCollab } from '@/types/community';

interface CollabApplicationsViewProps {
  collab: CommunityCollab;
  onBack: () => void;
}

// Kanban columns configuration
const kanbanColumns: {
  status: ApplicationStatus;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}[] = [
  { status: 'applied', label: 'Applied', icon: Users, color: 'text-blue-400', bgColor: 'bg-blue-600/20' },
  { status: 'viewed', label: 'Viewed', icon: Eye, color: 'text-purple-400', bgColor: 'bg-purple-600/20' },
  { status: 'shortlisted', label: 'Shortlisted', icon: Star, color: 'text-amber-400', bgColor: 'bg-amber-600/20' },
  { status: 'interview', label: 'Interview', icon: Calendar, color: 'text-cyan-400', bgColor: 'bg-cyan-600/20' },
  { status: 'offered', label: 'Offered', icon: ThumbsUp, color: 'text-green-400', bgColor: 'bg-green-600/20' },
  { status: 'booked', label: 'Booked', icon: Award, color: 'text-emerald-400', bgColor: 'bg-emerald-600/20' },
  { status: 'rejected', label: 'Rejected', icon: XCircle, color: 'text-red-400', bgColor: 'bg-red-600/20' },
];

const CollabApplicationsView: React.FC<CollabApplicationsViewProps> = ({
  collab,
  onBack,
}) => {
  const [selectedApplication, setSelectedApplication] = useState<CollabApplication | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Fetch applications
  const { data: applications, isLoading, error, refetch } = useCollabApplications(collab.id);
  const updateStatusMutation = useUpdateCollabApplicationStatus();

  // Group applications by status
  const applicationsByStatus = useMemo(() => {
    const grouped: Record<ApplicationStatus, CollabApplication[]> = {
      applied: [],
      viewed: [],
      shortlisted: [],
      interview: [],
      offered: [],
      booked: [],
      rejected: [],
      withdrawn: [],
    };

    applications?.forEach((app) => {
      if (grouped[app.status]) {
        grouped[app.status].push(app);
      }
    });

    // Sort each group: promoted first, then by date
    Object.keys(grouped).forEach((status) => {
      grouped[status as ApplicationStatus].sort((a, b) => {
        if (a.is_promoted && !b.is_promoted) return -1;
        if (!a.is_promoted && b.is_promoted) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    });

    return grouped;
  }, [applications]);

  // Handle opening application detail
  const handleOpenDetail = (application: CollabApplication) => {
    setSelectedApplication(application);
    setDetailModalOpen(true);

    // Auto-mark as viewed if still in applied status
    if (application.status === 'applied') {
      updateStatusMutation.mutate(
        {
          applicationId: application.id,
          input: { status: 'viewed' },
        },
        {
          onSuccess: () => refetch(),
        }
      );
    }
  };

  // Handle rating change from card
  const handleRatingChange = async (application: CollabApplication, rating: number | null) => {
    try {
      await updateStatusMutation.mutateAsync({
        applicationId: application.id,
        input: {
          status: application.status,
          rating: rating ?? undefined,
        },
      });
      refetch();
    } catch (error) {
      toast.error('Failed to update rating');
    }
  };

  // Stats
  const stats = useMemo(() => ({
    total: applications?.length || 0,
    applied: applicationsByStatus.applied.length,
    shortlisted: applicationsByStatus.shortlisted.length + applicationsByStatus.interview.length,
    offered: applicationsByStatus.offered.length,
    booked: applicationsByStatus.booked.length,
    rejected: applicationsByStatus.rejected.length,
  }), [applications, applicationsByStatus]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-accent-yellow" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-400">Failed to load applications</p>
        <Button onClick={() => refetch()} variant="outline" className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-muted-gray hover:text-bone-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-xl font-heading text-bone-white">Applications</h2>
            <p className="text-sm text-muted-gray">{collab.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center border border-muted-gray/30 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('kanban')}
              className={cn(
                'p-1.5 rounded transition-colors',
                viewMode === 'kanban'
                  ? 'bg-accent-yellow text-charcoal-black'
                  : 'text-muted-gray hover:text-bone-white'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-1.5 rounded transition-colors',
                viewMode === 'list'
                  ? 'bg-accent-yellow text-charcoal-black'
                  : 'text-muted-gray hover:text-bone-white'
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex flex-wrap gap-3">
        <Badge variant="outline" className="border-muted-gray/30 text-muted-gray">
          <Users className="w-3 h-3 mr-1" />
          {stats.total} Total
        </Badge>
        <Badge variant="outline" className="border-blue-400/30 text-blue-400">
          {stats.applied} New
        </Badge>
        <Badge variant="outline" className="border-amber-400/30 text-amber-400">
          <Star className="w-3 h-3 mr-1" />
          {stats.shortlisted} Shortlisted
        </Badge>
        <Badge variant="outline" className="border-green-400/30 text-green-400">
          <ThumbsUp className="w-3 h-3 mr-1" />
          {stats.offered} Offered
        </Badge>
        <Badge variant="outline" className="border-emerald-400/30 text-emerald-400">
          <CheckCircle className="w-3 h-3 mr-1" />
          {stats.booked} Booked
        </Badge>
      </div>

      {/* Empty State */}
      {stats.total === 0 && (
        <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-12 text-center">
          <Users className="w-12 h-12 text-muted-gray mx-auto mb-4" />
          <h3 className="text-lg font-medium text-bone-white mb-2">No applications yet</h3>
          <p className="text-muted-gray">
            When people apply to your collab, they'll appear here.
          </p>
        </div>
      )}

      {/* Kanban Board */}
      {stats.total > 0 && viewMode === 'kanban' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {kanbanColumns.map((column) => {
              const columnApps = applicationsByStatus[column.status];
              const ColumnIcon = column.icon;

              return (
                <div
                  key={column.status}
                  className="w-72 flex-shrink-0"
                >
                  {/* Column Header */}
                  <div className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-t-lg',
                    column.bgColor
                  )}>
                    <ColumnIcon className={cn('w-4 h-4', column.color)} />
                    <span className={cn('font-medium text-sm', column.color)}>
                      {column.label}
                    </span>
                    <Badge variant="outline" className={cn('ml-auto text-xs', column.color)}>
                      {columnApps.length}
                    </Badge>
                  </div>

                  {/* Column Content */}
                  <div className="bg-charcoal-black/30 border border-muted-gray/20 rounded-b-lg p-2 min-h-[400px] space-y-2">
                    {columnApps.map((app) => (
                      <ApplicationCard
                        key={app.id}
                        application={app}
                        onClick={() => handleOpenDetail(app)}
                        onRatingChange={(rating) => handleRatingChange(app, rating)}
                      />
                    ))}

                    {columnApps.length === 0 && (
                      <div className="flex items-center justify-center h-24 text-xs text-muted-gray/50">
                        No applications
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {stats.total > 0 && viewMode === 'list' && (
        <div className="space-y-4">
          {kanbanColumns.map((column) => {
            const columnApps = applicationsByStatus[column.status];
            if (columnApps.length === 0) return null;

            const ColumnIcon = column.icon;

            return (
              <div key={column.status}>
                <div className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg mb-2',
                  column.bgColor
                )}>
                  <ColumnIcon className={cn('w-4 h-4', column.color)} />
                  <span className={cn('font-medium text-sm', column.color)}>
                    {column.label}
                  </span>
                  <Badge variant="outline" className={cn('ml-2 text-xs', column.color)}>
                    {columnApps.length}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {columnApps.map((app) => (
                    <ApplicationCard
                      key={app.id}
                      application={app}
                      onClick={() => handleOpenDetail(app)}
                      onRatingChange={(rating) => handleRatingChange(app, rating)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Application Detail Modal */}
      <ApplicationDetailModal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedApplication(null);
        }}
        application={selectedApplication}
        onStatusUpdate={refetch}
      />
    </div>
  );
};

export default CollabApplicationsView;
