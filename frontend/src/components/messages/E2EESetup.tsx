/**
 * E2EE Setup Component
 * Guides users through setting up end-to-end encryption for their messages
 */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { setupE2EE, initializeE2EE, isE2EEInitialized } from '@/lib/e2ee';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Lock, Key, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface E2EESetupProps {
  isOpen: boolean;
  onClose: () => void;
  onSetupComplete: () => void;
}

type SetupStep = 'intro' | 'create-pin' | 'confirm-pin' | 'setting-up' | 'complete';

export const E2EESetup = ({ isOpen, onClose, onSetupComplete }: E2EESetupProps) => {
  const { user } = useAuth();
  const [step, setStep] = useState<SetupStep>('intro');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const setupMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      await setupE2EE(user.id, pin);
    },
    onSuccess: () => {
      setStep('complete');
      toast.success('End-to-end encryption enabled!');
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to set up encryption');
      setStep('create-pin');
    },
  });

  const handleStartSetup = () => {
    setStep('create-pin');
  };

  const handlePinSubmit = () => {
    if (pin.length < 6) {
      setError('PIN must be at least 6 characters');
      return;
    }
    setError(null);
    setStep('confirm-pin');
  };

  const handleConfirmPin = () => {
    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }
    setError(null);
    setStep('setting-up');
    setupMutation.mutate();
  };

  const handleComplete = () => {
    onSetupComplete();
    onClose();
    // Reset state
    setStep('intro');
    setPin('');
    setConfirmPin('');
    setError(null);
  };

  const renderContent = () => {
    switch (step) {
      case 'intro':
        return (
          <>
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-16 h-16 rounded-full bg-accent-yellow/20 flex items-center justify-center">
                <Shield className="w-8 h-8 text-accent-yellow" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-bone-white">
                  Enable End-to-End Encryption
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Your messages will be encrypted so only you and the recipient can read them.
                  Not even Second Watch Network can access your messages.
                </p>
              </div>
              <div className="space-y-3 w-full max-w-sm">
                <div className="flex items-start gap-3 p-3 bg-muted-gray/20 rounded-lg">
                  <Lock className="w-5 h-5 text-accent-yellow mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-bone-white">Private by Design</p>
                    <p className="text-xs text-muted-foreground">
                      Messages are encrypted on your device before being sent
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted-gray/20 rounded-lg">
                  <Key className="w-5 h-5 text-accent-yellow mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-bone-white">PIN Backup</p>
                    <p className="text-xs text-muted-foreground">
                      Set a PIN to recover your encryption keys on new devices
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>
                Later
              </Button>
              <Button onClick={handleStartSetup} className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
                Set Up Encryption
              </Button>
            </DialogFooter>
          </>
        );

      case 'create-pin':
        return (
          <>
            <div className="flex flex-col gap-4 py-6">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-bone-white">Create Your PIN</h3>
                <p className="text-sm text-muted-foreground">
                  This PIN will encrypt your key backup. You'll need it to recover your messages on
                  a new device.
                </p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pin">Security PIN (6+ characters)</Label>
                  <Input
                    id="pin"
                    type="password"
                    placeholder="Enter your PIN"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="bg-muted-gray border-muted-gray"
                    autoFocus
                  />
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    {error}
                  </div>
                )}
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-xs text-amber-400">
                    <strong>Important:</strong> If you forget your PIN and lose access to all your
                    devices, your encrypted messages cannot be recovered.
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep('intro')}>
                Back
              </Button>
              <Button
                onClick={handlePinSubmit}
                disabled={pin.length < 6}
                className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
              >
                Continue
              </Button>
            </DialogFooter>
          </>
        );

      case 'confirm-pin':
        return (
          <>
            <div className="flex flex-col gap-4 py-6">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-bone-white">Confirm Your PIN</h3>
                <p className="text-sm text-muted-foreground">Enter your PIN again to confirm.</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="confirm-pin">Confirm PIN</Label>
                  <Input
                    id="confirm-pin"
                    type="password"
                    placeholder="Re-enter your PIN"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    className="bg-muted-gray border-muted-gray"
                    autoFocus
                  />
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    {error}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep('create-pin')}>
                Back
              </Button>
              <Button
                onClick={handleConfirmPin}
                disabled={confirmPin.length < 6}
                className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
              >
                Enable Encryption
              </Button>
            </DialogFooter>
          </>
        );

      case 'setting-up':
        return (
          <div className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="w-12 h-12 text-accent-yellow animate-spin" />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-bone-white">Setting Up Encryption</h3>
              <p className="text-sm text-muted-foreground">
                Generating your encryption keys...
              </p>
            </div>
          </div>
        );

      case 'complete':
        return (
          <>
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-bone-white">Encryption Enabled!</h3>
                <p className="text-sm text-muted-foreground">
                  Your messages are now end-to-end encrypted. Only you and your recipients can read
                  them.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleComplete}
                className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90 w-full"
              >
                Done
              </Button>
            </DialogFooter>
          </>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-charcoal-black border-muted-gray text-bone-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent-yellow" />
            End-to-End Encryption
          </DialogTitle>
          {step === 'intro' && (
            <DialogDescription>
              Secure your private conversations with encryption
            </DialogDescription>
          )}
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// E2EE BADGE COMPONENT
// ============================================================================

interface E2EEBadgeProps {
  isEncrypted: boolean;
  className?: string;
}

export const E2EEBadge = ({ isEncrypted, className }: E2EEBadgeProps) => {
  if (!isEncrypted) return null;

  return (
    <div
      className={`inline-flex items-center gap-1 text-xs text-green-400 ${className}`}
      title="End-to-end encrypted"
    >
      <Lock className="w-3 h-3" />
      <span>Encrypted</span>
    </div>
  );
};
