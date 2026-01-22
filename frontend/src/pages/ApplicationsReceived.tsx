/**
 * Applications Received Page - View all applications received for user's posts
 */
import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Inbox, ChevronDown, ChevronRight, Film, Users } from 'lucide-react';
import { useUnifiedApplicationsReceived, useUpdateCollabApplicationStatus, useUpdateRoleApplicationStatus } from '@/hooks/applications';
import { ApplicationsReceivedCard, ApplicationDetailModal } from '@/components/applications';
import type { ApplicationStatus, ApplicationReceivedItem, ApplicationGroup, CollabApplication, RoleApplication } from '@/types/applications';
import { applicationStatusConfig } from '@/types/applications';
import { toast } from 'sonner';

type SourceFilter = 'all' | 'backlot' | 'community';
type ViewMode = 'list' | 'grouped';

const ApplicationsReceived = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const sourceFilter = (searchParams.get('source') as SourceFilter) || 'all';
  const statusFilter = (searchParams.get('status') as ApplicationStatus | 'all') || 'all';
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedApplication, setSelectedApplication] = useState<ApplicationReceivedItem | null>(null);

  const { data, isLoading, error, refetch } = useUnifiedApplicationsReceived();
  const updateCollabStatusMutation = useUpdateCollabApplicationStatus();
  const updateRoleStatusMutation = useUpdateRoleApplicationStatus();

  const handleSourceChange = (value: SourceFilter) => {
    const params = new URLSearchParams(searchParams);
    if (value === 'all') {
      params.delete('source');
    } else {
      params.set('source', value);
    }
    setSearchParams(params);
  };

  const handleStatusChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === 'all') {
      params.delete('status');
    } else {
      params.set('status', value);
    }
    setSearchParams(params);
  };

  // Filter applications
  const filteredApplications = useMemo(() => {
    if (!data?.applications) return [];
    let filtered = data.applications;

    if (sourceFilter !== 'all') {
      filtered = filtered.filter((app) => app.source === sourceFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((app) => app.status === statusFilter);
    }

    return filtered;
  }, [data?.applications, sourceFilter, statusFilter]);

  // Filter groups
  const filteredGroups = useMemo(() => {
    if (!data?.groups) return [];
    let groups = data.groups;

    if (sourceFilter !== 'all') {
      groups = groups.filter((g) => g.source === sourceFilter);
    }

    if (statusFilter !== 'all') {
      groups = groups.map((g) => ({
        ...g,
        applications: g.applications.filter((a) => a.status === statusFilter),
      })).filter((g) => g.applications.length > 0);
    }

    return groups;
  }, [data?.groups, sourceFilter, statusFilter]);

  // Calculate counts
  const counts = useMemo(() => {
    if (!data?.applications) return { all: 0, backlot: 0, community: 0 };
    return {
      all: data.applications.length,
      backlot: data.applications.filter((a) => a.source === 'backlot').length,
      community: data.applications.filter((a) => a.source === 'community').length,
    };
  }, [data?.applications]);

  // Toggle group expansion
  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  // Handle view details
  const handleViewDetails = (application: ApplicationReceivedItem) => {
    setSelectedApplication(application);
  };

  // Handle modal close
  const handleCloseModal = () => {
    setSelectedApplication(null);
  };

  // Handle shortlist
  const handleShortlist = async (application: ApplicationReceivedItem) => {
    try {
      if (application.source === 'community') {
        await updateCollabStatusMutation.mutateAsync({
          applicationId: application.id,
          input: { status: 'shortlisted' },
        });
      } else {
        await updateRoleStatusMutation.mutateAsync({
          applicationId: application.id,
          input: { status: 'shortlisted' },
        });
      }
      toast.success('Application shortlisted');
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update status');
    }
  };

  // Handle reject
  const handleReject = async (application: ApplicationReceivedItem) => {
    try {
      if (application.source === 'community') {
        await updateCollabStatusMutation.mutateAsync({
          applicationId: application.id,
          input: { status: 'rejected' },
        });
      } else {
        await updateRoleStatusMutation.mutateAsync({
          applicationId: application.id,
          input: { status: 'rejected' },
        });
      }
      toast.success('Application rejected');
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update status');
    }
  };

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="bg-charcoal-black/50 border-red-500/30">
          <CardContent className="pt-6">
            <p className="text-red-400">Failed to load applications. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Inbox className="w-8 h-8 text-accent-yellow" />
          <div>
            <h1 className="font-heading text-2xl text-bone-white">Applications Received</h1>
            <p className="text-sm text-muted-gray">
              Review applications for roles and collaborations you've posted
            </p>
          </div>
        </div>
        <Badge className="bg-accent-yellow text-charcoal-black font-bold px-3 py-1">
          {counts.all} Total
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Source Tabs */}
        <Tabs value={sourceFilter} onValueChange={(v) => handleSourceChange(v as SourceFilter)}>
          <TabsList className="bg-charcoal-black/50">
            <TabsTrigger value="all" className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
              All ({counts.all})
            </TabsTrigger>
            <TabsTrigger value="backlot" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              <Film className="w-3 h-3 mr-1" />
              Backlot ({counts.backlot})
            </TabsTrigger>
            <TabsTrigger value="community" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Users className="w-3 h-3 mr-1" />
              Community ({counts.community})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[180px] bg-charcoal-black/50 border-muted-gray/30">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent className="bg-charcoal-black border-muted-gray/30">
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(applicationStatusConfig).map(([status, config]) => (
              <SelectItem key={status} value={status}>
                <span className={config.color}>{config.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View Mode Toggle */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="ml-auto">
          <TabsList className="bg-charcoal-black/50">
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="grouped">Grouped</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Applications */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 bg-charcoal-black/50" />
          ))}
        </div>
      ) : filteredApplications.length === 0 ? (
        <Card className="bg-charcoal-black/50 border-muted-gray/20">
          <CardContent className="pt-6 text-center py-12">
            <Inbox className="w-12 h-12 text-muted-gray mx-auto mb-4" />
            <p className="text-muted-gray">
              {sourceFilter !== 'all' || statusFilter !== 'all'
                ? 'No applications match your filters.'
                : "You haven't received any applications yet."}
            </p>
            <p className="text-sm text-muted-gray mt-2">
              Post a role or collaboration opportunity to start receiving applications.
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'list' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredApplications.map((application) => (
            <ApplicationsReceivedCard
              key={application.id}
              application={application}
              onViewDetails={handleViewDetails}
              onShortlist={handleShortlist}
              onReject={handleReject}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group) => (
            <Collapsible
              key={`${group.source}-${group.id}`}
              open={expandedGroups.has(group.id)}
              onOpenChange={() => toggleGroup(group.id)}
            >
              <Card className="bg-charcoal-black/50 border-muted-gray/20">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted-gray/5 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {expandedGroups.has(group.id) ? (
                          <ChevronDown className="w-5 h-5 text-muted-gray" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-muted-gray" />
                        )}
                        <Badge
                          className={
                            group.source === 'backlot'
                              ? 'bg-purple-600 text-white'
                              : 'bg-blue-600 text-white'
                          }
                        >
                          {group.source === 'backlot' ? (
                            <Film className="w-3 h-3 mr-1" />
                          ) : (
                            <Users className="w-3 h-3 mr-1" />
                          )}
                          {group.source === 'backlot' ? 'Backlot' : 'Community'}
                        </Badge>
                        <CardTitle className="text-lg text-bone-white">{group.name}</CardTitle>
                      </div>
                      <Badge variant="outline" className="border-muted-gray/30">
                        {group.applications.length} application
                        {group.applications.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {group.applications.map((application) => (
                        <ApplicationsReceivedCard
                          key={application.id}
                          application={application}
                          onViewDetails={handleViewDetails}
                          onShortlist={handleShortlist}
                          onReject={handleReject}
                        />
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}

      {/* Application Detail Modal */}
      <ApplicationDetailModal
        isOpen={!!selectedApplication}
        onClose={handleCloseModal}
        application={selectedApplication?.original || null}
        source={selectedApplication?.source}
        onStatusUpdate={() => {
          refetch();
          handleCloseModal();
        }}
      />
    </div>
  );
};

export default ApplicationsReceived;
