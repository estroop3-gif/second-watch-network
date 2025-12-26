/**
 * RolePostingForm - Form for creating/editing project roles
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useProjectRoleMutations, usePostRoleToCommunity, useRemoveRoleFromCommunity } from '@/hooks/backlot';
import {
  BacklotProjectRole,
  ProjectRoleInput,
  BacklotProjectRoleType,
  BacklotProjectRoleStatus,
  CREW_DEPARTMENTS,
  GENDER_OPTIONS,
} from '@/types/backlot';
import { Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import FeaturePostToggle from '@/components/shared/FeaturePostToggle';

interface RolePostingFormProps {
  projectId: string;
  role?: BacklotProjectRole;
  onSuccess: () => void;
  onCancel: () => void;
}

export function RolePostingForm({
  projectId,
  role,
  onSuccess,
  onCancel,
}: RolePostingFormProps) {
  const { toast } = useToast();
  const { createRole, updateRole } = useProjectRoleMutations(projectId);
  const postToCommunityMutation = usePostRoleToCommunity();
  const removeFromCommunityMutation = useRemoveRoleFromCommunity();
  const isEditing = !!role;

  // Track community posting state
  const [postToCommunity, setPostToCommunity] = useState(false);

  // Form state
  const [formData, setFormData] = useState<ProjectRoleInput>({
    type: 'crew',
    title: '',
    description: '',
    department: '',
    character_name: '',
    character_description: '',
    age_range: '',
    gender_requirement: 'any',
    location: '',
    start_date: '',
    end_date: '',
    days_estimated: null,
    paid: false,
    rate_description: '',
    rate_amount_cents: null,
    rate_type: null,
    is_order_only: false,
    is_featured: false,
    status: 'open',
    application_deadline: '',
    max_applications: null,
  });

  // Load existing role data
  useEffect(() => {
    if (role) {
      setFormData({
        type: role.type,
        title: role.title,
        description: role.description || '',
        department: role.department || '',
        character_name: role.character_name || '',
        character_description: role.character_description || '',
        age_range: role.age_range || '',
        gender_requirement: role.gender_requirement || 'any',
        location: role.location || '',
        start_date: role.start_date || '',
        end_date: role.end_date || '',
        days_estimated: role.days_estimated,
        paid: role.paid,
        rate_description: role.rate_description || '',
        rate_amount_cents: role.rate_amount_cents,
        rate_type: role.rate_type,
        is_order_only: role.is_order_only,
        is_featured: role.is_featured,
        status: role.status,
        application_deadline: role.application_deadline || '',
        max_applications: role.max_applications,
      });
      // Set community posting state based on whether role is already posted
      setPostToCommunity(!!role.community_job_id);
    }
  }, [role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast({
        title: 'Error',
        description: 'Role title is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Clean up empty strings to null
      const cleanedData: ProjectRoleInput = {
        ...formData,
        description: formData.description || null,
        department: formData.department || null,
        character_name: formData.character_name || null,
        character_description: formData.character_description || null,
        age_range: formData.age_range || null,
        gender_requirement: formData.gender_requirement || null,
        location: formData.location || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        rate_description: formData.rate_description || null,
        application_deadline: formData.application_deadline || null,
      };

      let savedRoleId: string;

      if (isEditing && role) {
        await updateRole.mutateAsync({ roleId: role.id, input: cleanedData });
        savedRoleId = role.id;
        toast({
          title: 'Role updated',
          description: 'The role has been updated successfully.',
        });
      } else {
        const response = await createRole.mutateAsync(cleanedData);
        // Backend returns {success: true, role: {...}}
        savedRoleId = response.role?.id || response.id;
        toast({
          title: 'Role created',
          description: 'Your role posting is now live.',
        });
      }

      // Handle community posting changes
      const wasPostedToCommunity = isEditing && role?.community_job_id;

      if (postToCommunity && !wasPostedToCommunity) {
        // Post to community
        try {
          await postToCommunityMutation.mutateAsync(savedRoleId);
          toast({
            title: 'Posted to Community',
            description: 'This role is now visible on the Collab Board.',
          });
        } catch (err: any) {
          console.error('Failed to post to community:', err);
          toast({
            title: 'Warning',
            description: `Role saved but failed to post to community: ${err.message}`,
            variant: 'destructive',
          });
        }
      } else if (!postToCommunity && wasPostedToCommunity) {
        // Remove from community
        try {
          await removeFromCommunityMutation.mutateAsync(savedRoleId);
          toast({
            title: 'Removed from Community',
            description: 'This role is no longer visible on the Collab Board.',
          });
        } catch (err: any) {
          console.error('Failed to remove from community:', err);
          toast({
            title: 'Warning',
            description: `Role saved but failed to remove from community: ${err.message}`,
            variant: 'destructive',
          });
        }
      }

      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save role',
        variant: 'destructive',
      });
    }
  };

  const isPending = createRole.isPending || updateRole.isPending ||
    postToCommunityMutation.isPending || removeFromCommunityMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Role Type Selection */}
      <div className="space-y-2">
        <Label>Role Type</Label>
        <Tabs
          value={formData.type}
          onValueChange={(v) => setFormData({ ...formData, type: v as BacklotProjectRoleType })}
        >
          <TabsList className="w-full">
            <TabsTrigger value="crew" className="flex-1">
              Crew Position
            </TabsTrigger>
            <TabsTrigger value="cast" className="flex-1">
              Cast Role
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Basic Info */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">
            {formData.type === 'cast' ? 'Role Name' : 'Position Title'} *
          </Label>
          <Input
            id="title"
            placeholder={
              formData.type === 'cast'
                ? 'e.g., Lead Actor, Supporting Role'
                : 'e.g., Director of Photography, 1st AC'
            }
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />
        </div>

        {formData.type === 'crew' ? (
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Select
              value={formData.department || ''}
              onValueChange={(v) => setFormData({ ...formData, department: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {CREW_DEPARTMENTS.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="character_name">Character Name</Label>
            <Input
              id="character_name"
              placeholder="e.g., John, The Detective"
              value={formData.character_name || ''}
              onChange={(e) =>
                setFormData({ ...formData, character_name: e.target.value })
              }
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">
          {formData.type === 'cast' ? 'Character/Role Description' : 'Job Description'}
        </Label>
        <Textarea
          id="description"
          placeholder={
            formData.type === 'cast'
              ? 'Describe the character, their role in the story, and any acting requirements...'
              : 'Describe the responsibilities, experience needed, and what the role involves...'
          }
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={4}
        />
      </div>

      {/* Cast-specific fields */}
      {formData.type === 'cast' && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="age_range">Age Range</Label>
            <Input
              id="age_range"
              placeholder="e.g., 25-35"
              value={formData.age_range || ''}
              onChange={(e) => setFormData({ ...formData, age_range: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select
              value={formData.gender_requirement || 'any'}
              onValueChange={(v) =>
                setFormData({ ...formData, gender_requirement: v })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GENDER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Location & Schedule */}
      <div className="space-y-4">
        <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          Location & Schedule
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="e.g., Tampa, FL"
              value={formData.location || ''}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="days_estimated">Estimated Days</Label>
            <Input
              id="days_estimated"
              type="number"
              step="0.5"
              min="0"
              placeholder="e.g., 5"
              value={formData.days_estimated || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  days_estimated: e.target.value ? parseFloat(e.target.value) : null,
                })
              }
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="start_date">Start Date</Label>
            <Input
              id="start_date"
              type="date"
              value={formData.start_date || ''}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_date">End Date</Label>
            <Input
              id="end_date"
              type="date"
              value={formData.end_date || ''}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Compensation */}
      <div className="space-y-4">
        <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          Compensation
        </h3>
        <div className="flex items-center gap-4">
          <Switch
            id="paid"
            checked={formData.paid}
            onCheckedChange={(checked) => setFormData({ ...formData, paid: checked })}
          />
          <Label htmlFor="paid">This is a paid position</Label>
        </div>
        {formData.paid && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rate_description">Rate Description</Label>
              <Input
                id="rate_description"
                placeholder="e.g., $200/day, Negotiable"
                value={formData.rate_description || ''}
                onChange={(e) =>
                  setFormData({ ...formData, rate_description: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate_type">Rate Type</Label>
              <Select
                value={formData.rate_type || ''}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    rate_type: v as any,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Flat Rate</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Application Settings */}
      <div className="space-y-4">
        <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          Application Settings
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="application_deadline">Application Deadline</Label>
            <Input
              id="application_deadline"
              type="date"
              value={formData.application_deadline || ''}
              onChange={(e) =>
                setFormData({ ...formData, application_deadline: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max_applications">Max Applications</Label>
            <Input
              id="max_applications"
              type="number"
              min="1"
              placeholder="No limit"
              value={formData.max_applications || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  max_applications: e.target.value ? parseInt(e.target.value) : null,
                })
              }
            />
          </div>
        </div>
      </div>

      {/* Visibility */}
      <div className="space-y-4">
        <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          Visibility
        </h3>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <Switch
              id="post_to_community"
              checked={postToCommunity}
              onCheckedChange={setPostToCommunity}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="post_to_community">Post to Community</Label>
                <Users className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">
                Share this role on the Collab Board for community members to discover and apply
              </p>
              {role?.community_job_id && (
                <p className="text-xs text-accent-yellow mt-1">
                  Currently posted to community
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Switch
              id="is_order_only"
              checked={formData.is_order_only}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_order_only: checked })
              }
            />
            <div>
              <Label htmlFor="is_order_only">Order Members Only</Label>
              <p className="text-xs text-muted-foreground">
                Only members of The Order can see and apply to this role
              </p>
            </div>
          </div>
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
        </div>
      </div>

      {/* Status (for editing) */}
      {isEditing && (
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status || 'open'}
            onValueChange={(v) =>
              setFormData({ ...formData, status: v as BacklotProjectRoleStatus })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="booked">Booked</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isEditing ? 'Update Role' : 'Post Role'}
        </Button>
      </div>
    </form>
  );
}
