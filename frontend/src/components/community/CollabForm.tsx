/**
 * CollabForm - Form for creating/editing collaboration posts
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useCollabs } from '@/hooks/useCollabs';
import { CollabType, CompensationType, CommunityCollab, JobType } from '@/types/community';
import { ProductionType, UnionType, CustomQuestion } from '@/types/productions';
import {
  X,
  Loader2,
  Users,
  Building2,
  Globe,
  MapPin,
  Tag,
  FileText,
  ClipboardCheck,
  Film,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Import new components
import ProductionTypeSelect from '@/components/shared/ProductionTypeSelect';
import UnionRequirements from '@/components/shared/UnionRequirements';
import OrderRequirement from '@/components/shared/OrderRequirement';
import CustomQuestionsBuilder from '@/components/shared/CustomQuestionsBuilder';
import JobTypeToggle from '@/components/shared/JobTypeToggle';
import ProductionTitleSelector from '@/components/shared/ProductionTitleSelector';
import CompanySelector from '@/components/shared/CompanySelector';
import EnhancedNetworkSelector from '@/components/shared/EnhancedNetworkSelector';
import FreelanceCompFields from '@/components/shared/FreelanceCompFields';
import FullTimeCompFields from '@/components/shared/FullTimeCompFields';
import FeaturePostToggle from '@/components/shared/FeaturePostToggle';
import PositionSelector from '@/components/shared/PositionSelector';

interface BacklotProjectData {
  id: string;
  title: string;
  production_type?: string | null;
  company?: string | null;
  company_id?: string | null;
  network_id?: string | null;
  location?: string | null;
}

interface CollabFormProps {
  onClose: () => void;
  onSuccess?: (collab: CommunityCollab) => void;
  editCollab?: CommunityCollab;
  /** When provided, the collab will be linked to this Backlot project */
  backlotProjectId?: string;
  /** Pre-populate form with Backlot project data */
  backlotProjectData?: BacklotProjectData;
}

const collabTypes: { id: CollabType; label: string; icon: React.ElementType; description: string }[] = [
  {
    id: 'looking_for_crew',
    label: 'Looking for Crew',
    icon: Users,
    description: 'You have a project and need team members',
  },
  {
    id: 'partner_opportunity',
    label: 'Partner Opportunity',
    icon: Building2,
    description: 'Brand/church/org seeking filmmakers',
  },
];

const commonTags = [
  'Documentary', 'Narrative', 'Commercial', 'Wedding', 'Music Video',
  'Church', 'Motorsports', 'Sports', 'Corporate', 'Event',
  'Director', 'DP', 'Editor', 'Colorist', 'Sound', 'Producer'
];

