/**
 * Elevator Pitch Input - 100 character quick pitch
 */
import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface ElevatorPitchInputProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

const ElevatorPitchInput: React.FC<ElevatorPitchInputProps> = ({
  value,
  onChange,
  maxLength = 100,
}) => {
  const remaining = maxLength - value.length;
  const isNearLimit = remaining <= 20;
  const isAtLimit = remaining <= 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="elevator-pitch" className="text-bone-white">
          Elevator Pitch
        </Label>
        <span
          className={`text-xs ${
            isAtLimit
              ? 'text-red-400'
              : isNearLimit
              ? 'text-amber-400'
              : 'text-muted-gray'
          }`}
        >
          {remaining} characters remaining
        </span>
      </div>
      <Textarea
        id="elevator-pitch"
        value={value}
        onChange={(e) => {
          const newValue = e.target.value;
          if (newValue.length <= maxLength) {
            onChange(newValue);
          }
        }}
        placeholder="A quick pitch about why you're perfect for this (100 characters max)"
        className="h-20 bg-charcoal-black/50 border-muted-gray/30 text-bone-white placeholder:text-muted-gray resize-none"
        maxLength={maxLength}
      />
      <p className="text-xs text-muted-gray">
        This is the first thing they'll see - make it count!
      </p>
    </div>
  );
};

export default ElevatorPitchInput;
