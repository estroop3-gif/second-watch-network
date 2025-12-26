/**
 * JobTypeToggle - Toggle between Freelance and Full-Time job types
 */
import React from 'react';
import { Briefcase, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export type JobType = 'freelance' | 'full_time';

interface JobTypeToggleProps {
  value: JobType;
  onChange: (type: JobType) => void;
  disabled?: boolean;
  className?: string;
}

const JobTypeToggle: React.FC<JobTypeToggleProps> = ({
  value,
  onChange,
  disabled = false,
  className,
}) => {
  return (
    <div className={cn('flex gap-2', className)}>
      <button
        type="button"
        onClick={() => onChange('freelance')}
        disabled={disabled}
        className={cn(
          'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all',
          value === 'freelance'
            ? 'bg-accent-yellow/10 border-accent-yellow text-accent-yellow'
            : 'bg-charcoal-black/50 border-muted-gray/30 text-muted-gray hover:border-muted-gray/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Clock className="w-5 h-5" />
        <div className="text-left">
          <div className="font-medium">Freelance</div>
          <div className="text-xs opacity-70">Day rates, contract work</div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onChange('full_time')}
        disabled={disabled}
        className={cn(
          'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all',
          value === 'full_time'
            ? 'bg-accent-yellow/10 border-accent-yellow text-accent-yellow'
            : 'bg-charcoal-black/50 border-muted-gray/30 text-muted-gray hover:border-muted-gray/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Briefcase className="w-5 h-5" />
        <div className="text-left">
          <div className="font-medium">Full-Time</div>
          <div className="text-xs opacity-70">Salary, benefits</div>
        </div>
      </button>
    </div>
  );
};

export default JobTypeToggle;
