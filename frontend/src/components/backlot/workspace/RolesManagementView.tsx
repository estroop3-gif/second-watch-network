/**
 * RolesManagementView - Manage project roles and view profiles
 * Allows showrunners to assign Backlot roles to team members
 * Also provides per-user permission editing capabilities
 */
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Users,
  Plus,
  Trash2,
  Loader2,
  Star,
  Shield,
  Search,
  Eye,
  Settings,
  Check,
  UserCog,
  Save,
  RotateCcw,
  Crown,
} from 'lucide-react';
import {
  useBacklotRoles,
  useViewProfiles,
  useCanManageRoles,
  BACKLOT_ROLES,
  DEFAULT_VIEW_CONFIGS,
} from '@/hooks/backlot';
import {
  useProjectMembers,
  useViewOverrides,
  useRolePresets,
  normalizePermission,
  type ProjectMemberWithRoles,
  type ViewEditConfig,
  type PermissionValue,
} from '@/hooks/backlot/useProjectAccess';
import type { BacklotRoleValue, BacklotProjectRole, ViewConfig } from '@/hooks/backlot/useProjectRoles';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface RolesManagementViewProps {
  projectId: string;
}

// Tab definitions for permission editor
const TAB_DEFINITIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'script', label: 'Script' },
  { key: 'shot-lists', label: 'Shot Lists' },
  { key: 'coverage', label: 'Coverage' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'call-sheets', label: 'Call Sheets' },
  { key: 'casting', label: 'Casting' },
  { key: 'locations', label: 'Locations' },
  { key: 'gear', label: 'Gear' },
  { key: 'dailies', label: 'Dailies' },
  { key: 'review', label: 'Review' },
  { key: 'assets', label: 'Assets' },
  { key: 'budget', label: 'Budget' },
  { key: 'daily-budget', label: 'Daily Budget' },
  { key: 'receipts', label: 'Receipts' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'updates', label: 'Updates' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'clearances', label: 'Clearances' },
  { key: 'credits', label: 'Credits' },
  { key: 'settings', label: 'Settings' },
  { key: 'timecards', label: 'Timecards' },
  { key: 'scene-view', label: 'Scene View' },
  { key: 'day-view', label: 'Day View' },
  { key: 'person-view', label: 'Person View' },
  { key: 'access', label: 'Team & Access' },
];

const SECTION_DEFINITIONS = [
  { key: 'budget_numbers', label: 'Budget Numbers' },
  { key: 'admin_tools', label: 'Admin Tools' },
];

// Backlot role badge colors
const BACKLOT_ROLE_COLORS: Record<string, string> = {
  showrunner: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  producer: 'bg-green-500/20 text-green-400 border-green-500/30',
  director: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  first_ad: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  dp: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  editor: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  department_head: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  crew: 'bg-gray-500/20 text-gray-500 border-gray-500/30',
};

// Permission Toggle Component
const PermissionToggle: React.FC<{
  value: PermissionValue;
  onChange: (value: PermissionValue) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const handleViewChange = (checked: boolean) => {
    onChange({
      view: checked,
      edit: checked ? value.edit : false,
    });
  };

  const handleEditChange = (checked: boolean) => {
    onChange({
      view: checked ? true : value.view,
      edit: checked,
    });
  };

  return (
    <div className="flex items-center gap-4">
      <label className="flex items-center gap-2 cursor-pointer">
        <Checkbox
          checked={value.view}
          onCheckedChange={handleViewChange}
          disabled={disabled}
        />
        <span className="text-sm text-muted-gray">View</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <Checkbox
          checked={value.edit}
          onCheckedChange={handleEditChange}
          disabled={disabled || !value.view}
        />
        <span className="text-sm text-muted-gray">Edit</span>
      </label>
    </div>
  );
};

// Group roles by user for display
interface UserRoleGroup {
  userId: string;
  profile: BacklotProjectRole['profile'];
  roles: BacklotProjectRole[];
  primaryRoleId?: string;
}

