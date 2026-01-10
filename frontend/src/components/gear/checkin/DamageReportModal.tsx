/**
 * Damage Report Modal
 * Capture damage tier, description, and photos with S3 upload
 */
import React, { useState, useCallback } from 'react';
import { AlertTriangle, Camera, X, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

import { useUploadIncidentPhoto } from '@/hooks/gear/useGearCheckin';
import type { CheckinDamageTier } from '@/types/gear';

const DAMAGE_TIERS: {
  value: CheckinDamageTier;
  label: string;
  description: string;
  color: string;
}[] = [
  {
    value: 'cosmetic',
    label: 'Cosmetic',
    description: 'Scratches, scuffs, or visual issues. Item still functions normally.',
    color: 'border-accent-yellow/50 bg-accent-yellow/10',
  },
  {
    value: 'functional',
    label: 'Functional',
    description: 'Item has reduced functionality or intermittent issues.',
    color: 'border-orange-500/50 bg-orange-500/10',
  },
  {
    value: 'unsafe',
    label: 'Unsafe / Non-functional',
    description: 'Item is dangerous to use or completely non-functional.',
    color: 'border-red-500/50 bg-red-500/10',
  },
];

interface UploadedPhoto {
  s3_key: string;
  url: string;
  filename: string;
}

interface DamageReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  assetId: string;
  assetName: string;
  onSubmit: (tier: CheckinDamageTier, description: string, photoKeys: string[], createRepairTicket: boolean) => void;
}

