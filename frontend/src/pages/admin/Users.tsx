import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronUp,
  Users,
  Shield,
  HardDrive,
  UserPlus,
  Plus,
  Lock,
  Pencil,
  Trash2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import EditRolesDialog from '@/components/admin/EditRolesDialog';
import DeleteUserConfirmationDialog from '@/components/admin/DeleteUserConfirmationDialog';
import UserStatsHeader from '@/components/admin/UserStatsHeader';
import UserFilters, { FilterState } from '@/components/admin/UserFilters';
import UserDetailDrawer from '@/components/admin/UserDetailDrawer';
import BulkActionsBar from '@/components/admin/BulkActionsBar';

// Format bytes to human readable
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Quota presets in GB
const QUOTA_PRESETS = [
  { label: '1 GB', value: 1073741824 },
  { label: '5 GB', value: 5368709120 },
  { label: '10 GB', value: 10737418240 },
  { label: '20 GB', value: 21474836480 },
  { label: '50 GB', value: 53687091200 },
  { label: '100 GB', value: 107374182400 },
];

// Permission structure for the role editor
const PERMISSION_CATEGORIES = {
  backlot: {
    parent: 'can_access_backlot',
    label: 'Backlot Access',
    description: 'Production management features',
    children: {
      backlot_overview: 'Overview Tab',
      backlot_scripts: 'Scripts & Breakdowns',
      backlot_callsheets: 'Call Sheets',
      backlot_casting: 'Casting & Crew',
      backlot_scenes: 'Scenes & Shots',
      backlot_continuity: 'Continuity',
      backlot_hotset: 'Hot Set Tracking',
      backlot_invoices: 'Invoices',
      backlot_timecards: 'Timecards',
      backlot_expenses: 'Expenses',
      backlot_budget: 'Budget',
      backlot_team: 'Team Management',
      backlot_files: 'Files & Media',
      backlot_coms: 'Production Coms',
      backlot_clearances: 'Clearances',
      backlot_credits: 'Credits',
    },
  },
  greenroom: {
    parent: 'can_access_greenroom',
    label: 'Green Room Access',
    description: 'Development & voting features',
    children: {
      greenroom_cycles: 'Voting Cycles',
      greenroom_submit: 'Submit Projects',
      greenroom_vote: 'Vote',
      greenroom_results: 'View Results',
    },
  },
  forum: {
    parent: 'can_access_forum',
    label: 'Forum Access',
    description: 'Forum discussion features',
    children: {
      forum_read: 'Read Forum',
      forum_post: 'Create Threads',
      forum_reply: 'Reply to Threads',
      forum_react: 'React to Posts',
    },
  },
  community: {
    parent: 'can_access_community',
    label: 'Community Access',
    description: 'Community & collaboration features',
    children: {
      community_collabs: 'Collabs',
      community_apply_collabs: 'Apply to Collabs',
      community_directory: 'Member Directory',
      community_connections: 'Connections',
      community_feed_view: 'View Feed',
      community_feed_post: 'Create Posts',
      community_feed_comment: 'Comment on Posts',
      community_feed_like: 'Like Posts',
    },
  },
  messages: {
    parent: 'can_access_messages',
    label: 'Messaging',
    description: 'Direct messaging features',
    children: {
      messages_dm: 'Direct Messages',
      messages_group: 'Group Chats',
      messages_attachments: 'Attachments',
    },
  },
  submissions: {
    parent: 'can_access_submissions',
    label: 'Submissions',
    description: 'Content submission features',
    children: {
      submissions_create: 'Submit Content',
      submissions_view: 'View Submissions',
    },
  },
  order: {
    parent: 'can_access_order',
    label: 'The Order',
    description: 'Second Watch Order features',
    children: {
      order_directory: 'Member Directory',
      order_jobs: 'Order Jobs',
      order_post_jobs: 'Post Jobs',
      order_lodges: 'Lodges',
      order_manage_lodge: 'Manage Lodge',
    },
  },
  profile: {
    parent: 'can_access_profile',
    label: 'Profile',
    description: 'Profile management features',
    children: {
      profile_edit: 'Edit Profile',
      profile_availability: 'Availability',
      profile_resume: 'Resume/Portfolio',
      profile_filmmaker: 'Filmmaker Profile',
    },
  },
  moderation: {
    parent: 'can_moderate',
    label: 'Moderation',
    description: 'Content moderation features',
    children: {
      mod_warn_users: 'Warn Users',
      mod_mute_users: 'Mute Users',
      mod_ban_users: 'Ban Users',
      mod_delete_content: 'Delete Content',
      mod_review_reports: 'Review Reports',
      mod_review_flags: 'Review Flags',
    },
  },
  admin: {
    parent: 'can_admin',
    label: 'Admin',
    description: 'Administrative features',
    children: {
      admin_users: 'Manage Users',
      admin_roles: 'Manage Roles',
      admin_applications: 'Review Applications',
      admin_submissions: 'Manage Submissions',
      admin_greenroom: 'Manage Green Room',
      admin_forum: 'Manage Forum',
      admin_settings: 'Site Settings',
      admin_billing: 'Billing',
      admin_audit: 'Audit Logs',
    },
  },
};

