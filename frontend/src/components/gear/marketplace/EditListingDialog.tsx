/**
 * EditListingDialog.tsx
 * Dialog for editing existing marketplace listings
 */
import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Package,
  Shield,
  Info,
  Loader2,
  Save,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import { useMyListings } from '@/hooks/gear/useGearMarketplace';
import type { GearMarketplaceListing, CreateListingInput } from '@/types/gear';

interface EditListingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  listing: GearMarketplaceListing;
  orgId: string;
}

export function EditListingDialog({
  isOpen,
  onClose,
  listing,
  orgId,
}: EditListingDialogProps) {
  const { updateListing } = useMyListings(orgId);

  // Form state
  const [dailyRate, setDailyRate] = useState<string>('');
  const [weeklyRate, setWeeklyRate] = useState<string>('');
  const [monthlyRate, setMonthlyRate] = useState<string>('');
  const [minRentalDays, setMinRentalDays] = useState<string>('1');
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [depositPercent, setDepositPercent] = useState<string>('');
  const [depositType, setDepositType] = useState<'amount' | 'percent'>('percent');
  const [insuranceRequired, setInsuranceRequired] = useState(false);
  const [insuranceDailyRate, setInsuranceDailyRate] = useState<string>('');
  const [rentalNotes, setRentalNotes] = useState('');
  const [pickupInstructions, setPickupInstructions] = useState('');

  // Initialize form from listing
  useEffect(() => {
    if (listing) {
      setDailyRate(listing.daily_rate?.toString() || '');
      setWeeklyRate(listing.weekly_rate?.toString() || '');
      setMonthlyRate(listing.monthly_rate?.toString() || '');
      setMinRentalDays(listing.min_rental_days?.toString() || '1');

      if (listing.deposit_percent) {
        setDepositType('percent');
        setDepositPercent(listing.deposit_percent.toString());
        setDepositAmount('');
      } else if (listing.deposit_amount) {
        setDepositType('amount');
        setDepositAmount(listing.deposit_amount.toString());
        setDepositPercent('');
      }

      setInsuranceRequired(listing.insurance_required || false);
      setInsuranceDailyRate(listing.insurance_daily_rate?.toString() || '');
      setRentalNotes(listing.rental_notes || '');
      setPickupInstructions(listing.pickup_instructions || '');
    }
  }, [listing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const input: Partial<CreateListingInput> = {
      daily_rate: parseFloat(dailyRate),
      weekly_rate: weeklyRate ? parseFloat(weeklyRate) : undefined,
      monthly_rate: monthlyRate ? parseFloat(monthlyRate) : undefined,
      min_rental_days: parseInt(minRentalDays) || 1,
      deposit_amount: depositType === 'amount' && depositAmount ? parseFloat(depositAmount) : undefined,
      deposit_percent: depositType === 'percent' && depositPercent ? parseFloat(depositPercent) : undefined,
      insurance_required: insuranceRequired,
      insurance_daily_rate: insuranceRequired && insuranceDailyRate ? parseFloat(insuranceDailyRate) : undefined,
      rental_notes: rentalNotes || undefined,
      pickup_instructions: pickupInstructions || undefined,
    };

    try {
      await updateListing.mutateAsync({
        listingId: listing.id,
        input,
      });
      onClose();
    } catch (error) {
      console.error('Failed to update listing:', error);
    }
  };

  const asset = listing.asset;
  const isSubmitting = updateListing.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/10">
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-accent-yellow" />
            Edit Listing
          </DialogTitle>
          <DialogDescription>
            Update pricing and rental terms
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Asset Preview */}
            {asset && (
              <div className="flex items-center gap-4 rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="h-16 w-16 flex-shrink-0 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden">
                  {asset.photo_urls?.[0] || asset.image_url ? (
                    <img
                      src={asset.photo_urls?.[0] || asset.image_url}
                      alt={asset.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Package className="h-8 w-8 text-muted-gray" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-bone-white truncate">{asset.name}</h4>
                  <p className="text-sm text-muted-gray">
                    {asset.manufacturer} {asset.model && `• ${asset.model}`}
                  </p>
                </div>
              </div>
            )}

            <Separator className="bg-white/10" />

            {/* Pricing Section */}
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 font-medium text-bone-white">
                <DollarSign className="h-4 w-4 text-accent-yellow" />
                Rental Rates
              </h4>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dailyRate">Daily Rate *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                    <Input
                      id="dailyRate"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={dailyRate}
                      onChange={(e) => setDailyRate(e.target.value)}
                      className="pl-7"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weeklyRate">Weekly Rate</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                    <Input
                      id="weeklyRate"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={weeklyRate}
                      onChange={(e) => setWeeklyRate(e.target.value)}
                      className="pl-7"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthlyRate">Monthly Rate</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                    <Input
                      id="monthlyRate"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={monthlyRate}
                      onChange={(e) => setMonthlyRate(e.target.value)}
                      className="pl-7"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="minRentalDays">Minimum Rental Days</Label>
                <Input
                  id="minRentalDays"
                  type="number"
                  min="1"
                  max="30"
                  value={minRentalDays}
                  onChange={(e) => setMinRentalDays(e.target.value)}
                  className="w-24"
                />
              </div>
            </div>

            <Separator className="bg-white/10" />

            {/* Deposit Section */}
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 font-medium text-bone-white">
                <Shield className="h-4 w-4 text-blue-400" />
                Deposit
              </h4>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDepositType('percent')}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                      depositType === 'percent'
                        ? 'border-accent-yellow bg-accent-yellow/10 text-accent-yellow'
                        : 'border-white/10 text-muted-gray hover:border-white/20'
                    )}
                  >
                    Percentage
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepositType('amount')}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                      depositType === 'amount'
                        ? 'border-accent-yellow bg-accent-yellow/10 text-accent-yellow'
                        : 'border-white/10 text-muted-gray hover:border-white/20'
                    )}
                  >
                    Fixed Amount
                  </button>
                </div>

                {depositType === 'percent' ? (
                  <div className="relative w-32">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      placeholder="0"
                      value={depositPercent}
                      onChange={(e) => setDepositPercent(e.target.value)}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-gray">%</span>
                  </div>
                ) : (
                  <div className="relative w-32">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="pl-7"
                    />
                  </div>
                )}
              </div>
            </div>

            <Separator className="bg-white/10" />

            {/* Insurance Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-bone-white">Require Insurance</Label>
                  <p className="text-xs text-muted-gray">
                    Renters must have insurance or purchase it
                  </p>
                </div>
                <Switch
                  checked={insuranceRequired}
                  onCheckedChange={setInsuranceRequired}
                />
              </div>

              {insuranceRequired && (
                <div className="space-y-2">
                  <Label htmlFor="insuranceDailyRate">Insurance Daily Rate</Label>
                  <div className="relative w-32">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                    <Input
                      id="insuranceDailyRate"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={insuranceDailyRate}
                      onChange={(e) => setInsuranceDailyRate(e.target.value)}
                      className="pl-7"
                    />
                  </div>
                </div>
              )}
            </div>

            <Separator className="bg-white/10" />

            {/* Notes Section */}
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 font-medium text-bone-white">
                <Info className="h-4 w-4 text-muted-gray" />
                Additional Information
              </h4>

              <div className="space-y-2">
                <Label htmlFor="rentalNotes">Rental Notes</Label>
                <Textarea
                  id="rentalNotes"
                  placeholder="e.g., Comes with case and accessories..."
                  value={rentalNotes}
                  onChange={(e) => setRentalNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pickupInstructions">Pickup Instructions</Label>
                <Textarea
                  id="pickupInstructions"
                  placeholder="e.g., Available for pickup M-F 9am-5pm..."
                  value={pickupInstructions}
                  onChange={(e) => setPickupInstructions(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          </form>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-white/10">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!dailyRate || isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditListingDialog;
