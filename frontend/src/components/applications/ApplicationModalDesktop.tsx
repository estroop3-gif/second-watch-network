/**
 * ApplicationModalDesktop - Desktop modal view for applying to collabs
 * Shows all fields in a scrollable dialog
 */
import React from 'react';
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
import { Loader2, Send, Video, Film, Image as ImageIcon, Sparkles, AlertTriangle } from 'lucide-react';

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

import type { UseApplicationFormReturn } from '@/hooks/applications/useApplicationForm';
import type { CommunityCollab } from '@/types/community';

interface ApplicationModalDesktopProps {
  isOpen: boolean;
  onClose: () => void;
  collab: CommunityCollab;
  form: UseApplicationFormReturn;
}

const ApplicationModalDesktop: React.FC<ApplicationModalDesktopProps> = ({
  isOpen,
  onClose,
  collab,
  form,
}) => {
  const {
    formState,
    updateField,
    templates,
    templatesLoading,
    handleTemplateChange,
    credits,
    creditsLoading,
    requirements,
    fulfilled,
    isOrderMember,
    canSubmit,
    handleSubmit,
    isSubmitting,
  } = form;

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
          {/* Location required banner */}
          {!form.hasLocation && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-amber-300 font-medium">City & state required</p>
                <p className="text-muted-gray mt-1">
                  Please add your city & state to your profile before applying.{' '}
                  <a href="/account" className="text-accent-yellow underline hover:text-bone-white">
                    Edit profile
                  </a>
                </p>
              </div>
            </div>
          )}

          {/* Requirements */}
          <RequirementChecklist requirements={requirements} fulfilled={fulfilled} />

          {/* Application Template Selector */}
          <ApplicationTemplateSelector
            templates={templates}
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
            credits={credits}
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
                    const skills = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
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
            disabled={!canSubmit() || isSubmitting}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ApplicationModalDesktop;
