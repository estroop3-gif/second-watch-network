/**
 * OnboardingWizardPage - Main wizard page for crew onboarding
 * Routes: /onboarding/:sessionId (auth) + /onboarding/external/:token (public)
 */

import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { OnboardingProgress } from '@/components/backlot/workspace/onboarding/OnboardingProgress';
import { OnboardingStepRenderer } from '@/components/backlot/workspace/onboarding/OnboardingStepRenderer';
import { OnboardingComplete } from '@/components/backlot/workspace/onboarding/OnboardingComplete';
import {
  useOnboardingSession,
  useOnboardingSessionByToken,
  useCompleteStep,
  useSaveStepProgress,
  useCompleteOnboarding,
} from '@/hooks/backlot/useOnboarding';
import type { OnboardingSession } from '@/hooks/backlot/useOnboarding';

/**
 * Authenticated onboarding wizard
 */
export default function OnboardingWizardPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { data: session, isLoading, error } = useOnboardingSession(sessionId);

  if (isLoading) return <WizardLoading />;
  if (error || !session) return <WizardError message={error instanceof Error ? error.message : 'Session not found'} />;

  return <WizardContent session={session} />;
}

/**
 * External/token-based onboarding wizard (no auth required)
 */
export function ExternalOnboardingWizardPage() {
  const { token } = useParams<{ token: string }>();
  const { data: session, isLoading, error } = useOnboardingSessionByToken(token);

  if (isLoading) return <WizardLoading />;
  if (error || !session) return <WizardError message={error instanceof Error ? error.message : 'Invalid or expired link'} />;

  return <WizardContent session={session} />;
}

/**
 * Shared wizard content
 */
function WizardContent({ session }: { session: OnboardingSession }) {
  const [currentStep, setCurrentStep] = useState(session.current_step);

  const completeStep = useCompleteStep();
  const saveProgress = useSaveStepProgress();
  const completeOnboarding = useCompleteOnboarding();

  const steps = session.steps || [];
  const activeStep = steps.find(s => s.step_number === currentStep);
  const isComplete = session.status === 'completed' || steps.every(s => s.status === 'completed' || s.status === 'skipped');

  const handleCompleteStep = useCallback(async (data: { formData?: Record<string, unknown>; signatureData?: string }) => {
    try {
      await completeStep.mutateAsync({
        sessionId: session.id,
        stepNumber: currentStep,
        formData: data.formData,
        signatureData: data.signatureData,
      });

      // Auto-advance to next step
      if (currentStep < session.total_steps) {
        setCurrentStep(prev => prev + 1);
      } else {
        // Last step - complete onboarding
        try {
          await completeOnboarding.mutateAsync(session.id);
        } catch {
          // Session might already be completed
        }
      }

      toast.success('Step completed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to complete step');
    }
  }, [session.id, currentStep, session.total_steps, completeStep, completeOnboarding]);

  const handleSaveProgress = useCallback((formData: Record<string, unknown>) => {
    saveProgress.mutate({
      sessionId: session.id,
      stepNumber: currentStep,
      formData,
    });
  }, [session.id, currentStep, saveProgress]);

  const handleStepClick = (stepNumber: number) => {
    setCurrentStep(stepNumber);
  };

  if (isComplete) {
    const completedCount = steps.filter(s => s.status === 'completed').length;
    return (
      <div className="min-h-screen bg-charcoal-black">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <OnboardingComplete
            completedSteps={completedCount}
            totalSteps={steps.length}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal-black">
      {/* Header */}
      <div className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <h1 className="text-lg font-semibold mb-4">Crew Onboarding</h1>
          <OnboardingProgress
            steps={steps.map(s => ({
              label: s.step_type === 'deal_memo_review' ? 'Deal Memo' :
                     s.step_type === 'document_sign' ? (s.document_title || 'Document') :
                     'Information',
              status: s.status,
            }))}
            currentStep={currentStep}
            onStepClick={handleStepClick}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Step {currentStep} of {session.total_steps}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
              disabled={currentStep <= 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            {activeStep?.status === 'completed' && currentStep < session.total_steps && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep(prev => prev + 1)}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>

        {activeStep ? (
          <OnboardingStepRenderer
            step={activeStep}
            onComplete={handleCompleteStep}
            onSaveProgress={handleSaveProgress}
            isCompleting={completeStep.isPending}
          />
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Step not found
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function WizardLoading() {
  return (
    <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-yellow mx-auto mb-4" />
        <p className="text-bone-white">Loading onboarding...</p>
      </div>
    </div>
  );
}

function WizardError({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-charcoal-black flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Unable to Load</h2>
          <p className="text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </div>
  );
}
