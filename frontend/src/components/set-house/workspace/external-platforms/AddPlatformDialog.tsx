/**
 * Add Platform Dialog
 * Dialog for connecting a new external booking platform
 */
import React, { useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  Calendar,
  Link,
  Info,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

import type {
  ExternalPlatformType,
  CreateExternalPlatformInput,
  ICalValidationResult,
  SetHouseSpace,
} from '@/types/set-house';

const PLATFORM_OPTIONS: { value: ExternalPlatformType; label: string; description: string }[] = [
  {
    value: 'peerspace',
    label: 'Peerspace',
    description: 'Connect your Peerspace calendar feed',
  },
  {
    value: 'giggster',
    label: 'Giggster',
    description: 'Connect your Giggster calendar feed',
  },
  {
    value: 'splacer',
    label: 'Splacer',
    description: 'Connect your Splacer calendar feed',
  },
  {
    value: 'spacetoco',
    label: 'Spacetoco',
    description: 'Connect your Spacetoco calendar feed',
  },
  {
    value: 'ical',
    label: 'Other iCal Feed',
    description: 'Connect any iCal/ICS calendar feed',
  },
];

const SYNC_FREQUENCY_OPTIONS = [
  { value: 15, label: 'Every 15 minutes' },
  { value: 30, label: 'Every 30 minutes' },
  { value: 60, label: 'Every hour' },
  { value: 120, label: 'Every 2 hours' },
  { value: 360, label: 'Every 6 hours' },
  { value: 720, label: 'Every 12 hours' },
  { value: 1440, label: 'Once daily' },
];

interface AddPlatformDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateExternalPlatformInput) => Promise<void>;
  onValidateUrl: (url: string) => Promise<ICalValidationResult>;
  spaces: SetHouseSpace[];
  isSubmitting?: boolean;
}

