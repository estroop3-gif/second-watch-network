/**
 * CollabApplicantsPage - Dedicated page for viewing applicants for a community collab posting
 */

import { useParams, useNavigate, Link } from 'react-router-dom';
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
  ExternalLink,
  Mail,
  FileText,
  Star,
  MessageSquare,
} from 'lucide-react';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';

export default function CollabApplicantsPage() {
  const { projectId, collabId } = useParams<{ projectId: string; collabId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedApplication, setSelectedApplication] = useState<any>(null);

  // Fetch project info
  const { data: project } = useProject(projectId);

  // Fetch the collab details
  const { data: collab, isLoading: collabLoading } = useQuery({
    queryKey: ['collab', collabId],
    queryFn: async () => {
      const response = await api.get<CommunityCollab>(`/community/collabs/${collabId}`);
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

  // Group applications by status
  const applicationsByStatus = statusColumns.reduce((acc, col) => {
    acc[col.id] = (applications || []).filter((app: any) => app.status === col.id);
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
            <Button
              variant="outline"
              onClick={() => navigate(`/backlot/projects/${projectId}`)}
            >
              Back to Project
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Collab Summary Card */}
        {collab && (
          <Card className="bg-charcoal-black border-muted-gray/30 mb-6">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant="outline">{collab.type}</Badge>
                {collab.is_remote && <Badge variant="secondary">Remote</Badge>}
                {collab.compensation_type && (
                  <Badge variant="secondary">{collab.compensation_type}</Badge>
                )}
              </div>
              {collab.description && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                  {collab.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {collab.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {collab.location}
                  </span>
                )}
                {collab.start_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {format(parseLocalDate(collab.start_date), 'MMM d, yyyy')}
                    {collab.end_date && ` - ${format(parseLocalDate(collab.end_date), 'MMM d, yyyy')}`}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {applications?.length || 0} applicant{applications?.length !== 1 ? 's' : ''}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Applications Board */}
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
            {/* Kanban Board */}
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
                            className={`bg-charcoal-black border-muted-gray/30 cursor-pointer transition-colors hover:border-accent-yellow/50 ${
                              selectedApplication?.id === app.id ? 'border-accent-yellow' : ''
                            }`}
                            onClick={() => setSelectedApplication(app)}
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
                                  <p className="font-medium text-sm text-bone-white truncate">
                                    {app.current_profile?.full_name || app.current_profile?.username || 'Unknown'}
                                  </p>
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

            {/* Application Detail Panel */}
            {selectedApplication && (
              <div className="w-96 shrink-0">
                <Card className="bg-charcoal-black border-muted-gray/30 sticky top-24">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3 mb-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={selectedApplication.current_profile?.avatar_url} />
                        <AvatarFallback>
                          {selectedApplication.current_profile?.full_name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h3 className="font-semibold text-bone-white">
                          {selectedApplication.current_profile?.full_name || selectedApplication.current_profile?.username || 'Unknown'}
                        </h3>
                        {selectedApplication.current_profile?.username && (
                          <Link
                            to={`/profile/${selectedApplication.current_profile.username}`}
                            className="text-sm text-accent-yellow hover:underline flex items-center gap-1"
                          >
                            View Profile <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>

                    {selectedApplication.elevator_pitch && (
                      <div className="mb-4">
                        <h4 className="text-xs font-medium text-muted-gray mb-1">Elevator Pitch</h4>
                        <p className="text-sm text-bone-white">
                          {selectedApplication.elevator_pitch}
                        </p>
                      </div>
                    )}

                    {selectedApplication.cover_letter && (
                      <div className="mb-4">
                        <h4 className="text-xs font-medium text-muted-gray mb-1">Cover Letter</h4>
                        <p className="text-sm text-bone-white whitespace-pre-wrap">
                          {selectedApplication.cover_letter}
                        </p>
                      </div>
                    )}

                    {selectedApplication.portfolio_url && (
                      <div className="mb-4">
                        <h4 className="text-xs font-medium text-muted-gray mb-1">Portfolio</h4>
                        <a
                          href={selectedApplication.portfolio_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-accent-yellow hover:underline flex items-center gap-1"
                        >
                          {selectedApplication.portfolio_url} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {selectedApplication.resume_url && (
                      <div className="mb-4">
                        <h4 className="text-xs font-medium text-muted-gray mb-1">Resume</h4>
                        <a
                          href={selectedApplication.resume_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-accent-yellow hover:underline flex items-center gap-1"
                        >
                          <FileText className="w-4 h-4" /> View Resume
                        </a>
                      </div>
                    )}

                    {/* Internal Notes and Rating */}
                    <div className="pt-4 border-t border-muted-gray/30 space-y-3">
                      <h4 className="text-xs font-medium text-muted-gray">Internal Notes</h4>
                      {selectedApplication.internal_notes ? (
                        <p className="text-sm text-bone-white">
                          {selectedApplication.internal_notes}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-gray italic">No notes yet</p>
                      )}

                      {selectedApplication.rating && (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-accent-yellow fill-accent-yellow" />
                          <span className="text-sm text-bone-white">
                            Rating: {selectedApplication.rating}/5
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="pt-4 border-t border-muted-gray/30 mt-4 flex gap-2">
                      {selectedApplication.current_profile?.email && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => window.open(`mailto:${selectedApplication.current_profile.email}`, '_blank')}
                        >
                          <Mail className="w-4 h-4 mr-1" />
                          Email
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => navigate(`/messages?user=${selectedApplication.current_profile?.id}`)}
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        Message
                      </Button>
                    </div>

                    <div className="text-xs text-muted-gray mt-4">
                      Applied {selectedApplication.created_at && format(new Date(selectedApplication.created_at), 'MMM d, yyyy')}
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
