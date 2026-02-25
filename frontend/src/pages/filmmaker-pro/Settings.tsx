/**
 * Filmmaker Pro Settings — Subscription management, billing portal.
 */
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import {
  useFilmmakerProStatus,
  useFilmmakerProCheckout,
  useCancelFilmmakerPro,
  useReactivateFilmmakerPro,
  useFilmmakerProPortal,
} from '@/hooks/useFilmmakerPro';
import { useEnrichedProfile } from '@/context/EnrichedProfileContext';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';

const Settings = () => {
  const { profile } = useEnrichedProfile();
  const { data: subStatus, isLoading } = useFilmmakerProStatus();
  const checkoutMutation = useFilmmakerProCheckout();
  const cancelMutation = useCancelFilmmakerPro();
  const reactivateMutation = useReactivateFilmmakerPro();
  const portalMutation = useFilmmakerProPortal();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');

  const isPro = subStatus?.is_pro;
  const checkoutStatus = searchParams.get('checkout');

  useEffect(() => {
    if (checkoutStatus === 'success') {
      toast({ title: 'Welcome to Filmmaker Pro!', description: 'Your subscription is now active.' });
    }
  }, [checkoutStatus]);

  const handleCheckout = async () => {
    try {
      const result = await checkoutMutation.mutateAsync({ plan: selectedPlan });
      if (result?.checkout_url) {
        window.location.href = result.checkout_url;
      }
    } catch {
      toast({ title: 'Error creating checkout', variant: 'destructive' });
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync({ cancel_at_period_end: true });
      toast({ title: 'Subscription will cancel at period end' });
    } catch {
      toast({ title: 'Error canceling', variant: 'destructive' });
    }
  };

  const handleReactivate = async () => {
    try {
      await reactivateMutation.mutateAsync();
      toast({ title: 'Subscription reactivated' });
    } catch {
      toast({ title: 'Error reactivating', variant: 'destructive' });
    }
  };

  const handlePortal = async () => {
    try {
      const result = await portalMutation.mutateAsync();
      if (result?.url) window.location.href = result.url;
    } catch {
      toast({ title: 'Error opening billing portal', variant: 'destructive' });
    }
  };

  if (isLoading) return <p className="text-muted-gray text-center py-12">Loading...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-heading text-bone-white">Settings</h1>

      {/* Current Subscription Status */}
      {isPro ? (
        <Card className="bg-charcoal-black border-green-600/30">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-green-600/10">
                <CheckCircle className="h-6 w-6 text-green-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-medium text-bone-white">Filmmaker Pro</h3>
                  <Badge className="bg-green-600">
                    {subStatus?.status === 'trialing' ? 'Free Trial' : 'Active'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-gray mb-3">
                  {subStatus?.plan === 'annual' ? '$99/year' : '$9.99/month'}
                  {subStatus?.current_period_end && (
                    <> &middot; Renews {new Date(subStatus.current_period_end).toLocaleDateString()}</>
                  )}
                </p>
                {subStatus?.cancel_at_period_end && (
                  <div className="flex items-center gap-2 mb-3 p-2 rounded bg-yellow-600/10 border border-yellow-600/30">
                    <AlertCircle className="h-4 w-4 text-yellow-400" />
                    <p className="text-sm text-yellow-400">
                      Cancels at end of period ({new Date(subStatus.current_period_end).toLocaleDateString()})
                    </p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handlePortal}>
                    <CreditCard className="h-4 w-4 mr-2" />Manage Billing
                  </Button>
                  {subStatus?.cancel_at_period_end ? (
                    <Button className="bg-green-600 hover:bg-green-700" onClick={handleReactivate}
                      disabled={reactivateMutation.isPending}>
                      Reactivate
                    </Button>
                  ) : (
                    <Button variant="destructive" onClick={handleCancel} disabled={cancelMutation.isPending}>
                      Cancel Subscription
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Subscription Plans */}
          <Card className="bg-charcoal-black border-amber-500/30">
            <CardHeader>
              <CardTitle className="text-bone-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                Subscribe to Filmmaker Pro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    selectedPlan === 'monthly'
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-muted-gray hover:border-muted-gray/70'
                  }`}
                  onClick={() => setSelectedPlan('monthly')}
                >
                  <p className="text-lg font-bold text-bone-white">$9.99<span className="text-sm font-normal text-muted-gray">/month</span></p>
                  <p className="text-xs text-muted-gray mt-1">Billed monthly</p>
                </button>
                <button
                  className={`p-4 rounded-lg border text-left transition-colors relative ${
                    selectedPlan === 'annual'
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-muted-gray hover:border-muted-gray/70'
                  }`}
                  onClick={() => setSelectedPlan('annual')}
                >
                  <Badge className="absolute -top-2 right-2 bg-green-600 text-xs">Save ~$21</Badge>
                  <p className="text-lg font-bold text-bone-white">$99<span className="text-sm font-normal text-muted-gray">/year</span></p>
                  <p className="text-xs text-muted-gray mt-1">$8.25/month &middot; 2 months free</p>
                </button>
              </div>

              <ul className="space-y-2 text-sm text-muted-gray">
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-400" />Profile analytics &amp; viewer insights</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-400" />Boosted visibility in directory</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-400" />Public rate card on profile</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-400" />Standalone invoicing</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-400" />Advanced availability calendar</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-400" />Portfolio site generator</li>
                <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-400" />PRO badge on profile</li>
              </ul>

              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-charcoal-black font-bold"
                onClick={handleCheckout} disabled={checkoutMutation.isPending}>
                Start 14-Day Free Trial
              </Button>
              <p className="text-xs text-muted-gray text-center">Cancel anytime. No charge during trial.</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default Settings;
