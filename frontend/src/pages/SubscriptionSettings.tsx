import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Calendar, RefreshCw, XCircle, CheckCircle, Building2, Film, ArrowRight } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";
import { toast } from "sonner";
import { SubscriptionActivityLog } from "@/components/subscriptions/SubscriptionActivityLog";
import { api, safeStorage } from "@/lib/api";
import { track } from "@/utils/telemetry";
import { useMyBacklotOrganizations } from "@/hooks/useOrganizations";

const SubscriptionSettingsPage = () => {
  const { hasRole } = usePermissions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', description: '', onConfirm: () => {} });
  const location = useLocation();
  const navigate = useNavigate();
  const { data: backlotOrgs, isLoading: backlotOrgsLoading } = useMyBacklotOrganizations();

  useEffect(() => {
    try { track("billing_open"); } catch {}
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const checkout = params.get("checkout");
    const returnTo = params.get("returnTo") || undefined;
    if (checkout === "success") {
      (async () => {
        try {
          // Ensure user receives updated roles via token refresh
          const refreshToken = safeStorage.getItem('refresh_token');
          if (refreshToken) {
            await api.refreshToken(refreshToken);
          }
        } finally {
          toast.success("Premium activated");
          try { track("checkout_success", { returnTo }); } catch {}
          if (returnTo) {
            navigate(returnTo, { replace: true });
          } else {
            // Clean query param
            navigate("/account/billing", { replace: true });
          }
        }
      })();
    }
  }, [location.search, navigate]);

  // Placeholder data - will be replaced with real data
  const isPremium = hasRole('premium');
  const currentPlan = isPremium ? 'Premium' : 'Free';
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(isPremium ? 'monthly' : 'monthly');

  const handleCancelSubscription = () => {
    setModalContent({
      title: 'Confirm Cancellation',
      description: 'Are you sure you want to cancel your subscription? Your plan will remain active until the end of the current billing period.',
      onConfirm: () => {
        console.log("Subscription cancellation confirmed.");
        toast.success("Your subscription has been cancelled.");
        setIsModalOpen(false);
      },
    });
    setIsModalOpen(true);
  };

  const handleSwitchBillingCycle = (isYearly: boolean) => {
    const newCycle = isYearly ? 'Yearly' : 'Monthly';
    setModalContent({
      title: `Confirm Switch to ${newCycle} Billing`,
      description: `Are you sure you want to switch to a ${newCycle.toLowerCase()} billing cycle?`,
      onConfirm: () => {
        setBillingCycle(isYearly ? 'yearly' : 'monthly');
        console.log(`Switched to ${newCycle} billing.`);
        toast.success(`Successfully switched to ${newCycle} billing.`);
        setIsModalOpen(false);
      },
    });
    setIsModalOpen(true);
  };

  const openBillingPortal = async () => {
    try { track("portal_open_click"); } catch {}
    try {
      const result = await api.createPortalSession("/account/billing");
      if (result?.url) {
        window.location.href = result.url;
      } else {
        toast.error("Couldn't open billing portal. Please try again.");
      }
    } catch (error: any) {
      toast.error(error?.message || "Couldn't open billing portal. Please try again.");
    }
  };

  return (
    <>
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8 max-w-4xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white">Subscription & Billing</h1>
          <p className="mt-2 text-muted-foreground">Manage your subscription plan and billing details.</p>
        </header>

        <div className="space-y-8">
          {/* Current Plan Card */}
          <Card className="bg-muted-gray/20 border-muted-gray">
            <CardHeader>
              <CardTitle>SWN Watch Membership</CardTitle>
              <CardDescription>Your platform viewing subscription.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-xl font-semibold text-white">{currentPlan}</span>
                  {isPremium && <Badge variant="premium">PREMIUM</Badge>}
                </div>
                <Button asChild variant="outline">
                  <Link to="/account/membership">
                    {isPremium ? 'Change Plan' : 'Upgrade Plan'}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Billing Details Card */}
          {isPremium && (
            <Card className="bg-muted-gray/20 border-muted-gray">
              <CardHeader>
                <CardTitle>Billing Details</CardTitle>
                <CardDescription>Manage your payment method and view billing history.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <CreditCard className="h-5 w-5" />
                    <span>Payment Method</span>
                  </div>
                  <Button variant="link" className="text-accent-yellow p-0 h-auto" onClick={openBillingPortal}>
                    Manage in Stripe
                  </Button>
                </div>
                <Separator className="bg-muted-gray" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Calendar className="h-5 w-5" />
                    <span>Billing History</span>
                  </div>
                  <Button variant="link" className="text-accent-yellow p-0 h-auto" onClick={openBillingPortal}>
                    View Invoices
                  </Button>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" onClick={openBillingPortal}>
                  Open Billing Portal
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Manage Subscription Card */}
          {isPremium && (
            <Card className="bg-muted-gray/20 border-muted-gray">
              <CardHeader>
                <CardTitle>Manage Subscription</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <RefreshCw className="h-5 w-5" />
                    <span>Billing Cycle</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="billing-cycle-switch" className="text-white">Monthly</Label>
                    <Switch
                      id="billing-cycle-switch"
                      checked={billingCycle === 'yearly'}
                      onCheckedChange={handleSwitchBillingCycle}
                    />
                    <Label htmlFor="billing-cycle-switch" className="text-white">Yearly</Label>
                  </div>
                </div>
                <Separator className="bg-muted-gray" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white">Cancel Subscription</p>
                    <p className="text-sm text-muted-foreground">Your plan will remain active until the end of the current billing period.</p>
                  </div>
                  <Button variant="destructive" onClick={handleCancelSubscription}>
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upgrade Suggestions */}
          {!isPremium && (
            <Card className="bg-gradient-to-r from-yellow-500/10 via-yellow-400/10 to-yellow-300/10 border-accent-yellow/30">
              <CardHeader>
                <CardTitle className="text-accent-yellow">Upgrade to Premium</CardTitle>
                <CardDescription className="text-muted-foreground">Unlock the full Second Watch Network experience.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-bone-white">
                  <li className="flex items-center"><CheckCircle className="h-4 w-4 mr-2 text-accent-yellow" /> No ads on all content</li>
                  <li className="flex items-center"><CheckCircle className="h-4 w-4 mr-2 text-accent-yellow" /> Watch all Second Watch Originals for free</li>
                  <li className="flex items-center"><CheckCircle className="h-4 w-4 mr-2 text-accent-yellow" /> Premium badge and enhanced visibility</li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
                  <Link to="/account/membership">Upgrade Now</Link>
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Backlot Production Subscriptions */}
          <Card className="bg-muted-gray/20 border-muted-gray">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Film className="h-5 w-5 text-accent-yellow" />
                <CardTitle>Backlot Production Plans</CardTitle>
              </div>
              <CardDescription>Your production management subscriptions.</CardDescription>
            </CardHeader>
            <CardContent>
              {backlotOrgsLoading ? (
                <div className="text-sm text-muted-foreground py-4 text-center">Loading organizations...</div>
              ) : backlotOrgs && backlotOrgs.length > 0 ? (
                <div className="space-y-3">
                  {backlotOrgs.map((org) => (
                    <div
                      key={org.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-muted-gray/30 bg-charcoal-black/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-accent-yellow/10">
                          <Building2 className="h-4 w-4 text-accent-yellow" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-bone-white">{org.name}</div>
                          <div className="text-xs text-muted-gray">
                            {org.backlot_billing_status === 'active' || org.backlot_billing_status === 'trialing'
                              ? 'Active'
                              : org.backlot_billing_status === 'free'
                              ? 'Free Plan'
                              : org.backlot_billing_status?.charAt(0).toUpperCase() + org.backlot_billing_status?.slice(1)}
                            {' '}&middot;{' '}
                            {org.role?.charAt(0).toUpperCase() + org.role?.slice(1)}
                            {' '}&middot;{' '}
                            {org.seats_used}/{org.backlot_seat_limit === -1 ? '∞' : org.backlot_seat_limit} seats
                            {' '}&middot;{' '}
                            {org.projects_count} project{org.projects_count !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/organizations?org=${org.id}&tab=billing`}>
                          Manage
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Film className="h-10 w-10 text-muted-gray/50 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    You don't have any Backlot organizations yet. Start with a free trial to explore production tools.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Button asChild className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
                      <Link to="/backlot/free-trial">Start Free Trial</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/pricing">View Plans</Link>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Subscription Activity Log */}
          <SubscriptionActivityLog />
        </div>
      </div>
      <ConfirmationDialog
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        title={modalContent.title}
        description={modalContent.description}
        onConfirm={modalContent.onConfirm}
      />
    </>
  );
};

export default SubscriptionSettingsPage;
