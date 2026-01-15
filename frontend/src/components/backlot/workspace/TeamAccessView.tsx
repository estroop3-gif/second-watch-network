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
  Briefcase,
  FileText,
  Receipt,
  Clock,
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
import {
  useExternalSeats,
  useAddExternalSeat,
  useUpdateExternalSeat,
  useRemoveExternalSeat,
  type ExternalSeat,
} from '@/hooks/backlot/useExternalSeats';
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

// External Seat Card Component
const ExternalSeatCard: React.FC<{
  seat: ExternalSeat;
  onEdit: (seat: ExternalSeat) => void;
  onRemove: (seat: ExternalSeat) => void;
  isLoading?: boolean;
}> = ({ seat, onEdit, onRemove, isLoading }) => {
  const displayName = seat.user_name || seat.user_email || 'Unknown User';
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const isFreelancer = seat.seat_type === 'project';

  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={seat.user_avatar || undefined} />
          <AvatarFallback className="bg-primary/20 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{displayName}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                isFreelancer
                  ? 'bg-green-500/20 text-green-400 border-green-500/30'
                  : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
              )}
            >
              {isFreelancer ? 'Freelancer' : 'Client'}
            </Badge>
            {isFreelancer && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {seat.can_invoice && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Invoice
                  </span>
                )}
                {seat.can_expense && (
                  <span className="flex items-center gap-1">
                    <Receipt className="h-3 w-3" />
                    Expense
                  </span>
                )}
                {seat.can_timecard && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Timecard
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onEdit(seat)}
          disabled={isLoading}
        >
          <UserCog className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => onRemove(seat)}
          disabled={isLoading}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

