/**
 * QuoteResponseDialog.tsx
 * Dialog for reviewing and approving/rejecting quotes from rental houses
 */
import React, { useState } from 'react';
import {
  X,
  Package,
  Calendar,
  Store,
  MapPin,
  Loader2,
  Check,
  XCircle,
  BadgeCheck,
  Shield,
  DollarSign,
  Clock,
  AlertTriangle,
  FileText,
  CreditCard,
  Receipt,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

import { useRentalQuote } from '@/hooks/gear/useGearMarketplace';
import type { GearRentalQuote, GearRentalQuoteItem } from '@/types/gear';

interface QuoteResponseDialogProps {
  quote: GearRentalQuote | null;
  isOpen: boolean;
  onClose: () => void;
  onApproved: () => void;
  onRejected: () => void;
}

export function QuoteResponseDialog({
  quote,
  isOpen,
  onClose,
  onApproved,
  onRejected,
}: QuoteResponseDialogProps) {
  // State
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'invoice'>('invoice');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejection, setShowRejection] = useState(false);

  // Use the rental quote hook to get mutations
  const { approveQuote, rejectQuote } = useRentalQuote(quote?.id || null);
  const isApproving = approveQuote.isPending;
  const isRejecting = rejectQuote.isPending;

  if (!quote) {
    return null;
  }

  // Calculate rental days
  const rentalDays = differenceInDays(
    parseISO(quote.rental_end_date),
    parseISO(quote.rental_start_date)
  ) + 1;

  // Check if quote is expired
  const isExpired = quote.valid_until && new Date(quote.valid_until) < new Date();

  // Format price
  const formatPrice = (price: number | undefined) => {
    if (!price && price !== 0) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const handleApprove = () => {
    approveQuote.mutate(
      { paymentMethod },
      {
        onSuccess: () => {
          onApproved();
        },
      }
    );
  };

  const handleReject = () => {
    rejectQuote.mutate(rejectionReason, {
      onSuccess: () => {
        onRejected();
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Review Quote
            <Badge
              variant={quote.status === 'sent' ? 'default' : 'outline'}
              className="ml-2 capitalize"
            >
              {quote.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Quote Number & Dates */}
          <div className="flex items-start justify-between">
            <div>
              {quote.quote_number && (
                <p className="text-sm text-muted-gray">
                  Quote #{quote.quote_number}
                </p>
              )}
              <p className="text-xs text-muted-gray">
                Received {format(parseISO(quote.created_at), 'MMM d, yyyy')}
              </p>
            </div>
            {quote.valid_until && (
              <div className="text-right">
                <p className="text-sm text-muted-gray">Valid Until</p>
                <p
                  className={`font-medium ${
                    isExpired ? 'text-primary-red' : 'text-bone-white'
                  }`}
                >
                  {format(parseISO(quote.valid_until), 'MMM d, yyyy')}
                </p>
                {isExpired && (
                  <Badge variant="destructive" className="mt-1">
                    Expired
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Rental House Info */}
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/10">
              {quote.rental_house_logo ? (
                <img
                  src={quote.rental_house_logo}
                  alt=""
                  className="h-full w-full rounded-lg object-cover"
                />
              ) : (
                <Store className="h-6 w-6 text-muted-gray" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-bone-white">
                  {quote.rental_house_name}
                </span>
              </div>
              {quote.prepared_by_name && (
                <p className="text-sm text-muted-gray">
                  Prepared by {quote.prepared_by_name}
                </p>
              )}
            </div>
          </div>

          {/* Rental Period */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-gray" />
              <span className="text-muted-gray">Rental Period:</span>
              <span className="font-medium text-bone-white">
                {format(parseISO(quote.rental_start_date), 'MMM d')} -{' '}
                {format(parseISO(quote.rental_end_date), 'MMM d, yyyy')}
              </span>
              <Badge variant="outline" className="ml-2">
                {rentalDays} {rentalDays === 1 ? 'day' : 'days'}
              </Badge>
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            <h4 className="font-medium text-bone-white">Items</h4>
            <div className="rounded-lg border border-white/10">
              {quote.items?.map((item, index) => (
                <QuoteLineItem key={item.id} item={item} isLast={index === (quote.items?.length || 0) - 1} />
              ))}
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <h4 className="mb-4 font-medium text-bone-white">Pricing Summary</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-gray">Subtotal</span>
                <span className="text-bone-white">{formatPrice(quote.subtotal)}</span>
              </div>
              {quote.insurance_amount && quote.insurance_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-gray">
                    <Shield className="h-3 w-3" />
                    Insurance
                  </span>
                  <span className="text-bone-white">
                    {formatPrice(quote.insurance_amount)}
                  </span>
                </div>
              )}
              {quote.delivery_fee && quote.delivery_fee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-gray">Delivery</span>
                  <span className="text-bone-white">{formatPrice(quote.delivery_fee)}</span>
                </div>
              )}
              {quote.tax_amount && quote.tax_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-gray">Tax</span>
                  <span className="text-bone-white">{formatPrice(quote.tax_amount)}</span>
                </div>
              )}
              <Separator className="my-2 bg-white/10" />
              <div className="flex justify-between">
                <span className="font-medium text-bone-white">Total</span>
                <span className="text-xl font-semibold text-bone-white">
                  {formatPrice(quote.total_amount)}
                </span>
              </div>
              {quote.deposit_amount && quote.deposit_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-gray">Deposit Required</span>
                  <span className="text-accent-yellow">
                    {formatPrice(quote.deposit_amount)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Terms & Policies */}
          {(quote.payment_terms || quote.cancellation_policy || quote.damage_policy) && (
            <div className="space-y-3">
              <h4 className="font-medium text-bone-white">Terms & Policies</h4>
              <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
                {quote.payment_terms && (
                  <div>
                    <span className="text-muted-gray">Payment Terms: </span>
                    <span className="text-bone-white">{quote.payment_terms}</span>
                  </div>
                )}
                {quote.cancellation_policy && (
                  <div>
                    <span className="text-muted-gray">Cancellation: </span>
                    <span className="text-bone-white">{quote.cancellation_policy}</span>
                  </div>
                )}
                {quote.damage_policy && (
                  <div>
                    <span className="text-muted-gray">Damage Policy: </span>
                    <span className="text-bone-white">{quote.damage_policy}</span>
                  </div>
                )}
                {quote.insurance_requirements && (
                  <div>
                    <span className="text-muted-gray">Insurance Requirements: </span>
                    <span className="text-bone-white">{quote.insurance_requirements}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes from rental house */}
          {quote.notes && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <h4 className="mb-2 font-medium text-bone-white">Notes from Rental House</h4>
              <p className="text-sm text-muted-gray">{quote.notes}</p>
            </div>
          )}

          {/* Payment Method Selection */}
          {quote.status === 'sent' && !isExpired && !showRejection && (
            <div className="space-y-3">
              <h4 className="font-medium text-bone-white">Payment Method</h4>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(value: 'stripe' | 'invoice') => setPaymentMethod(value)}
                className="space-y-2"
              >
                <Label
                  htmlFor="invoice"
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-4 hover:bg-white/10"
                >
                  <RadioGroupItem value="invoice" id="invoice" />
                  <Receipt className="h-5 w-5 text-muted-gray" />
                  <div className="flex-1">
                    <p className="font-medium text-bone-white">Invoice</p>
                    <p className="text-xs text-muted-gray">
                      Pay via invoice on rental house terms
                    </p>
                  </div>
                </Label>
                <Label
                  htmlFor="stripe"
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-4 hover:bg-white/10"
                >
                  <RadioGroupItem value="stripe" id="stripe" />
                  <CreditCard className="h-5 w-5 text-muted-gray" />
                  <div className="flex-1">
                    <p className="font-medium text-bone-white">Credit Card</p>
                    <p className="text-xs text-muted-gray">
                      Pay securely with credit card via Stripe
                    </p>
                  </div>
                </Label>
              </RadioGroup>
            </div>
          )}

          {/* Rejection Form */}
          {showRejection && (
            <div className="space-y-3">
              <h4 className="font-medium text-bone-white">Reason for Rejection</h4>
              <Textarea
                placeholder="Please provide a reason for rejecting this quote..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowRejection(false)}
                  disabled={isRejecting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={isRejecting}
                  className="gap-2"
                >
                  {isRejecting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4" />
                      Confirm Rejection
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Expired Warning */}
          {isExpired && (
            <Alert className="border-primary-red/30 bg-primary-red/10">
              <AlertTriangle className="h-4 w-4 text-primary-red" />
              <AlertDescription className="text-primary-red">
                This quote has expired. Please request a new quote from the rental house.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {quote.status === 'sent' && !isExpired && !showRejection && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowRejection(true)}>
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
            <Button onClick={handleApprove} disabled={isApproving} className="gap-2">
              {isApproving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Approve Quote
                </>
              )}
            </Button>
          </DialogFooter>
        )}

        {(quote.status !== 'sent' || isExpired) && !showRejection && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// QUOTE LINE ITEM
// ============================================================================

interface QuoteLineItemProps {
  item: GearRentalQuoteItem;
  isLast: boolean;
}

function QuoteLineItem({ item, isLast }: QuoteLineItemProps) {
  const formatPrice = (price: number | undefined) => {
    if (!price && price !== 0) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(price);
  };

  return (
    <div
      className={`flex items-center justify-between p-3 ${
        !isLast ? 'border-b border-white/10' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded bg-white/10">
          <Package className="h-5 w-5 text-muted-gray" />
        </div>
        <div>
          <p className="text-sm font-medium text-bone-white">
            {item.item_description || 'Item'}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-gray">
            <span>Qty: {item.quantity}</span>
            {item.quoted_rate && (
              <>
                <span className="text-white/30">|</span>
                <span>
                  {formatPrice(item.quoted_rate)}/{item.rate_type}
                </span>
              </>
            )}
            {item.is_substitution && (
              <Badge variant="outline" className="h-4 px-1 text-[10px]">
                Substitution
              </Badge>
            )}
          </div>
          {item.substitution_notes && (
            <p className="mt-1 text-xs text-muted-gray">
              Note: {item.substitution_notes}
            </p>
          )}
        </div>
      </div>
      <div className="text-right">
        <p className="font-medium text-bone-white">{formatPrice(item.line_total)}</p>
      </div>
    </div>
  );
}

export default QuoteResponseDialog;
