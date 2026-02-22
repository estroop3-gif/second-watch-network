/**
 * Organizations Page
 * Manage organization Backlot seats and project access
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Building2, Users, FolderKanban, Plus, Settings, ChevronRight, Crown, Shield, UserCheck, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  useMyBacklotOrganizations,
  useOrganizationSeats,
  useOrganizationProjects,
  useAddOrganizationSeat,
  useUpdateOrganizationSeat,
  useRemoveOrganizationSeat,
  useUserProjectAccess,
  useGrantProjectAccess,
  useRevokeProjectAccess,
  MyBacklotOrg,
  BacklotSeat,
} from '@/hooks/useOrganizations';
import {
  useOrgSubscription,
  useCreateCheckout,
  useTrialConvertCheckout,
  useCancelSubscription,
  useReactivateSubscription,
  usePortalSession,
} from '@/hooks/useSubscriptionBilling';
import BillingWarningBanner from '@/components/backlot/BillingWarningBanner';
import PlanConfigurator from '@/components/pricing/PlanConfigurator';
import PriceSummary from '@/components/pricing/PriceSummary';

// =============================================================================
// Helper Components
// =============================================================================

function RoleBadge({ role }: { role: string }) {
  const roleConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline'; icon: React.ReactNode }> = {
    owner: { label: 'Owner', variant: 'default', icon: <Crown className="w-3 h-3 mr-1" /> },
    admin: { label: 'Admin', variant: 'secondary', icon: <Shield className="w-3 h-3 mr-1" /> },
    collaborative: { label: 'Collaborative', variant: 'outline', icon: <UserCheck className="w-3 h-3 mr-1" /> },
  };

  const config = roleConfig[role] || { label: role, variant: 'outline' as const, icon: null };

  return (
    <Badge variant={config.variant} className="flex items-center">
      {config.icon}
      {config.label}
    </Badge>
  );
}

function SeatCard({
  seat,
  organizationId,
  onUpdate,
  onRemove,
}: {
  seat: BacklotSeat;
  organizationId: string;
  onUpdate: (seat: BacklotSeat, updates: Partial<BacklotSeat>) => void;
  onRemove: (seat: BacklotSeat) => void;
}) {
  const [showProjects, setShowProjects] = useState(false);
  const { data: projectAccess } = useUserProjectAccess(
    seat.role === 'collaborative' ? organizationId : '',
    seat.role === 'collaborative' ? seat.user_id : ''
  );

  const isOwner = seat.role === 'owner';

  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={seat.user_avatar || undefined} />
              <AvatarFallback className="bg-muted-gray/30 text-bone-white">
                {seat.user_name?.charAt(0) || seat.user_email?.charAt(0) || '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-bone-white">{seat.user_name || 'Unknown User'}</p>
              <p className="text-sm text-muted-gray">{seat.user_email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <RoleBadge role={seat.role} />

            {seat.role === 'collaborative' && (
              <div className="flex items-center gap-2">
                <Label htmlFor={`create-${seat.id}`} className="text-sm text-muted-gray">
                  Can create projects
                </Label>
                <Switch
                  id={`create-${seat.id}`}
                  checked={seat.can_create_projects}
                  onCheckedChange={(checked) => onUpdate(seat, { can_create_projects: checked })}
                />
              </div>
            )}

            {!isOwner && (
              <Button
                variant="ghost"
                size="sm"
                className="text-primary-red hover:text-primary-red/80"
                onClick={() => onRemove(seat)}
              >
                Remove
              </Button>
            )}
          </div>
        </div>

        {seat.role === 'collaborative' && (
          <div className="mt-4 pt-4 border-t border-muted-gray/20">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-gray"
              onClick={() => setShowProjects(!showProjects)}
            >
              <FolderKanban className="w-4 h-4 mr-2" />
              {projectAccess?.length || 0} project(s) accessible
              <ChevronRight className={`w-4 h-4 ml-2 transition-transform ${showProjects ? 'rotate-90' : ''}`} />
            </Button>

            {showProjects && projectAccess && (
              <div className="mt-2 space-y-1 pl-6">
                {projectAccess.map((access) => (
                  <div key={access.id} className="flex items-center justify-between py-1">
                    <span className="text-sm text-bone-white">{access.project_name || access.project_id}</span>
                    <Button variant="ghost" size="sm" className="text-xs text-muted-gray">
                      Edit Access
                    </Button>
                  </div>
                ))}
                {projectAccess.length === 0 && (
                  <p className="text-sm text-muted-gray">No projects assigned yet</p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OrganizationPanel({ org }: { org: MyBacklotOrg }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('seats');
  const [showAddSeat, setShowAddSeat] = useState(false);

  const { data: seats, isLoading: seatsLoading } = useOrganizationSeats(org.id);
  const { data: projects, isLoading: projectsLoading } = useOrganizationProjects(org.id);

  const updateSeat = useUpdateOrganizationSeat();
  const removeSeat = useRemoveOrganizationSeat();

  const handleUpdateSeat = (seat: BacklotSeat, updates: Partial<BacklotSeat>) => {
    updateSeat.mutate(
      {
        organizationId: org.id,
        userId: seat.user_id,
        canCreateProjects: updates.can_create_projects,
      },
      {
        onSuccess: () => {
          toast({ title: 'Seat updated' });
        },
        onError: (error: any) => {
          toast({ title: 'Failed to update seat', description: error.message, variant: 'destructive' });
        },
      }
    );
  };

  const handleRemoveSeat = (seat: BacklotSeat) => {
    if (!confirm(`Remove ${seat.user_name || seat.user_email} from the organization?`)) return;

    removeSeat.mutate(
      { organizationId: org.id, userId: seat.user_id },
      {
        onSuccess: () => {
          toast({ title: 'Seat removed' });
        },
        onError: (error: any) => {
          toast({ title: 'Failed to remove seat', description: error.message, variant: 'destructive' });
        },
      }
    );
  };

  const isAdmin = org.role === 'owner' || org.role === 'admin';

  return (
    <Card className="bg-charcoal-black border-muted-gray/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {org.logo_url ? (
              <img src={org.logo_url} alt={org.name} className="h-12 w-12 rounded-lg object-cover" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-muted-gray/20 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-muted-gray" />
              </div>
            )}
            <div>
              <CardTitle className="text-bone-white">{org.name}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <RoleBadge role={org.role} />
                <span className="text-muted-gray">
                  {org.seats_used}/{org.backlot_seat_limit || '∞'} seats
                </span>
              </CardDescription>
            </div>
          </div>

          {isAdmin && (
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted-gray/10">
            <TabsTrigger value="seats">
              <Users className="w-4 h-4 mr-2" />
              Seats ({seats?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="projects">
              <FolderKanban className="w-4 h-4 mr-2" />
              Projects ({projects?.length || 0})
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="billing">
                <CreditCard className="w-4 h-4 mr-2" />
                Billing
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="seats" className="mt-4">
            {isAdmin && (
              <div className="flex justify-end mb-4">
                <Dialog open={showAddSeat} onOpenChange={setShowAddSeat}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Seat
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Backlot Seat</DialogTitle>
                      <DialogDescription>
                        Add a team member to your organization's Backlot access.
                      </DialogDescription>
                    </DialogHeader>
                    <AddSeatForm organizationId={org.id} onSuccess={() => setShowAddSeat(false)} />
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {seatsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : (
              <div className="space-y-3">
                {seats?.map((seat) => (
                  <SeatCard
                    key={seat.id}
                    seat={seat}
                    organizationId={org.id}
                    onUpdate={handleUpdateSeat}
                    onRemove={handleRemoveSeat}
                  />
                ))}
                {seats?.length === 0 && (
                  <p className="text-center text-muted-gray py-8">No seats yet</p>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="projects" className="mt-4">
            {projectsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (
              <div className="space-y-2">
                {projects?.map((project: any) => (
                  <Card key={project.id} className="bg-charcoal-black/50 border-muted-gray/20">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-bone-white">{project.name}</p>
                        <p className="text-sm text-muted-gray">Created by {project.owner_name || 'Unknown'}</p>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={`/backlot/${project.id}`}>
                          Open
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {projects?.length === 0 && (
                  <p className="text-center text-muted-gray py-8">No projects yet</p>
                )}
              </div>
            )}
          </TabsContent>

          {isAdmin && (
            <TabsContent value="billing" className="mt-4">
              <BillingTab org={org} />
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function formatStorageDisplay(gb: number) {
  if (gb >= 1024) return `${(gb / 1024).toFixed(gb % 1024 === 0 ? 0 : 1)} TB`;
  return `${gb} GB`;
}

function UsageMeter({ label, used, limit, unit = '' }: { label: string; used: number; limit: number; unit?: string }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const isHigh = pct > 80;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-gray">{label}</span>
        <span className={isHigh ? 'text-primary-red' : 'text-bone-white/70'}>
          {used.toLocaleString()}{unit} / {limit < 0 ? 'Unlimited' : `${limit.toLocaleString()}${unit}`}
        </span>
      </div>
      {limit > 0 && (
        <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isHigh ? 'bg-primary-red' : 'bg-accent-yellow'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function BillingTab({ org }: { org: MyBacklotOrg }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: subscription, isLoading } = useOrgSubscription(org.id);
  const createCheckout = useCreateCheckout();
  const trialConvert = useTrialConvertCheckout();
  const cancelSub = useCancelSubscription();
  const reactivateSub = useReactivateSubscription();
  const portalSession = usePortalSession();
  const [showConfigurator, setShowConfigurator] = useState(false);
  const [planConfig, setPlanConfig] = useState<any>(null);

  const handleConfigChange = useCallback((config: any) => {
    setPlanConfig(config);
  }, []);

  const handleCheckout = () => {
    if (!planConfig) return;

    // Free tier activation
    if (planConfig.tier_name === 'free') {
      createCheckout.mutate(
        { org_id: org.id, plan_type: 'tier', tier_name: 'free', config: {} },
        {
          onSuccess: (data: any) => {
            if (data?.success) {
              toast({ title: 'Free plan activated!' });
              setShowConfigurator(false);
            } else if (data?.checkout_url) {
              window.location.href = data.checkout_url;
            }
          },
          onError: (error: any) => {
            toast({ title: 'Failed', description: error.message, variant: 'destructive' });
          },
        }
      );
      return;
    }

    const mutationFn = subscription?.billing_status === 'trial' || subscription?.billing_status === 'expired' || subscription?.billing_status === 'free'
      ? trialConvert
      : createCheckout;

    mutationFn.mutate(
      {
        org_id: org.id,
        plan_type: planConfig.plan_type,
        tier_name: planConfig.tier_name,
        config: { ...planConfig.config, term_type: planConfig.term_type },
      },
      {
        onSuccess: (data: any) => {
          if (data?.checkout_url) {
            window.location.href = data.checkout_url;
          }
        },
        onError: (error: any) => {
          toast({ title: 'Checkout failed', description: error.message, variant: 'destructive' });
        },
      }
    );
  };

  const handleCancel = () => {
    if (!confirm('Cancel your subscription? You\'ll retain access until the end of the billing period.')) return;
    cancelSub.mutate(org.id, {
      onSuccess: () => toast({ title: 'Subscription will cancel at period end' }),
      onError: (error: any) => toast({ title: 'Failed', description: error.message, variant: 'destructive' }),
    });
  };

  const handleReactivate = () => {
    reactivateSub.mutate(org.id, {
      onSuccess: () => toast({ title: 'Cancellation reversed' }),
      onError: (error: any) => toast({ title: 'Failed', description: error.message, variant: 'destructive' }),
    });
  };

  const handlePortal = () => {
    portalSession.mutate({ orgId: org.id, returnTo: '/organizations' });
  };

  if (isLoading) {
    return <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>;
  }

  const billingStatus = subscription?.billing_status || 'free';
  const sub = subscription?.subscription;
  const modules = subscription?.modules || [];
  const isFree = billingStatus === 'free' || sub?.tier_name === 'free';
  const isActive = sub && (sub.status === 'active' || sub.status === 'free');

  return (
    <div className="space-y-4">
      <BillingWarningBanner
        billingStatus={billingStatus}
        graceInfo={subscription?.grace_info}
        organizationId={org.id}
        onSubscribe={() => setShowConfigurator(true)}
      />

      {/* Active subscription info */}
      {isActive && (
        <Card className="bg-charcoal-black/50 border-muted-gray/20">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-bone-white font-medium">
                  {sub.tier_name ? `${sub.tier_name.charAt(0).toUpperCase() + sub.tier_name.slice(1)} Plan` : 'Custom Plan'}
                </h4>
                <p className="text-sm text-muted-gray">
                  {isFree ? 'Free forever' : sub.annual_prepay ? 'Annual billing' : 'Monthly billing'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-accent-yellow">
                  {isFree ? 'Free' : (
                    <>${(sub.effective_monthly_cents / 100).toLocaleString()}<span className="text-sm text-muted-gray">/mo</span></>
                  )}
                </p>
              </div>
            </div>

            {/* Usage meters */}
            <div className="space-y-2.5 pt-1">
              <UsageMeter label="Owner Seats" used={org.seats_used || 0} limit={sub.owner_seats} />
              <UsageMeter label="Collaborative Seats" used={0} limit={sub.collaborative_seats < 0 ? -1 : sub.collaborative_seats} />
              <UsageMeter label="Active Projects" used={0} limit={sub.active_projects < 0 ? -1 : sub.active_projects} />
              <UsageMeter label="Active Storage" used={0} limit={sub.active_storage_gb || 0} unit=" GB" />
              <UsageMeter label="Archive Storage" used={0} limit={sub.archive_storage_gb || 0} unit=" GB" />
              <UsageMeter label="Bandwidth" used={0} limit={sub.bandwidth_gb} unit=" GB" />
            </div>

            {/* Active modules */}
            {modules.length > 0 && (
              <div className="pt-2">
                <p className="text-xs uppercase tracking-wide text-muted-gray mb-2">Active Modules</p>
                <div className="flex flex-wrap gap-2">
                  {modules.map((mod: any) => (
                    <Badge key={mod.module_key} variant="outline" className="text-xs text-accent-yellow border-accent-yellow/30">
                      {mod.module_name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setShowConfigurator(true)}>
                {isFree ? 'Upgrade Plan' : 'Change Plan'}
              </Button>
              {!isFree && (
                <>
                  <Button size="sm" variant="outline" onClick={handlePortal}>Update Payment</Button>
                  <Button size="sm" variant="ghost" className="text-primary-red hover:text-primary-red/80" onClick={handleCancel}>Cancel</Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trial or expired or no subscription — show subscribe CTA */}
      {(!isActive && !showConfigurator) && (
        <Card className="bg-charcoal-black/50 border-muted-gray/20">
          <CardContent className="p-8 text-center">
            <CreditCard className="h-10 w-10 mx-auto mb-3 text-accent-yellow" />
            <h4 className="text-lg font-medium text-bone-white mb-2">
              {billingStatus === 'canceled' ? 'Resubscribe to Backlot' :
               billingStatus === 'expired' ? 'Subscribe to Backlot' :
               'Get Started with Backlot'}
            </h4>
            <p className="text-sm text-muted-gray mb-4">
              {billingStatus === 'trial' ? 'Upgrade from your trial to keep full access.' :
               billingStatus === 'expired' ? 'Your trial has ended. Subscribe to restore access.' :
               billingStatus === 'canceled' ? 'Resubscribe to restore full access to your projects.' :
               'Start free or choose a paid plan to unlock more features.'}
            </p>
            <Button
              className="bg-accent-yellow text-charcoal-black hover:bg-yellow-400"
              onClick={() => setShowConfigurator(true)}
            >
              {billingStatus === 'canceled' ? 'Resubscribe' : 'Choose a Plan'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Configurator */}
      {showConfigurator && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-bone-white font-medium">
              {isActive && !isFree ? 'Change Your Plan' : isFree ? 'Upgrade Your Plan' : 'Choose Your Plan'}
            </h4>
            <Button variant="ghost" size="sm" className="text-muted-gray" onClick={() => setShowConfigurator(false)}>
              Cancel
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <PlanConfigurator onConfigChange={handleConfigChange} />
            </div>
            <div>
              <PriceSummary
                config={planConfig}
                showCTA
                ctaLabel={isActive && !isFree ? 'Update Plan' : isFree ? 'Upgrade' : 'Subscribe'}
                ctaLoading={createCheckout.isPending || trialConvert.isPending}
                onCTAClick={handleCheckout}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddSeatForm({ organizationId, onSuccess }: { organizationId: string; onSuccess: () => void }) {
  const { toast } = useToast();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<'admin' | 'collaborative'>('collaborative');
  const [canCreateProjects, setCanCreateProjects] = useState(false);

  const addSeat = useAddOrganizationSeat();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId.trim()) {
      toast({ title: 'Please enter a user ID or email', variant: 'destructive' });
      return;
    }

    addSeat.mutate(
      {
        organizationId,
        userId: userId.trim(),
        role,
        canCreateProjects,
      },
      {
        onSuccess: () => {
          toast({ title: 'Seat added successfully' });
          onSuccess();
        },
        onError: (error: any) => {
          toast({ title: 'Failed to add seat', description: error.message, variant: 'destructive' });
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="userId">User ID</Label>
        <Input
          id="userId"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Enter user ID"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'collaborative')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin - Full access to all projects</SelectItem>
            <SelectItem value="collaborative">Collaborative - Access specific projects</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {role === 'collaborative' && (
        <div className="flex items-center justify-between">
          <Label htmlFor="canCreate">Can create projects</Label>
          <Switch
            id="canCreate"
            checked={canCreateProjects}
            onCheckedChange={setCanCreateProjects}
          />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancel
        </Button>
        <Button type="submit" disabled={addSeat.isPending}>
          {addSeat.isPending ? 'Adding...' : 'Add Seat'}
        </Button>
      </div>
    </form>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function OrganizationsPage() {
  const { data: organizations, isLoading } = useMyBacklotOrganizations();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('checkout') === 'success') {
      toast({ title: 'Subscription activated!', description: 'Your Backlot plan is now active.' });
      // Clean query params but preserve org/tab if present
      params.delete('checkout');
      params.delete('config_id');
      const remaining = params.toString();
      navigate(`/organizations${remaining ? `?${remaining}` : ''}`, { replace: true });
    }
  }, [location.search, navigate, toast]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-bone-white">Organizations</h1>
          <p className="text-muted-gray">Manage your organization Backlot access and team members</p>
        </div>
      </div>

      {organizations && organizations.length > 0 ? (
        <div className="space-y-6">
          {organizations.map((org) => (
            <OrganizationPanel key={org.id} org={org} />
          ))}
        </div>
      ) : (
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-gray" />
            <h3 className="text-lg font-medium text-bone-white mb-2">No Organizations</h3>
            <p className="text-muted-gray mb-6">
              You're not a member of any organizations with Backlot access.
            </p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Organization
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
