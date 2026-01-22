/**
 * ReviewStep - Final wizard step showing summary of all entered data
 * Allows editing specific sections and includes submit options
 */
import React from 'react';
import {
  Pencil,
  MessageSquare,
  FileText,
  Award,
  Video,
  HelpCircle,
  Calendar,
  MapPin,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import PromoteApplicationToggle from '../PromoteApplicationToggle';
import SaveAsTemplateCheckbox from '../SaveAsTemplateCheckbox';

import type { ApplicationFormState, SelectableCredit } from '@/types/applications';
import type { CommunityCollab } from '@/types/community';
import type { WizardStep } from '@/hooks/applications/useApplicationForm';

interface ReviewStepProps {
  formState: ApplicationFormState;
  collab: CommunityCollab;
  credits: SelectableCredit[];
  visibleSteps: WizardStep[];
  isOrderMember: boolean;
  onEditStep: (stepIndex: number) => void;
  onUpdateField: <K extends keyof ApplicationFormState>(field: K, value: ApplicationFormState[K]) => void;
}

interface ReviewSectionProps {
  title: string;
  icon: React.ReactNode;
  stepId: string;
  visibleSteps: WizardStep[];
  onEdit: (stepIndex: number) => void;
  children: React.ReactNode;
  isEmpty?: boolean;
}

const ReviewSection: React.FC<ReviewSectionProps> = ({
  title,
  icon,
  stepId,
  visibleSteps,
  onEdit,
  children,
  isEmpty,
}) => {
  const stepIndex = visibleSteps.findIndex((s) => s.id === stepId);

  return (
    <div className="p-3 bg-charcoal-black/30 border border-muted-gray/20 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-bone-white">{title}</span>
        </div>
        {stepIndex !== -1 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(stepIndex)}
            className="h-7 px-2 text-xs text-accent-yellow hover:text-accent-yellow hover:bg-accent-yellow/10"
          >
            <Pencil className="w-3 h-3 mr-1" />
            Edit
          </Button>
        )}
      </div>
      <div className={cn('text-sm', isEmpty ? 'text-muted-gray italic' : 'text-bone-white/80')}>
        {children}
      </div>
    </div>
  );
};

