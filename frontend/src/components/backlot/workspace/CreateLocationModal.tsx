/**
 * CreateLocationModal - Standalone modal for creating/editing locations
 *
 * Used by both LocationsView and CallSheetCreateEditModal
 * Uses AWS Location Service for address autocomplete
 */
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { US_STATES, PRODUCTION_REGIONS } from '@/components/ui/location-constants';
import { useAWSAddressAutocomplete, AWSPlaceResult } from '@/hooks/useAWSAddressAutocomplete';
import { useGeolocation } from '@/hooks/useGeolocation';
import { Globe, Link2, EyeOff, Loader2, MapPin, Navigation, ChevronDown } from 'lucide-react';
import { BacklotLocation, BacklotLocationInput } from '@/types/backlot';
import { cn } from '@/lib/utils';

export interface CreateLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BacklotLocationInput) => Promise<BacklotLocation | void>;
  editingLocation?: BacklotLocation | null;
  /** Called after successful creation with the new location */
  onLocationCreated?: (location: BacklotLocation) => void;
}

export const CreateLocationModal: React.FC<CreateLocationModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingLocation,
  onLocationCreated,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // AWS Address Autocomplete
  const {
    data: autocompleteData,
    isLoading: isAutocompleteLoading,
  } = useAWSAddressAutocomplete(addressInput, {
    enabled: addressInput.length >= 3 && showAddressDropdown,
  });

  // Geolocation for "Use My Location"
  const {
    isSupported: isGeoSupported,
    loading: isGeoLoading,
    error: geoError,
    getCurrentPosition,
  } = useGeolocation();

  const addressResults = autocompleteData?.results || [];

  const [formData, setFormData] = useState<BacklotLocationInput & { latitude?: number; longitude?: number }>({
    name: '',
    description: '',
    scene_description: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    latitude: undefined,
    longitude: undefined,
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    parking_notes: '',
    power_available: true,
    restrooms_available: true,
    permit_required: false,
    permit_obtained: false,
    location_fee: undefined,
    is_public: true,
    visibility: 'public' as 'public' | 'unlisted' | 'private',
    region_tag: '',
    location_type: '',
    amenities: [],
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        addressInputRef.current &&
        !addressInputRef.current.contains(event.target as Node)
      ) {
        setShowAddressDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle selecting an address from autocomplete
  const handleSelectAddress = (result: AWSPlaceResult) => {
    setAddressInput(result.label);
    setFormData({
      ...formData,
      address: result.street || result.label,
      city: result.city || '',
      state: result.state || '',
      zip: result.postal_code || '',
      latitude: result.lat,
      longitude: result.lon,
    });
    setShowAddressDropdown(false);
    setSelectedIndex(-1);
  };

  // Handle "Use My Location" - captures GPS and fills address
  const handleUseMyLocation = async () => {
    try {
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;

      // Set coordinates
      setFormData({
        ...formData,
        latitude,
        longitude,
      });

      // Try to get address from coordinates via AWS
      try {
        const { api } = await import('@/lib/api');
        const response = await api.get<{ results: AWSPlaceResult[] }>(
          `/api/v1/geocoding/aws/autocomplete?q=${latitude},${longitude}&limit=1`
        );
        if (response.results && response.results.length > 0) {
          const result = response.results[0];
          setAddressInput(result.label);
          setFormData((prev) => ({
            ...prev,
            address: result.street || result.label,
            city: result.city || '',
            state: result.state || '',
            zip: result.postal_code || '',
            latitude,
            longitude,
          }));
        }
      } catch {
        // Reverse geocoding failed - just keep coordinates
        setAddressInput(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      }
    } catch (err) {
      console.error('Failed to get location:', err);
    }
  };

  // Handle keyboard navigation in dropdown
  const handleAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showAddressDropdown || addressResults.length === 0) {
      if (e.key === 'ArrowDown' && addressInput.length >= 3) {
        setShowAddressDropdown(true);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < addressResults.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < addressResults.length) {
          handleSelectAddress(addressResults[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowAddressDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Reset form when modal opens/closes or editingLocation changes
  useEffect(() => {
    if (editingLocation) {
      setAddressInput(editingLocation.address || '');
      setFormData({
        name: editingLocation.name,
        description: editingLocation.description || '',
        scene_description: editingLocation.scene_description || '',
        address: editingLocation.address || '',
        city: editingLocation.city || '',
        state: editingLocation.state || '',
        zip: editingLocation.zip || '',
        latitude: editingLocation.latitude || undefined,
        longitude: editingLocation.longitude || undefined,
        contact_name: editingLocation.contact_name || '',
        contact_phone: editingLocation.contact_phone || '',
        contact_email: editingLocation.contact_email || '',
        parking_notes: editingLocation.parking_notes || '',
        power_available: editingLocation.power_available,
        restrooms_available: editingLocation.restrooms_available,
        permit_required: editingLocation.permit_required,
        permit_obtained: editingLocation.permit_obtained,
        location_fee: editingLocation.location_fee || undefined,
        is_public: editingLocation.is_public,
        visibility: editingLocation.visibility || (editingLocation.is_public ? 'public' : 'private'),
        region_tag: editingLocation.region_tag || '',
        location_type: editingLocation.location_type || '',
        amenities: editingLocation.amenities || [],
      });
    } else {
      setAddressInput('');
      setFormData({
        name: '',
        description: '',
        scene_description: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        latitude: undefined,
        longitude: undefined,
        contact_name: '',
        contact_phone: '',
        contact_email: '',
        parking_notes: '',
        power_available: true,
        restrooms_available: true,
        permit_required: false,
        permit_obtained: false,
        location_fee: undefined,
        is_public: true,
        visibility: 'public' as 'public' | 'unlisted' | 'private',
        region_tag: '',
        location_type: '',
        amenities: [],
      });
    }
  }, [editingLocation, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await onSubmit(formData);
      if (result && onLocationCreated) {
        onLocationCreated(result);
      }
      onClose();
    } catch (err) {
      console.error('Failed to save location:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>{editingLocation ? 'Edit Location' : 'Create New Location'}</DialogTitle>
          <DialogDescription>
            {editingLocation
              ? 'Update the location details.'
              : 'Add a new location to the global library and attach it to this project.'}
          </DialogDescription>
          {/* Scroll indicator */}
          <div className="flex items-center justify-center mt-2 text-bone-white/70 text-xs">
            <span>Scroll down for all options</span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <form onSubmit={handleSubmit} className="space-y-4 mt-4 pb-8">
          {/* Visibility Selector */}
          <div className="space-y-2">
            <Label>Visibility</Label>
            <Select
              value={formData.visibility}
              onValueChange={(value: 'public' | 'unlisted' | 'private') =>
                setFormData({ ...formData, visibility: value, is_public: value === 'public' })
              }
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-400" />
                    <div>
                      <span className="font-medium">Public</span>
                      <span className="text-xs text-muted-gray ml-2">Listed in global library</span>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="unlisted">
                  <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-accent-yellow" />
                    <div>
                      <span className="font-medium">Unlisted</span>
                      <span className="text-xs text-muted-gray ml-2">Accessible via link only</span>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="private">
                  <div className="flex items-center gap-2">
                    <EyeOff className="w-4 h-4 text-muted-gray" />
                    <div>
                      <span className="font-medium">Private</span>
                      <span className="text-xs text-muted-gray ml-2">Only you can see</span>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Location Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Malibu Beach"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="region_tag">Region</Label>
              <Select
                value={formData.region_tag || ''}
                onValueChange={(value) => setFormData({ ...formData, region_tag: value })}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {PRODUCTION_REGIONS.map((region) => (
                    <SelectItem key={region.value} value={region.value}>
                      {region.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location_type">Location Type</Label>
              <Select
                value={formData.location_type || ''}
                onValueChange={(value) => setFormData({ ...formData, location_type: value })}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="studio">Studio</SelectItem>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="exterior">Exterior</SelectItem>
                  <SelectItem value="industrial">Industrial</SelectItem>
                  <SelectItem value="nature">Nature</SelectItem>
                  <SelectItem value="urban">Urban</SelectItem>
                  <SelectItem value="rural">Rural</SelectItem>
                  <SelectItem value="institutional">Institutional</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scene_description">Scene Description</Label>
            <Input
              id="scene_description"
              placeholder="e.g., EXT. BEACH - DAY"
              value={formData.scene_description || ''}
              onChange={(e) => setFormData({ ...formData, scene_description: e.target.value })}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <div className="relative">
              <div className="flex gap-2">
                {/* Address input with autocomplete */}
                <div className="relative flex-1">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
                  <Input
                    ref={addressInputRef}
                    id="address"
                    type="text"
                    value={addressInput}
                    onChange={(e) => {
                      setAddressInput(e.target.value);
                      setShowAddressDropdown(true);
                      setSelectedIndex(-1);
                      // Also update formData.address for manual entry
                      setFormData({ ...formData, address: e.target.value });
                    }}
                    onKeyDown={handleAddressKeyDown}
                    onFocus={() => addressInput.length >= 3 && setShowAddressDropdown(true)}
                    placeholder="Start typing an address..."
                    disabled={isSubmitting}
                    className="pl-10 pr-8"
                    autoComplete="off"
                  />
                  {isAutocompleteLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-gray" />
                  )}
                  {!isAutocompleteLoading && addressResults.length > 0 && showAddressDropdown && (
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
                  )}
                </div>

                {/* Use My Location button */}
                {isGeoSupported && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleUseMyLocation}
                    disabled={isSubmitting || isGeoLoading}
                    title="Use my current location"
                    className="shrink-0 border-muted-gray/30"
                  >
                    {isGeoLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Navigation className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>

              {/* Autocomplete dropdown */}
              {showAddressDropdown && addressResults.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute z-50 mt-1 w-full rounded-md border border-muted-gray/30 bg-charcoal-black shadow-lg max-h-60 overflow-auto"
                >
                  {addressResults.map((result, index) => (
                    <button
                      key={result.place_id || index}
                      type="button"
                      onClick={() => handleSelectAddress(result)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm transition-colors',
                        'hover:bg-muted-gray/20 focus:bg-muted-gray/20 focus:outline-none',
                        index === selectedIndex && 'bg-muted-gray/20'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-gray" />
                        <div className="flex-1 min-w-0">
                          <p className="text-bone-white truncate">{result.label}</p>
                          {result.city && result.state && (
                            <p className="text-xs text-muted-gray">
                              {result.city}, {result.state}
                              {result.postal_code && ` ${result.postal_code}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* No results message */}
              {showAddressDropdown && addressInput.length >= 3 && !isAutocompleteLoading && addressResults.length === 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-muted-gray/30 bg-charcoal-black shadow-lg p-3">
                  <p className="text-sm text-muted-gray">No addresses found. You can enter the address manually.</p>
                </div>
              )}
            </div>
            {geoError && (
              <p className="text-xs text-red-500">{geoError}</p>
            )}
            <p className="text-xs text-muted-gray">
              Select from suggestions or use the location button to capture GPS coordinates
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city || ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Select
                value={formData.state || ''}
                onValueChange={(value) => setFormData({ ...formData, state: value })}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {US_STATES.map((state) => (
                    <SelectItem key={state.value} value={state.value}>
                      {state.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">ZIP</Label>
              <Input
                id="zip"
                value={formData.zip || ''}
                onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Coordinates (auto-filled from GPS or address selection) */}
          {(formData.latitude || formData.longitude) && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  value={formData.latitude || ''}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  value={formData.longitude || ''}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Additional details about the location..."
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={isSubmitting}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_name">Contact Name</Label>
              <Input
                id="contact_name"
                value={formData.contact_name || ''}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone">Contact Phone</Label>
              <Input
                id="contact_phone"
                value={formData.contact_phone || ''}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Amenities */}
          <div className="space-y-3">
            <Label>Amenities</Label>
            <div className="flex items-center gap-3">
              <Checkbox
                id="power_available"
                checked={formData.power_available}
                onCheckedChange={(checked) => setFormData({ ...formData, power_available: checked === true })}
                disabled={isSubmitting}
              />
              <label htmlFor="power_available" className="text-sm text-muted-gray cursor-pointer">
                Power Available
              </label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                id="restrooms_available"
                checked={formData.restrooms_available}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, restrooms_available: checked === true })
                }
                disabled={isSubmitting}
              />
              <label htmlFor="restrooms_available" className="text-sm text-muted-gray cursor-pointer">
                Restrooms Available
              </label>
            </div>
          </div>

          {/* Permit */}
          <div className="space-y-3">
            <Label>Permits</Label>
            <div className="flex items-center gap-3">
              <Checkbox
                id="permit_required"
                checked={formData.permit_required}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, permit_required: checked === true })
                }
                disabled={isSubmitting}
              />
              <label htmlFor="permit_required" className="text-sm text-muted-gray cursor-pointer">
                Permit Required
              </label>
            </div>
            {formData.permit_required && (
              <div className="flex items-center gap-3 ml-6">
                <Checkbox
                  id="permit_obtained"
                  checked={formData.permit_obtained}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, permit_obtained: checked === true })
                  }
                  disabled={isSubmitting}
                />
                <label htmlFor="permit_obtained" className="text-sm text-muted-gray cursor-pointer">
                  Permit Obtained
                </label>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="location_fee">Location Fee ($)</Label>
            <Input
              id="location_fee"
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={formData.location_fee || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  location_fee: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
              disabled={isSubmitting}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.name?.trim()}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingLocation ? (
                'Save Changes'
              ) : (
                'Create Location'
              )}
            </Button>
          </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateLocationModal;