const RolesManagementView: React.FC<RolesManagementViewProps> = ({ projectId }) => {
  const { data: canManage, isLoading: checkingAccess } = useCanManageRoles(projectId);
  const { roles, isLoading: loadingRoles, assignRole, removeRole, setPrimaryRole } = useBacklotRoles(projectId);
  const { members, isLoading: loadingMembers } = useProjectMembers(projectId);
  const { viewProfiles, isLoading: loadingProfiles, createViewProfile, updateViewProfile, deleteViewProfile } = useViewProfiles(projectId);
  const { overrides, updateOverride, deleteOverride } = useViewOverrides(projectId);
  const { data: rolePresets } = useRolePresets(projectId);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showViewProfileDialog, setShowViewProfileDialog] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<ProjectMemberWithRoles | null>(null);
  const [selectedRole, setSelectedRole] = useState<BacklotRoleValue | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);

  // View profile editing
  const [editingProfile, setEditingProfile] = useState<{
    role: string;
    config: ViewConfig;
  } | null>(null);

  // Per-user permission editing
  const [editUserConfig, setEditUserConfig] = useState<ViewEditConfig | null>(null);
  const [hasPermissionChanges, setHasPermissionChanges] = useState(false);

  // Group roles by user
  const userRoleGroups = useMemo<UserRoleGroup[]>(() => {
    const groups = new Map<string, UserRoleGroup>();

    roles.forEach(role => {
      const existing = groups.get(role.user_id);
      if (existing) {
        existing.roles.push(role);
        if (role.is_primary) {
          existing.primaryRoleId = role.id;
        }
      } else {
        groups.set(role.user_id, {
          userId: role.user_id,
          profile: role.profile,
          roles: [role],
          primaryRoleId: role.is_primary ? role.id : undefined,
        });
      }
    });

    return Array.from(groups.values());
  }, [roles]);

  // Filter members for add dialog (using new ProjectMemberWithRoles format)
  const filteredMembers = useMemo(() => {
    if (!members || members.length === 0) return [];
    const query = searchQuery.toLowerCase();
    return members.filter(m => {
      const name = m.user_name || m.user_username || '';
      return name.toLowerCase().includes(query);
    });
  }, [members, searchQuery]);

  const handleAssignRole = async () => {
    if (!selectedMember || !selectedRole) return;

    setIsSubmitting(true);
    try {
      await assignRole.mutateAsync({
        projectId,
        userId: selectedMember,
        backlotRole: selectedRole,
        isPrimary: !userRoleGroups.find(g => g.userId === selectedMember),
      });
      setShowAddDialog(false);
      setSelectedMember(null);
      setSelectedRole(null);
      setSearchQuery('');
    } catch (err) {
      console.error('Failed to assign role:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveRole = async () => {
    if (!deleteRoleId) return;

    setIsSubmitting(true);
    try {
      await removeRole.mutateAsync(deleteRoleId);
      setDeleteRoleId(null);
    } catch (err) {
      console.error('Failed to remove role:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetPrimary = async (roleId: string, userId: string) => {
    try {
      await setPrimaryRole.mutateAsync({
        projectId,
        userId,
        roleId,
      });
    } catch (err) {
      console.error('Failed to set primary role:', err);
    }
  };

  const handleSaveViewProfile = async () => {
    if (!editingProfile) return;

    setIsSubmitting(true);
    try {
      const existing = viewProfiles.find(p => p.backlot_role === editingProfile.role);
      if (existing) {
        await updateViewProfile.mutateAsync({
          id: existing.id,
          config: editingProfile.config,
        });
      } else {
        await createViewProfile.mutateAsync({
          projectId,
          backlotRole: editingProfile.role,
          label: `Custom ${BACKLOT_ROLES.find(r => r.value === editingProfile.role)?.label || editingProfile.role} View`,
          config: editingProfile.config,
          isDefault: true,
        });
      }
      setShowViewProfileDialog(false);
      setEditingProfile(null);
    } catch (err) {
      console.error('Failed to save view profile:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openViewProfileEditor = (role: string) => {
    const existing = viewProfiles.find(p => p.backlot_role === role);
    const defaultConfig = DEFAULT_VIEW_CONFIGS[role] || DEFAULT_VIEW_CONFIGS.crew;

    setEditingProfile({
      role,
      config: existing?.config || defaultConfig,
    });
    setShowViewProfileDialog(true);
  };

  // Get the base config for a member's role
  const getBaseConfigForMember = (member: ProjectMemberWithRoles): ViewEditConfig | null => {
    if (!rolePresets) return null;
    const preset = rolePresets.find(p => p.role === member.primary_role);
    return preset?.config || null;
  };

  // Get existing override for a member
  const getExistingOverride = (member: ProjectMemberWithRoles) => {
    return overrides.find(o => o.user_id === member.user_id);
  };

  // Open permission editor for a member
  const openPermissionEditor = (member: ProjectMemberWithRoles) => {
    const existingOverride = getExistingOverride(member);
    const baseConfig = getBaseConfigForMember(member);

    if (existingOverride) {
      setEditUserConfig(existingOverride.config);
    } else if (baseConfig) {
      setEditUserConfig(JSON.parse(JSON.stringify(baseConfig)));
    } else {
      // Create a default config if no role preset exists
      setEditUserConfig({
        tabs: TAB_DEFINITIONS.reduce((acc, tab) => {
          acc[tab.key] = { view: false, edit: false };
          return acc;
        }, {} as Record<string, PermissionValue>),
        sections: SECTION_DEFINITIONS.reduce((acc, section) => {
          acc[section.key] = { view: false, edit: false };
          return acc;
        }, {} as Record<string, PermissionValue>),
      });
    }
    setEditingMember(member);
    setHasPermissionChanges(false);
    setShowPermissionDialog(true);
  };

  // Handle permission change for a member
  const handlePermissionChange = (
    type: 'tabs' | 'sections',
    key: string,
    value: PermissionValue
  ) => {
    if (!editUserConfig) return;
    setEditUserConfig({
      ...editUserConfig,
      [type]: {
        ...editUserConfig[type],
        [key]: value,
      },
    });
    setHasPermissionChanges(true);
  };

  // Save member permissions
  const handleSavePermissions = async () => {
    if (!editingMember || !editUserConfig) return;
    setIsSubmitting(true);
    try {
      await updateOverride.mutateAsync({
        userId: editingMember.user_id,
        config: editUserConfig,
      });
      toast.success('Permissions saved');
      setShowPermissionDialog(false);
      setEditingMember(null);
      setEditUserConfig(null);
    } catch (err) {
      toast.error('Failed to save permissions');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset member permissions to role defaults
  const handleResetPermissions = async () => {
    if (!editingMember) return;
    setIsSubmitting(true);
    try {
      await deleteOverride.mutateAsync(editingMember.user_id);
      toast.success('Permissions reset to role defaults');
      setShowPermissionDialog(false);
      setEditingMember(null);
      setEditUserConfig(null);
    } catch (err) {
      toast.error('Failed to reset permissions');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checkingAccess || loadingRoles || loadingMembers) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="text-center py-12 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
        <Shield className="w-12 h-12 text-muted-gray/30 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-bone-white mb-2">Access Restricted</h3>
        <p className="text-muted-gray">Only project owners and showrunners can manage roles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading text-bone-white flex items-center gap-2">
            <Users className="w-6 h-6 text-accent-yellow" />
            Team Roles
          </h2>
          <p className="text-sm text-muted-gray">
            Assign Backlot roles to control what team members can see and do
          </p>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Assign Role
        </Button>
      </div>

      {/* Role Legend */}
      <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
        <h3 className="text-sm font-medium text-bone-white mb-3">Role Permissions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {BACKLOT_ROLES.map((role) => (
            <div
              key={role.value}
              className="flex items-start gap-2 text-sm cursor-pointer hover:bg-muted-gray/10 rounded p-2 -m-2"
              onClick={() => openViewProfileEditor(role.value)}
            >
              <Badge variant="outline" className="shrink-0 text-xs">
                {role.label}
              </Badge>
              <span className="text-muted-gray text-xs">{role.description}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-gray mt-3">
          Click a role to customize its view permissions for this project.
        </p>
      </div>

      {/* All Team Members */}
      <div className="space-y-3">
        <h3 className="text-lg font-medium text-bone-white flex items-center gap-2">
          <Users className="w-5 h-5 text-accent-yellow" />
          Team Members ({members.length})
        </h3>
        <p className="text-sm text-muted-gray -mt-1 mb-3">
          All team members from Team & Access. Click the settings icon to edit individual permissions.
        </p>

        {members.length > 0 ? (
          <div className="space-y-2">
            {members.map((member) => {
              const isOwner = member.role === 'owner';
              const displayName = member.user_name || member.user_username || 'Unknown User';
              const initials = displayName
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
              const userRoleGroup = userRoleGroups.find(g => g.userId === member.user_id);

              return (
                <div
                  key={member.id}
                  className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={member.user_avatar || ''} />
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2 font-medium text-bone-white">
                          {displayName}
                          {isOwner && <Crown className="h-4 w-4 text-yellow-500" />}
                        </div>
                        <div className="text-xs text-muted-gray">
                          @{member.user_username || 'unknown'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Backlot Roles */}
                      <div className="flex flex-wrap gap-2 items-center">
                        {member.primary_role && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs',
                              BACKLOT_ROLE_COLORS[member.primary_role] || BACKLOT_ROLE_COLORS.crew
                            )}
                          >
                            <Star className="w-3 h-3 mr-1" />
                            {BACKLOT_ROLES.find(r => r.value === member.primary_role)?.label || member.primary_role}
                          </Badge>
                        )}
                        {member.backlot_roles?.filter(r => r !== member.primary_role).map((roleValue) => (
                          <Badge
                            key={roleValue}
                            variant="outline"
                            className={cn(
                              'text-xs',
                              BACKLOT_ROLE_COLORS[roleValue] || BACKLOT_ROLE_COLORS.crew
                            )}
                          >
                            {BACKLOT_ROLES.find(r => r.value === roleValue)?.label || roleValue}
                          </Badge>
                        ))}
                        {!member.primary_role && (!member.backlot_roles || member.backlot_roles.length === 0) && (
                          <Badge variant="outline" className="text-xs text-muted-gray border-muted-gray/30">
                            No role
                          </Badge>
                        )}
                        {member.has_overrides && (
                          <Badge variant="outline" className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">
                            Custom
                          </Badge>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-gray hover:text-bone-white"
                          onClick={() => openPermissionEditor(member)}
                          title="Edit permissions"
                        >
                          <UserCog className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
            <Users className="w-12 h-12 text-muted-gray/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-bone-white mb-2">No team members</h3>
            <p className="text-muted-gray mb-4">
              Add team members through Team & Access first.
            </p>
          </div>
        )}
      </div>

      {/* Roles by User - Keep for managing roles but make it collapsible */}
      {userRoleGroups.length > 0 && (
        <div className="border-t border-muted-gray/20 pt-6">
          <h3 className="text-lg font-medium text-bone-white mb-2 flex items-center gap-2">
            <Star className="w-5 h-5 text-accent-yellow" />
            Role Assignments
          </h3>
          <p className="text-sm text-muted-gray mb-4">
            Manage which roles are assigned to each team member. Click a role to make it primary.
          </p>
          <div className="space-y-3">
            {userRoleGroups.map((group) => {
              // Get member info from useProjectMembers for better profile data
              const memberInfo = members.find(m => m.user_id === group.userId);
              const displayName = memberInfo?.user_name || group.profile?.display_name || group.profile?.full_name || 'Unknown';
              const avatarUrl = memberInfo?.user_avatar || group.profile?.avatar_url || '';

              return (
              <div
                key={group.userId}
                className="bg-charcoal-black/30 border border-muted-gray/20 rounded-lg p-3"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={avatarUrl} />
                      <AvatarFallback>
                        {displayName.slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-bone-white text-sm">
                      {displayName}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 items-center">
                    {group.roles.map((role) => {
                      const roleInfo = BACKLOT_ROLES.find(r => r.value === role.backlot_role);
                      const isPrimary = role.id === group.primaryRoleId;

                      return (
                        <div key={role.id} className="flex items-center gap-1">
                          <Badge
                            variant={isPrimary ? 'default' : 'outline'}
                            className={cn(
                              'cursor-pointer transition-colors text-xs',
                              isPrimary
                                ? 'bg-accent-yellow text-charcoal-black'
                                : 'hover:bg-muted-gray/20'
                            )}
                            onClick={() => !isPrimary && handleSetPrimary(role.id, group.userId)}
                            title={isPrimary ? 'Primary role' : 'Click to set as primary'}
                          >
                            {isPrimary && <Star className="w-3 h-3 mr-1" />}
                            {roleInfo?.label || role.backlot_role}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-gray hover:text-red-400"
                            onClick={() => setDeleteRoleId(role.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View Profile Customization Section */}
      <div className="border-t border-muted-gray/20 pt-6">
        <h3 className="text-lg font-medium text-bone-white mb-2 flex items-center gap-2">
          <Eye className="w-5 h-5 text-accent-yellow" />
          Custom View Profiles
        </h3>
        <p className="text-sm text-muted-gray mb-4">
          Override default view permissions for specific roles in this project.
        </p>

        {viewProfiles.length > 0 ? (
          <div className="space-y-2">
            {viewProfiles.map((profile) => {
              const roleInfo = BACKLOT_ROLES.find(r => r.value === profile.backlot_role);
              return (
                <div
                  key={profile.id}
                  className="flex items-center justify-between bg-charcoal-black/30 border border-muted-gray/20 rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{roleInfo?.label || profile.backlot_role}</Badge>
                    <span className="text-sm text-muted-gray">{profile.label}</span>
                    {profile.is_default && (
                      <Badge className="bg-green-500/20 text-green-400 text-xs">Active</Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openViewProfileEditor(profile.backlot_role)}
                    >
                      <Settings className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300"
                      onClick={() => deleteViewProfile.mutate(profile.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-gray italic">
            No custom view profiles. Roles use default permissions.
          </p>
        )}
      </div>

      {/* Add Role Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
            <DialogDescription>
              Select a team member and assign them a Backlot role.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Member Search */}
            <div className="space-y-2">
              <Label>Team Member</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                <Input
                  placeholder="Search team members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 border border-muted-gray/20 rounded-lg p-2">
                {filteredMembers.length > 0 ? (
                  filteredMembers.map((member) => (
                    <button
                      key={member.user_id}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left',
                        selectedMember === member.user_id
                          ? 'bg-accent-yellow/20 border border-accent-yellow/40'
                          : 'hover:bg-muted-gray/10'
                      )}
                      onClick={() => setSelectedMember(member.user_id)}
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={member.user_avatar || ''} />
                        <AvatarFallback>
                          {(member.user_name || member.user_username || 'U').slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-bone-white truncate">
                          {member.user_name || 'Unknown'}
                        </div>
                        <div className="text-xs text-muted-gray truncate">
                          @{member.user_username || 'unknown'}
                        </div>
                      </div>
                      {selectedMember === member.user_id && (
                        <Check className="w-4 h-4 text-accent-yellow" />
                      )}
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-muted-gray text-center py-4">
                    No team members found
                  </p>
                )}
              </div>
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <Label>Backlot Role</Label>
              <Select
                value={selectedRole || ''}
                onValueChange={(v) => setSelectedRole(v as BacklotRoleValue)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role..." />
                </SelectTrigger>
                <SelectContent>
                  {BACKLOT_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div className="flex flex-col">
                        <span>{role.label}</span>
                        <span className="text-xs text-muted-gray">{role.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAssignRole}
                disabled={isSubmitting || !selectedMember || !selectedRole}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  'Assign Role'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Profile Editor Dialog */}
      <Dialog open={showViewProfileDialog} onOpenChange={setShowViewProfileDialog}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit View Profile: {BACKLOT_ROLES.find(r => r.value === editingProfile?.role)?.label || editingProfile?.role}
            </DialogTitle>
            <DialogDescription>
              Customize which tabs and sections this role can see in the project workspace.
            </DialogDescription>
          </DialogHeader>

          {editingProfile && (
            <div className="space-y-6 mt-4">
              {/* Tabs */}
              <div className="space-y-3">
                <Label className="text-bone-white">Visible Tabs</Label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(editingProfile.config.tabs).map(([tab, enabled]) => (
                    <div key={tab} className="flex items-center gap-2">
                      <Checkbox
                        id={`tab-${tab}`}
                        checked={enabled}
                        onCheckedChange={(checked) => {
                          setEditingProfile({
                            ...editingProfile,
                            config: {
                              ...editingProfile.config,
                              tabs: {
                                ...editingProfile.config.tabs,
                                [tab]: !!checked,
                              },
                            },
                          });
                        }}
                      />
                      <Label
                        htmlFor={`tab-${tab}`}
                        className="text-sm cursor-pointer capitalize"
                      >
                        {tab.replace(/-/g, ' ')}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sections */}
              <div className="space-y-3">
                <Label className="text-bone-white">Additional Permissions</Label>
                <div className="space-y-2">
                  {Object.entries(editingProfile.config.sections).map(([section, enabled]) => (
                    <div key={section} className="flex items-center justify-between py-2 border-b border-muted-gray/20">
                      <div>
                        <div className="text-sm text-bone-white capitalize">
                          {section.replace(/_/g, ' ')}
                        </div>
                        <div className="text-xs text-muted-gray">
                          {section === 'budget_numbers' && 'View actual budget numbers and costs'}
                          {section === 'admin_tools' && 'Access to admin-only tools and settings'}
                        </div>
                      </div>
                      <Switch
                        checked={enabled}
                        onCheckedChange={(checked) => {
                          setEditingProfile({
                            ...editingProfile,
                            config: {
                              ...editingProfile.config,
                              sections: {
                                ...editingProfile.config.sections,
                                [section]: checked,
                              },
                            },
                          });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    const defaultConfig = DEFAULT_VIEW_CONFIGS[editingProfile.role] || DEFAULT_VIEW_CONFIGS.crew;
                    setEditingProfile({
                      ...editingProfile,
                      config: defaultConfig,
                    });
                  }}
                >
                  Reset to Default
                </Button>
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setShowViewProfileDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveViewProfile}
                    disabled={isSubmitting}
                    className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Per-User Permission Editor Dialog */}
      <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-accent-yellow" />
              Permissions for {editingMember?.user_name || editingMember?.user_username}
            </DialogTitle>
            <DialogDescription>
              Customize view and edit permissions for this team member. Changes override their role defaults.
            </DialogDescription>
          </DialogHeader>

          {editUserConfig && (
            <div className="space-y-4 mt-4">
              {/* Tab Permissions */}
              <Accordion type="single" collapsible defaultValue="tabs">
                <AccordionItem value="tabs">
                  <AccordionTrigger className="text-sm font-medium text-bone-white">
                    Tab Permissions
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      {TAB_DEFINITIONS.map(tab => (
                        <div
                          key={tab.key}
                          className="flex items-center justify-between py-2 border-b border-muted-gray/20 last:border-0"
                        >
                          <span className="text-sm text-bone-white">{tab.label}</span>
                          <PermissionToggle
                            value={normalizePermission(editUserConfig.tabs[tab.key])}
                            onChange={(value) => handlePermissionChange('tabs', tab.key, value)}
                          />
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="sections">
                  <AccordionTrigger className="text-sm font-medium text-bone-white">
                    Section Permissions
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      {SECTION_DEFINITIONS.map(section => (
                        <div
                          key={section.key}
                          className="flex items-center justify-between py-2 border-b border-muted-gray/20 last:border-0"
                        >
                          <span className="text-sm text-bone-white">{section.label}</span>
                          <PermissionToggle
                            value={normalizePermission(editUserConfig.sections[section.key])}
                            onChange={(value) => handlePermissionChange('sections', section.key, value)}
                          />
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-muted-gray/20">
            {editingMember && getExistingOverride(editingMember) && (
              <Button
                variant="outline"
                onClick={handleResetPermissions}
                disabled={isSubmitting}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Role Defaults
              </Button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="ghost" onClick={() => setShowPermissionDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSavePermissions}
                disabled={isSubmitting || !hasPermissionChanges}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteRoleId} onOpenChange={(open) => !open && setDeleteRoleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Role?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this role assignment. The user will lose access associated with this role.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveRole}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove Role'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RolesManagementView;
