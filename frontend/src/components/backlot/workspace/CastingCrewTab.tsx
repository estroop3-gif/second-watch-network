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
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import {
  useProjectRoles,
  useProjectRoleMutations,
  useBookedPeople,
} from '@/hooks/backlot';
import {
  BacklotProjectRole,
  BacklotProjectRoleType,
  BacklotProjectRoleStatus,
  PROJECT_ROLE_TYPE_LABELS,
  PROJECT_ROLE_STATUS_LABELS,
  PROJECT_ROLE_STATUS_COLORS,
} from '@/types/backlot';
import { RolePostingForm } from './RolePostingForm';
import { ApplicationsBoard } from './ApplicationsBoard';
import { AvailabilityCalendar } from './AvailabilityCalendar';
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
} from 'lucide-react';
import { format } from 'date-fns';

interface CastingCrewTabProps {
  projectId: string;
}

export function CastingCrewTab({ projectId }: CastingCrewTabProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'roles' | 'booked' | 'availability'>('roles');
  const [typeFilter, setTypeFilter] = useState<BacklotProjectRoleType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<BacklotProjectRoleStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<BacklotProjectRole | null>(null);
  const [viewingApplications, setViewingApplications] = useState<BacklotProjectRole | null>(null);

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
      draft: 'bg-gray-100 text-gray-800',
      open: 'bg-green-100 text-green-800',
      closed: 'bg-yellow-100 text-yellow-800',
      booked: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.open}</p>
                <p className="text-xs text-muted-foreground">Open</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.booked}</p>
                <p className="text-xs text-muted-foreground">Booked</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{stats.cast}</p>
                <p className="text-xs text-muted-foreground">Cast Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{stats.crew}</p>
                <p className="text-xs text-muted-foreground">Crew Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="roles">Role Postings</TabsTrigger>
          <TabsTrigger value="booked">Booked ({bookedPeople?.length || 0})</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
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
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No roles yet</h3>
                <p className="text-muted-foreground mb-4">
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
                  onEdit={() => setEditingRole(role)}
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
                <Card key={person.role_id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={person.avatar_url || undefined} />
                        <AvatarFallback>
                          {person.name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{person.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {person.role_title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {PROJECT_ROLE_TYPE_LABELS[person.role_type]}
                          </Badge>
                          {person.department && (
                            <Badge variant="secondary" className="text-xs">
                              {person.department}
                            </Badge>
                          )}
                        </div>
                        {person.character_name && (
                          <p className="text-xs text-muted-foreground mt-1">
                            as "{person.character_name}"
                          </p>
                        )}
                        {person.start_date && (
                          <p className="text-xs text-muted-foreground mt-1">
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
            <Card>
              <CardContent className="py-12 text-center">
                <UserCheck className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No booked crew yet</h3>
                <p className="text-muted-foreground">
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
      </Tabs>

      {/* Create/Edit Role Dialog */}
      <Dialog
        open={showCreateDialog || !!editingRole}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setEditingRole(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRole ? 'Edit Role' : 'Post New Role'}
            </DialogTitle>
            <DialogDescription>
              {editingRole
                ? 'Update the role details below.'
                : 'Create a new role posting for cast or crew.'}
            </DialogDescription>
          </DialogHeader>
          <RolePostingForm
            projectId={projectId}
            role={editingRole || undefined}
            onSuccess={() => {
              setShowCreateDialog(false);
              setEditingRole(null);
            }}
            onCancel={() => {
              setShowCreateDialog(false);
              setEditingRole(null);
            }}
          />
        </DialogContent>
      </Dialog>

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
  onEdit: () => void;
  onDelete: () => void;
  onViewApplications: () => void;
}

function RoleCard({ role, onEdit, onDelete, onViewApplications }: RoleCardProps) {
  const getStatusColor = (status: BacklotProjectRoleStatus) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      open: 'bg-green-100 text-green-800',
      closed: 'bg-yellow-100 text-yellow-800',
      booked: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-lg">{role.title}</h3>
              <Badge variant="outline">
                {PROJECT_ROLE_TYPE_LABELS[role.type]}
              </Badge>
              <Badge className={getStatusColor(role.status)}>
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
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
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
