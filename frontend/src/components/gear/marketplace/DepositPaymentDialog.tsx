/**
 * DepositPaymentDialog.tsx
 * Dialog for processing Stripe payment for rental deposit
 */
import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Loader2,
  Check,
  AlertCircle,
  Lock,
  DollarSign,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

import { useRentalPayments } from '@/hooks/gear/useGearMarketplace';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getStripePromise } from '@/lib/stripe';

interface DepositPaymentDialogProps {
  quoteId: string;
  depositAmount: number;
  totalAmount: number;
  rentalHouseName: string;
  isOpen: boolean;
  onClose: () => void;
  onPaymentComplete: () => void;
}

type PaymentStep = 'loading' | 'ready' | 'processing' | 'success' | 'error';

// Inner form component that uses Stripe hooks (must be inside Elements provider)
function PaymentForm({
  depositAmount,
  paymentIntentId,
  onSuccess,
  onError,
  onProcessing,
  step,
  confirmPaymentMutation,
}: {
  depositAmount: number;
  paymentIntentId: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
  onProcessing: () => void;
  step: PaymentStep;
  confirmPaymentMutation: any;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;

    onProcessing();

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: window.location.href,
      },
    });

    if (error) {
      onError(error.message || 'Payment failed');
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      // Record the successful payment in our backend
      try {
        await confirmPaymentMutation.mutateAsync(paymentIntentId);
        onSuccess();
      } catch (err: any) {
        onError(err.message || 'Payment succeeded but failed to record. Contact support.');
      }
    } else if (paymentIntent && paymentIntent.status === 'requires_action') {
      // 3D Secure or other action — Stripe handles this automatically
      onError('Additional verification required. Please try again.');
    } else {
      onError('Unexpected payment status. Please try again.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/20 bg-white/5 p-4">
        <PaymentElement
          onReady={() => setReady(true)}
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-gray">
        <Lock className="h-3 w-3" />
        <span>Secured by Stripe. Your card details are encrypted.</span>
      </div>

      {step === 'ready' && (
        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSubmit}
            className="flex-1 gap-2"
            disabled={!stripe || !elements || !ready}
          >
            <DollarSign className="h-4 w-4" />
            Pay ${depositAmount.toLocaleString()}
          </Button>
        </div>
      )}
    </div>
  );
}

export function DepositPaymentDialog({
  quoteId,
  depositAmount,
  totalAmount,
  rentalHouseName,
  isOpen,
  onClose,
  onPaymentComplete,
}: DepositPaymentDialogProps) {
  const [step, setStep] = useState<PaymentStep>('loading');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stripeReady, setStripeReady] = useState(false);

  const stripePromise = getStripePromise();

  // Check if Stripe loaded
  useEffect(() => {
    stripePromise.then((s) => setStripeReady(!!s));
  }, []);

  const { createPaymentIntent, confirmPayment } = useRentalPayments(quoteId);

  // Create payment intent when dialog opens
  useEffect(() => {
    if (isOpen && step === 'loading') {
      createPaymentIntent.mutate(
        { payment_type: 'deposit' },
        {
          onSuccess: (data: any) => {
            setClientSecret(data.client_secret);
            setPaymentIntentId(data.payment_intent_id);
            setStep('ready');
          },
          onError: (error: any) => {
            setErrorMessage(error.message || 'Failed to initialize payment');
            setStep('error');
          },
        }
      );
    }
  }, [isOpen]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setStep('loading');
      setClientSecret(null);
      setPaymentIntentId(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  const handleClose = () => {
    if (step === 'success') {
      onPaymentComplete();
    }
    onClose();
  };

  const stripeConfigured = stripeReady;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Pay Deposit
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Payment Summary */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-gray">Rental from</span>
              <span className="font-medium text-bone-white">{rentalHouseName}</span>
            </div>
            <Separator className="bg-white/10 my-3" />
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-gray">Deposit Amount</span>
                <span className="font-semibold text-accent-yellow text-lg">
                  ${depositAmount.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-gray">
                <span>Total Rental</span>
                <span>${totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-gray">
                <span>Remaining Balance</span>
                <span>${(totalAmount - depositAmount).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-accent-yellow mb-4" />
              <p className="text-muted-gray">Initializing payment...</p>
            </div>
          )}

          {/* Stripe not configured warning */}
          {step === 'ready' && !stripeConfigured && (
            <Alert className="border-yellow-500/30 bg-yellow-500/10">
              <AlertCircle className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-200">
                Stripe is not configured. Set VITE_STRIPE_PUBLISHABLE_KEY in your environment.
              </AlertDescription>
            </Alert>
          )}

          {/* Ready State - Stripe Payment Element */}
          {step === 'ready' && clientSecret && stripeConfigured && paymentIntentId && (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'night',
                  variables: {
                    colorPrimary: '#FCDC58',
                    colorBackground: '#1a1a1a',
                    colorText: '#F9F5EF',
                    colorDanger: '#FF3C3C',
                    borderRadius: '8px',
                  },
                },
              }}
            >
              <PaymentForm
                depositAmount={depositAmount}
                paymentIntentId={paymentIntentId}
                step={step}
                confirmPaymentMutation={confirmPayment}
                onSuccess={() => setStep('success')}
                onError={(msg) => {
                  setErrorMessage(msg);
                  setStep('error');
                }}
                onProcessing={() => setStep('processing')}
              />
            </Elements>
          )}

          {/* Processing State */}
          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-accent-yellow mb-4" />
              <p className="text-bone-white font-medium">Processing payment...</p>
              <p className="text-sm text-muted-gray mt-1">Please don't close this window</p>
            </div>
          )}

          {/* Success State */}
          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                <Check className="h-8 w-8 text-green-400" />
              </div>
              <p className="text-bone-white font-medium text-lg">Payment Successful!</p>
              <p className="text-sm text-muted-gray mt-1">
                Your deposit of ${depositAmount.toLocaleString()} has been processed.
              </p>
              <Badge className="mt-4 bg-green-500/20 text-green-400 border-green-500/30">
                Rental Confirmed
              </Badge>
            </div>
          )}

          {/* Error State */}
          {step === 'error' && (
            <Alert className="border-red-500/30 bg-red-500/10">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-200">
                {errorMessage || 'Payment failed. Please try again.'}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step === 'ready' && !stripeConfigured && (
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          )}
          {step === 'success' && (
            <Button onClick={handleClose} className="gap-2">
              <Check className="h-4 w-4" />
              Done
            </Button>
          )}
          {step === 'error' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={() => setStep('ready')}>
                Try Again
              </Button>
            </>
          )}
          {(step === 'loading' || step === 'processing') && (
            <Button disabled>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Please wait...
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DepositPaymentDialog;
