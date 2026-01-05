/**
 * TeamAccessView - Team & Access management for Backlot projects
 * Allows showrunners to manage team members, assign roles, and configure permissions
 */
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  Shield,
  Search,
  Eye,
  Settings,
  Edit3,
  Check,
  X,
  UserCog,
  ChevronRight,
  Crown,
  Save,
  RotateCcw,
  UserPlus,
} from 'lucide-react';
import {
  useProjectMembers,
  useRoleAssignments,
  useRolePresets,
  useViewProfiles,
  useViewOverrides,
  useEffectiveConfig,
  useRolePreview,
  normalizePermission,
  canViewTab,
  canEditTab,
  type ProjectMemberWithRoles,
  type EffectiveConfig,
  type ViewEditConfig,
  type PermissionValue,
} from '@/hooks/backlot/useProjectAccess';
import { BACKLOT_ROLES } from '@/hooks/backlot/useProjectRoles';
import { useUserSearch } from '@/hooks/useUserSearch';
import AddFromNetworkModal from './AddFromNetworkModal';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TeamAccessViewProps {
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

// Member role badge colors
const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  editor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  viewer: 'bg-gray-500/20 text-gray-500 border-gray-500/30',
};

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
      edit: checked ? value.edit : false, // If view is off, edit must be off too
    });
  };

  const handleEditChange = (checked: boolean) => {
    onChange({
      view: checked ? true : value.view, // If edit is on, view must be on too
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
        <span className="text-sm text-muted-foreground">View</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <Checkbox
          checked={value.edit}
          onCheckedChange={handleEditChange}
          disabled={disabled || !value.view}
        />
        <span className="text-sm text-muted-foreground">Edit</span>
      </label>
    </div>
  );
};

// Member Card Component
const MemberCard: React.FC<{
  member: ProjectMemberWithRoles;
  onEditPermissions: (member: ProjectMemberWithRoles) => void;
  onRemove: (member: ProjectMemberWithRoles) => void;
  onChangeRole: (member: ProjectMemberWithRoles, role: string) => void;
  isLoading?: boolean;
}> = ({ member, onEditPermissions, onRemove, onChangeRole, isLoading }) => {
  const isOwner = member.role === 'owner';
  const displayName = member.user_name || member.user_username || 'Unknown User';
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={member.user_avatar || undefined} />
          <AvatarFallback className="bg-primary/20 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{displayName}</span>
            {isOwner && <Crown className="h-4 w-4 text-yellow-500" />}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={cn('text-xs', ROLE_COLORS[member.role])}>
              {member.role}
            </Badge>
            {member.primary_role && (
              <Badge
                variant="outline"
                className={cn('text-xs', BACKLOT_ROLE_COLORS[member.primary_role] || BACKLOT_ROLE_COLORS.crew)}
              >
                {BACKLOT_ROLES.find(r => r.value === member.primary_role)?.label || member.primary_role}
              </Badge>
            )}
            {member.has_overrides && (
              <Badge variant="outline" className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">
                Custom
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!isOwner && (
          <>
            <Select
              value={member.role}
              onValueChange={(value) => onChangeRole(member, value)}
              disabled={isLoading}
            >
              <SelectTrigger className="w-[100px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEditPermissions(member)}
              disabled={isLoading}
            >
              <UserCog className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onRemove(member)}
              disabled={isLoading}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
        {isOwner && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEditPermissions(member)}
            disabled={isLoading}
          >
            <Eye className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

// Permission Editor Dialog
const PermissionEditorDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: ProjectMemberWithRoles | null;
  projectId: string;
}> = ({ open, onOpenChange, member, projectId }) => {
  const { overrides, updateOverride, deleteOverride } = useViewOverrides(projectId);
  const { data: rolePresets } = useRolePresets(projectId);
  const [editConfig, setEditConfig] = useState<ViewEditConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Get the base config for this member's role
  const baseConfig = useMemo(() => {
    if (!member || !rolePresets) return null;
    const preset = rolePresets.find(p => p.role === member.primary_role);
    return preset?.config || null;
  }, [member, rolePresets]);

  // Get existing override for this member
  const existingOverride = useMemo(() => {
    if (!member) return null;
    return overrides.find(o => o.user_id === member.user_id);
  }, [member, overrides]);

  // Initialize edit config when dialog opens
  React.useEffect(() => {
    if (open && member) {
      if (existingOverride) {
        setEditConfig(existingOverride.config);
      } else if (baseConfig) {
        setEditConfig(JSON.parse(JSON.stringify(baseConfig)));
      }
      setHasChanges(false);
    }
  }, [open, member, existingOverride, baseConfig]);

  const handlePermissionChange = (
    type: 'tabs' | 'sections',
    key: string,
    value: PermissionValue
  ) => {
    if (!editConfig) return;
    setEditConfig({
      ...editConfig,
      [type]: {
        ...editConfig[type],
        [key]: value,
      },
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!member || !editConfig) return;
    setIsSaving(true);
    try {
      await updateOverride.mutateAsync({
        userId: member.user_id,
        config: editConfig,
      });
      toast.success('Permissions saved');
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to save permissions');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!member) return;
    setIsSaving(true);
    try {
      await deleteOverride.mutateAsync(member.user_id);
      toast.success('Permissions reset to role defaults');
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to reset permissions');
    } finally {
      setIsSaving(false);
    }
  };

  if (!member || !editConfig) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Permissions for {member.user_name || member.user_username}
          </DialogTitle>
          <DialogDescription>
            Customize view and edit permissions for this team member. Changes override their role defaults.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tab Permissions */}
          <Accordion type="single" collapsible defaultValue="tabs">
            <AccordionItem value="tabs">
              <AccordionTrigger className="text-sm font-medium">
                Tab Permissions
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {TAB_DEFINITIONS.map(tab => (
                    <div
                      key={tab.key}
                      className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                    >
                      <span className="text-sm">{tab.label}</span>
                      <PermissionToggle
                        value={normalizePermission(editConfig.tabs[tab.key])}
                        onChange={(value) => handlePermissionChange('tabs', tab.key, value)}
                      />
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sections">
              <AccordionTrigger className="text-sm font-medium">
                Section Permissions
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {SECTION_DEFINITIONS.map(section => (
                    <div
                      key={section.key}
                      className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                    >
                      <span className="text-sm">{section.label}</span>
                      <PermissionToggle
                        value={normalizePermission(editConfig.sections[section.key])}
                        onChange={(value) => handlePermissionChange('sections', section.key, value)}
                      />
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          {existingOverride && (
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={isSaving}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Role Defaults
            </Button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Role Presets Editor
const RolePresetsEditor: React.FC<{
  projectId: string;
}> = ({ projectId }) => {
  const { data: rolePresets, isLoading } = useRolePresets(projectId);
  const { viewProfiles, updateProfile, deleteProfile } = useViewProfiles(projectId);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [editConfig, setEditConfig] = useState<ViewEditConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Get the active config for selected role
  const activeConfig = useMemo(() => {
    if (!selectedRole || !rolePresets) return null;
    // Check for custom profile first
    const customProfile = viewProfiles.find(p => p.backlot_role === selectedRole);
    if (customProfile) return customProfile.config;
    // Fall back to default preset
    const preset = rolePresets.find(p => p.role === selectedRole);
    return preset?.config || null;
  }, [selectedRole, rolePresets, viewProfiles]);

  // Check if this role has custom overrides
  const hasCustomProfile = useMemo(() => {
    if (!selectedRole) return false;
    return viewProfiles.some(p => p.backlot_role === selectedRole);
  }, [selectedRole, viewProfiles]);

  React.useEffect(() => {
    if (activeConfig) {
      setEditConfig(JSON.parse(JSON.stringify(activeConfig)));
      setHasChanges(false);
    }
  }, [activeConfig]);

  const handlePermissionChange = (
    type: 'tabs' | 'sections',
    key: string,
    value: PermissionValue
  ) => {
    if (!editConfig) return;
    setEditConfig({
      ...editConfig,
      [type]: {
        ...editConfig[type],
        [key]: value,
      },
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!selectedRole || !editConfig) return;
    setIsSaving(true);
    try {
      await updateProfile.mutateAsync({
        role: selectedRole,
        config: editConfig,
      });
      toast.success('Role preset saved');
      setHasChanges(false);
    } catch (err) {
      toast.error('Failed to save role preset');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!selectedRole) return;
    setIsSaving(true);
    try {
      await deleteProfile.mutateAsync(selectedRole);
      toast.success('Role preset reset to defaults');
      setHasChanges(false);
    } catch (err) {
      toast.error('Failed to reset role preset');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Select value={selectedRole || ''} onValueChange={setSelectedRole}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select a role..." />
          </SelectTrigger>
          <SelectContent>
            {BACKLOT_ROLES.map(role => (
              <SelectItem key={role.value} value={role.value}>
                {role.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedRole && hasCustomProfile && (
          <Badge variant="outline" className="bg-amber-500/20 text-amber-400">
            Custom
          </Badge>
        )}
      </div>

      {selectedRole && editConfig && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              {BACKLOT_ROLES.find(r => r.value === selectedRole)?.label} Permissions
            </CardTitle>
            <CardDescription>
              {BACKLOT_ROLES.find(r => r.value === selectedRole)?.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible defaultValue="tabs">
              <AccordionItem value="tabs">
                <AccordionTrigger className="text-sm font-medium">
                  Tab Permissions
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {TAB_DEFINITIONS.map(tab => (
                      <div
                        key={tab.key}
                        className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                      >
                        <span className="text-sm">{tab.label}</span>
                        <PermissionToggle
                          value={normalizePermission(editConfig.tabs[tab.key])}
                          onChange={(value) => handlePermissionChange('tabs', tab.key, value)}
                        />
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="sections">
                <AccordionTrigger className="text-sm font-medium">
                  Section Permissions
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {SECTION_DEFINITIONS.map(section => (
                      <div
                        key={section.key}
                        className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                      >
                        <span className="text-sm">{section.label}</span>
                        <PermissionToggle
                          value={normalizePermission(editConfig.sections[section.key])}
                          onChange={(value) => handlePermissionChange('sections', section.key, value)}
                        />
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="flex items-center justify-between pt-4 border-t mt-4">
              {hasCustomProfile && (
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={isSaving}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to System Defaults
                </Button>
              )}
              <Button
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                className="ml-auto"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Preset
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!selectedRole && (
        <div className="text-center py-8 text-muted-foreground">
          <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Select a role to customize its default permissions</p>
        </div>
      )}
    </div>
  );
};

// Main TeamAccessView Component
const TeamAccessView: React.FC<TeamAccessViewProps> = ({ projectId }) => {
  const { members, isLoading, addMember, updateMember, removeMember } = useProjectMembers(projectId);
  const { assignRole, removeRole } = useRoleAssignments(projectId);
  const { data: myConfig } = useEffectiveConfig(projectId);

  const [activeTab, setActiveTab] = useState('team');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [editingMember, setEditingMember] = useState<ProjectMemberWithRoles | null>(null);
  const [removingMember, setRemovingMember] = useState<ProjectMemberWithRoles | null>(null);

  // Add member form state
  const [newMemberSearch, setNewMemberSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState('viewer');
  const [selectedBacklotRole, setSelectedBacklotRole] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);

  // User search for adding members
  const { data: searchResults, isLoading: searchingUsers } = useUserSearch(newMemberSearch, { minLength: 2 });

  // Filter members by search
  const filteredMembers = useMemo(() => {
    if (!searchQuery) return members;
    const query = searchQuery.toLowerCase();
    return members.filter(m => {
      const name = m.user_name || m.user_username || '';
      return name.toLowerCase().includes(query);
    });
  }, [members, searchQuery]);

  // Check if user can manage access
  const canManage = myConfig?.is_owner || myConfig?.role === 'showrunner' || canEditTab(myConfig, 'access');

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    setIsAdding(true);
    try {
      await addMember.mutateAsync({
        userId: selectedUserId,
        role: selectedRole,
        backlotRole: selectedBacklotRole || undefined,
      });
      toast.success('Team member added');
      setShowAddDialog(false);
      setSelectedUserId(null);
      setNewMemberSearch('');
      setSelectedRole('viewer');
      setSelectedBacklotRole('');
    } catch (err) {
      toast.error('Failed to add team member');
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddFromNetwork = async (params: {
    userId: string;
    role: string;
    backlotRole?: string;
  }) => {
    await addMember.mutateAsync({
      userId: params.userId,
      role: params.role,
      backlotRole: params.backlotRole,
    });
  };

  const handleChangeRole = async (member: ProjectMemberWithRoles, role: string) => {
    try {
      await updateMember.mutateAsync({
        memberId: member.id,
        role,
      });
      toast.success('Role updated');
    } catch (err) {
      toast.error('Failed to update role');
    }
  };

  const handleRemoveMember = async () => {
    if (!removingMember) return;
    try {
      await removeMember.mutateAsync(removingMember.id);
      toast.success('Team member removed');
      setRemovingMember(null);
    } catch (err) {
      toast.error('Failed to remove team member');
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team & Access
          </h2>
          <p className="text-sm text-muted-foreground">
            {members.length} team member{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowNetworkModal(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add from Network
            </Button>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b px-4">
          <TabsList className="bg-transparent h-auto p-0">
            <TabsTrigger
              value="team"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              Team Members
            </TabsTrigger>
            {canManage && (
              <TabsTrigger
                value="presets"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                Role Presets
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="team" className="flex-1 p-4 space-y-4 m-0">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search team members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Member List */}
          <div className="space-y-2">
            {filteredMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No team members found</p>
              </div>
            ) : (
              filteredMembers.map(member => (
                <MemberCard
                  key={member.id}
                  member={member}
                  onEditPermissions={(m) => setEditingMember(m)}
                  onRemove={(m) => setRemovingMember(m)}
                  onChangeRole={handleChangeRole}
                  isLoading={updateMember.isPending || removeMember.isPending}
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="presets" className="flex-1 p-4 m-0">
          <RolePresetsEditor projectId={projectId} />
        </TabsContent>
      </Tabs>

      {/* Add Member Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Search for a user to add to your project team.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Search Users</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or username..."
                  value={newMemberSearch}
                  onChange={(e) => setNewMemberSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {searchingUsers && (
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching...
                </div>
              )}
              {searchResults && searchResults.length > 0 && (
                <div className="mt-2 border rounded-lg max-h-40 overflow-y-auto">
                  {searchResults.map(user => (
                    <button
                      key={user.id}
                      className={cn(
                        'w-full flex items-center gap-2 p-2 hover:bg-muted/50 text-left transition-colors',
                        selectedUserId === user.id && 'bg-primary/10'
                      )}
                      onClick={() => setSelectedUserId(user.id)}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback>
                          {(user.display_name || user.username || 'U')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm">{user.display_name || user.full_name || user.username}</div>
                        <div className="text-xs text-muted-foreground">@{user.username}</div>
                      </div>
                      {selectedUserId === user.id && (
                        <Check className="h-4 w-4 ml-auto text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Project Role</label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Backlot Role</label>
                <Select value={selectedBacklotRole} onValueChange={setSelectedBacklotRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {BACKLOT_ROLES.map(role => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddMember}
              disabled={!selectedUserId || isAdding}
            >
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Member
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Permission Editor Dialog */}
      <PermissionEditorDialog
        open={!!editingMember}
        onOpenChange={(open) => !open && setEditingMember(null)}
        member={editingMember}
        projectId={projectId}
      />

      {/* Remove Member Confirmation */}
      <AlertDialog open={!!removingMember} onOpenChange={(open) => !open && setRemovingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {removingMember?.user_name || removingMember?.user_username} from this project?
              This will also remove their role assignments and any custom permission overrides.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRemoveMember}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add from Network Modal */}
      <AddFromNetworkModal
        open={showNetworkModal}
        onOpenChange={setShowNetworkModal}
        projectId={projectId}
        onAddMember={handleAddFromNetwork}
      />
    </div>
  );
};

export default TeamAccessView;
