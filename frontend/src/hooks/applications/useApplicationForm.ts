/**
 * useApplicationForm - Shared form state and logic for application modal/wizard
 */
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  useApplicationTemplates,
  useApplyToCollab,
  useSelectableCredits,
  useCoverLetterTemplateMutations,
} from '@/hooks/applications';
import { useAuth } from '@/context/AuthContext';

import type {
  ApplicationFormState,
  ApplicationRequirements,
  ApplicationTemplate,
} from '@/types/applications';
import type { CommunityCollab } from '@/types/community';

// Wizard step definition
export interface WizardStep {
  id: string;
  title: string;
  shortTitle: string;
  isConditional?: boolean;
  condition?: (collab: CommunityCollab, formState: ApplicationFormState) => boolean;
}

// All application steps
export const APPLICATION_STEPS: WizardStep[] = [
  { id: 'pitch', title: 'Pitch & Template', shortTitle: 'Pitch', isConditional: false },
  { id: 'cover', title: 'Cover Letter', shortTitle: 'Cover', isConditional: false },
  { id: 'credentials', title: 'Credentials', shortTitle: 'Credentials', isConditional: false },
  {
    id: 'cast',
    title: 'Cast Materials',
    shortTitle: 'Cast',
    isConditional: true,
    condition: (collab) => collab.type === 'looking_for_cast',
  },
  {
    id: 'questions',
    title: 'Screening Questions',
    shortTitle: 'Questions',
    isConditional: true,
    condition: (collab) => {
      if (!collab.custom_questions) return false;
      const questions = Array.isArray(collab.custom_questions)
        ? collab.custom_questions
        : typeof collab.custom_questions === 'string'
          ? JSON.parse(collab.custom_questions)
          : [];
      return questions && questions.length > 0;
    },
  },
  { id: 'details', title: 'Availability & Details', shortTitle: 'Details', isConditional: false },
  { id: 'review', title: 'Review & Submit', shortTitle: 'Review', isConditional: false },
];

// Initial form state
const getInitialFormState = (): ApplicationFormState => ({
  elevator_pitch: '',
  cover_note: '',
  availability_notes: '',
  resume_id: null,
  selected_credit_ids: [],
  template_id: null,
  local_hire_confirmed: null,
  is_promoted: false,
  save_as_template: false,
  template_name: '',
  cover_letter_template_id: null,
  save_cover_letter_as_template: false,
  cover_letter_template_name: '',
  custom_question_responses: {},
  demo_reel_url: '',
  self_tape_url: '',
  headshot_url: '',
  special_skills: [],
});

