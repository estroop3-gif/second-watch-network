/**
 * GearListingDetailPage - Full detail view for a single gear-for-sale listing
 */
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  BadgeCheck,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useMarketplaceListing, useMakeOffer } from '@/hooks/gear/useGearMarketplace';
import type { SaleCondition } from '@/types/gear';

const CONDITION_LABELS: Record<SaleCondition, string> = {
  new: 'New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  parts: 'For Parts',
};

const CONDITION_COLORS: Record<SaleCondition, string> = {
  new: 'bg-green-500/20 text-green-400 border-green-500/30',
  like_new: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  good: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  fair: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  parts: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const GearListingDetailPage: React.FC = () => {
  const { listingId } = useParams<{ listingId: string }>();
  const navigate = useNavigate();

  const { listing, isLoading } = useMarketplaceListing(listingId || null);
  const makeOffer = useMakeOffer();

  const [photoIndex, setPhotoIndex] = useState(0);
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerMessage, setOfferMessage] = useState('');

  const photos: string[] = listing?.asset?.photos_current || listing?.asset?.photos_baseline || [];

  const handlePrevPhoto = () =>
    setPhotoIndex((i) => (i === 0 ? photos.length - 1 : i - 1));
  const handleNextPhoto = () =>
    setPhotoIndex((i) => (i === photos.length - 1 ? 0 : i + 1));

  const handleMakeOffer = async () => {
    if (!listing || !offerPrice) return;
    try {
      await makeOffer.mutateAsync({
        listing_id: listing.id,
        offer_price: parseFloat(offerPrice),
        message: offerMessage || undefined,
        delivery_method: 'local_pickup',
      });
      toast.success('Offer submitted!');
      setShowOfferDialog(false);
      setOfferPrice('');
      setOfferMessage('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit offer');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-charcoal-black">
        <Loader2 className="h-8 w-8 animate-spin text-muted-gray" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-charcoal-black">
        <Tag className="h-16 w-16 text-muted-gray mb-4" />
        <h2 className="text-xl font-heading text-bone-white mb-2">Listing not found</h2>
        <p className="text-muted-gray mb-6">This listing may have been sold or removed.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  const asset = listing.asset || {};
  const org = listing.organization || {};
  const condition = listing.sale_condition as SaleCondition | undefined;

  return (
    <div className="min-h-screen bg-charcoal-black">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-gray hover:text-bone-white transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column: photos + details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Photo Gallery */}
            <div className="relative rounded-xl overflow-hidden bg-white/5 aspect-video">
              {photos.length > 0 ? (
                <>
                  <img
                    src={photos[photoIndex]}
                    alt={asset.name || 'Gear'}
                    className="w-full h-full object-contain"
                  />
                  {photos.length > 1 && (
                    <>
                      <button
                        onClick={handlePrevPhoto}
                        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        onClick={handleNextPhoto}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {photos.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setPhotoIndex(i)}
                            className={`h-1.5 w-1.5 rounded-full transition-colors ${
                              i === photoIndex ? 'bg-white' : 'bg-white/40'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Package className="h-20 w-20 text-muted-gray" />
                </div>
              )}
            </div>

            {/* Thumbnail strip */}
            {photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {photos.map((photo, i) => (
                  <button
                    key={i}
                    onClick={() => setPhotoIndex(i)}
                    className={`flex-shrink-0 h-16 w-16 rounded-lg overflow-hidden border-2 transition-colors ${
                      i === photoIndex ? 'border-accent-yellow' : 'border-white/10'
                    }`}
                  >
                    <img src={photo} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Condition + Description */}
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {condition && (
                  <Badge
                    variant="outline"
                    className={CONDITION_COLORS[condition]}
                  >
                    {CONDITION_LABELS[condition]}
                  </Badge>
                )}
                {listing.sale_negotiable && (
                  <Badge variant="outline" className="bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30">
                    Negotiable / OBO
                  </Badge>
                )}
              </div>

              {asset.description && (
                <div>
                  <h3 className="text-sm font-medium text-bone-white mb-2">Description</h3>
                  <p className="text-sm text-muted-gray leading-relaxed">{asset.description}</p>
                </div>
              )}

              {listing.sale_includes && (
                <div>
                  <h3 className="text-sm font-medium text-bone-white mb-2">Includes</h3>
                  <p className="text-sm text-muted-gray">{listing.sale_includes}</p>
                </div>
              )}
            </div>

            {/* Specs */}
            <div>
              <h3 className="text-sm font-medium text-bone-white mb-3">Specifications</h3>
              <dl className="grid grid-cols-2 gap-3">
                {asset.category_name && (
                  <>
                    <dt className="text-xs text-muted-gray">Category</dt>
                    <dd className="text-xs text-bone-white">{asset.category_name}</dd>
                  </>
                )}
                {(asset.make || asset.manufacturer) && (
                  <>
                    <dt className="text-xs text-muted-gray">Make</dt>
                    <dd className="text-xs text-bone-white">{asset.make || asset.manufacturer}</dd>
                  </>
                )}
                {asset.model && (
                  <>
                    <dt className="text-xs text-muted-gray">Model</dt>
                    <dd className="text-xs text-bone-white">{asset.model}</dd>
                  </>
                )}
                {asset.serial_number && (
                  <>
                    <dt className="text-xs text-muted-gray">Serial #</dt>
                    <dd className="text-xs text-bone-white">{asset.serial_number}</dd>
                  </>
                )}
                {asset.year_manufactured && (
                  <>
                    <dt className="text-xs text-muted-gray">Year</dt>
                    <dd className="text-xs text-bone-white">{asset.year_manufactured}</dd>
                  </>
                )}
                {asset.weight_lbs != null && (
                  <>
                    <dt className="text-xs text-muted-gray">Weight</dt>
                    <dd className="text-xs text-bone-white">{asset.weight_lbs} lbs</dd>
                  </>
                )}
              </dl>
            </div>
          </div>

          {/* Right sticky card */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
              {/* Title */}
              <div>
                <h1 className="text-xl font-heading font-bold text-bone-white leading-tight">
                  {asset.name || 'Gear Listing'}
                </h1>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-1">
                <DollarSign className="h-5 w-5 text-accent-yellow" />
                <span className="text-3xl font-bold text-accent-yellow">
                  {listing.sale_price?.toLocaleString()}
                </span>
              </div>

              {/* Seller info */}
              <div className="border-t border-white/10 pt-4">
                <p className="text-xs text-muted-gray mb-1">Sold by</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-bone-white">
                    {org.name || 'Unknown Seller'}
                  </span>
                  {org.is_verified && (
                    <BadgeCheck className="h-4 w-4 text-accent-yellow flex-shrink-0" />
                  )}
                </div>
                {org.lister_type && (
                  <p className="text-xs text-muted-gray mt-1 capitalize">
                    {org.lister_type.replace('_', ' ')}
                  </p>
                )}
              </div>

              {/* CTA */}
              <Button
                className="w-full bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90 font-medium"
                onClick={() => setShowOfferDialog(true)}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Make an Offer
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Make Offer Dialog */}
      <Dialog open={showOfferDialog} onOpenChange={setShowOfferDialog}>
        <DialogContent className="max-w-md bg-charcoal-black border-white/10">
          <DialogHeader>
            <DialogTitle className="text-bone-white">Make an Offer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <p className="text-xs text-muted-gray mb-1">
                Asking price: ${listing?.sale_price?.toLocaleString()}
              </p>
              <label className="text-sm text-bone-white block mb-1.5">Your Offer ($)</label>
              <Input
                type="number"
                placeholder="Enter your offer"
                value={offerPrice}
                onChange={(e) => setOfferPrice(e.target.value)}
                className="bg-white/5 border-white/10 text-bone-white"
              />
            </div>
            <div>
              <label className="text-sm text-bone-white block mb-1.5">
                Message <span className="text-muted-gray">(optional)</span>
              </label>
              <Input
                placeholder="Add a message to the seller..."
                value={offerMessage}
                onChange={(e) => setOfferMessage(e.target.value)}
                className="bg-white/5 border-white/10 text-bone-white"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowOfferDialog(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
                onClick={handleMakeOffer}
                disabled={!offerPrice || makeOffer.isPending}
              >
                {makeOffer.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Submit Offer'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GearListingDetailPage;
