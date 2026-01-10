/**
 * Assign Strike Dialog
 * Dialog to assign a strike to a user from an incident
 */
import React, { useState } from 'react';
import { AlertTriangle, Loader2, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { StrikeSeverity } from '@/types/gear';

const SEVERITY_CONFIG: Record<StrikeSeverity, { label: string; color: string; description: string }> = {
  warning: {
    label: 'Warning',
    color: 'text-blue-400',
    description: 'Educational notification, no points deducted',
  },
  minor: {
    label: 'Minor',
    color: 'text-yellow-400',
    description: 'Small policy violation, minor point deduction',
  },
  major: {
    label: 'Major',
    color: 'text-orange-400',
    description: 'Significant issue, substantial point deduction',
  },
  critical: {
    label: 'Critical',
    color: 'text-red-400',
    description: 'Serious violation, may result in suspension',
  },
};

interface AssignStrikeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    user_id: string;
    severity: StrikeSeverity;
    reason: string;
    notes?: string;
  }) => Promise<void>;
  isSubmitting: boolean;
  preselectedUserId?: string;
  preselectedUserName?: string;
  incidentDescription?: string;
}

export function AssignStrikeDialog({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  preselectedUserId,
  preselectedUserName,
  incidentDescription,
}: AssignStrikeDialogProps) {
  const [userId, setUserId] = useState(preselectedUserId || '');
  const [userName, setUserName] = useState(preselectedUserName || '');
  const [severity, setSeverity] = useState<StrikeSeverity>('warning');
  const [reason, setReason] = useState(incidentDescription || '');
  const [notes, setNotes] = useState('');

  // Update state when preselected values change
  React.useEffect(() => {
    if (preselectedUserId) setUserId(preselectedUserId);
    if (preselectedUserName) setUserName(preselectedUserName);
    if (incidentDescription) setReason(incidentDescription);
  }, [preselectedUserId, preselectedUserName, incidentDescription]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !reason) return;

    await onSubmit({
      user_id: userId,
      severity,
      reason,
      notes: notes || undefined,
    });

    // Reset form
    setUserId('');
    setUserName('');
    setSeverity('warning');
    setReason('');
    setNotes('');
  };

  const handleClose = () => {
    setUserId('');
    setUserName('');
    setSeverity('warning');
    setReason('');
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-charcoal-black border-muted-gray/30 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-bone-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-accent-yellow" />
            Assign Strike
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            Issue a strike to hold a user accountable for this incident
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* User */}
          <div className="space-y-2">
            <Label className="text-bone-white">User</Label>
            {preselectedUserName ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-yellow/10 border border-accent-yellow/30">
                <User className="w-4 h-4 text-accent-yellow" />
                <span className="text-accent-yellow font-medium">{preselectedUserName}</span>
              </div>
            ) : (
              <Input
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Search for a user..."
                className="bg-charcoal-black/50 border-muted-gray/30 text-bone-white"
              />
            )}
          </div>

          {/* Severity */}
          <div className="space-y-2">
            <Label className="text-bone-white">Severity</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as StrikeSeverity)}>
              <SelectTrigger className="bg-charcoal-black/50 border-muted-gray/30 text-bone-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-charcoal-black border-muted-gray/30">
                {Object.entries(SEVERITY_CONFIG).map(([value, config]) => (
                  <SelectItem key={value} value={value} className="text-bone-white">
                    <div className="flex items-center gap-2">
                      <span className={config.color}>{config.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-gray">
              {SEVERITY_CONFIG[severity].description}
            </p>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label className="text-bone-white">Reason *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe why this strike is being issued..."
              rows={3}
              className="bg-charcoal-black/50 border-muted-gray/30 text-bone-white resize-none"
              required
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-bone-white">Internal Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes for internal reference..."
              rows={2}
              className="bg-charcoal-black/50 border-muted-gray/30 text-bone-white resize-none"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="border-muted-gray/30 text-muted-gray hover:text-bone-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !userId || !reason}
              className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Issue Strike
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AssignStrikeDialog;
