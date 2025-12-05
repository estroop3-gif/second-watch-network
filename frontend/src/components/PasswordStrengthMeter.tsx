import React from 'react';
import { cn } from '@/lib/utils';

interface PasswordStrengthMeterProps {
  password?: string;
}

const PasswordStrengthMeter = ({ password = '' }: PasswordStrengthMeterProps) => {
  const calculateStrength = () => {
    let score = 0;
    if (!password || password.length === 0) return 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const score = calculateStrength();
  let strengthText = '';
  let strengthColor = '';
  let width = '0%';

  if (score > 0 && score <= 2) {
    strengthText = 'Weak';
    strengthColor = 'bg-primary-red';
    width = '33%';
  } else if (score <= 4) {
    strengthText = 'Medium';
    strengthColor = 'bg-accent-yellow';
    width = '66%';
  } else if (score > 4) {
    strengthText = 'Strong';
    strengthColor = 'bg-green-500';
    width = '100%';
  }

  if (password.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1 pt-1">
      <div className="w-full bg-muted-gray/20 h-1.5">
        <div
          className={cn('h-1.5 transition-all duration-300', strengthColor)}
          style={{ width }}
        />
      </div>
      <p className="text-xs font-sans normal-case text-right text-muted-gray">
        {strengthText}
      </p>
    </div>
  );
};

export default PasswordStrengthMeter;