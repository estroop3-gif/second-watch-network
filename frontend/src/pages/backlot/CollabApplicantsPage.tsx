/**
 * CollabApplicantsPage - Dedicated page for viewing applicants for a community collab posting
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  useCollabApplications,
  useUpdateCollabApplicationStatus,
  useProject,
} from '@/hooks/backlot';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { CommunityCollab } from '@/types/community';
import {
  ArrowLeft,
  Users,
  Loader2,
  MapPin,
  DollarSign,
  Calendar,
  Globe,
  Star,
  LayoutGrid,
  List,
  ArrowUpDown,
} from 'lucide-react';
import { ApplicantScore, ApplicantScoreInline } from '@/components/backlot/applicants';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';

type SortOption = 'score' | 'date' | 'name';

export default function CollabApplicantsPage() {
  const { projectId, collabId } = useParams<{ projectId: string; collabId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<'board' | 'list'>('list');
  const [sortBy, setSortBy] = useState<SortOption>('score');

  // Navigate to applicant detail page
  const handleApplicantClick = (applicationId: string) => {
    navigate(`/backlot/projects/${projectId}/postings/${collabId}/applicants/${applicationId}`);
  };

  // Fetch project info
  const { data: project } = useProject(projectId);

  // Fetch the collab details
  const { data: collab, isLoading: collabLoading } = useQuery({
    queryKey: ['collab', collabId],
    queryFn: async () => {
      const response = await api.get<CommunityCollab>(`/api/v1/community/collabs/${collabId}`);
      return response;
    },
    enabled: !!collabId,
  });

  // Fetch applications
  const { data: applications, isLoading: applicationsLoading } = useCollabApplications(collabId);
  const updateStatus = useUpdateCollabApplicationStatus(collabId || '');

  const statusColumns = [
    { id: 'applied', label: 'Applied', color: 'bg-muted-gray/20' },
    { id: 'viewed', label: 'Viewed', color: 'bg-blue-500/20' },
    { id: 'shortlisted', label: 'Shortlisted', color: 'bg-yellow-500/20' },
    { id: 'interview', label: 'Interview', color: 'bg-purple-500/20' },
    { id: 'offered', label: 'Offered', color: 'bg-green-500/20' },
    { id: 'booked', label: 'Booked', color: 'bg-green-600/20' },
    { id: 'rejected', label: 'Rejected', color: 'bg-red-500/20' },
  ];

  const handleStatusChange = async (applicationId: string, newStatus: string) => {
    try {
      await updateStatus.mutateAsync({ applicationId, status: newStatus });
      toast({
        title: 'Status updated',
        description: `Application moved to ${newStatus}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  // Sort applications based on sortBy
  const sortedApplications = [...(applications || [])].sort((a: any, b: any) => {
    // Promoted always first
    if (a.is_promoted !== b.is_promoted) {
      return a.is_promoted ? -1 : 1;
    }

    switch (sortBy) {
      case 'score':
        // Higher score first, nulls last
        const scoreA = a.match_score ?? -1;
        const scoreB = b.match_score ?? -1;
        return scoreB - scoreA;
      case 'name':
        const nameA = (a.current_profile?.display_name || a.current_profile?.full_name || a.current_profile?.username || 'zzz').toLowerCase();
        const nameB = (b.current_profile?.display_name || b.current_profile?.full_name || b.current_profile?.username || 'zzz').toLowerCase();
        return nameA.localeCompare(nameB);
      case 'date':
      default:
        // Newest first
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  // Group sorted applications by status (for board view)
  const applicationsByStatus = statusColumns.reduce((acc, col) => {
    acc[col.id] = sortedApplications.filter((app: any) => app.status === col.id);
    return acc;
  }, {} as Record<string, any[]>);

  const isLoading = collabLoading || applicationsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-yellow" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal-black">
      {/* Header */}
      <div className="border-b border-muted-gray/30 bg-charcoal-black/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/backlot/projects/${projectId}`)}
              className="text-muted-gray hover:text-bone-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-accent-yellow" />
                <h1 className="text-xl font-bold text-bone-white">{collab?.title}</h1>
              </div>
              <p className="text-sm text-muted-gray">
                {project?.title} &bull; Community Posting Applicants
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Sort Selector */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-32 h-9">
                  <ArrowUpDown className="w-4 h-4 mr-1" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">Match Score</SelectItem>
                  <SelectItem value="date">Date Applied</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>
              {/* View Mode Toggle */}
              <div className="flex items-center border border-muted-gray/30 rounded-md">
                <Button
                  variant={viewMode === 'board' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('board')}
                  className="rounded-r-none"
                >
                  <LayoutGrid className="w-4 h-4 mr-1" />
                  Board
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  <List className="w-4 h-4 mr-1" />
                  List
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={() => navigate(`/backlot/projects/${projectId}`)}
              >
                Back to Project
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Full Job Posting Details */}
        {collab && (
          <Card className="bg-charcoal-black border-muted-gray/30 mb-6">
            <CardContent className="p-6">
              {/* Header with title and badges */}
              <div className="mb-4">
                <h2 className="text-xl font-bold text-bone-white mb-2">{collab.title}</h2>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-sm capitalize">
                    {collab.type?.replace(/_/g, ' ')}
                  </Badge>
                  {collab.job_type && (
                    <Badge variant="secondary" className="capitalize">{collab.job_type.replace('_', ' ')}</Badge>
                  )}
                  {collab.is_remote && <Badge variant="secondary">Remote</Badge>}
                  {collab.compensation_type && (
                    <Badge variant="secondary" className="capitalize">{collab.compensation_type}</Badge>
                  )}
                  {collab.is_order_only && (
                    <Badge className="bg-accent-yellow text-charcoal-black">Order Only</Badge>
                  )}
                  {collab.is_featured && (
                    <Badge className="bg-primary-red text-bone-white">Featured</Badge>
                  )}
                  <Badge variant={collab.is_active ? 'default' : 'secondary'}>
                    {collab.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>

              {/* Production Info */}
              {(collab.production_title || collab.company) && !collab.hide_production_info && (
                <div className="mb-4 p-3 bg-muted-gray/10 rounded-lg">
                  <h4 className="text-xs font-medium text-muted-gray mb-1">Production</h4>
                  <p className="text-sm text-bone-white font-medium">
                    {collab.production_title}
                    {collab.company && <span className="text-muted-gray"> • {collab.company}</span>}
                  </p>
                  {collab.production_type && (
                    <p className="text-xs text-muted-gray capitalize">{collab.production_type.replace('_', ' ')}</p>
                  )}
                </div>
              )}

              {/* Description */}
              {collab.description && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-muted-gray mb-2">Description</h4>
                  <p className="text-sm text-bone-white whitespace-pre-wrap">
                    {collab.description}
                  </p>
                </div>
              )}

              {/* Key Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {collab.location && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-gray mb-1">Location</h4>
                    <p className="text-sm text-bone-white flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-muted-gray" />
                      {collab.location}
                    </p>
                  </div>
                )}
                {collab.start_date && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-gray mb-1">Dates</h4>
                    <p className="text-sm text-bone-white flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-muted-gray" />
                      {format(parseLocalDate(collab.start_date), 'MMM d, yyyy')}
                      {collab.end_date && ` - ${format(parseLocalDate(collab.end_date), 'MMM d, yyyy')}`}
                    </p>
                  </div>
                )}
                {/* Compensation - Day Rate or Salary */}
                {(collab.day_rate_min || collab.day_rate_max || collab.salary_min || collab.salary_max) && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-gray mb-1">
                      {collab.job_type === 'full_time' ? 'Salary' : 'Day Rate'}
                    </h4>
                    <p className="text-sm text-bone-white flex items-center gap-1">
                      <DollarSign className="w-4 h-4 text-muted-gray" />
                      {collab.job_type === 'full_time' ? (
                        <>
                          {collab.salary_min && `$${collab.salary_min.toLocaleString()}`}
                          {collab.salary_min && collab.salary_max && ' - '}
                          {collab.salary_max && `$${collab.salary_max.toLocaleString()}`}
                        </>
                      ) : (
                        <>
                          {collab.day_rate_min && `$${collab.day_rate_min}`}
                          {collab.day_rate_min && collab.day_rate_max && ' - '}
                          {collab.day_rate_max && `$${collab.day_rate_max}`}
                          {(collab.day_rate_min || collab.day_rate_max) && '/day'}
                        </>
                      )}
                    </p>
                  </div>
                )}
                {collab.application_deadline && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-gray mb-1">Deadline</h4>
                    <p className="text-sm text-bone-white">
                      {format(parseLocalDate(collab.application_deadline), 'MMM d, yyyy')}
                    </p>
                  </div>
                )}
                <div>
                  <h4 className="text-xs font-medium text-muted-gray mb-1">Applicants</h4>
                  <p className="text-sm text-bone-white flex items-center gap-1">
                    <Users className="w-4 h-4 text-muted-gray" />
                    {applications?.length || 0} applicant{applications?.length !== 1 ? 's' : ''}
                    {collab.max_applications && ` / ${collab.max_applications} max`}
                  </p>
                </div>
              </div>

              {/* Benefits (for full-time) */}
              {collab.benefits_info && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-muted-gray mb-2">Benefits</h4>
                  <p className="text-sm text-bone-white">{collab.benefits_info}</p>
                </div>
              )}

              {/* Self-tape Instructions (for cast roles) */}
              {collab.tape_instructions && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-muted-gray mb-2">Self-Tape Instructions</h4>
                  <p className="text-sm text-bone-white whitespace-pre-wrap">{collab.tape_instructions}</p>
                </div>
              )}

              {/* Requirements */}
              {(collab.requires_resume || collab.requires_reel || collab.requires_headshot || collab.requires_local_hire || collab.requires_self_tape || collab.union_requirements?.length) && (
                <div className="pt-4 border-t border-muted-gray/30">
                  <h4 className="text-xs font-medium text-muted-gray mb-2">Requirements</h4>
                  <div className="flex flex-wrap gap-2">
                    {collab.requires_resume && <Badge variant="outline">Resume Required</Badge>}
                    {collab.requires_reel && <Badge variant="outline">Reel Required</Badge>}
                    {collab.requires_headshot && <Badge variant="outline">Headshot Required</Badge>}
                    {collab.requires_self_tape && <Badge variant="outline">Self-Tape Required</Badge>}
                    {collab.requires_local_hire && <Badge variant="outline">Local Hire Only</Badge>}
                    {collab.requires_order_membership && <Badge variant="outline">Order Membership Required</Badge>}
                    {collab.union_requirements?.map((union) => (
                      <Badge key={union} variant="outline">{union}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Questions Preview */}
              {collab.custom_questions && collab.custom_questions.length > 0 && (
                <div className="pt-4 border-t border-muted-gray/30 mt-4">
                  <h4 className="text-xs font-medium text-muted-gray mb-2">
                    Screening Questions ({collab.custom_questions.length})
                  </h4>
                  <ul className="text-sm text-muted-gray list-disc list-inside">
                    {collab.custom_questions.slice(0, 3).map((q, i) => (
                      <li key={i} className="truncate">{q.question}</li>
                    ))}
                    {collab.custom_questions.length > 3 && (
                      <li className="text-muted-gray">+{collab.custom_questions.length - 3} more</li>
                    )}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Applications Board/List */}
        {!applications || applications.length === 0 ? (
          <Card className="bg-charcoal-black border-muted-gray/30">
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-gray" />
              <h3 className="text-lg font-semibold mb-2 text-bone-white">No applications yet</h3>
              <p className="text-muted-gray">
                Applications will appear here when people apply to this posting.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex gap-6">
            {/* Board View */}
            {viewMode === 'board' && (
              <div className="flex-1">
                <ScrollArea className="w-full">
                  <div className="flex gap-4 pb-4 min-w-max">
                    {statusColumns.map((column) => (
                      <div
                        key={column.id}
                        className={`w-72 rounded-lg p-3 ${column.color}`}
                      >
                        <h4 className="font-medium text-sm mb-3 text-bone-white flex items-center justify-between">
                          {column.label}
                          <Badge variant="secondary" className="text-xs">
                            {applicationsByStatus[column.id]?.length || 0}
                          </Badge>
                        </h4>
                        <div className="space-y-2">
                          {applicationsByStatus[column.id]?.map((app: any) => (
                            <Card
                              key={app.id}
                              className="bg-charcoal-black border-muted-gray/30 cursor-pointer transition-colors hover:border-accent-yellow/50"
                              onClick={() => handleApplicantClick(app.id)}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-start gap-2">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={app.current_profile?.avatar_url} />
                                    <AvatarFallback>
                                      {app.current_profile?.full_name?.charAt(0) || '?'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="font-medium text-sm text-bone-white truncate">
                                        {app.current_profile?.full_name || app.current_profile?.username || 'Unknown'}
                                      </p>
                                      <ApplicantScore
                                        score={app.match_score}
                                        breakdown={app.score_breakdown}
                                        size="sm"
                                      />
                                    </div>
                                    {app.elevator_pitch && (
                                      <p className="text-xs text-muted-gray line-clamp-2 mt-1">
                                        {app.elevator_pitch}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="mt-2 pt-2 border-t border-muted-gray/30">
                                  <Select
                                    value={app.status}
                                    onValueChange={(value) => handleStatusChange(app.id, value)}
                                  >
                                    <SelectTrigger className="h-7 text-xs" onClick={(e) => e.stopPropagation()}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {statusColumns.map((col) => (
                                        <SelectItem key={col.id} value={col.id}>
                                          {col.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className="flex-1">
                <Card className="bg-charcoal-black border-muted-gray/30">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-muted-gray/30 text-left">
                            <th className="p-3 text-xs font-medium text-muted-gray">Applicant</th>
                            <th className="p-3 text-xs font-medium text-muted-gray">Match</th>
                            <th className="p-3 text-xs font-medium text-muted-gray">Pitch</th>
                            <th className="p-3 text-xs font-medium text-muted-gray">Status</th>
                            <th className="p-3 text-xs font-medium text-muted-gray">Applied</th>
                            <th className="p-3 text-xs font-medium text-muted-gray">Rating</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedApplications.map((app: any) => {
                            const statusCol = statusColumns.find((c) => c.id === app.status);
                            return (
                              <tr
                                key={app.id}
                                className="border-b border-muted-gray/20 cursor-pointer transition-colors hover:bg-muted-gray/10"
                                onClick={() => handleApplicantClick(app.id)}
                              >
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage src={app.current_profile?.avatar_url} />
                                      <AvatarFallback>
                                        {app.current_profile?.full_name?.charAt(0) || '?'}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <p className="font-medium text-sm text-bone-white">
                                        {app.current_profile?.full_name || app.current_profile?.username || 'Unknown'}
                                      </p>
                                      {app.current_profile?.is_order_member && (
                                        <Badge variant="outline" className="text-xs mt-0.5">Order Member</Badge>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3">
                                  <ApplicantScore
                                    score={app.match_score}
                                    breakdown={app.score_breakdown}
                                    showDetails
                                    size="sm"
                                  />
                                </td>
                                <td className="p-3">
                                  <p className="text-sm text-muted-gray line-clamp-2 max-w-xs">
                                    {app.elevator_pitch || '—'}
                                  </p>
                                </td>
                                <td className="p-3">
                                  <Select
                                    value={app.status}
                                    onValueChange={(value) => handleStatusChange(app.id, value)}
                                  >
                                    <SelectTrigger
                                      className="h-7 text-xs w-28"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {statusColumns.map((col) => (
                                        <SelectItem key={col.id} value={col.id}>
                                          {col.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="p-3 text-sm text-muted-gray">
                                  {app.created_at && format(new Date(app.created_at), 'MMM d, yyyy')}
                                </td>
                                <td className="p-3">
                                  {app.rating ? (
                                    <div className="flex items-center gap-1">
                                      <Star className="w-4 h-4 text-accent-yellow fill-accent-yellow" />
                                      <span className="text-sm text-bone-white">{app.rating}</span>
                                    </div>
                                  ) : (
                                    <span className="text-sm text-muted-gray">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
