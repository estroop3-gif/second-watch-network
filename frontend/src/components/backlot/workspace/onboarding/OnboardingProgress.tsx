/**
 * OnboardingProgress - Horizontal step progress indicator
 */
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface OnboardingProgressProps {
  steps: Array<{
    label: string;
    status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  }>;
  currentStep: number;
  onStepClick?: (stepNumber: number) => void;
}

export function OnboardingProgress({ steps, currentStep, onStepClick }: OnboardingProgressProps) {
  return (
    <div className="flex items-center justify-between w-full px-4">
      {steps.map((step, index) => {
        const stepNum = index + 1;
        const isCompleted = step.status === 'completed';
        const isCurrent = stepNum === currentStep;
        const isClickable = isCompleted && onStepClick;

        return (
          <div key={index} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <button
                onClick={() => isClickable && onStepClick(stepNum)}
                disabled={!isClickable}
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  isCompleted && 'bg-green-500 text-white',
                  isCurrent && !isCompleted && 'bg-primary text-primary-foreground ring-2 ring-primary/30',
                  !isCompleted && !isCurrent && 'bg-muted text-muted-foreground',
                  step.status === 'skipped' && 'bg-muted text-muted-foreground line-through',
                  isClickable && 'cursor-pointer hover:ring-2 hover:ring-green-500/30'
                )}
              >
                {isCompleted ? <Check className="w-5 h-5" /> : stepNum}
              </button>
              <span className={cn(
                'mt-2 text-xs font-medium text-center max-w-[80px]',
                isCurrent ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-muted-foreground'
              )}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={cn(
                'h-0.5 flex-1 mx-3 mt-[-20px]',
                isCompleted ? 'bg-green-500' : 'bg-muted'
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
