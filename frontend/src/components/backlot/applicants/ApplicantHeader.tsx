/**
 * ApplicantHeader - Header with navigation controls for applicant detail page
 */

import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';

interface ApplicantHeaderProps {
  collabTitle: string;
  currentIndex: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
  onBack: () => void;
}

export function ApplicantHeader({
  collabTitle,
  currentIndex,
  total,
  hasNext,
  hasPrev,
  onNext,
  onPrev,
  onBack,
}: ApplicantHeaderProps) {
  return (
    <div className="border-b border-muted-gray/30 bg-charcoal-black/50 backdrop-blur sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Left side - Back button and title */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-muted-gray hover:text-bone-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Applicants
            </Button>
            <div className="h-4 w-px bg-muted-gray/30" />
            <h1 className="text-lg font-semibold text-bone-white truncate max-w-md">
              {collabTitle}
            </h1>
          </div>

          {/* Right side - Navigation */}
          <div className="flex items-center gap-3">
            {total > 0 && (
              <span className="text-sm text-muted-gray">
                Applicant {currentIndex + 1} of {total}
              </span>
            )}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={onPrev}
                disabled={!hasPrev}
                className="border-muted-gray/30"
                title="Previous applicant (← arrow key)"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Prev</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onNext}
                disabled={!hasNext}
                className="border-muted-gray/30"
                title="Next applicant (→ arrow key)"
              >
                <span className="hidden sm:inline mr-1">Next</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