// Legacy mapping for table display
const PERMISSION_LABELS: Record<string, string> = {
  can_access_backlot: 'Backlot Access',
  can_access_greenroom: 'Green Room Access',
  can_access_forum: 'Forum Access',
  can_access_community: 'Community Access',
  can_submit_content: 'Submit Content',
  can_upload_files: 'Upload Files',
  can_create_projects: 'Create Projects',
  can_invite_collaborators: 'Invite Collaborators',
};

interface User {
  id: string;
  email: string;
  created_at: string;
  full_name?: string;
  profile: {
    username: string;
    roles: string[];
    avatar_url: string;
    is_banned: boolean;
  };
}

const PAGE_SIZES = [25, 50, 100];

// =====================================================
// Create User Dialog
// =====================================================
function CreateUserDialog({
  open,
  onClose,
  roles,
}: {
  open: boolean;
  onClose: () => void;
  roles: any[];
}) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [customQuota, setCustomQuota] = useState<number | null>(null);
  const [sendEmail, setSendEmail] = useState(true);

  const createMutation = useMutation({
    mutationFn: () =>
      api.adminCreateUser({
        email,
        display_name: displayName,
        role_ids: selectedRoles,
        custom_quota_bytes: customQuota || undefined,
        send_welcome_email: sendEmail,
      }),
    onSuccess: (data) => {
      toast.success(data.message);
      if (data.temp_password) {
        toast.info(`Temporary password: ${data.temp_password}`, { duration: 10000 });
      }
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      onClose();
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create user');
    },
  });

  const resetForm = () => {
    setEmail('');
    setDisplayName('');
    setSelectedRoles([]);
    setCustomQuota(null);
    setSendEmail(true);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-charcoal-black border-muted-gray max-w-md">
        <DialogHeader>
          <DialogTitle className="text-bone-white flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Create New User
          </DialogTitle>
          <DialogDescription>
            Create a new user account. They will receive an email with login instructions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="bg-muted-gray/20 border-muted-gray"
            />
          </div>

          <div>
            <Label htmlFor="displayName">Display Name *</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="John Doe"
              className="bg-muted-gray/20 border-muted-gray"
            />
          </div>

          <div>
            <Label>Assign Roles</Label>
            <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
              {roles.map((role) => (
                <div key={role.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`role-${role.id}`}
                    checked={selectedRoles.includes(role.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedRoles([...selectedRoles, role.id]);
                      } else {
                        setSelectedRoles(selectedRoles.filter((id) => id !== role.id));
                      }
                    }}
                  />
                  <label htmlFor={`role-${role.id}`} className="text-sm flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: role.color }}
                    />
                    {role.display_name}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Custom Storage Quota (optional)</Label>
            <Select
              value={customQuota?.toString() || 'default'}
              onValueChange={(val) => setCustomQuota(val === 'default' ? null : parseInt(val))}
            >
              <SelectTrigger className="bg-muted-gray/20 border-muted-gray">
                <SelectValue placeholder="Use role default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Use role default</SelectItem>
                {QUOTA_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value.toString()}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="sendEmail"
              checked={sendEmail}
              onCheckedChange={(checked) => setSendEmail(checked as boolean)}
            />
            <label htmlFor="sendEmail" className="text-sm">
              Send welcome email with login instructions
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!email || !displayName || createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating...' : 'Create User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper to get all permission keys
const getAllPermissionKeys = () => {
  const keys: string[] = [];
  Object.values(PERMISSION_CATEGORIES).forEach((cat) => {
    keys.push(cat.parent);
    Object.keys(cat.children).forEach((k) => keys.push(k));
  });
  // Add legacy permissions
  keys.push('can_submit_content', 'can_upload_files', 'can_create_projects', 'can_invite_collaborators');
  return keys;
};

// Helper to create default permissions object
const createDefaultPermissions = (role?: any) => {
  const perms: Record<string, boolean> = {};
  getAllPermissionKeys().forEach((key) => {
    perms[key] = role?.[key] || false;
  });
  return perms;
};

// =====================================================
// Permission Category Section (Collapsible)
// =====================================================
function PermissionSection({
  categoryKey,
  category,
  permissions,
  onPermissionChange,
}: {
  categoryKey: string;
  category: typeof PERMISSION_CATEGORIES.backlot;
  permissions: Record<string, boolean>;
  onPermissionChange: (key: string, value: boolean) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const parentEnabled = permissions[category.parent] || false;
  const childKeys = Object.keys(category.children);
  const enabledChildCount = childKeys.filter((k) => permissions[k]).length;

  // Handle parent toggle - cascades to all children
  const handleParentToggle = (checked: boolean) => {
    onPermissionChange(category.parent, checked);
    childKeys.forEach((key) => {
      onPermissionChange(key, checked);
    });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border border-muted-gray rounded-lg">
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted-gray/10">
          <div className="flex items-center gap-3">
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-gray" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-gray" />
            )}
            <div>
              <span className="font-medium text-bone-white">{category.label}</span>
              <span className="text-xs text-muted-gray ml-2">
                ({enabledChildCount}/{childKeys.length})
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <span className={`text-xs ${parentEnabled ? 'text-green-500' : 'text-muted-gray'}`}>
              {parentEnabled ? 'ON' : 'OFF'}
            </span>
            <Switch
              checked={parentEnabled}
              onCheckedChange={handleParentToggle}
            />
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pb-3 pt-1 border-t border-muted-gray/50 space-y-2">
          <p className="text-xs text-muted-gray mb-2">{category.description}</p>
          {Object.entries(category.children).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between pl-6 py-1">
              <label htmlFor={key} className="text-sm text-bone-white/80">
                {label}
              </label>
              <Checkbox
                id={key}
                checked={permissions[key] || false}
                onCheckedChange={(checked) => onPermissionChange(key, checked as boolean)}
                disabled={!parentEnabled}
              />
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// =====================================================
// Edit Role Dialog
// =====================================================
function EditRoleDialogCustom({
  open,
  onClose,
  role,
}: {
  open: boolean;
  onClose: () => void;
  role?: any;
}) {
  const queryClient = useQueryClient();
  const isNew = !role;

  const [name, setName] = useState(role?.name || '');
  const [displayName, setDisplayName] = useState(role?.display_name || '');
  const [description, setDescription] = useState(role?.description || '');
  const [color, setColor] = useState(role?.color || '#6B7280');
  const [quotaBytes, setQuotaBytes] = useState(role?.storage_quota_bytes || 1073741824);
  const [permissions, setPermissions] = useState<Record<string, boolean>>(() => createDefaultPermissions(role));

  // Reset form when role changes (opening dialog with different role)
  React.useEffect(() => {
    if (open) {
      setName(role?.name || '');
      setDisplayName(role?.display_name || '');
      setDescription(role?.description || '');
      setColor(role?.color || '#6B7280');
      setQuotaBytes(role?.storage_quota_bytes || 1073741824);
      setPermissions(createDefaultPermissions(role));
    }
  }, [open, role]);

  const handlePermissionChange = useCallback((key: string, value: boolean) => {
    setPermissions((prev) => ({ ...prev, [key]: value }));
  }, []);

  const mutation = useMutation({
    mutationFn: () => {
      if (isNew) {
        return api.createCustomRole({
          name,
          display_name: displayName,
          description,
          color,
          storage_quota_bytes: quotaBytes,
          permissions,
        });
      }
      return api.updateCustomRole(role.id, {
        display_name: displayName,
        description,
        color,
        storage_quota_bytes: quotaBytes,
        permissions,
      });
    },
    onSuccess: () => {
      toast.success(isNew ? 'Role created' : 'Role updated');
      queryClient.invalidateQueries({ queryKey: ['custom-roles'] });
      // Invalidate all users' live permissions so they get the updated role permissions
      queryClient.invalidateQueries({ queryKey: ['live-permissions'] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save role');
    },
  });

  const colorPresets = ['#6B7280', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-charcoal-black border-muted-gray max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-bone-white flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {isNew ? 'Create New Role' : 'Edit Role'}
            {role?.is_system_role && (
              <Badge variant="outline" className="ml-2 text-xs border-amber-500 text-amber-500">
                <Lock className="h-3 w-3 mr-1" />
                System
              </Badge>
            )}
          </DialogTitle>
          {role?.is_system_role ? (
            <DialogDescription className="text-amber-500/80">
              This is a system role. Changes will affect core platform functionality.
            </DialogDescription>
          ) : (
            <DialogDescription className="text-muted-gray">
              {isNew ? 'Create a new custom role with specific permissions.' : 'Modify role settings and permissions.'}
            </DialogDescription>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              {isNew && (
                <div>
                  <Label htmlFor="roleName">Role Name (internal) *</Label>
                  <Input
                    id="roleName"
                    value={name}
                    onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s/g, '_'))}
                    placeholder="my_custom_role"
                    className="bg-muted-gray/20 border-muted-gray"
                  />
                </div>
              )}
              <div className={isNew ? '' : 'col-span-2'}>
                <Label htmlFor="roleDisplayName">Display Name *</Label>
                <Input
                  id="roleDisplayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="My Custom Role"
                  className="bg-muted-gray/20 border-muted-gray"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="roleDescription">Description</Label>
              <Textarea
                id="roleDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this role is for..."
                className="bg-muted-gray/20 border-muted-gray h-16"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Color</Label>
                <div className="flex gap-2 mt-2">
                  {colorPresets.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`w-7 h-7 rounded-full border-2 ${
                        color === c ? 'border-white' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-7 h-7 rounded cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <Label>Storage Quota</Label>
                <Select
                  value={quotaBytes.toString()}
                  onValueChange={(val) => setQuotaBytes(parseInt(val))}
                >
                  <SelectTrigger className="bg-muted-gray/20 border-muted-gray mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUOTA_PRESETS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value.toString()}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Permissions */}
            <div className="pt-2">
              <Label className="text-base">Permissions</Label>
              <p className="text-xs text-muted-gray mb-3">
                Toggle categories ON to enable all permissions within. Expand to customize individual features.
              </p>
              <div className="space-y-2">
                {Object.entries(PERMISSION_CATEGORIES).map(([key, category]) => (
                  <PermissionSection
                    key={key}
                    categoryKey={key}
                    category={category}
                    permissions={permissions}
                    onPermissionChange={handlePermissionChange}
                  />
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!displayName || mutation.isPending}
          >
            {mutation.isPending ? 'Saving...' : isNew ? 'Create Role' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================
// Roles Tab
// =====================================================
function RolesTab() {
  const [editRole, setEditRole] = useState<any>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['custom-roles'],
    queryFn: () => api.listCustomRoles(),
  });

  const deleteMutation = useMutation({
    mutationFn: (roleId: string) => api.deleteCustomRole(roleId),
    onSuccess: () => {
      toast.success('Role deleted');
      queryClient.invalidateQueries({ queryKey: ['custom-roles'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete role');
    },
  });

  const roles = data?.roles || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-bone-white">Custom Roles</h3>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Role
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-muted-gray overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-muted-gray">
                <TableHead className="text-muted-gray">Role</TableHead>
                <TableHead className="text-muted-gray">Users</TableHead>
                <TableHead className="text-muted-gray">Quota</TableHead>
                <TableHead className="text-muted-gray">Permissions</TableHead>
                <TableHead className="text-muted-gray text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role: any) => (
                <TableRow key={role.id} className="border-muted-gray">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {role.is_system_role && <Lock className="h-4 w-4 text-muted-gray" />}
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: role.color }}
                      />
                      <span className="text-bone-white font-medium">{role.display_name}</span>
                    </div>
                    {role.description && (
                      <p className="text-xs text-muted-gray mt-1">{role.description}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-bone-white">{role.user_count}</TableCell>
                  <TableCell className="text-bone-white">
                    {formatBytes(role.storage_quota_bytes)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(PERMISSION_LABELS)
                        .filter(([key]) => role[key])
                        .slice(0, 3)
                        .map(([key, label]) => (
                          <Badge key={key} variant="secondary" className="text-xs">
                            {label.split(' ')[0]}
                          </Badge>
                        ))}
                      {Object.entries(PERMISSION_LABELS).filter(([key]) => role[key]).length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{Object.entries(PERMISSION_LABELS).filter(([key]) => role[key]).length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditRole(role)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('Delete this role?')) {
                          deleteMutation.mutate(role.id);
                        }
                      }}
                      disabled={role.is_system_role || role.user_count > 0}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <EditRoleDialogCustom
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />
      {editRole && (
        <EditRoleDialogCustom
          open={!!editRole}
          onClose={() => setEditRole(null)}
          role={editRole}
        />
      )}
    </div>
  );
}

// =====================================================
// Storage Tab
// =====================================================
function StorageTab() {
  const queryClient = useQueryClient();

  const { data: overview, isLoading } = useQuery({
    queryKey: ['storage-overview'],
    queryFn: () => api.getStorageOverview(),
  });

  const recalculateMutation = useMutation({
    mutationFn: () => api.recalculateStorage(),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['storage-overview'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to recalculate');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-charcoal-black border-muted-gray">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-gray">Total Storage Used</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-bone-white">{overview?.total_formatted}</p>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-gray">Backlot Files</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-bone-white">
              {overview?.breakdown?.backlot_files?.formatted}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-gray">Users with Storage</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-bone-white">{overview?.users_with_storage}</p>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-gray">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-bone-white">{overview?.total_users}</p>
          </CardContent>
        </Card>
      </div>

      {/* Users Near Quota */}
      {(overview?.users_near_quota?.length ?? 0) > 0 && (
        <Card className="bg-charcoal-black border-amber-500/50">
          <CardHeader>
            <CardTitle className="text-bone-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Users Near Quota ({'>'}80%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {overview?.users_near_quota?.map((user: any) => (
                <div key={user.user_id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{user.display_name?.[0] || user.email?.[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-bone-white">
                        {user.display_name || user.email}
                      </p>
                      <p className="text-xs text-muted-gray">
                        {user.bytes_used_formatted} / {user.quota_formatted}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={user.percentage} className="w-24 h-2" />
                    <span className="text-sm text-amber-500 font-medium">{user.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Users */}
      <Card className="bg-charcoal-black border-muted-gray">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-bone-white">Top Storage Users</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => recalculateMutation.mutate()}
            disabled={recalculateMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${recalculateMutation.isPending ? 'animate-spin' : ''}`} />
            Recalculate
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {overview?.top_users?.map((user: any) => (
              <div key={user.user_id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback>{user.display_name?.[0] || user.email?.[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-bone-white">
                      {user.display_name || user.email}
                    </p>
                    <p className="text-xs text-muted-gray">{user.email}</p>
                  </div>
                </div>
                <span className="text-sm font-medium text-bone-white">
                  {user.bytes_used_formatted}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const UserManagement = () => {
  const queryClient = useQueryClient();

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    roles: [],
    status: 'all',
    dateFrom: '',
    dateTo: '',
  });

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Dialog states
  const [isRolesDialogOpen, setIsRolesDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);

  // Fetch custom roles for the create user dialog
  const { data: rolesData } = useQuery({
    queryKey: ['custom-roles'],
    queryFn: () => api.listCustomRoles(),
  });
  const customRoles = rolesData?.roles || [];

  // Query with filters and pagination
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users', page, pageSize, filters],
    queryFn: () =>
      api.getAllUsersAdmin({
        skip: (page - 1) * pageSize,
        limit: pageSize,
        search: filters.search || undefined,
        roles: filters.roles.length > 0 ? filters.roles.join(',') : undefined,
        status: filters.status !== 'all' ? filters.status : undefined,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
      }),
  });

  const users = data?.users || [];
  const totalUsers = data?.total || 0;
  const totalPages = data?.pages || 1;

  const handleFiltersChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page on filter change
    setSelectedIds([]); // Clear selection on filter change
  }, []);

  const handleOpenRolesDialog = (user: User) => {
    setSelectedUser(user);
    setIsRolesDialogOpen(true);
  };

  const handleOpenDeleteDialog = (user: User) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const handleRowClick = (userId: string) => {
    setDetailUserId(userId);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === users.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(users.map((u) => u.id));
    }
  };

  const handleSelectUser = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const banUserMutation = useMutation({
    mutationFn: async ({ userId, ban }: { userId: string; ban: boolean }) => {
      await api.banUser(userId, ban);
    },
    onSuccess: (_, { ban }) => {
      toast.success(`User has been successfully ${ban ? 'banned' : 'unbanned'}.`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-stats'] });
    },
    onError: (error: any) => {
      toast.error(`Failed to update ban status: ${error.message}`);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.deleteUser(userId);
    },
    onSuccess: () => {
      toast.success('User has been permanently deleted.');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-stats'] });
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to delete user: ${error.message}`);
    },
  });

  const handleConfirmDelete = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl md:text-5xl font-heading tracking-tighter">
              User <span className="text-accent-yellow">Management</span>
            </h1>
            <p className="text-muted-gray mt-1">Manage platform users, roles, and permissions</p>
          </div>
          <Button onClick={() => setShowCreateUserDialog(true)} className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
            <UserPlus className="h-4 w-4 mr-2" />
            Create User
          </Button>
        </div>
      </motion.div>

      {/* Stats Header */}
      <UserStatsHeader />

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="bg-muted-gray/20 border border-muted-gray">
          <TabsTrigger value="users" className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Users className="h-4 w-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="roles" className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Shield className="h-4 w-4 mr-2" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="storage" className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <HardDrive className="h-4 w-4 mr-2" />
            Storage
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <UserFilters onFiltersChange={handleFiltersChange} initialFilters={filters} />
      </motion.div>

      {/* Results info and page size */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-gray">
          {isLoading ? (
            'Loading...'
          ) : (
            <>
              Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, totalUsers)} of{' '}
              <span className="text-bone-white">{totalUsers.toLocaleString()}</span> users
            </>
          )}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-gray">Per page:</span>
          <Select
            value={pageSize.toString()}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[70px] bg-charcoal-black border-muted-gray text-bone-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-charcoal-black border-muted-gray">
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={size.toString()} className="text-bone-white">
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="border-2 border-muted-gray bg-charcoal-black/50"
      >
        {isLoading ? (
          <div className="text-center py-12 text-accent-yellow animate-pulse">
            Loading users...
          </div>
        ) : error ? (
          <div className="text-center py-12 text-primary-red">
            Error loading users. Please try again.
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-muted-gray">
            No users found matching your filters.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b-muted-gray hover:bg-transparent">
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={selectedIds.length === users.length && users.length > 0}
                    onCheckedChange={handleSelectAll}
                    className="border-muted-gray data-[state=checked]:bg-accent-yellow data-[state=checked]:border-accent-yellow"
                  />
                </TableHead>
                <TableHead className="w-[60px]">Avatar</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow
                  key={user.id}
                  className={`border-b-muted-gray hover:bg-muted-gray/10 cursor-pointer ${
                    selectedIds.includes(user.id) ? 'bg-accent-yellow/10' : ''
                  }`}
                  onClick={() => handleRowClick(user.id)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.includes(user.id)}
                      onCheckedChange={() => handleSelectUser(user.id)}
                      className="border-muted-gray data-[state=checked]:bg-accent-yellow data-[state=checked]:border-accent-yellow"
                    />
                  </TableCell>
                  <TableCell>
                    <Avatar className="h-10 w-10 border border-muted-gray">
                      <AvatarImage src={user.profile?.avatar_url} />
                      <AvatarFallback className="bg-muted-gray text-bone-white">
                        {user.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-bone-white">
                      {user.full_name || user.profile?.username || 'N/A'}
                    </div>
                    <div className="text-sm text-muted-gray">
                      {user.profile?.username && `@${user.profile.username}`}
                    </div>
                    <div className="text-xs text-muted-gray/70">{user.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {user.profile?.roles?.slice(0, 3).map((role: string) => (
                        <Badge
                          key={role}
                          variant="outline"
                          className="text-xs border-muted-gray text-bone-white"
                        >
                          {role.replace('_', ' ')}
                        </Badge>
                      ))}
                      {user.profile?.roles?.length > 3 && (
                        <Badge variant="outline" className="text-xs border-muted-gray text-muted-gray">
                          +{user.profile.roles.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.profile?.is_banned ? (
                      <Badge variant="destructive" className="bg-primary-red text-bone-white">
                        Banned
                      </Badge>
                    ) : (
                      <Badge className="bg-green-600 text-bone-white">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-gray">
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted-gray/30">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="bg-charcoal-black border-muted-gray text-bone-white"
                      >
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                          className="cursor-pointer focus:bg-muted-gray/50"
                          onSelect={() => handleRowClick(user.id)}
                        >
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer focus:bg-muted-gray/50"
                          onSelect={() => handleOpenRolesDialog(user)}
                        >
                          Edit Roles
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-muted-gray" />
                        <DropdownMenuItem
                          className="cursor-pointer focus:bg-primary-red/20 text-primary-red"
                          onSelect={(e) => {
                            e.preventDefault();
                            banUserMutation.mutate({
                              userId: user.id,
                              ban: !user.profile?.is_banned,
                            });
                          }}
                        >
                          {user.profile?.is_banned ? 'Unban User' : 'Ban User'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer focus:bg-primary-red/20 text-primary-red"
                          onSelect={() => handleOpenDeleteDialog(user)}
                        >
                          Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="bg-charcoal-black border-muted-gray text-bone-white disabled:opacity-50"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="bg-charcoal-black border-muted-gray text-bone-white disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1 px-2">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }

              return (
                <Button
                  key={pageNum}
                  variant={page === pageNum ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPage(pageNum)}
                  className={
                    page === pageNum
                      ? 'bg-accent-yellow text-charcoal-black'
                      : 'bg-charcoal-black border-muted-gray text-bone-white'
                  }
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="bg-charcoal-black border-muted-gray text-bone-white disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            className="bg-charcoal-black border-muted-gray text-bone-white disabled:opacity-50"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      )}
        </TabsContent>

        <TabsContent value="roles">
          <RolesTab />
        </TabsContent>

        <TabsContent value="storage">
          <StorageTab />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <EditRolesDialog
        user={selectedUser}
        isOpen={isRolesDialogOpen}
        onClose={() => setIsRolesDialogOpen(false)}
      />
      <DeleteUserConfirmationDialog
        user={userToDelete}
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteUserMutation.isPending}
      />
      <CreateUserDialog
        open={showCreateUserDialog}
        onClose={() => setShowCreateUserDialog(false)}
        roles={customRoles}
      />

      {/* User Detail Drawer */}
      <UserDetailDrawer userId={detailUserId} onClose={() => setDetailUserId(null)} />

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds([])}
      />
    </div>
  );
};

export default UserManagement;
