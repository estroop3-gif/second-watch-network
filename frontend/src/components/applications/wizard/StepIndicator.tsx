/**
 * StepIndicator - Progress indicator for application wizard
 * Shows dots connected by lines with current step highlighted
 */
import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WizardStep } from '@/hooks/applications/useApplicationForm';

interface StepIndicatorProps {
  steps: WizardStep[];
  currentStepIndex: number;
  onStepClick?: (index: number) => void;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  currentStepIndex,
  onStepClick,
}) => {
  return (
    <div className="w-full px-4 py-3 bg-charcoal-black/80 border-b border-muted-gray/20">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1">
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isClickable = onStepClick && (isCompleted || isCurrent);

          return (
            <React.Fragment key={step.id}>
              {/* Step dot */}
              <button
                type="button"
                onClick={() => isClickable && onStepClick?.(index)}
                disabled={!isClickable}
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all',
                  isCompleted && 'bg-accent-yellow text-charcoal-black',
                  isCurrent && 'bg-accent-yellow text-charcoal-black ring-2 ring-accent-yellow/50 ring-offset-2 ring-offset-charcoal-black',
                  !isCompleted && !isCurrent && 'bg-muted-gray/30 text-muted-gray',
                  isClickable && 'cursor-pointer hover:scale-110',
                  !isClickable && 'cursor-default'
                )}
                aria-label={`Step ${index + 1}: ${step.title}${isCompleted ? ' (completed)' : isCurrent ? ' (current)' : ''}`}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </button>

              {/* Connector line (except after last step) */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 w-4 sm:w-6 transition-colors',
                    index < currentStepIndex ? 'bg-accent-yellow' : 'bg-muted-gray/30'
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Current step title */}
      <p className="text-center text-sm text-bone-white mt-2 font-medium">
        {steps[currentStepIndex]?.title}
      </p>
    </div>
  );
};

export default StepIndicator;