// External Access Tab Component
const ExternalAccessTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { data: externalSeats, isLoading } = useExternalSeats(projectId);
  const addSeat = useAddExternalSeat(projectId);
  const updateSeat = useUpdateExternalSeat(projectId);
  const removeSeat = useRemoveExternalSeat(projectId);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addSeatType, setAddSeatType] = useState<'project' | 'view_only'>('project');
  const [editingSeat, setEditingSeat] = useState<ExternalSeat | null>(null);
  const [removingSeat, setRemovingSeat] = useState<ExternalSeat | null>(null);

  // Add form state
  const [newUserSearch, setNewUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [canInvoice, setCanInvoice] = useState(true);
  const [canExpense, setCanExpense] = useState(true);
  const [canTimecard, setCanTimecard] = useState(true);

  const { data: searchResults, isLoading: searchingUsers } = useUserSearch(newUserSearch, { minLength: 2 });

  const freelancers = externalSeats?.filter(s => s.seat_type === 'project') || [];
  const clients = externalSeats?.filter(s => s.seat_type === 'view_only') || [];

  const handleAddSeat = async () => {
    if (!selectedUserId) return;
    try {
      await addSeat.mutateAsync({
        userId: selectedUserId,
        seatType: addSeatType,
        canInvoice: addSeatType === 'project' ? canInvoice : false,
        canExpense: addSeatType === 'project' ? canExpense : false,
        canTimecard: addSeatType === 'project' ? canTimecard : false,
        tabPermissions: {},
      });
      toast.success(`${addSeatType === 'project' ? 'Freelancer' : 'Client'} added`);
      setShowAddDialog(false);
      resetAddForm();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add external seat');
    }
  };

  const handleRemoveSeat = async () => {
    if (!removingSeat) return;
    try {
      await removeSeat.mutateAsync(removingSeat.id);
      toast.success('External seat removed');
      setRemovingSeat(null);
    } catch (err) {
      toast.error('Failed to remove external seat');
    }
  };

  const resetAddForm = () => {
    setNewUserSearch('');
    setSelectedUserId(null);
    setCanInvoice(true);
    setCanExpense(true);
    setCanTimecard(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Freelancers Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-green-400" />
                Freelancers
              </CardTitle>
              <CardDescription>
                External contractors who can submit invoices, expenses, and timecards
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setAddSeatType('project');
                setShowAddDialog(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Freelancer
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {freelancers.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No freelancers added yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {freelancers.map(seat => (
                <ExternalSeatCard
                  key={seat.id}
                  seat={seat}
                  onEdit={setEditingSeat}
                  onRemove={setRemovingSeat}
                  isLoading={removeSeat.isPending || updateSeat.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clients Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-400" />
                Clients
              </CardTitle>
              <CardDescription>
                External viewers with limited, configurable access to project tabs
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setAddSeatType('view_only');
                setShowAddDialog(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Eye className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No clients added yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {clients.map(seat => (
                <ExternalSeatCard
                  key={seat.id}
                  seat={seat}
                  onEdit={setEditingSeat}
                  onRemove={setRemovingSeat}
                  isLoading={removeSeat.isPending || updateSeat.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add External Seat Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        setShowAddDialog(open);
        if (!open) resetAddForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add {addSeatType === 'project' ? 'Freelancer' : 'Client'}
            </DialogTitle>
            <DialogDescription>
              {addSeatType === 'project'
                ? 'Add a freelancer who can submit invoices, expenses, and timecards for this project.'
                : 'Add a client with limited view access to specific project tabs.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Search Users</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or username..."
                  value={newUserSearch}
                  onChange={(e) => setNewUserSearch(e.target.value)}
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

            {addSeatType === 'project' && (
              <div className="space-y-3 p-4 rounded-lg bg-muted/30">
                <label className="text-sm font-medium">Freelancer Permissions</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={canInvoice}
                      onCheckedChange={(checked) => setCanInvoice(!!checked)}
                    />
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Can submit invoices</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={canExpense}
                      onCheckedChange={(checked) => setCanExpense(!!checked)}
                    />
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Can submit expenses</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={canTimecard}
                      onCheckedChange={(checked) => setCanTimecard(!!checked)}
                    />
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Can submit timecards</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddSeat}
              disabled={!selectedUserId || addSeat.isPending}
            >
              {addSeat.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Add {addSeatType === 'project' ? 'Freelancer' : 'Client'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit External Seat Dialog (TODO: Add tab permissions editor for clients) */}
      <Dialog open={!!editingSeat} onOpenChange={(open) => !open && setEditingSeat(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit {editingSeat?.seat_type === 'project' ? 'Freelancer' : 'Client'} Permissions
            </DialogTitle>
            <DialogDescription>
              Configure permissions for {editingSeat?.user_name || editingSeat?.user_email}
            </DialogDescription>
          </DialogHeader>

          {editingSeat?.seat_type === 'project' && (
            <div className="space-y-3 p-4 rounded-lg bg-muted/30">
              <label className="text-sm font-medium">Freelancer Permissions</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={editingSeat.can_invoice}
                    onCheckedChange={(checked) => {
                      updateSeat.mutate({
                        seatId: editingSeat.id,
                        canInvoice: !!checked,
                      });
                    }}
                  />
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Can submit invoices</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={editingSeat.can_expense}
                    onCheckedChange={(checked) => {
                      updateSeat.mutate({
                        seatId: editingSeat.id,
                        canExpense: !!checked,
                      });
                    }}
                  />
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Can submit expenses</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={editingSeat.can_timecard}
                    onCheckedChange={(checked) => {
                      updateSeat.mutate({
                        seatId: editingSeat.id,
                        canTimecard: !!checked,
                      });
                    }}
                  />
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Can submit timecards</span>
                </label>
              </div>
            </div>
          )}

          {editingSeat?.seat_type === 'view_only' && (
            <div className="text-center py-6 text-muted-foreground">
              <Settings className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Tab permissions editor coming soon</p>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={() => setEditingSeat(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={!!removingSeat} onOpenChange={(open) => !open && setRemovingSeat(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove External Access</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {removingSeat?.user_name || removingSeat?.user_email} from this project?
              {removingSeat?.seat_type === 'project' && (
                <span className="block mt-2 text-amber-400">
                  Any work items (invoices, expenses, timecards) submitted by this freelancer will be transferred to the project owner.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRemoveSeat}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
            {canManage && (
              <TabsTrigger
                value="external"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                External Access
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

        <TabsContent value="external" className="flex-1 p-4 m-0">
          <ExternalAccessTab projectId={projectId} />
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