export function DamageReportModal({
  isOpen,
  onClose,
  orgId,
  assetId,
  assetName,
  onSubmit,
}: DamageReportModalProps) {
  const [tier, setTier] = useState<CheckinDamageTier | ''>('');
  const [description, setDescription] = useState('');
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [createRepairTicket, setCreateRepairTicket] = useState(false);

  const { uploadPhoto } = useUploadIncidentPhoto(orgId);

  // Update repair ticket default when tier changes
  const handleTierChange = (newTier: CheckinDamageTier) => {
    setTier(newTier);
    // Default: checked for functional/unsafe, unchecked for cosmetic
    setCreateRepairTicket(newTier !== 'cosmetic');
  };

  const handleSubmit = () => {
    console.log('[DamageReportModal] handleSubmit called:', {
      tier,
      description: description.trim(),
      uploadedPhotos: uploadedPhotos.length,
      createRepairTicket,
    });

    if (!tier || !description.trim() || uploadedPhotos.length === 0) {
      console.log('[DamageReportModal] Validation failed - missing required fields');
      return;
    }
    const photoKeys = uploadedPhotos.map((p) => p.s3_key);
    console.log('[DamageReportModal] Calling onSubmit with photoKeys:', photoKeys);
    onSubmit(tier, description.trim(), photoKeys, createRepairTicket);
    handleClose();
  };

  const handleClose = () => {
    setTier('');
    setDescription('');
    setUploadedPhotos([]);
    setCreateRepairTicket(false);
    onClose();
  };

  const handlePhotoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setIsUploading(true);

      try {
        for (const file of Array.from(files)) {
          // Upload to S3
          const result = await uploadPhoto({ assetId, file });
          setUploadedPhotos((prev) => [
            ...prev,
            {
              s3_key: result.s3_key,
              url: result.url,
              filename: result.filename,
            },
          ]);
        }
      } catch (error) {
        console.error('Photo upload failed:', error);
      } finally {
        setIsUploading(false);
        // Reset input so same file can be selected again
        e.target.value = '';
      }
    },
    [assetId, uploadPhoto]
  );

  const removePhoto = (index: number) => {
    setUploadedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Photos are REQUIRED for damage reports
  const canSubmit =
    tier && description.trim().length > 0 && uploadedPhotos.length > 0 && !isUploading;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col bg-charcoal-black border-muted-gray/30">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-bone-white">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Report Damage
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 pr-2">
          {/* Asset Info */}
          <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-3">
            <p className="text-sm text-muted-gray">Asset</p>
            <p className="font-medium text-bone-white">{assetName}</p>
          </div>

          {/* Damage Tier Selection */}
          <div className="space-y-2">
            <Label className="text-bone-white">Damage Severity *</Label>
            <RadioGroup
              value={tier}
              onValueChange={(v) => handleTierChange(v as CheckinDamageTier)}
              className="space-y-2"
            >
              {DAMAGE_TIERS.map((t) => (
                <label
                  key={t.value}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    tier === t.value
                      ? t.color
                      : 'border-muted-gray/30 hover:border-muted-gray/50 bg-charcoal-black/30'
                  )}
                >
                  <RadioGroupItem value={t.value} className="mt-1" />
                  <div>
                    <p className="font-medium text-bone-white">{t.label}</p>
                    <p className="text-sm text-muted-gray">{t.description}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-bone-white">Description *</Label>
            <Textarea
              placeholder="Describe the damage in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="bg-charcoal-black/50 border-muted-gray/30 text-bone-white placeholder:text-muted-gray/50"
            />
            <p className="text-xs text-muted-gray">
              Be specific about what is damaged and how it affects the item.
            </p>
          </div>

          {/* Photo Upload - REQUIRED */}
          <div className="space-y-2">
            <Label className="text-bone-white">
              Photos * <span className="text-muted-gray font-normal">(at least 1 required)</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {uploadedPhotos.map((photo, idx) => (
                <div
                  key={photo.s3_key}
                  className="relative w-20 h-20 rounded overflow-hidden border border-muted-gray/30"
                >
                  <img
                    src={photo.url}
                    alt={`Damage photo ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute top-1 right-1 p-0.5 bg-black/50 rounded-full hover:bg-black/70"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ))}

              <label
                className={cn(
                  'w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed rounded cursor-pointer transition-colors',
                  isUploading
                    ? 'border-muted-gray/30 bg-muted-gray/10 cursor-wait'
                    : 'border-muted-gray/30 hover:border-accent-yellow/50 hover:bg-charcoal-black/50'
                )}
              >
                {isUploading ? (
                  <Loader2 className="h-5 w-5 text-muted-gray animate-spin" />
                ) : (
                  <>
                    <Camera className="h-5 w-5 text-muted-gray" />
                    <span className="text-xs text-muted-gray mt-1">Add</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  multiple
                  onChange={handlePhotoUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
            </div>
            {uploadedPhotos.length === 0 && (
              <p className="text-xs text-red-400">
                At least one photo is required to document the damage
              </p>
            )}
          </div>

          {/* Create Repair Ticket Option */}
          {tier && (
            <div className="flex items-start space-x-3 p-3 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
              <Checkbox
                id="create-repair"
                checked={createRepairTicket}
                onCheckedChange={(checked) => setCreateRepairTicket(checked === true)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <Label htmlFor="create-repair" className="text-bone-white cursor-pointer">
                  Create repair ticket
                </Label>
                <p className="text-xs text-muted-gray mt-0.5">
                  {createRepairTicket
                    ? 'A repair ticket will be created and the item marked for repair'
                    : 'Only an incident will be logged, no repair ticket will be created'}
                </p>
              </div>
            </div>
          )}

          {/* Action Info */}
          {tier && (
            <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-3 text-sm">
              <p className="font-medium text-bone-white mb-1">What happens next:</p>
              <ul className="text-muted-gray space-y-1 text-sm">
                <li>• An incident will be logged for this damage</li>
                {createRepairTicket ? (
                  <>
                    <li>• A repair ticket will be created</li>
                    <li>• The item will be marked as "under repair" and unavailable</li>
                  </>
                ) : (
                  <li>• The item will remain available for checkout</li>
                )}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 border-t border-muted-gray/20 pt-4 flex-shrink-0">
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-muted-gray/30 text-muted-gray hover:text-bone-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 mr-2" />
                Report Damage
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DamageReportModal;
