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

  const handlePayment = async () => {
    if (!clientSecret || !paymentIntentId) return;

    setStep('processing');

    // In a real implementation, you would use Stripe Elements here
    // For now, we'll simulate the payment flow
    // The actual Stripe integration would use:
    // const stripe = await loadStripe(STRIPE_PUBLISHABLE_KEY);
    // const { error, paymentIntent } = await stripe.confirmPayment({
    //   elements,
    //   confirmParams: { return_url: window.location.href },
    // });

    // Simulate payment processing
    try {
      // In production, this would be called after Stripe confirms the payment
      await confirmPayment.mutateAsync(paymentIntentId);
      setStep('success');
    } catch (error: any) {
      setErrorMessage(error.message || 'Payment failed');
      setStep('error');
    }
  };

  const handleClose = () => {
    if (step === 'success') {
      onPaymentComplete();
    }
    onClose();
  };

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

          {/* Ready State - Card Input */}
          {step === 'ready' && (
            <div className="space-y-4">
              {/* Placeholder for Stripe Elements */}
              <div className="rounded-lg border border-white/20 bg-white/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="h-4 w-4 text-muted-gray" />
                  <span className="text-sm text-bone-white">Card Details</span>
                </div>
                {/* In production, Stripe Elements would render here */}
                <div className="space-y-3">
                  <div className="h-10 rounded bg-white/10 flex items-center px-3">
                    <span className="text-sm text-muted-gray">**** **** **** ****</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-10 rounded bg-white/10 flex items-center px-3">
                      <span className="text-sm text-muted-gray">MM/YY</span>
                    </div>
                    <div className="h-10 rounded bg-white/10 flex items-center px-3">
                      <span className="text-sm text-muted-gray">CVC</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-gray mt-3 text-center">
                  Stripe Elements integration required for production
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-gray">
                <Lock className="h-3 w-3" />
                <span>Secured by Stripe. Your card details are encrypted.</span>
              </div>
            </div>
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
          {step === 'ready' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handlePayment} className="gap-2">
                <DollarSign className="h-4 w-4" />
                Pay ${depositAmount.toLocaleString()}
              </Button>
            </>
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
