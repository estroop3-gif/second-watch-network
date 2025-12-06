/**
 * GreenRoomTimeline Component
 * Visual timeline showing the Green Room cycle phases
 */
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Send,
  ListFilter,
  Vote,
  Trophy,
  Clapperboard,
  CheckCircle2,
} from 'lucide-react';
import { CycleStatus } from '@/lib/api/greenroom';
import { cn } from '@/lib/utils';

interface TimelineStep {
  id: string;
  label: string;
  icon: React.ElementType;
  duration: string;
  description: string;
}

const TIMELINE_STEPS: TimelineStep[] = [
  {
    id: 'submit',
    label: 'Submit',
    icon: Send,
    duration: '14 days',
    description: 'Filmmakers submit projects',
  },
  {
    id: 'shortlist',
    label: 'Shortlist',
    icon: ListFilter,
    duration: '7 days',
    description: 'Projects reviewed & approved',
  },
  {
    id: 'voting',
    label: 'Voting',
    icon: Vote,
    duration: '14 days',
    description: 'Community votes with tickets',
  },
  {
    id: 'winner',
    label: 'Winner',
    icon: Trophy,
    duration: '1 day',
    description: 'Results announced',
  },
  {
    id: 'development',
    label: 'Development',
    icon: Clapperboard,
    duration: 'Ongoing',
    description: 'Winner enters production',
  },
];

interface GreenRoomTimelineProps {
  currentPhase?: string;
  cycleStatus?: CycleStatus;
}

// Map cycle status to timeline step
const getActiveStep = (status?: CycleStatus): string => {
  switch (status) {
    case 'upcoming':
      return 'submit';
    case 'active':
      return 'voting';
    case 'closed':
      return 'winner';
    default:
      return '';
  }
};

export const GreenRoomTimeline: React.FC<GreenRoomTimelineProps> = ({
  currentPhase,
  cycleStatus,
}) => {
  const activeStep = currentPhase || getActiveStep(cycleStatus);

  const getStepStatus = (stepId: string): 'completed' | 'active' | 'upcoming' => {
    const stepIndex = TIMELINE_STEPS.findIndex(s => s.id === stepId);
    const activeIndex = TIMELINE_STEPS.findIndex(s => s.id === activeStep);

    if (activeIndex === -1) return 'upcoming';
    if (stepIndex < activeIndex) return 'completed';
    if (stepIndex === activeIndex) return 'active';
    return 'upcoming';
  };

  return (
    <Card className="bg-charcoal-black/50 border-muted-gray">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center justify-between overflow-x-auto pb-2">
          {TIMELINE_STEPS.map((step, index) => {
            const status = getStepStatus(step.id);
            const Icon = step.icon;
            const isLast = index === TIMELINE_STEPS.length - 1;

            return (
              <React.Fragment key={step.id}>
                {/* Step */}
                <div className="flex flex-col items-center min-w-[80px] md:min-w-[100px] group">
                  {/* Icon Circle */}
                  <div
                    className={cn(
                      'w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all',
                      status === 'completed' && 'bg-emerald-600 text-white',
                      status === 'active' && 'bg-accent-yellow text-charcoal-black ring-4 ring-accent-yellow/30',
                      status === 'upcoming' && 'bg-muted-gray/30 text-muted-gray'
                    )}
                  >
                    {status === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6" />
                    ) : (
                      <Icon className="h-5 w-5 md:h-6 md:w-6" />
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={cn(
                      'mt-2 text-xs md:text-sm font-medium text-center',
                      status === 'completed' && 'text-emerald-400',
                      status === 'active' && 'text-accent-yellow',
                      status === 'upcoming' && 'text-muted-gray'
                    )}
                  >
                    {step.label}
                  </span>

                  {/* Duration tooltip on hover */}
                  <span
                    className={cn(
                      'text-[10px] md:text-xs text-center opacity-0 group-hover:opacity-100 transition-opacity',
                      status === 'active' ? 'text-bone-white/70' : 'text-muted-gray'
                    )}
                  >
                    {step.duration}
                  </span>
                </div>

                {/* Connector Line */}
                {!isLast && (
                  <div className="flex-1 h-0.5 mx-1 md:mx-2 min-w-[20px] md:min-w-[40px]">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        getStepStatus(TIMELINE_STEPS[index + 1].id) === 'completed' ||
                          status === 'completed'
                          ? 'bg-emerald-600'
                          : status === 'active'
                          ? 'bg-gradient-to-r from-accent-yellow to-muted-gray/30'
                          : 'bg-muted-gray/30'
                      )}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Active phase description */}
        {activeStep && (
          <div className="mt-4 pt-4 border-t border-muted-gray/30 text-center">
            <p className="text-sm text-bone-white/70">
              <span className="text-accent-yellow font-semibold">Current Phase:</span>{' '}
              {TIMELINE_STEPS.find(s => s.id === activeStep)?.description}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GreenRoomTimeline;
