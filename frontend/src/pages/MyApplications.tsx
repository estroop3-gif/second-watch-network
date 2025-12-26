/**
 * My Applications Page - View all applications the user has submitted
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
import { Send, Film, Users, Inbox } from 'lucide-react';
import { useUnifiedMyApplications } from '@/hooks/applications';
import { UnifiedApplicationCard } from '@/components/applications';
import type { ApplicationStatus, ApplicationSource, UnifiedApplication } from '@/types/applications';
import { applicationStatusConfig } from '@/types/applications';

type SourceFilter = 'all' | 'backlot' | 'community';

const MyApplications = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const sourceFilter = (searchParams.get('source') as SourceFilter) || 'all';
  const statusFilter = (searchParams.get('status') as ApplicationStatus | 'all') || 'all';

  const { data: applications, isLoading, error } = useUnifiedMyApplications();

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
    if (!applications) return [];
    let filtered = applications;

    if (sourceFilter !== 'all') {
      filtered = filtered.filter((app) => app.source === sourceFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((app) => app.status === statusFilter);
    }

    return filtered;
  }, [applications, sourceFilter, statusFilter]);

  // Calculate counts
  const counts = useMemo(() => {
    if (!applications) return { all: 0, backlot: 0, community: 0 };
    return {
      all: applications.length,
      backlot: applications.filter((a) => a.source === 'backlot').length,
      community: applications.filter((a) => a.source === 'community').length,
    };
  }, [applications]);

  // Handle view details
  const handleViewDetails = (application: UnifiedApplication) => {
    // TODO: Open modal or navigate to detail page
    console.log('View details:', application);
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
          <Send className="w-8 h-8 text-accent-yellow" />
          <div>
            <h1 className="font-heading text-2xl text-bone-white">My Applications</h1>
            <p className="text-sm text-muted-gray">
              Track applications you've submitted for roles and collaboration opportunities
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
      </div>

      {/* Applications List */}
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
                : "You haven't submitted any applications yet."}
            </p>
            <p className="text-sm text-muted-gray mt-2">
              Browse the{' '}
              <a href="/filmmakers" className="text-accent-yellow hover:underline">
                Collaboration Board
              </a>{' '}
              to find opportunities.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredApplications.map((application) => (
            <UnifiedApplicationCard
              key={application.id}
              application={application}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MyApplications;
