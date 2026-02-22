/**
 * Order Dues Card — Pay / Manage membership dues
 */
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  orderAPI,
  MembershipStatus,
  DuesPayment,
  MEMBERSHIP_TIERS,
  MembershipTier,
} from '@/lib/api/order';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface OrderDuesCardProps {
  membershipStatus?: MembershipStatus;
}

export default function OrderDuesCard({ membershipStatus }: OrderDuesCardProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [payments, setPayments] = useState<DuesPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);

  // Handle checkout success/cancel return
  useEffect(() => {
    const duesParam = searchParams.get('dues');
    if (duesParam === 'success') {
      toast.success('Dues payment set up successfully!');
      searchParams.delete('dues');
      setSearchParams(searchParams, { replace: true });
    } else if (duesParam === 'cancelled') {
      toast.info('Dues payment cancelled');
      searchParams.delete('dues');
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  // Load payment history
  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      const result = await orderAPI.getMyDuesPayments();
      setPayments(result.payments || []);
    } catch {
      // Silently handle — user may not have any payments yet
    } finally {
      setPaymentsLoading(false);
    }
  };

  const handlePayDues = async (tier: MembershipTier) => {
    setLoading(true);
    try {
      const result = await orderAPI.createDuesCheckout({
        target_tier: tier,
        return_url: '/order/dashboard',
      });
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to start checkout');
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const result = await orderAPI.createDuesPortalSession();
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  };

  const currentTier = membershipStatus?.membership_tier;
  const duesStatus = membershipStatus?.dues_status;
  const hasActiveSubscription = duesStatus === 'active';
  const tierInfo = MEMBERSHIP_TIERS.find(t => t.value === currentTier);

  return (
    <Card className="border-2 border-accent-yellow/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-accent-yellow" />
            <CardTitle className="text-lg font-heading">Membership Dues</CardTitle>
          </div>
          {duesStatus === 'active' && (
            <Badge className="bg-accent-yellow text-charcoal-black">Current</Badge>
          )}
          {duesStatus === 'past_due' && (
            <Badge variant="destructive">Past Due</Badge>
          )}
          {(!duesStatus || duesStatus === 'pending') && (
            <Badge variant="secondary">Setup Required</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasActiveSubscription ? (
          <>
            {/* Active subscription info */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-gray">Tier</span>
                <span className="font-medium">{tierInfo?.label || currentTier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-gray">Amount</span>
                <span className="font-medium">
                  ${tierInfo ? (tierInfo.price_cents / 100).toFixed(0) : '—'}/mo
                </span>
              </div>
              {membershipStatus?.next_billing_date && (
                <div className="flex justify-between">
                  <span className="text-muted-gray">Next Billing</span>
                  <span className="font-medium">
                    {format(new Date(membershipStatus.next_billing_date), 'MMM d, yyyy')}
                  </span>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              className="w-full border-muted-gray hover:border-accent-yellow hover:text-accent-yellow"
              onClick={handleManageBilling}
              disabled={portalLoading}
            >
              {portalLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Manage Billing
            </Button>
          </>
        ) : (
          <>
            {/* No subscription — show tier selection */}
            <p className="text-sm text-muted-gray">
              Select a tier to set up your membership dues:
            </p>
            <div className="space-y-2">
              {MEMBERSHIP_TIERS.map((tier) => (
                <Button
                  key={tier.value}
                  variant="outline"
                  className="w-full justify-between border-muted-gray hover:border-accent-yellow hover:text-accent-yellow"
                  onClick={() => handlePayDues(tier.value)}
                  disabled={loading}
                >
                  <span>{tier.label}</span>
                  <span className="font-bold">${(tier.price_cents / 100).toFixed(0)}/mo</span>
                </Button>
              ))}
            </div>
          </>
        )}

        {/* Payment History */}
        {!paymentsLoading && payments.length > 0 && (
          <div className="border-t border-muted-gray/30 pt-3 mt-3">
            <p className="text-xs text-muted-gray uppercase tracking-wider mb-2">Recent Payments</p>
            <div className="space-y-1.5">
              {payments.slice(0, 3).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5">
                    {p.status === 'succeeded' ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : p.status === 'pending' ? (
                      <Clock className="h-3 w-3 text-yellow-500" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-red-500" />
                    )}
                    <span className="text-muted-gray">
                      {format(new Date(p.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <span className="font-medium">${(p.amount_cents / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
