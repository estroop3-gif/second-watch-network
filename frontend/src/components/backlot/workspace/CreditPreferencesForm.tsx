/**
 * CreditPreferencesForm - Form for users to set their credit display preferences
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useCreditPreferences, CREDIT_DEPARTMENTS } from '@/hooks/backlot/useCredits';
import { CreditPreference, CreditPreferenceInput, BacklotProfile } from '@/types/backlot';
import { Loader2, Award, Film, User, ExternalLink, Info } from 'lucide-react';

interface CreditPreferencesFormProps {
  userId: string;
  projectId?: string;
  roleId?: string;
  roleName?: string;
  existingPreference?: CreditPreference;
  userProfile?: BacklotProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreditPreferencesForm({
  userId,
  projectId,
  roleId,
  roleName,
  existingPreference,
  userProfile,
  open,
  onOpenChange,
  onSuccess,
}: CreditPreferencesFormProps) {
  const { toast } = useToast();
  const { createPreference, updatePreference, isLoading } = useCreditPreferences(userId, projectId);
  const isEditing = !!existingPreference;

  // Form state
  const [formData, setFormData] = useState<CreditPreferenceInput>({
    project_id: projectId || null,
    role_id: roleId || null,
    display_name: '',
    role_title_preference: '',
    department_preference: '',
    endorsement_note: '',
    imdb_id: '',
    use_as_default: false,
    is_public: true,
  });

  // Load existing preference or profile defaults
  useEffect(() => {
    if (existingPreference) {
      setFormData({
        project_id: existingPreference.project_id,
        role_id: existingPreference.role_id,
        display_name: existingPreference.display_name || '',
        role_title_preference: existingPreference.role_title_preference || '',
        department_preference: existingPreference.department_preference || '',
        endorsement_note: existingPreference.endorsement_note || '',
        imdb_id: existingPreference.imdb_id || '',
        use_as_default: existingPreference.use_as_default,
        is_public: existingPreference.is_public,
      });
    } else {
      // Pre-fill from user profile if available
      setFormData({
        project_id: projectId || null,
        role_id: roleId || null,
        display_name: userProfile?.display_name || '',
        role_title_preference: roleName || '',
        department_preference: '',
        endorsement_note: '',
        imdb_id: '',
        use_as_default: false,
        is_public: true,
      });
    }
  }, [existingPreference, userProfile, projectId, roleId, roleName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (isEditing && existingPreference) {
        await updatePreference.mutateAsync({
          id: existingPreference.id,
          ...formData,
        });
        toast({
          title: 'Preferences updated',
          description: 'Your credit preferences have been saved.',
        });
      } else {
        await createPreference.mutateAsync(formData);
        toast({
          title: 'Preferences saved',
          description: 'Your credit preferences have been created.',
        });
      }
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save preferences',
        variant: 'destructive',
      });
    }
  };

  const isPending = createPreference.isPending || updatePreference.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            {isEditing ? 'Edit Credit Preferences' : 'Set Credit Preferences'}
          </DialogTitle>
          <DialogDescription>
            Choose how your name and role appear in the project credits.
            {roleName && (
              <span className="block mt-1 text-foreground font-medium">
                Role: {roleName}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="display_name" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Display Name
            </Label>
            <Input
              id="display_name"
              placeholder={userProfile?.display_name || 'Your name as it appears in credits'}
              value={formData.display_name || ''}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              How your name will appear in credits (e.g., "John Smith", "J. Smith", stage name)
            </p>
          </div>

          {/* Role Title Preference */}
          <div className="space-y-2">
            <Label htmlFor="role_title_preference">Credit Title</Label>
            <Input
              id="role_title_preference"
              placeholder={roleName || 'e.g., Director of Photography, Lead Actor'}
              value={formData.role_title_preference || ''}
              onChange={(e) => setFormData({ ...formData, role_title_preference: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              The title that appears next to your name (can differ from your internal role)
            </p>
          </div>

          {/* Department */}
          <div className="space-y-2">
            <Label htmlFor="department_preference">Department</Label>
            <Select
              value={formData.department_preference || ''}
              onValueChange={(v) => setFormData({ ...formData, department_preference: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {CREDIT_DEPARTMENTS.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Which section your credit appears in
            </p>
          </div>

          {/* Endorsement Note */}
          <div className="space-y-2">
            <Label htmlFor="endorsement_note" className="flex items-center gap-2">
              <Award className="w-4 h-4" />
              Endorsements / Suffixes
            </Label>
            <Textarea
              id="endorsement_note"
              placeholder="e.g., ASC, Academy Award Winner, Emmy Nominee"
              value={formData.endorsement_note || ''}
              onChange={(e) => setFormData({ ...formData, endorsement_note: e.target.value })}
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Professional affiliations or honors to display after your name
            </p>
          </div>

          {/* IMDB ID */}
          <div className="space-y-2">
            <Label htmlFor="imdb_id" className="flex items-center gap-2">
              <Film className="w-4 h-4" />
              IMDB ID
            </Label>
            <div className="flex gap-2">
              <Input
                id="imdb_id"
                placeholder="nm0000123"
                value={formData.imdb_id || ''}
                onChange={(e) => setFormData({ ...formData, imdb_id: e.target.value })}
                className="flex-1"
              />
              {formData.imdb_id && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    window.open(`https://www.imdb.com/name/${formData.imdb_id}`, '_blank')
                  }
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Your IMDB name ID for linking credits (format: nm0000000)
            </p>
          </div>

          {/* Settings */}
          <div className="space-y-4 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_public">Public Credit</Label>
                <p className="text-xs text-muted-foreground">
                  Show this credit on the public project page
                </p>
              </div>
              <Switch
                id="is_public"
                checked={formData.is_public}
                onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="use_as_default">Use as Default</Label>
                <p className="text-xs text-muted-foreground">
                  Apply these preferences to future projects
                </p>
              </div>
              <Switch
                id="use_as_default"
                checked={formData.use_as_default}
                onCheckedChange={(checked) => setFormData({ ...formData, use_as_default: checked })}
              />
            </div>
          </div>

          {/* Preview */}
          {(formData.display_name || formData.role_title_preference) && (
            <div className="bg-muted/50 rounded-lg p-4 border">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Credit Preview
              </p>
              <p className="font-medium">
                {formData.display_name || userProfile?.display_name || 'Your Name'}
                {formData.endorsement_note && (
                  <span className="text-muted-foreground ml-1">
                    , {formData.endorsement_note}
                  </span>
                )}
              </p>
              {formData.role_title_preference && (
                <p className="text-sm text-muted-foreground">
                  {formData.role_title_preference}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? 'Update Preferences' : 'Save Preferences'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Inline variant for embedding in other forms (e.g., onboarding wizard)
 */
interface CreditPreferencesFieldsProps {
  formData: CreditPreferenceInput;
  setFormData: (data: CreditPreferenceInput) => void;
  userProfile?: BacklotProfile;
  roleName?: string;
}

export function CreditPreferencesFields({
  formData,
  setFormData,
  userProfile,
  roleName,
}: CreditPreferencesFieldsProps) {
  return (
    <div className="space-y-4">
      {/* Display Name */}
      <div className="space-y-2">
        <Label htmlFor="display_name">Display Name</Label>
        <Input
          id="display_name"
          placeholder={userProfile?.display_name || 'Your name as it appears in credits'}
          value={formData.display_name || ''}
          onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
        />
      </div>

      {/* Role Title */}
      <div className="space-y-2">
        <Label htmlFor="role_title_preference">Credit Title</Label>
        <Input
          id="role_title_preference"
          placeholder={roleName || 'Title shown in credits'}
          value={formData.role_title_preference || ''}
          onChange={(e) => setFormData({ ...formData, role_title_preference: e.target.value })}
        />
      </div>

      {/* Department */}
      <div className="space-y-2">
        <Label htmlFor="department_preference">Department</Label>
        <Select
          value={formData.department_preference || ''}
          onValueChange={(v) => setFormData({ ...formData, department_preference: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select department" />
          </SelectTrigger>
          <SelectContent>
            {CREDIT_DEPARTMENTS.map((dept) => (
              <SelectItem key={dept} value={dept}>
                {dept}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Endorsements */}
      <div className="space-y-2">
        <Label htmlFor="endorsement_note">Endorsements</Label>
        <Input
          id="endorsement_note"
          placeholder="ASC, Academy Award Winner"
          value={formData.endorsement_note || ''}
          onChange={(e) => setFormData({ ...formData, endorsement_note: e.target.value })}
        />
      </div>

      {/* IMDB */}
      <div className="space-y-2">
        <Label htmlFor="imdb_id">IMDB ID</Label>
        <Input
          id="imdb_id"
          placeholder="nm0000123"
          value={formData.imdb_id || ''}
          onChange={(e) => setFormData({ ...formData, imdb_id: e.target.value })}
        />
      </div>

      {/* Settings Row */}
      <div className="flex gap-6 pt-2">
        <div className="flex items-center gap-2">
          <Switch
            id="is_public_inline"
            checked={formData.is_public ?? true}
            onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked })}
          />
          <Label htmlFor="is_public_inline" className="text-sm">
            Public
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="use_as_default_inline"
            checked={formData.use_as_default ?? false}
            onCheckedChange={(checked) => setFormData({ ...formData, use_as_default: checked })}
          />
          <Label htmlFor="use_as_default_inline" className="text-sm">
            Use as default
          </Label>
        </div>
      </div>
    </div>
  );
}