const ReviewStep: React.FC<ReviewStepProps> = ({
  formState,
  collab,
  credits,
  visibleSteps,
  isOrderMember,
  onEditStep,
  onUpdateField,
}) => {
  // Get selected credits info
  const selectedCredits = credits.filter((c) => formState.selected_credit_ids.includes(c.id));

  // Parse custom questions safely
  let customQuestions: Array<{ id: string; question: string; required?: boolean }> = [];
  if (collab.custom_questions) {
    try {
      customQuestions = Array.isArray(collab.custom_questions)
        ? collab.custom_questions
        : typeof collab.custom_questions === 'string'
          ? JSON.parse(collab.custom_questions)
          : [];
    } catch {
      console.warn('[ReviewStep] Failed to parse custom_questions');
    }
  }

  const isCastRole = collab.type === 'looking_for_cast';
  const hasQuestions = customQuestions.length > 0;

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-medium text-bone-white">Review Your Application</h3>
        <p className="text-sm text-muted-gray">Please review before submitting</p>
      </div>

      {/* Pitch Section */}
      <ReviewSection
        title="Elevator Pitch"
        icon={<MessageSquare className="w-4 h-4 text-accent-yellow" />}
        stepId="pitch"
        visibleSteps={visibleSteps}
        onEdit={onEditStep}
        isEmpty={!formState.elevator_pitch}
      >
        {formState.elevator_pitch || 'No pitch provided'}
      </ReviewSection>

      {/* Cover Letter Section */}
      <ReviewSection
        title="Cover Letter"
        icon={<FileText className="w-4 h-4 text-blue-400" />}
        stepId="cover"
        visibleSteps={visibleSteps}
        onEdit={onEditStep}
        isEmpty={!formState.cover_note}
      >
        {formState.cover_note ? (
          <p className="line-clamp-3">{formState.cover_note}</p>
        ) : (
          'No cover letter provided'
        )}
      </ReviewSection>

      {/* Credentials Section */}
      <ReviewSection
        title="Credentials"
        icon={<Award className="w-4 h-4 text-purple-400" />}
        stepId="credentials"
        visibleSteps={visibleSteps}
        onEdit={onEditStep}
        isEmpty={!formState.resume_id && selectedCredits.length === 0}
      >
        <div className="space-y-1">
          <p>
            <span className="text-muted-gray">Resume:</span>{' '}
            {formState.resume_id ? (
              <span className="text-emerald-400 inline-flex items-center gap-1">
                <Check className="w-3 h-3" /> Attached
              </span>
            ) : (
              <span className="text-muted-gray">None</span>
            )}
          </p>
          <p>
            <span className="text-muted-gray">Credits:</span>{' '}
            {selectedCredits.length > 0
              ? `${selectedCredits.length} selected`
              : 'None selected'}
          </p>
        </div>
      </ReviewSection>

      {/* Cast Materials Section (conditional) */}
      {isCastRole && (
        <ReviewSection
          title="Cast Materials"
          icon={<Video className="w-4 h-4 text-cyan-400" />}
          stepId="cast"
          visibleSteps={visibleSteps}
          onEdit={onEditStep}
          isEmpty={!formState.demo_reel_url && !formState.self_tape_url && !formState.headshot_url}
        >
          <div className="space-y-1">
            {collab.requires_reel && (
              <p className="flex items-center gap-1">
                <span className="text-muted-gray">Demo Reel:</span>{' '}
                {formState.demo_reel_url ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Provided
                  </span>
                ) : (
                  <span className="text-red-400 flex items-center gap-1">
                    <X className="w-3 h-3" /> Required
                  </span>
                )}
              </p>
            )}
            {collab.requires_self_tape && collab.tape_workflow === 'upfront' && (
              <p className="flex items-center gap-1">
                <span className="text-muted-gray">Self-Tape:</span>{' '}
                {formState.self_tape_url ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Provided
                  </span>
                ) : (
                  <span className="text-red-400 flex items-center gap-1">
                    <X className="w-3 h-3" /> Required
                  </span>
                )}
              </p>
            )}
            {collab.requires_headshot && (
              <p className="flex items-center gap-1">
                <span className="text-muted-gray">Headshot:</span>{' '}
                {formState.headshot_url ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Provided
                  </span>
                ) : (
                  <span className="text-red-400 flex items-center gap-1">
                    <X className="w-3 h-3" /> Required
                  </span>
                )}
              </p>
            )}
            {formState.special_skills.length > 0 && (
              <p>
                <span className="text-muted-gray">Skills:</span>{' '}
                {formState.special_skills.join(', ')}
              </p>
            )}
          </div>
        </ReviewSection>
      )}

      {/* Screening Questions Section (conditional) */}
      {hasQuestions && (
        <ReviewSection
          title="Screening Questions"
          icon={<HelpCircle className="w-4 h-4 text-amber-400" />}
          stepId="questions"
          visibleSteps={visibleSteps}
          onEdit={onEditStep}
          isEmpty={Object.keys(formState.custom_question_responses).length === 0}
        >
          {Object.keys(formState.custom_question_responses).length > 0 ? (
            <p>{Object.keys(formState.custom_question_responses).length} questions answered</p>
          ) : (
            'No questions answered'
          )}
        </ReviewSection>
      )}

      {/* Details Section */}
      <ReviewSection
        title="Availability & Details"
        icon={<Calendar className="w-4 h-4 text-green-400" />}
        stepId="details"
        visibleSteps={visibleSteps}
        onEdit={onEditStep}
        isEmpty={!formState.availability_notes && formState.local_hire_confirmed === null}
      >
        <div className="space-y-1">
          <p>
            <span className="text-muted-gray">Availability:</span>{' '}
            {formState.availability_notes || 'Not specified'}
          </p>
          {collab.requires_local_hire && (
            <p className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-muted-gray" />
              <span className="text-muted-gray">Local Hire:</span>{' '}
              {formState.local_hire_confirmed === true ? (
                <span className="text-emerald-400">Yes, I am local</span>
              ) : formState.local_hire_confirmed === false ? (
                <span className="text-amber-400">Not local, willing to travel</span>
              ) : (
                <span className="text-red-400">Not confirmed</span>
              )}
            </p>
          )}
        </div>
      </ReviewSection>

      {/* Divider */}
      <div className="border-t border-muted-gray/20 my-4" />

      {/* Promote Application */}
      <PromoteApplicationToggle
        value={formState.is_promoted}
        onChange={(value) => onUpdateField('is_promoted', value)}
        isOrderMember={isOrderMember}
      />

      {/* Save as Template */}
      <SaveAsTemplateCheckbox
        checked={formState.save_as_template}
        onCheckedChange={(checked) => onUpdateField('save_as_template', checked)}
        templateName={formState.template_name}
        onTemplateNameChange={(name) => onUpdateField('template_name', name)}
      />
    </div>
  );
};

export default ReviewStep;