interface UseApplicationFormOptions {
  collab: CommunityCollab | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function useApplicationForm({ collab, isOpen, onClose, onSuccess }: UseApplicationFormOptions) {
  const { profile } = useAuth();
  const isOrderMember = profile?.is_order_member || false;

  // Form state
  const [formState, setFormState] = useState<ApplicationFormState>(getInitialFormState());

  // Wizard state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Data hooks
  const { data: templates, isLoading: templatesLoading } = useApplicationTemplates();
  const { data: credits, isLoading: creditsLoading } = useSelectableCredits();
  const applyMutation = useApplyToCollab();
  const { createTemplate: createCoverLetterTemplate } = useCoverLetterTemplateMutations();

  // Get visible steps based on collab and form state
  const getVisibleSteps = useCallback((): WizardStep[] => {
    if (!collab) return APPLICATION_STEPS.filter((s) => !s.isConditional);
    return APPLICATION_STEPS.filter((step) => {
      if (!step.isConditional) return true;
      return step.condition?.(collab, formState) ?? true;
    });
  }, [collab, formState]);

  const visibleSteps = getVisibleSteps();
  const currentStep = visibleSteps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === visibleSteps.length - 1;

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormState(getInitialFormState());
      setCurrentStepIndex(0);

      // Auto-select default template if available
      const defaultTemplate = templates?.find((t) => t.is_default);
      if (defaultTemplate) {
        applyTemplate(defaultTemplate);
      }
    }
  }, [isOpen, templates]);

  // Apply a template to the form
  const applyTemplate = (template: ApplicationTemplate) => {
    setFormState((prev) => ({
      ...prev,
      template_id: template.id,
      elevator_pitch: template.elevator_pitch || '',
      cover_note: template.cover_letter || '',
      availability_notes: template.availability_notes || '',
      resume_id: template.default_resume_id || null,
      selected_credit_ids: template.default_credit_ids || [],
    }));
  };

  // Handle template selection
  const handleTemplateChange = (templateId: string | null, template?: ApplicationTemplate) => {
    if (template) {
      applyTemplate(template);
    } else {
      setFormState((prev) => ({
        ...prev,
        template_id: null,
      }));
    }
  };

  // Update form field
  const updateField = <K extends keyof ApplicationFormState>(
    field: K,
    value: ApplicationFormState[K]
  ) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  // Get requirements from collab
  const requirements: ApplicationRequirements = {
    requires_local_hire: collab?.requires_local_hire || false,
    requires_order_member: collab?.requires_order_member || false,
    requires_resume: collab?.requires_resume || false,
  };

  // Check fulfillment
  const fulfilled = {
    local_hire_confirmed: formState.local_hire_confirmed,
    is_order_member: isOrderMember,
    has_resume: !!formState.resume_id,
  };

  // Check if all required custom questions are answered
  const hasUnansweredRequiredQuestions = () => {
    if (!collab?.custom_questions) {
      return false;
    }
    const questions = Array.isArray(collab.custom_questions)
      ? collab.custom_questions
      : typeof collab.custom_questions === 'string'
        ? JSON.parse(collab.custom_questions)
        : [];
    if (!questions || questions.length === 0) {
      return false;
    }
    return questions.some(
      (q: { id: string; required?: boolean }) =>
        q.required && !formState.custom_question_responses[q.id]?.trim()
    );
  };

  // Validate current step
  const validateStep = (stepId: string): { valid: boolean; error?: string } => {
    switch (stepId) {
      case 'credentials':
        if (requirements.requires_resume && !formState.resume_id) {
          return { valid: false, error: 'Resume is required for this application' };
        }
        return { valid: true };

      case 'cast':
        if (collab?.requires_reel && !formState.demo_reel_url) {
          return { valid: false, error: 'Demo reel URL is required' };
        }
        if (collab?.requires_self_tape && collab?.tape_workflow === 'upfront' && !formState.self_tape_url) {
          return { valid: false, error: 'Self-tape URL is required' };
        }
        if (collab?.requires_headshot && !formState.headshot_url) {
          return { valid: false, error: 'Headshot URL is required' };
        }
        return { valid: true };

      case 'questions':
        if (hasUnansweredRequiredQuestions()) {
          return { valid: false, error: 'Please answer all required questions' };
        }
        return { valid: true };

      case 'details':
        if (requirements.requires_local_hire && formState.local_hire_confirmed === null) {
          return { valid: false, error: 'Please confirm your local hire status' };
        }
        return { valid: true };

      case 'review':
        if (formState.save_as_template && !formState.template_name.trim()) {
          return { valid: false, error: 'Please enter a template name' };
        }
        if (formState.save_cover_letter_as_template && !formState.cover_letter_template_name.trim()) {
          return { valid: false, error: 'Please enter a cover letter template name' };
        }
        return { valid: true };

      default:
        return { valid: true };
    }
  };

  // Check if can submit
  const canSubmit = () => {
    if (requirements.requires_local_hire && formState.local_hire_confirmed === null) {
      console.log('[canSubmit] blocked: local_hire not confirmed');
      return false;
    }
    if (requirements.requires_order_member && !isOrderMember) {
      console.log('[canSubmit] blocked: requires order member');
      return false;
    }
    if (requirements.requires_resume && !formState.resume_id) {
      console.log('[canSubmit] blocked: resume required but missing');
      return false;
    }
    if (formState.save_as_template && !formState.template_name.trim()) {
      console.log('[canSubmit] blocked: save_as_template but no name');
      return false;
    }
    if (formState.save_cover_letter_as_template && !formState.cover_letter_template_name.trim()) {
      console.log('[canSubmit] blocked: save_cover_letter_as_template but no name');
      return false;
    }
    if (hasUnansweredRequiredQuestions()) {
      console.log('[canSubmit] blocked: unanswered required questions');
      return false;
    }
    // Cast validation
    if (collab?.type === 'looking_for_cast') {
      if (collab.requires_reel && !formState.demo_reel_url) {
        console.log('[canSubmit] blocked: demo reel required');
        return false;
      }
      if (collab.requires_self_tape && collab.tape_workflow === 'upfront' && !formState.self_tape_url) {
        console.log('[canSubmit] blocked: self tape required');
        return false;
      }
      if (collab.requires_headshot && !formState.headshot_url) {
        console.log('[canSubmit] blocked: headshot required');
        return false;
      }
    }
    return true;
  };

  // Navigation
  const goToStep = (index: number) => {
    if (index >= 0 && index < visibleSteps.length) {
      setCurrentStepIndex(index);
    }
  };

  const goNext = () => {
    if (!currentStep) return;

    const validation = validateStep(currentStep.id);
    if (!validation.valid) {
      toast.error(validation.error || 'Please complete this step before continuing');
      return;
    }

    if (currentStepIndex < visibleSteps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const goBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  // Get a specific error message for why submission is blocked
  const getSubmitBlockedReason = (): string | null => {
    if (requirements.requires_local_hire && formState.local_hire_confirmed === null) {
      return 'Please confirm your local hire status in the Details step';
    }
    if (requirements.requires_order_member && !isOrderMember) {
      return 'This opportunity requires Order membership';
    }
    if (requirements.requires_resume && !formState.resume_id) {
      return 'Please select or upload a resume in the Credentials step';
    }
    if (formState.save_as_template && !formState.template_name.trim()) {
      return 'Please enter a name for your application template';
    }
    if (formState.save_cover_letter_as_template && !formState.cover_letter_template_name.trim()) {
      return 'Please enter a name for your cover letter template';
    }
    if (hasUnansweredRequiredQuestions()) {
      return 'Please answer all required screening questions';
    }
    if (collab?.type === 'looking_for_cast') {
      if (collab.requires_reel && !formState.demo_reel_url) {
        return 'Please provide your demo reel URL in the Cast Materials step';
      }
      if (collab.requires_self_tape && collab.tape_workflow === 'upfront' && !formState.self_tape_url) {
        return 'Please provide your self-tape URL in the Cast Materials step';
      }
      if (collab.requires_headshot && !formState.headshot_url) {
        return 'Please provide your headshot URL in the Cast Materials step';
      }
    }
    return null;
  };

  // Handle submit
  const handleSubmit = async () => {
    console.log('[useApplicationForm] handleSubmit called, collab:', collab?.id);
    if (!collab) {
      console.log('[useApplicationForm] No collab, aborting');
      return;
    }

    // Check if submission is allowed and show error if not
    const blockedReason = getSubmitBlockedReason();
    if (blockedReason) {
      console.log('[useApplicationForm] Submit blocked:', blockedReason);
      toast.error(blockedReason);
      return;
    }

    try {
      // Save cover letter as template if requested
      if (formState.save_cover_letter_as_template && formState.cover_note && formState.cover_letter_template_name) {
        await createCoverLetterTemplate.mutateAsync({
          name: formState.cover_letter_template_name,
          content: formState.cover_note,
        });
      }

      await applyMutation.mutateAsync({
        collabId: collab.id,
        input: {
          elevator_pitch: formState.elevator_pitch || undefined,
          cover_note: formState.cover_note || undefined,
          availability_notes: formState.availability_notes || undefined,
          resume_id: formState.resume_id || undefined,
          selected_credit_ids: formState.selected_credit_ids.length > 0 ? formState.selected_credit_ids : undefined,
          template_id: formState.template_id || undefined,
          local_hire_confirmed: formState.local_hire_confirmed ?? undefined,
          is_promoted: formState.is_promoted,
          save_as_template: formState.save_as_template,
          template_name: formState.template_name || undefined,
          custom_question_responses:
            Object.keys(formState.custom_question_responses).length > 0
              ? formState.custom_question_responses
              : undefined,
          // Cast-specific fields
          demo_reel_url: formState.demo_reel_url || undefined,
          self_tape_url: formState.self_tape_url || undefined,
          headshot_url: formState.headshot_url || undefined,
          special_skills: formState.special_skills.length > 0 ? formState.special_skills : undefined,
        },
      });

      toast.success('Application submitted successfully!');
      onClose();
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit application');
    }
  };

  return {
    // Form state
    formState,
    setFormState,
    updateField,

    // Template handling
    templates: templates || [],
    templatesLoading,
    handleTemplateChange,
    applyTemplate,

    // Credits
    credits: credits || [],
    creditsLoading,

    // Requirements
    requirements,
    fulfilled,
    isOrderMember,

    // Validation
    canSubmit,
    validateStep,

    // Wizard navigation
    visibleSteps,
    currentStep,
    currentStepIndex,
    isFirstStep,
    isLastStep,
    goToStep,
    goNext,
    goBack,

    // Submission
    handleSubmit,
    isSubmitting: applyMutation.isPending,
  };
}

export type UseApplicationFormReturn = ReturnType<typeof useApplicationForm>;
