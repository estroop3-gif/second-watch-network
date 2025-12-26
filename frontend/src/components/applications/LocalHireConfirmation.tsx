/**
 * Local Hire Confirmation - Yes/No confirmation for local hire requirement
 */
import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MapPin, Check, X } from 'lucide-react';

interface LocalHireConfirmationProps {
  value: boolean | null;
  onChange: (value: boolean) => void;
  location?: string;
}

const LocalHireConfirmation: React.FC<LocalHireConfirmationProps> = ({
  value,
  onChange,
  location,
}) => {
  return (
    <div className="space-y-3 p-4 bg-amber-600/10 border border-amber-600/30 rounded-lg">
      <div className="flex items-center gap-2">
        <MapPin className="w-5 h-5 text-amber-400" />
        <Label className="text-bone-white font-medium">Local Hire Required</Label>
      </div>

      <p className="text-sm text-muted-gray">
        This opportunity requires you to be a local hire
        {location && (
          <span className="text-amber-400"> in {location}</span>
        )}
        . Can you work as a local?
      </p>

      <div className="flex gap-3">
        <Button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 ${
            value === true
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-charcoal-black/50 border border-muted-gray/30 text-muted-gray hover:text-bone-white hover:border-green-600'
          }`}
        >
          <Check className="w-4 h-4 mr-2" />
          Yes, I can work as a local
        </Button>
        <Button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 ${
            value === false
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-charcoal-black/50 border border-muted-gray/30 text-muted-gray hover:text-bone-white hover:border-red-600'
          }`}
        >
          <X className="w-4 h-4 mr-2" />
          No, I would need travel
        </Button>
      </div>

      {value !== null && (
        <p className="text-xs text-center">
          {value ? (
            <span className="text-green-400">Great! You've confirmed local availability.</span>
          ) : (
            <span className="text-amber-400">
              Note: You may still apply, but they're looking for locals.
            </span>
          )}
        </p>
      )}
    </div>
  );
};

export default LocalHireConfirmation;
