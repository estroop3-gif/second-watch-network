/**
 * Admin Organizations Management Page
 *
 * Manage organization tiers, quotas, usage tracking, and user org limits.
 */

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Building2,
  Search,
  RefreshCw,
  Settings2,
  Users,
  FolderOpen,
  HardDrive,
  Activity,
  Crown,
  Check,
  X,
  AlertTriangle,
  Edit2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useAdminOrganizations,
  useAdminOrgStats,
  useOrganizationTiers,
  useUpdateOrganization,
  useSetOrgOverride,
  useClearOrgOverride,
  useRecalculateOrgUsage,
  useUpdateTier,
  useSetUserOrgLimit,
  useUserOrgLimit,
  useUsersWithOrgLimits,
  UserWithOrgLimit,
  UserOrgLimitFilters,
  formatBytes,
  formatCents,
  calculateUsagePercent,
  AdminOrganization,
  OrganizationTier,
  OrganizationFilters,
} from '@/hooks/admin/useAdminOrganizations';

// =============================================================================
// Organizations List Tab
// =============================================================================

function OrganizationsListTab() {
  const [filters, setFilters] = useState<OrganizationFilters>({ page: 1, page_size: 20 });
  const [selectedOrg, setSelectedOrg] = useState<AdminOrganization | null>(null);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);

  const { data, isLoading, refetch } = useAdminOrganizations(filters);
  const { data: stats } = useAdminOrgStats();
  const { data: tiers } = useOrganizationTiers();
  const updateOrg = useUpdateOrganization();
  const setOverride = useSetOrgOverride();
  const clearOverride = useClearOrgOverride();
  const recalculate = useRecalculateOrgUsage();

  const handleSearch = (search: string) => {
    setFilters((prev) => ({ ...prev, search, page: 1 }));
  };

  const handleTierFilter = (tierId: string) => {
    setFilters((prev) => ({ ...prev, tier_id: tierId === 'all' ? undefined : tierId, page: 1 }));
  };

  const handleStatusFilter = (status: string) => {
    setFilters((prev) => ({ ...prev, subscription_status: status === 'all' ? undefined : status, page: 1 }));
  };

  const handleAssignTier = async (orgId: string, tierId: string) => {
    try {
      await updateOrg.mutateAsync({ orgId, data: { tier_id: tierId } });
      toast.success('Tier assigned successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign tier');
    }
  };

  const handleRecalculate = async (orgId: string) => {
    try {
      await recalculate.mutateAsync(orgId);
      toast.success('Usage recalculated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to recalculate');
    }
  };

  const handleClearOverride = async (orgId: string) => {
    try {
      await clearOverride.mutateAsync(orgId);
      toast.success('Overrides cleared');
    } catch (error: any) {
      toast.error(error.message || 'Failed to clear overrides');
    }
  };

  const getStatusBadge = (status: string | null) => {
    const statusColors: Record<string, string> = {
      active: 'bg-green-600',
      trialing: 'bg-blue-600',
      past_due: 'bg-yellow-600',
      canceled: 'bg-red-600',
      unpaid: 'bg-red-600',
      paused: 'bg-gray-600',
      none: 'bg-gray-500',
    };
    return (
      <Badge className={statusColors[status || 'none'] || 'bg-gray-500'}>
        {status || 'none'}
      </Badge>
    );
  };

  const UsageBar = ({ used, limit, label }: { used: number; limit: number; label: string }) => {
    const percent = calculateUsagePercent(used, limit);
    const isNearLimit = percent >= 80;
    const isUnlimited = limit === -1;

    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-gray">{label}</span>
          <span className={isNearLimit && !isUnlimited ? 'text-yellow-500' : ''}>
            {isUnlimited ? `${used}` : `${used}/${limit}`}
          </span>
        </div>
        <Progress
          value={isUnlimited ? 0 : percent}
          className={`h-1.5 ${isNearLimit && !isUnlimited ? 'bg-yellow-500/20' : ''}`}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-charcoal-black border-muted-gray">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-8 w-8 text-accent-yellow" />
                <div>
                  <p className="text-2xl font-bold">{stats.total_organizations}</p>
                  <p className="text-xs text-muted-gray">Total Organizations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-charcoal-black border-muted-gray">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Check className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.active_organizations}</p>
                  <p className="text-xs text-muted-gray">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-charcoal-black border-muted-gray">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <HardDrive className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{formatBytes(stats.total_storage_used_bytes)}</p>
                  <p className="text-xs text-muted-gray">Total Storage</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-charcoal-black border-muted-gray">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Activity className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{formatBytes(stats.total_bandwidth_this_month_bytes)}</p>
                  <p className="text-xs text-muted-gray">Bandwidth This Month</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
            <Input
              placeholder="Search organizations..."
              className="pl-9 bg-charcoal-black border-muted-gray"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>
        <Select onValueChange={handleTierFilter} defaultValue="all">
          <SelectTrigger className="w-[160px] bg-charcoal-black border-muted-gray">
            <SelectValue placeholder="Filter by tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            {tiers?.map((tier) => (
              <SelectItem key={tier.id} value={tier.id}>
                {tier.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select onValueChange={handleStatusFilter} defaultValue="all">
          <SelectTrigger className="w-[160px] bg-charcoal-black border-muted-gray">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trialing">Trialing</SelectItem>
            <SelectItem value="past_due">Past Due</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
            <SelectItem value="none">No Subscription</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => refetch()} className="border-muted-gray">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Organizations Table */}
      <Card className="bg-charcoal-black border-muted-gray">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-muted-gray">
                  <TableHead>Organization</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Seats</TableHead>
                  <TableHead>Projects</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((org) => (
                  <TableRow key={org.id} className="border-muted-gray">
                    <TableCell>
                      <div>
                        <p className="font-medium">{org.name}</p>
                        <p className="text-xs text-muted-gray">{org.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={org.tier_id || 'none'}
                        onValueChange={(value) => handleAssignTier(org.id, value)}
                      >
                        <SelectTrigger className="w-[120px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Tier</SelectItem>
                          {tiers?.map((tier) => (
                            <SelectItem key={tier.id} value={tier.id}>
                              {tier.display_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {org.has_overrides && (
                        <Badge variant="outline" className="ml-1 text-xs">
                          Custom
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(org.subscription_status)}</TableCell>
                    <TableCell>
                      <UsageBar
                        used={org.current_owner_seats + org.current_collaborative_seats}
                        limit={org.limit_owner_seats + org.limit_collaborative_seats}
                        label="Seats"
                      />
                    </TableCell>
                    <TableCell>
                      <UsageBar
                        used={org.current_active_projects}
                        limit={org.limit_active_projects}
                        label="Projects"
                      />
                    </TableCell>
                    <TableCell>
                      <UsageBar
                        used={org.current_active_storage_bytes}
                        limit={org.limit_active_storage_bytes}
                        label={formatBytes(org.current_active_storage_bytes)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedOrg(org);
                            setShowOverrideDialog(true);
                          }}
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRecalculate(org.id)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        {org.has_overrides && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleClearOverride(org.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={data.page <= 1}
            onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) - 1 }))}
          >
            Previous
          </Button>
          <span className="py-2 px-4 text-sm">
            Page {data.page} of {data.total_pages}
          </span>
          <Button
            variant="outline"
            disabled={data.page >= data.total_pages}
            onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))}
          >
            Next
          </Button>
        </div>
      )}

      {/* Override Dialog */}
      <OverrideDialog
        org={selectedOrg}
        open={showOverrideDialog}
        onClose={() => {
          setShowOverrideDialog(false);
          setSelectedOrg(null);
        }}
      />
    </div>
  );
}

