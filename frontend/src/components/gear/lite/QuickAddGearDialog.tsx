/**
 * QuickAddGearDialog.tsx
 * Streamlined gear + listing creation for lite users.
 * Single form that creates asset AND listing together.
 * 3-step wizard: Details -> Photos -> Pricing
 */
import React, { useState, useEffect } from 'react';
import {
  Camera,
  Upload,
  X,
  Package,
  DollarSign,
  Tag,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

import { useQuickAddAsset, useUpdatePersonalAsset } from '@/hooks/gear/usePersonalGear';
import type { ListingType, SaleCondition, QuickAddAssetInput, PersonalGearAsset } from '@/types/gear';

// ============================================================================
// Types
// ============================================================================

interface QuickAddGearDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editAsset?: PersonalGearAsset | null;
}

// Common gear categories for lite users
const COMMON_CATEGORIES = [
  { id: 'camera', name: 'Camera' },
  { id: 'lens', name: 'Lens' },
  { id: 'lighting', name: 'Lighting' },
  { id: 'audio', name: 'Audio' },
  { id: 'grip', name: 'Grip & Rigging' },
  { id: 'monitor', name: 'Monitor' },
  { id: 'tripod', name: 'Tripod & Support' },
  { id: 'power', name: 'Power & Batteries' },
  { id: 'storage', name: 'Storage & Media' },
  { id: 'accessories', name: 'Accessories' },
  { id: 'other', name: 'Other' },
];

