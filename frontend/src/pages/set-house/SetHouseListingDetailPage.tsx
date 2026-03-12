/**
 * SetHouseListingDetailPage - Full detail view for a single Set Marketplace space listing
 */
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  MapPin,
  BadgeCheck,
  Clock,
  Calendar,
  Shield,
  DollarSign,
  Users,
  Ruler,
  ChevronLeft,
  ChevronRight,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSetHouseMarketplaceListing } from '@/hooks/set-house/useSetHouseMarketplace';

// The detail endpoint returns flat joined fields beyond the base type
interface DetailListing {
  id: string;
  space_id: string;
  space_name?: string;
  space_type?: string;
  description?: string;
  square_footage?: number;
  ceiling_height_feet?: number;
  dimensions?: Record<string, unknown>;
  max_occupancy?: number;
  features?: string[];
  amenities?: string[];
  floor_plan_url?: string;
  virtual_tour_url?: string;
  // Pricing
  daily_rate: number;
  hourly_rate?: number;
  half_day_rate?: number;
  weekly_rate?: number;
  monthly_rate?: number;
  // Booking terms
  deposit_amount?: number;
  deposit_percent?: number;
  insurance_required: boolean;
  min_booking_hours: number;
  max_booking_days?: number;
  advance_booking_days: number;
  booking_notes?: string;
  access_instructions?: string;
  // Cancellation
  cancellation_policy?: string;
  cancellation_notice_hours?: number;
  cancellation_fee_percent?: number;
  // Org / location
  organization_name?: string;
  marketplace_name?: string;
  marketplace_description?: string;
  is_verified?: boolean;
  city?: string;
  state?: string;
  address_line1?: string;
  postal_code?: string;
  // Images
  images?: Array<{ id: string; image_url: string; is_primary: boolean; sort_order: number }>;
  space_photos?: string[];
  // Nested fallbacks
  space?: {
    name?: string;
    space_type?: string;
    description?: string;
    square_footage?: number;
    ceiling_height_feet?: number;
    max_occupancy?: number;
    features?: string[];
    amenities?: string[];
    photos?: string[];
  };
  organization?: {
    name?: string;
    marketplace_name?: string;
    is_verified?: boolean;
    city?: string;
    state?: string;
  };
}

function formatRate(rate: number | undefined): string {
  if (!rate) return '';
  return `$${rate.toLocaleString()}`;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

const LoadingSkeleton: React.FC = () => (
  <div className="min-h-screen bg-charcoal-black p-6 space-y-6">
    <div className="h-8 w-32 rounded bg-white/10 animate-pulse" />
    <div className="aspect-video w-full max-w-4xl rounded-xl bg-white/10 animate-pulse" />
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 max-w-6xl">
      <div className="space-y-4">
        <div className="h-8 w-2/3 rounded bg-white/10 animate-pulse" />
        <div className="h-4 w-1/2 rounded bg-white/10 animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-3 w-full rounded bg-white/10 animate-pulse" />
          ))}
        </div>
      </div>
      <div className="h-64 rounded-xl bg-white/10 animate-pulse" />
    </div>
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────