// =============================================================================
// Override Dialog
// =============================================================================

function OverrideDialog({
  org,
  open,
  onClose,
}: {
  org: AdminOrganization | null;
  open: boolean;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    owner_seats: '',
    collaborative_seats: '',
    freelancer_seats_per_project: '',
    view_only_seats_per_project: '',
    active_projects_limit: '',
    active_storage_bytes: '',
    archive_storage_bytes: '',
    monthly_bandwidth_bytes: '',
  });

  const setOverride = useSetOrgOverride();

  const handleSubmit = async () => {
    if (!org) return;

    const data: Record<string, number> = {};
    Object.entries(formData).forEach(([key, value]) => {
      if (value !== '') {
        data[key] = parseInt(value, 10);
      }
    });

    if (Object.keys(data).length === 0) {
      toast.error('Please enter at least one override value');
      return;
    }

    try {
      await setOverride.mutateAsync({ orgId: org.id, data });
      toast.success('Overrides saved');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save overrides');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-charcoal-black border-muted-gray max-w-md">
        <DialogHeader>
          <DialogTitle>Override Limits for {org?.name}</DialogTitle>
          <DialogDescription>
            Set custom limits that override the tier defaults. Leave empty to use tier defaults.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Owner Seats</Label>
              <Input
                type="number"
                placeholder={`Default: ${org?.limit_owner_seats}`}
                value={formData.owner_seats}
                onChange={(e) => setFormData((prev) => ({ ...prev, owner_seats: e.target.value }))}
                className="bg-charcoal-black border-muted-gray"
              />
            </div>
            <div>
              <Label>Collaborative Seats</Label>
              <Input
                type="number"
                placeholder={`Default: ${org?.limit_collaborative_seats}`}
                value={formData.collaborative_seats}
                onChange={(e) => setFormData((prev) => ({ ...prev, collaborative_seats: e.target.value }))}
                className="bg-charcoal-black border-muted-gray"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Freelancer/Project</Label>
              <Input
                type="number"
                placeholder="Default"
                value={formData.freelancer_seats_per_project}
                onChange={(e) => setFormData((prev) => ({ ...prev, freelancer_seats_per_project: e.target.value }))}
                className="bg-charcoal-black border-muted-gray"
              />
            </div>
            <div>
              <Label>View-Only/Project</Label>
              <Input
                type="number"
                placeholder="Default"
                value={formData.view_only_seats_per_project}
                onChange={(e) => setFormData((prev) => ({ ...prev, view_only_seats_per_project: e.target.value }))}
                className="bg-charcoal-black border-muted-gray"
              />
            </div>
          </div>
          <div>
            <Label>Active Projects (-1 = unlimited)</Label>
            <Input
              type="number"
              placeholder={`Default: ${org?.limit_active_projects}`}
              value={formData.active_projects_limit}
              onChange={(e) => setFormData((prev) => ({ ...prev, active_projects_limit: e.target.value }))}
              className="bg-charcoal-black border-muted-gray"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Active Storage (bytes)</Label>
              <Input
                type="number"
                placeholder={formatBytes(org?.limit_active_storage_bytes || 0)}
                value={formData.active_storage_bytes}
                onChange={(e) => setFormData((prev) => ({ ...prev, active_storage_bytes: e.target.value }))}
                className="bg-charcoal-black border-muted-gray"
              />
            </div>
            <div>
              <Label>Archive Storage (bytes)</Label>
              <Input
                type="number"
                placeholder={formatBytes(org?.limit_archive_storage_bytes || 0)}
                value={formData.archive_storage_bytes}
                onChange={(e) => setFormData((prev) => ({ ...prev, archive_storage_bytes: e.target.value }))}
                className="bg-charcoal-black border-muted-gray"
              />
            </div>
          </div>
          <div>
            <Label>Monthly Bandwidth (bytes)</Label>
            <Input
              type="number"
              placeholder={formatBytes(org?.limit_monthly_bandwidth_bytes || 0)}
              value={formData.monthly_bandwidth_bytes}
              onChange={(e) => setFormData((prev) => ({ ...prev, monthly_bandwidth_bytes: e.target.value }))}
              className="bg-charcoal-black border-muted-gray"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={setOverride.isPending}>
            Save Overrides
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Tiers Configuration Tab
// =============================================================================

function TiersConfigTab() {
  const { data: tiers, isLoading, error, refetch } = useOrganizationTiers(true);
  const updateTier = useUpdateTier();
  const [editingTier, setEditingTier] = useState<OrganizationTier | null>(null);

  const handleUpdateTier = async (tierId: string, field: string, value: any) => {
    try {
      await updateTier.mutateAsync({ tierId, data: { [field]: value } });
      toast.success('Tier updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update tier');
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-charcoal-black border-red-500">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-500 mb-4">Failed to load tiers: {(error as any)?.message || 'Unknown error'}</p>
          <Button onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!tiers || tiers.length === 0) {
    return (
      <Card className="bg-charcoal-black border-muted-gray">
        <CardContent className="p-6 text-center">
          <Crown className="h-12 w-12 text-muted-gray mx-auto mb-4" />
          <p className="text-muted-gray mb-4">No tiers configured yet.</p>
          <Button onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {tiers.map((tier) => (
        <Card
          key={tier.id}
          className={`bg-charcoal-black border-muted-gray ${!tier.is_active ? 'opacity-50' : ''}`}
        >
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {tier.enterprise_support && <Crown className="h-5 w-5 text-accent-yellow" />}
                  {tier.display_name}
                </CardTitle>
                <CardDescription>{tier.description}</CardDescription>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-accent-yellow">{formatCents(tier.price_cents)}</p>
                <p className="text-xs text-muted-gray">/month</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-gray">Owner Seats</p>
                <p className="font-medium">{tier.owner_seats}</p>
              </div>
              <div>
                <p className="text-muted-gray">Collaborative Seats</p>
                <p className="font-medium">{tier.collaborative_seats}</p>
              </div>
              <div>
                <p className="text-muted-gray">Freelancer/Project</p>
                <p className="font-medium">{tier.freelancer_seats_per_project}</p>
              </div>
              <div>
                <p className="text-muted-gray">View-Only/Project</p>
                <p className="font-medium">{tier.view_only_seats_per_project}</p>
              </div>
              <div>
                <p className="text-muted-gray">Active Projects</p>
                <p className="font-medium">{tier.active_projects_limit === -1 ? 'Unlimited' : tier.active_projects_limit}</p>
              </div>
              <div>
                <p className="text-muted-gray">Active Storage</p>
                <p className="font-medium">{formatBytes(tier.active_storage_bytes)}</p>
              </div>
              <div>
                <p className="text-muted-gray">Archive Storage</p>
                <p className="font-medium">{formatBytes(tier.archive_storage_bytes)}</p>
              </div>
              <div>
                <p className="text-muted-gray">Monthly Bandwidth</p>
                <p className="font-medium">{formatBytes(tier.monthly_bandwidth_bytes)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {tier.enterprise_support && (
                <Badge className="bg-purple-600">Enterprise Support</Badge>
              )}
              {tier.public_call_sheet_links && (
                <Badge className="bg-blue-600">Public Call Sheets</Badge>
              )}
              {tier.priority_email_response && (
                <Badge className="bg-green-600">Priority Response</Badge>
              )}
            </div>

            <div className="pt-2 border-t border-muted-gray">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-gray">Stripe Price ID</span>
                <Input
                  className="w-[200px] h-7 text-xs bg-charcoal-black border-muted-gray"
                  placeholder="price_xxx"
                  defaultValue={tier.stripe_price_id || ''}
                  onBlur={(e) => {
                    if (e.target.value !== tier.stripe_price_id) {
                      handleUpdateTier(tier.id, 'stripe_price_id', e.target.value);
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Badge variant={tier.is_active ? 'default' : 'secondary'}>
                {tier.is_active ? 'Active' : 'Inactive'}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleUpdateTier(tier.id, 'is_active', !tier.is_active)}
              >
                {tier.is_active ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// =============================================================================
// User Org Limits Tab
// =============================================================================

function UserOrgLimitsTab() {
  const [filters, setFilters] = useState<UserOrgLimitFilters>({ page: 1, page_size: 20 });
  const [selectedUser, setSelectedUser] = useState<UserWithOrgLimit | null>(null);
  const [newLimit, setNewLimit] = useState('');

  const { data, isLoading, refetch } = useUsersWithOrgLimits(filters);
  const setLimit = useSetUserOrgLimit();

  const handleSearch = (search: string) => {
    setFilters((prev) => ({ ...prev, search, page: 1 }));
  };

  const handleSetLimit = async () => {
    if (!selectedUser || !newLimit) return;

    try {
      await setLimit.mutateAsync({ userId: selectedUser.id, limit: parseInt(newLimit, 10) });
      toast.success('Organization limit updated');
      setNewLimit('');
      setSelectedUser(null);
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update limit');
    }
  };

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <Card className="bg-charcoal-black border-muted-gray">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">About Organization Limits</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-gray">
          <p>
            <strong>Default:</strong> Each user can own 1 organization. Set a higher limit to allow users to create multiple organizations.
          </p>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
            <Input
              placeholder="Search users by name or email..."
              className="pl-9 bg-charcoal-black border-muted-gray"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>
        <Button
          variant={filters.has_multiple_orgs ? 'default' : 'outline'}
          onClick={() => setFilters((prev) => ({ ...prev, has_multiple_orgs: !prev.has_multiple_orgs, page: 1 }))}
          className="border-muted-gray"
        >
          <Crown className="h-4 w-4 mr-2" />
          Multi-Org Users
        </Button>
        <Button variant="outline" onClick={() => refetch()} className="border-muted-gray">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Users Table */}
      <Card className="bg-charcoal-black border-muted-gray">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-muted-gray">
                  <TableHead>User</TableHead>
                  <TableHead>Current Limit</TableHead>
                  <TableHead>Orgs Owned</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((user) => (
                  <TableRow key={user.id} className="border-muted-gray">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted-gray/30 flex items-center justify-center">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                          ) : (
                            <Users className="h-4 w-4 text-muted-gray" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{user.full_name || user.username || 'Unknown'}</p>
                          <p className="text-xs text-muted-gray">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={user.max_organizations_allowed > 1 ? 'border-accent-yellow text-accent-yellow' : ''}>
                        {user.max_organizations_allowed}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={user.current_organizations_owned >= user.max_organizations_allowed ? 'text-yellow-500' : ''}>
                        {user.current_organizations_owned}
                      </span>
                    </TableCell>
                    <TableCell>
                      {user.current_organizations_owned >= user.max_organizations_allowed ? (
                        <Badge variant="outline" className="border-yellow-500 text-yellow-500">At Limit</Badge>
                      ) : (
                        <Badge variant="outline" className="border-green-500 text-green-500">Available</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedUser(user);
                          setNewLimit(user.max_organizations_allowed.toString());
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {data?.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-gray">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={data.page <= 1}
            onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) - 1 }))}
          >
            Previous
          </Button>
          <span className="py-2 px-4 text-sm">
            Page {data.page} of {data.total_pages}
          </span>
          <Button
            variant="outline"
            disabled={data.page >= data.total_pages}
            onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))}
          >
            Next
          </Button>
        </div>
      )}

      {/* Edit Limit Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="bg-charcoal-black border-muted-gray max-w-md">
          <DialogHeader>
            <DialogTitle>Set Organization Limit</DialogTitle>
            <DialogDescription>
              Set the maximum number of organizations this user can own.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 p-3 bg-muted-gray/10 rounded-md">
                <div className="w-10 h-10 rounded-full bg-muted-gray/30 flex items-center justify-center">
                  {selectedUser.avatar_url ? (
                    <img src={selectedUser.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                  ) : (
                    <Users className="h-5 w-5 text-muted-gray" />
                  )}
                </div>
                <div>
                  <p className="font-medium">{selectedUser.full_name || selectedUser.username || 'Unknown'}</p>
                  <p className="text-sm text-muted-gray">{selectedUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-3 bg-muted-gray/10 rounded-md">
                  <p className="text-2xl font-bold">{selectedUser.max_organizations_allowed}</p>
                  <p className="text-xs text-muted-gray">Current Limit</p>
                </div>
                <div className="p-3 bg-muted-gray/10 rounded-md">
                  <p className="text-2xl font-bold">{selectedUser.current_organizations_owned}</p>
                  <p className="text-xs text-muted-gray">Orgs Owned</p>
                </div>
              </div>

              <div>
                <Label>New Limit</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="Enter new limit..."
                  value={newLimit}
                  onChange={(e) => setNewLimit(e.target.value)}
                  className="bg-charcoal-black border-muted-gray"
                />
                <p className="text-xs text-muted-gray mt-1">
                  Set to 0 to prevent creating new organizations.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleSetLimit} disabled={!newLimit || setLimit.isPending}>
              Update Limit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function AdminOrganizations() {
  return (
    <div>
      <h1 className="text-4xl md:text-6xl font-heading tracking-tighter mb-8 -rotate-1">
        <span className="font-spray text-accent-yellow">Organizations</span> Management
      </h1>

      <Tabs defaultValue="list" className="space-y-6">
        <TabsList className="bg-charcoal-black border border-muted-gray">
          <TabsTrigger value="list" className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Building2 className="h-4 w-4 mr-2" />
            Organizations
          </TabsTrigger>
          <TabsTrigger value="tiers" className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Crown className="h-4 w-4 mr-2" />
            Tiers
          </TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Users className="h-4 w-4 mr-2" />
            User Limits
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <OrganizationsListTab />
        </TabsContent>

        <TabsContent value="tiers">
          <TiersConfigTab />
        </TabsContent>

        <TabsContent value="users">
          <UserOrgLimitsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
