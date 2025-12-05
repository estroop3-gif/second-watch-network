import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Calendar, RefreshCw, XCircle, CheckCircle } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";
import { toast } from "sonner";
import { SubscriptionActivityLog } from "@/components/subscriptions/SubscriptionActivityLog";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/utils/telemetry";

const SubscriptionSettingsPage = () => {
  const { hasRole } = usePermissions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', description: '', onConfirm: () => {} });
  const location = useLocation();
  const navigate = useNavigate();

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
          // Ensure user receives updated roles
          await supabase.auth.refreshSession();
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
  const nextBillingDate = isPremium ? 'July 30, 2024' : 'N/A';
  const paymentMethod = isPremium ? 'Visa ending in 4242' : 'N/A';
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
    const { data, error } = await supabase.functions.invoke("billing-create-portal-session", {
      body: { returnTo: "/account/billing" },
    });
    if (error) {
      toast.error(error.message || "Couldn’t open billing portal. Please try again.");
      return;
    }
    const url = (data as { url?: string } | null)?.url;
    if (!url) {
      toast.error("Couldn’t open billing portal. Please try again.");
      return;
    }
    window.location.href = url;
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
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>This is your active subscription plan.</CardDescription>
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
                  <span className="text-white">{paymentMethod}</span>
                </div>
                <Separator className="bg-muted-gray" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Calendar className="h-5 w-5" />
                    <span>Next Billing Date</span>
                  </div>
                  <span className="text-white">{nextBillingDate}</span>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={openBillingPortal}>Update Payment Method</Button>
                <Button variant="ghost" onClick={openBillingPortal}>Billing History</Button>
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