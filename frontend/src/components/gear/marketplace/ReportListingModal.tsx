/**
 * ReportListingModal.tsx
 * Modal for reporting a marketplace listing
 */
import React, { useState } from 'react';
import {
  Flag,
  Package,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { GearMarketplaceListing } from '@/types/gear';

type ReportReason = 'spam' | 'fraud' | 'prohibited_item' | 'misleading' | 'other';

const REPORT_REASONS: { value: ReportReason; label: string; description: string }[] = [
  {
    value: 'spam',
    label: 'Spam or duplicate listing',
    description: 'This appears to be spam or is duplicated multiple times',
  },
  {
    value: 'fraud',
    label: 'Suspected fraud',
    description: 'This listing appears to be fraudulent or a scam',
  },
  {
    value: 'prohibited_item',
    label: 'Prohibited item',
    description: 'This item is not allowed on the marketplace',
  },
  {
    value: 'misleading',
    label: 'Misleading information',
    description: 'The listing contains false or misleading details',
  },
  {
    value: 'other',
    label: 'Other issue',
    description: 'Another reason not listed above',
  },
];

interface ReportListingModalProps {
  listing: GearMarketplaceListing | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ReportListingModal({
  listing,
  isOpen,
  onClose,
  onSuccess,
}: ReportListingModalProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!listing) return null;

  const asset = listing.asset;
  const primaryImage = asset?.photo_urls?.[0] || asset?.image_url;

  const handleSubmit = async () => {
    if (!reason || !user?.id) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await api.post(`/api/v1/gear/marketplace/listings/${listing.id}/report`, {
        reason,
        details: details.trim() || undefined,
        reporter_id: user.id,
      });

      setSubmitted(true);
      setTimeout(() => {
        handleClose();
        onSuccess?.();
      }, 2000);
    } catch (err: any) {
      console.error('Failed to report listing:', err);
      setError(err.message || 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason('');
    setDetails('');
    setError(null);
    setSubmitted(false);
    onClose();
  };

  if (submitted) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-4 rounded-full bg-green-500/20 p-3">
              <Flag className="h-8 w-8 text-green-400" />
            </div>
            <h3 className="text-lg font-medium text-bone-white mb-2">
              Report Submitted
            </h3>
            <p className="text-sm text-muted-gray">
              Thank you for helping keep our marketplace safe. We'll review this listing.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-primary-red" />
            Report Listing
          </DialogTitle>
          <DialogDescription>
            Help us keep the marketplace safe by reporting problematic listings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Listing Preview */}
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-white/10">
              {primaryImage ? (
                <img
                  src={primaryImage}
                  alt={asset?.name || 'Listing'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-6 w-6 text-muted-gray" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-bone-white truncate">
                {asset?.name || 'Unknown Item'}
              </p>
              <p className="text-sm text-muted-gray truncate">
                {asset?.manufacturer} {asset?.model}
              </p>
            </div>
          </div>

          {/* Reason Selection */}
          <div className="space-y-2">
            <Label className="text-bone-white">What's wrong with this listing?</Label>
            <RadioGroup
              value={reason}
              onValueChange={(value) => setReason(value as ReportReason)}
              className="space-y-2"
            >
              {REPORT_REASONS.map((option) => (
                <div
                  key={option.value}
                  className="flex items-start gap-3 rounded-lg border border-white/10 p-3 hover:bg-white/5 transition-colors"
                >
                  <RadioGroupItem value={option.value} id={option.value} />
                  <div className="flex-1">
                    <Label htmlFor={option.value} className="text-bone-white cursor-pointer">
                      {option.label}
                    </Label>
                    <p className="text-xs text-muted-gray">{option.description}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Additional Details */}
          <div className="space-y-2">
            <Label htmlFor="details" className="text-bone-white">
              Additional details (optional)
            </Label>
            <Textarea
              id="details"
              placeholder="Provide any additional context that might help us investigate..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reason || isSubmitting}
            className="gap-2 bg-primary-red text-white hover:bg-primary-red/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Flag className="h-4 w-4" />
                Submit Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ReportListingModal;