const SALE_CONDITIONS: { value: SaleCondition; label: string }[] = [
  { value: 'new', label: 'New (Unused)' },
  { value: 'like_new', label: 'Like New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'parts', label: 'For Parts' },
];

// ============================================================================
// Component
// ============================================================================

export function QuickAddGearDialog({
  open,
  onClose,
  onSuccess,
  editAsset,
}: QuickAddGearDialogProps) {
  // Edit mode detection
  const isEditMode = !!editAsset;

  // Step management
  const [step, setStep] = useState(0); // 0: Details, 1: Photos, 2: Pricing

  // Form state - Step 1: Details
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');

  // Form state - Step 2: Photos
  const [photos, setPhotos] = useState<string[]>([]);

  // Form state - Step 3: Pricing
  const [listingType, setListingType] = useState<ListingType>('rent');
  const [dailyRate, setDailyRate] = useState('');
  const [weeklyRate, setWeeklyRate] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [condition, setCondition] = useState<SaleCondition>('good');
  const [saleIncludes, setSaleIncludes] = useState('');

  // API hooks
  const quickAdd = useQuickAddAsset();
  const updateAsset = useUpdatePersonalAsset();

  // Populate form when editing
  useEffect(() => {
    if (open && editAsset) {
      setName(editAsset.name || '');
      setCategory(editAsset.category_id || '');
      setManufacturer(editAsset.manufacturer || '');
      setModel(editAsset.model || '');
      setPhotos(editAsset.photos_current || editAsset.photos_baseline || []);
      setListingType(editAsset.listing_type || 'rent');
      setDailyRate(editAsset.daily_rate?.toString() || '');
      setWeeklyRate(editAsset.weekly_rate?.toString() || '');
      setSalePrice(editAsset.sale_price?.toString() || '');
      setCondition((editAsset.sale_condition as SaleCondition) || 'good');
      setSaleIncludes(editAsset.sale_includes || '');
    }
  }, [open, editAsset]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setStep(0);
      setName('');
      setCategory('');
      setManufacturer('');
      setModel('');
      setPhotos([]);
      setListingType('rent');
      setDailyRate('');
      setWeeklyRate('');
      setSalePrice('');
      setCondition('good');
      setSaleIncludes('');
    }
  }, [open]);

  // Photo upload handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Convert to base64 (the backend will handle S3 upload)
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

    // Reset input
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Form submission
  const handleSubmit = async () => {
    try {
      const input: QuickAddAssetInput = {
        name,
        category_id: category || undefined,
        manufacturer: manufacturer || undefined,
        model: model || undefined,
        photos,
        listing_type: listingType,
        daily_rate: listingType !== 'sale' ? parseFloat(dailyRate) || undefined : undefined,
        weekly_rate: listingType !== 'sale' ? parseFloat(weeklyRate) || undefined : undefined,
        sale_price: listingType !== 'rent' ? parseFloat(salePrice) || undefined : undefined,
        sale_condition: listingType !== 'rent' ? condition : undefined,
        sale_includes: listingType !== 'rent' ? saleIncludes || undefined : undefined,
        create_listing: true,
      };

      if (isEditMode && editAsset) {
        await updateAsset.mutateAsync({ assetId: editAsset.id, input });
        toast.success('Gear updated!');
      } else {
        await quickAdd.mutateAsync(input);
        toast.success('Gear added to marketplace!');
      }
      onClose();
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save gear');
    }
  };

  const isSubmitting = quickAdd.isPending || updateAsset.isPending;

  // Validation
  const canProceedStep1 = name.trim().length > 0;
  const canProceedStep2 = photos.length > 0;
  const canSubmit =
    canProceedStep1 &&
    canProceedStep2 &&
    (listingType !== 'sale' ? parseFloat(dailyRate) > 0 : true) &&
    (listingType !== 'rent' ? parseFloat(salePrice) > 0 : true);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {isEditMode ? 'Edit Gear' : 'Add Gear to Marketplace'}
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
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="Sony FX3, Canon 50mm f/1.2, etc."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="manufacturer">Manufacturer</Label>
                <Input
                  id="manufacturer"
                  placeholder="Sony, Canon, RED..."
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  placeholder="FX3, C70, etc."
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Photos */}
        {step === 1 && (
          <div className="space-y-4">
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
          </div>
        )}

        {/* Step 2: Pricing */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Listing Type */}
            <div>
              <Label>How do you want to list this gear?</Label>
              <RadioGroup
                value={listingType}
                onValueChange={(v) => setListingType(v as ListingType)}
                className="mt-2 space-y-2"
              >
                <label className="flex items-center gap-3 p-3 border border-white/10 rounded-lg cursor-pointer hover:border-accent-yellow/50">
                  <RadioGroupItem value="rent" id="rent" />
                  <div className="flex-1">
                    <p className="font-medium text-bone-white">For Rent</p>
                    <p className="text-xs text-muted-gray">Let others rent your gear</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 border border-white/10 rounded-lg cursor-pointer hover:border-accent-yellow/50">
                  <RadioGroupItem value="sale" id="sale" />
                  <div className="flex-1">
                    <p className="font-medium text-bone-white">For Sale</p>
                    <p className="text-xs text-muted-gray">Sell your gear permanently</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 border border-white/10 rounded-lg cursor-pointer hover:border-accent-yellow/50">
                  <RadioGroupItem value="both" id="both" />
                  <div className="flex-1">
                    <p className="font-medium text-bone-white">Both</p>
                    <p className="text-xs text-muted-gray">Available for rent or purchase</p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {/* Rental Pricing */}
            {(listingType === 'rent' || listingType === 'both') && (
              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-medium text-bone-white flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Rental Pricing
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="dailyRate">Daily Rate *</Label>
                    <div className="relative mt-1">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
                      <Input
                        id="dailyRate"
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
                  <div>
                    <Label htmlFor="weeklyRate">Weekly Rate</Label>
                    <div className="relative mt-1">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
                      <Input
                        id="weeklyRate"
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
            )}

            {/* Sale Pricing */}
            {(listingType === 'sale' || listingType === 'both') && (
              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-medium text-bone-white flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Sale Pricing
                </h4>
                <div>
                  <Label htmlFor="salePrice">Asking Price *</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
                    <Input
                      id="salePrice"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="condition">Condition</Label>
                  <Select value={condition} onValueChange={(v) => setCondition(v as SaleCondition)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SALE_CONDITIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="includes">What's Included</Label>
                  <Textarea
                    id="includes"
                    placeholder="Original box, battery, charger, strap..."
                    value={saleIncludes}
                    onChange={(e) => setSaleIncludes(e.target.value)}
                    className="mt-1"
                    rows={2}
                  />
                </div>
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
                  {isEditMode ? 'Saving...' : 'Adding...'}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {isEditMode ? 'Save Changes' : 'Add to Marketplace'}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default QuickAddGearDialog;
