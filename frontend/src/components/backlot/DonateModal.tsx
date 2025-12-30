/**
 * DonateModal - Modal for making a donation to a Backlot project
 */
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/lib/api';
import { Loader2, Heart, DollarSign, User, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DonateModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  donationMessage?: string;
}

const PRESET_AMOUNTS = [
  { value: 500, label: '$5' },
  { value: 1000, label: '$10' },
  { value: 2500, label: '$25' },
  { value: 5000, label: '$50' },
  { value: 10000, label: '$100' },
];

const DonateModal: React.FC<DonateModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectTitle,
  donationMessage,
}) => {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(2500); // Default $25
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAmountCents = (): number => {
    if (selectedAmount !== null) return selectedAmount;
    const parsed = parseFloat(customAmount);
    if (isNaN(parsed) || parsed <= 0) return 0;
    return Math.round(parsed * 100);
  };

  const handlePresetClick = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
    setError(null);
  };

  const handleCustomAmountChange = (value: string) => {
    // Only allow numbers and decimal point
    const cleaned = value.replace(/[^0-9.]/g, '');
    // Only allow one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    // Limit decimal places to 2
    if (parts[1]?.length > 2) return;

    setCustomAmount(cleaned);
    setSelectedAmount(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amountCents = getAmountCents();
    if (amountCents < 100) {
      setError('Minimum donation is $1.00');
      return;
    }
    if (amountCents > 100000000) {
      setError('Maximum donation is $1,000,000');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api.createDonationCheckout(projectId, {
        amount_cents: amountCents,
        message: message.trim() || undefined,
        is_anonymous: isAnonymous,
      });

      // Redirect to Stripe checkout
      if (response.checkout_url) {
        window.location.href = response.checkout_url;
      } else {
        setError('Failed to create checkout session');
      }
    } catch (err: any) {
      console.error('Donation error:', err);
      setError(err.message || 'Failed to process donation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const amountCents = getAmountCents();
  const displayAmount = amountCents > 0 ? `$${(amountCents / 100).toFixed(2)}` : '$0.00';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-charcoal-black border-muted-gray">
        <DialogHeader>
          <DialogTitle className="text-bone-white flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary-red" />
            Support This Project
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            Make a donation to help fund "{projectTitle}"
          </DialogDescription>
        </DialogHeader>

        {donationMessage && (
          <div className="bg-muted-gray/20 p-3 rounded-lg text-sm text-bone-white/80 italic">
            "{donationMessage}"
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Amount Selection */}
          <div className="space-y-3">
            <Label className="text-bone-white flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Select Amount
            </Label>
            <div className="grid grid-cols-5 gap-2">
              {PRESET_AMOUNTS.map((preset) => (
                <Button
                  key={preset.value}
                  type="button"
                  variant={selectedAmount === preset.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePresetClick(preset.value)}
                  className={cn(
                    'text-sm',
                    selectedAmount === preset.value
                      ? 'bg-primary-red text-bone-white hover:bg-primary-red/90'
                      : 'border-muted-gray text-bone-white hover:bg-muted-gray/30'
                  )}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
              <Input
                type="text"
                placeholder="Custom amount"
                value={customAmount}
                onChange={(e) => handleCustomAmountChange(e.target.value)}
                className="pl-7 bg-charcoal-black border-muted-gray text-bone-white placeholder:text-muted-gray/60"
              />
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label className="text-bone-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Message (Optional)
            </Label>
            <Textarea
              placeholder="Leave a message of support..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              className="bg-charcoal-black border-muted-gray text-bone-white placeholder:text-muted-gray/60 min-h-[80px]"
            />
            <p className="text-xs text-muted-gray text-right">{message.length}/500</p>
          </div>

          {/* Anonymous */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="anonymous"
              checked={isAnonymous}
              onCheckedChange={(checked) => setIsAnonymous(checked === true)}
              className="border-muted-gray data-[state=checked]:bg-primary-red data-[state=checked]:border-primary-red"
            />
            <label
              htmlFor="anonymous"
              className="text-sm text-bone-white flex items-center gap-2 cursor-pointer"
            >
              <User className="w-4 h-4 text-muted-gray" />
              Donate anonymously
            </label>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Summary & Submit */}
          <div className="border-t border-muted-gray pt-4">
            <div className="flex justify-between items-center mb-4">
              <span className="text-muted-gray">Donation Amount:</span>
              <span className="text-2xl font-bold text-bone-white">{displayAmount}</span>
            </div>
            <p className="text-xs text-muted-gray mb-4">
              A small platform fee (5%) helps keep Second Watch Network running.
              You will be redirected to Stripe for secure payment.
            </p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 border-muted-gray text-bone-white hover:bg-muted-gray/30"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || amountCents < 100}
                className="flex-1 bg-primary-red hover:bg-primary-red/90 text-bone-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Heart className="w-4 h-4 mr-2" />
                    Donate {displayAmount}
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DonateModal;