const CollabForm: React.FC<CollabFormProps> = ({ onClose, onSuccess, editCollab, backlotProjectId, backlotProjectData }) => {
  const { createCollab, updateCollab } = useCollabs();
  const isEditing = !!editCollab;
  const isFromBacklot = !!backlotProjectId;

  const [formData, setFormData] = useState({
    title: editCollab?.title || '',
    position_id: null as string | null,  // Track selected position
    type: editCollab?.type || (isFromBacklot ? 'looking_for_crew' : '' as CollabType | ''),
    description: editCollab?.description || '',
    location: editCollab?.location || backlotProjectData?.location || '',
    is_remote: editCollab?.is_remote ?? false,
    tags: editCollab?.tags || [] as string[],
    is_order_only: editCollab?.is_order_only ?? false,
    // Job type (freelance vs full-time)
    job_type: (editCollab?.job_type || 'freelance') as JobType,
    // Production info (pre-populated from Backlot project if provided)
    production_type: editCollab?.production_type || (backlotProjectData?.production_type as ProductionType) || null as ProductionType | null,
    production_title: editCollab?.production_title || backlotProjectData?.title || null as string | null,
    production_id: editCollab?.production_id || null as string | null,
    company: editCollab?.company || backlotProjectData?.company || '',
    company_id: editCollab?.company_id || backlotProjectData?.company_id || null as string | null,
    network_id: editCollab?.network_id || backlotProjectData?.network_id || null as string | null,
    hide_production_info: editCollab?.hide_production_info ?? false,
    // Freelance compensation
    compensation_type: editCollab?.compensation_type || ('' as CompensationType | ''),
    start_date: editCollab?.start_date || '',
    end_date: editCollab?.end_date || '',
    day_rate_min: editCollab?.day_rate_min || null as number | null,
    day_rate_max: editCollab?.day_rate_max || null as number | null,
    // Full-time compensation
    salary_min: editCollab?.salary_min || null as number | null,
    salary_max: editCollab?.salary_max || null as number | null,
    benefits_info: editCollab?.benefits_info || '',
    // Application requirements
    requires_local_hire: editCollab?.requires_local_hire ?? false,
    requires_order_member: editCollab?.requires_order_member ?? false,
    requires_resume: editCollab?.requires_resume ?? false,
    application_deadline: editCollab?.application_deadline || '',
    max_applications: editCollab?.max_applications || null as number | null,
    // Union and Order requirements
    union_requirements: editCollab?.union_requirements || [] as UnionType[],
    requires_order_membership: editCollab?.requires_order_membership ?? false,
    // Custom questions
    custom_questions: editCollab?.custom_questions || [] as CustomQuestion[],
    // Featured post
    is_featured: editCollab?.is_featured ?? false,
  });

  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Please select a position');
      return;
    }

    if (!formData.type) {
      toast.error('Please select a collab type');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        title: formData.title.trim(),
        type: formData.type as CollabType,
        description: formData.description.trim(),
        location: formData.location.trim() || undefined,
        is_remote: formData.is_remote,
        tags: formData.tags,
        is_order_only: formData.is_order_only,
        // Job type
        job_type: formData.job_type,
        // Backlot project link (when posting from Backlot)
        backlot_project_id: backlotProjectId || undefined,
        // Production info
        production_type: formData.production_type || undefined,
        production_title: formData.production_title || undefined,
        production_id: formData.production_id || undefined,
        company: formData.company.trim() || undefined,
        company_id: formData.company_id || undefined,
        network_id: formData.network_id || undefined,
        hide_production_info: formData.hide_production_info,
        // Freelance compensation fields
        compensation_type: formData.job_type === 'freelance' ? (formData.compensation_type as CompensationType || undefined) : undefined,
        start_date: formData.job_type === 'freelance' ? (formData.start_date || undefined) : undefined,
        end_date: formData.job_type === 'freelance' ? (formData.end_date || undefined) : undefined,
        day_rate_min: formData.job_type === 'freelance' ? (formData.day_rate_min || undefined) : undefined,
        day_rate_max: formData.job_type === 'freelance' ? (formData.day_rate_max || undefined) : undefined,
        // Full-time compensation fields
        salary_min: formData.job_type === 'full_time' ? (formData.salary_min || undefined) : undefined,
        salary_max: formData.job_type === 'full_time' ? (formData.salary_max || undefined) : undefined,
        benefits_info: formData.job_type === 'full_time' ? (formData.benefits_info.trim() || undefined) : undefined,
        // Application requirements
        requires_local_hire: formData.requires_local_hire,
        requires_order_member: formData.requires_order_member,
        requires_resume: formData.requires_resume,
        application_deadline: formData.application_deadline || undefined,
        max_applications: formData.max_applications || undefined,
        // Union and Order requirements
        union_requirements: formData.union_requirements,
        requires_order_membership: formData.requires_order_membership,
        // Custom questions
        custom_questions: formData.custom_questions.filter(q => q.question.trim()),
        // Featured post
        is_featured: formData.is_featured,
      };

      if (isEditing && editCollab) {
        await updateCollab.mutateAsync({ id: editCollab.id, ...payload });
        toast.success('Collab updated!');
      } else {
        const result = await createCollab.mutateAsync(payload);
        toast.success('Collab posted!');
        onSuccess?.(result);
      }

      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save collab');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTag = (tag: string) => {
    const normalizedTag = tag.trim().toLowerCase();
    if (normalizedTag && !formData.tags.includes(normalizedTag)) {
      setFormData({ ...formData, tags: [...formData.tags, normalizedTag] });
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-muted-gray/20">
          <h2 className="text-xl font-heading text-bone-white">
            {isEditing ? 'Edit Collab' : isFromBacklot ? 'Post New Role' : 'Post a Collab'}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-gray hover:text-bone-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {/* Collab Type Selection */}
          <div className="space-y-2">
            <Label className="text-bone-white">What type of collab is this?</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {collabTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, type: type.id })}
                  className={cn(
                    'p-4 rounded-lg border text-left transition-colors',
                    formData.type === type.id
                      ? 'border-accent-yellow bg-accent-yellow/10'
                      : 'border-muted-gray/30 hover:border-muted-gray/50'
                  )}
                >
                  <type.icon className={cn(
                    'w-5 h-5 mb-2',
                    formData.type === type.id ? 'text-accent-yellow' : 'text-muted-gray'
                  )} />
                  <div className="text-sm font-medium text-bone-white">{type.label}</div>
                  <div className="text-xs text-muted-gray mt-1">{type.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Position */}
          <div className="space-y-2">
            <Label className="text-bone-white">Position</Label>
            <PositionSelector
              value={formData.position_id}
              onChange={(id, position) => setFormData({
                ...formData,
                position_id: id,
                title: position?.name || ''
              })}
            />
            <p className="text-xs text-muted-gray">Select the position you're hiring for</p>
          </div>

          {/* Job Type Toggle */}
          <JobTypeToggle
            value={formData.job_type}
            onChange={(jobType) => setFormData({ ...formData, job_type: jobType })}
          />

          {/* Production Details */}
          <div className="space-y-4 p-4 bg-charcoal-black/30 border border-muted-gray/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Film className="w-5 h-5 text-accent-yellow" />
              <span className="text-bone-white font-medium">Production Details</span>
            </div>

            {/* Production Title */}
            <div className="space-y-2">
              <Label className="text-bone-white">Production Title</Label>
              <ProductionTitleSelector
                value={formData.production_id}
                onChange={(id, production) => setFormData({
                  ...formData,
                  production_id: id,
                  production_title: production?.name || null
                })}
              />
              <p className="text-xs text-muted-gray">Search existing productions or add a new one</p>
            </div>

            {/* Production Type */}
            <div className="space-y-2">
              <Label className="text-bone-white">Production Type</Label>
              <ProductionTypeSelect
                value={formData.production_type}
                onChange={(type) => setFormData({ ...formData, production_type: type })}
              />
            </div>

            {/* Company */}
            <div className="space-y-2">
              <Label className="text-bone-white">Production Company</Label>
              <CompanySelector
                value={formData.company_id}
                onChange={(id, company) => setFormData({
                  ...formData,
                  company_id: id,
                  company: company?.name || ''
                })}
              />
              <p className="text-xs text-muted-gray">Search existing companies or add a new one</p>
            </div>

            {/* Network / Distributor */}
            <div className="space-y-2">
              <Label className="text-bone-white">Network / Distributor</Label>
              <EnhancedNetworkSelector
                value={formData.network_id}
                onChange={(networkId) => setFormData({ ...formData, network_id: networkId })}
              />
              <p className="text-xs text-muted-gray">Where is this being distributed? Search or add a network</p>
            </div>

            {/* Hide Production Info */}
            <div className="flex items-center gap-3 pt-2 border-t border-muted-gray/20">
              <Checkbox
                id="hide_production_info"
                checked={formData.hide_production_info}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, hide_production_info: !!checked })
                }
              />
              <Label htmlFor="hide_production_info" className="text-bone-white cursor-pointer text-sm">
                Hide production details from applicants
              </Label>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-bone-white">
              Description <span className="text-muted-gray text-xs">(optional)</span>
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the opportunity, requirements, and what you're looking for..."
              className="bg-charcoal-black/50 border-muted-gray/30 min-h-[100px]"
            />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label className="text-bone-white">Location</Label>
            <div className="flex gap-3 mb-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_remote: false })}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-md border text-sm transition-colors',
                  !formData.is_remote
                    ? 'border-accent-yellow bg-accent-yellow/10 text-accent-yellow'
                    : 'border-muted-gray/30 text-muted-gray hover:text-bone-white'
                )}
              >
                <MapPin className="w-4 h-4" />
                On-site
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_remote: true, location: '' })}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-md border text-sm transition-colors',
                  formData.is_remote
                    ? 'border-accent-yellow bg-accent-yellow/10 text-accent-yellow'
                    : 'border-muted-gray/30 text-muted-gray hover:text-bone-white'
                )}
              >
                <Globe className="w-4 h-4" />
                Remote
              </button>
            </div>
            {!formData.is_remote && (
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="City, State or Region"
                className="bg-charcoal-black/50 border-muted-gray/30"
              />
            )}
          </div>

          {/* Compensation - Conditional based on job type */}
          {formData.job_type === 'freelance' ? (
            <FreelanceCompFields
              dayRateMin={formData.day_rate_min}
              dayRateMax={formData.day_rate_max}
              compensationType={formData.compensation_type}
              startDate={formData.start_date}
              endDate={formData.end_date}
              onDayRateMinChange={(value) => setFormData({ ...formData, day_rate_min: value })}
              onDayRateMaxChange={(value) => setFormData({ ...formData, day_rate_max: value })}
              onCompensationTypeChange={(value) => setFormData({ ...formData, compensation_type: value as CompensationType })}
              onStartDateChange={(value) => setFormData({ ...formData, start_date: value || '' })}
              onEndDateChange={(value) => setFormData({ ...formData, end_date: value || '' })}
            />
          ) : (
            <FullTimeCompFields
              salaryMin={formData.salary_min}
              salaryMax={formData.salary_max}
              benefitsInfo={formData.benefits_info}
              onSalaryMinChange={(value) => setFormData({ ...formData, salary_min: value })}
              onSalaryMaxChange={(value) => setFormData({ ...formData, salary_max: value })}
              onBenefitsInfoChange={(value) => setFormData({ ...formData, benefits_info: value })}
            />
          )}

          {/* Tags */}
          <div className="space-y-2">
            <Label className="text-bone-white flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Tags
            </Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-muted-gray/20 text-bone-white rounded"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-accent-yellow"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag(tagInput);
                  }
                }}
                placeholder="Add a tag..."
                className="bg-charcoal-black/50 border-muted-gray/30"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => addTag(tagInput)}
                className="border-muted-gray/30"
              >
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {commonTags.filter(t => !formData.tags.includes(t.toLowerCase())).slice(0, 8).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  className="px-2 py-0.5 text-xs text-muted-gray border border-muted-gray/20 rounded hover:text-bone-white hover:border-muted-gray/40 transition-colors"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Union Requirements */}
          <UnionRequirements
            value={formData.union_requirements}
            onChange={(unions) => setFormData({ ...formData, union_requirements: unions })}
          />

          {/* Order Requirement */}
          <OrderRequirement
            value={formData.requires_order_membership}
            onChange={(required) => setFormData({ ...formData, requires_order_membership: required })}
          />

          {/* Application Requirements */}
          <div className="space-y-4 p-4 bg-charcoal-black/30 border border-muted-gray/20 rounded-lg">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-accent-yellow" />
              <Label className="text-bone-white font-medium">Application Requirements</Label>
            </div>
            <p className="text-xs text-muted-gray -mt-2">
              Set what applicants must have or confirm when applying
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Local Hire Required */}
              <div className="flex items-center justify-between p-3 bg-charcoal-black/50 rounded-lg border border-muted-gray/10">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-bone-white">Local Hire Only</span>
                </div>
                <Switch
                  checked={formData.requires_local_hire}
                  onCheckedChange={(checked) => setFormData({ ...formData, requires_local_hire: checked })}
                />
              </div>

              {/* Resume Required */}
              <div className="flex items-center justify-between p-3 bg-charcoal-black/50 rounded-lg border border-muted-gray/10">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm text-bone-white">Resume Required</span>
                </div>
                <Switch
                  checked={formData.requires_resume}
                  onCheckedChange={(checked) => setFormData({ ...formData, requires_resume: checked })}
                />
              </div>
            </div>

            {/* Application Deadline */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="application_deadline" className="text-sm text-muted-gray">
                  Application Deadline (optional)
                </Label>
                <Input
                  id="application_deadline"
                  type="date"
                  value={formData.application_deadline || ''}
                  onChange={(e) => setFormData({ ...formData, application_deadline: e.target.value })}
                  className="bg-charcoal-black/50 border-muted-gray/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_applications" className="text-sm text-muted-gray">
                  Max Applications (optional)
                </Label>
                <Input
                  id="max_applications"
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={formData.max_applications || ''}
                  onChange={(e) => setFormData({ ...formData, max_applications: e.target.value ? parseInt(e.target.value) : null })}
                  className="bg-charcoal-black/50 border-muted-gray/30"
                />
              </div>
            </div>
          </div>

          {/* Custom Questions */}
          <CustomQuestionsBuilder
            questions={formData.custom_questions}
            onChange={(questions) => setFormData({ ...formData, custom_questions: questions })}
            maxQuestions={5}
          />

          {/* Feature Post Toggle */}
          <FeaturePostToggle
            value={formData.is_featured}
            onChange={(featured) => setFormData({ ...formData, is_featured: featured })}
            onFeatureRequest={async () => {
              // TODO: Implement Stripe checkout flow
              // For now, just toggle the value
              setFormData({ ...formData, is_featured: true });
              toast.info('Featured posts coming soon! Your post will be highlighted.');
            }}
          />

          {/* Note for Backlot posts */}
          {isFromBacklot && (
            <div className="p-3 bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg">
              <p className="text-sm text-accent-yellow">
                This role will be posted to the Collab Board where community members can discover and apply.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-muted-gray/20">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-muted-gray/30"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? 'Save Changes' : isFromBacklot ? 'Post Role' : 'Post Collab'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CollabForm;