const SetHouseListingDetailPage: React.FC = () => {
  const { listingId } = useParams<{ listingId: string }>();
  const navigate = useNavigate();
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const { data, isLoading, isPending, isError, error } = useSetHouseMarketplaceListing(listingId ?? null);
  const listing = data as DetailListing | undefined;

  // In React Query v5, isPending is true even when disabled (no token yet).
  // isLoading is only true when actively fetching with no cached data.
  if (isPending) return <LoadingSkeleton />;

  if (isError || !listing) {
    const errMsg = (error as Error)?.message;
    return (
      <div className="min-h-screen bg-charcoal-black flex flex-col items-center justify-center gap-4">
        <Building2 className="h-16 w-16 text-muted-gray" />
        <h2 className="text-xl font-semibold text-bone-white">Listing not found</h2>
        <p className="text-sm text-muted-gray">This space may no longer be available.</p>
        {errMsg && <p className="text-xs text-primary-red font-mono">{errMsg}</p>}
        <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  // Resolve display values with flat → nested fallbacks
  const spaceName = listing.space_name || listing.space?.name || 'Unnamed Space';
  const spaceType = listing.space_type || listing.space?.space_type;
  const description = listing.description || listing.space?.description;
  const orgName = listing.marketplace_name || listing.organization_name || listing.organization?.marketplace_name || listing.organization?.name;
  const isVerified = listing.is_verified ?? listing.organization?.is_verified ?? false;
  const city = listing.city || listing.organization?.city;
  const state = listing.state || listing.organization?.state;
  const squareFootage = listing.square_footage ?? listing.space?.square_footage;
  const ceilingHeight = listing.ceiling_height_feet ?? listing.space?.ceiling_height_feet;
  const maxOccupancy = listing.max_occupancy ?? listing.space?.max_occupancy;
  const features: string[] = listing.features ?? listing.space?.features ?? [];
  const amenities: string[] = listing.amenities ?? listing.space?.amenities ?? [];

  // Build image list: formal images first, then JSONB fallback
  const imageUrls: string[] = (() => {
    if (listing.images && listing.images.length > 0) {
      return [...listing.images]
        .sort((a, b) => (a.is_primary ? -1 : b.is_primary ? 1 : a.sort_order - b.sort_order))
        .map((img) => img.image_url);
    }
    if (listing.space_photos && listing.space_photos.length > 0) {
      return listing.space_photos;
    }
    if (listing.space?.photos && listing.space.photos.length > 0) {
      return listing.space.photos;
    }
    return [];
  })();

  const hasImages = imageUrls.length > 0;
  const clampedIndex = Math.min(activeImageIndex, Math.max(0, imageUrls.length - 1));

  const prevImage = () => setActiveImageIndex((i) => Math.max(0, i - 1));
  const nextImage = () => setActiveImageIndex((i) => Math.min(imageUrls.length - 1, i + 1));

  // Contact email placeholder — navigate to compose or mailto
  const handleContactToBook = () => {
    window.location.href = `mailto:?subject=Booking inquiry: ${encodeURIComponent(spaceName)}`;
  };

  return (
    <div className="min-h-screen bg-charcoal-black">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* Back button */}
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2 text-muted-gray hover:text-bone-white">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {/* Image Gallery */}
        <div className="space-y-2">
          {/* Primary image */}
          <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-white/5">
            {hasImages ? (
              <img
                src={imageUrls[clampedIndex]}
                alt={`${spaceName} — photo ${clampedIndex + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Building2 className="h-20 w-20 text-muted-gray" />
              </div>
            )}

            {/* Prev / Next arrows */}
            {imageUrls.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  disabled={clampedIndex === 0}
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 disabled:opacity-30 transition-opacity"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={nextImage}
                  disabled={clampedIndex === imageUrls.length - 1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 disabled:opacity-30 transition-opacity"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
                  {clampedIndex + 1} / {imageUrls.length}
                </div>
              </>
            )}
          </div>

          {/* Thumbnails */}
          {imageUrls.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {imageUrls.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImageIndex(i)}
                  className={`flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                    i === clampedIndex ? 'border-accent-yellow' : 'border-transparent hover:border-white/30'
                  }`}
                >
                  <img src={url} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Two-column content */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

          {/* Left — details */}
          <div className="space-y-6">

            {/* Title & badges */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {spaceType && (
                  <Badge variant="outline" className="capitalize">
                    {spaceType.replace(/_/g, ' ')}
                  </Badge>
                )}
                {isVerified && (
                  <Badge className="gap-1 bg-accent-yellow/20 text-accent-yellow border-accent-yellow/40">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Verified
                  </Badge>
                )}
              </div>
              <h1 className="text-3xl font-bold text-bone-white">{spaceName}</h1>
              <div className="flex items-center gap-2 mt-1 text-muted-gray">
                {orgName && <span className="text-sm">{orgName}</span>}
                {city && state && (
                  <div className="flex items-center gap-1 text-sm">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{city}, {state}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            {description && (
              <div>
                <h2 className="text-lg font-semibold text-bone-white mb-2">About This Space</h2>
                <p className="text-muted-gray leading-relaxed">{description}</p>
              </div>
            )}

            {/* Features & Amenities */}
            {(features.length > 0 || amenities.length > 0) && (
              <div>
                <h2 className="text-lg font-semibold text-bone-white mb-3">Features & Amenities</h2>
                <div className="flex flex-wrap gap-2">
                  {features.map((f) => (
                    <span key={f} className="px-3 py-1 rounded-full bg-white/10 text-sm text-bone-white capitalize">
                      {f.replace(/_/g, ' ')}
                    </span>
                  ))}
                  {amenities.map((a) => (
                    <span key={a} className="px-3 py-1 rounded-full bg-accent-yellow/10 text-sm text-accent-yellow capitalize">
                      {a.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Space specs */}
            {(squareFootage || ceilingHeight || maxOccupancy || listing.dimensions) && (
              <div>
                <h2 className="text-lg font-semibold text-bone-white mb-3">Space Specs</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {squareFootage && (
                    <div className="flex items-center gap-2 text-sm text-muted-gray">
                      <Ruler className="h-4 w-4 flex-shrink-0" />
                      <span>{squareFootage.toLocaleString()} sq ft</span>
                    </div>
                  )}
                  {ceilingHeight && (
                    <div className="flex items-center gap-2 text-sm text-muted-gray">
                      <Building2 className="h-4 w-4 flex-shrink-0" />
                      <span>{ceilingHeight}ft ceiling</span>
                    </div>
                  )}
                  {maxOccupancy && (
                    <div className="flex items-center gap-2 text-sm text-muted-gray">
                      <Users className="h-4 w-4 flex-shrink-0" />
                      <span>Max {maxOccupancy} people</span>
                    </div>
                  )}
                  {listing.dimensions && Object.entries(listing.dimensions).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2 text-sm text-muted-gray">
                      <Ruler className="h-4 w-4 flex-shrink-0" />
                      <span className="capitalize">{key.replace(/_/g, ' ')}: {String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Booking Terms */}
            <div>
              <h2 className="text-lg font-semibold text-bone-white mb-3">Booking Terms</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 flex-shrink-0 mt-0.5 text-muted-gray" />
                  <div>
                    <p className="text-muted-gray">Min. booking</p>
                    <p className="text-bone-white">{listing.min_booking_hours}h</p>
                  </div>
                </div>
                {listing.max_booking_days && (
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 flex-shrink-0 mt-0.5 text-muted-gray" />
                    <div>
                      <p className="text-muted-gray">Max. booking</p>
                      <p className="text-bone-white">{listing.max_booking_days} days</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 flex-shrink-0 mt-0.5 text-muted-gray" />
                  <div>
                    <p className="text-muted-gray">Advance booking</p>
                    <p className="text-bone-white">{listing.advance_booking_days} days</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Shield className="h-4 w-4 flex-shrink-0 mt-0.5 text-muted-gray" />
                  <div>
                    <p className="text-muted-gray">Insurance</p>
                    <p className="text-bone-white">{listing.insurance_required ? 'Required' : 'Not required'}</p>
                  </div>
                </div>
                {(listing.deposit_amount || listing.deposit_percent) && (
                  <div className="flex items-start gap-2">
                    <DollarSign className="h-4 w-4 flex-shrink-0 mt-0.5 text-muted-gray" />
                    <div>
                      <p className="text-muted-gray">Deposit</p>
                      <p className="text-bone-white">
                        {listing.deposit_amount
                          ? `$${listing.deposit_amount.toLocaleString()}`
                          : `${listing.deposit_percent}%`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {(listing.booking_notes || listing.access_instructions) && (
              <div className="space-y-4">
                {listing.booking_notes && (
                  <div>
                    <h2 className="text-lg font-semibold text-bone-white mb-2">Booking Notes</h2>
                    <p className="text-muted-gray leading-relaxed text-sm">{listing.booking_notes}</p>
                  </div>
                )}
                {listing.access_instructions && (
                  <div>
                    <h2 className="text-lg font-semibold text-bone-white mb-2">Access Instructions</h2>
                    <p className="text-muted-gray leading-relaxed text-sm">{listing.access_instructions}</p>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Right — pricing card (sticky) */}
          <div className="lg:sticky lg:top-6 h-fit">
            <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
              <h3 className="text-lg font-semibold text-bone-white">Pricing</h3>

              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-bone-white">{formatRate(listing.daily_rate)}</span>
                  <span className="text-muted-gray">/ day</span>
                </div>

                {listing.hourly_rate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-gray">Hourly</span>
                    <span className="text-bone-white font-medium">{formatRate(listing.hourly_rate)}/hr</span>
                  </div>
                )}
                {listing.half_day_rate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-gray">Half day</span>
                    <span className="text-bone-white font-medium">{formatRate(listing.half_day_rate)}</span>
                  </div>
                )}
                {listing.weekly_rate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-gray">Weekly</span>
                    <span className="text-bone-white font-medium">{formatRate(listing.weekly_rate)}/wk</span>
                  </div>
                )}
                {listing.monthly_rate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-gray">Monthly</span>
                    <span className="text-bone-white font-medium">{formatRate(listing.monthly_rate)}/mo</span>
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 pt-4">
                <Button className="w-full gap-2 bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90" onClick={handleContactToBook}>
                  <Mail className="h-4 w-4" />
                  Contact to Book
                </Button>
              </div>

              {listing.insurance_required && (
                <p className="text-xs text-muted-gray flex items-start gap-1.5">
                  <Shield className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  Insurance certificate required at time of booking.
                </p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SetHouseListingDetailPage;
