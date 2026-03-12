/**
 * QuickAddSpaceDialog.tsx
 * Streamlined space + listing creation for lite users.
 * Single form that creates space AND listing together.
 * 3-step wizard: Details -> Photos -> Pricing
 */
import React, { useState, useEffect } from 'react';
import {
  Camera,
  Upload,
  X,
  Building2,
  DollarSign,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
  MapPin,
  EyeOff,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

import { usePersonalSetHouse } from '@/hooks/set-house/usePersonalSetHouse';
import type { QuickAddSpaceInput } from '@/hooks/set-house/usePersonalSetHouse';
import { LocationAutocomplete } from '@/components/ui/location-autocomplete';
import type { LocationData } from '@/components/ui/location-autocomplete';

// ============================================================================
// Types
// ============================================================================

interface QuickAddSpaceDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const SPACE_TYPES = [
  { value: 'studio', label: 'Studio' },
  { value: 'sound_stage', label: 'Sound Stage' },
  { value: 'location', label: 'Location' },
  { value: 'backlot', label: 'Backlot' },
  { value: 'green_screen', label: 'Green Screen' },
  { value: 'office', label: 'Office / Corporate' },
  { value: 'warehouse', label: 'Warehouse / Industrial' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'residential', label: 'Residential' },
  { value: 'other', label: 'Other' },
];

// ============================================================================
// Component
// ============================================================================

export function QuickAddSpaceDialog({
  open,
  onClose,
  onSuccess,
}: QuickAddSpaceDialogProps) {
  // Step management
  const [step, setStep] = useState(0); // 0: Details, 1: Photos, 2: Pricing

  // Form state - Step 1: Details
  const [name, setName] = useState('');
  const [spaceType, setSpaceType] = useState('');
  const [squareFootage, setSquareFootage] = useState('');
  const [description, setDescription] = useState('');
  const [addressLocation, setAddressLocation] = useState<LocationData | null>(null);
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [hideAddress, setHideAddress] = useState(false);

  // Form state - Step 2: Photos
  const [photos, setPhotos] = useState<string[]>([]);
  const [createListing, setCreateListing] = useState(true);

  // Form state - Step 3: Pricing
  const [dailyRate, setDailyRate] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [weeklyRate, setWeeklyRate] = useState('');

  // API hook
  const { quickAddSpace } = usePersonalSetHouse();

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setStep(0);
      setName('');
      setSpaceType('');
      setSquareFootage('');
      setDescription('');
      setAddressLocation(null);
      setAddressLine1('');
      setAddressLine2('');
      setCity('');
      setState('');
      setZipCode('');
      setHideAddress(false);
      setPhotos([]);
      setCreateListing(true);
      setDailyRate('');
      setHourlyRate('');
      setWeeklyRate('');
    }
  }, [open]);

  // Photo upload handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (photos.length >= 6) {
        toast.error('Maximum 6 photos allowed');
        break;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setPhotos((prev) => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    }

    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Form submission
  const handleSubmit = async () => {
    try {
      const input: QuickAddSpaceInput = {
        name,
        space_type: spaceType || undefined,
        square_footage: squareFootage ? parseFloat(squareFootage) : undefined,
        description: description || undefined,
        address_line1: addressLine1 || undefined,
        address_line2: addressLine2 || undefined,
        city: city || undefined,
        state: state || undefined,
        zip_code: zipCode || undefined,
        hide_address: hideAddress,
        photos,
        daily_rate: createListing ? parseFloat(dailyRate) || undefined : undefined,
        hourly_rate: createListing && hourlyRate ? parseFloat(hourlyRate) : undefined,
        weekly_rate: createListing && weeklyRate ? parseFloat(weeklyRate) : undefined,
        create_listing: createListing,
      };

      await quickAddSpace.mutateAsync(input);
      toast.success(createListing ? 'Space added to marketplace!' : 'Space added!');
      onClose();
      onSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save space';
      console.error('[QuickAddSpaceDialog] Submit failed:', message);
      toast.error(message);
    }
  };

  const isSubmitting = quickAddSpace.isPending;

  // Validation
  const canProceedStep1 = name.trim().length > 0;
  const canProceedStep2 = !createListing || photos.length > 0;
  const canSubmit =
    canProceedStep1 &&
    canProceedStep2 &&
    (!createListing || parseFloat(dailyRate) > 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Add Space to Marketplace
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex gap-2 mb-4">
          {['Details', 'Photos', 'Pricing'].map((label, i) => (
            <div key={i} className="flex-1">
              <div
                className={cn(
                  'h-1 rounded transition-colors',
                  i <= step ? 'bg-accent-yellow' : 'bg-white/20'
                )}
              />
              <span
                className={cn(
                  'text-xs mt-1 block',
                  i <= step ? 'text-bone-white' : 'text-muted-gray'
                )}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Step 0: Details */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="space-name">Name *</Label>
              <Input
                id="space-name"
                placeholder="Downtown Studio, Rooftop Location, etc."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="space-type">Space Type</Label>
              <Select value={spaceType} onValueChange={setSpaceType}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {SPACE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="sq-footage">Square Footage</Label>
              <Input
                id="sq-footage"
                type="number"
                min="0"
                placeholder="e.g. 2500"
                value={squareFootage}
                onChange={(e) => setSquareFootage(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the space, amenities, access, etc."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>

            {/* Address */}
            <div className="space-y-3 pt-1">
              <Label className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Address
              </Label>

              {/* Street — autocomplete populates all fields on selection */}
              <LocationAutocomplete
                placeholder="Street address"
                mode="address"
                showUseMyLocation={false}
                value={addressLocation ?? addressLine1}
                onChange={(loc: LocationData) => {
                  setAddressLocation(loc);
                  // Always capture what the user typed/selected as the street line
                  setAddressLine1(loc.address || loc.displayName || '');
                  // Only overwrite city/state/zip when the result has structured data
                  if (loc.city) setCity(loc.city);
                  if (loc.stateCode) setState(loc.stateCode);
                  else if (loc.state) setState(loc.state);
                  if (loc.zip) setZipCode(loc.zip);
                }}
              />

              <Input
                id="address-line2"
                placeholder="Apt, suite, unit (optional)"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
              />

              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
                <Input
                  placeholder="State"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                />
                <Input
                  placeholder="ZIP"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                />
              </div>

              {/* Hide address toggle */}
              <label className="flex items-start gap-3 p-3 border border-white/10 rounded-lg cursor-pointer hover:border-accent-yellow/50">
                <input
                  type="checkbox"
                  checked={hideAddress}
                  onChange={(e) => setHideAddress(e.target.checked)}
                  className="w-4 h-4 accent-yellow-400 mt-0.5"
                />
                <div>
                  <p className="font-medium text-bone-white text-sm flex items-center gap-1.5">
                    <EyeOff className="h-3.5 w-3.5" />
                    Hide exact address
                  </p>
                  <p className="text-xs text-muted-gray mt-0.5">
                    Only your city and state will be shown on the listing. Full address is shared after booking.
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Step 1: Photos */}
        {step === 1 && (
          <div className="space-y-4">
            {/* List on marketplace toggle */}
            <label className="flex items-center gap-3 p-3 border border-white/10 rounded-lg cursor-pointer hover:border-accent-yellow/50">
              <input
                type="checkbox"
                checked={createListing}
                onChange={(e) => setCreateListing(e.target.checked)}
                className="w-4 h-4 accent-yellow-400"
              />
              <div>
                <p className="font-medium text-bone-white text-sm">List on marketplace</p>
                <p className="text-xs text-muted-gray">Make this space discoverable by other filmmakers</p>
              </div>
            </label>

            {createListing && (
              <>
                <p className="text-sm text-muted-gray">
                  At least one photo is required to list on the marketplace. Add up to 6 photos.
                </p>

                {/* Photo Grid */}
                <div className="grid grid-cols-3 gap-3">
                  {photos.map((photo, index) => (
                    <div
                      key={index}
                      className="relative aspect-square rounded-lg overflow-hidden bg-white/10"
                    >
                      <img
                        src={photo}
                        alt={`Photo ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/60 hover:bg-black/80 text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      {index === 0 && (
                        <span className="absolute bottom-1 left-1 text-xs bg-accent-yellow text-black px-1 rounded">
                          Main
                        </span>
                      )}
                    </div>
                  ))}

                  {/* Upload Button */}
                  {photos.length < 6 && (
                    <label className="aspect-square rounded-lg border-2 border-dashed border-white/20 hover:border-accent-yellow/50 flex flex-col items-center justify-center cursor-pointer transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                      <Camera className="h-6 w-6 text-muted-gray mb-1" />
                      <span className="text-xs text-muted-gray">Add Photo</span>
                    </label>
                  )}
                </div>

                {photos.length === 0 && (
                  <div className="text-center py-6 border-2 border-dashed border-white/20 rounded-lg">
                    <Upload className="h-8 w-8 mx-auto text-muted-gray mb-2" />
                    <p className="text-sm text-muted-gray">
                      Drag photos here or click to upload
                    </p>
                    <label className="mt-2 inline-block">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                      <Button type="button" variant="outline" size="sm" asChild>
                        <span>Choose Files</span>
                      </Button>
                    </label>
                  </div>
                )}
              </>
            )}

            {!createListing && (
              <p className="text-sm text-muted-gray py-2">
                You can add photos and list this space later from your Space Listings tab.
              </p>
            )}
          </div>
        )}

        {/* Step 2: Pricing */}
        {step === 2 && (
          <div className="space-y-4">
            {createListing ? (
              <>
                <div>
                  <h4 className="text-sm font-medium text-bone-white flex items-center gap-2 mb-3">
                    <DollarSign className="h-4 w-4" />
                    Rental Pricing
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="daily-rate">Daily Rate *</Label>
                      <div className="relative mt-1">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
                        <Input
                          id="daily-rate"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={dailyRate}
                          onChange={(e) => setDailyRate(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="hourly-rate">Hourly Rate</Label>
                        <div className="relative mt-1">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
                          <Input
                            id="hourly-rate"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Optional"
                            value={hourlyRate}
                            onChange={(e) => setHourlyRate(e.target.value)}
                            className="pl-8"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="weekly-rate">Weekly Rate</Label>
                        <div className="relative mt-1">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
                          <Input
                            id="weekly-rate"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Optional"
                            value={weeklyRate}
                            onChange={(e) => setWeeklyRate(e.target.value)}
                            className="pl-8"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-6 text-center">
                <Building2 className="h-10 w-10 mx-auto text-muted-gray mb-3" />
                <p className="text-sm text-muted-gray">
                  Your space will be saved without a marketplace listing.
                  You can create a listing at any time from your Space Listings tab.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer Navigation */}
        <DialogFooter className="flex gap-2 pt-4">
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              disabled={isSubmitting}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          <div className="flex-1" />
          {step < 2 ? (
            <Button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={
                (step === 0 && !canProceedStep1) ||
                (step === 1 && !canProceedStep2)
              }
            >
              Next
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {createListing ? 'Add to Marketplace' : 'Add Space'}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default QuickAddSpaceDialog;
