import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, PlusCircle, Trash2, Check, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useFormDraftRHF } from '@/hooks/useFormDraftRHF';
import { buildDraftKey } from '@/lib/formDraftStorage';

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { MultiSelect } from '@/components/ui/multi-select';
import { TagInput } from '@/components/ui/tag-input';
import { AccountSection } from '@/components/account/AccountSection';
import { AvatarUploader } from '@/components/account/AvatarUploader';
import ManageCredits from '@/components/profile/ManageCredits';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LocationAutocomplete, LocationData } from '@/components/ui/location-autocomplete';

import { departments, filmmakerSkills, experienceLevels, availableForOptions, contactMethods } from '@/data/filmmaker-options';

const skillOptions = filmmakerSkills.map(skill => ({ value: skill, label: skill }));

// Flexible URL validation - accepts with or without protocol
const flexibleUrl = z.string().refine(
  (val) => {
    if (!val || val === '') return true;
    // Add https:// if no protocol specified
    const urlToTest = val.match(/^https?:\/\//) ? val : `https://${val}`;
    try {
      new URL(urlToTest);
      return true;
    } catch {
      return false;
    }
  },
  { message: "Please enter a valid URL (e.g., example.com or https://example.com)" }
);

const profileSchema = z.object({
  fullName: z.string().min(2, "Full name is required."),
  displayName: z.string().optional(),
  location: z.string().optional(),
  location_visible: z.boolean().default(true),
  portfolio_website: flexibleUrl.optional().or(z.literal('')),
  reel_links: z.array(z.object({ value: flexibleUrl.optional().or(z.literal('')) })).optional(),
  bio: z.string().max(500, "Bio cannot exceed 500 characters.").optional(),
  department: z.string().optional(),
  skills: z.array(z.string()).optional(),
  experienceLevel: z.enum(["Entry-Level", "Mid-Level", "Senior", "Department Head"]).optional(),
  accepting_work: z.boolean().default(false),
  available_for: z.array(z.string()).optional(),
  preferred_locations: z.array(z.string()).optional(),
  contact_method: z.string().optional(),
  show_email: z.boolean().default(false),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface EditProfileFormProps {
  profile: any;
  onProfileUpdate: () => void;
  isFilmmaker?: boolean;
}

const EditProfileForm: React.FC<EditProfileFormProps> = ({ profile, onProfileUpdate, isFilmmaker = false }) => {
  const { user, session, profileId } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(profile?.updated_at || null);
  const [ariaMessage, setAriaMessage] = useState<string>('');

  // Keep a ref of last persisted values to revert on error
  const lastPersisted = useRef<ProfileFormValues | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile?.full_name || '',
      displayName: profile?.display_name || '',
      location: profile?.location || '',
      location_visible: profile?.location_visible ?? true,
      portfolio_website: profile?.portfolio_website || '',
      reel_links: profile?.reel_links?.map((link: string) => ({ value: link })) || [],
      bio: profile?.bio || '',
      department: profile?.department || '',
      skills: profile?.skills || [],
      experienceLevel: (profile?.experience_level as any) || undefined,
      accepting_work: profile?.accepting_work || false,
      available_for: profile?.available_for || [],
      preferred_locations: profile?.preferred_locations || [],
      contact_method: profile?.contact_method || '',
      show_email: profile?.show_email || false,
    },
    mode: 'onBlur',
  });

  const { clearDraft } = useFormDraftRHF(form, {
    key: buildDraftKey('profile', 'edit', profileId || 'unknown'),
    serverTimestamp: profile?.updated_at,
    enabled: !!profileId,
  });

  // Initialize lastPersisted with initial defaults
  useEffect(() => {
    lastPersisted.current = form.getValues();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { fields: reelFields, append: appendReel, remove: removeReel } = useFieldArray({
    control: form.control,
    name: "reel_links"
  });

  const isSaving = saveState === 'saving';
  const lastSavedText = useMemo(() => lastSavedAt ? new Date(lastSavedAt).toLocaleString() : '—', [lastSavedAt]);

  const [creditsDirty, setCreditsDirty] = useState(false);

  // Wrap onCreditsUpdate so credits changes make Save button enabled
  const handleCreditsUpdate = () => {
    setCreditsDirty(true);
    onProfileUpdate();
  };

  const onSubmit = async (data: ProfileFormValues) => {
    if (!profileId) {
      toast.error('You must be logged in to save changes.');
      return;
    }

    if (saveState === 'saving') return;

    setSaveState('saving');
    setErrorMessage(null);
    setAriaMessage('Saving profile...');

    const now = new Date().toISOString();
    const reelLinksArray = (data.reel_links || []).map((r) => r?.value).filter(Boolean) as string[];

    try {
      // Step 1: Update profiles table (core profile data)
      await api.updateProfile(profileId, {
        full_name: data.fullName || null,
        display_name: data.displayName || null,
        location_visible: data.location_visible,
      });

      // Step 2: Update filmmaker_profiles table (extended data)
      // Only do this if the user is a filmmaker or if they have filmmaker-specific data
      const hasFilmmakerData = data.department || data.skills?.length || data.bio || data.location;

      if (isFilmmaker || hasFilmmakerData) {
        await api.updateFilmmakerProfile(profileId, {
          full_name: data.fullName || null,
          bio: data.bio || null,
          location: data.location || null,
          department: data.department || null,
          experience_level: data.experienceLevel || null,
          skills: data.skills || [],
          portfolio_website: data.portfolio_website || null,
          reel_links: reelLinksArray,
          accepting_work: data.accepting_work || false,
          available_for: data.available_for || [],
          preferred_locations: data.preferred_locations || [],
          contact_method: data.contact_method || null,
          show_email: data.show_email || false,
        });
      }

      // Success!
      clearDraft();
      setLastSavedAt(now);
      setSaveState('success');
      setAriaMessage('Profile saved successfully.');
      toast.success('Profile saved successfully!');

      // Invalidate caches
      qc.invalidateQueries({ queryKey: ['profile', profileId] });
      qc.invalidateQueries({ queryKey: ['account-profile', profileId] });
      qc.invalidateQueries({ queryKey: ['filmmaker-profile', profileId] });

      onProfileUpdate();
      setCreditsDirty(false);

      // Update last persisted snapshot
      const nextPersisted: ProfileFormValues = {
        fullName: data.fullName || '',
        displayName: data.displayName || '',
        location: data.location || '',
        location_visible: data.location_visible ?? true,
        portfolio_website: data.portfolio_website || '',
        reel_links: reelLinksArray.map((link) => ({ value: link })),
        bio: data.bio || '',
        department: data.department || '',
        skills: data.skills || [],
        experienceLevel: data.experienceLevel as ProfileFormValues['experienceLevel'],
        accepting_work: data.accepting_work || false,
        available_for: data.available_for || [],
        preferred_locations: data.preferred_locations || [],
        contact_method: data.contact_method || '',
        show_email: data.show_email || false,
      };
      lastPersisted.current = nextPersisted;
      form.reset(nextPersisted);

      // Navigate to My Profile after a brief delay to show success state
      setTimeout(() => {
        navigate('/my-profile');
      }, 1000);

    } catch (err: any) {
      console.error('Profile save error:', err);
      const message = err?.message || 'Could not save changes. Please try again.';
      setErrorMessage(message);
      setSaveState('error');
      setAriaMessage('Save failed. Please review and try again.');
      toast.error(message);

      // Revert to last persisted values
      if (lastPersisted.current) {
        form.reset(lastPersisted.current);
      }

      setTimeout(() => {
        setSaveState('idle');
      }, 3000);
    }
  };

  // Handle location visibility toggle separately (optimistic update)
  const handleLocationVisibilityChange = async (checked: boolean, field: any) => {
    if (!profileId) return;

    const prev = field.value;
    field.onChange(checked);

    try {
      await api.updateProfile(profileId, { location_visible: checked });
      toast.success('Location preference updated');
      onProfileUpdate();
      qc.invalidateQueries({ queryKey: ['profile', profileId] });
      qc.invalidateQueries({ queryKey: ['account-profile', profileId] });
    } catch (error) {
      field.onChange(prev);
      toast.error('Could not update location visibility.');
    }
  };

  const canSave = (form.formState.isDirty || creditsDirty) && !isSaving;

  return (
    <Form {...form}>
      {/* aria-live region for screen readers */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {ariaMessage}
      </div>

      {/* Error Alert */}
      {errorMessage && saveState === 'error' && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Success Alert */}
      {saveState === 'success' && (
        <Alert className="mb-6 border-green-500 bg-green-500/10">
          <Check className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-500">Profile saved successfully!</AlertDescription>
        </Alert>
      )}

      <form id="profile-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-12" aria-busy={isSaving}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Profile</h2>
          <div className="text-sm text-muted-foreground">
            Last saved: <span aria-live="polite">{lastSavedText}</span>
          </div>
        </div>

        <AccountSection title="General Info">
          <div className="grid md:grid-cols-3 gap-8 items-start">
            <div className="flex flex-col items-center gap-4">
              <AvatarUploader avatarUrl={session?.user?.user_metadata?.avatar_url} />
              <div className="flex flex-wrap justify-center gap-2">
                {profile?.roles?.map((role: string) => (
                  <span key={role} className="bg-accent-yellow text-charcoal-black text-xs font-bold uppercase px-2 py-0.5 rounded-[4px] transform -rotate-3">{role}</span>
                ))}
              </div>
            </div>
            <div className="md:col-span-2 space-y-6">
              <FormField control={form.control} name="fullName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormDescription>Your legal name, shown on your public profile.</FormDescription>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="displayName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name (Optional)</FormLabel>
                  <FormDescription>An alias for forums, comments, etc.</FormDescription>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center pt-6">
            <FormField control={form.control} name="location" render={({ field }) => (
              <FormItem>
                <FormLabel>City & State</FormLabel>
                <FormControl>
                  <LocationAutocomplete
                    value={field.value || ''}
                    onChange={(locationData: LocationData) => {
                      // In city mode, displayName is already "City, State" format
                      field.onChange(locationData.displayName);
                    }}
                    showUseMyLocation={true}
                    placeholder="Start typing a city..."
                    mode="city"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="location_visible" render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border border-muted-gray/20 p-4 mt-6">
                <div className="space-y-0.5">
                  <FormLabel>Show location on my profile</FormLabel>
                  <p className="text-xs text-muted-foreground">If enabled, your city/state will be shown on your public profile.</p>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={(checked) => handleLocationVisibilityChange(checked, field)}
                  />
                </FormControl>
              </FormItem>
            )} />
          </div>
        </AccountSection>

        <AccountSection title="Bio & Links">
          <div className="space-y-6">
            <FormField control={form.control} name="bio" render={({ field }) => (
              <FormItem>
                <FormLabel>Bio / About Me</FormLabel>
                <FormControl><Textarea {...field} className="min-h-[120px]" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="portfolio_website" render={({ field }) => (
              <FormItem>
                <FormLabel>Personal Website</FormLabel>
                <FormControl><Input {...field} placeholder="https://yourwebsite.com" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div>
              <FormLabel>Reels / Demos</FormLabel>
              <div className="space-y-2 mt-2">
                {reelFields.map((fieldItem, index) => (
                  <FormField key={fieldItem.id} control={form.control} name={`reel_links.${index}.value`} render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2">
                        <FormControl><Input {...field} placeholder="https://vimeo.com/yourreel" /></FormControl>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeReel(index)}>
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remove reel link</span>
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => appendReel({ value: "" })}>
                  <PlusCircle className="mr-2 h-4 w-4" />Add Reel Link
                </Button>
              </div>
            </div>
          </div>
        </AccountSection>

        {/* Only show filmmaker-specific fields if user is a filmmaker or has filmmaker data */}
        {(isFilmmaker || profile?.department || profile?.skills?.length) && (
          <>
            <AccountSection title="Skills & Department">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="department" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Department</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger></FormControl>
                        <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="experienceLevel" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Experience Level</FormLabel>
                      <FormControl>
                        <RadioGroup onValueChange={field.onChange} value={field.value || ''} className="flex items-center space-x-4 pt-2">
                          {experienceLevels.map(level => (
                            <FormItem key={level} className="flex items-center space-x-2 space-y-0">
                              <FormControl><RadioGroupItem value={level} /></FormControl>
                              <FormLabel className="font-normal">{level}</FormLabel>
                            </FormItem>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="skills" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Skills</FormLabel>
                    <FormControl>
                      <MultiSelect options={skillOptions} selected={field.value || []} onChange={field.onChange} placeholder="Select your skills..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </AccountSection>

            <AccountSection title="Availability & Contact">
              <div className="space-y-6">
                <FormField control={form.control} name="accepting_work" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-muted-gray/20 p-4">
                    <div className="space-y-0.5"><FormLabel>Accepting New Work?</FormLabel></div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="available_for" render={() => (
                  <FormItem>
                    <FormLabel>Available For</FormLabel>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                      {availableForOptions.map((item) => (
                        <FormField key={item.id} control={form.control} name="available_for" render={({ field }) => (
                          <FormItem key={item.id} className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(item.label)}
                                onCheckedChange={(checked) =>
                                  checked
                                    ? field.onChange([...(field.value || []), item.label])
                                    : field.onChange(field.value?.filter((value) => value !== item.label))
                                }
                              />
                            </FormControl>
                            <FormLabel className="font-normal">{item.label}</FormLabel>
                          </FormItem>
                        )} />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="preferred_locations" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Work Locations</FormLabel>
                    <FormControl><TagInput {...field} value={field.value || []} placeholder="Type a location and press Enter..." /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="contact_method" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Contact Method</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select contact method" /></SelectTrigger></FormControl>
                        <SelectContent>{contactMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="show_email" render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-muted-gray/20 p-4">
                      <div className="space-y-0.5"><FormLabel>Show Email on Profile?</FormLabel></div>
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                  )} />
                </div>
              </div>
            </AccountSection>
          </>
        )}
      </form>

      {/* Credits section after all profile fields - only for filmmakers */}
      {(isFilmmaker || profile?.credits?.length) && (
        <div className="mt-12">
          <ManageCredits
            initialCredits={profile?.credits || []}
            onCreditsUpdate={handleCreditsUpdate}
          />
        </div>
      )}

      {/* Save button as last interactive element on the page */}
      <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
        {saveState === 'error' && errorMessage && (
          <p className="text-sm text-red-500">{errorMessage}</p>
        )}
        <Button
          form="profile-form"
          type="submit"
          size="lg"
          disabled={!canSave}
          className="bg-accent-yellow text-charcoal-black hover:bg-bone-white w-full sm:w-auto sm:ml-auto"
          aria-disabled={!canSave}
          aria-busy={isSaving}
        >
          {saveState === 'saving' && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {saveState === 'success' && <Check className="mr-2 h-4 w-4" aria-hidden="true" />}
          <span>{saveState === 'saving' ? 'Saving…' : saveState === 'success' ? 'Saved!' : 'Save Changes'}</span>
        </Button>
      </div>
    </Form>
  );
};

export default EditProfileForm;
