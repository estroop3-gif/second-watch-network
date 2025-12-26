/**
 * CastingCrewTab - Main tab for managing project roles (cast & crew)
 */

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useProjectRoles,
  useProjectRoleMutations,
  useBookedPeople,
  useDealMemos,
  useDealMemoMutations,
  useProject,
} from '@/hooks/backlot';
import {
  BacklotProjectRole,
  BacklotProjectRoleType,
  BacklotProjectRoleStatus,
  PROJECT_ROLE_TYPE_LABELS,
  PROJECT_ROLE_STATUS_LABELS,
  PROJECT_ROLE_STATUS_COLORS,
  DealMemo,
} from '@/types/backlot';
import CollabForm from '@/components/community/CollabForm';
import { ApplicationsBoard } from './ApplicationsBoard';
import { AvailabilityCalendar } from './AvailabilityCalendar';
import { CrewRatesTab } from './CrewRatesTab';
import { DealMemoSummary, DealMemoStatusBadge, DealMemoStatus, DealMemoWorkflow, DealMemoHistory } from './DealMemoStatus';
import { DealMemoDialog } from './DealMemoDialog';
import { useDealMemoHistory } from '@/hooks/backlot';
import {
  Plus,
  Users,
  Video,
  Search,
  MoreVertical,
  Edit,
  Trash,
  Eye,
  Calendar,
  MapPin,
  DollarSign,
  Clock,
  CheckCircle,
  UserCheck,
  Shield,
  Loader2,
  FileText,
  MessageSquare,
  Send,
  Megaphone,
  PenTool,
  Mail,
  FileSignature,
  Hash,
  Bell,
} from 'lucide-react';
import { format } from 'date-fns';

interface CastingCrewTabProps {
  projectId: string;
}

type TabType = 'roles' | 'booked' | 'availability' | 'documents' | 'communication' | 'rates';

