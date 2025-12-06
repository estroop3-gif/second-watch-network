/**
 * Ticket Purchase Component
 * Interface for purchasing voting tickets with Stripe
 */
'use client';

import { useState } from 'react';
import { Cycle, greenroomAPI } from '@/lib/api/greenroom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Ticket, CreditCard, Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TicketPurchaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycle: Cycle | null;
  currentTickets?: number;
  onSuccess?: () => void;
}

export function TicketPurchase({
  open,
  onOpenChange,
  cycle,
  currentTickets = 0,
  onSuccess,
}: TicketPurchaseProps) {
  const [ticketCount, setTicketCount] = useState(10);
  const [isLoading, setIsLoading] = useState(false);

  if (!cycle) return null;

  const maxPurchasable = cycle.max_tickets_per_user - currentTickets;
  const totalAmount = ticketCount * cycle.ticket_price;

  const handlePurchase = async () => {
    if (ticketCount < 1 || ticketCount > maxPurchasable) {
      toast.error('Invalid ticket count');
      return;
    }

    try {
      setIsLoading(true);
      const response = await greenroomAPI.purchaseTickets({
        cycle_id: cycle.id,
        ticket_count: ticketCount,
      });

      // Redirect to Stripe Checkout
      if (response.checkout_url) {
        window.location.href = response.checkout_url;
      } else {
        toast.error('Failed to create checkout session');
      }
    } catch (error) {
      console.error('Purchase failed:', error);
      toast.error('Failed to initiate purchase. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const quickAmounts = [5, 10, 25, 50, 100].filter(n => n <= maxPurchasable);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Purchase Voting Tickets
          </DialogTitle>
          <DialogDescription>
            Buy tickets to vote for projects in {cycle.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Tickets Info */}
          {currentTickets > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                You already have <strong>{currentTickets}</strong> ticket{currentTickets !== 1 ? 's' : ''} for this cycle.
                You can purchase up to <strong>{maxPurchasable}</strong> more.
              </AlertDescription>
            </Alert>
          )}

          {maxPurchasable <= 0 ? (
            <Alert variant="destructive">
              <AlertDescription>
                You have reached the maximum of {cycle.max_tickets_per_user} tickets for this cycle.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Ticket Count Input */}
              <div className="space-y-2">
                <Label htmlFor="purchaseCount">Number of Tickets</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTicketCount(Math.max(1, ticketCount - 1))}
                    disabled={ticketCount <= 1}
                  >
                    -
                  </Button>
                  <Input
                    id="purchaseCount"
                    type="number"
                    min={1}
                    max={maxPurchasable}
                    value={ticketCount}
                    onChange={(e) => setTicketCount(Math.min(maxPurchasable, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="text-center"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTicketCount(Math.min(maxPurchasable, ticketCount + 1))}
                    disabled={ticketCount >= maxPurchasable}
                  >
                    +
                  </Button>
                </div>

                {/* Quick Select */}
                {quickAmounts.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {quickAmounts.map((amount) => (
                      <Button
                        key={amount}
                        type="button"
                        variant={ticketCount === amount ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTicketCount(amount)}
                      >
                        {amount}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {/* Price Summary */}
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Price per ticket</span>
                      <span>${cycle.ticket_price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Quantity</span>
                      <span>{ticketCount}</span>
                    </div>
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between font-semibold text-lg">
                        <span>Total</span>
                        <span>${totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Info */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CreditCard className="h-4 w-4" />
                <span>Secure payment via Stripe</span>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          {maxPurchasable > 0 && (
            <Button
              onClick={handlePurchase}
              disabled={isLoading || ticketCount < 1 || ticketCount > maxPurchasable}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Pay ${totalAmount.toFixed(2)}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
