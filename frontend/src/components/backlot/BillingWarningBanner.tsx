import { AlertTriangle, CreditCard, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePortalSession } from '@/hooks/useSubscriptionBilling';

interface BillingWarningBannerProps {
  billingStatus: string;
  graceInfo?: {
    past_due_since: string;
    grace_period_end: string;
    grace_days_remaining: number;
    is_past_grace?: boolean;
  } | null;
  organizationId: string;
  onSubscribe?: () => void;
}

export default function BillingWarningBanner({
  billingStatus,
  graceInfo,
  organizationId,
  onSubscribe,
}: BillingWarningBannerProps) {
  const portalSession = usePortalSession();

  const handleUpdatePayment = () => {
    portalSession.mutate(
      { orgId: organizationId, returnTo: '/organizations' },
      { onSuccess: (data: any) => { window.location.href = data.url; } }
    );
  };

  // Past due within grace period (yellow warning)
  if (billingStatus === 'past_due' && graceInfo && !graceInfo.is_past_grace) {
    return (
      <div className="rounded-lg border border-yellow-600/50 bg-yellow-900/20 p-4 mb-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="text-yellow-400 font-medium text-sm">Payment Failed</h4>
            <p className="text-yellow-200/80 text-sm mt-1">
              We couldn't process your payment. You have{' '}
              <span className="font-bold text-yellow-400">{graceInfo.grace_days_remaining} day(s)</span>{' '}
              to update your payment method before your account becomes read-only.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-yellow-600 text-yellow-400 hover:bg-yellow-900/40 flex-shrink-0"
            onClick={handleUpdatePayment}
            disabled={portalSession.isPending}
          >
            <CreditCard className="h-4 w-4 mr-1.5" />
            Update Payment
          </Button>
        </div>
      </div>
    );
  }

  // Past due beyond grace period (red alert)
  if (billingStatus === 'past_due' && graceInfo?.is_past_grace) {
    return (
      <div className="rounded-lg border border-primary-red/50 bg-red-900/20 p-4 mb-4">
        <div className="flex items-start gap-3">
          <XCircle className="h-5 w-5 text-primary-red mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="text-primary-red font-medium text-sm">Account Read-Only</h4>
            <p className="text-red-200/80 text-sm mt-1">
              Your payment is past due and the grace period has ended. Your data is safe, but you cannot create or edit projects until payment is updated.
            </p>
          </div>
          <Button
            size="sm"
            className="bg-primary-red hover:bg-red-600 text-white flex-shrink-0"
            onClick={handleUpdatePayment}
            disabled={portalSession.isPending}
          >
            <CreditCard className="h-4 w-4 mr-1.5" />
            Update Payment
          </Button>
        </div>
      </div>
    );
  }

  // Expired trial
  if (billingStatus === 'expired') {
    return (
      <div className="rounded-lg border border-primary-red/50 bg-red-900/20 p-4 mb-4">
        <div className="flex items-start gap-3">
          <XCircle className="h-5 w-5 text-primary-red mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="text-primary-red font-medium text-sm">Trial Expired</h4>
            <p className="text-red-200/80 text-sm mt-1">
              Your free trial has ended. Subscribe to continue creating and editing. Your data is preserved in read-only mode.
            </p>
          </div>
          {onSubscribe && (
            <Button
              size="sm"
              className="bg-accent-yellow text-charcoal-black hover:bg-yellow-400 flex-shrink-0"
              onClick={onSubscribe}
            >
              Subscribe Now
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Canceled subscription
  if (billingStatus === 'canceled') {
    return (
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4 mb-4">
        <div className="flex items-start gap-3">
          <XCircle className="h-5 w-5 text-muted-gray mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="text-bone-white font-medium text-sm">Subscription Canceled</h4>
            <p className="text-muted-gray text-sm mt-1">
              Your subscription has been canceled. Your data is accessible in read-only mode. Resubscribe at any time to restore full access.
            </p>
          </div>
          {onSubscribe && (
            <Button
              size="sm"
              className="bg-accent-yellow text-charcoal-black hover:bg-yellow-400 flex-shrink-0"
              onClick={onSubscribe}
            >
              Resubscribe
            </Button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
