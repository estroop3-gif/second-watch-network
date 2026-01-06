/**
 * Settings View
 * Manage organization settings, members, categories, and locations
 */
import React, { useState } from 'react';
import {
  Settings,
  Users,
  FolderTree,
  MapPin,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Check,
  X,
  Shield,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  useGearOrgMembers,
  useGearOrgSettings,
  useGearCategories,
  useGearLocations,
} from '@/hooks/gear';
import type { GearOrganization, GearOrganizationMember, OrganizationMemberRole } from '@/types/gear';
import { cn } from '@/lib/utils';

const ROLE_CONFIG: Record<OrganizationMemberRole, { label: string; color: string }> = {
  owner: { label: 'Owner', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  admin: { label: 'Admin', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  manager: { label: 'Manager', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  member: { label: 'Member', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

interface SettingsViewProps {
  orgId: string;
  organization: GearOrganization;
}

export function SettingsView({ orgId, organization }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'members' | 'categories' | 'locations'>(
    'general'
  );

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="bg-charcoal-black/50 border border-muted-gray/30">
          <TabsTrigger value="general">
            <Settings className="w-4 h-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="members">
            <Users className="w-4 h-4 mr-2" />
            Members
          </TabsTrigger>
          <TabsTrigger value="categories">
            <FolderTree className="w-4 h-4 mr-2" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="locations">
            <MapPin className="w-4 h-4 mr-2" />
            Locations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <GeneralSettings orgId={orgId} />
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <MembersSettings orgId={orgId} />
        </TabsContent>

        <TabsContent value="categories" className="mt-6">
          <CategoriesSettings orgId={orgId} />
        </TabsContent>

        <TabsContent value="locations" className="mt-6">
          <LocationsSettings orgId={orgId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// GENERAL SETTINGS
// ============================================================================

function GeneralSettings({ orgId }: { orgId: string }) {
  const { settings, isLoading, updateSettings } = useGearOrgSettings(orgId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Checkout Settings */}
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-base">Checkout Settings</CardTitle>
          <CardDescription>Configure default checkout behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Default Checkout Duration (days)</Label>
              <Input
                type="number"
                value={settings?.default_checkout_duration_days ?? 7}
                className="w-32"
                onChange={(e) =>
                  updateSettings.mutate({
                    default_checkout_duration_days: parseInt(e.target.value, 10),
                  })
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Require Condition Photos</Label>
              <p className="text-sm text-muted-gray">Require photos during checkout/checkin</p>
            </div>
            <Switch
              checked={settings?.require_condition_photos ?? false}
              onCheckedChange={(checked) =>
                updateSettings.mutate({ require_condition_photos: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Barcode Settings */}
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-base">Barcode Settings</CardTitle>
          <CardDescription>Configure barcode generation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-generate Barcodes</Label>
              <p className="text-sm text-muted-gray">Automatically generate barcodes for new assets</p>
            </div>
            <Switch
              checked={settings?.auto_generate_barcodes ?? true}
              onCheckedChange={(checked) =>
                updateSettings.mutate({ auto_generate_barcodes: checked })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Barcode Format</Label>
              <Select
                value={settings?.barcode_format ?? 'CODE128'}
                onValueChange={(value) => updateSettings.mutate({ barcode_format: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CODE128">Code 128</SelectItem>
                  <SelectItem value="CODE39">Code 39</SelectItem>
                  <SelectItem value="EAN13">EAN-13</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Barcode Prefix</Label>
              <Input
                value={settings?.barcode_prefix ?? ''}
                placeholder="e.g., GH-"
                onChange={(e) => updateSettings.mutate({ barcode_prefix: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strike Settings */}
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-base">Strike System</CardTitle>
          <CardDescription>Configure user accountability</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Strikes</Label>
              <p className="text-sm text-muted-gray">Track user violations with strikes</p>
            </div>
            <Switch
              checked={settings?.enable_strikes ?? true}
              onCheckedChange={(checked) => updateSettings.mutate({ enable_strikes: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-apply Strikes</Label>
              <p className="text-sm text-muted-gray">Automatically issue strikes based on rules</p>
            </div>
            <Switch
              checked={settings?.enable_auto_strikes ?? false}
              onCheckedChange={(checked) => updateSettings.mutate({ enable_auto_strikes: checked })}
            />
          </div>

          <div>
            <Label>Strikes Before Suspension</Label>
            <Input
              type="number"
              value={settings?.strikes_before_suspension ?? 3}
              className="w-32"
              onChange={(e) =>
                updateSettings.mutate({
                  strikes_before_suspension: parseInt(e.target.value, 10),
                })
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// MEMBERS SETTINGS
// ============================================================================

function MembersSettings({ orgId }: { orgId: string }) {
  const { members, isLoading, addMember, updateMemberRole, removeMember } = useGearOrgMembers(orgId);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-bone-white">Organization Members</h3>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Member
        </Button>
      </div>

      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <Table>
          <TableHeader>
            <TableRow className="border-muted-gray/30 hover:bg-transparent">
              <TableHead>Member</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                onUpdateRole={(role) =>
                  updateMemberRole.mutate({ memberId: member.id, role })
                }
                onRemove={() => {
                  if (confirm('Remove this member?')) {
                    removeMember.mutate(member.id);
                  }
                }}
              />
            ))}
          </TableBody>
        </Table>
      </Card>

      <AddMemberModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={async (data) => {
          await addMember.mutateAsync(data);
          setIsAddModalOpen(false);
        }}
        isSubmitting={addMember.isPending}
      />
    </div>
  );
}

function MemberRow({
  member,
  onUpdateRole,
  onRemove,
}: {
  member: GearOrganizationMember;
  onUpdateRole: (role: string) => void;
  onRemove: () => void;
}) {
  const roleConfig = ROLE_CONFIG[member.role];

  return (
    <TableRow className="border-muted-gray/30 hover:bg-charcoal-black/30">
      <TableCell>
        <div className="flex items-center gap-3">
          {member.avatar_url ? (
            <img
              src={member.avatar_url}
              alt=""
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-muted-gray/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-muted-gray" />
            </div>
          )}
          <span className="text-bone-white">{member.display_name || 'Unknown'}</span>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-muted-gray">{member.email || '—'}</span>
      </TableCell>
      <TableCell>
        <Select value={member.role} onValueChange={onUpdateRole} disabled={member.role === 'owner'}>
          <SelectTrigger className="w-32">
            <Badge className={cn('border', roleConfig.color)}>{roleConfig.label}</Badge>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ROLE_CONFIG).map(([value, config]) => (
              <SelectItem key={value} value={value}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        {member.is_active ? (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border">Active</Badge>
        ) : (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border">
            Pending
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {member.role !== 'owner' && (
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 className="w-4 h-4 text-muted-gray hover:text-red-400" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function AddMemberModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { user_id: string; role: string }) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<OrganizationMemberRole>('member');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    await onSubmit({ user_id: userId, role });
    setUserId('');
    setRole('member');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Member</DialogTitle>
          <DialogDescription>Add a new member to this organization</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>User ID</Label>
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter user ID"
            />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as OrganizationMemberRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_CONFIG)
                  .filter(([v]) => v !== 'owner')
                  .map(([value, config]) => (
                    <SelectItem key={value} value={value}>
                      {config.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !userId}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// CATEGORIES SETTINGS
// ============================================================================

function CategoriesSettings({ orgId }: { orgId: string }) {
  const { categories, isLoading, createCategory } = useGearCategories(orgId);
  const [newCategoryName, setNewCategoryName] = useState('');

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    await createCategory.mutateAsync({ name: newCategoryName.trim() });
    setNewCategoryName('');
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="New category name"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
        />
        <Button onClick={handleAddCategory} disabled={createCategory.isPending}>
          {createCategory.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          <Plus className="w-4 h-4 mr-2" />
          Add
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <Card key={cat.id} className="bg-charcoal-black/50 border-muted-gray/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderTree className="w-4 h-4 text-accent-yellow" />
                  <span className="text-bone-white">{cat.name}</span>
                </div>
                {cat.requires_certification && (
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 border">
                    <Shield className="w-3 h-3 mr-1" />
                    Cert
                  </Badge>
                )}
              </div>
              {cat.description && (
                <p className="text-sm text-muted-gray mt-2">{cat.description}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// LOCATIONS SETTINGS
// ============================================================================

function LocationsSettings({ orgId }: { orgId: string }) {
  const { locations, isLoading, createLocation } = useGearLocations(orgId);
  const [newLocationName, setNewLocationName] = useState('');

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  const handleAddLocation = async () => {
    if (!newLocationName.trim()) return;
    await createLocation.mutateAsync({ name: newLocationName.trim(), location_type: 'warehouse' });
    setNewLocationName('');
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="New location name"
          value={newLocationName}
          onChange={(e) => setNewLocationName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddLocation()}
        />
        <Button onClick={handleAddLocation} disabled={createLocation.isPending}>
          {createLocation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          <Plus className="w-4 h-4 mr-2" />
          Add
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {locations.map((loc) => (
          <Card key={loc.id} className="bg-charcoal-black/50 border-muted-gray/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-accent-yellow" />
                <span className="text-bone-white">{loc.name}</span>
              </div>
              <p className="text-sm text-muted-gray mt-1 capitalize">
                {loc.location_type.replace('_', ' ')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
