/**
 * MarketplaceMapView - Leaflet map showing gear houses
 *
 * Features:
 * - Gear house markers
 * - Cluster markers for dense areas
 * - Popup cards on marker click
 * - Delivery radius visualization (optional)
 */
import React, { useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BadgeCheck, Truck, Package, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MarketplaceOrganizationEnriched, UserLocation } from '@/types/gear';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icon for gear houses
const gearHouseIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const userLocationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface MarketplaceMapViewProps {
  gearHouses: MarketplaceOrganizationEnriched[];
  userLocation: UserLocation | null;
  radiusMiles: number;
  onViewGearHouse: (gearHouse: MarketplaceOrganizationEnriched) => void;
  showDeliveryRadius?: boolean;
  className?: string;
}

// Component to recenter map when location changes
function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function MarketplaceMapView({
  gearHouses,
  userLocation,
  radiusMiles,
  onViewGearHouse,
  showDeliveryRadius = false,
  className,
}: MarketplaceMapViewProps) {
  // Default center (US center) if no location
  const center: [number, number] = userLocation
    ? [userLocation.latitude, userLocation.longitude]
    : [39.8283, -98.5795];

  // Calculate zoom based on radius
  const zoom = useMemo(() => {
    if (radiusMiles <= 25) return 10;
    if (radiusMiles <= 50) return 9;
    if (radiusMiles <= 100) return 8;
    return 7;
  }, [radiusMiles]);

  // Filter gear houses with valid coordinates
  const markersData = useMemo(() => {
    return gearHouses.filter(
      (gh) => gh.location_latitude != null && gh.location_longitude != null
    );
  }, [gearHouses]);

  return (
    <div className={cn('h-full w-full rounded-lg overflow-hidden border', className)}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Recenter when location changes */}
        <MapRecenter center={center} />

        {/* User location marker */}
        {userLocation && (
          <>
            <Marker
              position={[userLocation.latitude, userLocation.longitude]}
              icon={userLocationIcon}
            >
              <Popup>
                <div className="text-sm">
                  <strong>Your location</strong>
                  {userLocation.name && (
                    <div className="text-muted-foreground">{userLocation.name}</div>
                  )}
                </div>
              </Popup>
            </Marker>

            {/* Search radius circle */}
            <Circle
              center={[userLocation.latitude, userLocation.longitude]}
              radius={radiusMiles * 1609.34} // Convert miles to meters
              pathOptions={{
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.1,
                weight: 1,
              }}
            />
          </>
        )}

        {/* Gear house markers */}
        {markersData.map((gh) => (
          <Marker
            key={gh.id}
            position={[gh.location_latitude!, gh.location_longitude!]}
            icon={gearHouseIcon}
          >
            <Popup>
              <GearHousePopup gearHouse={gh} onView={() => onViewGearHouse(gh)} />
            </Popup>
          </Marker>
        ))}

        {/* Optional delivery radius circles */}
        {showDeliveryRadius &&
          markersData
            .filter((gh) => gh.offers_delivery && gh.delivery_radius_miles)
            .map((gh) => (
              <Circle
                key={`delivery-${gh.id}`}
                center={[gh.location_latitude!, gh.location_longitude!]}
                radius={gh.delivery_radius_miles! * 1609.34}
                pathOptions={{
                  color: '#22c55e',
                  fillColor: '#22c55e',
                  fillOpacity: 0.05,
                  weight: 1,
                  dashArray: '5, 5',
                }}
              />
            ))}
      </MapContainer>
    </div>
  );
}

// Popup content for gear house markers
function GearHousePopup({
  gearHouse,
  onView,
}: {
  gearHouse: MarketplaceOrganizationEnriched;
  onView: () => void;
}) {
  const displayName = gearHouse.marketplace_name || gearHouse.name;

  return (
    <div className="min-w-[200px]">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-semibold text-sm">{displayName}</span>
        {gearHouse.is_verified && (
          <BadgeCheck className="h-4 w-4 text-blue-500" />
        )}
      </div>

      {gearHouse.location_display && (
        <div className="text-xs text-muted-foreground mb-2">
          {gearHouse.location_display}
        </div>
      )}

      <div className="flex flex-wrap gap-1 mb-2">
        {gearHouse.distance_miles !== undefined && (
          <Badge variant="secondary" className="text-xs">
            {gearHouse.distance_miles < 1
              ? '< 1 mi'
              : `${Math.round(gearHouse.distance_miles)} mi`}
          </Badge>
        )}
        {gearHouse.can_deliver_to_user && (
          <Badge
            variant="outline"
            className="text-xs bg-green-500/10 text-green-600 border-green-500/20"
          >
            <Truck className="h-3 w-3 mr-1" />
            Delivers
          </Badge>
        )}
        <Badge variant="secondary" className="text-xs">
          <Package className="h-3 w-3 mr-1" />
          {gearHouse.listing_count || 0}
        </Badge>
      </div>

      <Button
        size="sm"
        className="w-full text-xs"
        onClick={onView}
      >
        View Inventory
        <ChevronRight className="h-3 w-3 ml-1" />
      </Button>
    </div>
  );
}
