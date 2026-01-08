/**
 * PaymentMethodSelector.tsx
 * Component for selecting payment method when approving a rental quote
 */
import React from 'react';
import {
  CreditCard,
  FileText,
  Check,
  AlertCircle,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

type PaymentMethod = 'stripe' | 'invoice';

interface PaymentMethodSelectorProps {
  selected: PaymentMethod | null;
  onSelect: (method: PaymentMethod) => void;
  acceptsStripe: boolean;
  acceptsInvoice: boolean;
  stripeConnected: boolean;
  depositRequired: boolean;
  depositAmount?: number;
  totalAmount?: number;
  hasProject?: boolean;
  disabled?: boolean;
}

export function PaymentMethodSelector({
  selected,
  onSelect,
  acceptsStripe,
  acceptsInvoice,
  stripeConnected,
  depositRequired,
  depositAmount,
  totalAmount,
  hasProject,
  disabled,
}: PaymentMethodSelectorProps) {
  const canUseStripe = acceptsStripe && stripeConnected;
  const canUseInvoice = acceptsInvoice && hasProject;

  if (!canUseStripe && !canUseInvoice) {
    return (
      <Alert className="border-yellow-500/30 bg-yellow-500/10">
        <AlertCircle className="h-4 w-4 text-yellow-400" />
        <AlertDescription className="text-yellow-200">
          No payment methods available. The rental house needs to configure payment options
          or link this rental to a project for invoice billing.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Credit Card Option */}
        {acceptsStripe && (
          <Card
            className={cn(
              'cursor-pointer transition-all hover:border-accent-yellow/50',
              selected === 'stripe'
                ? 'border-accent-yellow bg-accent-yellow/10'
                : 'border-white/10 bg-white/5',
              (!canUseStripe || disabled) && 'opacity-50 cursor-not-allowed'
            )}
            onClick={() => canUseStripe && !disabled && onSelect('stripe')}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    selected === 'stripe' ? 'bg-accent-yellow/20' : 'bg-white/10'
                  )}>
                    <CreditCard className={cn(
                      "w-5 h-5",
                      selected === 'stripe' ? 'text-accent-yellow' : 'text-muted-gray'
                    )} />
                  </div>
                  <div>
                    <p className="font-medium text-bone-white">Credit Card</p>
                    <p className="text-sm text-muted-gray">Pay securely with Stripe</p>
                  </div>
                </div>
                {selected === 'stripe' && (
                  <div className="w-5 h-5 rounded-full bg-accent-yellow flex items-center justify-center">
                    <Check className="w-3 h-3 text-charcoal-black" />
                  </div>
                )}
              </div>

              {!stripeConnected && acceptsStripe && (
                <p className="mt-3 text-xs text-yellow-400">
                  Rental house hasn't connected Stripe yet
                </p>
              )}

              {depositRequired && depositAmount && depositAmount > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-gray">Deposit due now</span>
                    <span className="text-bone-white font-medium">
                      ${depositAmount.toLocaleString()}
                    </span>
                  </div>
                  {totalAmount && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-muted-gray">Balance due later</span>
                      <span className="text-muted-gray">
                        ${(totalAmount - depositAmount).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Invoice Option */}
        {acceptsInvoice && (
          <Card
            className={cn(
              'cursor-pointer transition-all hover:border-accent-yellow/50',
              selected === 'invoice'
                ? 'border-accent-yellow bg-accent-yellow/10'
                : 'border-white/10 bg-white/5',
              (!canUseInvoice || disabled) && 'opacity-50 cursor-not-allowed'
            )}
            onClick={() => canUseInvoice && !disabled && onSelect('invoice')}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    selected === 'invoice' ? 'bg-accent-yellow/20' : 'bg-white/10'
                  )}>
                    <FileText className={cn(
                      "w-5 h-5",
                      selected === 'invoice' ? 'text-accent-yellow' : 'text-muted-gray'
                    )} />
                  </div>
                  <div>
                    <p className="font-medium text-bone-white">Invoice / Net Terms</p>
                    <p className="text-sm text-muted-gray">Link to project budget</p>
                  </div>
                </div>
                {selected === 'invoice' && (
                  <div className="w-5 h-5 rounded-full bg-accent-yellow flex items-center justify-center">
                    <Check className="w-3 h-3 text-charcoal-black" />
                  </div>
                )}
              </div>

              {!hasProject && acceptsInvoice && (
                <p className="mt-3 text-xs text-yellow-400">
                  Link this rental to a project to use invoice billing
                </p>
              )}

              {hasProject && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                      Backlot
                    </Badge>
                    <span className="text-sm text-muted-gray">
                      Invoice will be added to project
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Payment Summary */}
      {selected && totalAmount && (
        <div className="rounded-lg bg-white/5 p-4">
          <div className="flex justify-between items-center">
            <span className="text-muted-gray">Total Amount</span>
            <span className="text-xl font-semibold text-bone-white">
              ${totalAmount.toLocaleString()}
            </span>
          </div>
          {selected === 'stripe' && depositRequired && depositAmount && (
            <p className="text-sm text-muted-gray mt-2">
              You'll pay the ${depositAmount.toLocaleString()} deposit now.
              The remaining ${(totalAmount - depositAmount).toLocaleString()} will be charged before pickup.
            </p>
          )}
          {selected === 'invoice' && (
            <p className="text-sm text-muted-gray mt-2">
              An invoice will be created and linked to your project budget for approval.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default PaymentMethodSelector;
