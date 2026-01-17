/**
 * Application Modal - Main modal for applying to collabs/roles
 */
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Send, Video, Film, Image as ImageIcon, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import ElevatorPitchInput from './ElevatorPitchInput';
import CreditSelector from './CreditSelector';
import LocalHireConfirmation from './LocalHireConfirmation';
import PromoteApplicationToggle from './PromoteApplicationToggle';
import ApplicationTemplateSelector from './ApplicationTemplateSelector';
import SaveAsTemplateCheckbox from './SaveAsTemplateCheckbox';
import RequirementChecklist from './RequirementChecklist';
import CoverLetterSection from './CoverLetterSection';
import ResumeSelector from './ResumeSelector';
import CustomQuestionsAnswerer from '@/components/shared/CustomQuestionsAnswerer';

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

interface ApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  collab: CommunityCollab | null;
  onSuccess?: () => void;
}

const ApplicationModal: React.FC<ApplicationModalProps> = ({
  isOpen,
  onClose,
  collab,
  onSuccess,
}) => {
  const { profile } = useAuth();
  const isOrderMember = profile?.is_order_member || false;

  // Form state
  const [formState, setFormState] = useState<ApplicationFormState>({
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
    // Cast-specific fields
    demo_reel_url: '',
    self_tape_url: '',
    headshot_url: '',
    special_skills: [] as string[],
  });

  // Data hooks
  const { data: templates, isLoading: templatesLoading } = useApplicationTemplates();
  const { data: credits, isLoading: creditsLoading } = useSelectableCredits();
  const applyMutation = useApplyToCollab();
  const { createTemplate: createCoverLetterTemplate } = useCoverLetterTemplateMutations();

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormState({
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
        // Cast-specific fields
        demo_reel_url: '',
        self_tape_url: '',
        headshot_url: '',
        special_skills: [],
      });

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
    // Handle case where custom_questions might be a string or not an array
    const questions = Array.isArray(collab.custom_questions)
      ? collab.custom_questions
      : (typeof collab.custom_questions === 'string'
          ? JSON.parse(collab.custom_questions)
          : []);
    if (!questions || questions.length === 0) {
      return false;
    }
    return questions.some(
      (q: { id: string; required?: boolean }) => q.required && !formState.custom_question_responses[q.id]?.trim()
    );
  };

  // Check if can submit
  const canSubmit = () => {
    if (requirements.requires_local_hire && formState.local_hire_confirmed === null) {
      return false;
    }
    if (requirements.requires_order_member && !isOrderMember) {
      return false;
    }
    if (requirements.requires_resume && !formState.resume_id) {
      return false;
    }
    if (formState.save_as_template && !formState.template_name.trim()) {
      return false;
    }
    if (formState.save_cover_letter_as_template && !formState.cover_letter_template_name.trim()) {
      return false;
    }
    if (hasUnansweredRequiredQuestions()) {
      return false;
    }
    return true;
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!collab) return;

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
          custom_question_responses: Object.keys(formState.custom_question_responses).length > 0
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

  if (!collab) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-charcoal-black text-bone-white border-muted-gray max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl text-accent-yellow">
            Apply to: {collab.title}
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            Submit your application for this opportunity
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Requirements */}
          <RequirementChecklist requirements={requirements} fulfilled={fulfilled} />

          {/* Application Template Selector */}
          <ApplicationTemplateSelector
            templates={templates || []}
            value={formState.template_id}
            onChange={handleTemplateChange}
            isLoading={templatesLoading}
          />

          {/* Elevator Pitch */}
          <ElevatorPitchInput
            value={formState.elevator_pitch}
            onChange={(value) => updateField('elevator_pitch', value)}
          />

          {/* Cover Letter Section with Template Selection */}
          <CoverLetterSection
            value={formState.cover_note}
            onChange={(value) => updateField('cover_note', value)}
            selectedTemplateId={formState.cover_letter_template_id}
            onTemplateSelect={(templateId, content) => {
              updateField('cover_letter_template_id', templateId);
              if (content) {
                updateField('cover_note', content);
              }
            }}
            saveAsTemplate={formState.save_cover_letter_as_template}
            onSaveAsTemplateChange={(checked) => updateField('save_cover_letter_as_template', checked)}
            templateName={formState.cover_letter_template_name}
            onTemplateNameChange={(name) => updateField('cover_letter_template_name', name)}
          />

          {/* Credit Selector */}
          <CreditSelector
            credits={credits || []}
            selectedIds={formState.selected_credit_ids}
            onChange={(ids) => updateField('selected_credit_ids', ids)}
            isLoading={creditsLoading}
          />

          {/* Resume Selector */}
          <ResumeSelector
            selectedResumeId={formState.resume_id}
            onChange={(resumeId) => updateField('resume_id', resumeId)}
            required={requirements.requires_resume}
          />

          {/* Cast-Specific Fields (shown for looking_for_cast type) */}
          {collab.type === 'looking_for_cast' && (
            <div className="space-y-4 p-4 bg-charcoal-black/30 border border-muted-gray/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-accent-yellow" />
                <Label className="text-bone-white font-medium">Cast Materials</Label>
              </div>
              <p className="text-xs text-muted-gray -mt-2">
                {collab.tape_workflow === 'after_shortlist'
                  ? 'Self-tape will be requested if you are shortlisted'
                  : 'Provide the materials required for this role'}
              </p>

              {/* Demo Reel URL */}
              {collab.requires_reel && (
                <div className="space-y-2">
                  <Label htmlFor="demo_reel_url" className="text-bone-white flex items-center gap-2">
                    <Film className="w-4 h-4 text-purple-400" />
                    Demo Reel URL
                    <span className="text-primary-red text-xs">*</span>
                  </Label>
                  <Input
                    id="demo_reel_url"
                    value={formState.demo_reel_url}
                    onChange={(e) => updateField('demo_reel_url', e.target.value)}
                    placeholder="YouTube, Vimeo, or direct link to your demo reel"
                    className="bg-charcoal-black/50 border-muted-gray/30 text-bone-white placeholder:text-muted-gray"
                  />
                </div>
              )}

              {/* Self-Tape URL (only if workflow is upfront) */}
              {collab.requires_self_tape && collab.tape_workflow === 'upfront' && (
                <div className="space-y-2">
                  <Label htmlFor="self_tape_url" className="text-bone-white flex items-center gap-2">
                    <Video className="w-4 h-4 text-cyan-400" />
                    Self-Tape URL
                    <span className="text-primary-red text-xs">*</span>
                  </Label>
                  <Input
                    id="self_tape_url"
                    value={formState.self_tape_url}
                    onChange={(e) => updateField('self_tape_url', e.target.value)}
                    placeholder="YouTube, Vimeo, or direct link to your self-tape"
                    className="bg-charcoal-black/50 border-muted-gray/30 text-bone-white placeholder:text-muted-gray"
                  />
                  {collab.tape_instructions && (
                    <div className="p-3 bg-muted-gray/10 rounded-md border border-muted-gray/20">
                      <p className="text-xs text-muted-gray font-medium mb-1">Tape Instructions:</p>
                      <p className="text-sm text-bone-white whitespace-pre-wrap">{collab.tape_instructions}</p>
                    </div>
                  )}
                  {collab.tape_format_preferences && (
                    <p className="text-xs text-muted-gray">
                      Format: {collab.tape_format_preferences}
                    </p>
                  )}
                </div>
              )}

              {/* Tape will be requested notice (if workflow is after_shortlist) */}
              {collab.requires_self_tape && collab.tape_workflow === 'after_shortlist' && (
                <div className="p-3 bg-accent-yellow/10 border border-accent-yellow/30 rounded-md">
                  <p className="text-sm text-accent-yellow">
                    Self-tape will be requested if you are shortlisted for this role.
                  </p>
                  {collab.tape_instructions && (
                    <p className="text-xs text-muted-gray mt-2">
                      Instructions will be provided when requested.
                    </p>
                  )}
                </div>
              )}

              {/* Headshot URL */}
              {collab.requires_headshot && (
                <div className="space-y-2">
                  <Label htmlFor="headshot_url" className="text-bone-white flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-amber-400" />
                    Headshot URL
                    <span className="text-primary-red text-xs">*</span>
                  </Label>
                  <Input
                    id="headshot_url"
                    value={formState.headshot_url}
                    onChange={(e) => updateField('headshot_url', e.target.value)}
                    placeholder="Direct link to your headshot"
                    className="bg-charcoal-black/50 border-muted-gray/30 text-bone-white placeholder:text-muted-gray"
                  />
                </div>
              )}

              {/* Special Skills */}
              <div className="space-y-2">
                <Label className="text-bone-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  Special Skills (optional)
                </Label>
                <Input
                  value={formState.special_skills.join(', ')}
                  onChange={(e) => {
                    const skills = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                    updateField('special_skills', skills);
                  }}
                  placeholder="e.g., Stage combat, Horseback riding, Fluent Spanish"
                  className="bg-charcoal-black/50 border-muted-gray/30 text-bone-white placeholder:text-muted-gray"
                />
                <p className="text-xs text-muted-gray">
                  Separate skills with commas
                </p>
              </div>
            </div>
          )}

          {/* Custom Screening Questions */}
          {collab.custom_questions && collab.custom_questions.length > 0 && (
            <CustomQuestionsAnswerer
              questions={collab.custom_questions}
              responses={formState.custom_question_responses}
              onChange={(responses) => updateField('custom_question_responses', responses)}
            />
          )}

          {/* Availability Notes */}
          <div className="space-y-2">
            <Label htmlFor="availability" className="text-bone-white">
              Availability Notes
            </Label>
            <Textarea
              id="availability"
              value={formState.availability_notes}
              onChange={(e) => updateField('availability_notes', e.target.value)}
              placeholder="Available dates, schedule conflicts, etc."
              className="h-20 bg-charcoal-black/50 border-muted-gray/30 text-bone-white placeholder:text-muted-gray"
            />
          </div>

          {/* Local Hire Confirmation */}
          {requirements.requires_local_hire && (
            <LocalHireConfirmation
              value={formState.local_hire_confirmed}
              onChange={(value) => updateField('local_hire_confirmed', value)}
              location={collab.location}
            />
          )}

          {/* Promote Application */}
          <PromoteApplicationToggle
            value={formState.is_promoted}
            onChange={(value) => updateField('is_promoted', value)}
            isOrderMember={isOrderMember}
          />

          {/* Save Application as Template */}
          <SaveAsTemplateCheckbox
            checked={formState.save_as_template}
            onCheckedChange={(checked) => updateField('save_as_template', checked)}
            templateName={formState.template_name}
            onTemplateNameChange={(name) => updateField('template_name', name)}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-muted-gray/30 text-muted-gray hover:text-bone-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit() || applyMutation.isPending}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            {applyMutation.isPending ? (
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ApplicationModal;
