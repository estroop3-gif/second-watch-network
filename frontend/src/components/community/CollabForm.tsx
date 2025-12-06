/**
 * CollabForm - Form for creating/editing collaboration posts
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCollabs } from '@/hooks/useCollabs';
import { CollabType, CompensationType, CommunityCollab } from '@/types/community';
import {
  X,
  Loader2,
  Users,
  Briefcase,
  Building2,
  Globe,
  MapPin,
  Calendar,
  Tag
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CollabFormProps {
  onClose: () => void;
  onSuccess?: (collab: CommunityCollab) => void;
  editCollab?: CommunityCollab;
}

const collabTypes: { id: CollabType; label: string; icon: React.ElementType; description: string }[] = [
  {
    id: 'looking_for_crew',
    label: 'Looking for Crew',
    icon: Users,
    description: 'You have a project and need team members',
  },
  {
    id: 'available_for_hire',
    label: 'Available for Hire',
    icon: Briefcase,
    description: 'You\'re available and looking for work',
  },
  {
    id: 'partner_opportunity',
    label: 'Partner Opportunity',
    icon: Building2,
    description: 'Brand/church/org seeking filmmakers',
  },
];

const compensationOptions: { id: CompensationType; label: string }[] = [
  { id: 'paid', label: 'Paid' },
  { id: 'unpaid', label: 'Unpaid / Volunteer' },
  { id: 'deferred', label: 'Deferred Pay' },
  { id: 'negotiable', label: 'Negotiable' },
];

const commonTags = [
  'Documentary', 'Narrative', 'Commercial', 'Wedding', 'Music Video',
  'Church', 'Motorsports', 'Sports', 'Corporate', 'Event',
  'Director', 'DP', 'Editor', 'Colorist', 'Sound', 'Producer'
];

const CollabForm: React.FC<CollabFormProps> = ({ onClose, onSuccess, editCollab }) => {
  const { createCollab, updateCollab } = useCollabs();
  const isEditing = !!editCollab;

  const [formData, setFormData] = useState({
    title: editCollab?.title || '',
    type: editCollab?.type || ('' as CollabType | ''),
    description: editCollab?.description || '',
    location: editCollab?.location || '',
    is_remote: editCollab?.is_remote ?? false,
    compensation_type: editCollab?.compensation_type || ('' as CompensationType | ''),
    start_date: editCollab?.start_date || '',
    end_date: editCollab?.end_date || '',
    tags: editCollab?.tags || [] as string[],
    is_order_only: editCollab?.is_order_only ?? false,
  });

  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if (!formData.type) {
      toast.error('Please select a collab type');
      return;
    }

    if (!formData.description.trim()) {
      toast.error('Please enter a description');
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
        compensation_type: formData.compensation_type as CompensationType || undefined,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
        tags: formData.tags,
        is_order_only: formData.is_order_only,
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
            {isEditing ? 'Edit Collab' : 'Post a Collab'}
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

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-bone-white">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Documentary DP needed for 3-day shoot"
              className="bg-charcoal-black/50 border-muted-gray/30"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-bone-white">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the opportunity, requirements, and what you're looking for..."
              className="bg-charcoal-black/50 border-muted-gray/30 min-h-[120px]"
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

          {/* Compensation */}
          <div className="space-y-2">
            <Label className="text-bone-white">Compensation</Label>
            <div className="flex flex-wrap gap-2">
              {compensationOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, compensation_type: option.id })}
                  className={cn(
                    'px-4 py-2 rounded-md border text-sm transition-colors',
                    formData.compensation_type === option.id
                      ? 'border-accent-yellow bg-accent-yellow/10 text-accent-yellow'
                      : 'border-muted-gray/30 text-muted-gray hover:text-bone-white'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date" className="text-bone-white flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Start Date
              </Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="bg-charcoal-black/50 border-muted-gray/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date" className="text-bone-white flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                End Date
              </Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="bg-charcoal-black/50 border-muted-gray/30"
              />
            </div>
          </div>

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

          {/* Order Only Toggle */}
          <div className="flex items-center gap-3 p-4 bg-emerald-900/20 border border-emerald-600/30 rounded-lg">
            <input
              type="checkbox"
              id="order_only"
              checked={formData.is_order_only}
              onChange={(e) => setFormData({ ...formData, is_order_only: e.target.checked })}
              className="w-4 h-4 rounded border-muted-gray/30"
            />
            <Label htmlFor="order_only" className="text-bone-white cursor-pointer">
              <span className="block">Order Members Only</span>
              <span className="text-xs text-muted-gray">Only visible to Order of the Second Watch members</span>
            </Label>
          </div>

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
              {isEditing ? 'Save Changes' : 'Post Collab'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CollabForm;
