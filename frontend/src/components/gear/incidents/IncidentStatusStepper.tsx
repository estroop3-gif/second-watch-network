/**
 * Incident Status Stepper
 * Visual status progression stepper for incident workflow
 */
import React from 'react';
import { Check, Circle, AlertCircle, Eye, Wrench, RefreshCw, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IncidentStatus } from '@/types/gear';

const STATUS_ORDER: IncidentStatus[] = ['open', 'investigating', 'repair', 'replacement', 'resolved'];

const STATUS_CONFIG: Record<IncidentStatus, { label: string; icon: React.ReactNode }> = {
  open: { label: 'Open', icon: <AlertCircle className="w-4 h-4" /> },
  investigating: { label: 'Investigating', icon: <Eye className="w-4 h-4" /> },
  repair: { label: 'Repair', icon: <Wrench className="w-4 h-4" /> },
  replacement: { label: 'Replacement', icon: <RefreshCw className="w-4 h-4" /> },
  resolved: { label: 'Resolved', icon: <CheckCircle2 className="w-4 h-4" /> },
};

interface IncidentStatusStepperProps {
  currentStatus: IncidentStatus;
  onStatusChange?: (status: IncidentStatus) => void;
  disabled?: boolean;
}

export function IncidentStatusStepper({
  currentStatus,
  onStatusChange,
  disabled = false,
}: IncidentStatusStepperProps) {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);

  return (
    <div className="flex items-center justify-between w-full">
      {STATUS_ORDER.map((status, index) => {
        const config = STATUS_CONFIG[status];
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isClickable = !disabled && onStatusChange && index <= currentIndex + 1;

        return (
          <React.Fragment key={status}>
            {/* Step */}
            <div
              className={cn(
                'flex flex-col items-center gap-1.5',
                isClickable && 'cursor-pointer group'
              )}
              onClick={() => isClickable && onStatusChange?.(status)}
            >
              {/* Circle/Icon */}
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all',
                  isCompleted && 'bg-green-500/20 border-green-500 text-green-400',
                  isCurrent && 'bg-accent-yellow/20 border-accent-yellow text-accent-yellow',
                  !isCompleted && !isCurrent && 'bg-charcoal-black border-muted-gray/50 text-muted-gray/50',
                  isClickable && 'group-hover:border-accent-yellow/80 group-hover:scale-105'
                )}
              >
                {isCompleted ? <Check className="w-5 h-5" /> : config.icon}
              </div>

              {/* Label */}
              <span
                className={cn(
                  'text-xs font-medium',
                  isCompleted && 'text-green-400',
                  isCurrent && 'text-accent-yellow',
                  !isCompleted && !isCurrent && 'text-muted-gray/50'
                )}
              >
                {config.label}
              </span>
            </div>

            {/* Connector Line */}
            {index < STATUS_ORDER.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-2',
                  index < currentIndex ? 'bg-green-500' : 'bg-muted-gray/30'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default IncidentStatusStepper;