export function CastingCrewTab({ projectId }: CastingCrewTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('roles');
  const [typeFilter, setTypeFilter] = useState<BacklotProjectRoleType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<BacklotProjectRoleStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [viewingApplications, setViewingApplications] = useState<BacklotProjectRole | null>(null);
  const [showSendDocumentDialog, setShowSendDocumentDialog] = useState(false);
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);

  // Get project data for CollabForm
  const { data: project } = useProject(projectId);

  // Queries
  const { data: roles, isLoading } = useProjectRoles(projectId, {
    type: typeFilter === 'all' ? undefined : typeFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
    includeApplications: true,
  });

  const { data: bookedPeople } = useBookedPeople(projectId);
  const { deleteRole } = useProjectRoleMutations(projectId);

  // Filtered roles
  const filteredRoles = useMemo(() => {
    if (!roles) return [];
    return roles.filter((role) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          role.title.toLowerCase().includes(query) ||
          role.description?.toLowerCase().includes(query) ||
          role.character_name?.toLowerCase().includes(query) ||
          role.department?.toLowerCase().includes(query) ||
          role.location?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [roles, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    if (!roles) return { total: 0, open: 0, booked: 0, cast: 0, crew: 0 };
    return {
      total: roles.length,
      open: roles.filter((r) => r.status === 'open').length,
      booked: roles.filter((r) => r.status === 'booked').length,
      cast: roles.filter((r) => r.type === 'cast').length,
      crew: roles.filter((r) => r.type === 'crew').length,
    };
  }, [roles]);

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return;

    try {
      await deleteRole.mutateAsync(roleId);
      toast({
        title: 'Role deleted',
        description: 'The role has been removed.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete role',
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: BacklotProjectRoleStatus) => {
    const colors: Record<string, string> = {
      draft: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30',
      open: 'bg-green-500/20 text-green-400 border-green-500/30',
      closed: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      booked: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return colors[status] || 'bg-muted-gray/20 text-muted-gray border-muted-gray/30';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Casting & Crew</h2>
          <p className="text-muted-foreground">
            Post roles and manage applications from the community
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Post Role
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-gray" />
              <div>
                <p className="text-2xl font-bold text-bone-white">{stats.total}</p>
                <p className="text-xs text-muted-gray">Total Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-2xl font-bold text-bone-white">{stats.open}</p>
                <p className="text-xs text-muted-gray">Open</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-bone-white">{stats.booked}</p>
                <p className="text-xs text-muted-gray">Booked</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-2xl font-bold text-bone-white">{stats.cast}</p>
                <p className="text-xs text-muted-gray">Cast Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-2xl font-bold text-bone-white">{stats.crew}</p>
                <p className="text-xs text-muted-gray">Crew Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="roles">Role Postings</TabsTrigger>
          <TabsTrigger value="booked">Booked ({bookedPeople?.length || 0})</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="rates">
            <DollarSign className="w-4 h-4 mr-1" />
            Rates
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileSignature className="w-4 h-4 mr-1" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="communication">
            <MessageSquare className="w-4 h-4 mr-1" />
            Comms
          </TabsTrigger>
        </TabsList>

        {/* Role Postings Tab */}
        <TabsContent value="roles" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search roles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="cast">Cast</SelectItem>
                <SelectItem value="crew">Crew</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="booked">Booked</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Roles List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRoles.length === 0 ? (
            <Card className="bg-charcoal-black border-muted-gray/30">
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-muted-gray" />
                <h3 className="text-lg font-semibold mb-2 text-bone-white">No roles yet</h3>
                <p className="text-muted-gray mb-4">
                  Post your first role to start building your cast and crew.
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Post Role
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredRoles.map((role) => (
                <RoleCard
                  key={role.id}
                  role={role}
                  onDelete={() => handleDeleteRole(role.id)}
                  onViewApplications={() => setViewingApplications(role)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Booked Tab */}
        <TabsContent value="booked" className="space-y-4">
          {bookedPeople && bookedPeople.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {bookedPeople.map((person) => (
                <Card key={person.role_id} className="bg-charcoal-black border-muted-gray/30">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={person.avatar_url || undefined} />
                        <AvatarFallback>
                          {person.name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-bone-white">{person.name}</p>
                        <p className="text-sm text-muted-gray">
                          {person.role_title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs border-muted-gray/50 text-muted-gray">
                            {PROJECT_ROLE_TYPE_LABELS[person.role_type]}
                          </Badge>
                          {person.department && (
                            <Badge variant="secondary" className="text-xs bg-muted-gray/20 text-muted-gray">
                              {person.department}
                            </Badge>
                          )}
                        </div>
                        {person.character_name && (
                          <p className="text-xs text-muted-gray mt-1">
                            as "{person.character_name}"
                          </p>
                        )}
                        {person.start_date && (
                          <p className="text-xs text-muted-gray mt-1">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            {format(new Date(person.start_date), 'MMM d')}
                            {person.end_date && ` - ${format(new Date(person.end_date), 'MMM d')}`}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-charcoal-black border-muted-gray/30">
              <CardContent className="py-12 text-center">
                <UserCheck className="w-12 h-12 mx-auto mb-4 text-muted-gray" />
                <h3 className="text-lg font-semibold mb-2 text-bone-white">No booked crew yet</h3>
                <p className="text-muted-gray">
                  Book applicants from your role postings to see them here.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Availability Tab */}
        <TabsContent value="availability">
          <AvailabilityCalendar projectId={projectId} bookedPeople={bookedPeople || []} />
        </TabsContent>

        {/* Rates Tab */}
        <TabsContent value="rates">
          <CrewRatesTab projectId={projectId} />
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-6">
          <DocumentsSection projectId={projectId} />
        </TabsContent>

        {/* Communication Tab */}
        <TabsContent value="communication" className="space-y-6">
          <CommunicationSection projectId={projectId} />
        </TabsContent>
      </Tabs>

      {/* Create/Edit Role Dialog - Uses CollabForm to post to Collab Board */}
      {showCreateDialog && (
        <CollabForm
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => {
            setShowCreateDialog(false);
            queryClient.invalidateQueries({ queryKey: ['project-roles', projectId] });
            toast({
              title: 'Role posted',
              description: 'Your role is now live on the Collab Board.',
            });
          }}
          backlotProjectId={projectId}
          backlotProjectData={project ? {
            id: project.id,
            title: project.title,
            production_type: project.production_type,
            company: project.company,
            company_id: project.company_id,
            network_id: project.network_id,
            location: project.location,
          } : undefined}
        />
      )}

      {/* Applications Board Dialog */}
      <Dialog
        open={!!viewingApplications}
        onOpenChange={(open) => {
          if (!open) setViewingApplications(null);
        }}
      >
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Applications for {viewingApplications?.title}
            </DialogTitle>
            <DialogDescription>
              Review and manage applications for this role.
            </DialogDescription>
          </DialogHeader>
          {viewingApplications && (
            <ApplicationsBoard
              projectId={projectId}
              role={viewingApplications}
              onClose={() => setViewingApplications(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// Role Card Component
// =============================================================================

interface RoleCardProps {
  role: BacklotProjectRole;
  onDelete: () => void;
  onViewApplications: () => void;
}

function RoleCard({ role, onDelete, onViewApplications }: RoleCardProps) {
  const getRoleStatusColor = (status: BacklotProjectRoleStatus) => {
    const colors: Record<string, string> = {
      draft: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30',
      open: 'bg-green-500/20 text-green-400 border-green-500/30',
      closed: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      booked: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return colors[status] || 'bg-muted-gray/20 text-muted-gray border-muted-gray/30';
  };

  return (
    <Card className="bg-charcoal-black border-muted-gray/30">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-lg text-bone-white">{role.title}</h3>
              <Badge variant="outline" className="border-muted-gray/50 text-muted-gray">
                {PROJECT_ROLE_TYPE_LABELS[role.type]}
              </Badge>
              <Badge className={getRoleStatusColor(role.status)}>
                {PROJECT_ROLE_STATUS_LABELS[role.status]}
              </Badge>
              {role.is_order_only && (
                <Badge variant="secondary" className="gap-1">
                  <Shield className="w-3 h-3" />
                  Order Only
                </Badge>
              )}
            </div>

            {role.character_name && (
              <p className="text-sm text-muted-foreground mb-1">
                Character: {role.character_name}
              </p>
            )}

            {role.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {role.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {role.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {role.location}
                </span>
              )}
              {role.paid ? (
                <span className="flex items-center gap-1 text-green-600">
                  <DollarSign className="w-4 h-4" />
                  {role.rate_description || 'Paid'}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  Unpaid
                </span>
              )}
              {role.start_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(role.start_date), 'MMM d')}
                  {role.end_date && ` - ${format(new Date(role.end_date), 'MMM d')}`}
                </span>
              )}
              {role.days_estimated && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {role.days_estimated} day{role.days_estimated !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Applications Summary */}
            {role.application_count !== undefined && (
              <div className="mt-3 pt-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onViewApplications}
                  className="mr-2"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View Applications ({role.application_count})
                </Button>
                {role.shortlisted_count !== undefined && role.shortlisted_count > 0 && (
                  <Badge variant="secondary" className="mr-2">
                    {role.shortlisted_count} shortlisted
                  </Badge>
                )}
              </div>
            )}

            {/* Booked User */}
            {role.booked_user && (
              <div className="mt-3 pt-3 border-t flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={role.booked_user.avatar_url || undefined} />
                  <AvatarFallback>
                    {role.booked_user.full_name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">
                  Booked: <span className="font-medium">{role.booked_user.full_name || role.booked_user.username}</span>
                </span>
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onViewApplications}>
                <Eye className="w-4 h-4 mr-2" />
                View Applications
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-red-600">
                <Trash className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Documents Section Component
// =============================================================================

interface DocumentsSectionProps {
  projectId: string;
}

function DocumentsSection({ projectId }: DocumentsSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [documentMessage, setDocumentMessage] = useState('');

  // Deal memo state
  const [showDealMemoDialog, setShowDealMemoDialog] = useState(false);
  const [selectedDealMemo, setSelectedDealMemo] = useState<DealMemo | null>(null);
  const [showDealMemoDetails, setShowDealMemoDetails] = useState<DealMemo | null>(null);

  // Fetch deal memos
  const { data: dealMemos = [], isLoading: dealMemosLoading } = useDealMemos(projectId);
  const { updateDealMemoStatus, sendDealMemo, voidDealMemo, resendDealMemo, deleteDealMemo } = useDealMemoMutations(projectId);

  // Fetch history for selected deal memo
  const { data: dealMemoHistory = [], isLoading: historyLoading } = useDealMemoHistory(showDealMemoDetails?.id);

  const handleUpdateStatus = async (
    dealMemoId: string,
    status: 'sent' | 'viewed' | 'signed' | 'declined',
    notes?: string,
    signedDocumentUrl?: string
  ) => {
    try {
      await updateDealMemoStatus.mutateAsync({
        dealMemoId,
        status,
        notes,
        signedDocumentUrl,
      });
      toast({
        title: 'Status updated',
        description: `Deal memo marked as ${status}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  // Fetch document templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['document-templates', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/backlot/document-templates?project_id=${projectId}`, {
        headers: { Authorization: `Bearer ${api.getToken()}` },
      });
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    },
  });

  // Fetch signature requests
  const { data: signatureRequests, isLoading: requestsLoading } = useQuery({
    queryKey: ['signature-requests', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/signature-requests`, {
        headers: { Authorization: `Bearer ${api.getToken()}` },
      });
      if (!response.ok) throw new Error('Failed to fetch signature requests');
      return response.json();
    },
  });

  // Fetch team members for recipient selection
  const { data: teamMembers } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/members`, {
        headers: { Authorization: `Bearer ${api.getToken()}` },
      });
      if (!response.ok) throw new Error('Failed to fetch team members');
      return response.json();
    },
  });

  const sendDocumentMutation = useMutation({
    mutationFn: async (data: { templateId: string; recipientIds: string[]; message: string }) => {
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/signature-requests/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${api.getToken()}`,
        },
        body: JSON.stringify({
          template_ids: [data.templateId],
          recipient_ids: data.recipientIds,
          message: data.message,
        }),
      });
      if (!response.ok) throw new Error('Failed to send document');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Documents sent', description: 'Documents have been sent for signature.' });
      queryClient.invalidateQueries({ queryKey: ['signature-requests', projectId] });
      setShowSendDialog(false);
      setSelectedTemplateId('');
      setSelectedRecipients([]);
      setDocumentMessage('');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      viewed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      signed: 'bg-green-500/20 text-green-400 border-green-500/30',
      declined: 'bg-red-500/20 text-red-400 border-red-500/30',
      expired: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30',
    };
    return colors[status] || 'bg-muted-gray/20 text-muted-gray border-muted-gray/30';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Documents & Onboarding</h3>
          <p className="text-sm text-muted-foreground">
            Send deal memos, NDAs, and onboarding paperwork for signature
          </p>
        </div>
        <Button onClick={() => setShowSendDialog(true)}>
          <Send className="w-4 h-4 mr-2" />
          Send Document
        </Button>
      </div>

      {/* Deal Memos Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium">Deal Memos</h4>
          <Button variant="outline" size="sm" onClick={() => setShowDealMemoDialog(true)}>
            <FileSignature className="w-4 h-4 mr-2" />
            New Deal Memo
          </Button>
        </div>
        {dealMemosLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-gray" />
          </div>
        ) : dealMemos.length === 0 ? (
          <Card className="bg-charcoal-black border-muted-gray/30">
            <CardContent className="py-8 text-center">
              <FileSignature className="w-12 h-12 mx-auto mb-4 text-muted-gray" />
              <p className="text-muted-gray">No deal memos yet</p>
              <p className="text-sm text-muted-gray mt-1">
                Create deal memos when offering roles to capture rates and terms
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {dealMemos.map((memo) => (
              <div key={memo.id} className="group">
                <DealMemoStatus
                  dealMemo={memo}
                  onEdit={() => {
                    setSelectedDealMemo(memo);
                    setShowDealMemoDialog(true);
                  }}
                  onUpdateStatus={(status, notes, signedDocUrl) =>
                    handleUpdateStatus(memo.id, status, notes, signedDocUrl)
                  }
                  onSend={() => sendDealMemo.mutate(memo.id)}
                  onVoid={() => voidDealMemo.mutate(memo.id)}
                  onResend={() => resendDealMemo.mutate(memo.id)}
                  onDelete={() => {
                    if (confirm('Are you sure you want to delete this deal memo?')) {
                      deleteDealMemo.mutate(memo.id);
                    }
                  }}
                  onDownload={() => {
                    if (memo.signed_document_url) {
                      window.open(memo.signed_document_url, '_blank');
                    }
                  }}
                  isUpdating={updateDealMemoStatus.isPending}
                />
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs text-muted-foreground mt-1"
                  onClick={() => setShowDealMemoDetails(memo)}
                >
                  View details & history
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Document Templates */}
      <div>
        <h4 className="text-sm font-medium mb-3">Available Templates</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {templatesLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4 h-24 bg-muted" />
              </Card>
            ))
          ) : (
            templates?.map((template: any) => (
              <Card key={template.id} className="cursor-pointer hover:border-primary" onClick={() => {
                setSelectedTemplateId(template.id);
                setShowSendDialog(true);
              }}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    <span className="font-medium text-sm">{template.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {template.document_type}
                  </Badge>
                  {template.requires_encryption && (
                    <Badge variant="secondary" className="text-xs ml-1">
                      <Shield className="w-3 h-3 mr-1" />
                      Encrypted
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Pending Signatures */}
      <div>
        <h4 className="text-sm font-medium mb-3">Pending Signatures</h4>
        {requestsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-gray" />
          </div>
        ) : signatureRequests?.filter((r: any) => r.status !== 'signed').length === 0 ? (
          <Card className="bg-charcoal-black border-muted-gray/30">
            <CardContent className="py-8 text-center">
              <FileSignature className="w-12 h-12 mx-auto mb-4 text-muted-gray" />
              <p className="text-muted-gray">No pending signature requests</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {signatureRequests?.filter((r: any) => r.status !== 'signed').map((request: any) => (
              <Card key={request.id} className="bg-charcoal-black border-muted-gray/30">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-muted-gray" />
                    <div>
                      <p className="font-medium text-bone-white">{request.document_title}</p>
                      <p className="text-sm text-muted-gray">
                        To: {request.recipient_name || request.recipient_email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusBadge(request.status)}>
                      {request.status}
                    </Badge>
                    {request.due_date && (
                      <span className="text-xs text-muted-gray">
                        Due: {format(new Date(request.due_date), 'MMM d')}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Signed Documents */}
      <div>
        <h4 className="text-sm font-medium mb-3 text-bone-white">Completed Documents</h4>
        {signatureRequests?.filter((r: any) => r.status === 'signed').length === 0 ? (
          <Card className="bg-charcoal-black border-muted-gray/30">
            <CardContent className="py-8 text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-muted-gray" />
              <p className="text-muted-gray">No completed documents yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {signatureRequests?.filter((r: any) => r.status === 'signed').slice(0, 5).map((request: any) => (
              <Card key={request.id} className="bg-charcoal-black border-muted-gray/30">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <div>
                      <p className="font-medium text-bone-white">{request.document_title}</p>
                      <p className="text-sm text-muted-gray">
                        Signed by: {request.recipient_name}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-gray">
                    {request.signed_at && format(new Date(request.signed_at), 'MMM d, yyyy')}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Send Document Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Document for Signature</DialogTitle>
            <DialogDescription>
              Select a document template and recipients to send for signature.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Document Template</label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates?.map((template: any) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-bone-white">Recipients</label>
              <div className="border border-muted-gray/30 rounded-md p-2 max-h-40 overflow-y-auto space-y-1 bg-charcoal-black">
                {teamMembers?.map((member: any) => (
                  <label key={member.id} className="flex items-center gap-2 p-2 hover:bg-muted-gray/20 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedRecipients.includes(member.user_id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRecipients([...selectedRecipients, member.user_id]);
                        } else {
                          setSelectedRecipients(selectedRecipients.filter((id) => id !== member.user_id));
                        }
                      }}
                      className="h-4 w-4 rounded border-2 border-muted-gray/60 bg-transparent checked:bg-accent-yellow checked:border-accent-yellow accent-accent-yellow"
                    />
                    <Avatar className="h-6 w-6">
                      <AvatarFallback>{member.full_name?.charAt(0) || '?'}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-bone-white">{member.full_name || member.email}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Message (optional)</label>
              <Textarea
                placeholder="Add a personal message..."
                value={documentMessage}
                onChange={(e) => setDocumentMessage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => sendDocumentMutation.mutate({
                templateId: selectedTemplateId,
                recipientIds: selectedRecipients,
                message: documentMessage,
              })}
              disabled={!selectedTemplateId || selectedRecipients.length === 0 || sendDocumentMutation.isPending}
            >
              {sendDocumentMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deal Memo Dialog */}
      <DealMemoDialog
        open={showDealMemoDialog}
        onOpenChange={(open) => {
          setShowDealMemoDialog(open);
          if (!open) setSelectedDealMemo(null);
        }}
        projectId={projectId}
        dealMemo={selectedDealMemo || undefined}
        onSuccess={() => {
          setShowDealMemoDialog(false);
          setSelectedDealMemo(null);
        }}
      />

      {/* Deal Memo Details Dialog */}
      <Dialog open={!!showDealMemoDetails} onOpenChange={(open) => !open && setShowDealMemoDetails(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Deal Memo Details</DialogTitle>
            <DialogDescription>
              {showDealMemoDetails?.position_title} - {showDealMemoDetails?.user?.display_name}
            </DialogDescription>
          </DialogHeader>

          {showDealMemoDetails && (
            <div className="space-y-6 py-4">
              {/* Workflow Stepper */}
              <div>
                <h4 className="text-sm font-medium mb-3">Paperwork Status</h4>
                <DealMemoWorkflow
                  dealMemo={showDealMemoDetails}
                  onUpdateStatus={(status, notes, signedDocUrl) =>
                    handleUpdateStatus(showDealMemoDetails.id, status, notes, signedDocUrl)
                  }
                  isUpdating={updateDealMemoStatus.isPending}
                />
              </div>

              {/* Deal Terms Summary */}
              <div>
                <h4 className="text-sm font-medium mb-3">Deal Terms</h4>
                <Card>
                  <CardContent className="py-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Rate:</span>{' '}
                      <span className="font-medium">
                        ${showDealMemoDetails.rate_amount}/{showDealMemoDetails.rate_type}
                      </span>
                    </div>
                    {showDealMemoDetails.overtime_multiplier && (
                      <div>
                        <span className="text-muted-foreground">OT:</span>{' '}
                        <span>{showDealMemoDetails.overtime_multiplier}x</span>
                      </div>
                    )}
                    {showDealMemoDetails.double_time_multiplier && (
                      <div>
                        <span className="text-muted-foreground">DT:</span>{' '}
                        <span>{showDealMemoDetails.double_time_multiplier}x</span>
                      </div>
                    )}
                    {showDealMemoDetails.kit_rental_rate && (
                      <div>
                        <span className="text-muted-foreground">Kit:</span>{' '}
                        <span>${showDealMemoDetails.kit_rental_rate}/day</span>
                      </div>
                    )}
                    {showDealMemoDetails.car_allowance && (
                      <div>
                        <span className="text-muted-foreground">Car:</span>{' '}
                        <span>${showDealMemoDetails.car_allowance}/day</span>
                      </div>
                    )}
                    {showDealMemoDetails.per_diem_rate && (
                      <div>
                        <span className="text-muted-foreground">Per Diem:</span>{' '}
                        <span>${showDealMemoDetails.per_diem_rate}/day</span>
                      </div>
                    )}
                    {showDealMemoDetails.start_date && (
                      <div>
                        <span className="text-muted-foreground">Start:</span>{' '}
                        <span>{format(new Date(showDealMemoDetails.start_date), 'MMM d, yyyy')}</span>
                      </div>
                    )}
                    {showDealMemoDetails.end_date && (
                      <div>
                        <span className="text-muted-foreground">End:</span>{' '}
                        <span>{format(new Date(showDealMemoDetails.end_date), 'MMM d, yyyy')}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Status History */}
              <div>
                <h4 className="text-sm font-medium mb-3">Status History</h4>
                <Card>
                  <CardContent className="py-4">
                    <DealMemoHistory history={dealMemoHistory} isLoading={historyLoading} />
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDealMemoDetails(null)}>
              Close
            </Button>
            <Button onClick={() => {
              setSelectedDealMemo(showDealMemoDetails);
              setShowDealMemoDetails(null);
              setShowDealMemoDialog(true);
            }}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Deal Memo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// Communication Section Component
// =============================================================================

interface CommunicationSectionProps {
  projectId: string;
}

function CommunicationSection({ projectId }: CommunicationSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [messageContent, setMessageContent] = useState('');
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementPriority, setAnnouncementPriority] = useState<'normal' | 'high' | 'urgent'>('normal');

  // Fetch channels
  const { data: channels, isLoading: channelsLoading } = useQuery({
    queryKey: ['channels', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/channels`, {
        headers: { Authorization: `Bearer ${api.getToken()}` },
      });
      if (!response.ok) throw new Error('Failed to fetch channels');
      return response.json();
    },
  });

  // Fetch messages for active channel
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['channel-messages', activeChannel],
    queryFn: async () => {
      if (!activeChannel) return [];
      const response = await fetch(`/api/v1/backlot/channels/${activeChannel}/messages?limit=50`, {
        headers: { Authorization: `Bearer ${api.getToken()}` },
      });
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
    enabled: !!activeChannel,
  });

  // Fetch announcements
  const { data: announcements, isLoading: announcementsLoading } = useQuery({
    queryKey: ['announcements', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/announcements`, {
        headers: { Authorization: `Bearer ${api.getToken()}` },
      });
      if (!response.ok) throw new Error('Failed to fetch announcements');
      return response.json();
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch(`/api/v1/backlot/channels/${activeChannel}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${api.getToken()}`,
        },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error('Failed to send message');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-messages', activeChannel] });
      setMessageContent('');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Create channel mutation
  const createChannelMutation = useMutation({
    mutationFn: async (data: { name: string; channel_type: string }) => {
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${api.getToken()}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create channel');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels', projectId] });
      toast({ title: 'Channel created' });
    },
  });

  // Create announcement mutation
  const createAnnouncementMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; priority: string }) => {
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${api.getToken()}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create announcement');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements', projectId] });
      toast({ title: 'Announcement posted' });
      setShowAnnouncementDialog(false);
      setAnnouncementTitle('');
      setAnnouncementContent('');
      setAnnouncementPriority('normal');
    },
  });

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30',
      normal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return colors[priority] || 'bg-muted-gray/20 text-muted-gray border-muted-gray/30';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Crew Communication</h3>
          <p className="text-sm text-muted-foreground">
            Message channels, direct messages, and announcements
          </p>
        </div>
        <Button onClick={() => setShowAnnouncementDialog(true)}>
          <Megaphone className="w-4 h-4 mr-2" />
          New Announcement
        </Button>
      </div>

      {/* Announcements */}
      <div>
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Recent Announcements
        </h4>
        {announcementsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-gray" />
          </div>
        ) : announcements?.length === 0 ? (
          <Card className="bg-charcoal-black border-muted-gray/30">
            <CardContent className="py-8 text-center">
              <Megaphone className="w-12 h-12 mx-auto mb-4 text-muted-gray" />
              <p className="text-muted-gray">No announcements yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {announcements?.slice(0, 3).map((announcement: any) => (
              <Card key={announcement.id} className={`bg-charcoal-black ${announcement.priority === 'urgent' ? 'border-red-500/50' : 'border-muted-gray/30'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="font-medium text-bone-white">{announcement.title}</h5>
                        <Badge className={getPriorityColor(announcement.priority)}>
                          {announcement.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-gray line-clamp-2">
                        {announcement.content}
                      </p>
                      <p className="text-xs text-muted-gray mt-2">
                        By {announcement.sender_name} &bull; {format(new Date(announcement.published_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                    {announcement.requires_acknowledgment && (
                      <Badge variant={announcement.is_acknowledged ? 'secondary' : 'outline'} className="border-muted-gray/50">
                        {announcement.is_acknowledged ? 'Acknowledged' : 'Pending'}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Channels and Messages */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Channel List */}
        <Card className="md:col-span-1 bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between text-bone-white">
              <span>Channels</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const name = prompt('Enter channel name:');
                  if (name) {
                    createChannelMutation.mutate({ name, channel_type: 'general' });
                  }
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {channelsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-gray" />
              </div>
            ) : channels?.length === 0 ? (
              <p className="text-sm text-muted-gray text-center py-4">
                No channels yet. Create one to get started!
              </p>
            ) : (
              <div className="space-y-1">
                {channels?.map((channel: any) => (
                  <button
                    key={channel.id}
                    onClick={() => setActiveChannel(channel.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
                      activeChannel === channel.id
                        ? 'bg-accent-yellow text-charcoal-black'
                        : 'text-bone-white hover:bg-muted-gray/20'
                    }`}
                  >
                    <Hash className="w-4 h-4" />
                    {channel.name}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Messages */}
        <Card className="md:col-span-2 bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-bone-white">
              {activeChannel
                ? `#${channels?.find((c: any) => c.id === activeChannel)?.name || 'channel'}`
                : 'Select a channel'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {!activeChannel ? (
              <div className="flex items-center justify-center py-12 text-muted-gray">
                <MessageSquare className="w-8 h-8 mr-2" />
                Select a channel to view messages
              </div>
            ) : (
              <>
                <ScrollArea className="h-64 p-2">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-gray" />
                    </div>
                  ) : messages?.length === 0 ? (
                    <p className="text-sm text-muted-gray text-center py-8">
                      No messages yet. Start the conversation!
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {messages?.map((message: any) => (
                        <div key={message.id} className="flex gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={message.sender_avatar} />
                            <AvatarFallback>
                              {message.sender_name?.charAt(0) || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="font-medium text-sm text-bone-white">
                                {message.sender_name}
                              </span>
                              <span className="text-xs text-muted-gray">
                                {format(new Date(message.created_at), 'h:mm a')}
                              </span>
                            </div>
                            <p className="text-sm text-bone-white">{message.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                <div className="flex gap-2 mt-2 pt-2 border-t border-muted-gray/30">
                  <Input
                    placeholder="Type a message..."
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && messageContent.trim()) {
                        e.preventDefault();
                        sendMessageMutation.mutate(messageContent);
                      }
                    }}
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                  <Button
                    size="icon"
                    onClick={() => sendMessageMutation.mutate(messageContent)}
                    disabled={!messageContent.trim() || sendMessageMutation.isPending}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Announcement Dialog */}
      <Dialog open={showAnnouncementDialog} onOpenChange={setShowAnnouncementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Announcement</DialogTitle>
            <DialogDescription>
              Post an announcement to your crew. They will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                placeholder="Announcement title"
                value={announcementTitle}
                onChange={(e) => setAnnouncementTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Message</label>
              <Textarea
                placeholder="Write your announcement..."
                value={announcementContent}
                onChange={(e) => setAnnouncementContent(e.target.value)}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <Select value={announcementPriority} onValueChange={(v: any) => setAnnouncementPriority(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnnouncementDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createAnnouncementMutation.mutate({
                title: announcementTitle,
                content: announcementContent,
                priority: announcementPriority,
              })}
              disabled={!announcementTitle || !announcementContent || createAnnouncementMutation.isPending}
            >
              {createAnnouncementMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Megaphone className="w-4 h-4 mr-2" />
              )}
              Post Announcement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
