/**
 * StepNavigation - Navigation footer for application wizard
 * Shows Back/Next buttons with Submit on final step
 */
import React from 'react';
import { ChevronLeft, ChevronRight, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StepNavigationProps {
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  canSubmit: boolean;
  isSubmitting: boolean;
}

const StepNavigation: React.FC<StepNavigationProps> = ({
  onBack,
  onNext,
  onSubmit,
  isFirstStep,
  isLastStep,
  canSubmit,
  isSubmitting,
}) => {
  return (
    <div className="sticky bottom-0 left-0 right-0 p-4 bg-charcoal-black border-t border-muted-gray/20 safe-area-inset-bottom">
      <div className="flex items-center justify-between gap-3">
        {/* Back button */}
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isFirstStep || isSubmitting}
          className={cn(
            'flex-1 border-muted-gray/30 text-muted-gray hover:text-bone-white',
            isFirstStep && 'invisible'
          )}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>

        {/* Next/Submit button */}
        {isLastStep ? (
          <Button
            type="button"
            onClick={() => {
              console.log('[StepNavigation] Submit clicked, canSubmit:', canSubmit, 'isSubmitting:', isSubmitting);
              onSubmit();
            }}
            disabled={!canSubmit || isSubmitting}
            className="flex-1 bg-accent-yellow text-charcoal-black hover:bg-bone-white font-medium"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Submit Application
              </>
            )}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onNext}
            disabled={isSubmitting}
            className="flex-1 bg-accent-yellow text-charcoal-black hover:bg-bone-white font-medium"
          >
            Next Step
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default StepNavigation;
