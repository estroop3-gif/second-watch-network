/**
 * Damage Report Modal
 * Capture damage tier, description, and photos
 */
import React, { useState } from 'react';
import { AlertTriangle, Camera, Upload, X } from 'lucide-react';

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
import { cn } from '@/lib/utils';

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
    color: 'border-yellow-500 bg-yellow-500/10',
  },
  {
    value: 'functional',
    label: 'Functional',
    description: 'Item has reduced functionality or intermittent issues.',
    color: 'border-orange-500 bg-orange-500/10',
  },
  {
    value: 'unsafe',
    label: 'Unsafe / Non-functional',
    description: 'Item is dangerous to use or completely non-functional.',
    color: 'border-red-500 bg-red-500/10',
  },
];

interface DamageReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetId: string;
  assetName: string;
  onSubmit: (tier: CheckinDamageTier, description: string, photos: string[]) => void;
}

export function DamageReportModal({
  isOpen,
  onClose,
  assetId,
  assetName,
  onSubmit,
}: DamageReportModalProps) {
  const [tier, setTier] = useState<CheckinDamageTier | ''>('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  const handleSubmit = () => {
    if (!tier || !description.trim()) return;
    onSubmit(tier, description.trim(), photos);
    handleClose();
  };

  const handleClose = () => {
    setTier('');
    setDescription('');
    setPhotos([]);
    onClose();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // For now, just convert to base64 - in production, upload to S3
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setPhotos((prev) => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const canSubmit = tier && description.trim().length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Report Damage
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Asset Info */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">Asset</p>
            <p className="font-medium">{assetName}</p>
          </div>

          {/* Damage Tier Selection */}
          <div className="space-y-2">
            <Label>Damage Severity *</Label>
            <RadioGroup
              value={tier}
              onValueChange={(v) => setTier(v as CheckinDamageTier)}
              className="space-y-2"
            >
              {DAMAGE_TIERS.map((t) => (
                <label
                  key={t.value}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    tier === t.value ? t.color : 'hover:bg-muted/50'
                  )}
                >
                  <RadioGroupItem value={t.value} className="mt-1" />
                  <div>
                    <p className="font-medium">{t.label}</p>
                    <p className="text-sm text-muted-foreground">{t.description}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description *</Label>
            <Textarea
              placeholder="Describe the damage in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Be specific about what is damaged and how it affects the item.
            </p>
          </div>

          {/* Photo Upload */}
          <div className="space-y-2">
            <Label>Photos</Label>
            <div className="flex flex-wrap gap-2">
              {photos.map((photo, idx) => (
                <div
                  key={idx}
                  className="relative w-20 h-20 rounded overflow-hidden border"
                >
                  <img
                    src={photo}
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

              <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed rounded cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors">
                <Camera className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground mt-1">Add</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Add photos to document the damage (recommended)
            </p>
          </div>

          {/* Action Info */}
          {tier && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium mb-1">What happens next:</p>
              {tier === 'cosmetic' ? (
                <p className="text-muted-foreground">
                  An incident will be logged. The item will remain available for checkout.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  An incident and repair ticket will be created. The item will be marked for
                  repair and unavailable for checkout until fixed.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} variant="destructive">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Report Damage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DamageReportModal;