export function AddPlatformDialog({
  open,
  onOpenChange,
  onSubmit,
  onValidateUrl,
  spaces,
  isSubmitting = false,
}: AddPlatformDialogProps) {
  const [step, setStep] = useState<'select' | 'configure'>('select');
  const [platformType, setPlatformType] = useState<ExternalPlatformType | ''>('');
  const [platformName, setPlatformName] = useState('');
  const [icalUrl, setIcalUrl] = useState('');
  const [defaultSpaceId, setDefaultSpaceId] = useState('');
  const [syncFrequency, setSyncFrequency] = useState(60);
  const [autoCreate, setAutoCreate] = useState(true);
  const [notes, setNotes] = useState('');

  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ICalValidationResult | null>(null);
  const [validationError, setValidationError] = useState('');

  const handlePlatformSelect = (type: ExternalPlatformType) => {
    setPlatformType(type);
    const option = PLATFORM_OPTIONS.find((o) => o.value === type);
    if (option) {
      setPlatformName(option.label);
    }
    setStep('configure');
  };

  const handleValidateUrl = async () => {
    if (!icalUrl) return;

    setIsValidating(true);
    setValidationError('');
    setValidationResult(null);

    try {
      const result = await onValidateUrl(icalUrl);
      setValidationResult(result);
      if (!result.valid) {
        setValidationError(result.error || 'Invalid URL');
      }
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async () => {
    if (!platformType || !platformName) return;

    await onSubmit({
      platform_type: platformType,
      platform_name: platformName,
      ical_url: icalUrl || undefined,
      default_space_id: defaultSpaceId || undefined,
      sync_frequency_minutes: syncFrequency,
      auto_create_transactions: autoCreate,
      notes: notes || undefined,
    });

    // Reset form
    handleReset();
  };

  const handleReset = () => {
    setStep('select');
    setPlatformType('');
    setPlatformName('');
    setIcalUrl('');
    setDefaultSpaceId('');
    setSyncFrequency(60);
    setAutoCreate(true);
    setNotes('');
    setValidationResult(null);
    setValidationError('');
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  const canSubmit = platformType && platformName && (!icalUrl || validationResult?.valid);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-charcoal-black border-muted-gray/30">
        <DialogHeader>
          <DialogTitle className="text-bone-white">
            {step === 'select' ? 'Connect External Platform' : 'Configure Connection'}
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            {step === 'select'
              ? 'Select the platform you want to import bookings from'
              : 'Configure your calendar feed settings'}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' ? (
          <div className="space-y-3 py-4">
            {PLATFORM_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handlePlatformSelect(option.value)}
                className="w-full p-4 rounded-lg border border-muted-gray/30 hover:border-accent-yellow/50 hover:bg-accent-yellow/5 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent-yellow/20 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-accent-yellow" />
                  </div>
                  <div>
                    <h4 className="font-medium text-bone-white">{option.label}</h4>
                    <p className="text-sm text-muted-gray">{option.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Platform Name */}
            <div className="space-y-2">
              <Label htmlFor="platformName">Display Name</Label>
              <Input
                id="platformName"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
                placeholder="e.g., My Peerspace Account"
                className="bg-charcoal-black border-muted-gray/30"
              />
            </div>

            {/* iCal URL */}
            <div className="space-y-2">
              <Label htmlFor="icalUrl">iCal Feed URL</Label>
              <div className="flex gap-2">
                <Input
                  id="icalUrl"
                  value={icalUrl}
                  onChange={(e) => {
                    setIcalUrl(e.target.value);
                    setValidationResult(null);
                    setValidationError('');
                  }}
                  placeholder="https://example.com/calendar.ics"
                  className="bg-charcoal-black border-muted-gray/30"
                />
                <Button
                  variant="outline"
                  onClick={handleValidateUrl}
                  disabled={!icalUrl || isValidating}
                >
                  {isValidating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link className="w-4 h-4" />
                  )}
                  <span className="ml-2">Test</span>
                </Button>
              </div>

              {/* Validation Result */}
              {validationResult?.valid && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-green-400">Valid iCal feed</p>
                    <p className="text-muted-gray">
                      Found {validationResult.events_count} events
                    </p>
                  </div>
                </div>
              )}

              {validationError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
                  <p className="text-sm text-red-400">{validationError}</p>
                </div>
              )}

              <p className="text-xs text-muted-gray flex items-center gap-1">
                <Info className="w-3 h-3" />
                Find your iCal URL in your platform's calendar settings
              </p>
            </div>

            {/* Default Space */}
            <div className="space-y-2">
              <Label htmlFor="defaultSpace">Default Space</Label>
              <Select value={defaultSpaceId} onValueChange={setDefaultSpaceId}>
                <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                  <SelectValue placeholder="Select a space (optional)" />
                </SelectTrigger>
                <SelectContent className="bg-charcoal-black border-muted-gray/30">
                  <SelectItem value="">None</SelectItem>
                  {spaces.map((space) => (
                    <SelectItem key={space.id} value={space.id}>
                      {space.name} ({space.internal_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-gray">
                Imported bookings will be assigned to this space by default
              </p>
            </div>

            {/* Sync Frequency */}
            <div className="space-y-2">
              <Label htmlFor="syncFrequency">Sync Frequency</Label>
              <Select
                value={String(syncFrequency)}
                onValueChange={(v) => setSyncFrequency(Number(v))}
              >
                <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-charcoal-black border-muted-gray/30">
                  {SYNC_FREQUENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Auto Create */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-muted-gray/30">
              <div className="space-y-0.5">
                <Label htmlFor="autoCreate">Auto-create bookings</Label>
                <p className="text-xs text-muted-gray">
                  Automatically create transactions from imported events
                </p>
              </div>
              <Switch
                id="autoCreate"
                checked={autoCreate}
                onCheckedChange={setAutoCreate}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes about this connection..."
                className="bg-charcoal-black border-muted-gray/30"
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'configure' && (
            <Button variant="ghost" onClick={() => setStep('select')}>
              Back
            </Button>
          )}
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          {step === 'configure' && (
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect Platform'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddPlatformDialog;
