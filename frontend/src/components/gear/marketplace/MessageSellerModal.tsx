/**
 * MessageSellerModal.tsx
 * Modal for composing a message to a marketplace listing seller
 */
import React, { useState } from 'react';
import {
  MessageSquare,
  Store,
  BadgeCheck,
  Package,
  Loader2,
  Send,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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

interface MessageSellerModalProps {
  listing: GearMarketplaceListing | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function MessageSellerModal({
  listing,
  isOpen,
  onClose,
  onSuccess,
}: MessageSellerModalProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!listing) return null;

  const asset = listing.asset;
  const organization = listing.organization;
  const primaryImage = asset?.photo_urls?.[0] || asset?.image_url;

  // Format price for display
  const formatPrice = (price: number | undefined) => {
    if (!price) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const handleSend = async () => {
    if (!message.trim() || !user?.id) return;

    setIsSending(true);
    setError(null);

    try {
      // First, we need to get the seller's user ID
      // For now, we'll fetch the org admin/owner
      const orgMembers = await api.get<any[]>(
        `/api/v1/organizations/${listing.organization_id}/members?role=owner`
      ).catch(() => []);

      // Get the first owner/admin
      const sellerUserId = orgMembers[0]?.user_id || orgMembers[0]?.profile_id;

      if (!sellerUserId) {
        throw new Error('Could not find seller contact information');
      }

      // Create or get conversation with seller
      const { conversation_id } = await api.createPrivateConversation(
        user.id,
        sellerUserId
      );

      // Format message with listing reference
      const fullMessage = `Interested in: ${asset?.name || 'Listing'}\n${
        listing.listing_type === 'sale'
          ? `Listed for: ${formatPrice(listing.sale_price)}`
          : `Daily rate: ${formatPrice(listing.daily_rate)}`
      }\n\n${message}`;

      // Send the message
      await api.sendMessage(user.id, {
        conversation_id,
        content: fullMessage,
      });

      setMessage('');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Failed to send message:', err);
      setError(err.message || 'Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setMessage('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-accent-yellow" />
            Message Seller
          </DialogTitle>
          <DialogDescription>
            Send a message about this listing
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
              <p className="text-sm text-muted-gray">
                {listing.listing_type === 'sale'
                  ? formatPrice(listing.sale_price)
                  : `${formatPrice(listing.daily_rate)}/day`}
              </p>
            </div>
          </div>

          {/* Seller Info */}
          <div className="flex items-center gap-2 text-sm">
            <Store className="h-4 w-4 text-muted-gray" />
            <span className="text-muted-gray">To:</span>
            <span className="text-bone-white">
              {organization?.marketplace_name || organization?.name}
            </span>
            {organization?.is_verified && (
              <BadgeCheck className="h-4 w-4 text-accent-yellow" />
            )}
          </div>

          {/* Message Input */}
          <Textarea
            placeholder="Hi, I'm interested in this item..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="resize-none"
          />

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!message.trim() || isSending}
            className="gap-2 bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Message
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MessageSellerModal;
