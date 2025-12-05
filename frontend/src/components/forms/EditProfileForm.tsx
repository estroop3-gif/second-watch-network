import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, PlusCircle, Trash2, Check } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

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

import { departments, filmmakerSkills, experienceLevels, availableForOptions, contactMethods } from '@/data/filmmaker-options';

const skillOptions = filmmakerSkills.map(skill => ({ value: skill, label: skill }));

const profileSchema = z.object({
  fullName: z.string().min(2, "Full name is required."),
  displayName: z.string().optional(),
  location: z.string().optional(),
  location_visible: z.boolean().default(true),
  portfolio_website: z.string().url("Please enter a valid URL.").optional().or(z.literal('')),
  reel_links: z.array(z.object({ value: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')) })).optional(),
  bio: z.string().max(500, "Bio cannot exceed 500 characters.").optional(),
  department: z.string().min(1, "Please select a primary department."),
  skills: z.array(z.string()).min(1, "Please select at least one skill."),
  experienceLevel: z.enum(["Entry-Level", "Mid-Level", "Senior", "Department Head"]),
  accepting_work: z.boolean().default(false),
  available_for: z.array(z.string()).optional(),
  preferred_locations: z.array(z.string()).optional(),
  contact_method: z.string().min(1, "Please select a contact method."),
  show_email: z.boolean().default(false),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface EditProfileFormProps {
  profile: any;
  onProfileUpdate: () => void;
}

const EditProfileForm: React.FC<EditProfileFormProps> = ({ profile, onProfileUpdate }) => {
  const { user, session } = useAuth();
  const qc = useQueryClient();

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(profile?.updated_at || null);
  const [ariaMessage, setAriaMessage] = useState<string>('');

  // Keep a ref of last persisted values to revert on error
  const lastPersisted = useRef<ProfileFormValues | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile.full_name || '',
      displayName: profile.display_name || '',
      location: profile.location || '',
      location_visible: profile.location_visible ?? true,
      portfolio_website: profile.portfolio_website || '',
      reel_links: profile.reel_links?.map((link: string) => ({ value: link })) || [],
      bio: profile.bio || '',
      department: profile.department || '',
      skills: profile.skills || [],
      experienceLevel: (profile.experience_level as any) || undefined,
      accepting_work: profile.accepting_work || false,
      available_for: profile.available_for || [],
      preferred_locations: profile.preferred_locations || [],
      contact_method: profile.contact_method || '',
      show_email: profile.show_email || false,
    },
    mode: 'onBlur',
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
  const hasExistingProfile = Boolean((profile as any)?.id);
  const lastSavedText = useMemo(() => lastSavedAt ? new Date(lastSavedAt).toLocaleString() : '—', [lastSavedAt]);

  const [creditsDirty, setCreditsDirty] = useState(false);

  // Wrap onCreditsUpdate so credits changes make Save button enabled
  const handleCreditsUpdate = () => {
    setCreditsDirty(true);
    onProfileUpdate();
  };

  const handleServerValidation = async (invokeError: any) => {
    // Try to parse detailed error from the function response
    let fieldErrors: Record<string, string> | undefined;
    let message = "Couldn't save. Try again.";
    try {
      if (invokeError?.context?.json) {
        const j = await invokeError.context.json();
        if (j?.fieldErrors) fieldErrors = j.fieldErrors as Record<string, string>;
        if (j?.error) message = typeof j.error === 'string' ? j.error : message;
      } else if (invokeError?.message) {
        message = invokeError.message;
      }
    } catch {
      // ignore parsing errors
    }

    if (fieldErrors) {
      Object.entries(fieldErrors).forEach(([name, msg]) => {
        if (name in form.getValues()) {
          form.setError(name as keyof ProfileFormValues, { type: 'server', message: msg });
        }
      });
    }

    setSaveState('error');
    setAriaMessage("Save failed. Please review the form.");
    toast.error("Couldn't save changes. Try again.");
    // Revert to last persisted values
    if (lastPersisted.current) {
      form.reset(lastPersisted.current);
    }
  };

  const invokeWithRetry = async (body: any, maxRetries = 2) => {
    let attempt = 0;
    let lastError: any = null;
    while (attempt <= maxRetries) {
      const { data, error } = await supabase.functions.invoke('profile', { body });
      if (!error) return { data, error: null };
      lastError = error;
      // exponential-ish backoff: 300ms, then 600ms
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      attempt += 1;
    }
    return { data: null, error: lastError };
  };

  const onSubmit = async (data: ProfileFormValues) => {
    if (!user) return;

    if (saveState === 'saving') return;

    setSaveState('saving');
    setAriaMessage('Saving profile...');

    // Optimistically keep current UI; on error we'll revert using lastPersisted
    const payload = {
      fullName: data.fullName,
      displayName: data.displayName,
      location: data.location,
      location_visible: data.location_visible,
      portfolio_website: data.portfolio_website || '',
      reel_links: (data.reel_links || []).map((r) => r?.value).filter(Boolean) as string[],
      bio: data.bio,
      department: data.department,
      skills: data.skills,
      experienceLevel: data.experienceLevel,
      accepting_work: data.accepting_work,
      available_for: data.available_for || [],
      preferred_locations: data.preferred_locations || [],
      contact_method: data.contact_method,
      show_email: data.show_email,
    };

    const intent = hasExistingProfile ? 'update' : 'create';

    const { data: resp, error } = await invokeWithRetry({ intent, payload });

    if (error) {
      await handleServerValidation(error);
      setSaveState('idle');
      return;
    }

    // Success handling
    const updatedAt = resp?.updated_at || new Date().toISOString();
    setLastSavedAt(updatedAt);
    setSaveState('success');
    setAriaMessage('Profile saved.');

    toast.success("Profile saved");

    // Update caches and caller
    qc.setQueryData(['profile', user.id], resp?.profile || null);
    onProfileUpdate();
    setCreditsDirty(false);

    // Update last persisted snapshot and clear form dirty state
    const nextPersisted: ProfileFormValues = {
      fullName: payload.fullName || '',
      displayName: payload.displayName || '',
      location: payload.location || '',
      location_visible: payload.location_visible ?? true,
      portfolio_website: payload.portfolio_website || '',
      reel_links: payload.reel_links?.map((link) => ({ value: link })) || [],
      bio: payload.bio || '',
      department: payload.department || '',
      skills: payload.skills || [],
      experienceLevel: payload.experienceLevel as ProfileFormValues['experienceLevel'],
      accepting_work: payload.accepting_work || false,
      available_for: payload.available_for || [],
      preferred_locations: payload.preferred_locations || [],
      contact_method: payload.contact_method || '',
      show_email: payload.show_email || false,
    };
    lastPersisted.current = nextPersisted;
    form.reset(nextPersisted);

    setTimeout(() => {
      setSaveState('idle');
    }, 1200);
  };

  // Realtime: listen for credits changes so list updates immediately on settings page
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`credits:user:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credits', filter: `user_id=eq.${user.id}` }, () => {
      setCreditsDirty(true);
      onProfileUpdate();
    })
    .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, onProfileUpdate]);

  const canSave = (form.formState.isDirty || creditsDirty) && !isSaving;

  return (
    <Form {...form}>
      {/* aria-live region for screen readers */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {ariaMessage}
      </div>

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
                <FormControl><Input {...field} /></FormControl>
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
                  <Switch checked={field.value} onCheckedChange={async (checked) => {
                    const prev = field.value;
                    field.onChange(checked);
                    // Optimistic toggle with persistence
                    const { error } = await supabase
                      .from('profiles')
                      .update({ location_visible: checked })
                      .eq('id', user?.id);
                    if (error) {
                      // Revert on error
                      field.onChange(prev);
                      toast.error('Could not update location visibility.');
                    } else {
                      toast.success('Location preference updated');
                      // Inform parent and caches
                      onProfileUpdate();
                      if (user?.id) {
                        const current = qc.getQueryData(['profile', user.id]) as any;
                        if (current) {
                          qc.setQueryData(['profile', user.id], { ...current, location_visible: checked });
                        }
                      }
                    }
                  }} />
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
                <FormControl><Input {...field} /></FormControl>
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
                        <FormControl><Input {...field} /></FormControl>
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

        <AccountSection title="Skills & Department">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="department" render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Department</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="experienceLevel" render={({ field }) => (
                <FormItem>
                  <FormLabel>Experience Level</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex items-center space-x-4 pt-2">
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
                  <MultiSelect options={skillOptions} selected={field.value} onChange={field.onChange} placeholder="Select your skills..." />
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
                <FormControl><TagInput {...field} placeholder="Type a location and press Enter..." /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="contact_method" render={({ field }) => (
                <FormItem>
                  <FormLabel>Preferred Contact Method</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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
      </form>

      {/* Credits section after all profile fields */}
      <div className="mt-12">
        <ManageCredits
          initialCredits={profile.credits || []}
          onCreditsUpdate={handleCreditsUpdate}
        />
      </div>

      {/* Save button as last interactive element on the page */}
      <div className="mt-8 flex">
        <Button
          form="profile-form"
          type="submit"
          size="lg"
          disabled={!canSave}
          className="bg-accent-yellow text-charcoal-black hover:bg-bone-white w-full md:w-auto ml-auto"
          aria-disabled={!canSave}
          aria-busy={isSaving}
        >
          {saveState === 'saving' && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {saveState === 'success' && <Check className="mr-2 h-4 w-4" aria-hidden="true" />}
          <span>{saveState === 'saving' ? 'Saving…' : saveState === 'success' ? 'Saved' : 'Save Changes'}</span>
        </Button>
      </div>
    </Form>
  );
};

export default EditProfileForm;