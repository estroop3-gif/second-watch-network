/**
 * GearAssetCard - Displays full Gear House asset/kit information
 * Shows photos, details, rates, and link to Gear House
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ExternalLink,
  Package,
  Camera,
  Tag,
  Building2,
  Hash,
  Wrench,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { GearAssetDetails, GearKitDetails } from '@/hooks/backlot/useBudget';

interface GearAssetCardProps {
  type: 'asset' | 'kit';
  asset?: GearAssetDetails;
  kit?: GearKitDetails;
  organizationName?: string;
  categoryName?: string;
  deepLink?: string;
  rentalPeriod?: {
    startDate?: string;
    endDate?: string;
    days?: number;
  };
}

// Format currency
const formatCurrency = (amount: number | undefined): string => {
  if (amount === undefined || amount === null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Condition badge colors
const getConditionColor = (condition?: string): string => {
  switch (condition?.toLowerCase()) {
    case 'excellent':
    case 'new':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'good':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'fair':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'poor':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    default:
      return 'bg-muted-gray/20 text-muted-gray border-muted-gray/30';
  }
};

export const GearAssetCard: React.FC<GearAssetCardProps> = ({
  type,
  asset,
  kit,
  organizationName,
  categoryName,
  deepLink,
  rentalPeriod,
}) => {
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = asset?.photos || [];
  const hasPhotos = photos.length > 0;

  const name = type === 'asset' ? asset?.name : kit?.name;
  const description = type === 'asset' ? asset?.description : kit?.description;
  const dailyRate = type === 'asset' ? asset?.daily_rate : kit?.daily_rate;
  const weeklyRate = type === 'asset' ? asset?.weekly_rate : kit?.weekly_rate;
  const monthlyRate = asset?.monthly_rate;

  const handleViewInGearHouse = () => {
    if (deepLink) {
      window.open(deepLink, '_blank', 'noopener,noreferrer');
    }
  };

  const nextPhoto = () => {
    setPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    setPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  return (
    <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-purple-500/10 border-b border-muted-gray/20">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-purple-400" />
          <span className="font-medium text-bone-white">
            {type === 'asset' ? 'Gear House Asset' : 'Gear House Kit'}
          </span>
        </div>
        {deepLink && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-purple-400 hover:text-purple-300"
            onClick={handleViewInGearHouse}
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            View in Gear House
          </Button>
        )}
      </div>

      <div className="p-4">
        <div className="flex gap-4">
          {/* Photo Gallery */}
          {hasPhotos && (
            <div className="w-32 h-32 relative shrink-0 bg-charcoal-black/30 rounded-lg overflow-hidden">
              <img
                src={photos[photoIndex]}
                alt={name || 'Gear asset'}
                className="w-full h-full object-cover"
              />
              {photos.length > 1 && (
                <>
                  <button
                    onClick={prevPhoto}
                    className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 bg-charcoal-black/70 rounded-full flex items-center justify-center text-bone-white hover:bg-charcoal-black"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={nextPhoto}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 bg-charcoal-black/70 rounded-full flex items-center justify-center text-bone-white hover:bg-charcoal-black"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
                    {photos.slice(0, 3).map((_, idx) => (
                      <div
                        key={idx}
                        className={`w-1.5 h-1.5 rounded-full ${
                          idx === photoIndex ? 'bg-bone-white' : 'bg-muted-gray/50'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* No photo placeholder */}
          {!hasPhotos && (
            <div className="w-32 h-32 shrink-0 bg-charcoal-black/30 rounded-lg flex items-center justify-center">
              <Camera className="w-8 h-8 text-muted-gray/30" />
            </div>
          )}

          {/* Details */}
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <h4 className="font-medium text-bone-white truncate">{name || 'Unnamed Asset'}</h4>
              {description && (
                <p className="text-sm text-muted-gray line-clamp-2">{description}</p>
              )}
            </div>

            {/* Asset Details */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {organizationName && (
                <div className="flex items-center gap-1.5 text-muted-gray">
                  <Building2 className="w-3 h-3" />
                  <span className="truncate">{organizationName}</span>
                </div>
              )}
              {categoryName && (
                <div className="flex items-center gap-1.5 text-muted-gray">
                  <Tag className="w-3 h-3" />
                  <span>{categoryName}</span>
                </div>
              )}
              {asset?.serial_number && (
                <div className="flex items-center gap-1.5 text-muted-gray">
                  <Hash className="w-3 h-3" />
                  <span>S/N: {asset.serial_number}</span>
                </div>
              )}
              {asset?.internal_id && (
                <div className="flex items-center gap-1.5 text-muted-gray">
                  <Tag className="w-3 h-3" />
                  <span>ID: {asset.internal_id}</span>
                </div>
              )}
              {asset?.manufacturer && (
                <div className="flex items-center gap-1.5 text-muted-gray">
                  <Wrench className="w-3 h-3" />
                  <span>
                    {asset.manufacturer}
                    {asset.model ? ` ${asset.model}` : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Condition Badge */}
            {asset?.condition && (
              <Badge variant="outline" className={`text-xs ${getConditionColor(asset.condition)}`}>
                {asset.condition}
              </Badge>
            )}

            {/* Kit Items */}
            {type === 'kit' && kit?.items && kit.items.length > 0 && (
              <div className="text-xs text-muted-gray">
                <span className="font-medium">Kit contains:</span>
                <ul className="mt-1 space-y-0.5 pl-4">
                  {kit.items.slice(0, 3).map((item, idx) => (
                    <li key={idx}>
                      {item.quantity > 1 ? `${item.quantity}x ` : ''}
                      {item.asset_name}
                    </li>
                  ))}
                  {kit.items.length > 3 && <li>+{kit.items.length - 3} more items</li>}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Rates and Rental Period */}
        <div className="mt-4 pt-3 border-t border-muted-gray/10 flex items-center justify-between">
          {/* Rates */}
          <div className="flex gap-4 text-xs">
            {dailyRate !== undefined && dailyRate > 0 && (
              <div>
                <span className="text-muted-gray">Daily:</span>{' '}
                <span className="text-bone-white font-medium">{formatCurrency(dailyRate)}</span>
              </div>
            )}
            {weeklyRate !== undefined && weeklyRate > 0 && (
              <div>
                <span className="text-muted-gray">Weekly:</span>{' '}
                <span className="text-bone-white font-medium">{formatCurrency(weeklyRate)}</span>
              </div>
            )}
            {monthlyRate !== undefined && monthlyRate > 0 && (
              <div>
                <span className="text-muted-gray">Monthly:</span>{' '}
                <span className="text-bone-white font-medium">{formatCurrency(monthlyRate)}</span>
              </div>
            )}
          </div>

          {/* Rental Period */}
          {rentalPeriod && (rentalPeriod.startDate || rentalPeriod.days) && (
            <div className="flex items-center gap-2 text-xs text-muted-gray">
              <Calendar className="w-3 h-3" />
              {rentalPeriod.startDate && rentalPeriod.endDate ? (
                <span>
                  {new Date(rentalPeriod.startDate).toLocaleDateString()} -{' '}
                  {new Date(rentalPeriod.endDate).toLocaleDateString()}
                </span>
              ) : rentalPeriod.days ? (
                <span>{rentalPeriod.days} day rental</span>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GearAssetCard;
