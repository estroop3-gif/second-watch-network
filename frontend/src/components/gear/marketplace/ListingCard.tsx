/**
 * ListingCard.tsx
 * Card component for displaying marketplace listings
 */
import React, { useState } from 'react';
import {
  Package,
  BadgeCheck,
  Store,
  DollarSign,
  Calendar,
  Plus,
  Check,
  Eye,
  Tag,
  MapPin,
  ShoppingCart,
  MessageSquare,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useGearCartContextOptional } from '@/context/GearCartContext';
import { useToast } from '@/hooks/use-toast';

import type { GearMarketplaceListing } from '@/types/gear';

interface ListingCardProps {
  listing: GearMarketplaceListing;
  viewMode: 'grid' | 'list';
  isSelected?: boolean;
  onView: () => void;
  onAddToQuote?: () => void;
  onRemoveFromQuote?: () => void;
  onContactSeller?: () => void;
  onMessage?: () => void;
  // Optional: If in backlot context, pass project ID for cart tagging
  backlotProjectId?: string;
  // Use cart system instead of onAddToQuote
  useCart?: boolean;
}

export function ListingCard({
  listing,
  viewMode,
  isSelected: externalIsSelected,
  onView,
  onAddToQuote,
  onRemoveFromQuote,
  onContactSeller,
  onMessage,
  backlotProjectId,
  useCart = false,
}: ListingCardProps) {
  const asset = listing.asset;
  const organization = listing.organization;
  const cartContext = useGearCartContextOptional();
  const { toast } = useToast();
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // Format price display
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Get primary image - handle multiple possible field names from API
  const primaryImage = asset?.photo_urls?.[0] || asset?.photos_current?.[0] || asset?.photos_baseline?.[0] || asset?.image_url;

  // Determine if this is a sale-only listing
  const isSaleOnly = listing.listing_type === 'sale';
  const isBothType = listing.listing_type === 'both';
  const hasSalePrice = listing.sale_price && listing.sale_price > 0;

  // Check if item is in cart (if using cart system)
  const inCart = useCart && cartContext ? cartContext.isInCart(listing.id) : false;
  const isSelected = externalIsSelected ?? inCart;

  // Handle add to cart
  const handleAddToCart = async () => {
    if (!cartContext) {
      // Fallback to legacy behavior
      onAddToQuote?.();
      return;
    }

    setIsAddingToCart(true);
    try {
      await cartContext.addToCart({
        listing_id: listing.id,
        backlot_project_id: backlotProjectId,
        quantity: 1,
      });
      toast({
        title: 'Added to Cart',
        description: `${asset?.name || 'Item'} added to your cart.`,
      });
    } catch (error) {
      toast({
        title: 'Failed to Add',
        description: error instanceof Error ? error.message : 'Failed to add item to cart',
        variant: 'destructive',
      });
    } finally {
      setIsAddingToCart(false);
    }
  };

  // Handle remove from cart
  const handleRemoveFromCart = async () => {
    if (!cartContext) {
      // Fallback to legacy behavior
      onRemoveFromQuote?.();
      return;
    }

    const cartItem = cartContext.getCartItem(listing.id);
    if (!cartItem) return;

    try {
      await cartContext.removeFromCart(cartItem.id);
      toast({
        title: 'Removed from Cart',
        description: `${asset?.name || 'Item'} removed from your cart.`,
      });
    } catch (error) {
      toast({
        title: 'Failed to Remove',
        description: error instanceof Error ? error.message : 'Failed to remove item from cart',
        variant: 'destructive',
      });
    }
  };

  // Handle contact seller for sale items
  const handleContactSeller = () => {
    if (onContactSeller) {
      onContactSeller();
    } else if (onMessage) {
      onMessage();
    } else {
      // Default behavior - could open a modal or navigate
      toast({
        title: 'Contact Seller',
        description: 'Message feature coming soon. Contact the seller directly.',
      });
    }
  };

  // Determine which action button to show
  const renderActionButton = (size: 'sm' | 'default' = 'sm', showIcon = true) => {
    // Sale-only items: Contact Seller button
    if (isSaleOnly) {
      return (
        <Button
          variant="default"
          size={size}
          onClick={(e) => {
            e.stopPropagation();
            handleContactSeller();
          }}
          className="gap-1.5"
        >
          {showIcon && <MessageSquare className="h-4 w-4" />}
          Contact Seller
        </Button>
      );
    }

    // Rental items: Add to Cart / In Cart
    if (isSelected || inCart) {
      return (
        <Button
          variant="outline"
          size={size}
          onClick={(e) => {
            e.stopPropagation();
            useCart ? handleRemoveFromCart() : onRemoveFromQuote?.();
          }}
          className="gap-1.5 border-accent-yellow text-accent-yellow"
        >
          {showIcon && <Check className="h-4 w-4" />}
          {useCart ? 'In Cart' : 'Added'}
        </Button>
      );
    }

    return (
      <Button
        variant="default"
        size={size}
        onClick={(e) => {
          e.stopPropagation();
          useCart ? handleAddToCart() : onAddToQuote?.();
        }}
        className="gap-1.5"
        disabled={isAddingToCart}
      >
        {isAddingToCart ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : showIcon ? (
          useCart ? <ShoppingCart className="h-4 w-4" /> : <Plus className="h-4 w-4" />
        ) : null}
        Add{useCart ? ' to Cart' : ''}
      </Button>
    );
  };

  if (viewMode === 'list') {
    return (
      <Card
        className={cn(
          'border-white/10 bg-white/5 transition-all',
          isSelected && 'border-accent-yellow/50 bg-accent-yellow/5'
        )}
      >
        <CardContent className="flex items-center gap-4 p-4">
          {/* Image */}
          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-white/10">
            {primaryImage ? (
              <img
                src={primaryImage}
                alt={asset?.name || 'Listing'}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package className="h-8 w-8 text-muted-gray" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-medium text-bone-white">
                {asset?.name || 'Unknown Item'}
              </h3>
              {organization?.is_verified && (
                <BadgeCheck className="h-4 w-4 flex-shrink-0 text-accent-yellow" />
              )}
            </div>
            <p className="text-sm text-muted-gray">
              {asset?.manufacturer} {asset?.model}
            </p>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-gray">
              <span className="flex items-center gap-1">
                <Store className="h-3 w-3" />
                {organization?.marketplace_name || organization?.name}
              </span>
              {isSaleOnly && organization?.marketplace_location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {organization.marketplace_location}
                </span>
              )}
              {!isSaleOnly && listing.min_rental_days > 1 && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Min {listing.min_rental_days} days
                </span>
              )}
              {isSaleOnly && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  <Tag className="h-3 w-3 mr-1" />
                  For Sale
                </Badge>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div className="text-right">
            {isSaleOnly && hasSalePrice ? (
              <>
                <div className="text-lg font-semibold text-green-400">
                  {formatPrice(listing.sale_price!)}
                </div>
                <div className="text-xs text-muted-gray">
                  {listing.sale_negotiable ? 'Negotiable' : 'Firm'}
                </div>
              </>
            ) : (
              <>
                <div className="text-lg font-semibold text-bone-white">
                  {formatPrice(listing.daily_rate)}
                  <span className="text-xs font-normal text-muted-gray">/day</span>
                </div>
                {listing.weekly_rate && (
                  <div className="text-xs text-muted-gray">
                    {formatPrice(listing.weekly_rate)}/week
                  </div>
                )}
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onView}>
              <Eye className="h-4 w-4" />
            </Button>
            {onMessage && !isSaleOnly && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onMessage();
                }}
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            )}
            {renderActionButton('sm', true)}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Grid view
  return (
    <Card
      className={cn(
        'group cursor-pointer overflow-hidden border-white/10 bg-white/5 transition-all hover:border-white/20',
        isSelected && 'border-accent-yellow/50 bg-accent-yellow/5'
      )}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-white/10">
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={asset?.name || 'Listing'}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-12 w-12 text-muted-gray" />
          </div>
        )}

        {/* Top-left badges */}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {organization?.is_verified && (
            <Badge className="gap-1 bg-accent-yellow/90 text-charcoal-black">
              <BadgeCheck className="h-3 w-3" />
              Verified
            </Badge>
          )}
          {isSaleOnly && (
            <Badge className="gap-1 bg-green-500 text-white">
              <Tag className="h-3 w-3" />
              For Sale
            </Badge>
          )}
        </div>

        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute right-2 top-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-yellow">
              <Check className="h-4 w-4 text-charcoal-black" />
            </div>
          </div>
        )}

        {/* Quick actions overlay */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="secondary" size="sm" onClick={onView}>
            View Details
          </Button>
          {!isSelected && !inCart && renderActionButton('sm', true)}
          {onMessage && !isSaleOnly && (
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onMessage();
              }}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <CardContent className="p-4" onClick={onView}>
        {/* Organization */}
        <div className="mb-2 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-gray">
            <Store className="h-3 w-3" />
            <span className="truncate">
              {organization?.marketplace_name || organization?.name}
            </span>
            {organization?.lister_type === 'rental_house' && (
              <Badge variant="outline" className="h-4 px-1 text-[10px]">
                Rental House
              </Badge>
            )}
          </div>
          {isSaleOnly && organization?.marketplace_location && (
            <div className="flex items-center gap-1 text-xs text-muted-gray">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{organization.marketplace_location}</span>
            </div>
          )}
        </div>

        {/* Name */}
        <h3 className="mb-1 truncate font-medium text-bone-white">
          {asset?.name || 'Unknown Item'}
        </h3>
        <p className="mb-3 truncate text-sm text-muted-gray">
          {asset?.manufacturer} {asset?.model}
        </p>

        {/* Pricing */}
        <div className="flex items-baseline justify-between">
          {isSaleOnly && hasSalePrice ? (
            <>
              <div>
                <span className="text-lg font-semibold text-green-400">
                  {formatPrice(listing.sale_price!)}
                </span>
              </div>
              <div className="text-xs text-muted-gray">
                {listing.sale_negotiable ? 'OBO' : 'Firm'}
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="text-lg font-semibold text-bone-white">
                  {formatPrice(listing.daily_rate)}
                </span>
                <span className="text-xs text-muted-gray">/day</span>
              </div>
              {listing.weekly_rate && (
                <div className="text-xs text-muted-gray">
                  {formatPrice(listing.weekly_rate)}/wk
                </div>
              )}
            </>
          )}
        </div>

        {/* Tags */}
        <div className="mt-3 flex flex-wrap gap-1">
          {isSaleOnly ? (
            <>
              {listing.sale_condition && (
                <Badge variant="outline" className="text-xs capitalize">
                  {listing.sale_condition.replace('_', ' ')}
                </Badge>
              )}
            </>
          ) : (
            <>
              {listing.insurance_required && (
                <Badge variant="outline" className="text-xs">
                  Insurance Required
                </Badge>
              )}
              {listing.deposit_amount && listing.deposit_amount > 0 && (
                <Badge variant="outline" className="text-xs">
                  {formatPrice(listing.deposit_amount)} Deposit
                </Badge>
              )}
              {listing.min_rental_days > 1 && (
                <Badge variant="outline" className="text-xs">
                  Min {listing.min_rental_days} days
                </Badge>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ListingCard;
