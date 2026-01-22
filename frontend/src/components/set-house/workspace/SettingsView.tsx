/**
 * Settings View
 * Manage organization settings, members, categories, and locations for Set House
 */
import React, { useState, useEffect } from 'react';
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
  Store,
  Home,
  Building2,
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
  useSetHouseOrgMembers,
  useSetHouseOrgSettings,
  useSetHouseCategories,
  useSetHouseLocations,
  useSetHouseOrganization,
} from '@/hooks/set-house';
import type {
  SetHouseOrganization,
  SetHouseOrganizationMember,
  OrganizationMemberRole,
  SetHouseOrganizationType,
} from '@/types/set-house';
import { cn } from '@/lib/utils';

const ROLE_CONFIG: Record<OrganizationMemberRole, { label: string; color: string }> = {
  owner: { label: 'Owner', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  admin: { label: 'Admin', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  manager: { label: 'Manager', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  member: { label: 'Member', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

interface SettingsViewProps {
  orgId: string;
  organization: SetHouseOrganization;
}

export function SettingsView({ orgId, organization }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'marketplace' | 'members' | 'categories' | 'locations'>(
    'general'
  );

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="bg-charcoal-black/50 border border-muted-gray/30 flex-wrap h-auto">
          <TabsTrigger value="general">
            <Settings className="w-4 h-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="marketplace">
            <Store className="w-4 h-4 mr-2" />
            Marketplace
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
          <GeneralSettings orgId={orgId} organization={organization} />
        </TabsContent>

        <TabsContent value="marketplace" className="mt-6">
          <MarketplaceSettings orgId={orgId} />
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

const ORG_TYPE_OPTIONS: { value: SetHouseOrganizationType; label: string; description: string }[] = [
  { value: 'studio', label: 'Studio', description: 'Focus on stage and studio rentals' },
  { value: 'location_house', label: 'Location House', description: 'Manage external filming locations' },
  { value: 'hybrid', label: 'Hybrid (Both)', description: 'Both studio and location management' },
  { value: 'agency', label: 'Agency', description: 'Location scouting and management agency' },
  { value: 'other', label: 'Other', description: 'Other type of organization' },
];

function GeneralSettings({ orgId, organization }: { orgId: string; organization: SetHouseOrganization }) {
  const { settings, isLoading, updateSettings } = useSetHouseOrgSettings(orgId);
  const { updateOrganization } = useSetHouseOrganization(orgId);

  const [localBookingDuration, setLocalBookingDuration] = useState('7');

  useEffect(() => {
    if (settings) {
      setLocalBookingDuration(String(settings.default_booking_duration_days ?? 7));
    }
  }, [settings]);

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
      {/* Organization Type */}
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-base">Organization Type</CardTitle>
          <CardDescription>Define your organization's primary function</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Type</Label>
            <Select
              value={organization.org_type || 'studio'}
              onValueChange={(value) => updateOrganization.mutate({ org_type: value as SetHouseOrganizationType })}
            >
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORG_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-gray mt-2">
              {ORG_TYPE_OPTIONS.find((o) => o.value === (organization.org_type || 'studio'))?.description}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Booking Settings */}
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-base">Booking Settings</CardTitle>
          <CardDescription>Configure default booking behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Default Booking Duration (days)</Label>
            <Input
              type="number"
              value={localBookingDuration}
              className="w-32"
              onChange={(e) => setLocalBookingDuration(e.target.value)}
              onBlur={() => {
                const value = parseInt(localBookingDuration, 10) || 7;
                if (value !== (settings?.default_booking_duration_days ?? 7)) {
                  updateSettings.mutate({ default_booking_duration_days: value });
                }
              }}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Photo Requirements</Label>
            <div className="space-y-2 pl-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">On booking start</span>
                <Switch
                  checked={settings?.require_photos_on_booking_start ?? false}
                  onCheckedChange={(checked) => updateSettings.mutate({ require_photos_on_booking_start: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">On booking end</span>
                <Switch
                  checked={settings?.require_photos_on_booking_end ?? false}
                  onCheckedChange={(checked) => updateSettings.mutate({ require_photos_on_booking_end: checked })}
                />
              </div>
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
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// MARKETPLACE SETTINGS
// ============================================================================

function MarketplaceSettings({ orgId }: { orgId: string }) {
  const { settings, isLoading, updateSettings } = useSetHouseOrgSettings(orgId);

  if (isLoading) {
    return <Skeleton className="h-32" />;
  }

  return (
    <div className="space-y-6">
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-base">Marketplace Visibility</CardTitle>
          <CardDescription>Control how your spaces appear in the marketplace</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Marketplace Listings</Label>
              <p className="text-sm text-muted-gray">Allow your spaces to be listed publicly</p>
            </div>
            <Switch
              checked={settings?.marketplace_enabled ?? false}
              onCheckedChange={(checked) => updateSettings.mutate({ marketplace_enabled: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Accept Online Bookings</Label>
              <p className="text-sm text-muted-gray">Allow customers to book online</p>
            </div>
            <Switch
              checked={settings?.accept_online_bookings ?? false}
              onCheckedChange={(checked) => updateSettings.mutate({ accept_online_bookings: checked })}
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
  const { members, isLoading, inviteMember, removeMember, updateMemberRole } = useSetHouseOrgMembers(orgId);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-bone-white">Team Members</h3>
          <p className="text-sm text-muted-gray">Manage who has access to this organization</p>
        </div>
        <Button onClick={() => setIsInviteModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Invite Member
        </Button>
      </div>

      {members.length === 0 ? (
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-12 h-12 text-muted-gray mb-4" />
            <p className="text-muted-gray">No team members yet</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <Table>
            <TableHeader>
              <TableRow className="border-muted-gray/30 hover:bg-transparent">
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id} className="border-muted-gray/30">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent-yellow/20 flex items-center justify-center">
                        <span className="text-accent-yellow font-medium">
                          {member.user_name?.[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-bone-white">{member.user_name || 'Unknown'}</p>
                        {member.user_email && (
                          <p className="text-xs text-muted-gray">{member.user_email}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn('border', ROLE_CONFIG[member.role]?.color || ROLE_CONFIG.member.color)}>
                      {ROLE_CONFIG[member.role]?.label || member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-gray">
                      {member.created_at ? new Date(member.created_at).toLocaleDateString() : '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {member.role !== 'owner' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => removeMember.mutate(member.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Invite Modal would go here */}
    </div>
  );
}

// ============================================================================
// CATEGORIES SETTINGS
// ============================================================================

function CategoriesSettings({ orgId }: { orgId: string }) {
  const { categories, isLoading, createCategory, deleteCategory } = useSetHouseCategories(orgId);
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
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-bone-white">Space Categories</h3>
        <p className="text-sm text-muted-gray">Organize your spaces into categories</p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="New category name..."
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
        />
        <Button onClick={handleAddCategory} disabled={!newCategoryName.trim() || createCategory.isPending}>
          {createCategory.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderTree className="w-12 h-12 text-muted-gray mb-4" />
            <p className="text-muted-gray">No categories yet</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <CardContent className="p-4">
            <div className="space-y-2">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-charcoal-black/30"
                >
                  <div className="flex items-center gap-3">
                    <FolderTree className="w-4 h-4 text-accent-yellow" />
                    <span className="text-bone-white">{cat.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300"
                    onClick={() => deleteCategory.mutate(cat.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// LOCATIONS SETTINGS
// ============================================================================

function LocationsSettings({ orgId }: { orgId: string }) {
  const { locations, isLoading, createLocation, deleteLocation } = useSetHouseLocations(orgId);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-bone-white">Physical Locations</h3>
          <p className="text-sm text-muted-gray">Manage your physical addresses</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Location
        </Button>
      </div>

      {locations.length === 0 ? (
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MapPin className="w-12 h-12 text-muted-gray mb-4" />
            <p className="text-muted-gray">No locations added yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {locations.map((loc) => (
            <Card key={loc.id} className="bg-charcoal-black/50 border-muted-gray/30">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent-yellow/20 flex items-center justify-center mt-1">
                      <MapPin className="w-5 h-5 text-accent-yellow" />
                    </div>
                    <div>
                      <p className="font-medium text-bone-white">{loc.name}</p>
                      <p className="text-sm text-muted-gray">
                        {[loc.address_line1, loc.city, loc.state].filter(Boolean).join(', ')}
                      </p>
                      {loc.is_primary && (
                        <Badge className="mt-2 bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30">
                          Primary
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300"
                    onClick={() => deleteLocation.mutate(loc.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Location Modal would go here */}
    </div>
  );
}
